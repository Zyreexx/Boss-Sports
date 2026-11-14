import { getSupabaseAdmin, isSupabaseConfigured } from "./server";
import {
  Booking,
  Court,
  SlotHold,
  ScheduleBlock,
  ArenaSchedule,
  PricingConfig,
  DiscountCode,
  VENUE_TIMEZONE,
  buildVenueIso,
  formatDurationDisplay,
} from "../db/pickleballDb";
import { UserAccount, UserRole } from "../auth/authDb";

// =========================================================================
// ROW MAPPERS (PostgreSQL snake_case <-> Application camelCase)
// =========================================================================

export function rowToCourt(row: any): Court {
  return {
    id: row.id,
    courtNumber: row.court_number,
    name: row.name,
    surfaceType: row.surface_type,
    isIndoor: row.is_indoor,
    basePricePerHour: Number(row.base_price_per_hour),
    isActive: row.is_active,
  };
}

export function rowToBooking(row: any): Booking {
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.court_name,
    startTime: typeof row.start_time === "string" ? row.start_time : new Date(row.start_time).toISOString(),
    endTime: typeof row.end_time === "string" ? row.end_time : new Date(row.end_time).toISOString(),
    durationMinutes: row.duration_minutes,
    durationDisplay: row.duration_display,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email || undefined,
    source: row.source,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || undefined,
    paymentScreenshotUrl: row.payment_screenshot_url || undefined,
    paymentUtr: row.payment_utr || undefined,
    paymentVerifiedBy: row.payment_verified_by || undefined,
    paymentVerifiedAt: row.payment_verified_at
      ? typeof row.payment_verified_at === "string"
        ? row.payment_verified_at
        : new Date(row.payment_verified_at).toISOString()
      : undefined,
    paymentRejectionReason: row.payment_rejection_reason || undefined,
    totalPrice: Number(row.total_price),
    discountCode: row.discount_code || undefined,
    discountAmount: Number(row.discount_amount || 0),
    equipmentAddons: row.equipment_addons || undefined,
    notes: row.notes || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    cancelledAt: row.cancelled_at
      ? typeof row.cancelled_at === "string"
        ? row.cancelled_at
        : new Date(row.cancelled_at).toISOString()
      : undefined,
    createdByStaffId: row.created_by_staff_id || undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(row.updated_at).toISOString(),
  };
}

export function rowToSlotHold(row: any): SlotHold {
  return {
    id: row.id,
    courtId: row.court_id,
    sessionId: row.session_id,
    startTime: typeof row.start_time === "string" ? row.start_time : new Date(row.start_time).toISOString(),
    endTime: typeof row.end_time === "string" ? row.end_time : new Date(row.end_time).toISOString(),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : new Date(row.expires_at).toISOString(),
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
  };
}

export function rowToScheduleBlock(row: any): ScheduleBlock {
  return {
    id: row.id,
    courtId: row.court_id,
    startTime: typeof row.start_time === "string" ? row.start_time : new Date(row.start_time).toISOString(),
    endTime: typeof row.end_time === "string" ? row.end_time : new Date(row.end_time).toISOString(),
    reason: row.reason,
    notes: row.notes || undefined,
    createdById: row.created_by || undefined,
  };
}

