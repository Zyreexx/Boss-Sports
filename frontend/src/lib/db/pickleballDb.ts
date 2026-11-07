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

export interface ArenaSchedule {
  date: string; // "YYYY-MM-DD" or "DEFAULT"
  isClosed: boolean;
  closureReason?: string; // e.g. "Diwali Festive Holiday", "Monsoon Maintenance"
  openTime: string; // e.g. "17:00" or "06:00"
  closeTime: string; // e.g. "05:00" or "23:00"
  updatedBy?: string;
  updatedAt?: string;
}

export interface PricingConfig {
  basePricePerHour: number;
  peakSurgePricePerHour: number;
  peakHours: string[]; // e.g. ["18:00", "19:00", "20:00", "21:00", "22:00"]
  isPeakSurgeActive: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface GalleryItem {
  id: string;
  type: "video" | "image";
  title: string;
  category: "matchplay" | "gear" | "training" | "tournament";
  tag: string;
  src: string;
  videoSrc?: string;
  aspect: "tall" | "square" | "standard";
  caption: string;
  duration?: string;
  createdAt?: string;
}

export const defaultGalleryItems: GalleryItem[] = [
  {
    id: "gal-1",
    type: "video",
    title: "Championship Kitchen Dink Rally",
    category: "matchplay",
    tag: "Live Action",
    src: "/images/hero-player.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "tall",
    caption: "Fast-paced third shot drop and kitchen rally exchanges on Court 1.",
    duration: "0:12",
  },
  {
    id: "gal-2",
    type: "image",
    title: "Official Pro Selkirk Carbon Paddles",
    category: "gear",
    tag: "Pro Gear",
    src: "/images/gallery-grid-full.jpg",
    aspect: "square",
    caption: "Complimentary USAPA tournament-grade carbon fiber paddles provided at reception.",
  },
  {
    id: "gal-3",
    type: "video",
    title: "Baseline Reset & Crosscourt Angle",
    category: "training",
    tag: "Pro Clinic",
    src: "/images/athletes-team.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "tall",
    caption: "Mastering the defensive baseline reset under intense topspin pressure.",
    duration: "0:10",
  },
  {
    id: "gal-4",
    type: "image",
    title: "Optic Yellow Tournament Ball in Flight",
    category: "matchplay",
    tag: "Matchplay",
    src: "/images/gallery-reference-1.jpg",
    aspect: "standard",
    caption: "High-visibility tournament optic balls engineered for consistent court bounce.",
  },
  {
    id: "gal-5",
    type: "image",
    title: "Precision Backhand Slice Grip",
    category: "gear",
    tag: "Equipment",
    src: "/images/gallery-reference-2.jpg",
    aspect: "tall",
    caption: "Ergonomic moisture-wicking grip designed for maximum control and spin.",
  },
  {
    id: "gal-6",
    type: "video",
    title: "Overhead Smash & Jump Volley",
    category: "tournament",
    tag: "Live Action",
    src: "/images/joola-court.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "standard",
    caption: "Agile overhead court coverage and put-away smashes during tournament semi-finals.",
    duration: "0:08",
  },
  {
    id: "gal-7",
    type: "video",
    title: "Singles Speed & Footwork Coverage",
    category: "matchplay",
    tag: "Live Action",
    src: "/images/hero-action.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "tall",
    caption: "High-intensity singles rally across the entire 44-foot championship court.",
    duration: "0:15",
  },
  {
    id: "gal-8",
    type: "image",
    title: "Court 2 Stadium Illumination",
    category: "tournament",
    tag: "Arena",
    src: "/images/court-wide.jpg",
    aspect: "standard",
    caption: "500-lux anti-glare overhead LED stadium lighting for evening gameplay.",
  },
];

interface PickleballDatabaseState {
  courts: Court[];
  bookings: Booking[];
  holds: SlotHold[];
  blocks: ScheduleBlock[];
  discounts: DiscountCode[];
  auditLogs: AuditLog[];
  pricingConfig?: PricingConfig;
  schedules?: ArenaSchedule[];
  galleryItems?: GalleryItem[];
}

const DB_DIR = path.join(process.cwd(), "data");
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
      usageCount: 0,
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
      usageCount: 0,
      validTo: "2027-12-31T23:59:59.000Z",
      isActive: true,
    },
  ],
  auditLogs: [],
};

