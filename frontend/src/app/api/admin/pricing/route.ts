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

    const config = pickleballDb.getPricingConfig();
    return NextResponse.json({
      success: true,
      pricingConfig: config,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load pricing config" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const {
      basePrice,
      peakSurgePrice,
      peakHours,
      isPeakSurgeActive,
    } = body;

    const result = pickleballDb.updatePricingConfig({
      basePricePerHour: basePrice ? Number(basePrice) : undefined,
      peakSurgePricePerHour: peakSurgePrice ? Number(peakSurgePrice) : undefined,
      peakHours,
      isPeakSurgeActive,
      staffId: auth.actor.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Failed to update pricing rules" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pricingConfig: result.pricingConfig,
      message: "Pricing configuration and peak surge price updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update pricing rules" },
      { status: 500 }
    );
  }
}
