# Project Rules — Pickleball Court & Gym Booking Platform

## Product rules

1. The shared booking database is the source of truth for online, phone, and walk-in bookings.
2. Never show a court/time as bookable if it is confirmed, blocked, or held by an active checkout/staff operation.
3. Keep booking source explicit: `online`, `phone`, or `walk-in`.
4. Show the customer the total price and payment terms before they commit.
5. The owner can manage everyday prices, discounts, availability, and policies from the product UI.
6. Preserve the agreed price and policy snapshot on an existing booking when future settings change.
7. Keep customer and payment details visible only to roles that need them.

## Booking and payment rules

- Treat court intervals as ranges; reject any overlap for the same court, not only identical start times.
- Use a database transaction/constraint or equivalent atomic conflict check when confirming or staff-booking a slot.
- A Redis lock may support short-lived holds, but PostgreSQL remains the durable authority.
- Verify payment status with a trusted gateway webhook before marking an online booking paid/confirmed.
- Make payment webhook processing idempotent so retries cannot create duplicate bookings or payment records.
- Expire unpaid holds automatically and safely release availability.
- Require a reason for staff/admin cancellation or significant booking changes.
- Do not silently claim automatic refunds unless the gateway flow and refund result are confirmed.

## Access and audit rules

- Enforce authorization on the server/API for every protected action; hiding a button is not authorization.
- Owner-only actions include pricing, discounts, staff permissions, and financial reports unless explicitly delegated.
- Staff and registrar roles receive only the permissions needed for their duties.
- Record actor, action, target, and timestamp for changes to bookings, memberships, payments, and configuration.
- Protect OTP and login endpoints with rate limits; never log passwords, OTPs, or payment secrets.

## Operations rules

- Keep provider credentials in environment secrets, never in source control or client bundles.
- Use separate staging and production configuration.
- Back up the production database and document how to restore it.
- If an external booking system remains active, define and communicate the source-of-truth procedure before launch.
- Treat availability updates as eventually refreshed UI backed by authoritative server checks; clients must handle a slot becoming unavailable during checkout.

## Change discipline

- Keep the first release focused on reliable shared scheduling and owner self-service.
- Validate business policies with the owner rather than embedding assumed prices or cancellation rules.
- Prefer established platform features and the smallest implementation that satisfies the requirements.
- Document unresolved decisions and provider assumptions; do not present proposals as confirmed facts.
