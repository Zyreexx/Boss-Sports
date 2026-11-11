import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";
import {
  clearSessionCookie,
  getAuthenticatedActor,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/serverAuth";
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
    const actor = getAuthenticatedActor(req);

    if (isDjangoBackendConfigured()) {
      if (!actor) {
        const response = NextResponse.json(
          { success: false, authenticated: false, user: null },
          { headers: { "Cache-Control": "no-store" } }
        );
        if (req.cookies.get(SESSION_COOKIE_NAME)?.value) {
          clearSessionCookie(response, req);
        }
        return response;
      }

      const upstream = await callDjangoApi({
        path: "/api/auth/me/",
        method: "GET",
        actor,
      });

      if (!upstream.ok) {
        if (upstream.status === 401 || upstream.status === 403) {
          const response = NextResponse.json(
            { success: false, authenticated: false, user: null },
            { headers: { "Cache-Control": "no-store" } }
          );
          clearSessionCookie(response, req);
          return response;
        }
        return toProxyJsonResponse(upstream);
      }

      return NextResponse.json(upstream.data, {
        status: upstream.status,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const user = actor ? authDb.getUserById(actor.id) : null;

    if (!actor || !user) {
      const response = NextResponse.json(
        { success: false, authenticated: false, user: null },
        { headers: { "Cache-Control": "no-store" } }
      );
      if (req.cookies.get(SESSION_COOKIE_NAME)?.value) {
        clearSessionCookie(response, req);
      }
      return response;
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        user,
        role: user.role,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, authenticated: false, user: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
