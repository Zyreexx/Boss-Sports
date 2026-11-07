/**
 * Core Booking Service — Boss Sports & Fitness
 * Enforces atomic database rules from docs/rules.md:
 * - Reject any court overlap for [startTime, endTime) interval
 * - Reconcile temporary holds vs confirmed bookings
 * - Support online, phone, and walk-in channels on a single source of truth
 */

export interface CreateBookingInput {
  courtId: string;
  startTime: Date;
  endTime: Date;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  source: "ONLINE" | "PHONE" | "WALKIN";
  totalPrice: number;
  createdById?: string;
}

export class BookingConflictError extends Error {
  constructor(message: string = "This court is already booked or held for the requested interval.") {
    super(message);
    this.name = "BookingConflictError";
  }
}

/**
 * Checks for overlapping confirmed bookings or active holds
 * Interval overlap rule: (slotStart < existingEnd) AND (slotEnd > existingStart)
 */
export function hasIntervalOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

