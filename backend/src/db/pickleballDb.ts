/**
 * =========================================================================
 * PICKLEBALL DATABASE SERVICE — Boss Pickleball
 * Enforces atomic interval checks, temporary holds, and single-source truth.
 * Dedicated standalone database service for Pickleball arena bookings.
 * =========================================================================
 */

import fs from "fs";
import path from "path";

export interface Court {
  id: string;
  courtNumber: number;
  name: string;
  surfaceType: string;
  isIndoor: boolean;
  basePricePerHour: number;
  isActive: boolean;
}

export interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  source: "ONLINE" | "PHONE" | "WALKIN";
  status: "HELD" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  paymentStatus: "PAID_ONLINE" | "CASH_COUNTER" | "UPI_COUNTER" | "PAY_AT_VENUE" | "PENDING" | "REFUNDED";
  totalPrice: number;
  discountCode?: string;
  discountAmount?: number;
  equipmentAddons?: {
    paddles?: number;
    balls?: number;
    lights?: boolean;
  };
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  createdByStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlotHold {
  id: string;
  courtId: string;
  startTime: string;
  endTime: string;
  sessionId: string;
  expiresAt: string; // ISO 8601
  createdAt: string;
}

export interface ScheduleBlock {
  id: string;
  courtId: string;
  startTime: string;
  endTime: string;
  reason: "MAINTENANCE" | "TOURNAMENT" | "COACHING" | "PRIVATE_EVENT";
  notes?: string;
  createdById?: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  minBookingAmount: number;
  maxUsage?: number;
  usageCount: number;
  validTo: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityId?: string;
  details: Record<string, any>;
  createdAt: string;
}

interface PickleballDatabaseState {
  courts: Court[];
  bookings: Booking[];
  holds: SlotHold[];
  blocks: ScheduleBlock[];
  discounts: DiscountCode[];
  auditLogs: AuditLog[];
}

const DB_DIR = path.join(process.cwd(), "..", "backend", "data");
const DB_FILE = path.join(DB_DIR, "pickleball_database.json");

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initial Seed Data
const initialPickleballState: PickleballDatabaseState = {
  courts: [
    {
      id: "court-1",
      courtNumber: 1,
      name: "Court 1",
      surfaceType: "Pickleball Court",
      isIndoor: true,
      basePricePerHour: 400,
      isActive: true,
    },
    {
      id: "court-2",
      courtNumber: 2,
      name: "Court 2",
      surfaceType: "Pickleball Court",
      isIndoor: true,
      basePricePerHour: 400,
      isActive: true,
    },
    {
      id: "court-3",
      courtNumber: 3,
      name: "Court 3",
      surfaceType: "Pickleball Court",
      isIndoor: false,
      basePricePerHour: 400,
      isActive: true,
    },
  ],
  bookings: [],
  holds: [],
  blocks: [],
  discounts: [
    {
      id: "disc-first",
      code: "FIRSTGAME",
      type: "FLAT",
      value: 100, // ₹100 flat off
      minBookingAmount: 400,
      maxUsage: 500,
      usageCount: 14,
      validTo: "2027-12-31T23:59:59.000Z",
      isActive: true,
    },
    {
      id: "disc-boss15",
      code: "BOSS15",
      type: "PERCENT",
      value: 15, // 15% off
      minBookingAmount: 400,
      maxUsage: 1000,
      usageCount: 42,
      validTo: "2027-12-31T23:59:59.000Z",
      isActive: true,
    },
  ],
  auditLogs: [],
};

