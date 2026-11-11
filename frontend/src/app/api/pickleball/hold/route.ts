import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";
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
    const { courtId, startTime, endTime, sessionId } = body;

    if (!courtId || !startTime || !endTime || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: courtId, startTime, endTime, sessionId" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const actor = getAuthenticatedActor(req);
      const upstream = await callDjangoApi({
        path: "/api/pickleball/hold/",
        method: "POST",
        body: { courtId, startTime, endTime, sessionId },
        actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const result = pickleballDb.placeHold({
      courtId,
      startTime,
      endTime,
      sessionId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      hold: result.hold,
      message: "Court slot locked for 10 minutes",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create hold" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const sessionId = body.sessionId || searchParams.get("sessionId");
    const holdId = body.holdId || searchParams.get("holdId") || undefined;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required to release a hold" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const actor = getAuthenticatedActor(req);
      const upstream = await callDjangoApi({
        path: "/api/pickleball/hold/",
        method: "DELETE",
        body: { sessionId, ...(holdId ? { holdId } : {}) },
        actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const result = pickleballDb.releaseHold(sessionId, holdId);
    return NextResponse.json({
      success: true,
      releasedCount: result.releasedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to release hold" },
      { status: 500 }
    );
  }
}
