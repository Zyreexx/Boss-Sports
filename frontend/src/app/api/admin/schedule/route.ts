import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

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
