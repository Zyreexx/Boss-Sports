# Security Audit Plan — Pickleball Court & Gym Booking Platform

This is a pre-release audit checklist based on the proposed architecture. It is not a claim that the system has already been implemented or audited.

## Priority 0 — Booking integrity and payments

- [ ] Confirm booking writes are atomic and database-enforced against overlapping court/time intervals, including concurrent requests.
- [ ] Confirm online checkout holds expire and cannot indefinitely block a court.
- [ ] Verify payment signatures/webhooks using provider guidance; never trust a client-side success redirect.
- [ ] Make webhook handling idempotent and reconcile gateway events against booking/payment records.
- [ ] Prevent a user from changing another customer’s booking by guessing an ID.
- [ ] Ensure staff-created bookings and online checkout use the same conflict check.
- [ ] Confirm cancellation/refund paths cannot mark a refund complete before gateway confirmation.

## Priority 1 — Identity, roles, and customer data

- [ ] Enforce role-based access on every server action/API route.
- [ ] Verify staff cannot change prices, discounts, permissions, or restricted reports unless explicitly granted.
- [ ] Secure staff sessions with safe cookie settings, expiration, and logout/invalidation behavior.
- [ ] Rate-limit OTP requests and verification attempts; avoid revealing whether a phone number is registered.
- [ ] Restrict customer lookup and personal data to authorized staff; avoid unnecessary data collection.
- [ ] Review access to membership, attendance, contact, and payment history.

## Priority 1 — Secrets and infrastructure

- [ ] Store database, Redis, payment, OTP, and messaging secrets in deployment secret storage.
- [ ] Ensure secrets never reach browser bundles, logs, screenshots, or source control.
- [ ] Use TLS for external connections and secure managed database/Redis access.
- [ ] Restrict database and Redis network access; use separate production and staging credentials.
- [ ] Review dependency updates and framework/provider security advisories before release.

## Priority 2 — Abuse, input, and availability

- [ ] Validate and normalize phone numbers, dates, durations, discount codes, prices, and identifiers server-side.
- [ ] Add rate limits for booking attempts, OTP, promo-code guessing, and notification triggers.
- [ ] Prevent over-discounting, invalid negative totals, and unauthorized manual payment-state changes.
- [ ] Avoid leaking customer data in error messages or public availability responses.
- [ ] Protect admin forms against cross-site request forgery as applicable to the chosen session/auth model.
- [ ] Ensure logs avoid OTPs, tokens, full payment credentials, and unnecessary personal information.

## Priority 2 — Auditability and recovery

- [ ] Record who changed bookings, payments, membership records, prices, and policies.
- [ ] Protect activity logs from ordinary staff edits/deletion.
- [ ] Configure automated backups and periodically verify a restore procedure.
- [ ] Define retention and deletion handling for customer records and payment references.
- [ ] Monitor failed payment webhooks, repeated conflicts, login abuse, and notification failures.

## Release evidence to collect

- Architecture and data-flow review for booking/payment confirmation.
- Access-control matrix tested against owner, staff, registrar, and customer roles.
- Gateway webhook validation and duplicate-event handling evidence.
- Backup restore evidence and production secret review.
- Owner approval of privacy notice, cancellation/refund terms, and data-retention practices.

## Known design risks to resolve

- Redis locking and pub/sub are not sufficient as the only protection against double booking; enforce conflict safety in PostgreSQL.
- Third-party booking coexistence can create conflicts unless availability is integrated or one system is designated authoritative.
- OTP and WhatsApp providers have regional, template, delivery, and cost requirements that must be checked before launch.
- Payment gateway and hosting fees remain costs; validate the expected total cost before claiming savings over the current platform.
