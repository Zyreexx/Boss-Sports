import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER"]);
    if (!auth.authorized) {
      return auth.response!;
    }

    const pickleball = pickleballDb.getPickleballReport();

    const grandTotalRevenue = pickleball.totalRevenue || 0;
    const totalCashReconciliation = pickleball.cashRevenue || 0;
    const totalUpiReconciliation = pickleball.upiCounterRevenue || 0;
    const totalOnlineReconciliation = pickleball.onlineRevenue || 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        grandTotalRevenue,
        totalCashReconciliation,
        totalUpiReconciliation,
        totalOnlineReconciliation,
        totalBookings: pickleball.totalBookings || 0,
        confirmedBookings: pickleball.totalBookings || 0,
        activeHolds: pickleball.activeHoldsCount || 0,
      },
      pickleballDatabase: pickleball,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate audit report" },
      { status: 500 }
    );
  }
}
