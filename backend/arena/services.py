import os
import re
import time
import uuid
from datetime import datetime, time as dt_time, timedelta, timezone as dt_timezone
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone

from .auth import ActorContext
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
    normalize_phone_digits,
)

VENUE_TZ = ZoneInfo('Asia/Kolkata')
HOLD_TTL_MINUTES = 10
MIN_BOOKING_DURATION_SECONDS = 30 * 60
MAX_BOOKING_DURATION_SECONDS = 12 * 3600

COLLECTED_PAYMENT_STATUSES = {'PAID_ONLINE', 'CASH_COUNTER', 'UPI_COUNTER', 'PAID'}
PENDING_PAYMENT_STATUSES = {'PAY_AT_VENUE', 'PENDING'}
BOOKABLE_PAYMENT_STATUSES = {'PAY_AT_VENUE', 'CASH_COUNTER', 'UPI_COUNTER', 'PENDING'}
STAFF_UPDATABLE_PAYMENT_STATUSES = {'CASH_COUNTER', 'UPI_COUNTER', 'PAID_ONLINE'}
VALID_BLOCK_REASONS = {'MAINTENANCE', 'TOURNAMENT', 'COACHING', 'PRIVATE_EVENT'}


class DomainError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    aware = dt if timezone.is_aware(dt) else timezone.make_aware(dt, VENUE_TZ)
    return aware.astimezone(dt_timezone.utc).isoformat().replace('+00:00', 'Z')


def parse_iso_datetime(value: str, field_name: str = 'timestamp') -> datetime:
    if not value or not isinstance(value, str):
        raise DomainError(f"Invalid {field_name}.", status_code=400)
    raw = value.strip()
    if raw.endswith('Z'):
        raw = raw[:-1] + '+00:00'
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise DomainError(f"Invalid {field_name} format.", status_code=400) from exc
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, VENUE_TZ)
    return parsed.astimezone(dt_timezone.utc)


def get_venue_today_date() -> str:
    return timezone.localtime(timezone.now(), VENUE_TZ).date().isoformat()


def build_venue_interval_dt(date_str: str, hour: int, minute: int, day_offset: int = 0) -> datetime:
    parts = date_str.split('-')
    if len(parts) != 3:
        raise DomainError("Invalid date format. Expected YYYY-MM-DD.", status_code=400)
    y, m, d = map(int, parts)
    base_date = datetime(y, m, d).date() + timedelta(days=day_offset)
    local_dt = datetime(base_date.year, base_date.month, base_date.day, hour, minute, 0, tzinfo=VENUE_TZ)
    return local_dt.astimezone(dt_timezone.utc)


def parse_hhmm(value: str, default: dt_time) -> dt_time:
    if not value:
        return default
    parts = str(value).strip().split(':')
    try:
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError
        return dt_time(h, m)
    except (ValueError, IndexError) as exc:
        raise DomainError(f"Invalid time format '{value}'. Expected HH:MM.", status_code=400) from exc


def find_court(court_id_str: str) -> Optional[Court]:
    if not court_id_str:
        return None
    val = str(court_id_str).strip()
    court = Court.objects.filter(external_id=val).first()
    if court:
        return court
    if val.startswith('court-') and val[6:].isdigit():
        return Court.objects.filter(id=int(val[6:])).first()
    if val.isdigit():
        return Court.objects.filter(id=int(val)).first()
    return None


def find_booking(booking_id_str: str) -> Optional[Booking]:
    if not booking_id_str:
        return None
    val = str(booking_id_str).strip()
    booking = Booking.objects.select_related('court', 'user', 'created_by_staff').filter(external_id=val).first()
    if booking:
        return booking
    if val.startswith('BK-') and val[3:].isdigit():
        return Booking.objects.select_related('court', 'user', 'created_by_staff').filter(id=int(val[3:])).first()
    if val.isdigit():
        return Booking.objects.select_related('court', 'user', 'created_by_staff').filter(id=int(val)).first()
    return None


def find_gallery_item(item_id_str: str) -> Optional[GalleryItem]:
    if not item_id_str:
        return None
    val = str(item_id_str).strip()
    item = GalleryItem.objects.filter(external_id=val).first()
    if item:
        return item
    if val.startswith('gal-') and val[4:].isdigit():
        return GalleryItem.objects.filter(id=int(val[4:])).first()
    if val.isdigit():
        return GalleryItem.objects.filter(id=int(val)).first()
    return None


def _resolve_actor_user(actor: Optional[ActorContext]) -> Optional[User]:
    if not actor or not actor.is_authenticated:
        return None
    if actor.user:
        return actor.user
    if actor.actor_id:
        u = User.objects.filter(external_id=actor.actor_id).first()
        if u:
            return u
    if actor.email:
        return User.objects.filter(email__iexact=actor.email).first()
    return None


def record_audit_log(
    actor: Optional[ActorContext],
    action: str,
    entity_id: str = '',
    details: Optional[dict] = None,
    fallback_actor_id: str = 'system',
    fallback_role: str = 'SYSTEM',
) -> AuditLog:
    actor_user = _resolve_actor_user(actor)
    if actor and actor.is_authenticated:
        actor_id_raw = actor.actor_id
        actor_role = 'STAFF' if actor.role == 'EMPLOYEE' else actor.role
    else:
        actor_id_raw = fallback_actor_id
        actor_role = fallback_role

    ext_id = f"audit-{int(time.time() * 1000)}-{uuid.uuid4().hex[:4]}"
    return AuditLog.objects.create(
        external_id=ext_id,
        actor=actor_user,
        actor_id_raw=actor_id_raw,
        actor_role=actor_role,
        action=action,
        entity_id=entity_id or '',
        details=details or {},
    )


def serialize_user(user: User) -> dict:
    name = f"{user.first_name} {user.last_name}".strip() or user.username
    return {
        'id': user.public_id,
        'email': user.email or '',
        'phone': user.phone or '',
        'name': name,
        'role': user.role,
        'avatar': user.profile_photo or None,
        'createdAt': to_utc_iso(user.date_joined),
    }


def serialize_court(court: Court) -> dict:
    return {
        'id': court.public_id,
        'courtNumber': court.court_number,
        'name': court.name,
        'sportType': court.sport_type,
        'surfaceType': court.surface_type,
        'isIndoor': court.is_indoor,
        'basePricePerHour': float(court.price_per_hour),
        'isActive': court.is_active,
        'lightingLux': court.lighting_lux,
        'maxPlayers': court.max_players,
    }


def serialize_pricing(cfg: PricingConfig) -> dict:
    return {
        'basePricePerHour': float(cfg.base_price_per_hour),
        'peakSurgePricePerHour': float(cfg.peak_surge_price_per_hour),
        'peakHours': list(cfg.peak_hours or []),
        'isPeakSurgeActive': bool(cfg.is_peak_surge_active),
        'updatedBy': cfg.updated_by_identifier or None,
        'updatedAt': to_utc_iso(cfg.updated_at),
    }


