import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole } from "@/lib/auth/serverAuth";
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
    if (!auth.authorized) {
      return auth.response!;
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/admin/pricing/",
        method: "GET",
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
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
      basePricePerHour,
      peakSurgePrice,
      peakSurgePricePerHour,
      peakHours,
      isPeakSurgeActive,
    } = body;

    const resolvedBase = basePricePerHour ?? (basePrice ? Number(basePrice) : undefined);
    const resolvedPeak = peakSurgePricePerHour ?? (peakSurgePrice ? Number(peakSurgePrice) : undefined);

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/admin/pricing/",
        method: "POST",
        body: {
          ...(resolvedBase !== undefined ? { basePricePerHour: resolvedBase } : {}),
          ...(resolvedPeak !== undefined ? { peakSurgePricePerHour: resolvedPeak } : {}),
          ...(peakHours !== undefined ? { peakHours } : {}),
          ...(isPeakSurgeActive !== undefined ? { isPeakSurgeActive } : {}),
        },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const result = pickleballDb.updatePricingConfig({
      basePricePerHour: resolvedBase !== undefined ? Number(resolvedBase) : undefined,
      peakSurgePricePerHour: resolvedPeak !== undefined ? Number(resolvedPeak) : undefined,
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
