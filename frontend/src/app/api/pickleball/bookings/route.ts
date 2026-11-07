import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const date = searchParams.get("date");

    if (phone) {
      const history = pickleballDb.getBookingsByPhone(phone);
      return NextResponse.json({
        success: true,
        bookings: history,
      });
    }

    // Default: Return all bookings or filtered by date
    const all = pickleballDb.getAllBookings();
    const filtered = date
      ? all.filter((b) => b.startTime.startsWith(date))
      : all;

    return NextResponse.json({
      success: true,
      bookings: filtered,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

