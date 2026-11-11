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

export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { courtId, startTime, endTime, reason = "MAINTENANCE", notes } = body;

    if (!courtId || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: "courtId, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/admin/blocks/",
        method: "POST",
        body: { courtId, startTime, endTime, reason, notes },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const result = pickleballDb.createScheduleBlock({
      courtId,
      startTime,
      endTime,
      reason,
      notes,
      staffId: auth.actor.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Failed to block court slot" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      block: result.block,
      message: "Court schedule block applied successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to block court" },
      { status: 500 }
    );
  }
}
