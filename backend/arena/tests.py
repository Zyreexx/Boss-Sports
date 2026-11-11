import json
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal
from importlib import import_module
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .auth import compute_service_signature
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
from .services import get_financial_report
from .tasks import auto_cancel_stale_pending_bookings, send_booking_confirmation

VENUE_TZ = ZoneInfo('Asia/Kolkata')
TEST_SERVICE_SECRET = 'test-backend-service-hmac-secret-2026'


def future_slot(hours_ahead: int = 24, duration_hours: int = 1) -> tuple[str, str]:
    start = timezone.now().replace(minute=0, second=0, microsecond=0) + timedelta(hours=hours_ahead)
    end = start + timedelta(hours=duration_hours)
    return (
        start.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
        end.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
    )


def signed_headers(
    method: str,
    full_path: str,
    body_dict: dict | None = None,
    actor_id: str = '',
    actor_role: str = '',
    actor_email: str = '',
    actor_phone: str = '',
    actor_name: str = '',
    secret: str = TEST_SERVICE_SECRET,
) -> tuple[dict, bytes]:
    body_bytes = json.dumps(body_dict).encode('utf-8') if body_dict is not None else b''
    ts_ms = str(int(time.time() * 1000))
    sig = compute_service_signature(
        secret=secret,
        timestamp_ms=ts_ms,
        method=method,
        full_path=full_path,
        actor_id=actor_id,
        actor_role=actor_role,
        body_bytes=body_bytes,
    )
    headers = {
        'HTTP_X_BOSS_TIMESTAMP': ts_ms,
        'HTTP_X_BOSS_SERVICE_SIGNATURE': sig,
    }
    if actor_id:
        headers['HTTP_X_BOSS_ACTOR_ID'] = actor_id
    if actor_role:
        headers['HTTP_X_BOSS_ACTOR_ROLE'] = actor_role
    if actor_email:
        headers['HTTP_X_BOSS_ACTOR_EMAIL'] = actor_email
    if actor_phone:
        headers['HTTP_X_BOSS_ACTOR_PHONE'] = actor_phone
    if actor_name:
        headers['HTTP_X_BOSS_ACTOR_NAME'] = actor_name
    return headers, body_bytes


class ImportFrontendJsonCommandTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        tmp = Path(self.tmpdir.name)

        now = timezone.now()
        active_exp = (now + timedelta(minutes=8)).astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z')
        expired_exp = (now - timedelta(minutes=5)).astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z')
        slot_start, slot_end = future_slot(hours_ahead=36, duration_hours=1)
        hold_start, hold_end = future_slot(hours_ahead=40, duration_hours=1)

        self.pb_json_path = tmp / 'pickleball_database.json'
        self.users_json_path = tmp / 'users_auth.json'

        self.pb_json_path.write_text(
            json.dumps({
                'courts': [
                    {'id': 'court-1', 'courtNumber': 1, 'name': 'Court 1', 'surfaceType': 'Pickleball Court', 'isIndoor': True, 'basePricePerHour': 400, 'isActive': True},
                    {'id': 'court-2', 'courtNumber': 2, 'name': 'Court 2', 'surfaceType': 'Pickleball Court', 'isIndoor': False, 'basePricePerHour': 450, 'isActive': True},
                ],
                'pricingConfig': {
                    'basePricePerHour': 400,
                    'peakSurgePricePerHour': 550,
                    'peakHours': ['18:00', '19:00', '20:00'],
                    'isPeakSurgeActive': True,
                    'updatedAt': '2026-11-07T14:30:00.000Z',
                },
                'schedules': [
                    {'date': 'DEFAULT', 'isClosed': False, 'openTime': '06:00', 'closeTime': '23:00'},
                ],
                'discounts': [
                    {'id': 'disc-first', 'code': 'FIRSTGAME', 'type': 'FLAT', 'value': 100, 'minBookingAmount': 400, 'maxUsage': 500, 'usageCount': 2, 'validTo': '2028-12-31T23:59:59.000Z', 'isActive': True},
                ],
                'galleryItems': [
                    {'id': 'gal-1', 'type': 'image', 'title': 'Rally Action', 'category': 'matchplay', 'tag': 'Live', 'src': '/images/hero-player.jpg', 'aspect': 'tall', 'caption': 'Court 1 rally'},
                ],
                'bookings': [
                    {
                        'id': 'BK-HIST-001',
                        'courtId': 'court-1',
                        'courtName': 'Court 1',
                        'startTime': slot_start,
                        'endTime': slot_end,
                        'customerName': 'Real Customer',
                        'customerPhone': '9825011111',
                        'customerEmail': 'real@example.com',
                        'source': 'ONLINE',
                        'status': 'CONFIRMED',
                        'paymentStatus': 'UPI_COUNTER',
                        'totalPrice': 450,
                        'createdAt': '2026-11-07T10:00:00.000Z',
                        'updatedAt': '2026-11-07T10:05:00.000Z',
                    }
                ],
                'holds': [
                    {'id': 'hold-active-1', 'courtId': 'court-2', 'startTime': hold_start, 'endTime': hold_end, 'sessionId': 'sess-a', 'expiresAt': active_exp, 'createdAt': '2026-11-11T10:00:00.000Z'},
                    {'id': 'hold-expired-1', 'courtId': 'court-2', 'startTime': hold_start, 'endTime': hold_end, 'sessionId': 'sess-b', 'expiresAt': expired_exp, 'createdAt': '2026-11-11T09:00:00.000Z'},
                ],
                'blocks': [],
                'auditLogs': [
                    {'id': 'audit-1', 'actorId': 'usr-owner-01', 'actorRole': 'OWNER', 'action': 'CREATE_BOOKING', 'entityId': 'BK-HIST-001', 'details': {'finalPrice': 450}, 'createdAt': '2026-11-07T10:00:00.000Z'},
                ],
            }),
            encoding='utf-8',
        )

        self.users_json_path.write_text(
            json.dumps([
                {'id': 'usr-owner-01', 'email': 'owner@boss.com', 'phone': '9999999999', 'name': 'Owner Demo', 'role': 'OWNER', 'passwordHash': 'DemoPass@2026', 'createdAt': '2026-11-07T10:00:00.000Z'},
                {'id': 'usr-real-01', 'email': 'real@example.com', 'phone': '9825011111', 'name': 'Real Customer', 'role': 'CUSTOMER', 'passwordHash': 'PlayerPass@2026', 'createdAt': '2026-11-08T10:00:00.000Z'},
            ]),
            encoding='utf-8',
        )

    def test_dry_run_makes_zero_db_changes(self):
        call_command(
            'import_frontend_json',
            pickleball_json=str(self.pb_json_path),
            users_json=str(self.users_json_path),
            dry_run=True,
        )
        self.assertEqual(Court.objects.count(), 0)
        self.assertEqual(Booking.objects.count(), 0)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_idempotent_import_backup_and_demo_filtering(self):
        backup_dir = Path(self.tmpdir.name) / 'backups'
        # Run 1 without --include-demo-users: should skip owner@boss.com demo user, import real@example.com
        call_command(
            'import_frontend_json',
            pickleball_json=str(self.pb_json_path),
            users_json=str(self.users_json_path),
            backup_dir=str(backup_dir),
        )
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first().email, 'real@example.com')
        self.assertEqual(Court.objects.count(), 2)
        self.assertEqual(Booking.objects.count(), 1)
        imported_booking = Booking.objects.get(external_id='BK-HIST-001')
        self.assertEqual(imported_booking.total_price, Decimal('450.00'))
        self.assertEqual(imported_booking.payment_status, 'UPI_COUNTER')
        self.assertEqual(imported_booking.created_at.isoformat(), '2026-11-07T10:00:00+00:00')
        self.assertEqual(SlotHold.objects.count(), 1)
        self.assertEqual(SlotHold.objects.first().external_id, 'hold-active-1')
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(DiscountCode.objects.get(code='FIRSTGAME').usage_count, 2)
        self.assertEqual(GalleryItem.objects.count(), 1)
        self.assertTrue(any(p.name.startswith('migration_backup_') for p in backup_dir.iterdir()))

        # Run 2 (repeat idempotently): counts must remain exact with zero duplicates
        call_command(
            'import_frontend_json',
            pickleball_json=str(self.pb_json_path),
            users_json=str(self.users_json_path),
        )
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Court.objects.count(), 2)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(SlotHold.objects.count(), 1)
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(GalleryItem.objects.count(), 1)


