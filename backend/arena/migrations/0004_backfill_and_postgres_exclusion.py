from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import migrations


VENUE_TZ = ZoneInfo('Asia/Kolkata')


def backfill_booking_intervals(apps, schema_editor):
    Booking = apps.get_model('arena', 'Booking')
    for booking in Booking.objects.all():
        updated = False
        if booking.start_at is None or booking.end_at is None:
            if booking.booking_date and booking.start_time and booking.end_time:
                local_start = datetime.combine(booking.booking_date, booking.start_time, tzinfo=VENUE_TZ)
                end_date = (
                    booking.booking_date + timedelta(days=1)
                    if booking.end_time <= booking.start_time
                    else booking.booking_date
                )
                local_end = datetime.combine(end_date, booking.end_time, tzinfo=VENUE_TZ)
                booking.start_at = local_start
                booking.end_at = local_end
                updated = True
        if not booking.external_id:
            booking.external_id = f"BK-{booking.id}"
            updated = True
        if updated:
            booking.save()


class PostgresOnlySQL(migrations.operations.base.Operation):
    reversible = True

    def __init__(self, sql, reverse_sql):
        self.sql = sql
        self.reverse_sql = reverse_sql 

    def state_forwards(self, app_label, state):
        pass

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor != 'postgresql':
            return
        for stmt in self.sql:
            schema_editor.execute(stmt)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor != 'postgresql':
            return
        for stmt in self.reverse_sql:
            schema_editor.execute(stmt)

    def describe(self):
        return "Apply PostgreSQL btree_gist interval exclusion constraints"


class Migration(migrations.Migration):

    dependencies = [
        ('arena', '0003_auditlog_discountcode_pricingconfig_scheduleblock_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_booking_intervals, migrations.RunPython.noop),
        PostgresOnlySQL(
            sql=[
                "CREATE EXTENSION IF NOT EXISTS btree_gist;",
                "ALTER TABLE arena_booking DROP CONSTRAINT IF EXISTS arena_booking_no_overlap;",
                """
                ALTER TABLE arena_booking
                    ADD CONSTRAINT arena_booking_no_overlap
                    EXCLUDE USING gist (
                        court_id WITH =,
                        tstzrange(start_at, end_at, '[)') WITH &&
                    )
                    WHERE (status <> 'CANCELLED' AND start_at IS NOT NULL AND end_at IS NOT NULL);
                """,
                "ALTER TABLE arena_booking DROP CONSTRAINT IF EXISTS arena_booking_valid_interval;",
                """
                ALTER TABLE arena_booking
                    ADD CONSTRAINT arena_booking_valid_interval
                    CHECK (start_at IS NOT NULL AND end_at IS NOT NULL AND end_at > start_at);
                """,
            ],
            reverse_sql=[
                "ALTER TABLE arena_booking DROP CONSTRAINT IF EXISTS arena_booking_no_overlap;",
                "ALTER TABLE arena_booking DROP CONSTRAINT IF EXISTS arena_booking_valid_interval;",
            ],
        ),
    ]
