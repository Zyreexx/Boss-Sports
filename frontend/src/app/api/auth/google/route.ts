import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";
import { setSessionCookie } from "@/lib/auth/serverAuth";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
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

// GET: Initiates standard Google OAuth 2.0 redirect
export async function GET(req: NextRequest) {
  try {
    const redirectUri = getRedirectUri(req);
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/auth");
    googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid profile email");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "select_account");

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Receives either GIS ID Token ({ credential }) or Auth Code ({ code }) from client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credential, code } = body;

    let email = "";
    let name = "";
    let avatar: string | undefined = undefined;
    let googleId: string | undefined = undefined;

    if (credential) {
      // 1. Verify Google ID token using Google TokenInfo endpoint
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!verifyRes.ok) {
        return NextResponse.json(
          { success: false, error: "Invalid Google credential token." },
          { status: 401 }
        );
      }

      const tokenInfo = await verifyRes.json();
      if (!tokenInfo.email) {
        return NextResponse.json(
          { success: false, error: "Unable to retrieve email from Google account." },
          { status: 400 }
        );
      }

      email = tokenInfo.email;
      name = tokenInfo.name || tokenInfo.email.split("@")[0];
      avatar = tokenInfo.picture;
      googleId = tokenInfo.sub;
    } else if (code) {
      // 2. Exchange authorization code for tokens
      const redirectUri = getRedirectUri(req);
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
        const errData = await tokenRes.json();
        return NextResponse.json(
          { success: false, error: errData.error_description || "Google authorization code exchange failed." },
          { status: 400 }
        );
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch user profile from Google UserInfo API
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userinfoRes.ok) {
        return NextResponse.json(
          { success: false, error: "Failed to fetch Google profile info." },
          { status: 400 }
        );
      }

      const profile = await userinfoRes.json();
      email = profile.email;
      name = profile.name || profile.email.split("@")[0];
      avatar = profile.picture;
      googleId = profile.sub;
    } else {
      return NextResponse.json(
        { success: false, error: "Missing Google credential or code." },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/auth/google/",
        method: "POST",
        body: { email, name, avatar, googleId },
      });

      if (!upstream.ok || !upstream.data?.user) {
        return toProxyJsonResponse(upstream);
      }

      const response = NextResponse.json(
        {
          ...upstream.data,
          message: `Welcome, ${upstream.data.user.name}! Signed in via Google.`,
        },
        { status: upstream.status }
      );
      setSessionCookie(response, upstream.data.user, req);
      return response;
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    // Upsert user in local fallback Auth database (dev/test only)
    const result = authDb.findOrCreateGoogleUser({
      email,
      name,
      avatar,
      googleId,
    });

    const response = NextResponse.json({
      success: true,
      user: result.user,
      role: result.user.role,
      redirectUrl: result.redirectUrl,
      token: result.token,
      message: `Welcome, ${result.user.name}! Signed in via Google.`,
    });

    // Set HMAC-signed httpOnly session cookie
    setSessionCookie(response, result.user, req);

    return response;
  } catch (error: any) {
    console.error("Google Auth API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Google sign-in server error" },
      { status: 500 }
    );
  }
}

