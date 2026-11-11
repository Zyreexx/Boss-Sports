from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

VENUE_TZ = ZoneInfo('Asia/Kolkata')


def normalize_phone_digits(value: str | None) -> str:
    if not value:
        return ''
    digits = ''.join(ch for ch in str(value) if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


class User(AbstractUser):
    ROLE_CHOICES = (
        ('OWNER', 'Owner / Arena Administrator'),
        ('EMPLOYEE', 'Staff / Front Desk Manager'),
        ('CUSTOMER', 'Player / Registered Athlete'),
    )

    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CUSTOMER')
    phone = models.CharField(max_length=20, blank=True, null=True, unique=True)
    profile_photo = models.CharField(max_length=500, blank=True, null=True)
    google_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.phone is not None:
            stripped = str(self.phone).strip()
            self.phone = stripped or None
        if self.email:
            self.email = str(self.email).strip().lower()
        if self.external_id is not None:
            self.external_id = str(self.external_id).strip() or None
        if self.google_id is not None:
            self.google_id = str(self.google_id).strip() or None
        super().save(*args, **kwargs)

    @property
    def public_id(self) -> str:
        return self.external_id or f"usr-{self.id}"

    def is_owner(self) -> bool:
        return self.role == 'OWNER' or self.is_superuser

    def is_staff_member(self) -> bool:
        return self.role in ('OWNER', 'EMPLOYEE') or self.is_staff

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Court(models.Model):
    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    court_number = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=100, unique=True, help_text="e.g. Court 1")
    sport_type = models.CharField(max_length=50, default='pickleball')
    surface_type = models.CharField(max_length=100, default="Pickleball Court")
    is_indoor = models.BooleanField(default=True)
    price_per_hour = models.DecimalField(max_digits=8, decimal_places=2, default=400.00)
    is_active = models.BooleanField(default=True)
    lighting_lux = models.PositiveIntegerField(default=500, help_text="Lighting spec in LUX")
    max_players = models.PositiveIntegerField(default=4)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['court_number', 'name', 'id']

    @property
    def public_id(self) -> str:
        return self.external_id or f"court-{self.id}"

    def __str__(self):
        return f"{self.name} • ₹{self.price_per_hour}/hr"


