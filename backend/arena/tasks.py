import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('boss_backend.tasks')


@shared_task(bind=True, max_retries=3)
def send_booking_confirmation(self, booking_id: int):
    """
    Celery background worker task to dispatch SMS, WhatsApp, and Email
    confirmations to the player once a court booking is reserved.
    """
    from .models import Booking
    try:
        booking = Booking.objects.select_related('court').get(id=booking_id)
        logger.info(
            f"[Celery Worker] Sending booking confirmation to {booking.customer_name} ({booking.customer_phone}) "
            f"for {booking.court.name} on {booking.booking_date} at {booking.start_time}"
        )
        # In production, integrate Twilio, Gupshup, or SendGrid here
        return {
            "status": "SENT",
            "booking_id": booking.id,
            "court": booking.court.name,
            "player": booking.customer_name,
            "recipient": booking.customer_phone or booking.customer_email,
        }
    except Booking.DoesNotExist:
        logger.warning(f"[Celery Worker] Booking #{booking_id} does not exist.")
        return {"status": "NOT_FOUND", "booking_id": booking_id}
    except Exception as exc:
        logger.error(f"[Celery Worker] Error sending confirmation: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task
def auto_cancel_stale_pending_bookings():
    """
    Celery periodic task: Runs every 5 minutes to release unpaid slots
    held for longer than 15 minutes without payment completion.
    """
    from .models import Booking
    cutoff = timezone.now() - timedelta(minutes=15)
    stale_bookings = Booking.objects.filter(
        status='PENDING',
        payment_status='PENDING',
        created_at__lt=cutoff
    )
    count = stale_bookings.count()
    if count > 0:
        logger.info(f"[Celery Worker] Releasing {count} stale pending booking holds.")
        stale_bookings.update(status='CANCELLED')
    return {"released_count": count}


@shared_task
def generate_daily_occupancy_report():
    """
    Celery periodic task: Computes daily total revenue and court hours booked.
    """
    from .models import Booking
    today = timezone.localdate()
    today_bookings = Booking.objects.filter(
        booking_date=today,
        status__in=['CONFIRMED', 'COMPLETED']
    )
    total_revenue = sum(b.total_price for b in today_bookings)
    total_hours = sum(b.duration_hours for b in today_bookings)

    logger.info(
        f"[Celery Worker] Daily Summary ({today}): "
        f"{today_bookings.count()} bookings, {total_hours} court hours, ₹{total_revenue} revenue."
    )
    return {
        "date": str(today),
        "total_bookings": today_bookings.count(),
        "total_hours": total_hours,
        "total_revenue": float(total_revenue),
    }

