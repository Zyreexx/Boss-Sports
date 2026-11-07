import { NextRequest, NextResponse } from "next/server";
import { authDb } from "@/lib/auth/authDb";

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

    // 3. Upsert into auth database
    const result = authDb.findOrCreateGoogleUser({
      email,
      name,
      avatar,
      googleId,
    });

    // 4. Redirect with session cookie
    const targetUrl = new URL(result.redirectUrl, baseUrl);
    targetUrl.searchParams.set("auth_success", "true");

    const response = NextResponse.redirect(targetUrl.toString());

    response.cookies.set("boss_session", JSON.stringify({
      id: result.user.id,
      name: result.user.name,
      role: result.user.role,
      avatar: result.user.avatar,
      token: result.token,
    }), {
      path: "/",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("Google callback error:", err);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    return NextResponse.redirect(`${protocol}://${host}/?auth_error=${encodeURIComponent(err.message)}`);
  }
}

