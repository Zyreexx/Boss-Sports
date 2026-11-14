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
    const body = await req.json();
    const {
      courtId,
      startTime,
      endTime,
      customerName,
      customerPhone,
      customerEmail,
      source = "ONLINE",
      discountCode,
      equipmentAddons,
      notes,
      sessionId,
      staffId,
    } = body;

    if (!courtId || !startTime || !endTime || !customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: "Missing required booking details (court, time, name, phone)" },
        { status: 400 }
      );
    }

    // Reject bookings for time slots that have already passed
    if (new Date(startTime).getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, error: "Cannot book a time slot in the past. Please select an upcoming slot." },
        { status: 400 }
      );
    }

    // Server-Side Payment & Security Verification
    const sessionActor = getAuthenticatedActor(req);
    const isStaffOrOwner = sessionActor?.role === "OWNER" || sessionActor?.role === "EMPLOYEE";

    // Enforce booking source: WALKIN or PHONE allowed ONLY from authenticated OWNER or EMPLOYEE sessions.
    // For unauthenticated callers or customers, source is strictly forced to ONLINE.
    const sanitizedSource: "ONLINE" | "PHONE" | "WALKIN" =
      isStaffOrOwner && (source === "WALKIN" || source === "PHONE")
        ? source
        : "ONLINE";

    // Derive staffId strictly from the authenticated session, never from client body
    const sanitizedStaffId = isStaffOrOwner ? sessionActor?.id : undefined;

    let sanitizedPaymentStatus:
      | "PAID_ONLINE"
      | "CASH_COUNTER"
      | "UPI_COUNTER"
      | "PAY_AT_VENUE"
      | "PENDING" = "PAY_AT_VENUE";
    let sanitizedPaymentMethod: "PAY_AT_VENUE" | "UPI_MANUAL" | "RAZORPAY" | "UPI" | "CASH" = "PAY_AT_VENUE";
    let paymentScreenshotUrl: string | undefined = undefined;
    let paymentUtr: string | undefined = undefined;

    if (body.paymentMethod === "UPI_MANUAL" || body.paymentStatus === "PENDING") {
      if (!body.paymentScreenshotUrl) {
        return NextResponse.json(
          { success: false, error: "Payment screenshot is required for online UPI verification." },
          { status: 400 }
        );
      }
      sanitizedPaymentMethod = "UPI_MANUAL";
      sanitizedPaymentStatus = "PENDING";
      paymentScreenshotUrl = String(body.paymentScreenshotUrl).trim();
      paymentUtr = body.paymentUtr ? String(body.paymentUtr).trim() : undefined;
    } else if (isStaffOrOwner && (sanitizedSource === "WALKIN" || sanitizedSource === "PHONE")) {
      // Authenticated staff can set desk payments
      if (body.paymentStatus === "CASH_COUNTER" || body.paymentStatus === "UPI_COUNTER" || body.paymentStatus === "PAID_ONLINE") {
        sanitizedPaymentStatus = body.paymentStatus;
        sanitizedPaymentMethod =
          body.paymentStatus === "CASH_COUNTER"
            ? "CASH"
            : body.paymentStatus === "PAID_ONLINE"
              ? "UPI_MANUAL"
              : "UPI";
      } else {
        sanitizedPaymentStatus = "PAY_AT_VENUE";
        sanitizedPaymentMethod = "PAY_AT_VENUE";
      }
    } else {
      // Public online bookings CANNOT forge 'PAID_ONLINE' without verified payment gateway signature
      sanitizedPaymentStatus = "PAY_AT_VENUE";
      sanitizedPaymentMethod = "PAY_AT_VENUE";
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/pickleball/book/",
        method: "POST",
        body: {
          courtId,
          startTime,
          endTime,
          customerName,
          customerPhone,
          customerEmail,
          source: sanitizedSource,
          paymentStatus: sanitizedPaymentStatus,
          paymentMethod: sanitizedPaymentMethod,
          paymentScreenshotUrl,
          paymentUtr,
          discountCode,
          equipmentAddons,
          notes,
          sessionId,
        },
        actor: sessionActor,
      });
      return toProxyJsonResponse(upstream);
    }

    let result: { success: boolean; booking?: any; error?: string };

    if (isSupabaseConfigured()) {
      result = await supabaseDb.createBooking({
        courtId,
        startTime,
        endTime,
        customerName,
        customerPhone,
        customerEmail,
        source: sanitizedSource,
        paymentStatus: sanitizedPaymentStatus,
        paymentMethod: sanitizedPaymentMethod,
        paymentScreenshotUrl,
        paymentUtr,
        discountCode,
        equipmentAddons,
        notes,
        sessionId,
        staffId: sanitizedStaffId,
      });
    } else {
      if (isLocalJsonFallbackDisabled()) {
        return getBackendMisconfiguredResponse();
      }

      result = pickleballDb.createBooking({
        courtId,
        startTime,
        endTime,
        customerName,
        customerPhone,
        customerEmail,
        source: sanitizedSource,
        paymentStatus: sanitizedPaymentStatus,
        paymentMethod: sanitizedPaymentMethod,
        paymentScreenshotUrl,
        paymentUtr,
        discountCode,
        equipmentAddons,
        notes,
        sessionId,
        staffId: sanitizedStaffId,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 }
      );
    }

    const confirmationMessage =
      result.booking?.status === "PENDING_VERIFICATION"
        ? "Booking submitted for payment verification! Our staff will verify your UPI payment and confirm your slot."
        : "Pickleball court successfully booked! Pay at reception before your match.";

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: confirmationMessage,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to confirm booking" },
      { status: 500 }
    );
  }
}
