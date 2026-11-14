import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  rowToCourt,
  rowToBooking,
  rowToSlotHold,
  rowToArenaSchedule,
  rowToPricingConfig,
  rowToAppUser,
  hasIntervalOverlap,
} from "../../lib/supabase/supabaseDb";

describe("Cloudflare & Supabase Migration Integrity Suite", () => {
  it("Scenario 1: Cloudflare Pages configuration files exist and specify nodejs_compat", () => {
    const wranglerJsoncPath = path.resolve(process.cwd(), "wrangler.jsonc");
    const wranglerTomlPath = path.resolve(process.cwd(), "wrangler.toml");

    assert.ok(fs.existsSync(wranglerJsoncPath) || fs.existsSync(wranglerTomlPath), "Wrangler config must exist");

    if (fs.existsSync(wranglerJsoncPath)) {
      const content = fs.readFileSync(wranglerJsoncPath, "utf-8");
      assert.ok(content.includes("nodejs_compat"), "wrangler.jsonc must include nodejs_compat flag");
      assert.ok(content.includes(".vercel/output/static"), "wrangler.jsonc must point to .vercel/output/static");
    }

    if (fs.existsSync(wranglerTomlPath)) {
      const content = fs.readFileSync(wranglerTomlPath, "utf-8");
      assert.ok(content.includes("nodejs_compat"), "wrangler.toml must include nodejs_compat");
      assert.ok(content.includes(".vercel/output/static"), "wrangler.toml must point to .vercel/output/static");
    }
  });

  it("Scenario 2: Supabase schema migration file exists with complete DDL and storage bucket", () => {
    const schemaPath = path.resolve(process.cwd(), "..", "supabase", "schema.sql");
    assert.ok(fs.existsSync(schemaPath), "supabase/schema.sql must exist");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // Check essential tables
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.courts"), "Must define courts table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.bookings"), "Must define bookings table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.slot_holds"), "Must define slot_holds table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.pricing_config"), "Must define pricing_config table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.arena_schedules"), "Must define arena_schedules table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.schedule_blocks"), "Must define schedule_blocks table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.discounts"), "Must define discounts table");
    assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.app_users"), "Must define app_users table");

    // Check payment screenshot storage bucket configuration
    assert.ok(schemaSql.includes("payment-proofs"), "Must create payment-proofs Supabase Storage bucket");
  });

  it("Scenario 3: rowToCourt transforms Postgres snake_case to TypeScript Court interface accurately", () => {
    const row = {
      id: "court-1",
      court_number: 1,
      name: "Court 1",
      surface_type: "Pro Cushion Acrylic",
      is_indoor: true,
      base_price_per_hour: "400.00",
      is_active: true,
    };

    const court = rowToCourt(row);
    assert.equal(court.id, "court-1");
    assert.equal(court.courtNumber, 1);
    assert.equal(court.name, "Court 1");
    assert.equal(court.surfaceType, "Pro Cushion Acrylic");
    assert.equal(court.isIndoor, true);
    assert.equal(court.basePricePerHour, 400);
    assert.equal(court.isActive, true);
  });

  it("Scenario 4: rowToBooking accurately maps all manual UPI payment verification fields", () => {
    const row = {
      id: "bk-12345",
      court_id: "court-1",
      court_name: "Court 1",
      start_time: "2028-06-15T08:30:00.000Z",
      end_time: "2028-06-15T09:30:00.000Z",
      duration_minutes: 60,
      duration_display: "1 hour",
      customer_name: "Karan Patel",
      customer_phone: "9876543210",
      customer_email: "karan@example.com",
      source: "ONLINE",
      status: "PENDING_VERIFICATION",
      payment_status: "PENDING",
      payment_method: "UPI_MANUAL",
      payment_screenshot_url: "/api/bookings/payment-proof?file=proof_1730000000_abc.png",
      payment_utr: "123456789012",
      payment_verified_by: null,
      payment_verified_at: null,
      payment_rejection_reason: null,
      total_price: "400.00",
      discount_code: null,
      discount_amount: "0.00",
      equipment_addons: { paddles: 2 },
      notes: "First time playing",
      cancellation_reason: null,
      cancelled_at: null,
      created_by_staff_id: null,
      created_at: "2028-06-15T08:00:00.000Z",
      updated_at: "2028-06-15T08:00:00.000Z",
    };

    const booking = rowToBooking(row);
    assert.equal(booking.id, "bk-12345");
    assert.equal(booking.courtId, "court-1");
    assert.equal(booking.status, "PENDING_VERIFICATION");
    assert.equal(booking.paymentStatus, "PENDING");
    assert.equal(booking.paymentMethod, "UPI_MANUAL");
    assert.equal(booking.paymentUtr, "123456789012");
    assert.equal(booking.paymentScreenshotUrl, "/api/bookings/payment-proof?file=proof_1730000000_abc.png");
    assert.equal(booking.totalPrice, 400);
    assert.deepEqual(booking.equipmentAddons, { paddles: 2 });
  });

  it("Scenario 5: hasIntervalOverlap accurately calculates temporal intersections", () => {
    // Exact overlap
    assert.ok(
      hasIntervalOverlap(
        "2028-06-15T10:00:00.000Z",
        "2028-06-15T11:00:00.000Z",
        "2028-06-15T10:00:00.000Z",
        "2028-06-15T11:00:00.000Z"
      )
    );

    // Contained interval
    assert.ok(
      hasIntervalOverlap(
        "2028-06-15T10:00:00.000Z",
        "2028-06-15T12:00:00.000Z",
        "2028-06-15T10:30:00.000Z",
        "2028-06-15T11:30:00.000Z"
      )
    );

    // Adjacent / Non-overlapping intervals do NOT conflict
    assert.equal(
      hasIntervalOverlap(
        "2028-06-15T10:00:00.000Z",
        "2028-06-15T11:00:00.000Z",
        "2028-06-15T11:00:00.000Z",
        "2028-06-15T12:00:00.000Z"
      ),
      false,
      "Adjacent contiguous intervals must not conflict"
    );
  });
});
