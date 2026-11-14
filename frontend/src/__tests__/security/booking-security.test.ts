import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as cancelBookingHandler } from "@/app/api/pickleball/cancel/route";
import { POST as createBookingHandler } from "@/app/api/pickleball/book/route";
import {
  GET as getBookingsHandler,
  PATCH as updateBookingPaymentHandler,
} from "@/app/api/pickleball/bookings/route";
import { GET as getAvailabilityHandler } from "@/app/api/pickleball/availability/route";
import {
  POST as placeHoldHandler,
  DELETE as releaseHoldHandler,
} from "@/app/api/pickleball/hold/route";
import { GET as getAdminReportsHandler } from "@/app/api/admin/reports/route";
import {
  GET as getAdminPricingHandler,
  POST as updateAdminPricingHandler,
} from "@/app/api/admin/pricing/route";
import { POST as createBlockHandler } from "@/app/api/admin/blocks/route";
import { POST as updateScheduleHandler } from "@/app/api/admin/schedule/route";
import { GET as getAuthMeHandler } from "@/app/api/auth/me/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import {
  GET as getCourtsHandler,
  POST as addCourtHandler,
  PATCH as updateCourtHandler,
  DELETE as deleteCourtHandler,
} from "@/app/api/pickleball/courts/route";
import { createSignedSessionCookieValue } from "@/lib/auth/serverAuth";
import {
  pickleballDb,
  buildVenueIso,
  VENUE_TIMEZONE,
} from "@/lib/db/pickleballDb";
import { authDb } from "@/lib/auth/authDb";

// Helper to create NextRequest with JSON body and optional signed or raw session cookie
function createMockRequest(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, any>,
  sessionUser?: { id: string; name: string; role: string; token?: string },
  rawCookieHeader?: string
): NextRequest {
  const headers = new Headers();
  if (body) {
    headers.set("content-type", "application/json");
  }

  if (rawCookieHeader !== undefined) {
    headers.set("cookie", rawCookieHeader);
  } else if (sessionUser) {
    const signed = createSignedSessionCookieValue({
      id: sessionUser.id,
      role: sessionUser.role as "OWNER" | "EMPLOYEE" | "CUSTOMER",
    });
    headers.set("cookie", `boss_session=${signed}`);
  }

  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Generate collision-free future slot intervals for test fixtures
const runRandomDayOffset = 100 + Math.floor(Math.random() * 10000);
let slotCounter = 0;
function getUniqueSlot() {
  slotCounter += 1;
  const startMs = Date.now() + (runRandomDayOffset * 24 + slotCounter * 4) * 60 * 60 * 1000;
  return {
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 60 * 60 * 1000).toISOString(),
  };
}

