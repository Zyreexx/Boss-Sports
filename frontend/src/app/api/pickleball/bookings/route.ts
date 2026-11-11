import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = getAuthenticatedActor(req);
    if (!actor) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required to view reservations. Please sign in to your account. (Note: Direct phone lookup without login requires an integrated SMS OTP provider such as Twilio or MSG91).",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedPhone = searchParams.get("phone");
    const date = searchParams.get("date");

    const isStaffOrOwner = actor.role === "OWNER" || actor.role === "EMPLOYEE";

    if (isStaffOrOwner) {
      // Authenticated staff or owner can search by phone or date across all reservations
      if (requestedPhone) {
        const history = pickleballDb.getBookingsByPhone(requestedPhone);
        return NextResponse.json({ success: true, bookings: history });
      }

      const all = pickleballDb.getAllBookings();
      const filtered = date ? all.filter((b) => b.startTime.startsWith(date)) : all;
      return NextResponse.json({ success: true, bookings: filtered });
    }

    // Authenticated CUSTOMER: strictly isolated to their own verified reservations
    const cleanPhone = (p?: string) => (p || "").replace(/\D/g, "").slice(-10);
    const actorPhone = cleanPhone(actor.phone);
    const actorEmail = (actor.email || "").trim().toLowerCase();

    const all = pickleballDb.getAllBookings();
    const customerBookings = all.filter((b) => {
      const bPhone = cleanPhone(b.customerPhone);
      const bEmail = (b.customerEmail || "").trim().toLowerCase();
      const phoneMatches = Boolean(actorPhone && bPhone && actorPhone === bPhone);
      const emailMatches = Boolean(actorEmail && bEmail && actorEmail === bEmail);
      return phoneMatches || emailMatches;
    });

    const filtered = date
      ? customerBookings.filter((b) => b.startTime.startsWith(date))
      : customerBookings;

    return NextResponse.json({
      success: true,
      bookings: filtered,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