def serialize_schedule(sched: ArenaSchedule, fallback_date: Optional[str] = None) -> dict:
    return {
        'date': fallback_date or sched.date,
        'isClosed': bool(sched.is_closed),
        'closureReason': sched.closure_reason or None,
        'openTime': sched.open_time.strftime('%H:%M'),
        'closeTime': sched.close_time.strftime('%H:%M'),
        'updatedBy': sched.updated_by_identifier or None,
        'updatedAt': to_utc_iso(sched.updated_at),
    }


def serialize_booking(b: Booking, include_pii: bool = True) -> dict:
    payload = {
        'id': b.public_id,
        'courtId': b.court.public_id,
        'courtName': b.court.name,
        'startTime': to_utc_iso(b.start_at),
        'endTime': to_utc_iso(b.end_at),
        'bookingDate': b.booking_date.isoformat(),
        'source': b.source,
        'status': b.status,
        'paymentStatus': b.payment_status,
        'totalPrice': float(b.total_price),
        'discountCode': b.discount_code or None,
        'discountAmount': float(b.discount_amount or 0),
        'equipmentAddons': b.equipment_addons or None,
        'notes': b.notes or None,
        'cancellationReason': b.cancellation_reason or None,
        'cancelledAt': to_utc_iso(b.cancelled_at) if b.cancelled_at else None,
        'createdByStaffId': b.staff_identifier or None,
        'createdAt': to_utc_iso(b.created_at),
        'updatedAt': to_utc_iso(b.updated_at),
    }
    if include_pii:
        payload['customerName'] = b.customer_name
        payload['customerPhone'] = b.customer_phone
        payload['customerEmail'] = b.customer_email or None
    return payload


def serialize_hold(h: SlotHold) -> dict:
    return {
        'id': h.public_id,
        'courtId': h.court.public_id,
        'startTime': to_utc_iso(h.start_at),
        'endTime': to_utc_iso(h.end_at),
        'sessionId': h.session_id,
        'expiresAt': to_utc_iso(h.expires_at),
        'createdAt': to_utc_iso(h.created_at),
    }


def serialize_block(bl: ScheduleBlock) -> dict:
    return {
        'id': bl.public_id,
        'courtId': bl.court.public_id,
        'startTime': to_utc_iso(bl.start_at),
        'endTime': to_utc_iso(bl.end_at),
        'reason': bl.reason,
        'notes': bl.notes or None,
        'createdById': bl.created_by_identifier or None,
        'createdAt': to_utc_iso(bl.created_at),
    }


def serialize_discount(d: DiscountCode) -> dict:
    return {
        'id': d.public_id,
        'code': d.code,
        'type': d.discount_type,
        'value': float(d.value),
        'minBookingAmount': float(d.min_booking_amount),
        'maxUsage': d.max_usage,
        'usageCount': d.usage_count,
        'validTo': to_utc_iso(d.valid_to),
        'isActive': d.is_active,
    }


def serialize_gallery_item(item: GalleryItem, request=None) -> dict:
    src = item.media_url or ''
    if item.media_file:
        url = item.media_file.url
        src = request.build_absolute_uri(url) if request else url
    return {
        'id': item.public_id,
        'type': item.item_type,
        'title': item.title,
        'category': item.category,
        'tag': item.tag or '',
        'src': src,
        'videoSrc': item.video_url or None,
        'aspect': item.aspect,
        'caption': item.caption or '',
        'duration': item.duration or None,
        'isActive': item.is_active,
        'createdAt': to_utc_iso(item.created_at),
    }


def serialize_audit_log(entry: AuditLog) -> dict:
    return {
        'id': entry.public_id,
        'actorId': entry.actor_id_raw,
        'actorRole': entry.actor_role,
        'action': entry.action,
        'entityId': entry.entity_id or None,
        'details': entry.details or {},
        'createdAt': to_utc_iso(entry.created_at),
    }


def get_resolved_schedule(date_str: str) -> dict:
    specific = ArenaSchedule.objects.filter(date=date_str).first()
    if specific:
        return serialize_schedule(specific)
    default_sched = ArenaSchedule.objects.filter(date='DEFAULT').first()
    if default_sched:
        return serialize_schedule(default_sched, fallback_date=date_str)
    return {
        'date': date_str,
        'isClosed': False,
        'closureReason': None,
        'openTime': '06:00',
        'closeTime': '23:00',
        'updatedBy': None,
        'updatedAt': None,
    }


def _check_date_not_closed(start_at: datetime):
    ist_date_str = timezone.localtime(start_at, VENUE_TZ).date().isoformat()
    sched = get_resolved_schedule(ist_date_str)
    if sched['isClosed']:
        reason = sched.get('closureReason') or 'Arena is closed on this date.'
        raise DomainError(f"Arena closed: {reason}", status_code=409)


