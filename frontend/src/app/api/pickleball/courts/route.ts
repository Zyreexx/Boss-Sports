import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole, getAuthenticatedActor } from "@/lib/auth/serverAuth";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
} from "@/lib/backend/djangoClient";

export const dynamic = "force-dynamic";

// GET /api/pickleball/courts (Public availability)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("all") === "true";

    if (isDjangoBackendConfigured()) {
      const actor = getAuthenticatedActor(req);
      const upstream = await callDjangoApi({
        path: `/api/pickleball/courts/${includeInactive ? "?all=true" : ""}`,
        method: "GET",
        actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const courts = pickleballDb.getAllCourts(includeInactive);
    return NextResponse.json({ success: true, courts });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch courts" },
      { status: 500 }
    );
  }
}

// POST /api/pickleball/courts (Owner ONLY)
export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { name, surfaceType, isIndoor, basePricePerHour } = body;

    if (
      basePricePerHour !== undefined &&
      (!Number.isFinite(Number(basePricePerHour)) || Number(basePricePerHour) <= 0)
    ) {
      return NextResponse.json(
        { success: false, error: "basePricePerHour must be a positive number" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/pickleball/courts/",
        method: "POST",
        body: {
          name,
          surfaceType: surfaceType || "Pickleball Court",
          isIndoor: isIndoor ?? true,
          basePricePerHour: basePricePerHour ? Number(basePricePerHour) : 400,
        },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const newCourt = pickleballDb.addCourt(
      {
        name,
        surfaceType: surfaceType || "Pickleball Court",
        isIndoor: isIndoor ?? true,
        basePricePerHour: basePricePerHour ? Number(basePricePerHour) : 400,
      },
      auth.actor
    );

    return NextResponse.json({
      success: true,
      message: `Court "${newCourt.name}" added successfully!`,
      court: newCourt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add court" },
      { status: 400 }
    );
  }
}

// PATCH /api/pickleball/courts (Owner: full config; Staff: isActive maintenance toggle ONLY)
export async function PATCH(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { courtId, ...rawUpdates } = body;

    if (!courtId) {
      return NextResponse.json(
        { success: false, error: "courtId is required" },
        { status: 400 }
      );
    }

    let safeUpdates: {
      name?: string;
      basePricePerHour?: number;
      surfaceType?: string;
      isIndoor?: boolean;
      isActive?: boolean;
    };

    if (auth.actor.role !== "OWNER") {
      const forbiddenKeys = Object.keys(rawUpdates).filter(
        (key) => key !== "isActive" && rawUpdates[key] !== undefined
      );
      if (forbiddenKeys.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Access denied: only the owner can modify court pricing or configuration.",
          },
          { status: 403 }
        );
      }

      if (typeof rawUpdates.isActive !== "boolean") {
        return NextResponse.json(
          { success: false, error: "isActive boolean is required" },
          { status: 400 }
        );
      }

      safeUpdates = { isActive: rawUpdates.isActive };
    } else {
      if (
        rawUpdates.basePricePerHour !== undefined &&
        (!Number.isFinite(Number(rawUpdates.basePricePerHour)) ||
          Number(rawUpdates.basePricePerHour) <= 0)
      ) {
        return NextResponse.json(
          { success: false, error: "basePricePerHour must be a positive number" },
          { status: 400 }
        );
      }

      safeUpdates = {
        ...(rawUpdates.name !== undefined ? { name: String(rawUpdates.name) } : {}),
        ...(rawUpdates.basePricePerHour !== undefined
          ? { basePricePerHour: Number(rawUpdates.basePricePerHour) }
          : {}),
        ...(rawUpdates.surfaceType !== undefined
          ? { surfaceType: String(rawUpdates.surfaceType) }
          : {}),
        ...(rawUpdates.isIndoor !== undefined ? { isIndoor: Boolean(rawUpdates.isIndoor) } : {}),
        ...(rawUpdates.isActive !== undefined ? { isActive: Boolean(rawUpdates.isActive) } : {}),
      };
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/pickleball/courts/",
        method: "PATCH",
        body: { courtId, ...safeUpdates },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const updated = pickleballDb.updateCourt(courtId, safeUpdates, auth.actor);

    return NextResponse.json({
      success: true,
      message: `Court "${updated.name}" updated successfully!`,
      court: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update court" },
      { status: 400 }
    );
  }
}

// DELETE /api/pickleball/courts (Owner ONLY)
export async function DELETE(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const { searchParams } = new URL(req.url);
    const courtId = searchParams.get("courtId");

    if (!courtId) {
      return NextResponse.json(
        { success: false, error: "courtId is required" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: `/api/pickleball/courts/?courtId=${encodeURIComponent(courtId)}`,
        method: "DELETE",
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    pickleballDb.deleteCourt(courtId, auth.actor);

    return NextResponse.json({
      success: true,
      message: `Court ${courtId} removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete court" },
      { status: 400 }
    );
  }
}
