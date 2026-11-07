# Project Memory — Pickleball Court & Gym Booking Platform

## Business context

- A local pickleball venue charges a base hourly rate (example discussed: ₹400/hour), but its third-party online booking platform displays a higher cost.
- The venue currently also accepts bookings by phone and in person, with an owner or employee recording them.
- The pickleball venue and gym are owned by the same person.
- The project opportunity is a direct website and management system that reduces reliance on the third-party platform and lets the owner manage everyday settings independently.

## Product goal

Provide customer booking online and staff-assisted booking by phone or walk-in through a shared, live calendar. Owner-managed prices, discounts, schedules, and policies should be editable in an admin panel without developer involvement.

## Agreed product surfaces

1. Customer-facing website for pickleball bookings and gym membership information/actions.
2. Staff panel for quick phone/walk-in bookings and registrar workflows.
3. Owner panel for business configuration, staff access, and reporting.

All surfaces use one API and persistent database. A booking from either channel immediately blocks the same court/time everywhere.

## Core requirements

- Prevent double-booking, including simultaneous online payment and staff booking attempts.
- Support multiple courts, durations, pricing rules, closures, and booking source tracking.
- Let staff record customer contact information and payment state for phone and walk-in bookings.
- Let the owner edit pricing, discounts, hours, closures, cancellation rules, and staff roles.
- Keep an activity history for booking and membership changes.
- Provide clear booking/payment confirmations and useful basic reports.

## Proposed stack from source notes

- Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and TanStack Query.
- Next.js API routes for a simple first version; Express is an alternative if the backend later needs separation.
- PostgreSQL as the durable source of truth, accessed with Prisma.
- Redis/Upstash proposed for short-lived slot holds, caching, and real-time messaging; Supabase Realtime is an alternative.
- Razorpay proposed for Indian online payments; OTP, WhatsApp, and SMS providers are options to evaluate.
- Vercel proposed for app hosting, with managed PostgreSQL and Redis.

These are proposals from the supplied notes, not confirmed provider accounts or final purchasing decisions.

## Important implementation facts

- Payment success must be confirmed by a trusted gateway webhook, not merely by the browser redirect.
- Database constraints/transactions must protect against overlapping confirmed bookings. Redis holds alone are not the permanent record.
- If the third-party booking tool remains active, availability synchronization must be confirmed. Without integration, staff need a single agreed calendar and a process to avoid double entry and conflicts.
- Gateway, messaging, hosting, and database costs still need to be priced against the current booking platform before making savings claims.

## Decisions still needed

- Final product name, branding, and venue details.
- Final implementation stack and hosting/provider accounts.
- Pricing and cancellation policy, slot durations, operating hours, and advance booking window.
- Whether gym memberships and online payments are in the first release or a later phase.
- How existing customers, bookings, and membership records will be migrated.