export function rowToArenaSchedule(row: any): ArenaSchedule {
  return {
    date: row.date,
    isClosed: Boolean(row.is_closed),
    closureReason: row.closure_reason || undefined,
    openTime: row.open_time || "06:00",
    closeTime: row.close_time || "23:00",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export function rowToPricingConfig(row: any): PricingConfig {
  let peakHours: string[] = ["18:00", "19:00", "20:00", "21:00", "22:00"];
  if (Array.isArray(row.peak_hours)) {
    peakHours = row.peak_hours;
  } else if (typeof row.peak_hours === "string") {
    try {
      peakHours = JSON.parse(row.peak_hours);
    } catch {
      // fallback
    }
  }

  return {
    basePricePerHour: Number(row.base_price_per_hour || 400),
    peakSurgePricePerHour: Number(row.peak_surge_price_per_hour || 550),
    peakHours,
    isPeakSurgeActive: Boolean(row.is_peak_surge_active),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export function rowToAppUser(row: any): UserAccount {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    name: row.name,
    role: row.role as UserRole,
    passwordHash: row.password_hash,
    avatar: row.avatar || undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
  };
}

// =========================================================================
// INTERVAL OVERLAP HELPER
// =========================================================================

export function hasIntervalOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA < eB && eA > sB;
}

// =========================================================================
// SUPABASE DATABASE REPOSITORY
// =========================================================================

export const supabaseDb = {
  // 1. COURTS
  async getCourts(): Promise<Court[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("courts")
      .select("*")
      .eq("is_active", true)
      .order("court_number", { ascending: true });

    if (error || !data) {
      console.error("Supabase getCourts error:", error);
      return [];
    }
    return data.map(rowToCourt);
  },

  async getAllCourts(includeInactive: boolean = true): Promise<Court[]> {
    const supabase = getSupabaseAdmin();
    let query = supabase.from("courts").select("*").order("court_number", { ascending: true });
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error || !data) {
      console.error("Supabase getAllCourts error:", error);
      return [];
    }
    return data.map(rowToCourt);
  },

  async addCourt(
    courtData: {
      name?: string;
      surfaceType?: string;
      isIndoor?: boolean;
      basePricePerHour?: number;
    },
    actor: { id: string; role: string }
  ): Promise<Court> {
    const supabase = getSupabaseAdmin();
    const all = await this.getAllCourts(true);
    const existingNumbers = all.map((c) => c.courtNumber || 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const name = courtData.name?.trim() || `Court ${nextNumber}`;
    const id = `court-${nextNumber}`;

    const newRow = {
      id,
      court_number: nextNumber,
      name,
      surface_type: courtData.surfaceType || "Pickleball Court",
      is_indoor: courtData.isIndoor ?? true,
      base_price_per_hour: courtData.basePricePerHour || 400,
      is_active: true,
    };

    const { data, error } = await supabase.from("courts").insert(newRow).select().single();
    if (error || !data) {
      throw new Error(`Failed to add court to Supabase: ${error?.message || "Unknown error"}`);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "ADD_COURT",
      entityId: id,
      details: { courtData: newRow },
    });

    return rowToCourt(data);
  },

  async updateCourt(
    courtId: string,
    updates: Partial<Court>,
    actor: { id: string; role: string }
  ): Promise<Court> {
    const supabase = getSupabaseAdmin();
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.basePricePerHour !== undefined) payload.base_price_per_hour = Number(updates.basePricePerHour);
    if (updates.surfaceType !== undefined) payload.surface_type = updates.surfaceType;
    if (updates.isIndoor !== undefined) payload.is_indoor = Boolean(updates.isIndoor);
    if (updates.isActive !== undefined) payload.is_active = Boolean(updates.isActive);

    const { data, error } = await supabase
      .from("courts")
      .update(payload)
      .eq("id", courtId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update court: ${error?.message || "Unknown error"}`);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "UPDATE_COURT",
      entityId: courtId,
      details: { updates },
    });

    return rowToCourt(data);
  },

  async deleteCourt(courtId: string, actor: { id: string; role: string }): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("court_id", courtId)
      .eq("status", "CONFIRMED")
      .gte("end_time", now);

    if (activeBookings && activeBookings.length > 0) {
      // Soft disable
      await supabase.from("courts").update({ is_active: false }).eq("id", courtId);
    } else {
      await supabase.from("courts").delete().eq("id", courtId);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "DELETE_COURT",
      entityId: courtId,
      details: {},
    });

    return true;
  },

  // 2. PRICING CONFIG
  async getPricingConfig(): Promise<PricingConfig> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("pricing_config").select("*").eq("id", 1).maybeSingle();

    if (error || !data) {
      return {
        basePricePerHour: 400,
        peakSurgePricePerHour: 550,
        peakHours: ["18:00", "19:00", "20:00", "21:00", "22:00"],
        isPeakSurgeActive: true,
        updatedAt: new Date().toISOString(),
      };
    }
    return rowToPricingConfig(data);
  },

  async updatePricingConfig(updates: Partial<PricingConfig>, actor: { id: string; role: string }): Promise<PricingConfig> {
    const supabase = getSupabaseAdmin();
    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.basePricePerHour !== undefined) payload.base_price_per_hour = updates.basePricePerHour;
    if (updates.peakSurgePricePerHour !== undefined) payload.peak_surge_price_per_hour = updates.peakSurgePricePerHour;
    if (updates.peakHours !== undefined) payload.peak_hours = updates.peakHours;
    if (updates.isPeakSurgeActive !== undefined) payload.is_peak_surge_active = updates.isPeakSurgeActive;

    const { data, error } = await supabase
      .from("pricing_config")
      .upsert({ id: 1, ...payload })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update pricing config: ${error?.message}`);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "UPDATE_PRICING",
      entityId: "1",
      details: { updates },
    });

    return rowToPricingConfig(data);
  },

  // 3. ARENA SCHEDULES
  async getArenaSchedule(dateStr: string): Promise<ArenaSchedule> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("arena_schedules")
      .select("*")
      .in("date", [dateStr, "DEFAULT"])
      .order("date", { ascending: false });

    if (data && data.length > 0) {
      const specific = data.find((r) => r.date === dateStr);
      if (specific) return rowToArenaSchedule(specific);
      const def = data.find((r) => r.date === "DEFAULT");
      if (def) return { ...rowToArenaSchedule(def), date: dateStr };
    }

    return {
      date: dateStr,
      isClosed: false,
      openTime: "06:00",
      closeTime: "23:00",
    };
  },

  async setArenaSchedule(
    schedule: { date: string; isClosed?: boolean; closureReason?: string; openTime?: string; closeTime?: string },
    actor: { id: string; role: string }
  ): Promise<ArenaSchedule> {
    const supabase = getSupabaseAdmin();
    const payload = {
      date: schedule.date,
      is_closed: schedule.isClosed ?? false,
      closure_reason: schedule.closureReason || null,
      open_time: schedule.openTime || "06:00",
      close_time: schedule.closeTime || "23:00",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("arena_schedules")
      .upsert(payload, { onConflict: "date" })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update arena schedule: ${error?.message}`);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "SET_ARENA_SCHEDULE",
      entityId: schedule.date,
      details: { schedule },
    });

    return rowToArenaSchedule(data);
  },

  // 4. PRUNING EXPIRED HOLDS AND UNVERIFIED BOOKINGS
  async pruneExpired(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // 1. Delete expired holds
    await supabase.from("slot_holds").delete().lt("expires_at", nowIso);

    // 2. Timeout unverified manual UPI bookings
    const ttlMinutes = Number(process.env.PENDING_PAYMENT_TTL_MINUTES || 30);
    const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();

    await supabase
      .from("bookings")
      .update({
        status: "CANCELLED",
        cancellation_reason: `Payment verification timed out (${ttlMinutes} minutes elapsed without staff approval).`,
        payment_rejection_reason: `Verification timed out after ${ttlMinutes} minutes.`,
        cancelled_at: nowIso,
        updated_at: nowIso,
      })
      .eq("status", "PENDING_VERIFICATION")
      .lte("created_at", cutoff);
  },

  // 5. AVAILABILITY CALCULATION
  async getAvailability(dateStr: string, courtId?: string) {
    await this.pruneExpired();
    const supabase = getSupabaseAdmin();

    const [allCourts, pricingConfig, schedule] = await Promise.all([
      this.getCourts(),
      this.getPricingConfig(),
      this.getArenaSchedule(dateStr),
    ]);

    const courts = courtId ? allCourts.filter((c) => c.id === courtId) : allCourts;

    if (schedule.isClosed) {
      return {
        date: dateStr,
        timezone: VENUE_TIMEZONE,
        dataUpdatedAt: new Date().toISOString(),
        isClosed: true,
        closureReason: schedule.closureReason || "Arena closed for holiday / maintenance.",
        openTime: schedule.openTime,
        closeTime: schedule.closeTime,
        pricingConfig,
        courts: courts.map((court) => ({
          courtId: court.id,
          courtNumber: court.courtNumber,
          courtName: court.name,
          basePricePerHour: court.basePricePerHour,
          slots: [],
        })),
      };
    }

    const openTime = schedule.openTime || "06:00";
    const closeTime = schedule.closeTime || "23:00";
    const [openH, openM] = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);

    const startMinutes = openH * 60 + (openM || 0);
    let endMinutes = closeH * 60 + (closeM || 0);
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

    let currentMin = startMinutes;
    while (currentMin + 30 <= endMinutes) {
      const slotStartMin = currentMin;
      const slotEndMin = currentMin + 30;

      const sDayOffset = Math.floor(slotStartMin / 1440);
      const sHour = Math.floor((slotStartMin % 1440) / 60);
      const sMin = slotStartMin % 60;

      const eDayOffset = Math.floor(slotEndMin / 1440);
      const eHour = Math.floor((slotEndMin % 1440) / 60);
      const eMin = slotEndMin % 60;

      const sLabel = `${sHour.toString().padStart(2, "0")}:${sMin.toString().padStart(2, "0")}`;
      const eLabel = `${eHour.toString().padStart(2, "0")}:${eMin.toString().padStart(2, "0")}`;

      const isPeak =
        pricingConfig.isPeakSurgeActive &&
        pricingConfig.peakHours &&
        pricingConfig.peakHours.some((ph) => ph.startsWith(sLabel.slice(0, 2)));

      slotIntervals.push({
        start: sLabel,
        end: eLabel,
        slotStartIso: buildVenueIso(dateStr, sHour, sMin, sDayOffset),
        slotEndIso: buildVenueIso(dateStr, eHour, eMin, eDayOffset),
        isPeak,
        displayLabel: `${sLabel} - ${eLabel}${sDayOffset > 0 ? " (+1d)" : ""}`,
      });

      currentMin += 30;
    }

    // Window for query: start of day to end of window
    const dayStartIso = slotIntervals[0]?.slotStartIso || buildVenueIso(dateStr, 0, 0);
    const dayEndIso = slotIntervals[slotIntervals.length - 1]?.slotEndIso || buildVenueIso(dateStr, 23, 59, 1);

    // Fetch existing bookings, holds, blocks in date window from Supabase
    const [{ data: bookingsData }, { data: holdsData }, { data: blocksData }] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .neq("status", "CANCELLED")
        .lt("start_time", dayEndIso)
        .gt("end_time", dayStartIso),
      supabase
        .from("slot_holds")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .lt("start_time", dayEndIso)
        .gt("end_time", dayStartIso),
      supabase
        .from("schedule_blocks")
        .select("*")
        .lt("start_time", dayEndIso)
        .gt("end_time", dayStartIso),
    ]);

    const activeBookings = (bookingsData || []).map(rowToBooking);
    const activeHolds = (holdsData || []).map(rowToSlotHold);
    const activeBlocks = (blocksData || []).map(rowToScheduleBlock);

    const now = new Date();
    const istDateString = new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TIMEZONE }).format(now);
    const istTimeString = new Intl.DateTimeFormat("en-GB", {
      timeZone: VENUE_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    const isPastDate = dateStr < istDateString;
    const isToday = dateStr === istDateString;

    const results = courts.map((court) => {
      const courtBookings = activeBookings.filter((b) => b.courtId === court.id);
      const courtHolds = activeHolds.filter((h) => h.courtId === court.id);
      const courtBlocks = activeBlocks.filter((bl) => bl.courtId === court.id);

      const slots = slotIntervals.map((interval) => {
        const isPastSlot = isPastDate || (isToday && interval.start <= istTimeString);

        const activeBooking = courtBookings.find((b) =>
          hasIntervalOverlap(interval.slotStartIso, interval.slotEndIso, b.startTime, b.endTime)
        );
        const activeHold = courtHolds.find((h) =>
          hasIntervalOverlap(interval.slotStartIso, interval.slotEndIso, h.startTime, h.endTime)
        );
        const activeBlock = courtBlocks.find((bl) =>
          hasIntervalOverlap(interval.slotStartIso, interval.slotEndIso, bl.startTime, bl.endTime)
        );

        let status = "AVAILABLE";
        if (isPastSlot) status = "PASSED";
        else if (activeBlock) status = "BLOCKED";
        else if (activeBooking) status = "BOOKED";
        else if (activeHold) status = "HELD";

        const hourlyRate = interval.isPeak
          ? pricingConfig.peakSurgePricePerHour || 550
          : court.basePricePerHour || pricingConfig.basePricePerHour || 400;
        const price = hourlyRate / 2;

        return {
          courtId: court.id,
          courtName: court.name,
          startTime: interval.slotStartIso,
          endTime: interval.slotEndIso,
          displayTime: interval.displayLabel,
          status,
          price,
          isPeak: interval.isPeak,
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
      timezone: VENUE_TIMEZONE,
      dataUpdatedAt: new Date().toISOString(),
      isClosed: false,
      openTime,
      closeTime,
      pricingConfig,
      courts: results,
    };
  },

  // 6. BOOKINGS
  async createBooking(params: {
    courtId: string;
    startTime: string;
    endTime: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    source: "ONLINE" | "PHONE" | "WALKIN";
    paymentStatus: Booking["paymentStatus"];
    paymentMethod?: Booking["paymentMethod"];
    paymentScreenshotUrl?: string;
    paymentUtr?: string;
    discountCode?: string;
    equipmentAddons?: Booking["equipmentAddons"];
    notes?: string;
    staffId?: string;
    sessionId?: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    await this.pruneExpired();
    const supabase = getSupabaseAdmin();

    const {
      courtId,
      startTime,
      endTime,
      customerName,
      customerPhone,
      customerEmail,
      source,
      paymentStatus,
      paymentMethod = "PAY_AT_VENUE",
      paymentScreenshotUrl,
      paymentUtr,
      discountCode,
      equipmentAddons,
      notes,
      staffId,
      sessionId,
    } = params;

    // Court validation
    const { data: courtData } = await supabase.from("courts").select("*").eq("id", courtId).maybeSingle();
    if (!courtData) {
      return { success: false, error: "Court does not exist." };
    }
    const court = rowToCourt(courtData);

    // Time validation
    if (new Date(startTime).getTime() <= Date.now()) {
      return { success: false, error: "Cannot book a time slot in the past. Please choose an upcoming slot." };
    }

    // Check duplicate UTR submission
    if (paymentUtr && paymentUtr.trim()) {
      const trimmedUtr = paymentUtr.trim();
      const { data: existingUtr } = await supabase
        .from("bookings")
        .select("id")
        .eq("payment_utr", trimmedUtr)
        .neq("status", "CANCELLED")
        .maybeSingle();

      if (existingUtr) {
        return {
          success: false,
          error: `A booking submission with UPI transaction ID / UTR '${trimmedUtr}' has already been received.`,
        };
      }
    }

    // Check booking conflict
    const { data: bookingConflicts } = await supabase
      .from("bookings")
      .select("id, start_time, end_time")
      .eq("court_id", courtId)
      .neq("status", "CANCELLED")
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (bookingConflicts && bookingConflicts.length > 0) {
      return { success: false, error: "Booking conflict: this court/interval has already been reserved." };
    }

    // Check hold conflict from other sessions
    let holdQuery = supabase
      .from("slot_holds")
      .select("id, session_id, start_time, end_time")
      .eq("court_id", courtId)
      .gt("expires_at", new Date().toISOString())
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (sessionId) {
      holdQuery = holdQuery.neq("session_id", sessionId);
    }
    const { data: holdConflicts } = await holdQuery;
    if (holdConflicts && holdConflicts.length > 0) {
      return { success: false, error: "Slot is currently held by another user in checkout." };
    }

    // Check block conflict
    const { data: blockConflicts } = await supabase
      .from("schedule_blocks")
      .select("id")
      .eq("court_id", courtId)
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (blockConflicts && blockConflicts.length > 0) {
      return { success: false, error: "Court is blocked for maintenance or tournament during this time." };
    }

    // Duration and pricing
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      return { success: false, error: "End time must be after start time." };
    }
    const diffMinutes = Math.round((endMs - startMs) / 60000);
    const validDurations = [30, 60, 90, 120, 150, 180];
    if (!validDurations.includes(diffMinutes)) {
      return { success: false, error: "Booking duration must be between 30 minutes and 3 hours in 30-minute increments." };
    }

    const pricingConfig = await this.getPricingConfig();
    const numHalfHours = Math.max(1, diffMinutes / 30);
    let basePrice = 0;

    for (let i = 0; i < numHalfHours; i++) {
      const chunkDate = new Date(startMs + i * 30 * 60000);
      const istHour = new Intl.DateTimeFormat("en-GB", {
        timeZone: VENUE_TIMEZONE,
        hour: "2-digit",
        hour12: false,
      }).format(chunkDate);

      const isPeakHour =
        pricingConfig.isPeakSurgeActive &&
        pricingConfig.peakHours &&
        pricingConfig.peakHours.some((ph) => ph.startsWith(istHour));

      const chunkHourlyRate = isPeakHour
        ? pricingConfig.peakSurgePricePerHour || 550
        : court.basePricePerHour || pricingConfig.basePricePerHour || 400;

      basePrice += chunkHourlyRate / 2;
    }

    // Equipment add-ons
    let addonsTotal = 0;
    if (equipmentAddons) {
      if (equipmentAddons.paddles) addonsTotal += equipmentAddons.paddles * 50;
      if (equipmentAddons.balls) addonsTotal += equipmentAddons.balls * 30;
      if (equipmentAddons.lights) addonsTotal += 100;
    }

    let subtotal = basePrice + addonsTotal;
    let discountAmount = 0;

    if (discountCode) {
      const { data: disc } = await supabase
        .from("discounts")
        .select("*")
        .eq("code", discountCode.trim().toUpperCase())
        .eq("is_active", true)
        .gte("valid_to", new Date().toISOString())
        .maybeSingle();

      if (disc && subtotal >= Number(disc.min_booking_amount || 0)) {
        if (disc.type === "PERCENT") {
          discountAmount = Math.round((subtotal * Number(disc.value)) / 100);
        } else {
          discountAmount = Math.min(Number(disc.value), subtotal);
        }
      }
    }

    const totalPrice = Math.max(0, subtotal - discountAmount);

    let finalStatus: Booking["status"] = "CONFIRMED";
    if (paymentMethod === "UPI_MANUAL" || paymentStatus === "PENDING") {
      finalStatus = "PENDING_VERIFICATION";
    }

    const newBookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const durationDisplay = formatDurationDisplay(diffMinutes);

    const bookingRow = {
      id: newBookingId,
      court_id: courtId,
      court_name: court.name,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: diffMinutes,
      duration_display: durationDisplay,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail?.trim() || null,
      source,
      status: finalStatus,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      payment_screenshot_url: paymentScreenshotUrl || null,
      payment_utr: paymentUtr?.trim() || null,
      payment_verified_by: null,
      payment_verified_at: null,
      payment_rejection_reason: null,
      total_price: totalPrice,
      discount_code: discountCode || null,
      discount_amount: discountAmount,
      equipment_addons: equipmentAddons || null,
      notes: notes?.trim() || null,
      cancellation_reason: null,
      cancelled_at: null,
      created_by_staff_id: staffId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from("bookings")
      .insert(bookingRow)
      .select()
      .single();

    if (insertError || !inserted) {
      console.error("Supabase insert booking error:", insertError);
      return { success: false, error: `Failed to save booking: ${insertError?.message || "Unknown error"}` };
    }

    // Clean up caller's hold if provided
    if (sessionId) {
      await supabase
        .from("slot_holds")
        .delete()
        .eq("court_id", courtId)
        .eq("session_id", sessionId)
        .lte("start_time", endTime)
        .gte("end_time", startTime);
    }

    await this.logAudit({
      actorId: staffId || "customer",
      actorRole: staffId ? "STAFF" : "CUSTOMER",
      action: "CREATE_BOOKING",
      entityId: newBookingId,
      details: { booking: bookingRow },
    });

    return { success: true, booking: rowToBooking(inserted) };
  },

  async getAllBookings(filter?: { phone?: string; date?: string; status?: string }): Promise<Booking[]> {
    await this.pruneExpired();
    const supabase = getSupabaseAdmin();
    let query = supabase.from("bookings").select("*").order("start_time", { ascending: false });

    if (filter?.phone) {
      const cleanPhone = filter.phone.replace(/\D/g, "");
      if (cleanPhone) {
        query = query.ilike("customer_phone", `%${cleanPhone.slice(-10)}%`);
      }
    }
    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.date) {
      const dayStart = buildVenueIso(filter.date, 0, 0);
      const dayEnd = buildVenueIso(filter.date, 23, 59, 1);
      query = query.gte("start_time", dayStart).lte("start_time", dayEnd);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error("Supabase getAllBookings error:", error);
      return [];
    }
    return data.map(rowToBooking);
  },

  async getBookingById(bookingId: string): Promise<Booking | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (error || !data) return null;
    return rowToBooking(data);
  },

  async updateBookingPayment(params: {
    bookingId: string;
    paymentStatus: Booking["paymentStatus"];
    actorRole: string;
    actorId: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("bookings")
      .update({
        payment_status: params.paymentStatus,
        updated_at: nowIso,
      })
      .eq("id", params.bookingId)
      .select()
      .single();

    if (error || !updated) {
      return { success: false, error: error?.message || "Failed to update payment status." };
    }

    await this.logAudit({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: "UPDATE_BOOKING_PAYMENT",
      entityId: params.bookingId,
      details: { paymentStatus: params.paymentStatus },
    });

    return { success: true, booking: rowToBooking(updated) };
  },

  async verifyBookingPayment(params: {
    bookingId: string;
    action: "APPROVE" | "REJECT";
    actor: { id: string; role: string };
    rejectionReason?: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    if (params.actor.role !== "OWNER" && params.actor.role !== "EMPLOYEE") {
      return { success: false, error: "Forbidden: Staff or Owner access required." };
    }

    await this.pruneExpired();
    const supabase = getSupabaseAdmin();

    const { data: row } = await supabase.from("bookings").select("*").eq("id", params.bookingId).maybeSingle();
    if (!row) {
      return { success: false, error: "Booking not found." };
    }

    const booking = rowToBooking(row);
    if (booking.status !== "PENDING_VERIFICATION") {
      return { success: false, error: `Booking is in '${booking.status}' status and cannot be verified.` };
    }

    const nowIso = new Date().toISOString();

    if (params.action === "APPROVE") {
      if (new Date(booking.startTime).getTime() <= Date.now()) {
        return { success: false, error: "Cannot approve booking: the scheduled slot has already passed." };
      }

      // Recheck conflict against other confirmed bookings
      const { data: conflicts } = await supabase
        .from("bookings")
        .select("id")
        .neq("id", booking.id)
        .eq("court_id", booking.courtId)
        .in("status", ["CONFIRMED", "COMPLETED"])
        .lt("start_time", booking.endTime)
        .gt("end_time", booking.startTime);

      if (conflicts && conflicts.length > 0) {
        return {
          success: false,
          error: "Cannot approve: this slot was already confirmed for another booking in the meantime.",
        };
      }

      const { data: updated, error: updateErr } = await supabase
        .from("bookings")
        .update({
          status: "CONFIRMED",
          payment_status: "PAID_ONLINE",
          payment_verified_by: params.actor.id,
          payment_verified_at: nowIso,
          payment_rejection_reason: null,
          updated_at: nowIso,
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (updateErr || !updated) {
        return { success: false, error: updateErr?.message || "Failed to update booking status." };
      }

      await this.logAudit({
        actorId: params.actor.id,
        actorRole: params.actor.role,
        action: "APPROVE_MANUAL_PAYMENT",
        entityId: booking.id,
        details: { bookingId: booking.id, amount: booking.totalPrice, utr: booking.paymentUtr },
      });

      return { success: true, booking: rowToBooking(updated) };
    } else {
      // REJECT
      const reason = params.rejectionReason?.trim() || "Payment verification declined by staff.";
      const { data: updated, error: updateErr } = await supabase
        .from("bookings")
        .update({
          status: "CANCELLED",
          payment_status: "PENDING",
          payment_rejection_reason: reason,
          cancellation_reason: `Payment verification rejected: ${reason}`,
          cancelled_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (updateErr || !updated) {
        return { success: false, error: updateErr?.message || "Failed to reject booking." };
      }

      await this.logAudit({
        actorId: params.actor.id,
        actorRole: params.actor.role,
        action: "REJECT_MANUAL_PAYMENT",
        entityId: booking.id,
        details: { bookingId: booking.id, reason },
      });

      return { success: true, booking: rowToBooking(updated) };
    }
  },

  async cancelBooking(params: {
    bookingId: string;
    actor: { id: string; role: string };
    cancellationReason?: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase.from("bookings").select("*").eq("id", params.bookingId).maybeSingle();
    if (!row) {
      return { success: false, error: "Booking not found." };
    }

    const booking = rowToBooking(row);
    if (booking.status === "CANCELLED") {
      return { success: false, error: "Booking is already cancelled." };
    }

    const nowIso = new Date().toISOString();
    const reason = params.cancellationReason?.trim() || "Cancelled by user or staff.";

    const { data: updated, error } = await supabase
      .from("bookings")
      .update({
        status: "CANCELLED",
        cancellation_reason: reason,
        cancelled_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", booking.id)
      .select()
      .single();

    if (error || !updated) {
      return { success: false, error: error?.message || "Failed to cancel booking." };
    }

    await this.logAudit({
      actorId: params.actor.id,
      actorRole: params.actor.role,
      action: "CANCEL_BOOKING",
      entityId: booking.id,
      details: { reason },
    });

    return { success: true, booking: rowToBooking(updated) };
  },

  // 7. SLOT HOLDS
  async placeHold(params: {
    courtId: string;
    startTime: string;
    endTime: string;
    sessionId: string;
    holdMinutes?: number;
  }): Promise<{ success: boolean; hold?: SlotHold; error?: string }> {
    await this.pruneExpired();
    const supabase = getSupabaseAdmin();

    const { courtId, startTime, endTime, sessionId, holdMinutes = 5 } = params;

    // Check conflict with bookings
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("court_id", courtId)
      .neq("status", "CANCELLED")
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (bookings && bookings.length > 0) {
      return { success: false, error: "Slot is already booked." };
    }

    // Check conflict with other holds
    const { data: otherHolds } = await supabase
      .from("slot_holds")
      .select("id")
      .eq("court_id", courtId)
      .neq("session_id", sessionId)
      .gt("expires_at", new Date().toISOString())
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (otherHolds && otherHolds.length > 0) {
      return { success: false, error: "Slot is already held by another user." };
    }

    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();
    const holdId = `hld-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const { data: inserted, error } = await supabase
      .from("slot_holds")
      .insert({
        id: holdId,
        court_id: courtId,
        session_id: sessionId,
        start_time: startTime,
        end_time: endTime,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !inserted) {
      return { success: false, error: error?.message || "Failed to place slot hold." };
    }

    return { success: true, hold: rowToSlotHold(inserted) };
  },

  async releaseHold(params: {
    holdId?: string;
    courtId?: string;
    startTime?: string;
    sessionId?: string;
  }): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    let query = supabase.from("slot_holds").delete();

    if (params.holdId) {
      query = query.eq("id", params.holdId);
    } else {
      if (params.courtId) query = query.eq("court_id", params.courtId);
      if (params.startTime) query = query.eq("start_time", params.startTime);
      if (params.sessionId) query = query.eq("session_id", params.sessionId);
    }

    await query;
    return true;
  },

  // 8. SCHEDULE BLOCKS
  async getScheduleBlocks(): Promise<ScheduleBlock[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("schedule_blocks").select("*").order("start_time", { ascending: true });
    if (error || !data) return [];
    return data.map(rowToScheduleBlock);
  },

  async createScheduleBlock(
    block: { courtId: string; startTime: string; endTime: string; reason: ScheduleBlock["reason"]; notes?: string },
    actor: { id: string; role: string }
  ): Promise<ScheduleBlock> {
    const supabase = getSupabaseAdmin();
    const id = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({
        id,
        court_id: block.courtId,
        start_time: block.startTime,
        end_time: block.endTime,
        reason: block.reason,
        notes: block.notes || null,
        created_by: actor.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create block: ${error?.message}`);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "CREATE_SCHEDULE_BLOCK",
      entityId: id,
      details: { block },
    });

    return rowToScheduleBlock(data);
  },

  async deleteScheduleBlock(blockId: string, actor: { id: string; role: string }): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("schedule_blocks").delete().eq("id", blockId);
    if (error) {
      throw new Error(`Failed to delete block: ${error.message}`);
    }

    await this.logAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "DELETE_SCHEDULE_BLOCK",
      entityId: blockId,
      details: {},
    });

    return true;
  },

  // 9. APP USERS / AUTH
  async authenticateUser(identifier: string, password: string): Promise<{
    success: boolean;
    user?: Omit<UserAccount, "passwordHash">;
    redirectUrl?: string;
    token?: string;
    error?: string;
  }> {
    const supabase = getSupabaseAdmin();
    const cleanId = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/\D/g, "");

    const { data: users, error } = await supabase
      .from("app_users")
      .select("*");

    if (error || !users || users.length === 0) {
      return { success: false, error: "No account found matching this email or phone number." };
    }

    const userRow = users.find(
      (u: any) =>
        u.email.toLowerCase() === cleanId ||
        (cleanPhone.length >= 10 && u.phone.replace(/\D/g, "").includes(cleanPhone))
    );

    if (!userRow) {
      return { success: false, error: "No account found matching this email or phone number." };
    }

    if (userRow.password_hash !== password) {
      return { success: false, error: "Invalid password. Please check your credentials." };
    }

    let redirectUrl = "/";
    if (userRow.role === "OWNER") redirectUrl = "/admin";
    else if (userRow.role === "EMPLOYEE") redirectUrl = "/staff";
    else redirectUrl = "/profile";

    const token = `boss_tk_${userRow.role.toLowerCase()}_${userRow.id}_${Date.now()}`;
    const user = rowToAppUser(userRow);
    const { passwordHash: _dropped, ...safeUser } = user;

    return {
      success: true,
      user: safeUser,
      redirectUrl,
      token,
    };
  },

  async getUserById(userId: string): Promise<Omit<UserAccount, "passwordHash"> | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("app_users").select("*").eq("id", userId).maybeSingle();
    if (!data) return null;
    const user = rowToAppUser(data);
    const { passwordHash: _dropped, ...safeUser } = user;
    return safeUser;
  },

  // 10. VENUE REPORTS
  async getPickleballReport() {
    await this.pruneExpired();
    const bookings = await this.getAllBookings();

    const validBookings = bookings.filter((b) => b.status !== "CANCELLED");
    const confirmedBookings = validBookings.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");
    const pendingVerifications = validBookings.filter((b) => b.status === "PENDING_VERIFICATION");

    const onlineRevenue = confirmedBookings
      .filter((b) => b.paymentStatus === "PAID_ONLINE")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const cashRevenue = confirmedBookings
      .filter((b) => b.paymentStatus === "CASH_COUNTER")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const upiCounterRevenue = confirmedBookings
      .filter((b) => b.paymentStatus === "UPI_COUNTER")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);

    const realizedRevenue = onlineRevenue + cashRevenue + upiCounterRevenue;

    const pendingVenuePayment = confirmedBookings
      .filter((b) => b.paymentStatus === "PAY_AT_VENUE")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);

    const unverifiedPendingRevenue = pendingVerifications.reduce((sum, b) => sum + Number(b.totalPrice), 0);

    const totalHoursBooked = confirmedBookings.reduce((sum, b) => sum + (b.durationMinutes || 60) / 60, 0);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalConfirmedBookings: confirmedBookings.length,
        totalPendingVerifications: pendingVerifications.length,
        totalCancelledBookings: bookings.filter((b) => b.status === "CANCELLED").length,
        realizedRevenue,
        onlineRevenue,
        cashRevenue,
        upiCounterRevenue,
        pendingVenuePayment,
        unverifiedPendingRevenue,
        totalHoursBooked,
      },
    };
  },

  // 11. AUDIT LOGGING
  async logAudit(entry: {
    actorId: string;
    actorRole: string;
    action: string;
    entityId?: string;
    details: Record<string, any>;
  }): Promise<void> {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("audit_logs").insert({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        actor_id: entry.actorId,
        actor_role: entry.actorRole,
        action: entry.action,
        entity_id: entry.entityId || null,
        details: entry.details,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Audit logging to Supabase failed:", e);
    }
  },
};
