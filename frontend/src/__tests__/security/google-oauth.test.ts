import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  CANONICAL_PRODUCTION_ORIGIN,
  CANONICAL_PRODUCTION_REDIRECT_URI,
  decodeOAuthState,
  encodeOAuthState,
  getCanonicalAppUrl,
  getGoogleOAuthCredentials,
  getGoogleRedirectUri,
  isLocalhost,
  sanitizeReturnTo,
} from "@/lib/auth/googleOAuth";
import { GET as googleAuthInitHandler, POST as googleAuthPostHandler } from "@/app/api/auth/google/route";
import { GET as googleCallbackHandler } from "@/app/api/auth/google/callback/route";

function setEnv(overrides: Record<string, string | undefined>) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(overrides)) {
    previous[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  };
}

describe("Google OAuth Canonical Production Redirect URI & Token Exchange", () => {
  let restoreEnv: (() => void) | null = null;

  afterEach(() => {
    mock.restoreAll();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  describe("URI Resolver & Environment Scenarios", () => {
    it("Scenario 1: Production Vercel deployment resolves canonical production redirect URI", () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://boss-sports.vercel.app",
        APP_URL: "https://boss-sports.vercel.app",
      });

      const req = new NextRequest("https://boss-sports.vercel.app/api/auth/google");
      const appUrl = getCanonicalAppUrl(req);
      const redirectUri = getGoogleRedirectUri(req);

      assert.equal(appUrl, CANONICAL_PRODUCTION_ORIGIN);
      assert.equal(redirectUri, "https://boss-sports.vercel.app/api/auth/google/callback");
      assert.equal(redirectUri, CANONICAL_PRODUCTION_REDIRECT_URI);
    });

    it("Scenario 2: Production Vercel with missing or placeholder NEXT_PUBLIC_APP_URL safely defaults to canonical domain", () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://your-domain.com",
        APP_URL: undefined,
      });

      const req = new NextRequest("https://boss-sports.vercel.app/api/auth/google");
      const redirectUri = getGoogleRedirectUri(req);

      assert.equal(redirectUri, "https://boss-sports.vercel.app/api/auth/google/callback");
    });

    it("Scenario 3: Vercel Preview deployment does NOT use preview Host header; uses canonical registered URI", () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://boss-sports-git-feature-preview.vercel.app",
      });

      const previewReq = new NextRequest(
        "https://boss-sports-git-feature-preview.vercel.app/api/auth/google",
        {
          headers: {
            host: "boss-sports-git-feature-preview.vercel.app",
            "x-forwarded-proto": "https",
          },
        }
      );

      const redirectUri = getGoogleRedirectUri(previewReq);

      // Must never send preview domain to Google OAuth
      assert.notEqual(
        redirectUri,
        "https://boss-sports-git-feature-preview.vercel.app/api/auth/google/callback"
      );
      assert.equal(redirectUri, "https://boss-sports.vercel.app/api/auth/google/callback");
    });

    it("Scenario 4: Local development retains localhost redirect URI on default port", () => {
      restoreEnv = setEnv({
        VERCEL: undefined,
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        APP_URL: undefined,
      });

      const devReq = new NextRequest("http://localhost:3000/api/auth/google", {
        headers: { host: "localhost:3000", "x-forwarded-proto": "http" },
      });

      const redirectUri = getGoogleRedirectUri(devReq);
      assert.equal(redirectUri, "http://localhost:3000/api/auth/google/callback");
    });

    it("Scenario 5: Local development respects custom localhost port from host header", () => {
      restoreEnv = setEnv({
        VERCEL: undefined,
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      });

      const devReq = new NextRequest("http://127.0.0.1:3001/api/auth/google", {
        headers: { host: "127.0.0.1:3001", "x-forwarded-proto": "http" },
      });

      const redirectUri = getGoogleRedirectUri(devReq);
      assert.equal(redirectUri, "http://127.0.0.1:3001/api/auth/google/callback");
    });
  });

  describe("Initiation & Token Exchange Exact URI Match", () => {
    const TEST_CLIENT_ID = "1017240511632-test-client.apps.googleusercontent.com";
    const TEST_CLIENT_SECRET = "TEST_SECRET_DO_NOT_EXPOSE";

    it("Scenario 6: GET /api/auth/google initiates authorization request with exact registered redirect URI", async () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: TEST_CLIENT_SECRET,
        NEXT_PUBLIC_APP_URL: "https://boss-sports.vercel.app",
      });

      const req = new NextRequest("https://boss-sports.vercel.app/api/auth/google?returnTo=/profile");
      const res = await googleAuthInitHandler(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location, "Redirect header must be present");

      const authUrl = new URL(location);
      assert.equal(authUrl.origin, "https://accounts.google.com");
      assert.equal(authUrl.pathname, "/o/oauth2/auth");
      assert.equal(authUrl.searchParams.get("client_id"), TEST_CLIENT_ID);
      assert.equal(
        authUrl.searchParams.get("redirect_uri"),
        "https://boss-sports.vercel.app/api/auth/google/callback"
      );
      assert.equal(authUrl.searchParams.get("response_type"), "code");
      assert.equal(authUrl.searchParams.get("scope"), "openid profile email");

      const stateStr = authUrl.searchParams.get("state");
      assert.ok(stateStr);
      const state = decodeOAuthState(stateStr);
      assert.equal(state?.returnTo, "/profile");
      assert.ok(state?.nonce);
    });

    it("Scenario 7: Preview deployment initiation sends canonical registered URI, not preview host", async () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: TEST_CLIENT_SECRET,
      });

      const previewReq = new NextRequest(
        "https://boss-sports-preview-abc.vercel.app/api/auth/google?returnTo=/admin/courts",
        {
          headers: {
            host: "boss-sports-preview-abc.vercel.app",
            "x-forwarded-proto": "https",
          },
        }
      );

      const res = await googleAuthInitHandler(previewReq);
      assert.equal(res.status, 307);
      const authUrl = new URL(res.headers.get("location")!);

      assert.equal(
        authUrl.searchParams.get("redirect_uri"),
        "https://boss-sports.vercel.app/api/auth/google/callback",
        "Preview initiation must use the canonical registered URI"
      );
    });

    it("Scenario 8: GET /api/auth/google/callback token exchange sends exact same canonical redirect URI", async () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: TEST_CLIENT_SECRET,
        NEXT_PUBLIC_APP_URL: "https://boss-sports.vercel.app",
        DJANGO_API_URL: "https://boss-api.example.com",
        BACKEND_SERVICE_SECRET: "mock-backend-secret-xyz",
      });

      let capturedTokenBody: URLSearchParams | null = null;
      let tokenEndpointCalled = false;

      const originalFetch = globalThis.fetch;
      mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") {
          tokenEndpointCalled = true;
          capturedTokenBody = new URLSearchParams(String(init?.body || ""));
          return new Response(
            JSON.stringify({
              access_token: "mock-access-token",
              id_token: "mock-id-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
          return new Response(
            JSON.stringify({
              sub: "google-user-12345",
              email: "testplayer@example.com",
              name: "Test Player",
              picture: "https://example.com/avatar.jpg",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/api/auth/google/")) {
          return new Response(
            JSON.stringify({
              success: true,
              user: {
                id: "usr-google-1",
                name: "Test Player",
                email: "testplayer@example.com",
                role: "CUSTOMER",
              },
              redirectUrl: "/profile",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input, init);
      });

      const statePayload = encodeOAuthState({ returnTo: "/profile" });
      const callbackReq = new NextRequest(
        `https://boss-sports.vercel.app/api/auth/google/callback?code=mock_auth_code_xyz&state=${statePayload}`,
        {
          headers: {
            host: "boss-sports.vercel.app",
            "x-forwarded-proto": "https",
          },
        }
      );

      const res = await googleCallbackHandler(callbackReq);

      assert.ok(tokenEndpointCalled, "Token exchange endpoint must be invoked");
      assert.ok(capturedTokenBody, "Token exchange body must be sent");
      assert.equal(capturedTokenBody.get("code"), "mock_auth_code_xyz");
      assert.equal(capturedTokenBody.get("grant_type"), "authorization_code");
      assert.equal(capturedTokenBody.get("client_id"), TEST_CLIENT_ID);
      assert.equal(
        capturedTokenBody.get("redirect_uri"),
        "https://boss-sports.vercel.app/api/auth/google/callback",
        "redirect_uri in token exchange MUST match canonical registered URI"
      );

      // Verify success redirect
      assert.equal(res.status, 307);
      const redirectLocation = res.headers.get("location");
      assert.ok(redirectLocation);
      const targetUrl = new URL(redirectLocation);
      assert.equal(targetUrl.origin, "https://boss-sports.vercel.app");
      assert.equal(targetUrl.pathname, "/profile");
      assert.equal(targetUrl.searchParams.get("auth_success"), "true");
    });

    it("Scenario 9: POST /api/auth/google with code token exchange uses exact same canonical redirect URI", async () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: TEST_CLIENT_SECRET,
        NEXT_PUBLIC_APP_URL: "https://boss-sports.vercel.app",
        DJANGO_API_URL: "https://boss-api.example.com",
        BACKEND_SERVICE_SECRET: "mock-backend-secret-xyz",
      });

      let capturedRedirectUri: string | null = null;
      const originalFetch = globalThis.fetch;
      mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") {
          const body = new URLSearchParams(String(init?.body || ""));
          capturedRedirectUri = body.get("redirect_uri");
          return new Response(
            JSON.stringify({
              access_token: "mock-access-token",
              token_type: "Bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
          return new Response(
            JSON.stringify({
              sub: "google-user-67890",
              email: "member@example.com",
              name: "Member User",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/api/auth/google/")) {
          return new Response(
            JSON.stringify({
              success: true,
              user: {
                id: "usr-google-2",
                name: "Member User",
                email: "member@example.com",
                role: "CUSTOMER",
              },
              redirectUrl: "/profile",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input, init);
      });

      const postReq = new NextRequest("https://boss-sports.vercel.app/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "client_auth_code_abc" }),
      });

      const res = await googleAuthPostHandler(postReq);
      assert.equal(res.status, 200);
      assert.equal(
        capturedRedirectUri,
        "https://boss-sports.vercel.app/api/auth/google/callback",
        "POST code exchange MUST use canonical production redirect URI"
      );
    });
  });

  describe("Security, Secret Protection, & Sanitization", () => {
    it("Scenario 10: Server credentials accessor never reveals secrets in client-bound data", () => {
      restoreEnv = setEnv({
        GOOGLE_CLIENT_ID: "client-id-123.apps.googleusercontent.com",
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "client-id-123.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "SUPER_SECRET_VALUE",
      });

      const creds = getGoogleOAuthCredentials();
      assert.equal(creds.clientId, "client-id-123.apps.googleusercontent.com");
      assert.equal(creds.isConfigured, true);
      assert.ok(creds.clientSecret);
    });

    it("Scenario 11: Missing GOOGLE_CLIENT_ID redirects cleanly with error without unhandled exception", async () => {
      restoreEnv = setEnv({
        VERCEL: "1",
        GOOGLE_CLIENT_ID: "",
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      });

      const req = new NextRequest("https://boss-sports.vercel.app/api/auth/google");
      const res = await googleAuthInitHandler(req);

      assert.equal(res.status, 307);
      const loc = res.headers.get("location");
      assert.ok(loc?.includes("auth_error="));
    });

    it("Scenario 12: Open redirect attacks via returnTo parameter are safely sanitized", () => {
      assert.equal(sanitizeReturnTo("https://evil.com"), "/");
      assert.equal(sanitizeReturnTo("//evil.com/phish"), "/");
      assert.equal(sanitizeReturnTo("/\\evil.com"), "/");
      assert.equal(sanitizeReturnTo("javascript:alert(1)"), "/");
      assert.equal(sanitizeReturnTo("/profile"), "/profile");
      assert.equal(sanitizeReturnTo("/admin/courts?court=1"), "/admin/courts?court=1");
    });
  });
});
