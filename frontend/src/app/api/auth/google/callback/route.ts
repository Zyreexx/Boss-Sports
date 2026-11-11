import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";
import { setSessionCookie } from "@/lib/auth/serverAuth";
import {
  callDjangoApi,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
} from "@/lib/backend/djangoClient";

export const dynamic = "force-dynamic";

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "";

const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

function getRedirectUri(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}/api/auth/google/callback`;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${protocol}://${host}`;

    if (error || !code) {
      return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(error || "Access Denied")}`);
    }

    const redirectUri = getRedirectUri(req);

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      return NextResponse.redirect(
        `${baseUrl}/?auth_error=${encodeURIComponent(errData.error_description || "Token exchange failed")}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from Google UserInfo
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoRes.ok) {
      return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent("Failed to fetch Google profile")}`);
    }

    const profile = await userinfoRes.json();
    const email = profile.email;
    const name = profile.name || profile.email.split("@")[0];
    const avatar = profile.picture;
    const googleId = profile.sub;

    let userResult: { user: any; redirectUrl: string };
    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/auth/google/",
        method: "POST",
        body: { email, name, avatar, googleId },
      });
      if (!upstream.ok || !upstream.data?.user) {
        return NextResponse.redirect(
          `${baseUrl}/?auth_error=${encodeURIComponent(upstream.data?.error || "Backend sign-in unavailable")}`
        );
      }
      userResult = { user: upstream.data.user, redirectUrl: upstream.data.redirectUrl || "/profile" };
    } else if (isLocalJsonFallbackDisabled()) {
      return NextResponse.redirect(
        `${baseUrl}/?auth_error=${encodeURIComponent("Backend persistence service is unavailable")}`
      );
    } else {
      userResult = authDb.findOrCreateGoogleUser({
        email,
        name,
        avatar,
        googleId,
      });
    }

    // 4. Redirect with session cookie
    const targetUrl = new URL(userResult.redirectUrl, baseUrl);
    targetUrl.searchParams.set("auth_success", "true");

    const response = NextResponse.redirect(targetUrl.toString());

    // Set HMAC-signed httpOnly session cookie
    setSessionCookie(response, userResult.user, req);

    return response;
  } catch (err: any) {
    console.error("Google callback error:", err);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    return NextResponse.redirect(`${protocol}://${host}/?auth_error=${encodeURIComponent(err.message)}`);
  }
}

