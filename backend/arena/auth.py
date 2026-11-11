import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.db.models import Q
from rest_framework import authentication, exceptions, permissions

from .models import User

ALLOWED_ROLES = {'OWNER', 'EMPLOYEE', 'CUSTOMER'}
SERVICE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000


@dataclass
class ActorContext:
    is_authenticated: bool
    role: str  # 'OWNER' | 'EMPLOYEE' | 'CUSTOMER' | 'ANONYMOUS'
    actor_id: str = ''
    name: str = ''
    email: str = ''
    phone: str = ''
    user: Optional[User] = None
    via: str = 'anonymous'
    service_verified: bool = False

    def is_owner(self) -> bool:
        if self.user and self.user.is_superuser:
            return True
        return self.is_authenticated and self.role == 'OWNER'

    def is_staff_member(self) -> bool:
        if self.user and (self.user.is_staff or self.user.is_superuser):
            return True
        return self.is_authenticated and self.role in ('OWNER', 'EMPLOYEE')


class ServicePrincipal:
    """Lightweight principal when Next.js BFF sends a cryptographically verified actor header."""

    def __init__(self, actor: ActorContext):
        self.actor = actor
        self.is_authenticated = actor.is_authenticated
        self.is_active = True
        self.is_anonymous = not actor.is_authenticated
        self.role = actor.role
        self.is_staff = actor.role in ('OWNER', 'EMPLOYEE')
        self.is_superuser = actor.role == 'OWNER'
        self.pk = actor.user.pk if actor.user else None
        self.id = self.pk
        self.email = actor.email
        self.phone = actor.phone
        self.username = actor.name or actor.actor_id

    def is_owner(self) -> bool:
        return self.actor.is_owner()

    def is_staff_member(self) -> bool:
        return self.actor.is_staff_member()


