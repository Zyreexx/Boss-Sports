import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { GET as getAvailabilityHandler } from "@/app/api/pickleball/availability/route";
import { GET as getAdminReportsHandler } from "@/app/api/admin/reports/route";
import { POST as placeHoldHandler } from "@/app/api/pickleball/hold/route";
import { POST as bookHandler } from "@/app/api/pickleball/book/route";
import { GET as getBookingsHandler } from "@/app/api/pickleball/bookings/route";
import { createSignedSessionCookieValue } from "@/lib/auth/serverAuth";

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

describe("Django Backend Proxy & Fail-Closed Production Guarantees", () => {
  let restoreEnv: (() => void) | null = null;

  afterEach(() => {
    mock.restoreAll();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  it("fails closed with 503 on production/Vercel when DJANGO_API_URL is missing (no JSON fallback)", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "",
      BACKEND_SERVICE_SECRET: "",
      ALLOW_LOCAL_JSON_FALLBACK: undefined,
    });

    const availReq = new NextRequest(
      "https://boss-sports.vercel.app/api/pickleball/availability?date=2026-12-01"
    );
    const availRes = await getAvailabilityHandler(availReq);
    const availData = await availRes.json();

    assert.equal(availRes.status, 503);
    assert.equal(availData.success, false);
    assert.equal(availData.slots, undefined, "Must never serve silent empty or JSON slots");

    const ownerToken = createSignedSessionCookieValue({
      id: "usr-owner-01",
      role: "OWNER",
      email: "owner@boss.com",
      name: "Owner",
    });
    const reportReq = new NextRequest(
      "https://boss-sports.vercel.app/api/admin/reports",
      {
        method: "GET",
        headers: { cookie: `boss_session=${ownerToken}` },
      }
    );
    const reportRes = await getAdminReportsHandler(reportReq);
    const reportData = await reportRes.json();

    assert.equal(reportRes.status, 503);
    assert.equal(reportData.success, false);
    assert.equal(reportData.summary, undefined, "Must never fall back to zero revenue on outage");
  });

  it("signs server-to-server requests with HMAC-SHA256 and forwards verified actor headers", async () => {
    const sharedSecret = "test-shared-hmac-secret-123";
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: sharedSecret,
      SESSION_SECRET: "session-signing-secret-xyz",
    });

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    mock.method(globalThis, "fetch", async (input: any, init: any) => {
      capturedUrl = String(input);
      capturedHeaders = { ...(init?.headers || {}) };
      capturedBody = init?.body ? Buffer.from(init.body).toString("utf8") : "";
      return new Response(
        JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          summary: { realizedRevenue: 1950, pendingVenuePayment: 400 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const ownerToken = createSignedSessionCookieValue({
      id: "usr-owner-01",
      role: "OWNER",
      email: "owner@boss.com",
      phone: "9999999999",
      name: "Hiren Patel",
    });

    const req = new NextRequest("https://boss-sports.vercel.app/api/admin/reports", {
      method: "GET",
      headers: { cookie: `boss_session=${ownerToken}` },
    });

    const res = await getAdminReportsHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.summary.realizedRevenue, 1950);
    assert.equal(capturedUrl, "https://boss-api.onrender.com/api/admin/reports/");
    assert.equal(capturedHeaders["X-Boss-Actor-Id"], "usr-owner-01");
    assert.equal(capturedHeaders["X-Boss-Actor-Role"], "OWNER");

    const ts = capturedHeaders["X-Boss-Timestamp"];
    const sig = capturedHeaders["X-Boss-Service-Signature"];
    assert.ok(ts && sig, "HMAC signature headers must be present");

    const bodyHash = createHash("sha256").update(Buffer.from(capturedBody, "utf8")).digest("hex");
    const expectedPayload = `${ts}\nGET\n/api/admin/reports/\nusr-owner-01\nOWNER\n${bodyHash}`;
    const expectedSig = createHmac("sha256", sharedSecret).update(expectedPayload).digest("hex");
    assert.equal(sig, expectedSig, "Signature must match Django verification algorithm byte-for-byte");
  });

  it("surfaces 503 service error when Django backend is unreachable instead of returning empty availability", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: "test-shared-hmac-secret-123",
    });

    mock.method(globalThis, "fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const req = new NextRequest(
      "https://boss-sports.vercel.app/api/pickleball/availability?date=2026-12-01"
    );
    const res = await getAvailabilityHandler(req);
    const data = await res.json();

    assert.equal(res.status, 503);
    assert.equal(data.success, false);
    assert.match(data.error, /unreachable|unavailable/i);
  });

  it("surfaces 502 error when Django upstream returns non-JSON 502 gateway HTML", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: "test-shared-hmac-secret-123",
    });

    mock.method(globalThis, "fetch", async () => {
      return new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      });
    });

    const holdReq = new NextRequest("https://boss-sports.vercel.app/api/pickleball/hold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courtId: "court-1",
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        sessionId: "sess-test-502",
      }),
    });

    const res = await placeHoldHandler(holdReq);
    const data = await res.json();

    assert.equal(res.status, 502);
    assert.equal(data.success, false);
  });

  it("strips forged source/paymentStatus before forwarding online guest booking to Django", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: "test-shared-hmac-secret-123",
    });

    let forwardedPayload: any = null;
    mock.method(globalThis, "fetch", async (_url: any, init: any) => {
      forwardedPayload = JSON.parse(Buffer.from(init.body).toString("utf8"));
      return new Response(
        JSON.stringify({ success: true, booking: { id: "BK-1", ...forwardedPayload } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const futureStart = new Date(Date.now() + 86400000).toISOString();
    const futureEnd = new Date(Date.now() + 90000000).toISOString();
    const req = new NextRequest("https://boss-sports.vercel.app/api/pickleball/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courtId: "court-1",
        startTime: futureStart,
        endTime: futureEnd,
        customerName: "Guest Test",
        customerPhone: "9876543210",
        source: "WALKIN",
        paymentStatus: "PAID_ONLINE",
        staffId: "forged-staff-id",
      }),
    });

    const res = await bookHandler(req);
    assert.equal(res.status, 200);
    assert.equal(forwardedPayload.source, "ONLINE");
    assert.equal(forwardedPayload.paymentStatus, "PAY_AT_VENUE");
  });

  it("blocks unauthenticated customer lookup before calling Django", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: "test-shared-hmac-secret-123",
    });

    let fetchCalled = false;
    mock.method(globalThis, "fetch", async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const req = new NextRequest("https://boss-sports.vercel.app/api/pickleball/bookings?phone=9876543210");
    const res = await getBookingsHandler(req);

    assert.equal(res.status, 401);
    assert.equal(fetchCalled, false);
  });

  it("returns 503 for /api/admin/reports on backend outage without silent zero revenue", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: "test-shared-hmac-secret-123",
      SESSION_SECRET: "test-cookie-session-secret-123456",
    });

    mock.method(globalThis, "fetch", async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8000");
    });

    const ownerCookie = createSignedSessionCookieValue({
      id: "usr-owner-01",
      role: "OWNER",
      email: "owner@boss.com",
    });
    const req = new NextRequest("https://boss-sports.vercel.app/api/admin/reports", {
      headers: { cookie: `boss_session=${ownerCookie}` },
    });
    const res = await getAdminReportsHandler(req);
    const data = await res.json();

    assert.equal(res.status, 503);
    assert.equal(data.success, false);
    assert.equal(data.summary, undefined);
  });

  it("propagates 409 slot conflict from Django without falling back to JSON store", async () => {
    restoreEnv = setEnv({
      VERCEL: "1",
      DJANGO_API_URL: "https://boss-api.onrender.com",
      BACKEND_SERVICE_SECRET: "test-shared-hmac-secret-123",
    });

    mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({ success: false, error: "This slot is currently held or booked." }),
        { status: 409, headers: { "content-type": "application/json" } }
      );
    });

    const req = new NextRequest("https://boss-sports.vercel.app/api/pickleball/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courtId: "court-1",
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        customerName: "Race Guest",
        customerPhone: "9876543210",
      }),
    });
    const res = await bookHandler(req);
    const data = await res.json();

    assert.equal(res.status, 409);
    assert.equal(data.success, false);
    assert.match(data.error, /held or booked/i);
  });
});

