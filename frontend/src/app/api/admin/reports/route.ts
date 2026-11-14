import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole } from "@/lib/auth/serverAuth";
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

export async function GET(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/admin/reports/",
        method: "GET",
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream, {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      });
    }

    if (isSupabaseConfigured()) {
      const report = await supabaseDb.getPickleballReport();
      const s = report.summary;

      return NextResponse.json(
        {
          success: true,
          timestamp: report.generatedAt,
          summary: {
            grandTotalRevenue: s.realizedRevenue,
            realizedRevenue: s.realizedRevenue,
            grossBookedValue: s.grossBookedValue ?? (s.realizedRevenue + s.pendingVenuePayment),
            pendingVenuePayment: s.pendingVenuePayment,
            totalCashReconciliation: s.cashRevenue,
            totalUpiReconciliation: s.upiCounterRevenue,
            totalOnlineReconciliation: s.onlineRevenue,
            totalBookings: report.totalBookings ?? s.totalConfirmedBookings,
            confirmedBookings: report.confirmedBookings ?? s.totalConfirmedBookings,
            totalPendingVerifications: s.totalPendingVerifications,
            pendingVerificationsCount: s.pendingVerificationsCount ?? s.totalPendingVerifications ?? 0,
            pendingVerificationValue: report.pendingVerificationValue ?? 0,
            totalCancelledBookings: s.totalCancelledBookings,
            activeHolds: 0,
          },
          pickleballDatabase: report,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const pickleball = pickleballDb.getPickleballReport();

    const realizedRevenue = pickleball.realizedRevenue ?? pickleball.totalRevenue ?? 0;
    const pendingVenuePayment = pickleball.pendingVenuePayment ?? 0;
    const grossBookedValue = pickleball.grossBookedValue ?? (realizedRevenue + pendingVenuePayment);
    const totalCashReconciliation = pickleball.cashRevenue || 0;
    const totalUpiReconciliation = pickleball.upiCounterRevenue || 0;
    const totalOnlineReconciliation = pickleball.onlineRevenue || 0;

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          grandTotalRevenue: realizedRevenue,
          realizedRevenue,
          grossBookedValue,
          pendingVenuePayment,
          totalCashReconciliation,
          totalUpiReconciliation,
          totalOnlineReconciliation,
          totalBookings: pickleball.totalBookings || 0,
          confirmedBookings: pickleball.confirmedBookings || pickleball.totalBookings || 0,
          pendingVerificationsCount: pickleball.pendingVerificationsCount || 0,
          pendingVerificationValue: pickleball.pendingVerificationValue || 0,
          activeHolds: pickleball.activeHoldsCount || 0,
        },
        pickleballDatabase: pickleball,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate audit report" },
      { status: 500 }
    );
  }
}
