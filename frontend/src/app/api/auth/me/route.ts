import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("boss_session");
    if (!cookie?.value) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        user: null,
      });
    }

    const sessionData = JSON.parse(cookie.value);
    const user = authDb.getUserById(sessionData.id);

    if (!user) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user,
      role: user.role,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      user: null,
    });
  }
}