@override_settings(BACKEND_SERVICE_SECRET=TEST_SERVICE_SECRET)
class BookingConcurrencyTimezoneAndHoldTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.court = Court.objects.create(
            external_id='court-1',
            court_number=1,
            name='Court 1',
            price_per_hour=Decimal('400.00'),
            is_active=True,
        )
        PricingConfig.get_current()
        ArenaSchedule.objects.create(date='DEFAULT', is_closed=False, open_time='06:00', close_time='23:00')
        self.staff = User.objects.create_user(
            username='staff1',
            external_id='usr-emp-01',
            email='staff@boss.com',
            phone='8888888888',
            role='EMPLOYEE',
            password='Password@123',
        )

    def test_interval_overlap_and_rebooking_cancelled_slot(self):
        # 2-hour booking: 10:00 - 12:00 IST on a future date
        future_day = (timezone.localtime(timezone.now(), VENUE_TZ).date() + timedelta(days=3))
        start_2h = datetime(future_day.year, future_day.month, future_day.day, 10, 0, tzinfo=VENUE_TZ)
        end_2h = datetime(future_day.year, future_day.month, future_day.day, 12, 0, tzinfo=VENUE_TZ)

        body1 = {
            'courtId': 'court-1',
            'startTime': start_2h.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
            'endTime': end_2h.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
            'customerName': 'Player One',
            'customerPhone': '9876500001',
        }
        res1 = self.client.post('/api/pickleball/book/', body1, format='json')
        self.assertEqual(res1.status_code, 200)
        booking_id = res1.data['booking']['id']

        # Overlapping inner hour 11:00 - 12:00 IST must be rejected with 409
        start_inner = datetime(future_day.year, future_day.month, future_day.day, 11, 0, tzinfo=VENUE_TZ)
        body_overlap = {
            'courtId': 'court-1',
            'startTime': start_inner.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
            'endTime': end_2h.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
            'customerName': 'Player Two',
            'customerPhone': '9876500002',
        }
        res_overlap = self.client.post('/api/pickleball/book/', body_overlap, format='json')
        self.assertEqual(res_overlap.status_code, 409)

        # Adjacent slot 12:00 - 13:00 IST must succeed
        end_3h = datetime(future_day.year, future_day.month, future_day.day, 13, 0, tzinfo=VENUE_TZ)
        body_adj = {
            'courtId': 'court-1',
            'startTime': end_2h.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
            'endTime': end_3h.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z'),
            'customerName': 'Player Three',
            'customerPhone': '9876500003',
        }
        res_adj = self.client.post('/api/pickleball/book/', body_adj, format='json')
        self.assertEqual(res_adj.status_code, 200)

        # Cancel first booking (staff), then confirm slot can be re-booked (old broken unique_together fixed)
        cancel_body = {'bookingId': booking_id, 'reason': 'Reschedule'}
        h, raw = signed_headers('POST', '/api/pickleball/cancel/', cancel_body, actor_id='usr-emp-01', actor_role='EMPLOYEE')
        res_cancel = self.client.post('/api/pickleball/cancel/', data=raw, content_type='application/json', **h)
        self.assertEqual(res_cancel.status_code, 200)

        res_rebook = self.client.post('/api/pickleball/book/', body1, format='json')
        self.assertEqual(res_rebook.status_code, 200)

    def test_postgres_exclusion_constraint_integrity_error_maps_to_409(self):
        start_iso, end_iso = future_slot(hours_ahead=48, duration_hours=1)
        with patch('arena.services.Booking.objects.create', side_effect=IntegrityError('exclusion constraint violation')):
            res = self.client.post(
                '/api/pickleball/book/',
                {
                    'courtId': 'court-1',
                    'startTime': start_iso,
                    'endTime': end_iso,
                    'customerName': 'Race Player',
                    'customerPhone': '9999900001',
                },
                format='json',
            )
        self.assertEqual(res.status_code, 409)
        self.assertIn('conflict', res.data['error'].lower())

    def test_expired_hold_stops_blocking_immediately_without_celery(self):
        future_day = (timezone.localtime(timezone.now(), VENUE_TZ).date() + timedelta(days=2))
        s_dt = datetime(future_day.year, future_day.month, future_day.day, 14, 0, tzinfo=VENUE_TZ).astimezone(dt_timezone.utc)
        e_dt = s_dt + timedelta(hours=1)
        expired_hold = SlotHold.objects.create(
            external_id='hold-exp-1',
            court=self.court,
            start_at=s_dt,
            end_at=e_dt,
            session_id='sess-old',
            expires_at=timezone.now() - timedelta(seconds=30),
        )

        # Even without running Celery task, availability shows AVAILABLE and booking succeeds
        avail_res = self.client.get(f'/api/pickleball/availability/?date={future_day.isoformat()}')
        self.assertEqual(avail_res.status_code, 200)
        slot_14 = next(s for s in avail_res.data['slots'] if s['timeLabel'].startswith('14:00'))
        self.assertEqual(slot_14['status'], 'AVAILABLE')

        res_book = self.client.post(
            '/api/pickleball/book/',
            {
                'courtId': 'court-1',
                'startTime': s_dt.isoformat().replace('+00:00', 'Z'),
                'endTime': e_dt.isoformat().replace('+00:00', 'Z'),
                'customerName': 'New Customer',
                'customerPhone': '9999912345',
                'sessionId': 'sess-new',
            },
            format='json',
        )
        self.assertEqual(res_book.status_code, 200)
        self.assertFalse(SlotHold.objects.filter(id=expired_hold.id).exists())

    def test_celery_cleanup_and_pii_free_confirmation_log(self):
        s_iso, e_iso = future_slot(hours_ahead=72, duration_hours=1)
        SlotHold.objects.create(
            external_id='hold-stale-1',
            court=self.court,
            start_at=datetime.fromisoformat(s_iso.replace('Z', '+00:00')),
            end_at=datetime.fromisoformat(e_iso.replace('Z', '+00:00')),
            session_id='sess-stale',
            expires_at=timezone.now() - timedelta(minutes=2),
        )
        cleanup_res = auto_cancel_stale_pending_bookings()
        self.assertEqual(cleanup_res['released_holds'], 1)

        booking = Booking.objects.create(
            external_id='BK-PII-CHECK',
            court=self.court,
            customer_name='Secret Player Name',
            customer_phone='9898989898',
            customer_email='secret@example.com',
            start_at=datetime.fromisoformat(s_iso.replace('Z', '+00:00')),
            end_at=datetime.fromisoformat(e_iso.replace('Z', '+00:00')),
            booking_date=timezone.localtime(timezone.now(), VENUE_TZ).date(),
            start_time='10:00',
            end_time='11:00',
        )
        with self.assertLogs('boss_backend.tasks', level='INFO') as cm:
            task_result = send_booking_confirmation(booking.id)
        log_output = '\n'.join(cm.output)
        self.assertNotIn('Secret Player Name', log_output)
        self.assertNotIn('9898989898', log_output)
        self.assertNotIn('secret@example.com', log_output)
        self.assertEqual(task_result['booking_id'], 'BK-PII-CHECK')

    def test_ist_peak_pricing_overnight_schedule_and_holiday_closure(self):
        future_day = (timezone.localtime(timezone.now(), VENUE_TZ).date() + timedelta(days=5))
        date_str = future_day.isoformat()
        avail = self.client.get(f'/api/pickleball/availability/?date={date_str}')
        self.assertEqual(avail.status_code, 200)
        slot_10 = next(s for s in avail.data['slots'] if s['timeLabel'].startswith('10:00'))
        slot_18 = next(s for s in avail.data['slots'] if s['timeLabel'].startswith('18:00'))
        self.assertEqual(slot_10['price'], 400.0)
        self.assertFalse(slot_10['isPeak'])
        self.assertEqual(slot_18['price'], 550.0)
        self.assertTrue(slot_18['isPeak'])

        # Overnight schedule 17:00 to 05:00 must emit (+1d) post-midnight slots and preserve availability on same-day night
        ArenaSchedule.objects.create(date=date_str, is_closed=False, open_time='17:00', close_time='05:00')
        simulated_night = datetime(future_day.year, future_day.month, future_day.day, 22, 30, tzinfo=VENUE_TZ).astimezone(dt_timezone.utc)
        with patch('arena.services.timezone.now', return_value=simulated_night):
            avail_night = self.client.get(f'/api/pickleball/availability/?date={date_str}')
        self.assertEqual(avail_night.status_code, 200)
        self.assertEqual(avail_night.data['openTime'], '17:00')
        self.assertEqual(avail_night.data['closeTime'], '05:00')
        labels = [s['timeLabel'] for s in avail_night.data['slots']]
        self.assertTrue(any('(+1d)' in lbl for lbl in labels))
        post_midnight_slot = next(s for s in avail_night.data['slots'] if '01:00 - 02:00 (+1d)' in s['timeLabel'])
        self.assertEqual(post_midnight_slot['status'], 'AVAILABLE')
        self.assertTrue(post_midnight_slot['isAvailable'])

        # Holiday closure blocks availability & booking creation
        ArenaSchedule.objects.filter(date=date_str).update(is_closed=True, closure_reason='Diwali Holiday')
        avail_closed = self.client.get(f'/api/pickleball/availability/?date={date_str}')
        self.assertTrue(avail_closed.data['isClosed'])
        self.assertEqual(avail_closed.data['slots'], [])
        start_closed = datetime(future_day.year, future_day.month, future_day.day, 10, 0, tzinfo=VENUE_TZ).astimezone(dt_timezone.utc)
        res_closed_book = self.client.post(
            '/api/pickleball/book/',
            {
                'courtId': 'court-1',
                'startTime': start_closed.isoformat().replace('+00:00', 'Z'),
                'endTime': (start_closed + timedelta(hours=1)).isoformat().replace('+00:00', 'Z'),
                'customerName': 'Holiday Player',
                'customerPhone': '9999977777',
            },
            format='json',
        )
        self.assertEqual(res_closed_book.status_code, 409)