def get_availability(date_str: str, court_id: Optional[str] = None, viewer_is_staff: bool = False) -> dict:
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        raise DomainError("Invalid date format. Expected YYYY-MM-DD.", status_code=400)

    now = timezone.now()
    pricing = PricingConfig.get_current()
    pricing_data = serialize_pricing(pricing)

    all_active_courts = list(Court.objects.filter(is_active=True))
    courts_qs = [find_court(court_id)] if court_id else all_active_courts
    courts = [c for c in courts_qs if c is not None and c.is_active]

    schedule = get_resolved_schedule(date_str)
    if schedule['isClosed']:
        closed_courts = [
            {
                'courtId': c.public_id,
                'courtNumber': c.court_number,
                'courtName': c.name,
                'basePricePerHour': float(c.price_per_hour),
                'slots': [],
            }
            for c in courts
        ]
        return {
            'success': True,
            'date': date_str,
            'timezone': 'Asia/Kolkata',
            'dataUpdatedAt': to_utc_iso(now),
            'courts': [serialize_court(c) for c in all_active_courts],
            'isClosed': True,
            'closureReason': schedule['closureReason'] or 'Arena closed for holiday / maintenance.',
            'openTime': schedule['openTime'],
            'closeTime': schedule['closeTime'],
            'pricingConfig': pricing_data,
            'slots': [],
            'availability': closed_courts,
        }

    open_time_str = schedule['openTime'] or '06:00'
    close_time_str = schedule['closeTime'] or '23:00'
    open_t = parse_hhmm(open_time_str, dt_time(6, 0))
    close_t = parse_hhmm(close_time_str, dt_time(23, 0))

    start_minutes = open_t.hour * 60 + open_t.minute
    end_minutes = close_t.hour * 60 + close_t.minute
    if end_minutes <= start_minutes:
        end_minutes += 24 * 60

    peak_hours = list(pricing.peak_hours or [])
    is_peak_surge_active = bool(pricing.is_peak_surge_active)
    peak_price = float(pricing.peak_surge_price_per_hour)

    intervals = []
    cur_min = start_minutes
    while cur_min + 60 <= end_minutes:
        s_day_offset = cur_min // 1440
        s_hour = (cur_min % 1440) // 60
        s_min = cur_min % 60
        e_min_total = cur_min + 60
        e_day_offset = e_min_total // 1440
        e_hour = (e_min_total % 1440) // 60
        e_min = e_min_total % 60

        s_label = f"{s_hour:02d}:{s_min:02d}"
        e_label = f"{e_hour:02d}:{e_min:02d}"
        slot_start_dt = build_venue_interval_dt(date_str, s_hour, s_min, s_day_offset)
        slot_end_dt = build_venue_interval_dt(date_str, e_hour, e_min, e_day_offset)
        is_peak = is_peak_surge_active and any(str(ph).startswith(s_label[:2]) for ph in peak_hours)

        intervals.append({
            'start_label': s_label,
            'start_dt': slot_start_dt,
            'end_dt': slot_end_dt,
            'start_iso': to_utc_iso(slot_start_dt),
            'end_iso': to_utc_iso(slot_end_dt),
            'is_peak': is_peak,
            'display_time': f"{s_label} - {e_label}{' (+1d)' if s_day_offset > 0 else ''}",
        })
        cur_min += 60

    if not intervals or not courts:
        window_start = build_venue_interval_dt(date_str, 0, 0, 0)
        window_end = window_start + timedelta(days=2)
    else:
        window_start = intervals[0]['start_dt']
        window_end = intervals[-1]['end_dt']

    court_ids = [c.id for c in courts]
    active_bookings = list(
        Booking.objects.filter(
            court_id__in=court_ids,
            start_at__lt=window_end,
            end_at__gt=window_start,
        ).exclude(status='CANCELLED')
    )
    active_holds = list(
        SlotHold.objects.filter(
            court_id__in=court_ids,
            start_at__lt=window_end,
            end_at__gt=window_start,
            expires_at__gt=now,
        )
    )
    active_blocks = list(
        ScheduleBlock.objects.filter(
            court_id__in=court_ids,
            start_at__lt=window_end,
            end_at__gt=window_start,
        )
    )

    ist_now = timezone.localtime(now, VENUE_TZ)
    ist_today_str = ist_now.date().isoformat()
    ist_time_str = ist_now.strftime('%H:%M')
    is_past_date = date_str < ist_today_str
    is_today = date_str == ist_today_str

    availability = []
    for court in courts:
        c_bookings = [b for b in active_bookings if b.court_id == court.id]
        c_holds = [h for h in active_holds if h.court_id == court.id]
        c_blocks = [bl for bl in active_blocks if bl.court_id == court.id]

        slots = []
        for iv in intervals:
            s_dt = iv['start_dt']
            e_dt = iv['end_dt']
            is_past_slot = s_dt <= now

            matched_booking = next((b for b in c_bookings if b.start_at < e_dt and b.end_at > s_dt), None)
            matched_hold = next((h for h in c_holds if h.start_at < e_dt and h.end_at > s_dt), None)
            matched_block = next((bl for bl in c_blocks if bl.start_at < e_dt and bl.end_at > s_dt), None)

            if is_past_slot:
                slot_status = 'PASSED'
            elif matched_block:
                slot_status = 'BLOCKED'
            elif matched_booking:
                slot_status = 'BOOKED'
            elif matched_hold:
                slot_status = 'HELD'
            else:
                slot_status = 'AVAILABLE'

            slot_price = peak_price if iv['is_peak'] else float(court.price_per_hour or pricing.base_price_per_hour)

            slot_payload = {
                'courtId': court.public_id,
                'courtName': court.name,
                'startTime': iv['start_iso'],
                'endTime': iv['end_iso'],
                'displayTime': iv['display_time'],
                'status': slot_status,
                'price': slot_price,
                'isPeak': iv['is_peak'],
                'heldUntil': to_utc_iso(matched_hold.expires_at) if matched_hold else None,
                'blockReason': matched_block.reason if matched_block else None,
            }
            if viewer_is_staff:
                slot_payload['bookingId'] = matched_booking.public_id if matched_booking else None
                slot_payload['customerName'] = matched_booking.customer_name if matched_booking else None
                slot_payload['customerPhone'] = matched_booking.customer_phone if matched_booking else None
                slot_payload['source'] = matched_booking.source if matched_booking else None
                slot_payload['holdSessionId'] = matched_hold.session_id if matched_hold else None

            slots.append(slot_payload)

        availability.append({
            'courtId': court.public_id,
            'courtNumber': court.court_number,
            'courtName': court.name,
            'basePricePerHour': float(court.price_per_hour),
            'slots': slots,
        })

    target_court_av = (
        next((c for c in availability if c['courtId'] == court_id), None)
        if court_id
        else (availability[0] if availability else None)
    )
    formatted_slots = [
        {
            'slotId': f"{s['courtId']}-{s['startTime']}",
            'timeLabel': s['displayTime'],
            'startTime': s['startTime'],
            'endTime': s['endTime'],
            'isAvailable': s['status'] == 'AVAILABLE',
            'status': s['status'],
            'price': s['price'],
            'isPeak': s['isPeak'],
            'courtId': s['courtId'],
            'courtName': s['courtName'],
            'heldUntil': s['heldUntil'],
        }
        for s in (target_court_av['slots'] if target_court_av else [])
    ]

    latest_ts = max(
        [now]
        + [b.updated_at for b in active_bookings if b.updated_at]
        + [h.created_at for h in active_holds if h.created_at]
    )

    return {
        'success': True,
        'date': date_str,
        'timezone': 'Asia/Kolkata',
        'dataUpdatedAt': to_utc_iso(latest_ts),
        'courts': [serialize_court(c) for c in all_active_courts],
        'isClosed': False,
        'closureReason': None,
        'openTime': open_time_str,
        'closeTime': close_time_str,
        'pricingConfig': pricing_data,
        'slots': formatted_slots,
        'availability': availability,
    }


def _validate_interval(start_at: datetime, end_at: datetime):
    if end_at <= start_at:
        raise DomainError("End time must be after start time.", status_code=400)
    seconds = (end_at - start_at).total_seconds()
    if seconds < MIN_BOOKING_DURATION_SECONDS or seconds > MAX_BOOKING_DURATION_SECONDS:
        raise DomainError("Slot duration must be between 30 minutes and 12 hours.", status_code=400)


def place_hold(court_id_str: str, start_time_str: str, end_time_str: str, session_id: str) -> dict:
    if not session_id or not str(session_id).strip():
        raise DomainError("sessionId is required.", status_code=400)

    start_at = parse_iso_datetime(start_time_str, 'startTime')
    end_at = parse_iso_datetime(end_time_str, 'endTime')
    _validate_interval(start_at, end_at)

    now = timezone.now()
    if start_at <= now:
        raise DomainError("Cannot hold a slot that has already started or passed.", status_code=400)

    _check_date_not_closed(start_at)

    with transaction.atomic():
        court = find_court(court_id_str)
        if not court:
            raise DomainError("Court does not exist.", status_code=404)
        court = Court.objects.select_for_update().get(id=court.id)
        if not court.is_active:
            raise DomainError("Selected court is currently inactive.", status_code=409)

        # Opportunistically clean expired holds for this court
        SlotHold.objects.filter(court=court, expires_at__lte=now).delete()

        if Booking.objects.filter(
            court=court,
            start_at__lt=end_at,
            end_at__gt=start_at,
        ).exclude(status='CANCELLED').exists():
            raise DomainError("Slot is already booked for this interval.", status_code=409)

        if ScheduleBlock.objects.filter(court=court, start_at__lt=end_at, end_at__gt=start_at).exists():
            raise DomainError("Court is blocked for maintenance or private tournament.", status_code=409)

        if SlotHold.objects.filter(
            court=court,
            start_at__lt=end_at,
            end_at__gt=start_at,
            expires_at__gt=now,
        ).exclude(session_id=session_id).exists():
            raise DomainError("Slot is currently held by another active customer.", status_code=409)

        SlotHold.objects.filter(session_id=session_id).delete()
        hold = SlotHold.objects.create(
            external_id=f"hold-{int(time.time() * 1000)}-{uuid.uuid4().hex[:5]}",
            court=court,
            start_at=start_at,
            end_at=end_at,
            session_id=str(session_id).strip(),
            expires_at=now + timedelta(minutes=HOLD_TTL_MINUTES),
        )
        return serialize_hold(hold)


