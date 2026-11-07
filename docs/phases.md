# Delivery Phases — Pickleball Court & Gym Booking Platform

## Phase 0 — Confirm operations and scope

- Observe how the owner and employees currently take, record, change, and cancel bookings.
- Confirm courts, operating hours, slot increments, durations, prices, peak periods, payment methods, and policies.
- Check whether the current third-party booking platform offers an availability or booking integration.
- Decide which gym workflows belong in the first release.
- Confirm provider fees, hosting costs, and who owns the domain and service accounts.

**Exit:** approved workflow, policy list, initial release scope, and cost estimate.

## Phase 1 — Shared pickleball calendar and staff booking

- Build court and operating-hours configuration.
- Build staff schedule and fast phone/walk-in booking flow.
- Record customer contact, source, creator, and payment status.
- Support blocks for maintenance, events, and private use.
- Add booking history and activity log.
- Protect writes against overlapping bookings.

**Exit:** staff can enter a phone booking and it prevents the same court/time from being booked again in the system.

## Phase 2 — Customer website and online payments

- Publish mobile-friendly availability and pricing.
- Add customer booking, temporary holds, checkout, and verified payment confirmation.
- Add booking detail, cancellation/reschedule rules, receipts, and notifications.
- Ensure changes appear to staff and customers promptly.

**Exit:** online and staff bookings use the same calendar and payment records are reconciled.

## Phase 3 — Owner self-service controls

- Add owner-managed pricing by court, day, and time.
- Add discounts and promo codes with validity dates and eligibility rules.
- Add closures, operating hours, booking windows, cancellation/refund policies, and staff accounts.
- Add reports for revenue, channel, occupancy, payments, and refunds.

**Exit:** owner can make routine operating changes from the admin panel without developer intervention.

## Phase 4 — Gym operations

- Add membership plans and member records.
- Add renewals, expiry, freeze/extend workflows, attendance, and dues.
- Add gym payment history and relevant reports.

**Exit:** registrar can manage agreed gym workflows with role-appropriate access.

## Phase 5 — Extensions based on usage

Consider coaching/class bookings, tournaments, waitlists, packages, loyalty/referrals, local discovery integrations, and a native app only after the core system is working and usage justifies them.

## Launch and handover

- Import only the data needed and verify it with the owner.
- Configure production domain, payment and messaging credentials, backups, and access recovery.
- Train owner and staff using their real booking workflow.
- Run a short parallel operating period if the existing system must remain available, with a clearly designated source of truth.
- Hand over account ownership and a concise operating guide.
