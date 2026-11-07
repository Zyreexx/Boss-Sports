import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";

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
