import { NextRequest } from "next/server";

export const CANONICAL_PRODUCTION_ORIGIN = "https://boss-sports.vercel.app";
export const CANONICAL_REDIRECT_PATH = "/api/auth/google/callback";
export const CANONICAL_PRODUCTION_REDIRECT_URI = `${CANONICAL_PRODUCTION_ORIGIN}${CANONICAL_REDIRECT_PATH}`;

export interface OAuthStateData {
  nonce: string;
  returnTo?: string;
  sourceHost?: string;
  timestamp: number;
}

/**
 * Checks whether a given host or URL indicates local development.
 */
export function isLocalhost(hostOrUrl?: string | null): boolean {
  if (!hostOrUrl) return false;
  try {
    const raw = hostOrUrl.includes("://") ? new URL(hostOrUrl).host : hostOrUrl;
    const hostWithoutPort = raw.split(":")[0].toLowerCase().trim();
    return (
      hostWithoutPort === "localhost" ||
      hostWithoutPort === "127.0.0.1" ||
      hostWithoutPort === "[::1]" ||
      hostWithoutPort === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

/**
 * Resolves the canonical base application URL.
 * - In production / Vercel: Resolves to https://boss-sports.vercel.app (or custom production domain from APP_URL / NEXT_PUBLIC_APP_URL).
 * - In preview deployments: Resolves to canonical production https://boss-sports.vercel.app for OAuth consistency.
 * - In development (localhost): Resolves to the local development server (e.g. http://localhost:3000).
 */
export function getCanonicalAppUrl(req?: NextRequest): string {
  const reqHost = req?.headers.get("host") || "";
  const isVercel = process.env.VERCEL === "1";

  // Check explicit environment variables
  const configuredAppUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();

  // Localhost / development scenario
  if (!isVercel) {
    if (configuredAppUrl && isLocalhost(configuredAppUrl)) {
      return configuredAppUrl.replace(/\/+$/, "");
    }
    if (isLocalhost(reqHost)) {
      const proto = req?.headers.get("x-forwarded-proto") || "http";
      return `${proto}://${reqHost}`.replace(/\/+$/, "");
    }
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      if (!configuredAppUrl || configuredAppUrl.includes("your-domain.com")) {
        return "http://localhost:3000";
      }
    }
  }

  // Production or Vercel preview:
  // If a valid production URL is configured (not placeholder, not localhost, and not a preview URL)
  if (
    configuredAppUrl &&
    !configuredAppUrl.includes("your-domain.com") &&
    !isLocalhost(configuredAppUrl) &&
    !configuredAppUrl.includes("git-") &&
    !configuredAppUrl.includes("-pushpraj-")
  ) {
    return configuredAppUrl.replace(/\/+$/, "");
  }

  // Default to canonical Boss Sports production origin
  return CANONICAL_PRODUCTION_ORIGIN;
}

/**
 * Generates the exact Google OAuth redirect URI to use for both initiation and token exchange.
 * Guarantees that initiation and code exchange use the identical canonical URI.
 */
export function getGoogleRedirectUri(req?: NextRequest): string {
  const reqHost = req?.headers.get("host") || "";
  const isVercel = process.env.VERCEL === "1";

  // Development/localhost override:
  if (!isVercel && (isLocalhost(reqHost) || isLocalhost(process.env.NEXT_PUBLIC_APP_URL))) {
    const proto = req?.headers.get("x-forwarded-proto") || "http";
    const host =
      reqHost ||
      (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : "localhost:3000");
    return `${proto}://${host}${CANONICAL_REDIRECT_PATH}`;
  }

  // Production & Preview Vercel deployments:
  // Always use the canonical production app URL, never preview request host.
  const appUrl = getCanonicalAppUrl(req);
  return `${appUrl}${CANONICAL_REDIRECT_PATH}`;
}

/**
 * Server-side accessor for Google OAuth client credentials.
 * Reads GOOGLE_CLIENT_ID (with fallback to NEXT_PUBLIC_GOOGLE_CLIENT_ID) and GOOGLE_CLIENT_SECRET.
 * NOTE: Never expose or print clientSecret to client responses or public logs.
 */
export function getGoogleOAuthCredentials() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";

  return {
    clientId,
    clientSecret,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

/**
 * Sanitize return path to prevent open redirect vulnerabilities.
 * Must be a relative path starting with a single '/' and not '//' or '/\'.
 */
export function sanitizeReturnTo(path?: string | null): string {
  if (!path || typeof path !== "string") return "/";
  const trimmed = path.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }
  return "/";
}

/**
 * Safely encode OAuth state to maintain return destination and CSRF nonce.
 */
export function encodeOAuthState(data: { returnTo?: string; sourceHost?: string }): string {
  const payload: OAuthStateData = {
    nonce: Math.random().toString(36).substring(2) + Date.now().toString(36),
    returnTo: sanitizeReturnTo(data.returnTo),
    sourceHost: data.sourceHost,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Safely parse OAuth state.
 */
export function decodeOAuthState(stateStr?: string | null): OAuthStateData | null {
  if (!stateStr) return null;
  try {
    const decoded = JSON.parse(Buffer.from(stateStr, "base64url").toString("utf8"));
    if (decoded && typeof decoded === "object") {
      return {
        nonce: String(decoded.nonce || ""),
        returnTo: sanitizeReturnTo(decoded.returnTo),
        sourceHost: decoded.sourceHost ? String(decoded.sourceHost) : undefined,
        timestamp: Number(decoded.timestamp || 0),
      };
    }
  } catch {
    // Return null if invalid state
  }
  return null;
}
