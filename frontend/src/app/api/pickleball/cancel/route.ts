import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = getAuthenticatedActor(req);
    if (!actor) {
      return NextResponse.json(
        { success: false, error: "Authentication required to cancel bookings. Please sign in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { bookingId, reason } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "Missing bookingId parameter" },
        { status: 400 }
      );
    }

    const isStaffOrOwner = actor.role === "OWNER" || actor.role === "EMPLOYEE";

    // Verify booking existence and ownership
    const booking = pickleballDb.getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found or access denied." },
        { status: 403 }
      );
    }

    if (!isStaffOrOwner) {
      // Customer cancellation: verify identity against the booking on the server
      const cleanPhone = (p?: string) => (p || "").replace(/\D/g, "").slice(-10);
      const actorPhone = cleanPhone(actor.phone);
      const bookingPhone = cleanPhone(booking.customerPhone);
      const phoneMatches = Boolean(actorPhone && bookingPhone && actorPhone === bookingPhone);
      const emailMatches = Boolean(
        actor.email &&
          booking.customerEmail &&
          actor.email.trim().toLowerCase() === booking.customerEmail.trim().toLowerCase()
      );

      if (!phoneMatches && !emailMatches) {
        // Return a generic authorization error when booking doesn't belong to requester
        return NextResponse.json(
          { success: false, error: "Booking not found or access denied." },
          { status: 403 }
        );
      }
    }

    const actorRole = isStaffOrOwner
      ? (actor.role === "OWNER" ? "OWNER" : "STAFF")
      : "CUSTOMER";
    const actorId = actor.id;

    const result = pickleballDb.cancelBooking(
      bookingId,
      reason || (isStaffOrOwner ? "Cancelled by staff/admin" : "Cancelled by customer"),
      actorRole,
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
      refundable: result.refundable,
      message: "Booking cancelled successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel booking" },
      { status: 500 }
    );
  }
}
