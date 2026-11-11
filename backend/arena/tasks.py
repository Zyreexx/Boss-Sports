import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import Sum
from django.utils import timezone

logger = logging.getLogger('boss_backend.tasks')


@shared_task(bind=True, max_retries=3)
def send_booking_confirmation(self, booking_id: int):
    """
    Celery background task for booking confirmation dispatch.
    Never logs customer PII (names, phone numbers, or emails).
    """
    from .models import Booking

    try:
        booking = Booking.objects.select_related('court').get(id=booking_id)
        logger.info(
            "[Celery Worker] Confirmation queued booking_id=%s court=%s date=%s",
            booking.public_id,
            booking.court.public_id,
            booking.booking_date,
        )
        return {
            "status": "QUEUED",
            "booking_id": booking.public_id,
            "court": booking.court.public_id,
        }
    except Booking.DoesNotExist:
        logger.warning("[Celery Worker] Booking id=%s does not exist.", booking_id)
        return {"status": "NOT_FOUND", "booking_id": booking_id}
    except Exception as exc:
        logger.error("[Celery Worker] Error queuing confirmation for booking id=%s", booking_id)
        raise self.retry(exc=exc, countdown=60)


@shared_task
def auto_cancel_stale_pending_bookings():
    """
    Periodic cleanup of expired SlotHold rows and stale unpaid PENDING bookings.
    Availability queries always check expires_at > now directly against PostgreSQL,
    so expired holds never block bookings even when Celery Beat is delayed.
    """
    from .models import Booking, SlotHold

    now = timezone.now()
    expired_holds_count, _ = SlotHold.objects.filter(expires_at__lte=now).delete()

    cutoff = now - timedelta(minutes=15)
    stale_bookings = Booking.objects.filter(
        status='PENDING',
        payment_status='PENDING',
        created_at__lt=cutoff,
    )
    stale_booking_count = stale_bookings.update(
        status='CANCELLED',
        cancellation_reason='Expired pending hold (auto-released)',
        cancelled_at=now,
    )

    if expired_holds_count or stale_booking_count:
        logger.info(
            "[Celery Worker] Cleanup released holds=%s stale_pending_bookings=%s",
            expired_holds_count,
            stale_booking_count,
        )
    return {
        "released_holds": expired_holds_count,
        "released_pending_bookings": stale_booking_count,
    }


@shared_task
def generate_daily_occupancy_report():
    """
    Periodic IST nightly summary aggregating PostgreSQL realized vs pending revenue
    while excluding CANCELLED and REFUNDED bookings.
    """
    from .models import Booking

    today = timezone.localdate()
    valid_bookings = (
        Booking.objects.filter(booking_date=today)
        .exclude(status='CANCELLED')
        .exclude(payment_status='REFUNDED')
    )
    realized_revenue = (
        valid_bookings.filter(payment_status__in=['PAID_ONLINE', 'CASH_COUNTER', 'UPI_COUNTER', 'PAID'])
        .aggregate(total=Sum('total_price'))['total']
        or 0
    )
    total_hours = valid_bookings.aggregate(total=Sum('duration_hours'))['total'] or 0
    booking_count = valid_bookings.count()

    logger.info(
        "[Celery Worker] Daily Summary date=%s bookings=%s hours=%s realized_inr=%.2f",
        today,
        booking_count,
        total_hours,
        float(realized_revenue),
    )
    return {
        "date": str(today),
        "total_bookings": booking_count,
        "total_hours": total_hours,
        "realized_revenue": float(realized_revenue),
    }
