import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Identifier (email/phone) and password are required" },
        { status: 400 }
      );
    }

    const result = authDb.authenticate(identifier, password);

    if (!result.success || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || "Authentication failed" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      role: result.user.role,
      redirectUrl: result.redirectUrl,
      token: result.token,
      message: `Welcome, ${result.user.name}! Assigned role: ${result.user.role}`,
    });

    // Set cookie for session persistence
    response.cookies.set("boss_session", JSON.stringify({
      id: result.user.id,
      name: result.user.name,
      role: result.user.role,
      token: result.token,
    }), {
      path: "/",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Login server error" },
      { status: 500 }
    );
  }
}

