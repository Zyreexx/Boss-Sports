from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
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
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'external_id', 'email', 'phone', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username', 'external_id', 'email', 'phone', 'first_name', 'last_name')
    fieldsets = UserAdmin.fieldsets + (
        ('Arena Role & Profile', {'fields': ('external_id', 'role', 'phone', 'profile_photo', 'google_id')}),
    )


@admin.register(Court)
class CourtAdmin(admin.ModelAdmin):
    list_display = ('court_number', 'name', 'external_id', 'is_indoor', 'price_per_hour', 'is_active', 'surface_type')
    list_editable = ('price_per_hour', 'is_active')
    search_fields = ('name', 'external_id')
    list_filter = ('is_active', 'is_indoor', 'sport_type')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'public_id',
        'court',
        'booking_date',
        'start_time',
        'end_time',
        'customer_name',
        'customer_phone',
        'source',
        'total_price',
        'payment_status',
        'status',
    )
    list_filter = ('booking_date', 'court', 'source', 'payment_status', 'status')
    search_fields = ('external_id', 'customer_name', 'customer_phone', 'customer_email', 'id')
    date_hierarchy = 'booking_date'
    list_editable = ('payment_status', 'status')


@admin.register(SlotHold)
class SlotHoldAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'court', 'start_at', 'end_at', 'session_id', 'expires_at')
    list_filter = ('court',)
    search_fields = ('external_id', 'session_id')


@admin.register(ScheduleBlock)
class ScheduleBlockAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'court', 'reason', 'start_at', 'end_at', 'created_by_identifier')
    list_filter = ('court', 'reason')
    search_fields = ('external_id', 'notes')


@admin.register(PricingConfig)
class PricingConfigAdmin(admin.ModelAdmin):
    list_display = ('key', 'base_price_per_hour', 'peak_surge_price_per_hour', 'is_peak_surge_active', 'updated_at')


@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'value', 'min_booking_amount', 'usage_count', 'max_usage', 'valid_to', 'is_active')
    list_filter = ('discount_type', 'is_active')
    search_fields = ('code', 'external_id')


@admin.register(GalleryItem)
class GalleryItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'external_id', 'item_type', 'category', 'aspect', 'is_active', 'order')
    list_editable = ('is_active', 'order')
    list_filter = ('item_type', 'category', 'is_active')
    search_fields = ('title', 'caption', 'external_id')


@admin.register(ArenaSchedule)
class ArenaScheduleAdmin(admin.ModelAdmin):
    list_display = ('date', 'is_closed', 'closure_reason', 'open_time', 'close_time', 'updated_at')
    list_editable = ('is_closed', 'open_time', 'close_time')
    list_filter = ('is_closed',)
    search_fields = ('date', 'closure_reason')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor_role', 'actor_id_raw', 'action', 'entity_id')
    list_filter = ('actor_role', 'action')
    search_fields = ('external_id', 'actor_id_raw', 'entity_id', 'action')
