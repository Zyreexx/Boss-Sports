from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CourtViewSet, BookingViewSet, GalleryItemViewSet, LoginView, MeView, ArenaReportView

router = DefaultRouter()
router.register(r'courts', CourtViewSet, basename='court')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'gallery', GalleryItemViewSet, basename='gallery')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    path('reports/today/', ArenaReportView.as_view(), name='reports_today'),
    path('', include(router.urls)),
]
