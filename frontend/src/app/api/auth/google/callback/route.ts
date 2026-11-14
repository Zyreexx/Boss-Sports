import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";
import { setSessionCookie } from "@/lib/auth/serverAuth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { supabaseDb } from "@/lib/supabase/supabaseDb";
import {
  callDjangoApi,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
} from "@/lib/backend/djangoClient";
import {
  decodeOAuthState,
  getCanonicalAppUrl,
  getGoogleOAuthCredentials,
  getGoogleRedirectUri,
} from "@/lib/auth/googleOAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appUrl = getCanonicalAppUrl(req);
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const stateStr = searchParams.get("state");
    const state = decodeOAuthState(stateStr);

    if (error || !code) {
      console.warn(`[Google OAuth Callback] Denied or missing code: ${error || "missing_code"}`);
      return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(error || "Access Denied")}`);
    }

    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    if (!clientId || !clientSecret) {
      console.error("[Google OAuth Callback] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      return NextResponse.redirect(
        `${appUrl}/?auth_error=${encodeURIComponent("Google OAuth server configuration error")}`
      );
    }

    const redirectUri = getGoogleRedirectUri(req);

    // 1. Exchange code for tokens using the canonical redirect URI
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      console.error("[Google OAuth Callback] Token exchange failed:", errData);
      return NextResponse.redirect(
        `${appUrl}/?auth_error=${encodeURIComponent(errData.error_description || "Token exchange failed")}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from Google UserInfo
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoRes.ok) {
      return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent("Failed to fetch Google profile")}`);
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
          `${appUrl}/?auth_error=${encodeURIComponent(upstream.data?.error || "Backend sign-in unavailable")}`
        );
      }
      userResult = { user: upstream.data.user, redirectUrl: upstream.data.redirectUrl || "/profile" };
    } else if (isSupabaseConfigured()) {
      const sbResult = await supabaseDb.findOrCreateGoogleUser({
        email,
        name,
        avatar,
        googleId,
      });
      userResult = { user: sbResult.user, redirectUrl: sbResult.redirectUrl || "/profile" };
    } else if (isLocalJsonFallbackDisabled()) {
      return NextResponse.redirect(
        `${appUrl}/?auth_error=${encodeURIComponent("Backend persistence service is unavailable")}`
      );
    } else {
      userResult = authDb.findOrCreateGoogleUser({
        email,
        name,
        avatar,
        googleId,
      });
    }

    // 4. Redirect with session cookie to intended destination
    const destinationPath =
      state?.returnTo && state.returnTo !== "/" ? state.returnTo : userResult.redirectUrl || "/";
    const targetUrl = new URL(destinationPath, appUrl);
    targetUrl.searchParams.set("auth_success", "true");

    const response = NextResponse.redirect(targetUrl.toString());

    // Set HMAC-signed httpOnly session cookie
    setSessionCookie(response, userResult.user, req);

    return response;
  } catch (err: any) {
    console.error("[Google OAuth Callback] Server error:", err);
    return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(err.message || "OAuth Callback Error")}`);
  }
}
