from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminBlocksView,
    AdminPricingView,
    AdminReportsView,
    AdminScheduleView,
    ArenaReportView,
    AvailabilityView,
    BookCreateView,
    BookingCancelView,
    BookingsCollectionView,
    BookingViewSet,
    CourtViewSet,
    CourtsCollectionView,
    GalleryCollectionView,
    GalleryItemViewSet,
    GoogleAuthView,
    HealthCheckView,
    HoldView,
    LoginView,
    MeView,
    UploadView,
)

router = DefaultRouter()
router.register(r'courts', CourtViewSet, basename='court')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'gallery', GalleryItemViewSet, basename='gallery')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth_google'),
    path('auth/me/', MeView.as_view(), name='auth_me'),

    path('pickleball/availability/', AvailabilityView.as_view(), name='pickleball_availability'),
    path('pickleball/hold/', HoldView.as_view(), name='pickleball_hold'),
    path('pickleball/book/', BookCreateView.as_view(), name='pickleball_book'),
    path('pickleball/bookings/', BookingsCollectionView.as_view(), name='pickleball_bookings'),
    path('pickleball/cancel/', BookingCancelView.as_view(), name='pickleball_cancel'),
    path('pickleball/courts/', CourtsCollectionView.as_view(), name='pickleball_courts'),

    path('admin/pricing/', AdminPricingView.as_view(), name='admin_pricing'),
    path('admin/blocks/', AdminBlocksView.as_view(), name='admin_blocks'),
    path('admin/schedule/', AdminScheduleView.as_view(), name='admin_schedule'),
    path('admin/reports/', AdminReportsView.as_view(), name='admin_reports'),

    path('gallery-items/', GalleryCollectionView.as_view(), name='gallery_items'),
    path('upload/', UploadView.as_view(), name='upload_media'),

    path('reports/today/', ArenaReportView.as_view(), name='reports_today'),
    path('', include(router.urls)),
]
