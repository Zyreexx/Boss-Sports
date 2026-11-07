# Design — Pickleball Court & Gym Booking Platform

## Product direction

Build a mobile-first website with three clear surfaces backed by one booking system:

- **Customer site:** discover availability, book pickleball courts, pay, and manage bookings; browse gym plans.
- **Staff panel:** handle phone and walk-in bookings quickly, and manage gym records when authorized.
- **Owner panel:** control prices, discounts, schedules, policies, staff access, and reports without developer help.

The shared calendar is the central design constraint. Online, phone, and walk-in bookings must all read and update the same source of truth so that a slot booked by staff disappears online immediately.

## Information architecture

### Customer site

- Home: venue details, pickleball and gym entry points, location, contact information.
- Pickleball: choose date, court, duration, and available time; review price; book and pay.
- Gym: view plans, membership details, and purchase or renewal options.
- My bookings/membership: upcoming and past bookings, payment status, cancellation or reschedule actions allowed by policy.

### Staff panel

- Today view: compact schedule grouped by court and time, with online/phone/walk-in source labels.
- Quick booking: select court and time, enter customer name and phone, choose payment status, save.
- Booking detail: edit, move, cancel with reason, record payment, and send confirmation.
- Registrar tools: member lookup, plan updates, dues, and attendance, subject to role permissions.

### Owner panel

- Dashboard and reports.
- Court setup, operating hours, closures, and schedule blocks.
- Pricing, peak/off-peak rules, promotions, packages, and booking policies.
- Staff accounts, roles, and activity history.
- Gym plans and membership settings.

## Key flows

### Online court booking

1. Customer selects date, duration, and court preference.
2. Show current availability and the complete price before checkout.
3. Temporarily hold the selected court/time while payment is completed.
4. Confirm only after the verified payment result; release the hold on failure or expiry.
5. Show confirmation and send configured notification.

### Call or walk-in booking

1. Staff checks the same live calendar used by customers.
2. Staff selects a free court/time, enters customer details, source, and payment status.
3. Save the booking atomically; update the calendar across all surfaces.
4. Offer a confirmation message to the customer.

## Interaction and visual principles

- Optimize the booking and quick-book flows for phone screens and rapid use at the counter.
- Make availability, price, payment status, and booking source easy to scan.
- Use clear statuses such as Available, Held, Booked, Blocked, Payment pending, and Cancelled.
- Confirm consequential actions such as cancellation, court closure, or moving a booking; explain effects on affected customers.
- Keep owner settings as ordinary forms with previews and validation; routine price or discount changes must not require code edits.
- Use accessible labels, keyboard operation, sufficient contrast, and readable text sizes.
- Use a consistent visual system across customer and staff surfaces while giving staff views a denser schedule layout.

## Design decisions to settle during implementation

- Whether customers choose a specific court or only a time and let staff assign the court.
- Exact slot increments, durations, and booking horizon.
- Whether the business permits partial payment, pay-at-venue, or only full online payment.
- Venue branding, language, and notification channel preferences.