class PickleballDatabaseService {
  private load(): PickleballDatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error loading pickleball database, resetting to initial state", e);
    }
    this.save(initialPickleballState);
    return initialPickleballState;
  }

  private save(state: PickleballDatabaseState): void {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  }

  // 1. Get all courts
  public getCourts(): Court[] {
    const state = this.load();
    return state.courts.filter((c) => c.isActive);
  }

  // 2. Clean expired holds
  private pruneExpiredHolds(state: PickleballDatabaseState): boolean {
    const now = new Date().getTime();
    const originalCount = state.holds.length;
    state.holds = state.holds.filter((h) => new Date(h.expiresAt).getTime() > now);
    return state.holds.length !== originalCount;
  }

  // 3. Interval overlap check: (startA < endB) AND (endA > startB)
  public hasIntervalOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    const sA = new Date(startA).getTime();
    const eA = new Date(endA).getTime();
    const sB = new Date(startB).getTime();
    const eB = new Date(endB).getTime();
    return sA < eB && eA > sB;
  }

  // 4. Get Availability for a date
  public getAvailability(dateStr: string, courtId?: string) {
    const state = this.load();
    this.pruneExpiredHolds(state);

    const targetDate = new Date(dateStr);
    const dayStart = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    const courts = courtId ? state.courts.filter((c) => c.id === courtId) : state.courts;

    // Daily slots from 5:30 AM to 10:30 PM (60 min increments)
    const slotHours = [
      { start: "05:30", end: "06:30" },
      { start: "06:30", end: "07:30" },
      { start: "07:30", end: "08:30" },
      { start: "08:30", end: "09:30" },
      { start: "09:30", end: "10:30" },
      { start: "16:00", end: "17:00" },
      { start: "17:00", end: "18:00" },
      { start: "18:00", end: "19:00" },
      { start: "19:00", end: "20:00" },
      { start: "20:00", end: "21:00" },
      { start: "21:00", end: "22:00" },
      { start: "22:00", end: "23:00" },
    ];

    const results = courts.map((court) => {
      const courtBookings = state.bookings.filter(
        (b) => b.courtId === court.id && b.status !== "CANCELLED"
      );
      const courtHolds = state.holds.filter((h) => h.courtId === court.id);
      const courtBlocks = state.blocks.filter((bl) => bl.courtId === court.id);

      const slots = slotHours.map(({ start, end }) => {
        const slotStart = new Date(`${dateStr}T${start}:00.000Z`).toISOString();
        const slotEnd = new Date(`${dateStr}T${end}:00.000Z`).toISOString();

        // Check confirmed bookings
        const activeBooking = courtBookings.find((b) =>
          this.hasIntervalOverlap(slotStart, slotEnd, b.startTime, b.endTime)
        );

        // Check active holds
        const activeHold = courtHolds.find((h) =>
          this.hasIntervalOverlap(slotStart, slotEnd, h.startTime, h.endTime)
        );

        // Check blocks
        const activeBlock = courtBlocks.find((bl) =>
          this.hasIntervalOverlap(slotStart, slotEnd, bl.startTime, bl.endTime)
        );

        let status = "AVAILABLE";
        if (activeBlock) status = "BLOCKED";
        else if (activeBooking) status = "BOOKED";
        else if (activeHold) status = "HELD";

        return {
          courtId: court.id,
          courtName: court.name,
          startTime: slotStart,
          endTime: slotEnd,
          displayTime: `${start} - ${end}`,
          status,
          price: court.basePricePerHour,
          bookingId: activeBooking?.id,
          heldUntil: activeHold?.expiresAt,
          blockReason: activeBlock?.reason,
        };
      });

      return {
        courtId: court.id,
        courtNumber: court.courtNumber,
        courtName: court.name,
        slots,
      };
    });

    return results;
  }

  // 5. Place Atomic Temporary Hold (Rule: expires in 10 mins)
  public placeHold(params: {
    courtId: string;
    startTime: string;
    endTime: string;
    sessionId: string;
  }): { success: boolean; hold?: SlotHold; error?: string } {
    const state = this.load();
    this.pruneExpiredHolds(state);

    const { courtId, startTime, endTime, sessionId } = params;

    // Check conflict against bookings
    const hasBookingConflict = state.bookings.some(
      (b) =>
        b.courtId === courtId &&
        b.status !== "CANCELLED" &&
        this.hasIntervalOverlap(startTime, endTime, b.startTime, b.endTime)
    );
    if (hasBookingConflict) {
      return { success: false, error: "Slot is already confirmed by another customer or staff." };
    }

    // Check conflict against active holds from other sessions
    const hasHoldConflict = state.holds.some(
      (h) =>
        h.courtId === courtId &&
        h.sessionId !== sessionId &&
        this.hasIntervalOverlap(startTime, endTime, h.startTime, h.endTime)
    );
    if (hasHoldConflict) {
      return { success: false, error: "Slot is temporarily held in another checkout cart." };
    }

    // Check maintenance blocks
    const hasBlockConflict = state.blocks.some(
      (bl) =>
        bl.courtId === courtId &&
        this.hasIntervalOverlap(startTime, endTime, bl.startTime, bl.endTime)
    );
    if (hasBlockConflict) {
      return { success: false, error: "Court is blocked for maintenance or tournament during this time." };
    }

    // Remove existing hold from same session if any
    state.holds = state.holds.filter((h) => h.sessionId !== sessionId);

    // Create 10-minute hold
    const hold: SlotHold = {
      id: `hold-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      courtId,
      startTime,
      endTime,
      sessionId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      createdAt: new Date().toISOString(),
    };

    state.holds.push(hold);
    this.save(state);

    return { success: true, hold };
  }

  // 6. Confirm Booking (Online, Phone, or Walk-in)
  public createBooking(params: {
    courtId: string;
    startTime: string;
    endTime: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    source: "ONLINE" | "PHONE" | "WALKIN";
    paymentStatus: Booking["paymentStatus"];
    discountCode?: string;
    equipmentAddons?: Booking["equipmentAddons"];
    notes?: string;
    staffId?: string;
    sessionId?: string;
  }): { success: boolean; booking?: Booking; error?: string } {
    const state = this.load();
    this.pruneExpiredHolds(state);

    const {
      courtId,
      startTime,
      endTime,
      customerName,
      customerPhone,
      customerEmail,
      source,
      paymentStatus,
      discountCode,
      equipmentAddons,
      notes,
      staffId,
      sessionId,
    } = params;

    const court = state.courts.find((c) => c.id === courtId);
    if (!court) {
      return { success: false, error: "Court does not exist." };
    }

    // Atomic Conflict Check
    const hasBookingConflict = state.bookings.some(
      (b) =>
        b.courtId === courtId &&
        b.status !== "CANCELLED" &&
        this.hasIntervalOverlap(startTime, endTime, b.startTime, b.endTime)
    );
    if (hasBookingConflict) {
      return { success: false, error: "Booking conflict: this court/interval has already been reserved." };
    }

    // Check hold from other sessions
    const hasHoldConflict = state.holds.some(
      (h) =>
        h.courtId === courtId &&
        (!sessionId || h.sessionId !== sessionId) &&
        this.hasIntervalOverlap(startTime, endTime, h.startTime, h.endTime)
    );
    if (hasHoldConflict) {
      return { success: false, error: "Slot is currently held by another user in checkout." };
    }

    // Price calculation & snapshot preservation
    let basePrice = court.basePricePerHour;
    let discountAmount = 0;

    if (discountCode) {
      const disc = state.discounts.find(
        (d) => d.code.toUpperCase() === discountCode.toUpperCase() && d.isActive
      );
      if (disc && new Date(disc.validTo).getTime() > Date.now()) {
        if (disc.type === "PERCENT") {
          discountAmount = (basePrice * disc.value) / 100;
        } else {
          discountAmount = disc.value;
        }
        disc.usageCount += 1;
      }
    }

    // Addons calculation
    let addonsTotal = 0;
    if (equipmentAddons?.paddles) addonsTotal += equipmentAddons.paddles * 50; // ₹50/paddle
    if (equipmentAddons?.balls) addonsTotal += equipmentAddons.balls * 30; // ₹30/ball
    if (equipmentAddons?.lights) addonsTotal += 50; // ₹50 pro floodlights

    const finalPrice = Math.max(0, basePrice - discountAmount + addonsTotal);

    const booking: Booking = {
      id: `BK-${Date.now().toString().slice(-6)}`,
      courtId,
      courtName: court.name,
      startTime,
      endTime,
      customerName,
      customerPhone,
      customerEmail,
      source,
      status: "CONFIRMED",
      paymentStatus,
      totalPrice: finalPrice,
      discountCode,
      discountAmount,
      equipmentAddons,
      notes,
      createdByStaffId: staffId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove any holds for this slot
    state.holds = state.holds.filter(
      (h) =>
        !(
          h.courtId === courtId &&
          this.hasIntervalOverlap(startTime, endTime, h.startTime, h.endTime)
        )
    );

    state.bookings.push(booking);

    // Audit Log
    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: staffId || customerPhone,
      actorRole: staffId ? "STAFF" : "CUSTOMER",
      action: "CREATE_BOOKING",
      entityId: booking.id,
      details: {
        source,
        courtId,
        startTime,
        finalPrice,
        paymentStatus,
      },
      createdAt: new Date().toISOString(),
    });

    this.save(state);
    return { success: true, booking };
  }

  // 7. Cancel / Reschedule with 2-Hour Policy check
  public cancelBooking(
    bookingId: string,
    reason: string,
    actorRole: "CUSTOMER" | "STAFF" | "OWNER",
    actorId: string
  ): { success: boolean; error?: string; refundable?: boolean } {
    const state = this.load();
    const booking = state.bookings.find((b) => b.id === bookingId);

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }
    if (booking.status === "CANCELLED") {
      return { success: false, error: "Booking is already cancelled." };
    }

    const slotStartTime = new Date(booking.startTime).getTime();
    const now = Date.now();
    const hoursDifference = (slotStartTime - now) / (1000 * 60 * 60);

    // Policy from PRD/Features: Free cancellation up to 2 hours before slot
    const isFreeCancellation = hoursDifference >= 2 || actorRole !== "CUSTOMER";

    booking.status = "CANCELLED";
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    if (booking.paymentStatus === "PAID_ONLINE" && isFreeCancellation) {
      booking.paymentStatus = "REFUNDED";
    }

    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId,
      actorRole,
      action: "CANCEL_BOOKING",
      entityId: booking.id,
      details: { reason, isFreeCancellation, previousPaymentStatus: booking.paymentStatus },
      createdAt: new Date().toISOString(),
    });

    this.save(state);
    return { success: true, refundable: isFreeCancellation };
  }

  // 8. Lookup Bookings by Phone (Fast Staff Desk lookup)
  public getBookingsByPhone(phone: string): Booking[] {
    const state = this.load();
    const clean = phone.replace(/\D/g, "");
    return state.bookings.filter((b) => b.customerPhone.replace(/\D/g, "").includes(clean));
  }

  // 9. GetAll Bookings (Staff/Admin)
  public getAllBookings(): Booking[] {
    const state = this.load();
    return state.bookings.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  // 10. Financial & Occupancy Report (Pickleball Database Isolated)
  public getPickleballReport() {
    const state = this.load();
    const validBookings = state.bookings.filter((b) => b.status !== "CANCELLED");

    const totalRevenue = validBookings.reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const onlineRevenue = validBookings
      .filter((b) => b.paymentStatus === "PAID_ONLINE")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const cashRevenue = validBookings
      .filter((b) => b.paymentStatus === "CASH_COUNTER")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const upiCounterRevenue = validBookings
      .filter((b) => b.paymentStatus === "UPI_COUNTER")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);

    const channelBreakdown = {
      online: validBookings.filter((b) => b.source === "ONLINE").length,
      phone: validBookings.filter((b) => b.source === "PHONE").length,
      walkin: validBookings.filter((b) => b.source === "WALKIN").length,
    };

    return {
      database: "PICKLEBALL_DATABASE",
      totalBookings: validBookings.length,
      totalRevenue,
      onlineRevenue,
      cashRevenue,
      upiCounterRevenue,
      channelBreakdown,
      courtsCount: state.courts.length,
      activeHoldsCount: state.holds.length,
    };
  }
}

export const pickleballDb = new PickleballDatabaseService();