def release_hold(session_id: str, hold_id: Optional[str] = None) -> int:
    if not session_id or not str(session_id).strip():
        raise DomainError("sessionId is required to release a hold.", status_code=400)
    qs = SlotHold.objects.filter(session_id=str(session_id).strip())
    if hold_id:
        qs = qs.filter(Q(external_id=hold_id) | Q(id=int(hold_id[5:]) if hold_id.startswith('hold-') and hold_id[5:].isdigit() else -1))
    deleted_count, _ = qs.delete()
    return deleted_count


def _compute_booking_price(
    court: Court,
    start_at: datetime,
    end_at: datetime,
    discount_code_str: Optional[str],
    equipment_addons: Optional[dict],
    now: datetime,
) -> tuple[Decimal, Decimal, str, Optional[DiscountCode], dict]:
    pricing = PricingConfig.get_current()
    duration_hours = max(1, int(round((end_at - start_at).total_seconds() / 3600)))
    peak_hours = [str(h) for h in (pricing.peak_hours or [])]

    base_price = Decimal('0.00')
    for h in range(duration_hours):
        hour_dt = timezone.localtime(start_at + timedelta(hours=h), VENUE_TZ)
        hour_prefix = f"{hour_dt.hour:02d}"
        is_peak = bool(pricing.is_peak_surge_active) and any(ph.startswith(hour_prefix) for ph in peak_hours)
        unit_price = Decimal(pricing.peak_surge_price_per_hour) if is_peak else Decimal(court.price_per_hour)
        base_price += unit_price

    discount_amount = Decimal('0.00')
    applied_code = ''
    discount_obj = None
    if discount_code_str and str(discount_code_str).strip():
        clean_code = str(discount_code_str).strip().upper()
        disc = DiscountCode.objects.select_for_update().filter(code=clean_code, is_active=True).first()
        if disc and disc.valid_to > now and base_price >= disc.min_booking_amount:
            if disc.max_usage is None or disc.usage_count < disc.max_usage:
                if disc.discount_type == 'PERCENT':
                    discount_amount = (base_price * Decimal(disc.value) / Decimal('100')).quantize(Decimal('0.01'))
                else:
                    discount_amount = Decimal(disc.value)
                applied_code = disc.code
                discount_obj = disc

    clean_addons = {}
    addons_total = Decimal('0.00')
    if isinstance(equipment_addons, dict):
        try:
            paddles = max(0, int(equipment_addons.get('paddles') or 0))
            balls = max(0, int(equipment_addons.get('balls') or 0))
        except (TypeError, ValueError) as exc:
            raise DomainError("Invalid equipment addons quantity.", status_code=400) from exc
        lights = bool(equipment_addons.get('lights'))
        if paddles:
            clean_addons['paddles'] = paddles
            addons_total += Decimal(paddles * 50)
        if balls:
            clean_addons['balls'] = balls
            addons_total += Decimal(balls * 30)
        if lights:
            clean_addons['lights'] = True
            addons_total += Decimal('50')

    final_price = max(Decimal('0.00'), base_price - discount_amount + addons_total)
    return final_price, discount_amount, applied_code, discount_obj, clean_addons


def create_booking(params: dict, actor: Optional[ActorContext]) -> dict:
    court_id_str = params.get('courtId')
    start_time_str = params.get('startTime')
    end_time_str = params.get('endTime')
    customer_name = str(params.get('customerName') or '').strip()
    customer_phone = str(params.get('customerPhone') or '').strip()
    customer_email = (str(params.get('customerEmail')).strip().lower() if params.get('customerEmail') else None)
    notes = str(params.get('notes') or '').strip()
    session_id = str(params.get('sessionId') or '').strip() or None
    discount_code = params.get('discountCode')
    equipment_addons = params.get('equipmentAddons')

    if not all([court_id_str, start_time_str, end_time_str, customer_name, customer_phone]):
        raise DomainError("Missing required booking fields.", status_code=400)

    is_staff = bool(actor and actor.is_staff_member())
    requested_source = str(params.get('source') or 'ONLINE').upper()
    if is_staff and requested_source in ('WALKIN', 'PHONE', 'ONLINE'):
        source = requested_source
    else:
        source = 'ONLINE'

    requested_payment = str(params.get('paymentStatus') or 'PAY_AT_VENUE').upper()
    if requested_payment == 'PAID_ONLINE':
        raise DomainError(
            "Online payment settlement requires verified payment gateway authorization.",
            status_code=400,
        )
    if is_staff and source in ('WALKIN', 'PHONE') and requested_payment in BOOKABLE_PAYMENT_STATUSES:
        payment_status = requested_payment
    else:
        payment_status = 'PAY_AT_VENUE'

    payment_method = (
        'CASH' if payment_status == 'CASH_COUNTER'
        else 'UPI' if payment_status == 'UPI_COUNTER'
        else 'PAY_AT_VENUE'
    )

    start_at = parse_iso_datetime(start_time_str, 'startTime')
    end_at = parse_iso_datetime(end_time_str, 'endTime')
    _validate_interval(start_at, end_at)

    now = timezone.now()
    if start_at <= now:
        raise DomainError("Cannot book a time slot in the past. Please choose an upcoming slot.", status_code=400)

    _check_date_not_closed(start_at)
    actor_user = _resolve_actor_user(actor)

    with transaction.atomic():
        court = find_court(court_id_str)
        if not court:
            raise DomainError("Court does not exist.", status_code=404)
        court = Court.objects.select_for_update().get(id=court.id)
        if not court.is_active:
            raise DomainError("Selected court is currently inactive.", status_code=409)

        SlotHold.objects.filter(court=court, expires_at__lte=now).delete()

        if Booking.objects.filter(
            court=court,
            start_at__lt=end_at,
            end_at__gt=start_at,
        ).exclude(status='CANCELLED').exists():
            raise DomainError("Booking conflict: this court/interval has already been reserved.", status_code=409)

        hold_conflict_qs = SlotHold.objects.filter(
            court=court,
            start_at__lt=end_at,
            end_at__gt=start_at,
            expires_at__gt=now,
        )
        if session_id:
            hold_conflict_qs = hold_conflict_qs.exclude(session_id=session_id)
        if hold_conflict_qs.exists():
            raise DomainError("Slot is currently held by another user in checkout.", status_code=409)

        if ScheduleBlock.objects.filter(court=court, start_at__lt=end_at, end_at__gt=start_at).exists():
            raise DomainError("Court is blocked for maintenance or tournament during this time.", status_code=409)

        final_price, discount_amount, applied_code, disc_obj, clean_addons = _compute_booking_price(
            court=court,
            start_at=start_at,
            end_at=end_at,
            discount_code_str=discount_code,
            equipment_addons=equipment_addons,
            now=now,
        )

        # Link customer user account if caller is CUSTOMER, or if matching email/phone user exists
        customer_user = actor_user if (actor_user and not actor_user.is_staff_member()) else None
        if customer_user is None and customer_email:
            customer_user = User.objects.filter(email__iexact=customer_email).first()

        staff_user = actor_user if is_staff else None
        staff_identifier = actor.actor_id if is_staff else ''
        ext_id = f"BK-{int(time.time() * 1000)}-{uuid.uuid4().hex[:4].upper()}"

        try:
            booking = Booking.objects.create(
                external_id=ext_id,
                court=court,
                user=customer_user,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                start_at=start_at,
                end_at=end_at,
                booking_date=timezone.localtime(start_at, VENUE_TZ).date(),
                start_time=timezone.localtime(start_at, VENUE_TZ).time().replace(tzinfo=None, microsecond=0),
                end_time=timezone.localtime(end_at, VENUE_TZ).time().replace(tzinfo=None, microsecond=0),
                source=source,
                total_price=final_price,
                discount_code=applied_code,
                discount_amount=discount_amount,
                equipment_addons=clean_addons,
                payment_status=payment_status,
                payment_method=payment_method,
                status='CONFIRMED',
                notes=notes,
                created_by_staff=staff_user,
                staff_identifier=staff_identifier,
            )
        except IntegrityError as exc:
            raise DomainError("Booking conflict: this court/interval has already been reserved.", status_code=409) from exc

        if disc_obj:
            DiscountCode.objects.filter(id=disc_obj.id).update(usage_count=F('usage_count') + 1)

        # Clear any overlapping holds on this interval
        SlotHold.objects.filter(court=court, start_at__lt=end_at, end_at__gt=start_at).delete()

        record_audit_log(
            actor=actor,
            action='CREATE_BOOKING',
            entity_id=booking.public_id,
            details={
                'source': source,
                'courtId': court.public_id,
                'startTime': to_utc_iso(start_at),
                'finalPrice': float(final_price),
                'paymentStatus': payment_status,
            },
            fallback_actor_id=normalize_phone_digits(customer_phone) or customer_phone,
            fallback_role='CUSTOMER',
        )

        return serialize_booking(booking, include_pii=True)


