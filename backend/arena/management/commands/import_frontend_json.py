import json
import os
import re
import shutil
from datetime import datetime, time as dt_time, timezone as dt_timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from arena.models import (
    ArenaSchedule,
    AuditLog,
    Booking,
    Court,
    DiscountCode,
    GalleryItem,
    PricingConfig,
    ScheduleBlock,
    SlotHold,
    User,
    normalize_phone_digits,
)

VENUE_TZ = ZoneInfo('Asia/Kolkata')
DEMO_USER_IDS = {'usr-owner-01', 'usr-emp-01', 'usr-cust-01'}
DEMO_USER_EMAILS = {'owner@boss.com', 'staff@boss.com', 'player@boss.com'}


def _parse_dt(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if raw.endswith('Z'):
        raw = raw[:-1] + '+00:00'
    dt = datetime.fromisoformat(raw)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, VENUE_TZ)
    return dt.astimezone(dt_timezone.utc)


def _parse_hhmm(value: str | None, fallback: dt_time) -> dt_time:
    if not value:
        return fallback
    parts = str(value).strip().split(':')
    return dt_time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)


class Command(BaseCommand):
    help = 'Idempotently import frontend JSON stores (pickleball_database.json and users_auth.json) into Django/PostgreSQL.'

    def add_arguments(self, parser):
        repo_root = Path(settings.BASE_DIR).parent
        parser.add_argument(
            '--pickleball-json',
            default=str(repo_root / 'frontend' / 'data' / 'pickleball_database.json'),
            help='Path to pickleball_database.json',
        )
        parser.add_argument(
            '--users-json',
            default=str(repo_root / 'frontend' / 'data' / 'users_auth.json'),
            help='Path to users_auth.json',
        )
        parser.add_argument(
            '--backup-dir',
            default='',
            help='Directory to write pre-migration backups of source JSONs and current DB snapshot before importing.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate and validate migration inside a rolled-back transaction without persisting changes.',
        )
        parser.add_argument(
            '--include-demo-users',
            action='store_true',
            help='Also import known demo/seed accounts (owner@boss.com, staff@boss.com, player@boss.com).',
        )
        parser.add_argument(
            '--skip-bookings',
            action='store_true',
            help='Import structural arena data/config only without importing bookings.',
        )

    def _backup_sources_and_db(self, backup_dir: Path, pb_path: Path, users_path: Path):
        ts = timezone.now().strftime('%Y%m%dT%H%M%SZ')
        target = backup_dir / f'migration_backup_{ts}'
        target.mkdir(parents=True, exist_ok=True)

        if pb_path.exists():
            shutil.copy2(pb_path, target / pb_path.name)
        if users_path.exists():
            shutil.copy2(users_path, target / users_path.name)

        snapshot = {
            'capturedAt': timezone.now().isoformat(),
            'counts': {
                'users': User.objects.count(),
                'courts': Court.objects.count(),
                'bookings': Booking.objects.count(),
                'holds': SlotHold.objects.count(),
                'blocks': ScheduleBlock.objects.count(),
                'schedules': ArenaSchedule.objects.count(),
                'discounts': DiscountCode.objects.count(),
                'galleryItems': GalleryItem.objects.count(),
                'auditLogs': AuditLog.objects.count(),
            },
            'courts': list(Court.objects.values('id', 'external_id', 'name', 'price_per_hour', 'is_active')),
            'bookings': list(
                Booking.objects.values(
                    'id', 'external_id', 'court_id', 'start_at', 'end_at', 'total_price', 'status', 'payment_status'
                )
            ),
        }
        (target / 'django_pre_import_snapshot.json').write_text(
            json.dumps(snapshot, default=str, indent=2),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(f'Pre-migration backup written to: {target}'))

    def handle(self, *args, **options):
        pb_path = Path(options['pickleball_json'])
        users_path = Path(options['users_json'])
        dry_run = options['dry_run']
        include_demo_users = options['include_demo_users']
        skip_bookings = options['skip_bookings']

        if not pb_path.exists() and not users_path.exists():
            raise CommandError('Neither pickleball JSON nor users JSON file was found.')

        if options['backup_dir'] and not dry_run:
            self._backup_sources_and_db(Path(options['backup_dir']), pb_path, users_path)

        pb_data = json.loads(pb_path.read_text(encoding='utf-8')) if pb_path.exists() else {}
        users_data = json.loads(users_path.read_text(encoding='utf-8')) if users_path.exists() else []

        stats = {
            'users': {'created': 0, 'updated': 0, 'skipped_demo': 0},
            'courts': {'created': 0, 'updated': 0},
            'pricing': {'updated': 0},
            'schedules': {'created': 0, 'updated': 0},
            'discounts': {'created': 0, 'updated': 0},
            'gallery': {'created': 0, 'updated': 0},
            'bookings': {'created': 0, 'existing': 0, 'skipped': 0},
            'holds': {'created': 0, 'existing': 0, 'skipped_expired': 0},
            'blocks': {'created': 0, 'existing': 0},
            'auditLogs': {'created': 0, 'existing': 0},
        }

        with transaction.atomic():
            self._import_users(users_data, include_demo_users, stats)
            court_map = self._import_courts(pb_data.get('courts', []), stats)
            self._import_pricing(pb_data.get('pricingConfig'), stats)
            self._import_schedules(pb_data.get('schedules', []), stats)
            self._import_discounts(pb_data.get('discounts', []), stats)
            self._import_gallery(pb_data.get('galleryItems', []), stats)
            if not skip_bookings:
                self._import_bookings(pb_data.get('bookings', []), court_map, stats)
            self._import_holds(pb_data.get('holds', []), court_map, stats)
            self._import_blocks(pb_data.get('blocks', []), court_map, stats)
            self._import_audit_logs(pb_data.get('auditLogs', []), stats)

            if dry_run:
                transaction.set_rollback(True)

        prefix = '[DRY-RUN (rolled back)] ' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(f'{prefix}Import summary: {json.dumps(stats)}'))

    def _import_users(self, users_data: list, include_demo_users: bool, stats: dict):
        for raw in users_data:
            ext_id = str(raw.get('id') or '').strip()
            email = str(raw.get('email') or '').strip().lower()
            is_demo = ext_id in DEMO_USER_IDS or email in DEMO_USER_EMAILS
            if is_demo and not include_demo_users:
                stats['users']['skipped_demo'] += 1
                continue

            phone = normalize_phone_digits(raw.get('phone')) or None
            full_name = str(raw.get('name') or '').strip()
            name_parts = full_name.split(' ', 1) if full_name else ['']
            first_name = name_parts[0][:150]
            last_name = name_parts[1][:150] if len(name_parts) > 1 else ''
            role = str(raw.get('role') or 'CUSTOMER').upper()
            if role not in ('OWNER', 'EMPLOYEE', 'CUSTOMER'):
                role = 'CUSTOMER'

            existing = None
            if ext_id:
                existing = User.objects.filter(external_id=ext_id).first()
            if not existing and email:
                existing = User.objects.filter(email__iexact=email).first()
            if not existing and phone:
                existing = User.objects.filter(phone=phone).first()

            if existing:
                changed = False
                if ext_id and not existing.external_id:
                    existing.external_id = ext_id
                    changed = True
                if email and not existing.email:
                    existing.email = email
                    changed = True
                if phone and not existing.phone:
                    existing.phone = phone
                    changed = True
                if raw.get('avatar') and not existing.profile_photo:
                    existing.profile_photo = raw['avatar']
                    changed = True
                if changed:
                    existing.save()
                    stats['users']['updated'] += 1
            else:
                base_username = (
                    re.sub(r'[^a-zA-Z0-9._-]', '', email.split('@')[0])[:24]
                    if email
                    else (ext_id or f'player_{normalize_phone_digits(phone)}')
                ) or 'player'
                username = base_username
                idx = 1
                while User.objects.filter(username=username).exists():
                    username = f'{base_username}_{idx}'
                    idx += 1

                user = User(
                    external_id=ext_id or None,
                    username=username,
                    email=email,
                    phone=phone,
                    role=role,
                    first_name=first_name,
                    last_name=last_name,
                    profile_photo=raw.get('avatar') or None,
                    is_staff=role in ('OWNER', 'EMPLOYEE'),
                    is_superuser=(role == 'OWNER'),
                )
                pw_raw = str(raw.get('passwordHash') or '')
                if not pw_raw or pw_raw.startswith('google_oauth_'):
                    user.set_unusable_password()
                elif pw_raw.startswith(('pbkdf2_sha256$', 'argon2$', 'bcrypt_sha256$')):
                    user.password = pw_raw
                else:
                    user.set_password(pw_raw)
                created_at = _parse_dt(raw.get('createdAt'))
                if created_at:
                    user.date_joined = created_at
                user.save()
                stats['users']['created'] += 1

    def _import_courts(self, courts_data: list, stats: dict) -> dict[str, Court]:
        court_map: dict[str, Court] = {}
        for c in courts_data:
            ext_id = str(c.get('id') or '').strip() or None
            name = str(c.get('name') or '').strip()
            existing = None
            if ext_id:
                existing = Court.objects.filter(external_id=ext_id).first()
            if not existing and name:
                existing = Court.objects.filter(name=name).first()

            defaults = {
                'external_id': ext_id,
                'court_number': int(c.get('courtNumber') or 1),
                'name': name,
                'surface_type': str(c.get('surfaceType') or 'Pickleball Court'),
                'is_indoor': bool(c.get('isIndoor', True)),
                'price_per_hour': Decimal(str(c.get('basePricePerHour') or 400)),
                'is_active': bool(c.get('isActive', True)),
            }

            if existing:
                if ext_id and not existing.external_id:
                    existing.external_id = ext_id
                existing.court_number = defaults['court_number']
                existing.surface_type = defaults['surface_type']
                existing.is_indoor = defaults['is_indoor']
                existing.price_per_hour = defaults['price_per_hour']
                existing.is_active = defaults['is_active']
                existing.save()
                stats['courts']['updated'] += 1
                obj = existing
            else:
                obj = Court.objects.create(**defaults)
                stats['courts']['created'] += 1

            if ext_id:
                court_map[ext_id] = obj
            court_map[obj.public_id] = obj
        return court_map

    def _import_pricing(self, pricing_raw: dict | None, stats: dict):
        if not pricing_raw:
            return
        cfg, _ = PricingConfig.objects.update_or_create(
            key='DEFAULT',
            defaults={
                'base_price_per_hour': Decimal(str(pricing_raw.get('basePricePerHour') or 400)),
                'peak_surge_price_per_hour': Decimal(str(pricing_raw.get('peakSurgePricePerHour') or 550)),
                'peak_hours': list(pricing_raw.get('peakHours') or ['18:00', '19:00', '20:00', '21:00', '22:00']),
                'is_peak_surge_active': bool(pricing_raw.get('isPeakSurgeActive', True)),
                'updated_by_identifier': str(pricing_raw.get('updatedBy') or ''),
            },
        )
        updated_at = _parse_dt(pricing_raw.get('updatedAt'))
        if updated_at:
            PricingConfig.objects.filter(id=cfg.id).update(updated_at=updated_at)
        stats['pricing']['updated'] += 1

    def _import_schedules(self, schedules_data: list, stats: dict):
        for s in schedules_data:
            date_key = str(s.get('date') or '').strip()
            if not date_key:
                continue
            _, created = ArenaSchedule.objects.update_or_create(
                date=date_key,
                defaults={
                    'is_closed': bool(s.get('isClosed', False)),
                    'closure_reason': s.get('closureReason') or None,
                    'open_time': _parse_hhmm(s.get('openTime'), dt_time(6, 0)),
                    'close_time': _parse_hhmm(s.get('closeTime'), dt_time(23, 0)),
                    'updated_by_identifier': str(s.get('updatedBy') or ''),
                },
            )
            stats['schedules']['created' if created else 'updated'] += 1

    def _import_discounts(self, discounts_data: list, stats: dict):
        for d in discounts_data:
            code = str(d.get('code') or '').strip().upper()
            if not code:
                continue
            ext_id = str(d.get('id') or '').strip() or None
            valid_to = _parse_dt(d.get('validTo')) or (timezone.now() + timezone.timedelta(days=365))
            _, created = DiscountCode.objects.update_or_create(
                code=code,
                defaults={
                    'external_id': ext_id,
                    'discount_type': str(d.get('type') or 'FLAT').upper(),
                    'value': Decimal(str(d.get('value') or 0)),
                    'min_booking_amount': Decimal(str(d.get('minBookingAmount') or 0)),
                    'max_usage': d.get('maxUsage'),
                    'usage_count': int(d.get('usageCount') or 0),
                    'valid_to': valid_to,
                    'is_active': bool(d.get('isActive', True)),
                },
            )
            stats['discounts']['created' if created else 'updated'] += 1

    def _import_gallery(self, gallery_data: list, stats: dict):
        for idx, g in enumerate(gallery_data, start=1):
            ext_id = str(g.get('id') or '').strip() or None
            title = str(g.get('title') or '').strip()
            existing = GalleryItem.objects.filter(external_id=ext_id).first() if ext_id else None
            if not existing and title:
                existing = GalleryItem.objects.filter(title=title).first()

            fields = {
                'external_id': ext_id,
                'title': title,
                'item_type': str(g.get('type') or 'image'),
                'category': str(g.get('category') or 'matchplay'),
                'tag': str(g.get('tag') or ''),
                'media_url': g.get('src') or None,
                'video_url': g.get('videoSrc') or None,
                'aspect': str(g.get('aspect') or 'tall'),
                'caption': str(g.get('caption') or ''),
                'duration': str(g.get('duration') or ''),
                'order': int(g.get('order') or idx),
                'is_active': bool(g.get('isActive', True)),
            }
            if existing:
                for k, v in fields.items():
                    setattr(existing, k, v)
                existing.save()
                stats['gallery']['updated'] += 1
            else:
                obj = GalleryItem.objects.create(**fields)
                created_at = _parse_dt(g.get('createdAt'))
                if created_at:
                    GalleryItem.objects.filter(id=obj.id).update(created_at=created_at)
                stats['gallery']['created'] += 1

    def _import_bookings(self, bookings_data: list, court_map: dict[str, Court], stats: dict):
        for b in bookings_data:
            ext_id = str(b.get('id') or '').strip()
            if ext_id and Booking.objects.filter(external_id=ext_id).exists():
                stats['bookings']['existing'] += 1
                continue

            court_id = str(b.get('courtId') or '').strip()
            court = court_map.get(court_id) or Court.objects.filter(external_id=court_id).first()
            if not court:
                stats['bookings']['skipped'] += 1
                continue

            start_at = _parse_dt(b.get('startTime'))
            end_at = _parse_dt(b.get('endTime'))
            if not start_at or not end_at:
                stats['bookings']['skipped'] += 1
                continue

            ist_start = timezone.localtime(start_at, VENUE_TZ)
            ist_end = timezone.localtime(end_at, VENUE_TZ)
            payment_status = str(b.get('paymentStatus') or 'PAY_AT_VENUE').upper()
            payment_method = (
                'CASH' if payment_status == 'CASH_COUNTER'
                else 'UPI' if payment_status == 'UPI_COUNTER'
                else 'RAZORPAY' if payment_status in ('PAID_ONLINE', 'PAID')
                else 'PAY_AT_VENUE'
            )

            cust_email = (str(b.get('customerEmail')).strip().lower() if b.get('customerEmail') else None)
            linked_user = User.objects.filter(email__iexact=cust_email).first() if cust_email else None
            staff_id_raw = str(b.get('createdByStaffId') or '').strip()
            staff_user = User.objects.filter(external_id=staff_id_raw).first() if staff_id_raw else None

            booking = Booking.objects.create(
                external_id=ext_id or None,
                court=court,
                user=linked_user,
                customer_name=str(b.get('customerName') or 'Player').strip(),
                customer_phone=str(b.get('customerPhone') or '').strip(),
                customer_email=cust_email,
                start_at=start_at,
                end_at=end_at,
                booking_date=ist_start.date(),
                start_time=ist_start.time().replace(tzinfo=None, microsecond=0),
                end_time=ist_end.time().replace(tzinfo=None, microsecond=0),
                source=str(b.get('source') or 'ONLINE').upper(),
                status=str(b.get('status') or 'CONFIRMED').upper(),
                payment_status=payment_status,
                payment_method=payment_method,
                total_price=Decimal(str(b.get('totalPrice') or 0)),
                discount_code=str(b.get('discountCode') or ''),
                discount_amount=Decimal(str(b.get('discountAmount') or 0)),
                equipment_addons=b.get('equipmentAddons') or {},
                notes=str(b.get('notes') or ''),
                cancellation_reason=str(b.get('cancellationReason') or ''),
                cancelled_at=_parse_dt(b.get('cancelledAt')),
                created_by_staff=staff_user,
                staff_identifier=staff_id_raw,
            )
            created_at = _parse_dt(b.get('createdAt'))
            updated_at = _parse_dt(b.get('updatedAt'))
            if created_at or updated_at:
                Booking.objects.filter(id=booking.id).update(
                    **({'created_at': created_at} if created_at else {}),
                    **({'updated_at': updated_at} if updated_at else {}),
                )
            stats['bookings']['created'] += 1

    def _import_holds(self, holds_data: list, court_map: dict[str, Court], stats: dict):
        now = timezone.now()
        for h in holds_data:
            ext_id = str(h.get('id') or '').strip()
            expires_at = _parse_dt(h.get('expiresAt'))
            if not expires_at or expires_at <= now:
                stats['holds']['skipped_expired'] += 1
                continue
            if ext_id and SlotHold.objects.filter(external_id=ext_id).exists():
                stats['holds']['existing'] += 1
                continue
            court = court_map.get(str(h.get('courtId') or '').strip())
            start_at = _parse_dt(h.get('startTime'))
            end_at = _parse_dt(h.get('endTime'))
            if not court or not start_at or not end_at:
                continue
            hold = SlotHold.objects.create(
                external_id=ext_id or None,
                court=court,
                start_at=start_at,
                end_at=end_at,
                session_id=str(h.get('sessionId') or ''),
                expires_at=expires_at,
            )
            created_at = _parse_dt(h.get('createdAt'))
            if created_at:
                SlotHold.objects.filter(id=hold.id).update(created_at=created_at)
            stats['holds']['created'] += 1

    def _import_blocks(self, blocks_data: list, court_map: dict[str, Court], stats: dict):
        for bl in blocks_data:
            ext_id = str(bl.get('id') or '').strip()
            if ext_id and ScheduleBlock.objects.filter(external_id=ext_id).exists():
                stats['blocks']['existing'] += 1
                continue
            court = court_map.get(str(bl.get('courtId') or '').strip())
            start_at = _parse_dt(bl.get('startTime'))
            end_at = _parse_dt(bl.get('endTime'))
            if not court or not start_at or not end_at:
                continue
            ScheduleBlock.objects.create(
                external_id=ext_id or None,
                court=court,
                start_at=start_at,
                end_at=end_at,
                reason=str(bl.get('reason') or 'MAINTENANCE').upper(),
                notes=str(bl.get('notes') or ''),
                created_by_identifier=str(bl.get('createdById') or ''),
            )
            stats['blocks']['created'] += 1

    def _import_audit_logs(self, logs_data: list, stats: dict):
        for entry in logs_data:
            ext_id = str(entry.get('id') or '').strip()
            if ext_id and AuditLog.objects.filter(external_id=ext_id).exists():
                stats['auditLogs']['existing'] += 1
                continue
            actor_id_raw = str(entry.get('actorId') or 'system')
            actor_user = User.objects.filter(external_id=actor_id_raw).first()
            AuditLog.objects.create(
                external_id=ext_id or None,
                actor=actor_user,
                actor_id_raw=actor_id_raw,
                actor_role=str(entry.get('actorRole') or 'SYSTEM'),
                action=str(entry.get('action') or 'UNKNOWN'),
                entity_id=str(entry.get('entityId') or ''),
                details=entry.get('details') or {},
                created_at=_parse_dt(entry.get('createdAt')) or timezone.now(),
            )
            stats['auditLogs']['created'] += 1

