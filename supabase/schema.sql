-- =========================================================================
-- BOSS SPORTS & FITNESS (BOSS PICKLEBALL) — SUPABASE DATABASE SCHEMA
-- Compatible with PostgreSQL 15+ on Supabase
-- Paste this entire file into the Supabase SQL Editor and click RUN.
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COURTS TABLE
CREATE TABLE IF NOT EXISTS public.courts (
    id TEXT PRIMARY KEY,
    court_number INT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    surface_type TEXT NOT NULL DEFAULT 'Pickleball Court',
    is_indoor BOOLEAN NOT NULL DEFAULT true,
    base_price_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 400.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default courts if table is empty
INSERT INTO public.courts (id, court_number, name, surface_type, is_indoor, base_price_per_hour, is_active)
VALUES
    ('court-1', 1, 'Court 1', 'Pro Cushion Acrylic (Indoor)', true, 400.00, true),
    ('court-2', 2, 'Court 2', 'Pro Cushion Acrylic (Indoor)', true, 400.00, true),
    ('court-3', 3, 'Court 3', 'Outdoor Tournament Court', false, 400.00, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    base_price_per_hour = EXCLUDED.base_price_per_hour;

-- 2. PRICING CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.pricing_config (
    id INT PRIMARY KEY DEFAULT 1,
    base_price_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 400.00,
    peak_surge_price_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 550.00,
    peak_hours JSONB NOT NULL DEFAULT '["18:00", "19:00", "20:00", "21:00", "22:00"]'::jsonb,
    is_peak_surge_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row_pricing CHECK (id = 1)
);

INSERT INTO public.pricing_config (id, base_price_per_hour, peak_surge_price_per_hour, peak_hours, is_peak_surge_active)
VALUES (1, 400.00, 550.00, '["18:00", "19:00", "20:00", "21:00", "22:00"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- 3. ARENA OPERATING SCHEDULES & HOLIDAYS
CREATE TABLE IF NOT EXISTS public.arena_schedules (
    id BIGSERIAL PRIMARY KEY,
    date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD or 'DEFAULT'
    is_closed BOOLEAN NOT NULL DEFAULT false,
    closure_reason TEXT,
    open_time TEXT NOT NULL DEFAULT '06:00',
    close_time TEXT NOT NULL DEFAULT '23:00',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.arena_schedules (date, is_closed, open_time, close_time)
VALUES ('DEFAULT', false, '06:00', '23:00')
ON CONFLICT (date) DO NOTHING;

-- 4. SCHEDULE BLOCKS (Maintenance, Coaching, Tournaments)
CREATE TABLE IF NOT EXISTS public.schedule_blocks (
    id TEXT PRIMARY KEY,
    court_id TEXT NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('MAINTENANCE', 'TOURNAMENT', 'COACHING', 'PRIVATE_EVENT')),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_court_time ON public.schedule_blocks (court_id, start_time, end_time);

-- 5. SLOT HOLDS (Temporary cart reservations)
CREATE TABLE IF NOT EXISTS public.slot_holds (
    id TEXT PRIMARY KEY,
    court_id TEXT NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slot_holds_expires_at ON public.slot_holds (expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_holds_court_time ON public.slot_holds (court_id, start_time, end_time);

-- 6. BOOKINGS TABLE (Primary source of truth for reservations & manual UPI payments)
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    court_id TEXT NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    court_name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    duration_display TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    source TEXT NOT NULL DEFAULT 'ONLINE' CHECK (source IN ('ONLINE', 'WALKIN', 'PHONE')),
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'PENDING_VERIFICATION', 'CANCELLED', 'COMPLETED')),
    payment_status TEXT NOT NULL DEFAULT 'PAY_AT_VENUE' CHECK (payment_status IN ('PAY_AT_VENUE', 'PENDING', 'PAID_ONLINE', 'CASH_COUNTER', 'UPI_COUNTER')),
    payment_method TEXT NOT NULL DEFAULT 'PAY_AT_VENUE' CHECK (payment_method IN ('PAY_AT_VENUE', 'UPI_MANUAL', 'RAZORPAY', 'UPI', 'CASH')),
    payment_screenshot_url TEXT,
    payment_utr TEXT,
    payment_verified_by TEXT,
    payment_verified_at TIMESTAMPTZ,
    payment_rejection_reason TEXT,
    total_price NUMERIC(10, 2) NOT NULL,
    discount_code TEXT,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    equipment_addons JSONB,
    notes TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    created_by_staff_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_interval ON public.bookings (court_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings (customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON public.bookings (customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_utr ON public.bookings (payment_utr);

-- 7. DISCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.discounts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('PERCENT', 'FLAT')),
    value NUMERIC(10, 2) NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial promo code
INSERT INTO public.discounts (id, code, type, value, valid_to, is_active, usage_count)
VALUES ('disc-boss10', 'BOSS10', 'PERCENT', 10.00, '2028-12-31 23:59:59+00'::timestamptz, true, 0)
ON CONFLICT (code) DO NOTHING;

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- 9. APP USERS TABLE (Optional local user table synced with staff/owner emails)
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('OWNER', 'EMPLOYEE', 'CUSTOMER')),
    password_hash TEXT,
    avatar TEXT,
    google_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Staff & Owner Accounts (Passwords match development hashes for seamless testing)
INSERT INTO public.app_users (id, email, phone, name, role, password_hash, is_active)
VALUES
    ('usr-owner-01', 'owner@boss.com', '9999999999', 'Arena Owner', 'OWNER', 'BossOwner@2026', true),
    ('usr-emp-01', 'staff@boss.com', '8888888888', 'Karan Desai (Staff Desk)', 'EMPLOYEE', 'BossStaff@2026', true),
    ('usr-cust-01', 'player@boss.com', '9876543210', 'Rahul Patel (Player)', 'CUSTOMER', 'PlayerPass@123', true)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    name = EXCLUDED.name;

-- 10. SUPABASE STORAGE BUCKET FOR PAYMENT PROOFS
-- Insert bucket if storage schema exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs',
    'payment-proofs',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage Access Policies (idempotent)
DROP POLICY IF EXISTS "Public read for payment proofs" ON storage.objects;
CREATE POLICY "Public read for payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Anyone can upload payment proof screenshot" ON storage.objects;
CREATE POLICY "Anyone can upload payment proof screenshot"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs');

-- Enable Row Level Security (RLS) on public tables
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Permissive Service-Role & Public Read Policies (idempotent)
DROP POLICY IF EXISTS "Public read active courts" ON public.courts;
CREATE POLICY "Public read active courts" ON public.courts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read pricing" ON public.pricing_config;
CREATE POLICY "Public read pricing" ON public.pricing_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read schedules" ON public.arena_schedules;
CREATE POLICY "Public read schedules" ON public.arena_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read active schedule blocks" ON public.schedule_blocks;
CREATE POLICY "Public read active schedule blocks" ON public.schedule_blocks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read active holds" ON public.slot_holds;
CREATE POLICY "Public read active holds" ON public.slot_holds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert slot holds" ON public.slot_holds;
CREATE POLICY "Public insert slot holds" ON public.slot_holds FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete slot holds" ON public.slot_holds;
CREATE POLICY "Public delete slot holds" ON public.slot_holds FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read active bookings" ON public.bookings;
CREATE POLICY "Public read active bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert bookings" ON public.bookings;
CREATE POLICY "Public insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service full access bookings" ON public.bookings;
CREATE POLICY "Service full access bookings" ON public.bookings FOR ALL USING (true);

DROP POLICY IF EXISTS "Public read discounts" ON public.discounts;
CREATE POLICY "Public read discounts" ON public.discounts FOR SELECT USING (true);

-- Done!
SELECT 'Boss Pickleball Supabase Schema Setup Completed Successfully!' AS status;
