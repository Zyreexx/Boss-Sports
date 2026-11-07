import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

// GET /api/pickleball/courts (Public availability)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("all") === "true";
    const courts = pickleballDb.getAllCourts(includeInactive);
    return NextResponse.json({ success: true, courts });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch courts" },
      { status: 500 }
    );
  }
}

// POST /api/pickleball/courts (Owner & Staff ONLY)
export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { name, surfaceType, isIndoor, basePricePerHour } = body;

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

// PATCH /api/pickleball/courts (Owner & Staff ONLY)
export async function PATCH(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { courtId, ...updates } = body;

    if (!courtId) {
      return NextResponse.json(
        { success: false, error: "courtId is required" },
        { status: 400 }
      );
    }

    const updated = pickleballDb.updateCourt(courtId, updates, auth.actor);

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

// DELETE /api/pickleball/courts (Owner & Staff ONLY)
export async function DELETE(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
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