def compute_service_signature(
    secret: str,
    timestamp_ms: str,
    method: str,
    full_path: str,
    actor_id: str,
    actor_role: str,
    body_bytes: bytes,
) -> str:
    body_hash = hashlib.sha256(body_bytes or b'').hexdigest()
    payload = f"{timestamp_ms}\n{method.upper()}\n{full_path}\n{actor_id}\n{actor_role}\n{body_hash}"
    return hmac.new(secret.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()


def _resolve_db_user(actor_id: str, email: str, phone: str) -> Optional[User]:
    if not actor_id and not email:
        return None
    query = Q()
    if actor_id:
        query |= Q(external_id=actor_id)
        if actor_id.startswith('usr-') and actor_id[4:].isdigit():
            query |= Q(id=int(actor_id[4:]))
        elif actor_id.isdigit():
            query |= Q(id=int(actor_id))
    if email:
        query |= Q(email__iexact=email.strip())
    if not query:
        return None
    user = User.objects.filter(query).first()
    return user


def _verify_service_headers(django_request) -> Optional[ActorContext]:
    meta = django_request.META
    sig = meta.get('HTTP_X_BOSS_SERVICE_SIGNATURE', '').strip()
    ts_str = meta.get('HTTP_X_BOSS_TIMESTAMP', '').strip()
    actor_id = meta.get('HTTP_X_BOSS_ACTOR_ID', '').strip()
    actor_role = meta.get('HTTP_X_BOSS_ACTOR_ROLE', '').strip().upper()
    actor_name = meta.get('HTTP_X_BOSS_ACTOR_NAME', '').strip()
    actor_email = meta.get('HTTP_X_BOSS_ACTOR_EMAIL', '').strip().lower()
    actor_phone = meta.get('HTTP_X_BOSS_ACTOR_PHONE', '').strip()

    has_any_boss_header = any([sig, ts_str, actor_id, actor_role, actor_name, actor_email, actor_phone])
    if not has_any_boss_header:
        return None

    secret = getattr(settings, 'BACKEND_SERVICE_SECRET', '') or ''
    if not secret:
        raise exceptions.AuthenticationFailed('Backend service secret is not configured.')

    if not sig or not ts_str:
        raise exceptions.AuthenticationFailed('Missing service authentication signature or timestamp.')

    try:
        ts_ms = int(ts_str)
    except ValueError as exc:
        raise exceptions.AuthenticationFailed('Invalid service authentication timestamp.') from exc

    now_ms = int(time.time() * 1000)
    if abs(now_ms - ts_ms) > SERVICE_TIMESTAMP_TOLERANCE_MS:
        raise exceptions.AuthenticationFailed('Expired service authentication timestamp.')

    body_sha_override = meta.get('HTTP_X_BOSS_BODY_SHA256', '').strip().lower()
    content_type = (django_request.content_type or '').lower()
    if 'multipart/form-data' in content_type and body_sha_override:
        # For streamed multipart uploads, BFF signs body metadata; verify body matches if read
        raw_bytes = django_request.body
        actual_sha = hashlib.sha256(raw_bytes).hexdigest()
        if not hmac.compare_digest(actual_sha, body_sha_override):
            raise exceptions.AuthenticationFailed('Service payload digest mismatch.')
    else:
        raw_bytes = django_request.body

    expected = compute_service_signature(
        secret=secret,
        timestamp_ms=ts_str,
        method=django_request.method,
        full_path=django_request.get_full_path(),
        actor_id=actor_id,
        actor_role=actor_role,
        body_bytes=raw_bytes,
    )
    if not hmac.compare_digest(expected, sig.lower()):
        raise exceptions.AuthenticationFailed('Invalid service authentication signature.')

    if actor_id or actor_role:
        if actor_role not in ALLOWED_ROLES or not actor_id:
            raise exceptions.AuthenticationFailed('Invalid actor claim in service request.')
        db_user = _resolve_db_user(actor_id, actor_email, actor_phone)
        if db_user and not db_user.is_active:
            raise exceptions.AuthenticationFailed('Account is disabled.')
        # Database role takes precedence over forwarded role claim when user record exists
        resolved_role = db_user.role if db_user else actor_role
        return ActorContext(
            is_authenticated=True,
            role=resolved_role,
            actor_id=db_user.public_id if db_user else actor_id,
            name=actor_name or (db_user.get_full_name() or db_user.username if db_user else ''),
            email=actor_email or (db_user.email if db_user else ''),
            phone=actor_phone or (db_user.phone or '' if db_user else ''),
            user=db_user,
            via='service',
            service_verified=True,
        )

    return ActorContext(
        is_authenticated=False,
        role='ANONYMOUS',
        via='service',
        service_verified=True,
    )


class ServiceAuthentication(authentication.BaseAuthentication):
    """Authenticates trusted Next.js BFF calls signed with BACKEND_SERVICE_SECRET."""

    def authenticate_header(self, request):
        return 'Boss-HMAC realm="boss-arena-api"'

    def authenticate(self, request):
        django_req = getattr(request, '_request', request)
        actor = _verify_service_headers(django_req)
        if actor is None:
            return None

        django_req._boss_actor = actor
        if not actor.is_authenticated:
            return None

        principal = actor.user if actor.user else ServicePrincipal(actor)
        return (principal, actor)


def resolve_actor(request) -> ActorContext:
    django_req = getattr(request, '_request', request)
    cached = getattr(django_req, '_boss_actor', None)
    if isinstance(cached, ActorContext):
        return cached

    auth_obj = getattr(request, 'auth', None)
    if isinstance(auth_obj, ActorContext):
        return auth_obj

    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        if isinstance(user, ServicePrincipal):
            return user.actor
        role = 'OWNER' if user.is_owner() else 'EMPLOYEE' if user.is_staff_member() else 'CUSTOMER'
        return ActorContext(
            is_authenticated=True,
            role=role,
            actor_id=user.public_id if hasattr(user, 'public_id') else f"usr-{user.id}",
            name=(user.get_full_name() or user.username) if hasattr(user, 'get_full_name') else str(user),
            email=getattr(user, 'email', '') or '',
            phone=getattr(user, 'phone', '') or '',
            user=user if isinstance(user, User) else None,
            via='django',
            service_verified=False,
        )

    return ActorContext(is_authenticated=False, role='ANONYMOUS', via='anonymous', service_verified=False)


class IsAuthenticatedActor(permissions.BasePermission):
    def has_permission(self, request, view):
        return resolve_actor(request).is_authenticated


class IsStaffActor(permissions.BasePermission):
    def has_permission(self, request, view):
        return resolve_actor(request).is_staff_member()


class IsOwnerActor(permissions.BasePermission):
    def has_permission(self, request, view):
        return resolve_actor(request).is_owner()
