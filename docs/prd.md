# Product Requirements Document — Pickleball Court & Gym Booking Platform

## 1. Summary

Create a self-service booking and management website for a local pickleball venue and its same-owner gym. Customers book online; employees handle phone and walk-in bookings. Both channels share one calendar and cannot independently sell the same court/time. The owner manages prices, promotions, schedule, policies, staff, and reports through an admin panel.

## 2. Problem

The current third-party booking path costs customers more than the venue's stated hourly price. The venue also accepts bookings by phone and in person, which requires staff to track availability. Separate booking records can create confusion or double bookings. Routine business changes should not require a developer.

## 3. Goals

- Give customers clear availability and transparent pricing before they book.
- Let staff create and update phone/walk-in bookings in seconds.
- Synchronize all channels through a single source of truth.
- Prevent overlapping confirmed bookings.
- Give the owner direct control over day-to-day pricing, discounts, schedules, and rules.
- Provide a foundation for gym membership administration.

## 4. Non-goals for the first release

- Native mobile applications.
- Tournament brackets, loyalty points, referrals, and social media integrations.
- Replacing a payment gateway or guaranteeing zero payment fees.
- Complex multi-branch operations unless confirmed as an immediate need.

## 5. Users and permissions

| Role | Primary needs | Access |
|---|---|---|
| Customer | Find a slot, book, pay, manage own bookings | Own profile and bookings |
| Staff | Handle calls and walk-ins, resolve booking changes | Bookings and customer lookup; no owner-only settings |
| Registrar | Manage gym memberships and attendance | Gym records and payments as authorized |
| Owner | Configure and oversee the business | Full settings, users, bookings, and reports |

## 6. Functional requirements

### Pickleball availability and booking

- Show availability by date, court, and duration.
- Support multiple courts and owner-configurable operating hours and slot durations.
- Show the final price before confirmation, including applicable discount and fees.
- Temporarily hold a slot during online checkout; expire the hold if checkout is abandoned.
- Create bookings from online, phone, and walk-in sources.
- Record booking status, payment status, source, customer contact, and creating staff/user.
- Allow authorized users to move, edit, cancel, or block time, with a reason recorded.
- Apply owner-defined cancellation, reschedule, advance booking, and no-show policies.
- Update availability for all users after a booking or change.

### Payments and notifications

- Support the selected payment gateway and configured payment methods.
- Confirm online payment from verified gateway events.
- Record cash, UPI-at-counter, pay-at-venue, refund, and pending states where enabled.
- Send confirmation and configured reminders by selected channel.
- Provide a receipt or payment record and an auditable payment history.

### Owner administration

- Manage courts, hours, closures, and schedule blocks.
- Set base prices and optional day/time/court variations.
- Create fixed or percentage discounts with validity and usage rules.
- Configure policies and booking limits.
- Create staff accounts and assign roles.
- Review activity history and operational reports.

### Gym (scope to confirm)

- Display membership plans and membership status.
- Let authorized staff maintain member records, renewals, freezes/extensions, attendance, and dues.
- Track payment history and expiry.

## 7. Core business rules

- One confirmed booking occupies a given court for its booked time interval.
- Two requests that overlap the same court/time cannot both be confirmed.
- A temporary hold is time-limited and does not count as a confirmed booking after expiry.
- Staff and online bookings use the same availability and conflict checks.
- Owner-defined price/policy changes apply according to an explicit effective-time rule; existing bookings retain their recorded price and terms.
- Every staff/admin change to bookings, payments, pricing, or memberships records actor and timestamp.

## 8. Success measures

- Phone bookings can be entered quickly during a call.
- No duplicate confirmed bookings occur in the platform for the same court/time.
- Staff can see online bookings and customers see staff-entered bookings promptly.
- Owner can update price and discounts without code changes.
- Booking completion, occupancy, cancellation, payment collection, and channel mix can be reviewed in reports.

## 9. Dependencies and open questions

- Current third-party platform integration or migration path.
- Final gateway, notification providers, and their costs/requirements.
- Exact court count, schedules, durations, pricing, cancellation rules, and tax/fee display.
- First-release gym scope and existing data migration needs.
- Production account ownership, support responsibility, and backup/retention expectations.
