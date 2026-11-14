import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local or .env.production
const envFiles = [".env.local", ".env.production", ".env"];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing Supabase credentials in .env.local or .env.production");
  console.error("Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log(`🚀 Connecting to Supabase project at: ${supabaseUrl}`);

  // 1. Migrate Users
  const usersPath = path.resolve(process.cwd(), "data", "users_auth.json");
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
    console.log(`👤 Found ${users.length} users to migrate...`);
    for (const u of users) {
      const { error } = await supabase.from("app_users").upsert({
        id: u.id,
        email: u.email,
        phone: u.phone || null,
        name: u.name,
        role: u.role,
        password_hash: u.passwordHash,
        created_at: u.createdAt || new Date().toISOString(),
        is_active: true,
      }, { onConflict: "email" });
      if (error) console.warn(`   ⚠️ Warning migrating user ${u.email}:`, error.message);
    }
    console.log(`   ✅ Users migrated.`);
  }

  // 2. Migrate Courts & Bookings
  const dbPath = path.resolve(process.cwd(), "data", "pickleball_database.json");
  if (fs.existsSync(dbPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

    // Courts
    if (dbData.courts?.length) {
      console.log(`🏟️ Found ${dbData.courts.length} courts to migrate...`);
      for (const c of dbData.courts) {
        const { error } = await supabase.from("courts").upsert({
          id: c.id,
          court_number: c.courtNumber,
          name: c.name,
          surface_type: c.surfaceType || "Pickleball Court",
          is_indoor: c.isIndoor ?? true,
          base_price_per_hour: c.basePricePerHour || 400.00,
          is_active: c.isActive ?? true,
        }, { onConflict: "id" });
        if (error) console.warn(`   ⚠️ Warning migrating court ${c.id}:`, error.message);
      }
      console.log(`   ✅ Courts migrated.`);
    }

    // Pricing Config
    if (dbData.pricingConfig) {
      const pc = dbData.pricingConfig;
      console.log(`💵 Migrating pricing config...`);
      await supabase.from("pricing_config").upsert({
        id: 1,
        base_price_per_hour: pc.basePricePerHour || 400.00,
        peak_surge_price_per_hour: pc.peakSurgePricePerHour || 550.00,
        peak_hours: pc.peakHours || ["18:00", "19:00", "20:00", "21:00", "22:00"],
        is_peak_surge_active: pc.isPeakSurgeActive ?? true,
      }, { onConflict: "id" });
      console.log(`   ✅ Pricing config migrated.`);
    }

    // Bookings
    if (dbData.bookings?.length) {
      console.log(`📅 Found ${dbData.bookings.length} bookings to migrate...`);
      for (const b of dbData.bookings) {
        const { error } = await supabase.from("bookings").upsert({
          id: b.id,
          court_id: b.courtId,
          court_name: b.courtName || "Court",
          start_time: b.startTime,
          end_time: b.endTime,
          duration_minutes: b.durationMinutes || 60,
          duration_display: b.durationDisplay || "1 hour",
          customer_name: b.customerName,
          customer_phone: b.customerPhone,
          customer_email: b.customerEmail || null,
          source: b.source || "ONLINE",
          status: b.status || "CONFIRMED",
          payment_status: b.paymentStatus || "PAY_AT_VENUE",
          payment_method: b.paymentMethod || "PAY_AT_VENUE",
          payment_screenshot_url: b.paymentScreenshotUrl || null,
          payment_utr: b.paymentUtr || null,
          payment_verified_by: b.paymentVerifiedBy || null,
          payment_verified_at: b.paymentVerifiedAt || null,
          payment_rejection_reason: b.paymentRejectionReason || null,
          total_price: b.totalPrice || 400.00,
          discount_code: b.discountCode || null,
          discount_amount: b.discountAmount || 0.00,
          equipment_addons: b.equipmentAddons || null,
          notes: b.notes || null,
          cancellation_reason: b.cancellationReason || null,
          cancelled_at: b.cancelledAt || null,
          created_by_staff_id: b.createdByStaffId || null,
          created_at: b.createdAt || new Date().toISOString(),
          updated_at: b.updatedAt || new Date().toISOString(),
        }, { onConflict: "id" });
        if (error) console.warn(`   ⚠️ Warning migrating booking ${b.id}:`, error.message);
      }
      console.log(`   ✅ Bookings migrated.`);
    }
  }

  console.log("\n🎉 Database migration to Supabase completed successfully!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
