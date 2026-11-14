import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";
import { setSessionCookie } from "@/lib/auth/serverAuth";
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

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/auth/login/",
        method: "POST",
        body: { identifier, password },
      });

      if (!upstream.ok || !upstream.data?.user) {
        return toProxyJsonResponse(upstream);
      }

      const response = NextResponse.json(upstream.data, {
        status: upstream.status,
        headers: { "Cache-Control": "no-store" },
      });
      setSessionCookie(response, upstream.data.user, req);
      return response;
    }

    let result: {
      success: boolean;
      user?: any;
      redirectUrl?: string;
      token?: string;
      error?: string;
    };

    if (isSupabaseConfigured()) {
      result = await supabaseDb.authenticateUser(identifier, password);
    } else {
      if (isLocalJsonFallbackDisabled()) {
        return getBackendMisconfiguredResponse();
      }
      result = authDb.authenticate(identifier, password);
    }

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

    setSessionCookie(response, result.user, req);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Login server error" },
      { status: 500 }
    );
  }
}
