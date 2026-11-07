import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";

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

    // Server-Side Payment & Security Verification
    const sessionActor = getAuthenticatedActor(req);
    const isStaffOrOwner = sessionActor?.role === "OWNER" || sessionActor?.role === "EMPLOYEE";

    let sanitizedPaymentStatus:
      | "PAID_ONLINE"
      | "CASH_COUNTER"
      | "UPI_COUNTER"
      | "PAY_AT_VENUE"
      | "PENDING" = "PAY_AT_VENUE";

    if (isStaffOrOwner && (source === "WALKIN" || source === "PHONE")) {
      // Authenticated staff can set desk payments
      if (body.paymentStatus === "CASH_COUNTER" || body.paymentStatus === "UPI_COUNTER") {
        sanitizedPaymentStatus = body.paymentStatus;
      } else {
        sanitizedPaymentStatus = "PAY_AT_VENUE";
      }
    } else {
      // Public online bookings CANNOT forge 'PAID_ONLINE' without verified payment gateway signature
      sanitizedPaymentStatus = "PAY_AT_VENUE";
    }

    const result = pickleballDb.createBooking({
      courtId,
      startTime,
      endTime,
      customerName,
      customerPhone,
      customerEmail,
      source: isStaffOrOwner ? source : "ONLINE",
      paymentStatus: sanitizedPaymentStatus,
      discountCode,
      equipmentAddons,
      notes,
      sessionId,
      staffId: isStaffOrOwner ? sessionActor?.id : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: "Pickleball court successfully booked! Pay at reception before your match.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to confirm booking" },
      { status: 500 }
    );
  }
}
