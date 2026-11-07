import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, phone, reason, staffId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "Missing bookingId parameter" },
        { status: 400 }
      );
    }

    const role = staffId ? "STAFF" : "CUSTOMER";
    const actorId = staffId || phone || "anonymous";

    const result = pickleballDb.cancelBooking(
      bookingId,
      reason || "Cancelled by customer/staff",
      role,
      actorId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: "Booking cancelled successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel booking" },
      { status: 500 }
    );
  }
}
