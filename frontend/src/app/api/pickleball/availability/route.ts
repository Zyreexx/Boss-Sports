import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const courtId = searchParams.get("courtId") || undefined;

    const courts = pickleballDb.getCourts();
    const result = pickleballDb.getAvailability(date, courtId);

    // If courtId is specified, pick that court; otherwise default to first court
    const targetCourt = courtId
      ? result.courts.find((c: any) => c.courtId === courtId)
      : result.courts[0];

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
    }));

    return NextResponse.json({
      success: true,
      date,
      courts,
      isClosed: result.isClosed || false,
      closureReason: result.closureReason || null,
      openTime: result.openTime || "06:00",
      closeTime: result.closeTime || "23:00",
      pricingConfig: result.pricingConfig,
      slots: formattedSlots,
      availability: result.courts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
