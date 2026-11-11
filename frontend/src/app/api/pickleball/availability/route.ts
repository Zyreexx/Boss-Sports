import { NextRequest, NextResponse } from "next/server";
import { pickleballDb, getVenueTodayDate } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
} from "@/lib/backend/djangoClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = getAuthenticatedActor(req);
    const isStaffOrOwner = actor && (actor.role === "OWNER" || actor.role === "EMPLOYEE");

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getVenueTodayDate();
    const courtId = searchParams.get("courtId") || undefined;

    if (isDjangoBackendConfigured()) {
      const qs = new URLSearchParams({ date });
      if (courtId) qs.set("courtId", courtId);
      const upstream = await callDjangoApi({
        path: `/api/pickleball/availability/?${qs.toString()}`,
        method: "GET",
        actor,
      });
      return toProxyJsonResponse(upstream, {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      });
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const courts = pickleballDb.getCourts();
    const result = pickleballDb.getAvailability(date, courtId);

    // Strip customer PII from public availability feed
    const sanitizedAvailability = result.courts.map((c: any) => ({
      ...c,
      slots: (c.slots || []).map((s: any) => {
        if (isStaffOrOwner) return s;
        return {
          courtId: s.courtId,
          courtName: s.courtName,
          startTime: s.startTime,
          endTime: s.endTime,
          displayTime: s.displayTime,
          status: s.status,
          price: s.price,
          isPeak: s.isPeak,
          heldUntil: s.heldUntil,
          blockReason: s.blockReason,
        };
      }),
    }));

    // If courtId is specified, pick that court; otherwise default to first court
    const targetCourt = courtId
      ? sanitizedAvailability.find((c: any) => c.courtId === courtId)
      : sanitizedAvailability[0];

    const rawSlots = targetCourt?.slots || [];
    const formattedSlots = rawSlots.map((s: any) => ({
      slotId: `${s.courtId}-${s.startTime}`,
      timeLabel: s.displayTime,
      startTime: s.startTime,
      endTime: s.endTime,
      isAvailable: s.status === "AVAILABLE",
      status: s.status,
      price: s.price,
      isPeak: s.isPeak || false,
      courtId: s.courtId,
      courtName: s.courtName,
      heldUntil: s.heldUntil,
    }));

    return NextResponse.json(
      {
        success: true,
        date,
        timezone: result.timezone,
        dataUpdatedAt: result.dataUpdatedAt,
        courts,
        isClosed: result.isClosed || false,
        closureReason: result.closureReason || null,
        openTime: result.openTime || "06:00",
        closeTime: result.closeTime || "23:00",
        pricingConfig: result.pricingConfig,
        slots: formattedSlots,
        availability: sanitizedAvailability,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
