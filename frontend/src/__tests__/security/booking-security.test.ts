import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as cancelBookingHandler } from "@/app/api/pickleball/cancel/route";
import { POST as createBookingHandler } from "@/app/api/pickleball/book/route";
import { GET as getBookingsHandler } from "@/app/api/pickleball/bookings/route";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { authDb } from "@/lib/auth/authDb";

// Helper to create NextRequest with JSON body and optional session cookie
function createMockRequest(
  url: string,
  method: "GET" | "POST",
  body?: Record<string, any>,
  sessionUser?: { id: string; name: string; role: string; token?: string }
): NextRequest {
  const headers = new Headers();
  if (body) {
    headers.set("content-type", "application/json");
  }

  if (sessionUser) {
    headers.set(
      "cookie",
      `boss_session=${encodeURIComponent(JSON.stringify(sessionUser))}`
    );
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
  const staffUser = { id: "usr-emp-01", name: "Karan Desai (Staff Desk)", role: "EMPLOYEE" };
  const customerA = { id: "usr-cust-01", name: "Vikram Singhania (Player)", role: "CUSTOMER" }; // phone: 9876543210
  let customerB: { id: string; name: string; role: string };

  before(() => {
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
      customerB = { id: "usr-cust-02", name: "Customer B", role: "CUSTOMER" };
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
});
