import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { supabaseDb } from "@/lib/supabase/supabaseDb";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
} from "@/lib/backend/djangoClient";

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

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/pickleball/cancel/",
        method: "POST",
        body: { bookingId, reason },
        actor,
      });
      return toProxyJsonResponse(upstream);
    }

    const isStaffOrOwner = actor.role === "OWNER" || actor.role === "EMPLOYEE";

    if (isSupabaseConfigured()) {
      const booking = await supabaseDb.getBookingById(bookingId);
      if (!booking) {
        return NextResponse.json(
          { success: false, error: "Booking not found or access denied." },
          { status: 403 }
        );
      }

      if (!isStaffOrOwner) {
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
          return NextResponse.json(
            { success: false, error: "Booking not found or access denied." },
            { status: 403 }
          );
        }
      }

      const actorRole = isStaffOrOwner ? (actor.role === "OWNER" ? "OWNER" : "STAFF") : "CUSTOMER";
      const result = await supabaseDb.cancelBooking({
        bookingId,
        actor: { id: actor.id, role: actorRole },
        cancellationReason: reason || (isStaffOrOwner ? "Cancelled by staff/admin" : "Cancelled by customer"),
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        booking: result.booking,
        message: "Booking successfully cancelled. Slot has been freed for reservation.",
      });
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

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
