import base64
from django.core.files.base import ContentFile
from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .auth import (
    IsAuthenticatedActor,
    IsOwnerActor,
    IsStaffActor,
    resolve_actor,
)
from .models import (
    ArenaSchedule,
    Booking,
    Court,
    GalleryItem,
    PricingConfig,
    ScheduleBlock,
    User,
    normalize_phone_digits,
)
from .serializers import BookingSerializer, CourtSerializer, GalleryItemSerializer, UserSerializer
from .tasks import send_booking_confirmation


def _domain_error_response(exc: services.DomainError) -> Response:
    return Response({'success': False, 'error': exc.message}, status=exc.status_code)


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        strict = str(request.query_params.get('strict', '')).lower() in ('1', 'true', 'yes')
        payload, code = services.get_health_status(strict=strict)
        return Response(payload, status=code)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier') or request.data.get('email') or request.data.get('phone') or request.data.get('username')
        password = request.data.get('password')
        try:
            result = services.authenticate_with_credentials(identifier, password)
            return Response({
                **result,
                'message': f"Welcome, {result['user']['name']}! Assigned role: {result['role']}",
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        actor = resolve_actor(request)
        if not actor.service_verified:
            return Response(
                {'success': False, 'error': 'Trusted service authentication required.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        email = request.data.get('email')
        name = request.data.get('name') or ''
        avatar = request.data.get('avatar')
        google_id = request.data.get('googleId')
        try:
            result = services.find_or_create_google_user(email=email, name=name, avatar=avatar, google_id=google_id)
            return Response(result)
        except services.DomainError as exc:
            return _domain_error_response(exc)


class MeView(APIView):
    permission_classes = [IsAuthenticatedActor]

    def get(self, request):
        actor = resolve_actor(request)
        db_user = actor.user
        if not db_user and actor.email:
            db_user = User.objects.filter(email__iexact=actor.email).first()
        if db_user:
            if not db_user.is_active:
                return Response({'success': False, 'authenticated': False, 'user': None}, status=status.HTTP_401_UNAUTHORIZED)
            user_data = services.serialize_user(db_user)
        else:
            user_data = {
                'id': actor.actor_id,
                'email': actor.email,
                'phone': actor.phone,
                'name': actor.name,
                'role': actor.role,
            }
        return Response({
            'success': True,
            'authenticated': True,
            'user': user_data,
            'role': user_data['role'],
        })


class AvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        actor = resolve_actor(request)
        date_str = request.query_params.get('date') or services.get_venue_today_date()
        court_id = request.query_params.get('courtId') or None
        try:
            data = services.get_availability(
                date_str=date_str,
                court_id=court_id,
                viewer_is_staff=actor.is_staff_member(),
            )
            return Response(data, headers={'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class HoldView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        court_id = request.data.get('courtId')
        start_time = request.data.get('startTime')
        end_time = request.data.get('endTime')
        session_id = request.data.get('sessionId')
        if not all([court_id, start_time, end_time, session_id]):
            return Response(
                {'success': False, 'error': 'Missing courtId, startTime, endTime, or sessionId'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            hold = services.place_hold(court_id, start_time, end_time, session_id)
            return Response({
                'success': True,
                'hold': hold,
                'message': 'Slot held for 10 minutes. Complete confirmation to finalize booking.',
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)

    def delete(self, request):
        session_id = request.data.get('sessionId') or request.query_params.get('sessionId')
        hold_id = request.data.get('holdId') or request.query_params.get('holdId')
        try:
            released = services.release_hold(session_id, hold_id)
            return Response({'success': True, 'releasedCount': released})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class BookCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        actor = resolve_actor(request)
        try:
            booking = services.create_booking(request.data, actor)
            if booking and booking.get('id'):
                # Enqueue Celery notification task best-effort without blocking booking confirmation
                try:
                    raw_id = str(booking['id'])
                    db_booking = services.find_booking(raw_id)
                    if db_booking:
                        send_booking_confirmation.delay(db_booking.id)
                except Exception:
                    pass
            return Response({
                'success': True,
                'booking': booking,
                'message': 'Booking confirmed! Slot reserved cleanly.',
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)


class BookingsCollectionView(APIView):
    permission_classes = [IsAuthenticatedActor]

    def get(self, request):
        actor = resolve_actor(request)
        phone = request.query_params.get('phone') or None
        date_filter = request.query_params.get('date') or None
        try:
            bookings = services.list_bookings_for_actor(actor=actor, phone=phone, date_filter=date_filter)
            return Response({'success': True, 'bookings': bookings})
        except services.DomainError as exc:
            return _domain_error_response(exc)

    def patch(self, request):
        actor = resolve_actor(request)
        booking_id = request.data.get('bookingId')
        payment_status = request.data.get('paymentStatus')
        if not booking_id or not payment_status:
            return Response(
                {'success': False, 'error': 'bookingId and paymentStatus are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            updated = services.update_booking_payment_status(booking_id, payment_status, actor)
            return Response({'success': True, 'booking': updated, 'message': 'Payment status updated.'})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class VerifyPaymentView(APIView):
    permission_classes = [IsStaffActor]

    def post(self, request):
        actor = resolve_actor(request)
        booking_id = request.data.get('bookingId')
        action = request.data.get('action')
        reason = request.data.get('rejectionReason') or request.data.get('reason') or ''
        if not booking_id or not action:
            return Response(
                {'success': False, 'error': 'bookingId and action (APPROVE or REJECT) are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            booking = services.verify_booking_payment(booking_id, action, actor, reason)
            return Response({
                'success': True,
                'booking': booking,
                'message': f"Booking payment {str(action).lower()}ed successfully.",
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)


class BookingCancelView(APIView):
    permission_classes = [IsAuthenticatedActor]

    def post(self, request):
        actor = resolve_actor(request)
        booking_id = request.data.get('bookingId')
        reason = request.data.get('reason') or ''
        if not booking_id:
            return Response({'success': False, 'error': 'bookingId is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            booking = services.cancel_booking(booking_id, reason, actor)
            return Response({
                'success': True,
                'booking': booking,
                'refundable': False,
                'message': (
                    'Booking cancelled. If you paid online, please contact venue management regarding refund review.'
                    if booking.get('paymentStatus') in ('PAID_ONLINE', 'PAID')
                    else 'Booking cancelled. No online refund is due.'
                ),
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)


class CourtsCollectionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        actor = resolve_actor(request)
        include_inactive = request.query_params.get('all') == 'true' or actor.is_staff_member()
        courts = services.list_courts(include_inactive=include_inactive)
        return Response({'success': True, 'courts': courts})

    def post(self, request):
        actor = resolve_actor(request)
        if not actor.is_authenticated:
            return Response({'success': False, 'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            court = services.create_court(request.data, actor)
            return Response({
                'success': True,
                'message': f"Court \"{court['name']}\" added successfully!",
                'court': court,
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)

    def patch(self, request):
        actor = resolve_actor(request)
        if not actor.is_authenticated:
            return Response({'success': False, 'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        court_id = request.data.get('courtId')
        updates = {k: v for k, v in request.data.items() if k != 'courtId'}
        try:
            updated = services.update_court(court_id, updates, actor)
            return Response({
                'success': True,
                'message': f"Court \"{updated['name']}\" updated successfully!",
                'court': updated,
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)

    def delete(self, request):
        actor = resolve_actor(request)
        if not actor.is_authenticated:
            return Response({'success': False, 'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        court_id = request.query_params.get('courtId') or request.data.get('courtId')
        try:
            services.delete_court(court_id, actor)
            return Response({'success': True, 'message': f"Court {court_id} removed successfully."})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class AdminPricingView(APIView):
    permission_classes = [IsOwnerActor]

    def get(self, request):
        cfg = PricingConfig.get_current()
        return Response({'success': True, 'pricingConfig': services.serialize_pricing(cfg)})

    def post(self, request):
        actor = resolve_actor(request)
        try:
            updated = services.update_pricing_config(request.data, actor)
            return Response({'success': True, 'pricingConfig': updated, 'message': 'Pricing updated cleanly.'})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class AdminBlocksView(APIView):
    permission_classes = [IsStaffActor]

    def get(self, request):
        blocks = ScheduleBlock.objects.select_related('court').all().order_by('-start_at')
        return Response({'success': True, 'blocks': [services.serialize_block(b) for b in blocks]})

    def post(self, request):
        actor = resolve_actor(request)
        court_id = request.data.get('courtId')
        start_time = request.data.get('startTime')
        end_time = request.data.get('endTime')
        reason = request.data.get('reason')
        notes = request.data.get('notes') or ''
        if not all([court_id, start_time, end_time, reason]):
            return Response(
                {'success': False, 'error': 'Missing courtId, startTime, endTime, or reason'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            block = services.create_schedule_block(court_id, start_time, end_time, reason, notes, actor)
            return Response({'success': True, 'block': block, 'message': f"Court {court_id} blocked for {reason}."})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class AdminScheduleView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsStaffActor()]

    def get(self, request):
        date_param = request.query_params.get('date')
        if date_param:
            return Response({'success': True, 'schedule': services.get_resolved_schedule(date_param)})
        return Response({'success': True, 'schedules': services.list_all_schedules()})

    def post(self, request):
        actor = resolve_actor(request)
        try:
            sched = services.upsert_schedule(request.data, actor)
            msg = (
                f"Arena marked CLOSED for {sched['date']}."
                if sched['isClosed']
                else f"Operating hours updated for {sched['date']}."
            )
            return Response({'success': True, 'schedule': sched, 'message': msg})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class AdminReportsView(APIView):
    permission_classes = [IsOwnerActor]

    def get(self, request):
        report = services.get_financial_report()
        return Response(report, headers={'Cache-Control': 'no-store, no-cache, must-revalidate'})


class ArenaReportView(APIView):
    permission_classes = [IsStaffActor]

    def get(self, request):
        today = timezone.localdate()
        valid_today = Booking.objects.filter(booking_date=today).exclude(status='CANCELLED').exclude(payment_status='REFUNDED')
        revenue_today = valid_today.filter(
            payment_status__in=['PAID_ONLINE', 'CASH_COUNTER', 'UPI_COUNTER', 'PAID']
        ).aggregate(total=Sum('total_price'))['total'] or 0
        total_bookings = valid_today.count()
        courts_count = Court.objects.filter(is_active=True).count()
        return Response({
            'date': str(today),
            'today_revenue': float(revenue_today),
            'today_bookings_count': total_bookings,
            'active_courts': courts_count,
        })


class GalleryCollectionView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsStaffActor()]

    def get(self, request):
        actor = resolve_actor(request)
        items = services.list_gallery_items(include_inactive=actor.is_staff_member(), request=request)
        return Response({'success': True, 'items': items})

    def post(self, request):
        actor = resolve_actor(request)
        try:
            item = services.create_gallery_item(request.data, actor, request=request)
            return Response({'success': True, 'message': f"Gallery item \"{item['title']}\" added successfully!", 'item': item})
        except services.DomainError as exc:
            return _domain_error_response(exc)

    def patch(self, request):
        actor = resolve_actor(request)
        item_id = request.data.get('id')
        if not item_id:
            return Response({'success': False, 'error': 'id is required'}, status=status.HTTP_400_BAD_REQUEST)
        updates = {k: v for k, v in request.data.items() if k != 'id'}
        try:
            item = services.update_gallery_item(item_id, updates, actor, request=request)
            return Response({'success': True, 'message': f"Gallery item \"{item['title']}\" updated successfully!", 'item': item})
        except services.DomainError as exc:
            return _domain_error_response(exc)

    def delete(self, request):
        actor = resolve_actor(request)
        item_id = request.query_params.get('id') or request.data.get('id')
        if not item_id:
            return Response({'success': False, 'error': 'id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            services.delete_gallery_item(item_id, actor)
            return Response({'success': True, 'message': 'Gallery item removed successfully.'})
        except services.DomainError as exc:
            return _domain_error_response(exc)


class UploadView(APIView):
    permission_classes = [IsStaffActor]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if file_obj is None and isinstance(request.data, dict) and request.data.get('dataBase64'):
            filename = str(request.data.get('filename') or 'upload.jpg')
            try:
                raw_bytes = base64.b64decode(request.data['dataBase64'], validate=True)
            except Exception:
                return Response({'success': False, 'error': 'Invalid upload encoding.'}, status=status.HTTP_400_BAD_REQUEST)
            file_obj = ContentFile(raw_bytes, name=filename)

        if file_obj is None:
            return Response({'success': False, 'error': 'No media file received'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            url = services.save_uploaded_media(file_obj, request=request)
            lower_name = str(file_obj.name or '').lower()
            media_type = 'video' if lower_name.endswith(('.mp4', '.webm', '.mov')) else 'image'
            return Response({
                'success': True,
                'url': url,
                'fileName': url.rsplit('/', 1)[-1],
                'type': media_type,
                'message': 'Media uploaded cleanly.',
            })
        except services.DomainError as exc:
            return _domain_error_response(exc)


# Legacy DRF ViewSets kept secure & non-leaking on /api/courts/, /api/bookings/, /api/gallery/
class IsOwnerOrStaffWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return resolve_actor(request).is_staff_member()


class CourtViewSet(viewsets.ModelViewSet):
    queryset = Court.objects.all()
    serializer_class = CourtSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        if self.request.method in ('POST', 'DELETE'):
            return [IsOwnerActor()]
        return [IsStaffActor()]

    def get_queryset(self):
        actor = resolve_actor(self.request)
        if actor.is_staff_member():
            return Court.objects.all()
        return Court.objects.filter(is_active=True)

    def partial_update(self, request, *args, **kwargs):
        actor = resolve_actor(request)
        if not actor.is_owner():
            forbidden = [k for k in request.data.keys() if k not in ('is_active', 'isActive')]
            if forbidden:
                return Response({'success': False, 'error': 'Only owners can modify court config or pricing.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        actor = resolve_actor(request)
        if not actor.is_owner():
            return Response({'success': False, 'error': 'Only owners can replace court configuration.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsStaffActor()]
        return [IsAuthenticatedActor()]

    def get_queryset(self):
        actor = resolve_actor(self.request)
        if not actor.is_authenticated:
            return Booking.objects.none()
        qs = Booking.objects.select_related('court', 'user').all()
        if actor.is_staff_member():
            date_param = self.request.query_params.get('date')
            return qs.filter(booking_date=date_param) if date_param else qs
        actor_phone = normalize_phone_digits(actor.phone)
        actor_email = (actor.email or '').strip().lower()
        matching_ids = []
        for b in qs:
            if (actor.user and b.user_id == actor.user.id) or (
                actor_phone and normalize_phone_digits(b.customer_phone) == actor_phone
            ) or (actor_email and (b.customer_email or '').strip().lower() == actor_email):
                matching_ids.append(b.id)
        return qs.filter(id__in=matching_ids)

    def create(self, request, *args, **kwargs):
        actor = resolve_actor(request)
        payload = {
            'courtId': request.data.get('courtId') or request.data.get('court'),
            'startTime': request.data.get('startTime') or request.data.get('start_at'),
            'endTime': request.data.get('endTime') or request.data.get('end_at'),
            'customerName': request.data.get('customerName') or request.data.get('customer_name'),
            'customerPhone': request.data.get('customerPhone') or request.data.get('customer_phone'),
            'customerEmail': request.data.get('customerEmail') or request.data.get('customer_email'),
            'source': request.data.get('source') or 'ONLINE',
            'paymentStatus': request.data.get('paymentStatus') or request.data.get('payment_status') or 'PAY_AT_VENUE',
            'notes': request.data.get('notes') or '',
            'sessionId': request.data.get('sessionId'),
        }
        try:
            created = services.create_booking(payload, actor)
            return Response(created, status=status.HTTP_201_CREATED)
        except services.DomainError as exc:
            return _domain_error_response(exc)


class GalleryItemViewSet(viewsets.ModelViewSet):
    queryset = GalleryItem.objects.all()
    serializer_class = GalleryItemSerializer
    permission_classes = [IsOwnerOrStaffWrite]

    def get_queryset(self):
        actor = resolve_actor(self.request)
        if actor.is_staff_member():
            return GalleryItem.objects.all()
        return GalleryItem.objects.filter(is_active=True)
