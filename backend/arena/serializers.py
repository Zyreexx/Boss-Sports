from rest_framework import serializers
from .models import User, Court, Booking, GalleryItem


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone', 'role', 'first_name', 'last_name', 'profile_photo')
        read_only_fields = ('id', 'role')


class CourtSerializer(serializers.ModelSerializer):
    class Meta:
        model = Court
        fields = '__all__'


class BookingSerializer(serializers.ModelSerializer):
    court_name = serializers.CharField(source='court.name', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id',
            'court',
            'court_name',
            'user',
            'customer_name',
            'customer_phone',
            'customer_email',
            'booking_date',
            'start_time',
            'end_time',
            'duration_hours',
            'total_price',
            'payment_status',
            'payment_method',
            'status',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate(self, attrs):
        court = attrs.get('court')
        booking_date = attrs.get('booking_date')
        start_time = attrs.get('start_time')

        # Check for slot collisions
        existing = Booking.objects.filter(
            court=court,
            booking_date=booking_date,
            start_time=start_time,
            status__in=['CONFIRMED', 'PENDING']
        )
        if self.instance:
            existing = existing.exclude(id=self.instance.id)

        if existing.exists():
            raise serializers.ValidationError({
                "slot": f"This slot ({start_time}) on {court.name} is already booked or reserved."
            })

        return attrs


class GalleryItemSerializer(serializers.ModelSerializer):
    effective_media_url = serializers.SerializerMethodField()

    class Meta:
        model = GalleryItem
        fields = [
            'id',
            'title',
            'item_type',
            'category',
            'tag',
            'media_url',
            'media_file',
            'effective_media_url',
            'video_url',
            'aspect',
            'caption',
            'order',
            'is_active',
            'created_at',
        ]
        read_only_fields = ('id', 'created_at')

    def get_effective_media_url(self, obj):
        if obj.media_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.media_file.url)
            return obj.media_file.url
        return obj.media_url or ''