class PickleballDatabaseService {
  private load(): PickleballDatabaseState {
    let state: PickleballDatabaseState = initialPickleballState;
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        state = JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error loading pickleball database, resetting to initial state", e);
      state = initialPickleballState;
    }

    if (!state.pricingConfig) {
      state.pricingConfig = {
        basePricePerHour: 400,
        peakSurgePricePerHour: 550,
        peakHours: ["18:00", "19:00", "20:00", "21:00", "22:00"],
        isPeakSurgeActive: true,
        updatedAt: new Date().toISOString(),
      };
    }

    if (!state.schedules || state.schedules.length === 0) {
      state.schedules = [
        {
          date: "DEFAULT",
          isClosed: false,
          openTime: "06:00",
          closeTime: "23:00",
          updatedAt: new Date().toISOString(),
        },
      ];
    }

    if (!state.galleryItems || state.galleryItems.length === 0) {
      state.galleryItems = [...defaultGalleryItems];
    }

    return state;
  }

  private save(state: PickleballDatabaseState): void {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  }

  // 1. Get all active courts
  public getCourts(): Court[] {
    const state = this.load();
    return state.courts.filter((c) => c.isActive);
  }

  // 1b. Get all courts (with optional inactive)
  public getAllCourts(includeInactive: boolean = true): Court[] {
    const state = this.load();
    return includeInactive ? state.courts : state.courts.filter((c) => c.isActive);
  }

  // 1c. Add Court (Owner & Staff)
  public addCourt(
    courtData: {
      name?: string;
      surfaceType?: string;
      isIndoor?: boolean;
      basePricePerHour?: number;
    },
    actor: { id: string; role: string }
  ): Court {
    const state = this.load();
    const existingNumbers = state.courts.map((c) => c.courtNumber || 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const name = courtData.name?.trim() || `Court ${nextNumber}`;
    const id = `court-${nextNumber}`;

    const newCourt: Court = {
      id,
      courtNumber: nextNumber,
      name,
      surfaceType: courtData.surfaceType || "Pickleball Court",
      isIndoor: courtData.isIndoor ?? true,
      basePricePerHour: courtData.basePricePerHour || 400,
      isActive: true,
    };

    state.courts.push(newCourt);
    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorRole: actor.role,
      action: "ADD_COURT",
      entityId: id,
      details: { newCourt },
      createdAt: new Date().toISOString(),
    });
    this.save(state);
    return newCourt;
  }

  // 1d. Update Court (Owner & Staff)
  public updateCourt(
    courtId: string,
    updates: Partial<Court>,
    actor: { id: string; role: string }
  ): Court {
    const state = this.load();
    const court = state.courts.find((c) => c.id === courtId);
    if (!court) {
      throw new Error(`Court ${courtId} not found`);
    }

    if (updates.name !== undefined) court.name = updates.name.trim();
    if (updates.basePricePerHour !== undefined) court.basePricePerHour = Number(updates.basePricePerHour);
    if (updates.surfaceType !== undefined) court.surfaceType = updates.surfaceType;
    if (updates.isIndoor !== undefined) court.isIndoor = Boolean(updates.isIndoor);
    if (updates.isActive !== undefined) court.isActive = Boolean(updates.isActive);

    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorRole: actor.role,
      action: "UPDATE_COURT",
      entityId: courtId,
      details: { updates },
      createdAt: new Date().toISOString(),
    });
    this.save(state);
    return court;
  }

  // 1e. Delete / Deactivate Court (Owner & Staff)
  public deleteCourt(courtId: string, actor: { id: string; role: string }): boolean {
    const state = this.load();
    const courtIndex = state.courts.findIndex((c) => c.id === courtId);
    if (courtIndex === -1) {
      throw new Error(`Court ${courtId} not found`);
    }

    const now = new Date().toISOString();
    const hasActiveBookings = state.bookings.some(
      (b) => b.courtId === courtId && b.endTime >= now && b.status === "CONFIRMED"
    );

    if (hasActiveBookings) {
      // Soft disable so booking history is preserved
      state.courts[courtIndex].isActive = false;
      state.auditLogs.push({
        id: `audit-${Date.now()}`,
        actorId: actor.id,
        actorRole: actor.role,
        action: "DEACTIVATE_COURT_WITH_BOOKINGS",
        entityId: courtId,
        details: {},
        createdAt: new Date().toISOString(),
      });
    } else {
      state.courts.splice(courtIndex, 1);
      state.auditLogs.push({
        id: `audit-${Date.now()}`,
        actorId: actor.id,
        actorRole: actor.role,
        action: "DELETE_COURT",
        entityId: courtId,
        details: {},
        createdAt: new Date().toISOString(),
      });
    }

    this.save(state);
    return true;
  }

  // =========================================================================
  // GALLERY MANAGEMENT (Owner & Staff)
  // =========================================================================

  // Get all gallery items
  public getGalleryItems(): GalleryItem[] {
    const state = this.load();
    return state.galleryItems || [];
  }

  // Add gallery item
  public addGalleryItem(
    itemData: Omit<GalleryItem, "id">,
    actor: { id: string; role: string }
  ): GalleryItem {
    const state = this.load();
    if (!state.galleryItems) {
      state.galleryItems = [...defaultGalleryItems];
    }

    const newItem: GalleryItem = {
      id: `gal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: itemData.type || "image",
      title: itemData.title?.trim() || "Arena Highlight",
      category: itemData.category || "matchplay",
      tag: itemData.tag?.trim() || "",
      src: itemData.src?.trim() || "/images/hero-player.jpg",
      videoSrc: itemData.videoSrc?.trim() || undefined,
      aspect: itemData.aspect || "tall",
      caption: itemData.caption?.trim() || "",
      duration: itemData.duration?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    state.galleryItems.unshift(newItem);
    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorRole: actor.role,
      action: "ADD_GALLERY_ITEM",
      entityId: newItem.id,
      details: { newItem },
      createdAt: new Date().toISOString(),
    });
    this.save(state);
    return newItem;
  }

  // Update gallery item
  public updateGalleryItem(
    id: string,
    updates: Partial<GalleryItem>,
    actor: { id: string; role: string }
  ): GalleryItem {
    const state = this.load();
    if (!state.galleryItems) {
      state.galleryItems = [...defaultGalleryItems];
    }

    const item = state.galleryItems.find((g) => g.id === id);
    if (!item) {
      throw new Error(`Gallery item ${id} not found`);
    }

    if (updates.title !== undefined) item.title = updates.title.trim();
    if (updates.type !== undefined) item.type = updates.type;
    if (updates.category !== undefined) item.category = updates.category;
    if (updates.tag !== undefined) item.tag = updates.tag.trim();
    if (updates.src !== undefined) item.src = updates.src.trim();
    if (updates.videoSrc !== undefined) item.videoSrc = updates.videoSrc.trim() || undefined;
    if (updates.aspect !== undefined) item.aspect = updates.aspect;
    if (updates.caption !== undefined) item.caption = updates.caption.trim();
    if (updates.duration !== undefined) item.duration = updates.duration.trim() || undefined;

    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorRole: actor.role,
      action: "UPDATE_GALLERY_ITEM",
      entityId: id,
      details: { updates },
      createdAt: new Date().toISOString(),
    });
    this.save(state);
    return item;
  }

  // Delete gallery item
  public deleteGalleryItem(id: string, actor: { id: string; role: string }): boolean {
    const state = this.load();
    if (!state.galleryItems) {
      state.galleryItems = [...defaultGalleryItems];
    }

    const index = state.galleryItems.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Gallery item ${id} not found`);
    }

    state.galleryItems.splice(index, 1);
    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorRole: actor.role,
      action: "DELETE_GALLERY_ITEM",
      entityId: id,
      details: {},
      createdAt: new Date().toISOString(),
    });
    this.save(state);
    return true;
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

  // 4. Get Availability for a date (Dynamic Schedules, Holidays, and Peak Surge Pricing)
  public getAvailability(dateStr: string, courtId?: string) {
    const state = this.load();
    this.pruneExpiredHolds(state);

    const activeCourts = state.courts.filter((c) => c.isActive);
    const courts = courtId ? activeCourts.filter((c) => c.id === courtId) : activeCourts;

    // Resolve Arena Schedule for the requested date (or default)
    const specificSchedule = state.schedules?.find((s) => s.date === dateStr);
    const defaultSchedule = state.schedules?.find((s) => s.date === "DEFAULT") || {
      date: dateStr,
      isClosed: false,
      openTime: "06:00",
      closeTime: "23:00",
    };
    const schedule: ArenaSchedule = specificSchedule || { ...defaultSchedule, date: dateStr };

    // Case A: Full-Day Holiday / Closure (e.g. Diwali Holiday, Monsoon Maintenance)
    if (schedule.isClosed) {
      return {
        date: dateStr,
        isClosed: true,
        closureReason: schedule.closureReason || "Arena closed for holiday / maintenance.",
        openTime: schedule.openTime,
        closeTime: schedule.closeTime,
        pricingConfig: state.pricingConfig,
        courts: courts.map((court) => ({
          courtId: court.id,
          courtNumber: court.courtNumber,
          courtName: court.name,
          basePricePerHour: court.basePricePerHour,
          slots: [],
        })),
      };
    }

    // Case B: Dynamic Operating Hours (e.g. 17:00 to 05:00 overnight, or 06:00 to 23:00)
    const openTime = schedule.openTime || "06:00";
    const closeTime = schedule.closeTime || "23:00";

    const [openH, openM] = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);

    const startMinutes = openH * 60 + (openM || 0);
    let endMinutes = closeH * 60 + (closeM || 0);

    // If closeTime <= openTime, the operating window spans overnight into the next morning
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }

    const slotIntervals: Array<{
      start: string;
      end: string;
      slotStartIso: string;
      slotEndIso: string;
      isPeak: boolean;
      displayLabel: string;
    }> = [];

    const pricing = state.pricingConfig || {
      basePricePerHour: 400,
      peakSurgePricePerHour: 550,
      peakHours: ["18:00", "19:00", "20:00", "21:00", "22:00"],
      isPeakSurgeActive: true,
    };

    let currentMin = startMinutes;
    while (currentMin + 60 <= endMinutes) {
      const slotStartMin = currentMin;
      const slotEndMin = currentMin + 60;

      const sDayOffset = Math.floor(slotStartMin / 1440);
      const sHour = Math.floor((slotStartMin % 1440) / 60);
      const sMin = slotStartMin % 60;

      const eDayOffset = Math.floor(slotEndMin / 1440);
      const eHour = Math.floor((slotEndMin % 1440) / 60);
      const eMin = slotEndMin % 60;

      const baseD = new Date(dateStr + "T00:00:00");
      const startD = new Date(baseD.getTime() + sDayOffset * 86400000);
      startD.setHours(sHour, sMin, 0, 0);

      const endD = new Date(baseD.getTime() + eDayOffset * 86400000);
      endD.setHours(eHour, eMin, 0, 0);

      const sLabel = `${sHour.toString().padStart(2, "0")}:${sMin.toString().padStart(2, "0")}`;
      const eLabel = `${eHour.toString().padStart(2, "0")}:${eMin.toString().padStart(2, "0")}`;

      const isPeak =
        pricing.isPeakSurgeActive &&
        pricing.peakHours &&
        pricing.peakHours.some((ph) => ph.startsWith(sLabel.slice(0, 2)));

      slotIntervals.push({
        start: sLabel,
        end: eLabel,
        slotStartIso: startD.toISOString(),
        slotEndIso: endD.toISOString(),
        isPeak,
        displayLabel: `${sLabel} - ${eLabel}${sDayOffset > 0 ? " (+1d)" : ""}`,
      });

      currentMin += 60;
    }

    const results = courts.map((court) => {
      const courtBookings = state.bookings.filter(
        (b) => b.courtId === court.id && b.status !== "CANCELLED"
      );
      const courtHolds = state.holds.filter((h) => h.courtId === court.id);
      const courtBlocks = state.blocks.filter((bl) => bl.courtId === court.id);

      const slots = slotIntervals.map((interval) => {
        // Check confirmed bookings
        const activeBooking = courtBookings.find((b) =>
          this.hasIntervalOverlap(interval.slotStartIso, interval.slotEndIso, b.startTime, b.endTime)
        );

        // Check active holds
        const activeHold = courtHolds.find((h) =>
          this.hasIntervalOverlap(interval.slotStartIso, interval.slotEndIso, h.startTime, h.endTime)
        );

        // Check blocks
        const activeBlock = courtBlocks.find((bl) =>
          this.hasIntervalOverlap(interval.slotStartIso, interval.slotEndIso, bl.startTime, bl.endTime)
        );

        let status = "AVAILABLE";
        if (activeBlock) status = "BLOCKED";
        else if (activeBooking) status = "BOOKED";
        else if (activeHold) status = "HELD";

        // Dynamic price calculation
        const price = interval.isPeak
          ? pricing.peakSurgePricePerHour || 550
          : court.basePricePerHour || pricing.basePricePerHour || 400;

        return {
          courtId: court.id,
          courtName: court.name,
          startTime: interval.slotStartIso,
          endTime: interval.slotEndIso,
          displayTime: interval.displayLabel,
          status,
          price,
          isPeak: interval.isPeak,
          bookingId: activeBooking?.id,
          customerName: activeBooking?.customerName,
          customerPhone: activeBooking?.customerPhone,
          source: activeBooking?.source,
          heldUntil: activeHold?.expiresAt,
          blockReason: activeBlock?.reason,
        };
      });

      return {
        courtId: court.id,
        courtNumber: court.courtNumber,
        courtName: court.name,
        basePricePerHour: court.basePricePerHour,
        slots,
      };
    });

    return {
      date: dateStr,
      isClosed: false,
      closureReason: null,
      openTime: schedule.openTime,
      closeTime: schedule.closeTime,
      pricingConfig: state.pricingConfig,
      courts: results,
    };
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
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
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

    // Price calculation with dynamic peak surge detection
    const isPeakSlot =
      state.pricingConfig?.isPeakSurgeActive &&
      state.pricingConfig?.peakHours &&
      state.pricingConfig.peakHours.some((ph) => startTime.includes(`T${ph}`));

    let basePrice = isPeakSlot
      ? state.pricingConfig?.peakSurgePricePerHour || court.basePricePerHour
      : court.basePricePerHour;
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
    if (equipmentAddons?.paddles) addonsTotal += equipmentAddons.paddles * 50;
    if (equipmentAddons?.balls) addonsTotal += equipmentAddons.balls * 30;
    if (equipmentAddons?.lights) addonsTotal += 50;

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

  // 7. Cancel Booking with 2-Hour Policy check
  public cancelBooking(
    bookingId: string,
    reason: string,
    actorRole: "CUSTOMER" | "STAFF" | "OWNER",
    actorId: string
  ): { success: boolean; error?: string; refundable?: boolean; booking?: Booking } {
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
    return { success: true, booking, refundable: isFreeCancellation };
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

  // 10. Update Pricing Configuration (Base Price, Peak Surge Price, Peak Hours)
  public updatePricingConfig(params: {
    basePricePerHour?: number;
    peakSurgePricePerHour?: number;
    peakHours?: string[];
    isPeakSurgeActive?: boolean;
    staffId?: string;
  }) {
    const state = this.load();
    if (!state.pricingConfig) {
      state.pricingConfig = {
        basePricePerHour: 400,
        peakSurgePricePerHour: 550,
        peakHours: ["18:00", "19:00", "20:00", "21:00", "22:00"],
        isPeakSurgeActive: true,
      };
    }

    if (params.basePricePerHour !== undefined && params.basePricePerHour > 0) {
      state.pricingConfig.basePricePerHour = Number(params.basePricePerHour);
      state.courts.forEach((c) => {
        c.basePricePerHour = Number(params.basePricePerHour);
      });
    }

    if (params.peakSurgePricePerHour !== undefined && params.peakSurgePricePerHour > 0) {
      state.pricingConfig.peakSurgePricePerHour = Number(params.peakSurgePricePerHour);
    }

    if (params.peakHours !== undefined) {
      state.pricingConfig.peakHours = params.peakHours;
    }

    if (params.isPeakSurgeActive !== undefined) {
      state.pricingConfig.isPeakSurgeActive = params.isPeakSurgeActive;
    }

    state.pricingConfig.updatedBy = params.staffId || "owner-admin";
    state.pricingConfig.updatedAt = new Date().toISOString();

    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: params.staffId || "owner-admin",
      actorRole: "OWNER",
      action: "UPDATE_PRICING_CONFIG",
      details: state.pricingConfig,
      createdAt: new Date().toISOString(),
    });

    this.save(state);
    return { success: true, pricingConfig: state.pricingConfig };
  }

  public getPricingConfig(): PricingConfig {
    const state = this.load();
    return (
      state.pricingConfig || {
        basePricePerHour: 400,
        peakSurgePricePerHour: 550,
        peakHours: ["18:00", "19:00", "20:00", "21:00", "22:00"],
        isPeakSurgeActive: true,
      }
    );
  }

  // 11. Set Arena Schedule / Holiday Closure for any date
  public setArenaSchedule(params: {
    date: string;
    isClosed: boolean;
    closureReason?: string;
    openTime?: string;
    closeTime?: string;
    staffId?: string;
  }) {
    const state = this.load();
    if (!state.schedules) {
      state.schedules = [];
    }

    const newSchedule: ArenaSchedule = {
      date: params.date,
      isClosed: params.isClosed,
      closureReason: params.closureReason,
      openTime: params.openTime || "06:00",
      closeTime: params.closeTime || "23:00",
      updatedBy: params.staffId || "staff-registrar",
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = state.schedules.findIndex((s) => s.date === params.date);
    if (existingIdx >= 0) {
      state.schedules[existingIdx] = newSchedule;
    } else {
      state.schedules.push(newSchedule);
    }

    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: params.staffId || "staff-registrar",
      actorRole: "STAFF",
      action: params.isClosed ? "SET_ARENA_HOLIDAY" : "SET_ARENA_HOURS",
      details: newSchedule,
      createdAt: new Date().toISOString(),
    });

    this.save(state);
    return { success: true, schedule: newSchedule };
  }

  public getArenaSchedule(dateStr: string): ArenaSchedule {
    const state = this.load();
    if (!state.schedules || state.schedules.length === 0) {
      return { date: dateStr, isClosed: false, openTime: "06:00", closeTime: "23:00" };
    }
    const specific = state.schedules.find((s) => s.date === dateStr);
    if (specific) return specific;
    const def = state.schedules.find((s) => s.date === "DEFAULT");
    return def
      ? { ...def, date: dateStr }
      : { date: dateStr, isClosed: false, openTime: "06:00", closeTime: "23:00" };
  }

  public getAllSchedules(): ArenaSchedule[] {
    const state = this.load();
    return state.schedules || [];
  }

  // 12. Update Court Base Price (Owner Self-Service)
  public updateCourtPrice(courtId: string, newPrice: number, ownerId: string) {
    const state = this.load();
    const court = state.courts.find((c) => c.id === courtId);
    if (!court) return { success: false, error: "Court not found" };

    const oldPrice = court.basePricePerHour;
    court.basePricePerHour = newPrice;

    state.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: ownerId,
      actorRole: "OWNER",
      action: "UPDATE_COURT_PRICE",
      entityId: courtId,
      details: { oldPrice, newPrice },
      createdAt: new Date().toISOString(),
    });

    this.save(state);
    return { success: true, court };
  }

  // 11. Add Schedule Block (Maintenance, Tournaments)
  public createScheduleBlock(params: {
    courtId: string;
    startTime: string;
    endTime: string;
    reason: ScheduleBlock["reason"];
    notes?: string;
    staffId: string;
  }) {
    const state = this.load();
    const block: ScheduleBlock = {
      id: `block-${Date.now()}`,
      courtId: params.courtId,
      startTime: params.startTime,
      endTime: params.endTime,
      reason: params.reason,
      notes: params.notes,
      createdById: params.staffId,
    };

    state.blocks.push(block);
    this.save(state);
    return { success: true, block };
  }

  // 12. Financial & Occupancy Report (Pickleball Database Isolated)
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
export default pickleballDb;
