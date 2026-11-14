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

describe("Supabase Backend Integration Suite", () => {
  it("Scenario 1: Project has clean standard Next.js architecture without Cloudflare/vinext lock-in", () => {
    const wranglerJsoncPath = path.resolve(process.cwd(), "wrangler.jsonc");
    const wranglerTomlPath = path.resolve(process.cwd(), "wrangler.toml");
    const viteConfigPath = path.resolve(process.cwd(), "vite.config.ts");
    const nextConfigPath = path.resolve(process.cwd(), "next.config.mjs");
    const pkgPath = path.resolve(process.cwd(), "package.json");

    assert.ok(!fs.existsSync(wranglerJsoncPath), "wrangler.jsonc should be removed");
    assert.ok(!fs.existsSync(wranglerTomlPath), "wrangler.toml should be removed");
    assert.ok(!fs.existsSync(viteConfigPath), "vite.config.ts should be removed");
    assert.ok(fs.existsSync(nextConfigPath), "next.config.mjs must exist");

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    assert.ok(pkg.dependencies["@supabase/supabase-js"], "@supabase/supabase-js must be installed");
    assert.ok(pkg.dependencies["next"], "next must be installed");
    assert.equal(pkg.dependencies["vinext"], undefined, "vinext should be removed");
    assert.equal(pkg.devDependencies?.["@cloudflare/vite-plugin"], undefined, "@cloudflare/vite-plugin should be removed");
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
