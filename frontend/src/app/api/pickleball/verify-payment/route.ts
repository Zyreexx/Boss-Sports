import { NextRequest, NextResponse } from "next/server";
import { enforceRole } from "@/lib/auth/serverAuth";
import { pickleballDb } from "@/lib/db/pickleballDb";
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
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { bookingId, action, rejectionReason } = body;

    if (!bookingId || !action) {
      return NextResponse.json(
        { success: false, error: "bookingId and action (APPROVE or REJECT) are required." },
        { status: 400 }
      );
    }

    const cleanAction = String(action).toUpperCase();
    if (cleanAction !== "APPROVE" && cleanAction !== "REJECT") {
      return NextResponse.json(
        { success: false, error: "Action must be 'APPROVE' or 'REJECT'." },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/pickleball/verify-payment/",
        method: "POST",
        body: {
          bookingId,
          action: cleanAction,
          rejectionReason,
        },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    let result: { success: boolean; booking?: any; error?: string };

    if (isSupabaseConfigured()) {
      result = await supabaseDb.verifyBookingPayment({
        bookingId,
        action: cleanAction as "APPROVE" | "REJECT",
        actor: { id: auth.actor.id, role: auth.actor.role },
        rejectionReason,
      });
    } else {
      if (isLocalJsonFallbackDisabled()) {
        return getBackendMisconfiguredResponse();
      }

      result = pickleballDb.verifyBookingPayment({
        bookingId,
        action: cleanAction as "APPROVE" | "REJECT",
        actor: { id: auth.actor.id, role: auth.actor.role },
        rejectionReason,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message:
        cleanAction === "APPROVE"
          ? "Payment approved! Booking is now confirmed and recorded."
          : "Payment rejected. Slot has been released.",
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify payment." },
      { status: 500 }
    );
  }
}
