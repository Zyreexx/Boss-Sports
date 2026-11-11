import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authDb } from "./authDb";
import { isDjangoBackendConfigured, isLocalJsonFallbackDisabled } from "@/lib/backend/djangoClient";

export const SESSION_COOKIE_NAME = "boss_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthenticatedActor {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "OWNER" | "EMPLOYEE" | "CUSTOMER";
}

interface SignedSessionPayload {
  v: 1;
  id: string;
  role: "OWNER" | "EMPLOYEE" | "CUSTOMER";
  email?: string;
  phone?: string;
  name?: string;
  iat: number;
  exp: number;
  jti: string;
}

const globalKeyStore = globalThis as typeof globalThis & {
  __bossSessionSigningKey?: string;
  __bossSessionWarned?: boolean;
};

function getSessionSigningSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret) {
    return createHash("sha256").update(`boss-session-v1:${envSecret}`).digest("hex");
  }

  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (googleSecret) {
    return createHash("sha256").update(`boss-session-oauth-v1:${googleSecret}`).digest("hex");
  }

  if (!globalKeyStore.__bossSessionSigningKey) {
    globalKeyStore.__bossSessionSigningKey = randomBytes(32).toString("hex");
    if (process.env.NODE_ENV === "production" && !globalKeyStore.__bossSessionWarned) {
      globalKeyStore.__bossSessionWarned = true;
      console.warn(
        "[Auth] SESSION_SECRET is not configured. Using an ephemeral signing key; set SESSION_SECRET for durable multi-instance sessions."
      );
    }
  }

  return globalKeyStore.__bossSessionSigningKey;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function shouldUseSecureCookie(req?: NextRequest): boolean {
  if (req) {
    const forwardedProto = req.headers.get("x-forwarded-proto");
    if (forwardedProto) {
      return forwardedProto.split(",")[0].trim() === "https";
    }
    const host = req.headers.get("host") || "";
    const isLocalHost =
      host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
    if (isLocalHost) {
      return false;
    }
    if (req.nextUrl?.protocol) {
      return req.nextUrl.protocol === "https:";
    }
  }

  return (
    process.env.VERCEL === "1" ||
    (process.env.NODE_ENV === "production" &&
      Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")))
  );
}

/**
 * Create an HMAC-SHA256 signed, expiring session cookie value.
 */
export function createSignedSessionCookieValue(
  user: { id: string; role: "OWNER" | "EMPLOYEE" | "CUSTOMER"; email?: string; phone?: string; name?: string },
  ttlSeconds: number = SESSION_TTL_SECONDS
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SignedSessionPayload = {
    v: 1,
    id: user.id,
    role: user.role,
    ...(user.email ? { email: user.email } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.name ? { name: user.name } : {}),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: randomBytes(8).toString("hex"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify signed session cookie integrity and expiry.
 */
export function verifySignedSessionCookieValue(rawValue: string): SignedSessionPayload | null {
  try {
    if (!rawValue || typeof rawValue !== "string") return null;

    const parts = rawValue.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }

    const [encodedPayload, providedSignature] = parts;
    const expectedSignature = signPayload(encodedPayload);

    const providedBuf = Buffer.from(providedSignature, "utf8");
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (
      !decoded ||
      decoded.v !== 1 ||
      typeof decoded.id !== "string" ||
      !decoded.id ||
      (decoded.role !== "OWNER" && decoded.role !== "EMPLOYEE" && decoded.role !== "CUSTOMER") ||
      typeof decoded.exp !== "number" ||
      !Number.isFinite(decoded.exp)
    ) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > decoded.exp) {
      return null;
    }

    return decoded as SignedSessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  response: NextResponse,
  user: { id: string; role: "OWNER" | "EMPLOYEE" | "CUSTOMER"; email?: string; phone?: string; name?: string },
  req?: NextRequest
): void {
  const signedValue = createSignedSessionCookieValue(user);
  response.cookies.set(SESSION_COOKIE_NAME, signedValue, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(req),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse, req?: NextRequest): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(req),
    maxAge: 0,
  });
}

/**
 * Retrieve verified user from signed session cookie
 */
export function getAuthenticatedActor(req: NextRequest): AuthenticatedActor | null {
  try {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) return null;

    const payload = verifySignedSessionCookieValue(cookie.value);
    if (!payload) return null;

    // When backed by Django/PostgreSQL (or in production without local JSON), rely on HMAC-verified cookie claims
    // rather than reading local ephemeral users_auth.json.
    if (isDjangoBackendConfigured() || isLocalJsonFallbackDisabled()) {
      return {
        id: payload.id,
        name: payload.name || payload.email || payload.id,
        email: payload.email || "",
        phone: payload.phone || "",
        role: payload.role,
      };
    }

    const user = authDb.getUserById(payload.id);
    if (!user || user.role !== payload.role) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
    };
  } catch {
    return null;
  }
}

/**
 * Enforce role requirement on API routes
 */
export function enforceRole(
  req: NextRequest,
  allowedRoles: ("OWNER" | "EMPLOYEE" | "CUSTOMER")[]
): {
  authorized: boolean;
  actor: AuthenticatedActor | null;
  response?: NextResponse;
} {
  const actor = getAuthenticatedActor(req);

  if (!actor) {
    return {
      authorized: false,
      actor: null,
      response: NextResponse.json(
        { success: false, error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      authorized: false,
      actor,
      response: NextResponse.json(
        { success: false, error: "Access denied: insufficient permissions." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, actor };
}

