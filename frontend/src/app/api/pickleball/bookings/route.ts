import { NextRequest, NextResponse } from "next/server";
import { pickleballDb, VENUE_TIMEZONE } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor, enforceRole } from "@/lib/auth/serverAuth";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
} from "@/lib/backend/djangoClient";

export const dynamic = "force-dynamic";

function toVenueDateString(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TIMEZONE }).format(new Date(isoStr));
  } catch {
    return isoStr.slice(0, 10);
  }
}

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

    if (isDjangoBackendConfigured()) {
      const qs = new URLSearchParams();
      if (requestedPhone) qs.set("phone", requestedPhone);
      if (date) qs.set("date", date);
      const q = qs.toString();
      const upstream = await callDjangoApi({
        path: `/api/pickleball/bookings/${q ? `?${q}` : ""}`,
        method: "GET",
        actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const isStaffOrOwner = actor.role === "OWNER" || actor.role === "EMPLOYEE";

    if (isStaffOrOwner) {
      // Authenticated staff or owner can search by phone or date across all reservations
      if (requestedPhone) {
        const history = pickleballDb.getBookingsByPhone(requestedPhone);
        return NextResponse.json(
          { success: true, bookings: history },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      const all = pickleballDb.getAllBookings();
      const filtered = date ? all.filter((b) => toVenueDateString(b.startTime) === date) : all;
      return NextResponse.json(
        { success: true, bookings: filtered },
        { headers: { "Cache-Control": "no-store" } }
      );
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
      ? customerBookings.filter((b) => toVenueDateString(b.startTime) === date)
      : customerBookings;

    return NextResponse.json(
      {
        success: true,
        bookings: filtered,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { bookingId, paymentStatus } = body;

    if (!bookingId || !paymentStatus) {
      return NextResponse.json(
        { success: false, error: "bookingId and paymentStatus are required" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["CASH_COUNTER", "UPI_COUNTER", "PAID_ONLINE"];
    if (!allowedStatuses.includes(paymentStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid paymentStatus value" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/pickleball/bookings/",
        method: "PATCH",
        body: { bookingId, paymentStatus },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const actorRole = auth.actor.role === "OWNER" ? "OWNER" : "STAFF";
    const result = pickleballDb.updateBookingPayment({
      bookingId,
      paymentStatus,
      actorRole,
      actorId: auth.actor.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to update payment status" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: `Payment recorded as ${paymentStatus.replace("_", " ")}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update booking payment" },
      { status: 500 }
    );
  }
}
