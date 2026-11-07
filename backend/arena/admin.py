from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Court, Booking, GalleryItem


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'phone', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Arena Role & Profile', {'fields': ('role', 'phone', 'profile_photo')}),
    )


@admin.register(Court)
class CourtAdmin(admin.ModelAdmin):
    list_display = ('name', 'sport_type', 'price_per_hour', 'is_active', 'lighting_lux', 'surface_type', 'max_players')
    list_editable = ('price_per_hour', 'is_active')
    search_fields = ('name',)
    list_filter = ('is_active', 'sport_type')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'court',
        'booking_date',
        'start_time',
        'end_time',
        'customer_name',
        'customer_phone',
        'total_price',
        'payment_status',
        'payment_method',
        'status',
    )
    list_filter = ('booking_date', 'court', 'payment_status', 'status', 'payment_method')
    search_fields = ('customer_name', 'customer_phone', 'customer_email', 'id')
    date_hierarchy = 'booking_date'
    list_editable = ('payment_status', 'status')


@admin.register(GalleryItem)
class GalleryItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'item_type', 'category', 'aspect', 'is_active', 'order')
    list_editable = ('is_active', 'order')
    list_filter = ('item_type', 'category', 'is_active')
    search_fields = ('title', 'caption')
