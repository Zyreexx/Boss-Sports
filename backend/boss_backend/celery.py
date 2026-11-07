import os
from celery import Celery
from celery.schedules import crontab

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boss_backend.settings')

app = Celery('boss_backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Scheduled Tasks
app.conf.beat_schedule = {
    # Auto-release pending online reservations that haven't been completed in 15 minutes
    'auto-release-unpaid-slots-every-5-mins': {
        'task': 'arena.tasks.auto_cancel_stale_pending_bookings',
        'schedule': 300.0,  # every 5 minutes
    },
    # Nightly arena summary and occupancy report
    'generate-nightly-arena-report': {
        'task': 'arena.tasks.generate_daily_occupancy_report',
        'schedule': crontab(hour=23, minute=55),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
