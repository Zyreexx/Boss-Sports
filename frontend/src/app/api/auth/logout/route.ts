import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const response = NextResponse.json(
    {
      success: true,
      message: "Logged out successfully",
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );

  clearSessionCookie(response, req);
  return response;
}