class Booking(models.Model):
    STATUS_CHOICES = (
        ('HELD', 'Held'),
        ('CONFIRMED', 'Confirmed'),
        ('PENDING', 'Pending Payment / Hold'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('PAID_ONLINE', 'Paid Online'),
        ('CASH_COUNTER', 'Cash at Counter'),
        ('UPI_COUNTER', 'UPI at Counter'),
        ('PAY_AT_VENUE', 'Pay at Venue'),
        ('PENDING', 'Pending Payment'),
        ('PAID', 'Paid Full (Legacy)'),
        ('REFUNDED', 'Refunded'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('PAY_AT_VENUE', 'Pay at Venue (Cash/Counter UPI)'),
        ('RAZORPAY', 'Online Payment Gateway'),
        ('UPI', 'Counter UPI QR'),
        ('CASH', 'Desk Cash'),
    )

    SOURCE_CHOICES = (
        ('ONLINE', 'Online Booking'),
        ('PHONE', 'Phone Reservation'),
        ('WALKIN', 'Walk-In Desk Booking'),
    )

    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    court = models.ForeignKey(Court, on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')

    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=20, db_index=True)
    customer_email = models.EmailField(blank=True, null=True)

    start_at = models.DateTimeField(null=True, blank=True, db_index=True)
    end_at = models.DateTimeField(null=True, blank=True, db_index=True)
    booking_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_hours = models.PositiveIntegerField(default=1)

    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default='ONLINE')
    total_price = models.DecimalField(max_digits=8, decimal_places=2, default=400.00)
    discount_code = models.CharField(max_length=50, blank=True, default='')
    discount_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    equipment_addons = models.JSONField(default=dict, blank=True)

    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PAY_AT_VENUE')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='PAY_AT_VENUE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED', db_index=True)

    notes = models.TextField(blank=True, default='')
    cancellation_reason = models.TextField(blank=True, default='')
    cancelled_at = models.DateTimeField(null=True, blank=True)

    created_by_staff = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_created_bookings',
    )
    staff_identifier = models.CharField(max_length=128, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_at', '-booking_date', '-start_time']
        indexes = [
            models.Index(fields=['court', 'start_at', 'end_at']),
            models.Index(fields=['status', 'payment_status']),
        ]

    @property
    def public_id(self) -> str:
        return self.external_id or f"BK-{self.id}"

    def sync_datetimes(self):
        if self.start_at and self.end_at:
            ist_start = timezone.localtime(self.start_at, VENUE_TZ)
            ist_end = timezone.localtime(self.end_at, VENUE_TZ)
            self.booking_date = ist_start.date()
            self.start_time = ist_start.time().replace(tzinfo=None, microsecond=0)
            self.end_time = ist_end.time().replace(tzinfo=None, microsecond=0)
            diff_seconds = (self.end_at - self.start_at).total_seconds()
            self.duration_hours = max(1, int(round(diff_seconds / 3600)))
        elif self.booking_date and self.start_time and self.end_time:
            local_start = datetime.combine(self.booking_date, self.start_time, tzinfo=VENUE_TZ)
            end_date = self.booking_date + timedelta(days=1) if self.end_time <= self.start_time else self.booking_date
            local_end = datetime.combine(end_date, self.end_time, tzinfo=VENUE_TZ)
            self.start_at = local_start
            self.end_at = local_end
            diff_seconds = (local_end - local_start).total_seconds()
            self.duration_hours = max(1, int(round(diff_seconds / 3600)))

    def save(self, *args, **kwargs):
        if self.external_id is not None:
            self.external_id = str(self.external_id).strip() or None
        if self.customer_email:
            self.customer_email = str(self.customer_email).strip().lower()
        self.sync_datetimes()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.public_id} | {self.court.name} | {self.booking_date} {self.start_time}-{self.end_time} | {self.customer_name}"


