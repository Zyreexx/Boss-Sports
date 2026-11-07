from django.contrib.auth import authenticate, login, logout
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User, Court, Booking, GalleryItem
from .serializers import CourtSerializer, BookingSerializer, GalleryItemSerializer, UserSerializer
from .tasks import send_booking_confirmation


class IsOwnerOrStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff_member())


class CourtViewSet(viewsets.ModelViewSet):
    queryset = Court.objects.all()
    serializer_class = CourtSerializer
    permission_classes = [IsOwnerOrStaff]

    def get_queryset(self):
        # Public gets only active courts, owner/staff gets all
        if self.request.user and self.request.user.is_authenticated and self.request.user.is_staff_member():
            return Court.objects.all()
        return Court.objects.filter(is_active=True)


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            # Anonymous can query slot availability by date
            date_param = self.request.query_params.get('date')
            if date_param:
                return Booking.objects.filter(booking_date=date_param, status__in=['CONFIRMED', 'PENDING'])
            return Booking.objects.none()

        if user.is_staff_member():
            date_param = self.request.query_params.get('date')
            if date_param:
                return Booking.objects.filter(booking_date=date_param)
            return Booking.objects.all()

        # Regular customer sees only their own bookings
        return Booking.objects.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        data = serializer.validated_data

        # Security: Only staff or owner can mark a booking as PAID directly at desk
        payment_status = data.get('payment_status', 'PENDING')
        if not (user and user.is_staff_member()):
            payment_status = 'PENDING'

        booking = serializer.save(
            user=user,
            payment_status=payment_status,
            status='CONFIRMED'
        )

        # Trigger Celery background task to send confirmation notifications asynchronously
        try:
            send_booking_confirmation.delay(booking.id)
        except Exception as e:
            # Fallback if Redis is temporarily offline in local testing
            pass


class GalleryItemViewSet(viewsets.ModelViewSet):
    queryset = GalleryItem.objects.all()
    serializer_class = GalleryItemSerializer
    permission_classes = [IsOwnerOrStaff]

    def get_queryset(self):
        if self.request.user and self.request.user.is_authenticated and self.request.user.is_staff_member():
            return GalleryItem.objects.all()
        return GalleryItem.objects.filter(is_active=True)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('email') or request.data.get('phone') or request.data.get('username')
        password = request.data.get('password')

        if not identifier or not password:
            return Response({"error": "Identifier and password required"}, status=status.HTTP_400_BAD_REQUEST)

        # Allow login via username, email, or phone
        user = None
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        elif identifier.isdigit():
            user = User.objects.filter(phone=identifier).first()
        if not user:
            user = User.objects.filter(username__iexact=identifier).first()

        if user and user.check_password(password):
            login(request, user)
            redirect_url = "/admin" if user.role == 'OWNER' else "/staff" if user.role == 'EMPLOYEE' else "/profile"
            return Response({
                "success": True,
                "user": UserSerializer(user).data,
                "role": user.role,
                "redirectUrl": redirect_url
            })

        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            "user": UserSerializer(request.user).data,
            "role": request.user.role
        })


class ArenaReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff_member():
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        today_bookings = Booking.objects.filter(booking_date=today, status__in=['CONFIRMED', 'COMPLETED'])
        revenue_today = today_bookings.aggregate(total=Sum('total_price'))['total'] or 0
        total_bookings = today_bookings.count()
        courts_count = Court.objects.filter(is_active=True).count()

        return Response({
            "date": str(today),
            "today_revenue": float(revenue_today),
            "today_bookings_count": total_bookings,
            "active_courts": courts_count,
        })