def list_bookings_for_actor(actor: ActorContext, phone: Optional[str] = None, date_filter: Optional[str] = None) -> list[dict]:
    if not actor.is_authenticated:
        raise DomainError("Authentication is required.", status_code=401)

    qs = Booking.objects.select_related('court', 'user', 'created_by_staff').all()

    if actor.is_staff_member():
        if phone:
            digits = normalize_phone_digits(phone)
            if digits:
                # Match normalized trailing digits cleanly in Python after coarse DB filter or full scan
                all_rows = list(qs.order_by('-start_at'))
                bookings = [b for b in all_rows if digits in normalize_phone_digits(b.customer_phone)]
            else:
                bookings = []
        else:
            bookings = list(qs.order_by('-start_at'))
    else:
        actor_phone_digits = normalize_phone_digits(actor.phone)
        actor_email = (actor.email or '').strip().lower()
        all_rows = list(qs.order_by('-start_at'))
        bookings = []
        for b in all_rows:
            owns_by_user = bool(actor.user and b.user_id == actor.user.id)
            owns_by_phone = bool(actor_phone_digits and normalize_phone_digits(b.customer_phone) == actor_phone_digits)
            owns_by_email = bool(actor_email and (b.customer_email or '').strip().lower() == actor_email)
            if owns_by_user or owns_by_phone or owns_by_email:
                bookings.append(b)

    if date_filter:
        bookings = [
            b for b in bookings
            if timezone.localtime(b.start_at, VENUE_TZ).date().isoformat() == date_filter
        ]

    return [serialize_booking(b, include_pii=True) for b in bookings]


def update_booking_payment_status(booking_id_str: str, new_payment_status: str, actor: ActorContext) -> dict:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)

    clean_status = str(new_payment_status or '').upper()
    if clean_status not in STAFF_UPDATABLE_PAYMENT_STATUSES:
        raise DomainError(
            "Invalid paymentStatus. Allowed values: CASH_COUNTER, UPI_COUNTER, PAID_ONLINE.",
            status_code=400,
        )

    with transaction.atomic():
        booking = find_booking(booking_id_str)
        if not booking:
            raise DomainError("Booking not found.", status_code=404)
        booking = Booking.objects.select_for_update().select_related('court').get(id=booking.id)
        if booking.status == 'CANCELLED':
            raise DomainError("Cannot record payment on a cancelled booking.", status_code=400)

        prev = booking.payment_status
        booking.payment_status = clean_status
        booking.payment_method = (
            'CASH' if clean_status == 'CASH_COUNTER'
            else 'UPI' if clean_status == 'UPI_COUNTER'
            else 'RAZORPAY'
        )
        booking.save(update_fields=['payment_status', 'payment_method', 'updated_at'])

        record_audit_log(
            actor=actor,
            action='UPDATE_PAYMENT_STATUS',
            entity_id=booking.public_id,
            details={'previous': prev, 'newStatus': clean_status},
        )
        return serialize_booking(booking, include_pii=True)


def _actor_owns_booking(actor: ActorContext, booking: Booking) -> bool:
    if actor.user and booking.user_id == actor.user.id:
        return True
    actor_phone = normalize_phone_digits(actor.phone)
    booking_phone = normalize_phone_digits(booking.customer_phone)
    actor_email = (actor.email or '').strip().lower()
    booking_email = (booking.customer_email or '').strip().lower()
    if actor_phone and booking_phone and actor_phone == booking_phone:
        return True
    if actor_email and booking_email and actor_email == booking_email:
        return True
    return False


def cancel_booking(booking_id_str: str, reason: str, actor: ActorContext) -> dict:
    if not actor.is_authenticated:
        raise DomainError("Authentication required to cancel a booking.", status_code=401)

    with transaction.atomic():
        booking = find_booking(booking_id_str)
        if not booking:
            if not actor.is_staff_member():
                raise DomainError("Forbidden: you do not have permission to cancel this booking.", status_code=403)
            raise DomainError("Booking not found.", status_code=404)

        booking = Booking.objects.select_for_update().select_related('court', 'user').get(id=booking.id)

        if not actor.is_staff_member() and not _actor_owns_booking(actor, booking):
            raise DomainError("Forbidden: you do not have permission to cancel this booking.", status_code=403)

        if booking.status == 'CANCELLED':
            raise DomainError("Booking is already cancelled.", status_code=400)

        now = timezone.now()
        hours_diff = (booking.start_at - now).total_seconds() / 3600.0
        if not actor.is_staff_member() and hours_diff < 2.0:
            raise DomainError(
                "Self-service cancellation is unavailable within 2 hours of slot start. Please contact venue reception for assistance.",
                status_code=400,
            )

        prev_payment_status = booking.payment_status
        manual_refund_review = prev_payment_status in ('PAID_ONLINE', 'PAID')

        booking.status = 'CANCELLED'
        booking.cancellation_reason = str(reason or 'Cancelled').strip()
        booking.cancelled_at = now
        booking.save(update_fields=['status', 'cancellation_reason', 'cancelled_at', 'updated_at'])

        record_audit_log(
            actor=actor,
            action='CANCEL_BOOKING',
            entity_id=booking.public_id,
            details={
                'reason': booking.cancellation_reason,
                'hoursBeforeStart': round(hours_diff, 2),
                'previousPaymentStatus': prev_payment_status,
                'manualRefundReviewRequired': manual_refund_review,
            },
        )
        return serialize_booking(booking, include_pii=True)


