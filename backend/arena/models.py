from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = (
        ('OWNER', 'Owner / Arena Administrator'),
        ('EMPLOYEE', 'Staff / Front Desk Desk Manager'),
        ('CUSTOMER', 'Player / Registered Athlete'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CUSTOMER')
    phone = models.CharField(max_length=20, blank=True, null=True, unique=True)
    profile_photo = models.URLField(blank=True, null=True)

    def is_owner(self):
        return self.role == 'OWNER' or self.is_superuser

    def is_staff_member(self):
        return self.role in ('OWNER', 'EMPLOYEE') or self.is_staff

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Court(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="e.g. Court 1 (Indoor Championship)")
    sport_type = models.CharField(max_length=50, default='pickleball')
    price_per_hour = models.DecimalField(max_digits=8, decimal_places=2, default=400.00)
    is_active = models.BooleanField(default=True)
    lighting_lux = models.PositiveIntegerField(default=500, help_text="Lighting spec in LUX")
    surface_type = models.CharField(max_length=100, default="Tournament Acrylic Pro Cushion")
    max_players = models.PositiveIntegerField(default=4)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} • ₹{self.price_per_hour}/hr"


class Booking(models.Model):
    STATUS_CHOICES = (
        ('CONFIRMED', 'Confirmed'),
        ('PENDING', 'Pending Payment / Hold'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('PAID', 'Paid Full'),
        ('PENDING', 'Pending Pay at Venue'),
        ('REFUNDED', 'Refunded'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('PAY_AT_VENUE', 'Pay at Venue (Cash/Counter UPI)'),
        ('RAZORPAY', 'Razorpay Online Gateway'),
        ('UPI', 'Counter UPI QR'),
        ('CASH', 'Desk Cash'),
    )

    court = models.ForeignKey(Court, on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')

    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=20)
    customer_email = models.EmailField(blank=True, null=True)

    booking_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_hours = models.PositiveIntegerField(default=1)

    total_price = models.DecimalField(max_digits=8, decimal_places=2, default=400.00)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='PAY_AT_VENUE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED')

    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-booking_date', '-start_time']
        unique_together = ('court', 'booking_date', 'start_time')

    def __str__(self):
        return f"{self.court.name} | {self.booking_date} {self.start_time}-{self.end_time} | {self.customer_name}"


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

    title = models.CharField(max_length=200)
    item_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='matchplay')
    tag = models.CharField(max_length=50, blank=True, default='')

    # Either a remote URL or an uploaded media file
    media_url = models.URLField(max_length=500, blank=True, null=True)
    media_file = models.FileField(upload_to='gallery/', blank=True, null=True)
    video_url = models.URLField(max_length=500, blank=True, null=True, help_text="e.g. https://vjs.zencdn.net/v/oceans.mp4")

    aspect = models.CharField(max_length=20, default='tall', choices=(('tall', 'Tall'), ('square', 'Square'), ('standard', 'Standard')))
    caption = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-id']

    def __str__(self):
        return f"[{self.get_item_type_display()}] {self.title}"
