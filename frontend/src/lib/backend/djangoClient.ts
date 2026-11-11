import { createHash, createHmac } from "crypto";
import { NextResponse } from "next/server";
import type { AuthenticatedActor } from "@/lib/auth/serverAuth";

const DEFAULT_TIMEOUT_MS = 10_000;

export function getDjangoApiUrl(): string {
  return (process.env.DJANGO_API_URL || "").trim().replace(/\/+$/, "");
}

export function isDjangoBackendConfigured(): boolean {
  return Boolean(getDjangoApiUrl());
}

/**
 * Fail-closed policy for serverless/production runtimes:
 * Local filesystem JSON fallback is disabled in production and Vercel runtimes
 * unless explicitly opted into ONLY for local non-Vercel dev/testing.
 */
export function isLocalJsonFallbackDisabled(): boolean {
  if (process.env.REQUIRE_DJANGO_BACKEND === "true") return true;
  if (process.env.VERCEL === "1") return true;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_JSON_FALLBACK !== "true"
  ) {
    return true;
  }
  return false;
}

export function getBackendMisconfiguredResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error:
        "Backend persistence service is unavailable (DJANGO_API_URL is not configured).",
    },
    { status: 503 }
  );
}

function headerSafeAscii(value: string | undefined | null): string {
  if (!value) return "";
  return String(value).replace(/[^\x20-\x7E]/g, "").trim();
}

export function computeDjangoServiceSignature(params: {
  secret: string;
  timestampMs: string;
  method: string;
  fullPath: string;
  actorId: string;
  actorRole: string;
  bodyBytes: Buffer;
}): string {
  const bodyHash = createHash("sha256").update(params.bodyBytes).digest("hex");
  const payload = [
    params.timestampMs,
    params.method.toUpperCase(),
    params.fullPath,
    params.actorId,
    params.actorRole,
    bodyHash,
  ].join("\n");

  return createHmac("sha256", params.secret).update(payload, "utf8").digest("hex");
}

export interface DjangoCallResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  headers: Headers;
}

export async function callDjangoApi<T = any>(params: {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, any>;
  actor?: AuthenticatedActor | null;
  timeoutMs?: number;
}): Promise<DjangoCallResult<T>> {
  const baseUrl = getDjangoApiUrl();
  const secret = (process.env.BACKEND_SERVICE_SECRET || "").trim();

  if (!baseUrl || !secret) {
    return {
      ok: false,
      status: 503,
      data: {
        success: false,
        error: !baseUrl
          ? "Booking backend URL (DJANGO_API_URL) is not configured."
          : "Backend service authentication secret (BACKEND_SERVICE_SECRET) is not configured.",
      } as T,
      headers: new Headers(),
    };
  }

  const normalizedPath = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const targetUrl = new URL(`${baseUrl}${normalizedPath}`);
  const fullPath = `${targetUrl.pathname}${targetUrl.search}`;
  const method = (params.method || "GET").toUpperCase();

  const bodyBytes =
    params.body !== undefined
      ? Buffer.from(JSON.stringify(params.body), "utf8")
      : Buffer.alloc(0);

  const actorId = params.actor?.id ? headerSafeAscii(params.actor.id) : "";
  const actorRole = params.actor?.role ? headerSafeAscii(params.actor.role) : "";
  const timestampMs = String(Date.now());

  const signature = computeDjangoServiceSignature({
    secret,
    timestampMs,
    method,
    fullPath,
    actorId,
    actorRole,
    bodyBytes,
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Boss-Timestamp": timestampMs,
    "X-Boss-Service-Signature": signature,
  };

  if (params.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (actorId && actorRole) {
    headers["X-Boss-Actor-Id"] = actorId;
    headers["X-Boss-Actor-Role"] = actorRole;
    if (params.actor?.name) headers["X-Boss-Actor-Name"] = headerSafeAscii(params.actor.name);
    if (params.actor?.email) headers["X-Boss-Actor-Email"] = headerSafeAscii(params.actor.email);
    if (params.actor?.phone) headers["X-Boss-Actor-Phone"] = headerSafeAscii(params.actor.phone);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const res = await fetch(targetUrl.toString(), {
      method,
      headers,
      body: params.body !== undefined ? bodyBytes : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    let parsed: any = null;
    if (contentType.includes("application/json")) {
      parsed = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        ok: false,
        status: res.ok ? 502 : Math.max(res.status, 502),
        data: {
          success: false,
          error: "Booking backend returned an unexpected response. Please try again.",
        } as T,
        headers: res.headers,
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      data: parsed as T,
      headers: res.headers,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return {
      ok: false,
      status: 503,
      data: {
        success: false,
        error: isTimeout
          ? "Booking backend timed out while verifying live state. Please retry."
          : "Booking backend service is temporarily unreachable. Please retry.",
      } as T,
      headers: new Headers(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function toProxyJsonResponse(
  result: DjangoCallResult<any>,
  extraHeaders?: Record<string, string>
): NextResponse {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ...extraHeaders,
  };
  return NextResponse.json(result.data, { status: result.status, headers });
}