def create_schedule_block(
    court_id_str: str,
    start_time_str: str,
    end_time_str: str,
    reason: str,
    notes: str,
    actor: ActorContext,
) -> dict:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)

    clean_reason = str(reason or 'MAINTENANCE').upper()
    if clean_reason not in VALID_BLOCK_REASONS:
        raise DomainError("Invalid schedule block reason.", status_code=400)

    start_at = parse_iso_datetime(start_time_str, 'startTime')
    end_at = parse_iso_datetime(end_time_str, 'endTime')
    if end_at <= start_at:
        raise DomainError("Block end time must be after start time.", status_code=400)

    with transaction.atomic():
        court = find_court(court_id_str)
        if not court:
            raise DomainError("Court not found.", status_code=404)
        court = Court.objects.select_for_update().get(id=court.id)

        block = ScheduleBlock.objects.create(
            external_id=f"block-{int(time.time() * 1000)}-{uuid.uuid4().hex[:4]}",
            court=court,
            start_at=start_at,
            end_at=end_at,
            reason=clean_reason,
            notes=str(notes or '').strip(),
            created_by=_resolve_actor_user(actor),
            created_by_identifier=actor.actor_id,
        )
        # Clear overlapping holds when staff blocks a court
        SlotHold.objects.filter(court=court, start_at__lt=end_at, end_at__gt=start_at).delete()

        record_audit_log(
            actor=actor,
            action='CREATE_SCHEDULE_BLOCK',
            entity_id=block.public_id,
            details={'courtId': court.public_id, 'reason': clean_reason, 'startTime': to_utc_iso(start_at), 'endTime': to_utc_iso(end_at)},
        )
        return serialize_block(block)


def update_pricing_config(params: dict, actor: ActorContext) -> dict:
    if not actor.is_owner():
        raise DomainError("Forbidden: Owner access required.", status_code=403)

    with transaction.atomic():
        cfg = PricingConfig.get_current()
        if params.get('basePricePerHour') is not None:
            val = Decimal(str(params['basePricePerHour']))
            if val < 0:
                raise DomainError("basePricePerHour cannot be negative.", status_code=400)
            cfg.base_price_per_hour = val
            Court.objects.all().update(price_per_hour=val)
        if params.get('peakSurgePricePerHour') is not None:
            val = Decimal(str(params['peakSurgePricePerHour']))
            if val < 0:
                raise DomainError("peakSurgePricePerHour cannot be negative.", status_code=400)
            cfg.peak_surge_price_per_hour = val
        if isinstance(params.get('peakHours'), list):
            cfg.peak_hours = [str(h) for h in params['peakHours']]
        if params.get('isPeakSurgeActive') is not None:
            cfg.is_peak_surge_active = bool(params['isPeakSurgeActive'])

        cfg.updated_by = _resolve_actor_user(actor)
        cfg.updated_by_identifier = actor.actor_id
        cfg.save()

        serialized = serialize_pricing(cfg)
        record_audit_log(actor=actor, action='UPDATE_PRICING_CONFIG', details=serialized)
        return serialized


def upsert_schedule(params: dict, actor: ActorContext) -> dict:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)

    date_val = str(params.get('date') or '').strip()
    if not date_val:
        raise DomainError("date is required.", status_code=400)
    if date_val != 'DEFAULT' and not re.match(r'^\d{4}-\d{2}-\d{2}$', date_val):
        raise DomainError("Invalid schedule date format. Use YYYY-MM-DD or DEFAULT.", status_code=400)

    is_closed = bool(params.get('isClosed', False))
    open_t = parse_hhmm(params.get('openTime') or '06:00', dt_time(6, 0))
    close_t = parse_hhmm(params.get('closeTime') or '23:00', dt_time(23, 0))
    closure_reason = str(params.get('closureReason') or '').strip() or None

    with transaction.atomic():
        sched, _ = ArenaSchedule.objects.update_or_create(
            date=date_val,
            defaults={
                'is_closed': is_closed,
                'closure_reason': closure_reason,
                'open_time': open_t,
                'close_time': close_t,
                'updated_by': _resolve_actor_user(actor),
                'updated_by_identifier': actor.actor_id,
            },
        )
        serialized = serialize_schedule(sched)
        record_audit_log(
            actor=actor,
            action='SET_ARENA_HOLIDAY' if is_closed else 'SET_ARENA_HOURS',
            entity_id=date_val,
            details=serialized,
        )
        return serialized


def get_financial_report() -> dict:
    now = timezone.now()
    valid_qs = Booking.objects.exclude(status='CANCELLED').exclude(payment_status='REFUNDED')

    online_rev = float(valid_qs.filter(payment_status__in=['PAID_ONLINE', 'PAID']).aggregate(s=Sum('total_price'))['s'] or 0)
    cash_rev = float(valid_qs.filter(payment_status='CASH_COUNTER').aggregate(s=Sum('total_price'))['s'] or 0)
    upi_rev = float(valid_qs.filter(payment_status='UPI_COUNTER').aggregate(s=Sum('total_price'))['s'] or 0)
    realized_revenue = online_rev + cash_rev + upi_rev

    pending_rev = float(valid_qs.filter(payment_status__in=PENDING_PAYMENT_STATUSES).aggregate(s=Sum('total_price'))['s'] or 0)
    gross_booked = float(valid_qs.aggregate(s=Sum('total_price'))['s'] or 0)

    total_bookings = valid_qs.count()
    active_holds_count = SlotHold.objects.filter(expires_at__gt=now).count()
    courts_count = Court.objects.count()

    latest_booking = Booking.objects.order_by('-updated_at').values_list('updated_at', flat=True).first()
    data_updated_at = to_utc_iso(latest_booking or now)

    pickleball_db_payload = {
        'database': 'POSTGRESQL_DJANGO',
        'totalBookings': total_bookings,
        'realizedRevenue': realized_revenue,
        'totalRevenue': realized_revenue,
        'grossBookedValue': gross_booked,
        'pendingVenuePayment': pending_rev,
        'onlineRevenue': online_rev,
        'cashRevenue': cash_rev,
        'upiCounterRevenue': upi_rev,
        'channelBreakdown': {
            'online': valid_qs.filter(source='ONLINE').count(),
            'phone': valid_qs.filter(source='PHONE').count(),
            'walkin': valid_qs.filter(source='WALKIN').count(),
        },
        'courtsCount': courts_count,
        'activeHoldsCount': active_holds_count,
        'dataUpdatedAt': data_updated_at,
    }

    return {
        'success': True,
        'timestamp': to_utc_iso(now),
        'summary': {
            'grandTotalRevenue': realized_revenue,
            'realizedRevenue': realized_revenue,
            'grossBookedValue': gross_booked,
            'pendingVenuePayment': pending_rev,
            'totalCashReconciliation': cash_rev,
            'totalUpiReconciliation': upi_rev,
            'totalOnlineReconciliation': online_rev,
            'totalBookings': total_bookings,
            'confirmedBookings': total_bookings,
            'activeHolds': active_holds_count,
        },
        'pickleballDatabase': pickleball_db_payload,
    }