describe("Security & Integrity Regression Suite: Boss Pickleball", () => {
  // Test accounts from authDb seeds
  const ownerUser = { id: "usr-owner-01", name: "Hiren Patel (Owner)", role: "OWNER" };
  const staffUser = { id: "usr-emp-01", name: "Karan Desai (Staff Desk)", role: "EMPLOYEE" };
  const customerA = { id: "usr-cust-01", name: "Vikram Singhania (Player)", role: "CUSTOMER" }; // phone: 9876543210
  let customerB: { id: string; name: string; role: string };

  const pickleballDbPath = path.join(process.cwd(), "data", "pickleball_database.json");
  const authDbPath = path.join(process.cwd(), "data", "users_auth.json");
  let pickleballSnapshot: string | null = null;
  let authSnapshot: string | null = null;

  before(() => {
    if (fs.existsSync(pickleballDbPath)) {
      pickleballSnapshot = fs.readFileSync(pickleballDbPath, "utf8");
    }
    if (fs.existsSync(authDbPath)) {
      authSnapshot = fs.readFileSync(authDbPath, "utf8");
    }

    // Ensure test customer account is present in authDb
    const regResult = authDb.register({
      name: "Sneha Sharma",
      email: "sneha@boss.com",
      phone: "9123456789",
      password: "BossCustomerB@2026",
    });
    if (regResult.success && regResult.user) {
      customerB = { id: regResult.user.id, name: regResult.user.name, role: "CUSTOMER" };
    } else {
      const existingAuth = authDb.authenticate("sneha@boss.com", "BossCustomerB@2026");
      customerB = existingAuth.success && existingAuth.user
        ? { id: existingAuth.user.id, name: existingAuth.user.name, role: "CUSTOMER" }
        : { id: "usr-cust-02", name: "Customer B", role: "CUSTOMER" };
    }
  });

  after(() => {
    if (pickleballSnapshot !== null) {
      fs.writeFileSync(pickleballDbPath, pickleballSnapshot, "utf8");
    } else if (fs.existsSync(pickleballDbPath)) {
      fs.unlinkSync(pickleballDbPath);
    }
    if (authSnapshot !== null) {
      fs.writeFileSync(authDbPath, authSnapshot, "utf8");
    } else if (fs.existsSync(authDbPath)) {
      fs.unlinkSync(authDbPath);
    }
  });

  // 1. Anonymous cancellation attempts
  it("Scenario 1: Anonymous cancellation attempt is rejected with 401", async () => {
    const req = createMockRequest("http://localhost:3000/api/pickleball/cancel", "POST", {
      bookingId: "BK-ANON-TEST",
      reason: "Unauthorized cancel attempt",
    });

    const res = await cancelBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 401, "Expected 401 Unauthorized for anonymous cancellation");
    assert.equal(data.success, false);
    assert.match(data.error, /Authentication required/i);
  });

  // 2. Customer attempting to cancel another customer's booking
  it("Scenario 2: Customer attempting to cancel another customer's booking receives generic 403 error", async () => {
    const { startTime, endTime } = getUniqueSlot();
    // Create a booking owned by Customer B (phone: 9123456789)
    const bookingResult = pickleballDb.createBooking({
      courtId: "court-1",
      startTime,
      endTime,
      customerName: "Sneha Sharma",
      customerPhone: "9123456789",
      customerEmail: "sneha@boss.com",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });
    assert.ok(bookingResult.success && bookingResult.booking, `Fixture booking creation should succeed: ${bookingResult.error}`);
    const targetBookingId = bookingResult.booking.id;

    // Customer A (phone: 9876543210) attempts to cancel Customer B's booking
    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/cancel",
      "POST",
      {
        bookingId: targetBookingId,
        reason: "Malicious cross-customer cancellation",
      },
      customerA // Session for Customer A
    );

    const res = await cancelBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 403, "Expected 403 Forbidden for cross-customer cancellation");
    assert.equal(data.success, false);
    // Error must be generic so it doesn't leak booking existence or details
    assert.equal(data.error, "Booking not found or access denied.");

    // Verify booking is still CONFIRMED in database
    const bookingInDb = pickleballDb.getBookingById(targetBookingId);
    assert.equal(bookingInDb?.status, "CONFIRMED", "Booking status must remain CONFIRMED");
  });

  // 3. Staff cancellation with valid session
  it("Scenario 3: Staff cancellation with valid session succeeds", async () => {
    const { startTime, endTime } = getUniqueSlot();
    const bookingResult = pickleballDb.createBooking({
      courtId: "court-2",
      startTime,
      endTime,
      customerName: "Rohan Varma",
      customerPhone: "9000000001",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });
    assert.ok(bookingResult.success && bookingResult.booking);
    const bookingId = bookingResult.booking.id;

    // Staff member cancels the booking
    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/cancel",
      "POST",
      {
        bookingId,
        reason: "Rain delay - staff override",
      },
      staffUser // Session for staff desk employee
    );

    const res = await cancelBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200, "Expected 200 OK for staff cancellation");
    assert.equal(data.success, true);
    assert.equal(data.booking.status, "CANCELLED");

    // Verify database state is CANCELLED
    const updated = pickleballDb.getBookingById(bookingId);
    assert.equal(updated?.status, "CANCELLED");
  });

  // 4. Forged staffId and WALKIN/PHONE source from an anonymous booking request
  it("Scenario 4: Forged staffId and WALKIN source from anonymous caller are sanitized", async () => {
    const { startTime, endTime } = getUniqueSlot();

    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/book",
      "POST",
      {
        courtId: "court-1",
        startTime,
        endTime,
        customerName: "Untrusted Actor",
        customerPhone: "9111111111",
        source: "WALKIN", // Forged source
        staffId: "usr-emp-01", // Forged staffId
        paymentStatus: "CASH_COUNTER", // Forged payment status
      }
      // No session cookie (anonymous)
    );

    const res = await createBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200, "Booking should be accepted but sanitized");
    assert.equal(data.success, true);
    assert.equal(data.booking.source, "ONLINE", "Source must be forced to ONLINE for anonymous callers");
    assert.equal(data.booking.paymentStatus, "PAY_AT_VENUE", "Payment status must be forced to PAY_AT_VENUE");
    assert.equal(data.booking.createdByStaffId, undefined, "StaffId must be ignored for anonymous callers");
  });

  // 5. Legitimate staff-created booking
  it("Scenario 5: Legitimate staff-created booking preserves WALKIN source and session staffId", async () => {
    const { startTime, endTime } = getUniqueSlot();

    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/book",
      "POST",
      {
        courtId: "court-3",
        startTime,
        endTime,
        customerName: "Desk Walk-in Player",
        customerPhone: "9222222222",
        source: "WALKIN",
        paymentStatus: "CASH_COUNTER",
        staffId: "spoofed-id-should-be-ignored", // Even if body sends a different id
      },
      staffUser // Authenticated EMPLOYEE session (usr-emp-01)
    );

    const res = await createBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.booking.source, "WALKIN", "Authenticated staff can create WALKIN bookings");
    assert.equal(data.booking.paymentStatus, "CASH_COUNTER", "Staff can set CASH_COUNTER");
    assert.equal(
      data.booking.createdByStaffId,
      "usr-emp-01",
      "staffId must be derived from session, not client body"
    );
  });

  // 6. Public attempt to forge a paid payment status
  it("Scenario 6: Public attempt to forge PAID_ONLINE payment status is forced to PAY_AT_VENUE", async () => {
    const { startTime, endTime } = getUniqueSlot();

    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/book",
      "POST",
      {
        courtId: "court-1",
        startTime,
        endTime,
        customerName: "Cheater Attempt",
        customerPhone: "9333333333",
        source: "ONLINE",
        paymentStatus: "PAID_ONLINE", // Forged online payment without gateway confirmation
      }
      // Public / unauthenticated caller
    );

    const res = await createBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(
      data.booking.paymentStatus,
      "PAY_AT_VENUE",
      "Public callers cannot mark bookings PAID_ONLINE without verified payment provider confirmation"
    );
  });

  // 7. Legitimate customer cancellation of own booking
  it("Scenario 7: Legitimate customer cancellation of own booking succeeds", async () => {
    const { startTime, endTime } = getUniqueSlot();

    // Create booking for Customer A (phone: 9876543210)
    const bookingResult = pickleballDb.createBooking({
      courtId: "court-1",
      startTime,
      endTime,
      customerName: "Vikram Singhania",
      customerPhone: "9876543210",
      customerEmail: "player@boss.com",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });
    assert.ok(bookingResult.success && bookingResult.booking);
    const bookingId = bookingResult.booking.id;

    // Customer A cancels their own booking
    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/cancel",
      "POST",
      {
        bookingId,
        reason: "Customer schedule conflict",
      },
      customerA
    );

    const res = await cancelBookingHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200, "Customer should be able to cancel their own booking");
    assert.equal(data.success, true);
    assert.equal(data.booking.status, "CANCELLED");

    const inDb = pickleballDb.getBookingById(bookingId);
    assert.equal(inDb?.status, "CANCELLED");
  });

  // 8. Unauthorized booking lookup is rejected with 401
  it("Scenario 8: Anonymous booking lookup is rejected with 401", async () => {
    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/bookings?phone=9876543210",
      "GET"
      // Anonymous
    );

    const res = await getBookingsHandler(req);
    const data = await res.json();

    assert.equal(res.status, 401, "Expected 401 for anonymous booking lookup");
    assert.equal(data.success, false);
    assert.match(data.error, /Authentication required/i);
  });

  // 9. Customer lookup is strictly isolated to own reservations and cannot access other customer bookings
  it("Scenario 9: Customer lookup returns only their own verified reservations", async () => {
    const { startTime, endTime } = getUniqueSlot();

    // Create a booking for Customer B
    pickleballDb.createBooking({
      courtId: "court-2",
      startTime,
      endTime,
      customerName: "Sneha Sharma",
      customerPhone: "9123456789",
      customerEmail: "sneha@boss.com",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });

    // Customer A queries bookings (even if attempting to request Customer B's phone number)
    const req = createMockRequest(
      "http://localhost:3000/api/pickleball/bookings?phone=9123456789",
      "GET",
      undefined,
      customerA // Session for Customer A
    );

    const res = await getBookingsHandler(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    // Verify none of the returned bookings belong to Customer B
    const leakedBooking = data.bookings.find((b: any) => b.customerPhone === "9123456789");
    assert.equal(leakedBooking, undefined, "Customer A must never receive Customer B's bookings");
  });

  // 10. Booking conflicts under duplicate/overlapping interval reservation
  it("Scenario 10: Double-booking interval overlap returns conflict error (409)", async () => {
    const { startTime, endTime } = getUniqueSlot();

    // First booking reservation succeeds
    const firstReq = createMockRequest(
      "http://localhost:3000/api/pickleball/book",
      "POST",
      {
        courtId: "court-1",
        startTime,
        endTime,
        customerName: "First Reserver",
        customerPhone: "9777777777",
        source: "ONLINE",
        paymentStatus: "PAY_AT_VENUE",
      }
    );
    const firstRes = await createBookingHandler(firstReq);
    const firstData = await firstRes.json();
    assert.equal(firstRes.status, 200);
    assert.equal(firstData.success, true);

    // Second booking reservation on the exact same court and time interval is rejected with 409
    const secondReq = createMockRequest(
      "http://localhost:3000/api/pickleball/book",
      "POST",
      {
        courtId: "court-1",
        startTime,
        endTime,
        customerName: "Conflicting Booker",
        customerPhone: "9666666666",
        source: "ONLINE",
        paymentStatus: "PAY_AT_VENUE",
      }
    );
    const secondRes = await createBookingHandler(secondReq);
    const secondData = await secondRes.json();

    assert.equal(secondRes.status, 409, "Second concurrent/conflicting booking must be rejected with 409");
    assert.equal(secondData.success, false);
    assert.match(secondData.error, /conflict/i);
  });

  // 11. Hold expiry: Expired holds are pruned and do not block subsequent bookings
  it("Scenario 11: Expired slot holds are pruned and permit subsequent reservations", async () => {
    const { startTime, endTime } = getUniqueSlot();

    // Place an expired hold directly into db state
    const holdRes = pickleballDb.placeHold({
      courtId: "court-3",
      startTime,
      endTime,
      sessionId: "sess-expired-test",
    });
    assert.ok(holdRes.success && holdRes.hold);

    // Manually backdate the hold's expiration into the past
    holdRes.hold.expiresAt = new Date(Date.now() - 5000).toISOString();

    // A new customer attempts to book the slot after the hold has expired
    const bookReq = createMockRequest(
      "http://localhost:3000/api/pickleball/book",
      "POST",
      {
        courtId: "court-3",
        startTime,
        endTime,
        customerName: "New Player",
        customerPhone: "9555555555",
        source: "ONLINE",
        paymentStatus: "PAY_AT_VENUE",
        sessionId: "sess-new-user",
      }
    );

    const res = await createBookingHandler(bookReq);
    const data = await res.json();

    assert.equal(res.status, 200, "Booking should succeed because previous hold has expired");
    assert.equal(data.success, true);
  });

  // 12. Timezone consistency: Venue operates strictly in Asia/Kolkata (IST, UTC+05:30)
  it("Scenario 12: Availability slots and peak-hour billing resolve accurately in Asia/Kolkata (IST)", async () => {
    assert.equal(VENUE_TIMEZONE, "Asia/Kolkata");
    assert.equal(
      buildVenueIso("2028-06-15", 14, 0),
      "2028-06-15T08:30:00.000Z",
      "14:00 IST must map to 08:30:00.000Z UTC"
    );

    const avail = pickleballDb.getAvailability("2028-06-15", "court-1");
    assert.equal(avail.timezone, "Asia/Kolkata");
    assert.equal(avail.courts.length, 1);

    const slot2pm = avail.courts[0].slots.find((s: any) => s.startTime === "2028-06-15T08:30:00.000Z");
    assert.ok(slot2pm, "Expected 14:00 IST slot");
    assert.equal(slot2pm.startTime, "2028-06-15T08:30:00.000Z");
    assert.equal(slot2pm.endTime, "2028-06-15T09:00:00.000Z");

    // Verify IST peak hour calculation matches availability slot quote
    const peakHourRaw = avail.pricingConfig?.peakHours?.[0] ?? "18:00";
    const peakHour = parseInt(String(peakHourRaw).split(":")[0], 10);
    const peakStart = buildVenueIso("2028-06-15", peakHour, 0);
    const peakEnd = buildVenueIso("2028-06-15", peakHour + 1, 0);
    const expectedPeakPrice = avail.pricingConfig?.isPeakSurgeActive
      ? avail.pricingConfig.peakSurgePricePerHour
      : avail.pricingConfig?.basePricePerHour;

    const bookRes = pickleballDb.createBooking({
      courtId: "court-1",
      startTime: peakStart,
      endTime: peakEnd,
      customerName: "IST Peak Tester",
      customerPhone: "9444444441",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });
    assert.ok(bookRes.success && bookRes.booking);
    assert.equal(
      bookRes.booking.totalPrice,
      expectedPeakPrice,
      `Peak hour ${peakHour}:00 IST must be billed at IST peak rate regardless of server timezone`
    );
  });

  // 13. Revenue integrity: Pending PAY_AT_VENUE & CANCELLED bookings do not inflate realizedRevenue
  it("Scenario 13: PAY_AT_VENUE adds only to grossBookedValue & pendingVenuePayment; cancelling removes pending value", async () => {
    const startTime = buildVenueIso("2028-06-16", 10, 0);
    const endTime = buildVenueIso("2028-06-16", 11, 0);
    const beforeReport = pickleballDb.getPickleballReport();

    const bookReq = createMockRequest("http://localhost:3000/api/pickleball/book", "POST", {
      courtId: "court-2",
      startTime,
      endTime,
      customerName: "Pending Venue Player",
      customerPhone: "9876543210",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });
    const bookRes = await createBookingHandler(bookReq);
    const bookData = await bookRes.json();
    assert.equal(bookRes.status, 200);
    assert.equal(bookData.booking.paymentStatus, "PAY_AT_VENUE");
    const price = bookData.booking.totalPrice;

    const afterCreateReport = pickleballDb.getPickleballReport();
    assert.equal(
      afterCreateReport.realizedRevenue,
      beforeReport.realizedRevenue,
      "Unpaid PAY_AT_VENUE booking must not increase realizedRevenue"
    );
    assert.equal(
      afterCreateReport.pendingVenuePayment,
      beforeReport.pendingVenuePayment + price
    );
    assert.equal(
      afterCreateReport.grossBookedValue,
      beforeReport.grossBookedValue + price
    );

    // Cancelling the pending booking removes it from grossBookedValue & pendingVenuePayment
    const cancelReq = createMockRequest(
      "http://localhost:3000/api/pickleball/cancel",
      "POST",
      { bookingId: bookData.booking.id, reason: "Schedule changed" },
      customerA
    );
    const cancelRes = await cancelBookingHandler(cancelReq);
    assert.equal(cancelRes.status, 200);

    const afterCancelReport = pickleballDb.getPickleballReport();
    assert.equal(afterCancelReport.realizedRevenue, beforeReport.realizedRevenue);
    assert.equal(afterCancelReport.pendingVenuePayment, beforeReport.pendingVenuePayment);
    assert.equal(afterCancelReport.grossBookedValue, beforeReport.grossBookedValue);
  });

  // 14. Staff counter payment collection via PATCH /api/pickleball/bookings & Admin report sync
  it("Scenario 14: Staff payment collection transitions PAY_AT_VENUE to realizedRevenue and blocks non-staff callers", async () => {
    const startTime = buildVenueIso("2028-06-17", 11, 0);
    const endTime = buildVenueIso("2028-06-17", 12, 0);
    const beforeReport = pickleballDb.getPickleballReport();

    const bookRes = await createBookingHandler(
      createMockRequest("http://localhost:3000/api/pickleball/book", "POST", {
        courtId: "court-1",
        startTime,
        endTime,
        customerName: "Venue Settler",
        customerPhone: "9876543210",
        source: "ONLINE",
        paymentStatus: "PAY_AT_VENUE",
      })
    );
    const bookData = await bookRes.json();
    assert.equal(bookRes.status, 200);
    const bookingId = bookData.booking.id;
    const price = bookData.booking.totalPrice;

    // Anonymous caller cannot collect payment
    const anonPatch = await updateBookingPaymentHandler(
      createMockRequest("http://localhost:3000/api/pickleball/bookings", "PATCH", {
        bookingId,
        paymentStatus: "UPI_COUNTER",
      })
    );
    assert.equal(anonPatch.status, 401);

    // Customer caller cannot mark own booking paid at counter
    const custPatch = await updateBookingPaymentHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/bookings",
        "PATCH",
        { bookingId, paymentStatus: "CASH_COUNTER" },
        customerA
      )
    );
    assert.equal(custPatch.status, 403);

    // Staff records UPI_COUNTER payment
    const staffPatch = await updateBookingPaymentHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/bookings",
        "PATCH",
        { bookingId, paymentStatus: "UPI_COUNTER" },
        staffUser
      )
    );
    const staffPatchData = await staffPatch.json();
    assert.equal(staffPatch.status, 200);
    assert.equal(staffPatchData.success, true);
    assert.equal(staffPatchData.booking.paymentStatus, "UPI_COUNTER");

    // Verify owner admin report reflects realizedRevenue & pendingVenuePayment accurately
    const ownerReportRes = await getAdminReportsHandler(
      createMockRequest("http://localhost:3000/api/admin/reports", "GET", undefined, ownerUser)
    );
    const ownerReportData = await ownerReportRes.json();
    assert.equal(ownerReportRes.status, 200);
    assert.equal(ownerReportData.summary.realizedRevenue, beforeReport.realizedRevenue + price);
    assert.equal(ownerReportData.summary.pendingVenuePayment, beforeReport.pendingVenuePayment);
    assert.equal(ownerReportData.summary.totalUpiReconciliation, beforeReport.upiCounterRevenue + price);
  });

  // 15. Cross-session availability synchronization: hold, zero-PII public feed, conflict 409, DELETE release
  it("Scenario 15: Holds synchronize across independent sessions without leaking PII and release cleanly on DELETE", async () => {
    const targetDate = "2028-07-20";
    const startTime = buildVenueIso(targetDate, 11, 0);
    const endTime = buildVenueIso(targetDate, 12, 0);

    // Session A places hold
    const holdResA = await placeHoldHandler(
      createMockRequest("http://localhost:3000/api/pickleball/hold", "POST", {
        courtId: "court-1",
        startTime,
        endTime,
        sessionId: "sess-alpha",
      })
    );
    const holdDataA = await holdResA.json();
    assert.equal(holdResA.status, 200);
    assert.equal(holdDataA.success, true);

    // Session B polls public availability (no auth) -> must see HELD with Cache-Control: no-store and zero PII
    const availResB = await getAvailabilityHandler(
      createMockRequest(
        `http://localhost:3000/api/pickleball/availability?date=${targetDate}&courtId=court-1`,
        "GET"
      )
    );
    const availDataB = await availResB.json();
    assert.equal(availResB.status, 200);
    assert.match(availResB.headers.get("cache-control") || "", /no-store/i);

    const publicSlot = availDataB.availability[0].slots.find((s: any) => s.startTime === startTime);
    assert.ok(publicSlot);
    assert.equal(publicSlot.status, "HELD");
    assert.equal(publicSlot.customerPhone, undefined, "Public feed must never expose customerPhone");
    assert.equal(publicSlot.customerName, undefined, "Public feed must never expose customerName");
    assert.equal(publicSlot.bookingId, undefined, "Public feed must never expose bookingId");
    assert.equal(publicSlot.holdSessionId, undefined, "Public feed must never expose holdSessionId");

    // Session B cannot overwrite Session A's active hold
    const conflictHoldRes = await placeHoldHandler(
      createMockRequest("http://localhost:3000/api/pickleball/hold", "POST", {
        courtId: "court-1",
        startTime,
        endTime,
        sessionId: "sess-beta",
      })
    );
    assert.equal(conflictHoldRes.status, 409);

    // Session A releases hold explicitly via DELETE /api/pickleball/hold
    const relRes = await releaseHoldHandler(
      createMockRequest("http://localhost:3000/api/pickleball/hold", "DELETE", {
        sessionId: "sess-alpha",
        holdId: holdDataA.hold.id,
      })
    );
    const relData = await relRes.json();
    assert.equal(relRes.status, 200);
    assert.ok(relData.releasedCount >= 1);

    // Session B polls again and immediately sees AVAILABLE
    const availAfterRelease = await (
      await getAvailabilityHandler(
        createMockRequest(
          `http://localhost:3000/api/pickleball/availability?date=${targetDate}&courtId=court-1`,
          "GET"
        )
      )
    ).json();
    const slotAfterRelease = availAfterRelease.availability[0].slots.find(
      (s: any) => s.startTime === startTime
    );
    assert.equal(slotAfterRelease.status, "AVAILABLE");
  });

  // 16. Expired hold pruning across GET /api/pickleball/availability
  it("Scenario 16: Expired hold becomes AVAILABLE on next availability poll across sessions", async () => {
    const targetDate = "2028-07-21";
    const startTime = buildVenueIso(targetDate, 9, 0);
    const endTime = buildVenueIso(targetDate, 10, 0);

    const holdRes = pickleballDb.placeHold({
      courtId: "court-2",
      startTime,
      endTime,
      sessionId: "sess-expire-sync",
    });
    assert.ok(holdRes.success && holdRes.hold);
    holdRes.hold.expiresAt = new Date(Date.now() - 10_000).toISOString();

    const availRes = await getAvailabilityHandler(
      createMockRequest(
        `http://localhost:3000/api/pickleball/availability?date=${targetDate}&courtId=court-2`,
        "GET"
      )
    );
    const availData = await availRes.json();
    assert.equal(availRes.status, 200);
    const slot = availData.availability[0].slots.find((s: any) => s.startTime === startTime);
    assert.equal(slot.status, "AVAILABLE", "Expired hold must stop blocking availability");
  });

  // 17. Concurrent booking attempts, cancellation release, and court block sync
  it("Scenario 17: Simultaneous bookings allow one winner, cancellation re-opens slot, and court block blocks bookings", async () => {
    const targetDate = "2028-07-22";
    const startTime = buildVenueIso(targetDate, 16, 0);
    const endTime = buildVenueIso(targetDate, 17, 0);

    const req1 = createMockRequest("http://localhost:3000/api/pickleball/book", "POST", {
      courtId: "court-1",
      startTime,
      endTime,
      customerName: "Player One",
      customerPhone: "9876543210",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });
    const req2 = createMockRequest("http://localhost:3000/api/pickleball/book", "POST", {
      courtId: "court-1",
      startTime,
      endTime,
      customerName: "Player Two",
      customerPhone: "9123456789",
      source: "ONLINE",
      paymentStatus: "PAY_AT_VENUE",
    });

    const [res1, res2] = await Promise.all([createBookingHandler(req1), createBookingHandler(req2)]);
    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409], "Exactly one simultaneous booking succeeds and one conflicts");

    const data1 = await res1.json();
    const data2 = await res2.json();
    const winnerBookingId = res1.status === 200 ? data1.booking.id : data2.booking.id;

    // Staff cancels winner booking -> slot returns to AVAILABLE
    const cancelRes = await cancelBookingHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/cancel",
        "POST",
        { bookingId: winnerBookingId, reason: "Free up court" },
        staffUser
      )
    );
    assert.equal(cancelRes.status, 200);

    const availAfterCancel = await (
      await getAvailabilityHandler(
        createMockRequest(
          `http://localhost:3000/api/pickleball/availability?date=${targetDate}&courtId=court-1`,
          "GET"
        )
      )
    ).json();
    const reopenedSlot = availAfterCancel.availability[0].slots.find((s: any) => s.startTime === startTime);
    assert.equal(reopenedSlot.status, "AVAILABLE");

    // Staff creates maintenance block on court-2 -> availability shows BLOCKED & booking fails with 409
    const blockStart = buildVenueIso(targetDate, 17, 0);
    const blockEnd = buildVenueIso(targetDate, 18, 0);
    const blockRes = await createBlockHandler(
      createMockRequest(
        "http://localhost:3000/api/admin/blocks",
        "POST",
        {
          courtId: "court-2",
          startTime: blockStart,
          endTime: blockEnd,
          reason: "MAINTENANCE",
          notes: "Net tension maintenance",
        },
        staffUser
      )
    );
    assert.equal(blockRes.status, 200);

    const availBlocked = await (
      await getAvailabilityHandler(
        createMockRequest(
          `http://localhost:3000/api/pickleball/availability?date=${targetDate}&courtId=court-2`,
          "GET"
        )
      )
    ).json();
    const blockedSlot = availBlocked.availability[0].slots.find((s: any) => s.startTime === blockStart);
    assert.equal(blockedSlot.status, "BLOCKED");

    const bookBlockedRes = await createBookingHandler(
      createMockRequest("http://localhost:3000/api/pickleball/book", "POST", {
        courtId: "court-2",
        startTime: blockStart,
        endTime: blockEnd,
        customerName: "Late Booker",
        customerPhone: "9876543210",
        source: "ONLINE",
        paymentStatus: "PAY_AT_VENUE",
      })
    );
    assert.equal(bookBlockedRes.status, 409);
  });

  // 18. Strict server-side RBAC on owner and staff dashboard endpoints
  it("Scenario 18: Protected admin & staff routes strictly enforce OWNER/EMPLOYEE session roles", async () => {
    // Reports & pricing are OWNER-only
    assert.equal(
      (await getAdminReportsHandler(createMockRequest("http://localhost:3000/api/admin/reports", "GET"))).status,
      401
    );
    assert.equal(
      (await getAdminReportsHandler(createMockRequest("http://localhost:3000/api/admin/reports", "GET", undefined, customerA))).status,
      403
    );
    assert.equal(
      (await getAdminReportsHandler(createMockRequest("http://localhost:3000/api/admin/reports", "GET", undefined, staffUser))).status,
      403
    );
    assert.equal(
      (await getAdminReportsHandler(createMockRequest("http://localhost:3000/api/admin/reports", "GET", undefined, ownerUser))).status,
      200
    );

    assert.equal(
      (await getAdminPricingHandler(createMockRequest("http://localhost:3000/api/admin/pricing", "GET"))).status,
      401
    );
    assert.equal(
      (await getAdminPricingHandler(createMockRequest("http://localhost:3000/api/admin/pricing", "GET", undefined, customerA))).status,
      403
    );
    assert.equal(
      (await getAdminPricingHandler(createMockRequest("http://localhost:3000/api/admin/pricing", "GET", undefined, staffUser))).status,
      403
    );
    assert.equal(
      (await getAdminPricingHandler(createMockRequest("http://localhost:3000/api/admin/pricing", "GET", undefined, ownerUser))).status,
      200
    );

    assert.equal(
      (
        await updateAdminPricingHandler(
          createMockRequest(
            "http://localhost:3000/api/admin/pricing",
            "POST",
            { basePrice: 1, peakSurgePrice: 1, isPeakSurgeActive: false },
            staffUser
          )
        )
      ).status,
      403
    );

    // Blocks & schedule mutations reject anonymous (401) and customers (403)
    assert.equal(
      (
        await createBlockHandler(
          createMockRequest("http://localhost:3000/api/admin/blocks", "POST", {
            courtId: "court-1",
            startTime: buildVenueIso("2028-07-23", 10, 0),
            endTime: buildVenueIso("2028-07-23", 11, 0),
            reason: "MAINTENANCE",
          })
        )
      ).status,
      401
    );
    assert.equal(
      (
        await createBlockHandler(
          createMockRequest(
            "http://localhost:3000/api/admin/blocks",
            "POST",
            {
              courtId: "court-1",
              startTime: buildVenueIso("2028-07-23", 10, 0),
              endTime: buildVenueIso("2028-07-23", 11, 0),
              reason: "MAINTENANCE",
            },
            customerA
          )
        )
      ).status,
      403
    );
    assert.equal(
      (
        await updateScheduleHandler(
          createMockRequest(
            "http://localhost:3000/api/admin/schedule",
            "POST",
            { date: "2028-07-23", isClosed: true, closureReason: "Forged closure" },
            customerA
          )
        )
      ).status,
      403
    );
  });

  // 19. Forged/unsigned/tampered/expired cookies rejected + logout clears cookie
  it("Scenario 19: Unsigned, tampered, and expired boss_session cookies are rejected across endpoints", async () => {
    const unsignedCookie = `boss_session=${encodeURIComponent(JSON.stringify(ownerUser))}`;
    assert.equal(
      (
        await getAdminReportsHandler(
          createMockRequest("http://localhost:3000/api/admin/reports", "GET", undefined, undefined, unsignedCookie)
        )
      ).status,
      401
    );
    const meUnsigned = await getAuthMeHandler(
      createMockRequest("http://localhost:3000/api/auth/me", "GET", undefined, undefined, unsignedCookie)
    );
    const meUnsignedData = await meUnsigned.json();
    assert.equal(meUnsignedData.authenticated, false);

    // Tampered HMAC signature
    const validSigned = createSignedSessionCookieValue({ id: ownerUser.id, role: "OWNER" });
    const tampered = `${validSigned.slice(0, -1)}${validSigned.endsWith("A") ? "B" : "A"}`;
    assert.equal(
      (
        await getAdminReportsHandler(
          createMockRequest(
            "http://localhost:3000/api/admin/reports",
            "GET",
            undefined,
            undefined,
            `boss_session=${tampered}`
          )
        )
      ).status,
      401
    );

    // Expired signed cookie
    const expiredSigned = createSignedSessionCookieValue({ id: ownerUser.id, role: "OWNER" }, -60);
    assert.equal(
      (
        await getAdminReportsHandler(
          createMockRequest(
            "http://localhost:3000/api/admin/reports",
            "GET",
            undefined,
            undefined,
            `boss_session=${expiredSigned}`
          )
        )
      ).status,
      401
    );

    // Valid cookie succeeds, and logout clears cookie with Max-Age=0
    const meValid = await getAuthMeHandler(
      createMockRequest("http://localhost:3000/api/auth/me", "GET", undefined, ownerUser)
    );
    assert.equal((await meValid.json()).authenticated, true);

    const logoutRes = await logoutHandler(
      createMockRequest("http://localhost:3000/api/auth/logout", "POST", undefined, ownerUser)
    );
    assert.equal(logoutRes.status, 200);
    const setCookieHeader = logoutRes.headers.get("set-cookie") || "";
    assert.match(setCookieHeader, /boss_session=;/);
    assert.match(setCookieHeader, /Max-Age=0/i);
  });

  // 20. Owner-only court & pricing controls (/api/pickleball/courts)
  it("Scenario 20: Only OWNER can create, delete, or reprice courts; STAFF limited to isActive toggle", async () => {
    // Public GET works
    assert.equal(
      (await getCourtsHandler(createMockRequest("http://localhost:3000/api/pickleball/courts", "GET"))).status,
      200
    );

    // Anonymous -> 401
    assert.equal(
      (await addCourtHandler(createMockRequest("http://localhost:3000/api/pickleball/courts", "POST", { name: "Court X" }))).status,
      401
    );

    // CUSTOMER -> 403
    assert.equal(
      (await addCourtHandler(createMockRequest("http://localhost:3000/api/pickleball/courts", "POST", { name: "Court X" }, customerA))).status,
      403
    );

    // STAFF -> 403 on add, delete, and price/config changes
    assert.equal(
      (await addCourtHandler(createMockRequest("http://localhost:3000/api/pickleball/courts", "POST", { name: "Court X" }, staffUser))).status,
      403
    );
    assert.equal(
      (await deleteCourtHandler(createMockRequest("http://localhost:3000/api/pickleball/courts?courtId=court-1", "DELETE", undefined, staffUser))).status,
      403
    );
    assert.equal(
      (
        await updateCourtHandler(
          createMockRequest(
            "http://localhost:3000/api/pickleball/courts",
            "PATCH",
            { courtId: "court-1", basePricePerHour: 1 },
            staffUser
          )
        )
      ).status,
      403
    );

    // STAFF -> 200 when toggling maintenance isActive ONLY
    assert.equal(
      (
        await updateCourtHandler(
          createMockRequest(
            "http://localhost:3000/api/pickleball/courts",
            "PATCH",
            { courtId: "court-1", isActive: false },
            staffUser
          )
        )
      ).status,
      200
    );
    assert.equal(
      (
        await updateCourtHandler(
          createMockRequest(
            "http://localhost:3000/api/pickleball/courts",
            "PATCH",
            { courtId: "court-1", isActive: true },
            staffUser
          )
        )
      ).status,
      200
    );

    // OWNER -> 200 for add, price PATCH, and delete
    const createRes = await addCourtHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/courts",
        "POST",
        { name: "Test Court 99", basePricePerHour: 500 },
        ownerUser
      )
    );
    assert.equal(createRes.status, 200);
    const createdCourtId = (await createRes.json()).court.id;

    assert.equal(
      (
        await updateCourtHandler(
          createMockRequest(
            "http://localhost:3000/api/pickleball/courts",
            "PATCH",
            { courtId: createdCourtId, basePricePerHour: 550 },
            ownerUser
          )
        )
      ).status,
      200
    );
    assert.equal(
      (
        await deleteCourtHandler(
          createMockRequest(
            `http://localhost:3000/api/pickleball/courts?courtId=${createdCourtId}`,
            "DELETE",
            undefined,
            ownerUser
          )
        )
      ).status,
      200
    );
  });

  // 21. Customer 2-hour cancellation enforcement & honest refund status
  it("Scenario 21: Customer self-cancel blocked <2h before start; cancellation never sets unverified REFUNDED", async () => {
    const soonStart = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    const soonEnd = new Date(Date.now() + 105 * 60 * 1000).toISOString();
    const custAccount = authDb.getUserById(customerA.id);

    const created = pickleballDb.createBooking({
      courtId: "court-3",
      startTime: soonStart,
      endTime: soonEnd,
      customerName: customerA.name,
      customerPhone: custAccount?.phone || "9876543210",
      customerEmail: custAccount?.email,
      source: "ONLINE",
      paymentStatus: "PAID_ONLINE",
    });
    assert.ok(created.success && created.booking);
    const soonBookingId = created.booking.id;

    // Customer cannot self-cancel within 2 hours
    const custCancelRes = await cancelBookingHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/cancel",
        "POST",
        { bookingId: soonBookingId, reason: "Running late" },
        customerA
      )
    );
    assert.equal(custCancelRes.status, 400);
    const custCancelData = await custCancelRes.json();
    assert.match(custCancelData.error, /2 hours/i);

    // Staff cancels -> succeeds cleanly without falsely marking REFUNDED without gateway proof
    const staffCancelRes = await cancelBookingHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/cancel",
        "POST",
        { bookingId: soonBookingId, reason: "Customer called desk" },
        staffUser
      )
    );
    assert.equal(staffCancelRes.status, 200);
    const staffCancelData = await staffCancelRes.json();
    assert.equal(staffCancelData.booking.status, "CANCELLED");
    assert.equal(staffCancelData.refundable, false);
    assert.equal(staffCancelData.booking.paymentStatus, "PAID_ONLINE");
  });

  // 22. IST midnight boundary date filtering & persisted report reconciliation
  it("Scenario 22: IST midnight bookings filter by Asia/Kolkata date and realized revenue persists across reads", async () => {
    // 2028-07-25 00:30 IST is 2028-07-24 19:00 UTC
    const startIstMidnight = "2028-07-25T00:30:00+05:30";
    const endIstMidnight = "2028-07-25T01:30:00+05:30";
    const custAccount = authDb.getUserById(customerA.id);

    const beforeReport = pickleballDb.getPickleballReport();

    const bookRes = await createBookingHandler(
      createMockRequest(
        "http://localhost:3000/api/pickleball/book",
        "POST",
        {
          courtId: "court-1",
          startTime: startIstMidnight,
          endTime: endIstMidnight,
          customerName: customerA.name,
          customerPhone: custAccount?.phone || "9876543210",
          customerEmail: custAccount?.email,
          source: "WALKIN",
          paymentStatus: "UPI_COUNTER",
        },
        staffUser
      )
    );
    assert.equal(bookRes.status, 200);
    const booked = (await bookRes.json()).booking;

    // Must appear under 2028-07-25 IST, NOT 2028-07-24
    const istJuly25Res = await getBookingsHandler(
      createMockRequest("http://localhost:3000/api/pickleball/bookings?date=2028-07-25", "GET", undefined, staffUser)
    );
    const istJuly25Data = await istJuly25Res.json();
    assert.ok(
      istJuly25Data.bookings.some((b: any) => b.id === booked.id),
      "00:30 IST slot must belong to IST date 2028-07-25"
    );

    const istJuly24Res = await getBookingsHandler(
      createMockRequest("http://localhost:3000/api/pickleball/bookings?date=2028-07-24", "GET", undefined, staffUser)
    );
    const istJuly24Data = await istJuly24Res.json();
    assert.equal(
      istJuly24Data.bookings.some((b: any) => b.id === booked.id),
      false,
      "00:30 IST slot must not leak into previous UTC date 2028-07-24"
    );

    // Owner report reflects exact persisted counter settlement
    const afterReportRes = await getAdminReportsHandler(
      createMockRequest("http://localhost:3000/api/admin/reports", "GET", undefined, ownerUser)
    );
    assert.equal(afterReportRes.status, 200);
    const afterReport = await afterReportRes.json();
    assert.equal(
      afterReport.summary.realizedRevenue,
      beforeReport.realizedRevenue + booked.totalPrice
    );
  });
});
