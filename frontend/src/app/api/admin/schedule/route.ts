import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole, getAuthenticatedActor } from "@/lib/auth/serverAuth";
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
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (isDjangoBackendConfigured()) {
      const actor = getAuthenticatedActor(req);
      const q = date ? `?date=${encodeURIComponent(date)}` : "";
      const upstream = await callDjangoApi({
        path: `/api/admin/schedule/${q}`,
        method: "GET",
        actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isSupabaseConfigured()) {
      const schedule = await supabaseDb.getArenaSchedule(date || "DEFAULT");
      return NextResponse.json({
        success: true,
        schedule,
      });
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    if (date) {
      const schedule = pickleballDb.getArenaSchedule(date);
      return NextResponse.json({
        success: true,
        schedule,
      });
    }

    const all = pickleballDb.getAllSchedules();
    return NextResponse.json({
      success: true,
      schedules: all,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch arena schedule" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const {
      date,
      isClosed,
      closureReason,
      openTime,
      closeTime,
    } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, error: "Date parameter is required (e.g. YYYY-MM-DD or DEFAULT)" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/admin/schedule/",
        method: "POST",
        body: {
          date,
          isClosed: Boolean(isClosed),
          closureReason: closureReason || undefined,
          openTime: openTime || "06:00",
          closeTime: closeTime || "23:00",
        },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isSupabaseConfigured()) {
      const result = await supabaseDb.setArenaSchedule(
        {
          date,
          isClosed: Boolean(isClosed),
          closureReason: closureReason || undefined,
          openTime: openTime || "06:00",
          closeTime: closeTime || "23:00",
        },
        auth.actor
      );

      return NextResponse.json({
        success: true,
        message: `Schedule for ${date} updated successfully!`,
        schedule: result,
      });
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const result = pickleballDb.setArenaSchedule({
      date,
      isClosed: Boolean(isClosed),
      closureReason: closureReason || undefined,
      openTime: openTime || "06:00",
      closeTime: closeTime || "23:00",
      staffId: auth.actor.id,
    });

    return NextResponse.json({
      success: true,
      schedule: result.schedule,
      message: `Arena schedule for ${date} updated successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to set arena schedule" },
      { status: 500 }
    );
  }
}
