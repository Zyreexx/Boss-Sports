import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boss_backend.settings')

app = Celery('boss_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # Periodic DB cleanup of expired SlotHold records & stale unpaid PENDING bookings
    'cleanup-expired-holds-every-2-mins': {
        'task': 'arena.tasks.auto_cancel_stale_pending_bookings',
        'schedule': 120.0,
    },
    # Nightly arena summary & occupancy report (IST)
    'generate-nightly-arena-report': {
        'task': 'arena.tasks.generate_daily_occupancy_report',
        'schedule': crontab(hour=23, minute=55),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    return f'Celery healthy: {self.request.id}'