def save_uploaded_media(file_obj, request=None) -> str:
    ext = os.path.splitext(file_obj.name or '')[1].lower()
    allowed_exts = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.mp4', '.webm', '.mov'}
    if ext not in allowed_exts:
        raise DomainError(
            "Unsupported file type. Upload JPG, PNG, WebP, GIF, MP4, WebM, or MOV.",
            status_code=400,
        )
    max_size = 15 * 1024 * 1024
    if file_obj.size > max_size:
        raise DomainError("File size exceeds 15MB maximum limit.", status_code=400)

    safe_name = f"gallery/{int(time.time())}-{uuid.uuid4().hex[:8]}{ext}"
    saved_path = default_storage.save(safe_name, file_obj)
    url = default_storage.url(saved_path)
    return request.build_absolute_uri(url) if request else url


def list_courts(include_inactive: bool = False) -> list[dict]:
    qs = Court.objects.all() if include_inactive else Court.objects.filter(is_active=True)
    return [serialize_court(c) for c in qs]


def create_court(params: dict, actor: ActorContext) -> dict:
    if not actor.is_owner():
        raise DomainError("Forbidden: Owner access required.", status_code=403)
    name = str(params.get('name') or '').strip()
    if not name:
        raise DomainError("Court name is required.", status_code=400)
    raw_price = params.get('basePricePerHour', 400)
    try:
        price = Decimal(str(raw_price))
        if price <= 0:
            raise ValueError
    except (TypeError, ValueError) as exc:
        raise DomainError("basePricePerHour must be a positive number.", status_code=400) from exc

    max_num = Court.objects.order_by('-court_number').values_list('court_number', flat=True).first() or 0
    ext_id = f"court-{int(time.time() * 1000)}"
    try:
        with transaction.atomic():
            court = Court.objects.create(
                external_id=ext_id,
                court_number=int(params.get('courtNumber') or (max_num + 1)),
                name=name,
                surface_type=str(params.get('surfaceType') or 'Pickleball Court').strip(),
                is_indoor=bool(params.get('isIndoor', True)),
                price_per_hour=price,
                is_active=bool(params.get('isActive', True)),
            )
            serialized = serialize_court(court)
            record_audit_log(actor=actor, action='ADD_COURT', entity_id=court.public_id, details={'newCourt': serialized})
            return serialized
    except IntegrityError as exc:
        raise DomainError(f"A court named '{name}' already exists.", status_code=409) from exc


def update_court(court_id_str: str, params: dict, actor: ActorContext) -> dict:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)
    if not court_id_str:
        raise DomainError("courtId is required.", status_code=400)

    is_owner = actor.is_owner()
    if not is_owner:
        forbidden = [k for k, v in params.items() if k != 'isActive' and v is not None]
        if forbidden:
            raise DomainError("Access denied: only the owner can modify court pricing or configuration.", status_code=403)
        if not isinstance(params.get('isActive'), bool):
            raise DomainError("isActive boolean is required.", status_code=400)

    with transaction.atomic():
        court = find_court(court_id_str)
        if not court:
            raise DomainError("Court not found.", status_code=404)
        court = Court.objects.select_for_update().get(id=court.id)

        if is_owner:
            if params.get('name') is not None:
                court.name = str(params['name']).strip()
            if params.get('basePricePerHour') is not None:
                try:
                    price = Decimal(str(params['basePricePerHour']))
                    if price <= 0:
                        raise ValueError
                    court.price_per_hour = price
                except (TypeError, ValueError) as exc:
                    raise DomainError("basePricePerHour must be a positive number.", status_code=400) from exc
            if params.get('surfaceType') is not None:
                court.surface_type = str(params['surfaceType']).strip()
            if params.get('isIndoor') is not None:
                court.is_indoor = bool(params['isIndoor'])
        if params.get('isActive') is not None:
            court.is_active = bool(params['isActive'])

        court.save()
        serialized = serialize_court(court)
        record_audit_log(actor=actor, action='UPDATE_COURT', entity_id=court.public_id, details={'updates': params})
        return serialized


def delete_court(court_id_str: str, actor: ActorContext) -> None:
    if not actor.is_owner():
        raise DomainError("Forbidden: Owner access required.", status_code=403)
    if not court_id_str:
        raise DomainError("courtId is required.", status_code=400)

    with transaction.atomic():
        court = find_court(court_id_str)
        if not court:
            raise DomainError("Court not found.", status_code=404)
        has_future_bookings = Booking.objects.filter(
            court=court,
            start_at__gt=timezone.now(),
        ).exclude(status='CANCELLED').exists()
        if has_future_bookings:
            raise DomainError("Cannot delete a court that still has upcoming active bookings.", status_code=409)
        pub_id = court.public_id
        court.delete()
        record_audit_log(actor=actor, action='DELETE_COURT', entity_id=pub_id, details={})


def list_gallery_items(include_inactive: bool = False, request=None) -> list[dict]:
    qs = GalleryItem.objects.all() if include_inactive else GalleryItem.objects.filter(is_active=True)
    return [serialize_gallery_item(item, request=request) for item in qs]


def create_gallery_item(params: dict, actor: ActorContext, request=None) -> dict:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)
    title = str(params.get('title') or '').strip()
    src = str(params.get('src') or params.get('media_url') or '').strip()
    if not title or not src:
        raise DomainError("Title and media source (photo URL/poster) are required.", status_code=400)

    item_type = str(params.get('type') or params.get('item_type') or 'image').lower()
    if item_type not in ('image', 'video'):
        item_type = 'image'
    category = str(params.get('category') or 'matchplay').lower()
    if category not in ('matchplay', 'gear', 'training', 'tournament'):
        category = 'matchplay'
    aspect = str(params.get('aspect') or 'tall').lower()
    if aspect not in ('tall', 'square', 'standard'):
        aspect = 'tall'

    ext_id = f"gal-{int(time.time() * 1000)}-{uuid.uuid4().hex[:4]}"
    item = GalleryItem.objects.create(
        external_id=ext_id,
        title=title,
        item_type=item_type,
        category=category,
        tag=str(params.get('tag') or '').strip(),
        media_url=src,
        video_url=str(params.get('videoSrc') or params.get('video_url') or '').strip() or None,
        aspect=aspect,
        caption=str(params.get('caption') or '').strip(),
        duration=str(params.get('duration') or '').strip(),
        is_active=True,
    )
    serialized = serialize_gallery_item(item, request=request)
    record_audit_log(actor=actor, action='ADD_GALLERY_ITEM', entity_id=item.public_id, details={'newItem': serialized})
    return serialized