class SlotHold(models.Model):
    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    court = models.ForeignKey(Court, on_delete=models.CASCADE, related_name='holds')
    start_at = models.DateTimeField(db_index=True)
    end_at = models.DateTimeField(db_index=True)
    session_id = models.CharField(max_length=128, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_at', 'id']
        indexes = [
            models.Index(fields=['court', 'start_at', 'end_at', 'expires_at']),
        ]

    @property
    def public_id(self) -> str:
        return self.external_id or f"hold-{self.id}"

    def is_expired(self, now=None) -> bool:
        now = now or timezone.now()
        return self.expires_at <= now

    def __str__(self):
        return f"{self.public_id} | {self.court.name} ({self.start_at} - {self.end_at})"


class ScheduleBlock(models.Model):
    REASON_CHOICES = (
        ('MAINTENANCE', 'Court Maintenance'),
        ('TOURNAMENT', 'Tournament Play'),
        ('COACHING', 'Coaching Session'),
        ('PRIVATE_EVENT', 'Private Event'),
    )

    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    court = models.ForeignKey(Court, on_delete=models.CASCADE, related_name='blocks')
    start_at = models.DateTimeField(db_index=True)
    end_at = models.DateTimeField(db_index=True)
    reason = models.CharField(max_length=32, choices=REASON_CHOICES, default='MAINTENANCE')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_blocks')
    created_by_identifier = models.CharField(max_length=128, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_at', 'id']
        indexes = [
            models.Index(fields=['court', 'start_at', 'end_at']),
        ]

    @property
    def public_id(self) -> str:
        return self.external_id or f"blk-{self.id}"

    def __str__(self):
        return f"{self.public_id} | {self.court.name} | {self.reason}"


class PricingConfig(models.Model):
    key = models.CharField(max_length=32, unique=True, default='DEFAULT')
    base_price_per_hour = models.DecimalField(max_digits=8, decimal_places=2, default=400.00)
    peak_surge_price_per_hour = models.DecimalField(max_digits=8, decimal_places=2, default=550.00)
    peak_hours = models.JSONField(default=list, blank=True)
    is_peak_surge_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_by_identifier = models.CharField(max_length=128, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_current(cls):
        obj, created = cls.objects.get_or_create(
            key='DEFAULT',
            defaults={
                'base_price_per_hour': 400,
                'peak_surge_price_per_hour': 550,
                'peak_hours': ['18:00', '19:00', '20:00', '21:00', '22:00'],
                'is_peak_surge_active': True,
            },
        )
        return obj

    def __str__(self):
        return f"PricingConfig(base={self.base_price_per_hour}, peak={self.peak_surge_price_per_hour}, active={self.is_peak_surge_active})"


class DiscountCode(models.Model):
    TYPE_CHOICES = (
        ('PERCENT', 'Percent'),
        ('FLAT', 'Flat'),
    )

    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=16, choices=TYPE_CHOICES, default='FLAT')
    value = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    min_booking_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    max_usage = models.PositiveIntegerField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    valid_to = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def public_id(self) -> str:
        return self.external_id or f"disc-{self.id}"

    def save(self, *args, **kwargs):
        self.code = str(self.code).strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} ({self.discount_type}: {self.value})"


class GalleryItem(models.Model):
    TYPE_CHOICES = (
        ('image', 'Action Photography'),
        ('video', 'Video Reel / Loop'),
    )
    CATEGORY_CHOICES = (
        ('matchplay', 'Matchplay'),
        ('gear', 'Pro Gear & Paddles'),
        ('training', 'Drills & Coaching'),
        ('tournament', 'Tournaments & Leagues'),
    )

    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    title = models.CharField(max_length=200)
    item_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='matchplay')
    tag = models.CharField(max_length=50, blank=True, default='')

    # Supports relative static asset paths (e.g. /images/hero-player.jpg), uploaded paths, or remote URLs
    media_url = models.CharField(max_length=500, blank=True, null=True)
    media_file = models.FileField(upload_to='gallery/', blank=True, null=True)
    video_url = models.CharField(max_length=500, blank=True, null=True, help_text="Optional video URL or uploaded reel path")

    aspect = models.CharField(max_length=20, default='tall', choices=(('tall', 'Tall'), ('square', 'Square'), ('standard', 'Standard')))
    caption = models.TextField(blank=True, default='')
    duration = models.CharField(max_length=32, blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-id']

    @property
    def public_id(self) -> str:
        return self.external_id or f"gal-{self.id}"

    def __str__(self):
        return f"[{self.get_item_type_display()}] {self.title}"


class ArenaSchedule(models.Model):
    date = models.CharField(max_length=20, unique=True, help_text="YYYY-MM-DD or DEFAULT")
    is_closed = models.BooleanField(default=False)
    closure_reason = models.CharField(max_length=255, blank=True, null=True)
    open_time = models.TimeField(default="06:00")
    close_time = models.TimeField(default="23:00")
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_by_identifier = models.CharField(max_length=128, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        status = f"CLOSED ({self.closure_reason})" if self.is_closed else f"OPEN ({self.open_time}-{self.close_time})"
        return f"{self.date}: {status}"


class AuditLog(models.Model):
    external_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    actor_id_raw = models.CharField(max_length=128)
    actor_role = models.CharField(max_length=32)
    action = models.CharField(max_length=64, db_index=True)
    entity_id = models.CharField(max_length=128, blank=True, default='')
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']

    @property
    def public_id(self) -> str:
        return self.external_id or f"audit-{self.id}"

    def __str__(self):
        return f"{self.created_at.isoformat()} | {self.actor_role}:{self.actor_id_raw} | {self.action} ({self.entity_id})"
