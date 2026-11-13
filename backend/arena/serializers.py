from rest_framework import serializers
from .models import Booking, Court, GalleryItem, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'external_id', 'username', 'email', 'phone', 'role', 'first_name', 'last_name', 'profile_photo')
        read_only_fields = ('id', 'external_id', 'role')


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
            'external_id',
            'court',
            'court_name',
            'user',
            'customer_name',
            'customer_phone',
            'customer_email',
            'start_at',
            'end_at',
            'booking_date',
            'start_time',
            'end_time',
            'duration_hours',
            'duration_minutes',
            'duration_display',
            'source',
            'total_price',
            'discount_code',
            'discount_amount',
            'equipment_addons',
            'payment_status',
            'payment_method',
            'status',
            'notes',
            'cancellation_reason',
            'cancelled_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('id', 'external_id', 'created_at', 'updated_at')


class GalleryItemSerializer(serializers.ModelSerializer):
    effective_media_url = serializers.SerializerMethodField()

    class Meta:
        model = GalleryItem
        fields = [
            'id',
            'external_id',
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
            'duration',
            'order',
            'is_active',
            'created_at',
        ]
        read_only_fields = ('id', 'external_id', 'created_at')

    def get_effective_media_url(self, obj):
        if obj.media_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.media_file.url)
            return obj.media_file.url
        return obj.media_url or ''