def update_gallery_item(item_id_str: str, params: dict, actor: ActorContext, request=None) -> dict:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)
    item = find_gallery_item(item_id_str)
    if not item:
        raise DomainError("Gallery item not found.", status_code=404)

    for json_key, model_field in (
        ('title', 'title'),
        ('type', 'item_type'),
        ('item_type', 'item_type'),
        ('category', 'category'),
        ('tag', 'tag'),
        ('src', 'media_url'),
        ('media_url', 'media_url'),
        ('videoSrc', 'video_url'),
        ('video_url', 'video_url'),
        ('aspect', 'aspect'),
        ('caption', 'caption'),
        ('duration', 'duration'),
        ('isActive', 'is_active'),
        ('is_active', 'is_active'),
    ):
        if json_key in params and params[json_key] is not None:
            setattr(item, model_field, params[json_key])
    item.save()
    serialized = serialize_gallery_item(item, request=request)
    record_audit_log(actor=actor, action='UPDATE_GALLERY_ITEM', entity_id=item.public_id, details={'updates': params})
    return serialized


def delete_gallery_item(item_id_str: str, actor: ActorContext) -> None:
    if not actor.is_staff_member():
        raise DomainError("Forbidden: Staff or Owner access required.", status_code=403)
    item = find_gallery_item(item_id_str)
    if not item:
        raise DomainError("Gallery item not found.", status_code=404)
    pub_id = item.public_id
    item.delete()
    record_audit_log(actor=actor, action='DELETE_GALLERY_ITEM', entity_id=pub_id, details={})


def authenticate_with_credentials(identifier: str, password: str) -> dict:
    if not identifier or not password:
        raise DomainError("Identifier (email/phone) and password are required.", status_code=400)

    clean_id = str(identifier).strip().lower()
    clean_phone = normalize_phone_digits(identifier)

    user = None
    if '@' in clean_id:
        user = User.objects.filter(email__iexact=clean_id).first()
    elif clean_phone and len(clean_phone) >= 10:
        for candidate in User.objects.exclude(phone__isnull=True):
            if normalize_phone_digits(candidate.phone) == clean_phone:
                user = candidate
                break
    if not user:
        user = User.objects.filter(username__iexact=str(identifier).strip()).first()

    if not user or not user.is_active or not user.check_password(password):
        raise DomainError("Invalid email/phone or password.", status_code=401)

    redirect_url = '/admin' if user.is_owner() else '/staff' if user.is_staff_member() else '/profile'
    return {
        'success': True,
        'user': serialize_user(user),
        'role': user.role,
        'redirectUrl': redirect_url,
    }


def find_or_create_google_user(email: str, name: str, avatar: Optional[str] = None, google_id: Optional[str] = None) -> dict:
    clean_email = str(email or '').strip().lower()
    if not clean_email or '@' not in clean_email:
        raise DomainError("Valid email address is required.", status_code=400)

    user = User.objects.filter(email__iexact=clean_email).first()
    if user:
        updated_fields = []
        if avatar and not user.profile_photo:
            user.profile_photo = avatar
            updated_fields.append('profile_photo')
        if google_id and not user.google_id:
            user.google_id = google_id
            updated_fields.append('google_id')
        if name and not user.first_name and not user.last_name:
            parts = name.strip().split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''
            updated_fields.extend(['first_name', 'last_name'])
        if updated_fields:
            user.save(update_fields=updated_fields)
    else:
        owner_emails = [e.strip().lower() for e in (os.getenv('OWNER_EMAILS') or os.getenv('OWNER_EMAIL') or '').split(',') if e.strip()]
        staff_emails = [e.strip().lower() for e in (os.getenv('STAFF_EMAILS') or '').split(',') if e.strip()]
        role = 'OWNER' if clean_email in owner_emails else 'EMPLOYEE' if clean_email in staff_emails else 'CUSTOMER'

        parts = (name or clean_email.split('@')[0]).strip().split(' ', 1)
        base_username = re.sub(r'[^a-zA-Z0-9._-]', '', clean_email.split('@')[0])[:24] or 'player'
        username = base_username
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{uuid.uuid4().hex[:4]}"

        user = User.objects.create(
            external_id=f"usr-google-{int(time.time() * 1000)}-{uuid.uuid4().hex[:4]}",
            username=username,
            email=clean_email,
            first_name=parts[0][:150],
            last_name=(parts[1][:150] if len(parts) > 1 else ''),
            role=role,
            phone=None,
            profile_photo=avatar or None,
            google_id=google_id or None,
        )
        user.set_unusable_password()
        user.save(update_fields=['password'])

    redirect_url = '/admin' if user.is_owner() else '/staff' if user.is_staff_member() else '/profile'
    return {
        'success': True,
        'user': serialize_user(user),
        'role': user.role,
        'redirectUrl': redirect_url,
    }


def list_all_schedules() -> list[dict]:
    return [serialize_schedule(s) for s in ArenaSchedule.objects.all().order_by('date')]


def get_health_status(strict: bool = False) -> tuple[dict, int]:
    from django.db import connection

    db_info = {'status': 'error', 'vendor': connection.vendor}
    t0 = time.monotonic()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        db_info['status'] = 'ok'
        db_info['latencyMs'] = round((time.monotonic() - t0) * 1000, 2)
    except Exception:
        db_info['status'] = 'unavailable'

    redis_url = getattr(settings, 'REDIS_URL', '') or ''
    redis_info = {'status': 'unconfigured'}
    if redis_url:
        t1 = time.monotonic()
        try:
            import redis as redis_lib
            client = redis_lib.Redis.from_url(redis_url, socket_connect_timeout=1.5, socket_timeout=1.5)
            client.ping()
            redis_info = {'status': 'ok', 'latencyMs': round((time.monotonic() - t1) * 1000, 2)}
        except Exception:
            redis_info = {'status': 'unavailable'}

    celery_info = {'status': 'unavailable', 'workersOnline': 0}
    if redis_info.get('status') == 'ok':
        try:
            from boss_backend.celery import app as celery_app
            inspector = celery_app.control.inspect(timeout=1.0)
            pong = inspector.ping() or {}
            workers = len(pong)
            celery_info = {
                'status': 'ok' if workers > 0 else 'degraded',
                'workersOnline': workers,
            }
        except Exception:
            celery_info = {'status': 'degraded', 'workersOnline': 0}
    elif not redis_url:
        celery_info = {'status': 'unconfigured', 'workersOnline': 0}

    db_ok = db_info['status'] == 'ok'
    redis_ok = redis_info['status'] in ('ok', 'unconfigured')
    celery_ok = celery_info['status'] in ('ok', 'unconfigured')

    overall = 'ok' if (db_ok and redis_ok and celery_ok) else ('unhealthy' if not db_ok else 'degraded')
    http_status = 503 if (not db_ok or (strict and overall != 'ok')) else 200

    return {
        'status': overall,
        'timezone': 'Asia/Kolkata',
        'timestamp': to_utc_iso(timezone.now()),
        'checks': {
            'database': db_info,
            'redis': redis_info,
            'celery': celery_info,
        },
    }, http_status