@override_settings(BACKEND_SERVICE_SECRET=TEST_SERVICE_SECRET)
class SecurityPermissionsAndRevenueTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.court = Court.objects.create(external_id='court-1', name='Court 1', price_per_hour=Decimal('400.00'))
        PricingConfig.get_current()
        self.owner = User.objects.create_user(
            username='owner', external_id='usr-owner-01', email='owner@boss.com', phone='9999999999', role='OWNER', is_staff=True, is_superuser=True, password='OwnerPass@123'
        )
        self.staff = User.objects.create_user(
            username='staff', external_id='usr-emp-01', email='staff@boss.com', phone='8888888888', role='EMPLOYEE', is_staff=True, password='StaffPass@123'
        )
        self.cust_a = User.objects.create_user(
            username='custa', external_id='usr-cust-a', email='custa@boss.com', phone='9876543210', role='CUSTOMER', password='PlayerPass@123'
        )
        self.cust_b = User.objects.create_user(
            username='custb', external_id='usr-cust-b', email='custb@boss.com', phone='9123456789', role='CUSTOMER', password='PlayerPass@123'
        )

    def test_forged_actor_headers_rejected_and_google_requires_service_signature(self):
        res_forged = self.client.get(
            '/api/admin/reports/',
            HTTP_X_BOSS_ACTOR_ID='usr-owner-01',
            HTTP_X_BOSS_ACTOR_ROLE='OWNER',
        )
        self.assertEqual(res_forged.status_code, 401)

        res_bad_sig = self.client.get(
            '/api/admin/reports/',
            HTTP_X_BOSS_TIMESTAMP=str(int(time.time() * 1000)),
            HTTP_X_BOSS_SERVICE_SIGNATURE='0' * 64,
            HTTP_X_BOSS_ACTOR_ID='usr-owner-01',
            HTTP_X_BOSS_ACTOR_ROLE='OWNER',
        )
        self.assertEqual(res_bad_sig.status_code, 401)

        # Direct untrusted call to /api/auth/google/ without HMAC signature is rejected
        res_google = self.client.post('/api/auth/google/', {'email': 'owner@boss.com', 'name': 'Spoof'}, format='json')
        self.assertEqual(res_google.status_code, 401)

    def test_anonymous_and_role_isolation_and_pii_stripping(self):
        from datetime import datetime, timedelta
        from django.utils import timezone as dj_tz
        from arena.services import VENUE_TZ

        future_day = dj_tz.localtime(dj_tz.now(), VENUE_TZ).date() + timedelta(days=2)
        start_dt = datetime(future_day.year, future_day.month, future_day.day, 10, 0, tzinfo=VENUE_TZ)
        end_dt = datetime(future_day.year, future_day.month, future_day.day, 11, 0, tzinfo=VENUE_TZ)
        s_iso, e_iso = start_dt.isoformat(), end_dt.isoformat()
        res_book = self.client.post(
            '/api/pickleball/book/',
            {
                'courtId': 'court-1',
                'startTime': s_iso,
                'endTime': e_iso,
                'customerName': 'Private Player',
                'customerPhone': '9876543210',
                'customerEmail': 'custa@boss.com',
                'source': 'WALKIN',
                'paymentStatus': 'PAID_ONLINE',
                'totalPrice': 1,
            },
            format='json',
        )
        self.assertEqual(res_book.status_code, 400)  # Rejects forged PAID_ONLINE directly

        # Valid online booking forces server pricing & PAY_AT_VENUE
        res_valid = self.client.post(
            '/api/pickleball/book/',
            {
                'courtId': 'court-1',
                'startTime': s_iso,
                'endTime': e_iso,
                'customerName': 'Private Player',
                'customerPhone': '9876543210',
                'customerEmail': 'custa@boss.com',
                'source': 'WALKIN',
                'paymentStatus': 'PAY_AT_VENUE',
                'totalPrice': 1,
            },
            format='json',
        )
        self.assertEqual(res_valid.status_code, 200)
        booking_id = res_valid.data['booking']['id']
        self.assertEqual(res_valid.data['booking']['source'], 'ONLINE')
        self.assertGreaterEqual(res_valid.data['booking']['totalPrice'], 400.0)

        # Anonymous lookup rejected (both new & legacy endpoints)
        self.assertEqual(self.client.get('/api/pickleball/bookings/?phone=9876543210').status_code, 401)
        self.assertEqual(self.client.get('/api/bookings/?date=2026-12-01').status_code, 401)

        # Anonymous availability strips customerName & customerPhone
        date_ist = timezone.localtime(datetime.fromisoformat(s_iso.replace('Z', '+00:00')), VENUE_TZ).date().isoformat()
        avail = self.client.get(f'/api/pickleball/availability/?date={date_ist}')
        self.assertEqual(avail.status_code, 200)
        booked_slot = next(s for s in avail.data['availability'][0]['slots'] if s['status'] == 'BOOKED')
        self.assertNotIn('customerName', booked_slot)
        self.assertNotIn('customerPhone', booked_slot)
        self.assertNotIn('bookingId', booked_slot)

        # Customer B cannot cancel Customer A's booking
        cancel_payload = {'bookingId': booking_id, 'reason': 'Cross user attack'}
        hb, raw_b = signed_headers('POST', '/api/pickleball/cancel/', cancel_payload, actor_id='usr-cust-b', actor_role='CUSTOMER', actor_phone='9123456789', actor_email='custb@boss.com')
        res_cross = self.client.post('/api/pickleball/cancel/', data=raw_b, content_type='application/json', **hb)
        self.assertEqual(res_cross.status_code, 403)

        # Staff CANNOT view financial reports or change pricing or delete courts
        hs_rep, _ = signed_headers('GET', '/api/admin/reports/', actor_id='usr-emp-01', actor_role='EMPLOYEE')
        self.assertEqual(self.client.get('/api/admin/reports/', **hs_rep).status_code, 403)

        price_body = {'basePricePerHour': 999}
        hs_pr, raw_pr = signed_headers('POST', '/api/admin/pricing/', price_body, actor_id='usr-emp-01', actor_role='EMPLOYEE')
        self.assertEqual(self.client.post('/api/admin/pricing/', data=raw_pr, content_type='application/json', **hs_pr).status_code, 403)

        court_patch = {'courtId': 'court-1', 'basePricePerHour': 999}
        hs_cp, raw_cp = signed_headers('PATCH', '/api/pickleball/courts/', court_patch, actor_id='usr-emp-01', actor_role='EMPLOYEE')
        self.assertEqual(self.client.patch('/api/pickleball/courts/', data=raw_cp, content_type='application/json', **hs_cp).status_code, 403)

    def test_2hr_cancellation_window_and_refund_status(self):
        # Booking 60 minutes ahead (<2 hrs)
        s_soon, e_soon = future_slot(hours_ahead=1, duration_hours=1)
        b_soon = Booking.objects.create(
            external_id='BK-SOON-1',
            court=self.court,
            user=self.cust_a,
            customer_name='Cust A',
            customer_phone='9876543210',
            customer_email='custa@boss.com',
            start_at=timezone.now() + timedelta(minutes=60),
            end_at=timezone.now() + timedelta(minutes=120),
            booking_date=timezone.localdate(),
            start_time='22:00',
            end_time='23:00',
            payment_status='PAID_ONLINE',
            total_price=Decimal('400.00'),
        )
        payload = {'bookingId': 'BK-SOON-1', 'reason': 'Late cancel'}
        ha, raw_a = signed_headers('POST', '/api/pickleball/cancel/', payload, actor_id='usr-cust-a', actor_role='CUSTOMER', actor_phone='9876543210', actor_email='custa@boss.com')
        res_cust_soon = self.client.post('/api/pickleball/cancel/', data=raw_a, content_type='application/json', **ha)
        self.assertEqual(res_cust_soon.status_code, 400)

        # Staff override cancels and keeps payment_status='PAID_ONLINE' (honest refundable=False, no fake REFUNDED)
        hs, raw_s = signed_headers('POST', '/api/pickleball/cancel/', payload, actor_id='usr-emp-01', actor_role='EMPLOYEE')
        res_staff_cancel = self.client.post('/api/pickleball/cancel/', data=raw_s, content_type='application/json', **hs)
        self.assertEqual(res_staff_cancel.status_code, 200)
        self.assertEqual(res_staff_cancel.data['refundable'], False)
        b_soon.refresh_from_db()
        self.assertEqual(b_soon.status, 'CANCELLED')
        self.assertEqual(b_soon.payment_status, 'PAID_ONLINE')

    def test_revenue_report_excludes_cancelled_and_refunded_and_separates_pending(self):
        base_dt = timezone.now() + timedelta(days=4)
        for idx, (st, pst, amt) in enumerate([
            ('CONFIRMED', 'PAID_ONLINE', 550),
            ('CONFIRMED', 'CASH_COUNTER', 400),
            ('CONFIRMED', 'UPI_COUNTER', 400),
            ('CONFIRMED', 'PAY_AT_VENUE', 450),
            ('CONFIRMED', 'PENDING', 400),
            ('CANCELLED', 'PAID_ONLINE', 550),
            ('CONFIRMED', 'REFUNDED', 550),
        ]):
            s = base_dt + timedelta(hours=idx * 2)
            Booking.objects.create(
                external_id=f'BK-REV-{idx}',
                court=self.court,
                customer_name=f'P{idx}',
                customer_phone='9999900000',
                start_at=s,
                end_at=s + timedelta(hours=1),
                booking_date=timezone.localtime(s, VENUE_TZ).date(),
                start_time='10:00',
                end_time='11:00',
                status=st,
                payment_status=pst,
                total_price=Decimal(str(amt)),
            )

        report = get_financial_report()
        summary = report['summary']
        self.assertEqual(summary['totalOnlineReconciliation'], 550.0)
        self.assertEqual(summary['totalCashReconciliation'], 400.0)
        self.assertEqual(summary['totalUpiReconciliation'], 400.0)
        self.assertEqual(summary['realizedRevenue'], 1350.0)
        self.assertEqual(summary['pendingVenuePayment'], 850.0)
        self.assertEqual(summary['grossBookedValue'], 2200.0)
        self.assertEqual(summary['totalBookings'], 5)

    def test_health_endpoint_and_no_secret_leak(self):
        res = self.client.get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['checks']['database']['status'], 'ok')
        serialized = json.dumps(res.data)
        self.assertNotIn(TEST_SERVICE_SECRET, serialized)
        self.assertNotIn('SECRET', serialized)

    def test_postgres_exclusion_migration_generates_gist_constraint_ddl(self):
        mig = import_module('arena.migrations.0004_backfill_and_postgres_exclusion')
        op = mig.Migration.operations[1]
        executed_sql = []

        class FakeSchemaEditor:
            class connection:
                vendor = 'postgresql'

            def execute(self, sql):
                executed_sql.append(sql)

        op.database_forwards('arena', FakeSchemaEditor(), None, None)
        joined = '\n'.join(executed_sql)
        self.assertIn('CREATE EXTENSION IF NOT EXISTS btree_gist', joined)
        self.assertIn('EXCLUDE USING gist', joined)
        self.assertIn('tstzrange(start_at, end_at', joined)

    def test_production_settings_requires_database_url_without_sqlite_fallback(self):
        backend_dir = Path(settings.BASE_DIR)
        env = {
            **os.environ,
            'DJANGO_DEBUG': 'False',
            'DJANGO_SECRET_KEY': 'strong-prod-secret-for-test',
            'BACKEND_SERVICE_SECRET': 'strong-service-secret',
            'DJANGO_ALLOWED_HOSTS': 'api.example.com',
            'DATABASE_URL': '',
            'POSTGRES_DB': '',
        }
        proc = subprocess.run(
            [sys.executable, '-c', 'import boss_backend.settings'],
            cwd=str(backend_dir),
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('DATABASE_URL', proc.stderr)

    def test_cross_session_hold_release_and_conflict(self):
        future_day = timezone.localtime(timezone.now(), VENUE_TZ).date() + timedelta(days=4)
        s_dt = datetime(future_day.year, future_day.month, future_day.day, 15, 0, tzinfo=VENUE_TZ).astimezone(dt_timezone.utc)
        e_dt = s_dt + timedelta(hours=1)
        s_iso = s_dt.isoformat().replace('+00:00', 'Z')
        e_iso = e_dt.isoformat().replace('+00:00', 'Z')

        # Session A acquires temporary 10-min hold
        res_hold_a = self.client.post(
            '/api/pickleball/hold/',
            {'courtId': 'court-1', 'startTime': s_iso, 'endTime': e_iso, 'sessionId': 'sess-alpha'},
            format='json',
        )
        self.assertEqual(res_hold_a.status_code, 200)
        hold_id = res_hold_a.data['hold']['id']

        # Session B sees HELD in availability with zero PII & gets 409 trying to book/hold
        avail_b = self.client.get(f'/api/pickleball/availability/?date={future_day.isoformat()}')
        slot_b = next(s for s in avail_b.data['slots'] if s['timeLabel'].startswith('15:00'))
        self.assertEqual(slot_b['status'], 'HELD')
        self.assertNotIn('sessionId', slot_b)

        res_book_b = self.client.post(
            '/api/pickleball/book/',
            {'courtId': 'court-1', 'startTime': s_iso, 'endTime': e_iso, 'customerName': 'B', 'customerPhone': '9999900099', 'sessionId': 'sess-beta'},
            format='json',
        )
        self.assertEqual(res_book_b.status_code, 409)

        # Session A releases hold -> Session B sees AVAILABLE and books successfully
        res_rel = self.client.delete(
            '/api/pickleball/hold/',
            data=json.dumps({'holdId': hold_id, 'sessionId': 'sess-alpha'}),
            content_type='application/json',
        )
        self.assertEqual(res_rel.status_code, 200)
        avail_b2 = self.client.get(f'/api/pickleball/availability/?date={future_day.isoformat()}')
        slot_b2 = next(s for s in avail_b2.data['slots'] if s['timeLabel'].startswith('15:00'))
        self.assertEqual(slot_b2['status'], 'AVAILABLE')

        res_book_b2 = self.client.post(
            '/api/pickleball/book/',
            {'courtId': 'court-1', 'startTime': s_iso, 'endTime': e_iso, 'customerName': 'Player B', 'customerPhone': '9999900099', 'sessionId': 'sess-beta'},
            format='json',
        )
        self.assertEqual(res_book_b2.status_code, 200)
