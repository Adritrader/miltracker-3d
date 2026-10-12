-- ============================================================================
-- LiveWar3D — full setup for a NEW Supabase project (run once, SQL Editor)
--
-- Concatenates every migration in order, adds the missing newsletter table and
-- then LOCKS DOWN the backend tables: the original migrations granted `anon`
-- full read/write, and the anon key ships in the frontend bundle — anyone
-- could fill or wipe the database. The backend must now use
-- SUPABASE_SERVICE_ROLE_KEY (service_role bypasses RLS).
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- backend/migrations/001_initial.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- LiveWar3D — Supabase initial migration
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- ============================================================================

-- 1) Alert archive — every alert generated, kept indefinitely
CREATE TABLE IF NOT EXISTS alert_archive (
  id            BIGSERIAL PRIMARY KEY,
  alert_id      TEXT,
  title         TEXT,
  summary       TEXT,
  severity      TEXT,
  credibility   REAL,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  region        TEXT,
  source        TEXT,
  event_type    TEXT,
  url           TEXT,
  timestamp     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_archive_ts      ON alert_archive (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alert_archive_severity ON alert_archive (severity);

-- 2) Position snapshots — sampled aircraft & ship positions
CREATE TABLE IF NOT EXISTS position_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL,          -- 'aircraft' | 'ship'
  entity_id     TEXT NOT NULL,
  callsign      TEXT,
  name          TEXT,
  flag          TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  altitude      REAL,
  heading       REAL,
  speed         REAL,
  sampled_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_snap_entity    ON position_snapshots (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pos_snap_time      ON position_snapshots (sampled_at DESC);

-- 3) Daily aggregate stats — one row per day
CREATE TABLE IF NOT EXISTS daily_stats (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL UNIQUE,
  aircraft_count  INT DEFAULT 0,
  ship_count      INT DEFAULT 0,
  alert_count     INT DEFAULT 0,
  conflict_count  INT DEFAULT 0,
  news_count      INT DEFAULT 0,
  critical_alerts INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Disable RLS so the backend anon key can insert freely
-- (these tables contain only public OSINT data, no user secrets)
ALTER TABLE alert_archive      ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats        ENABLE ROW LEVEL SECURITY;

-- Allow anon role full access (backend uses anon key)
DROP POLICY IF EXISTS "anon_all_alert_archive" ON alert_archive;
CREATE POLICY "anon_all_alert_archive"      ON alert_archive      FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_position_snapshots" ON position_snapshots;
CREATE POLICY "anon_all_position_snapshots" ON position_snapshots FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_daily_stats" ON daily_stats;
CREATE POLICY "anon_all_daily_stats"        ON daily_stats        FOR ALL TO anon USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────
-- backend/migrations/002_enhance_snapshots.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- LiveWar3D — Migration 002: Enhance position_snapshots
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- ============================================================================

-- Add aircraft-specific fields
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS registration    TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS aircraft_type   TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS squawk          TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS on_ground       BOOLEAN;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS vertical_rate   REAL;

-- Add ship-specific fields
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS ship_type       TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS destination     TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS imo             TEXT;

-- Add carrier ops / mission context
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS carrier_name    TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS carrier_ops     TEXT;

-- Composite index for faster trail queries
CREATE INDEX IF NOT EXISTS idx_pos_snap_entity_time ON position_snapshots (entity_id, sampled_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- backend/migrations/003_dedup_indexes.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- LiveWar3D — Migration 003: Add unique index + dedup alerts
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- ============================================================================

-- 1) Remove duplicate alert_archive rows (keep earliest by id)
DELETE FROM alert_archive a
USING alert_archive b
WHERE a.alert_id = b.alert_id
  AND a.id > b.id;

-- 2) Add unique index on alert_id to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_archive_alert_id_unique
  ON alert_archive (alert_id);

-- 3) Composite index for faster trail queries (already in 002 but idempotent)
CREATE INDEX IF NOT EXISTS idx_pos_snap_entity_time
  ON position_snapshots (entity_id, sampled_at DESC);

-- 4) Case-insensitive index on entity_id for trail lookups
CREATE INDEX IF NOT EXISTS idx_pos_snap_entity_lower
  ON position_snapshots (LOWER(entity_id));

-- ──────────────────────────────────────────────────────────────────────────
-- backend/migrations/004_conflicts_news_insights.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- LiveWar3D — Migration 004: Conflict events, news archive, AI insights
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- ============================================================================

-- 1) Conflict / FIRMS events
CREATE TABLE IF NOT EXISTS conflict_events (
  id              BIGSERIAL PRIMARY KEY,
  event_id        TEXT NOT NULL,
  event_type      TEXT,          -- airstrike, missile, explosion, fire, drone, artillery, etc.
  title           TEXT,
  url             TEXT,
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  country         TEXT,
  source          TEXT,          -- GDELT-GEO, GDELT-DOC, NASA FIRMS, ACLED, ReliefWeb
  severity        TEXT,          -- critical/high/medium/low
  tone            REAL,          -- GDELT sentiment
  frp             REAL,          -- Fire Radiative Power (MW) — FIRMS only
  zone            TEXT,          -- ukraine-front, gaza-west-bank, etc.
  published_at    TIMESTAMPTZ,
  first_seen_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conflict_event_id ON conflict_events (event_id);
CREATE INDEX IF NOT EXISTS idx_conflict_events_time ON conflict_events (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_events_source ON conflict_events (source);
CREATE INDEX IF NOT EXISTS idx_conflict_events_zone ON conflict_events (zone);

-- 2) News archive
CREATE TABLE IF NOT EXISTS news_archive (
  id              BIGSERIAL PRIMARY KEY,
  news_id         TEXT NOT NULL,
  source          TEXT,          -- BBC World, Al Jazeera, GDELT, NewsAPI, etc.
  title           TEXT,
  url             TEXT,
  description     TEXT,
  image_url       TEXT,
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  tone            REAL,
  news_type       TEXT,          -- "news" or "geo_event"
  published_at    TIMESTAMPTZ,
  first_seen_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_archive_news_id ON news_archive (news_id);
CREATE INDEX IF NOT EXISTS idx_news_archive_time ON news_archive (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_archive_source ON news_archive (source);

-- 3) AI Insights (Gemini threat assessments)
CREATE TABLE IF NOT EXISTS ai_insights (
  id              BIGSERIAL PRIMARY KEY,
  threat_level    TEXT,          -- LOW/MEDIUM/HIGH/CRITICAL
  summary         TEXT,
  hotspots        JSONB,         -- [{location, lat, lon, reason}]
  recommendations JSONB,         -- [string]
  model           TEXT,
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_time ON ai_insights (analyzed_at DESC);

-- 4) Add source field to position_snapshots (which ADS-B / AIS feed)
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS source TEXT;

-- 5) Enable RLS on new tables (same open policy as existing ones)
ALTER TABLE conflict_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_conflict_events" ON conflict_events;
CREATE POLICY "allow_all_conflict_events" ON conflict_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_news_archive" ON news_archive;
CREATE POLICY "allow_all_news_archive" ON news_archive FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ai_insights" ON ai_insights;
CREATE POLICY "allow_all_ai_insights" ON ai_insights FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────
-- backend/migrations/005_analytics_functions.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- LiveWar3D — Migration 005: Analytics RPC functions
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- These are OPTIONAL — the JS fallback works without them, but RPC is faster.
-- ============================================================================

-- 1) Fleet composition: entities by flag
CREATE OR REPLACE FUNCTION analytics_fleet_composition(p_hours INT DEFAULT 24)
RETURNS TABLE(flag TEXT, entity_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT flag, entity_type, COUNT(*) as count
  FROM (
    SELECT DISTINCT ON (entity_id) COALESCE(NULLIF(flag, ''), 'Unknown') AS flag, entity_type
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY entity_id, sampled_at DESC
  ) sub
  GROUP BY flag, entity_type
  ORDER BY count DESC;
$$;

-- 2) Aircraft types breakdown
CREATE OR REPLACE FUNCTION analytics_aircraft_types(p_hours INT DEFAULT 24)
RETURNS TABLE(aircraft_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT aircraft_type, COUNT(*) as count
  FROM (
    SELECT DISTINCT ON (entity_id) aircraft_type
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND entity_type = 'aircraft'
      AND aircraft_type IS NOT NULL AND aircraft_type != ''
    ORDER BY entity_id, sampled_at DESC
  ) sub
  GROUP BY aircraft_type
  ORDER BY count DESC
  LIMIT 20;
$$;

-- 3) Hourly activity (positions per hour)
CREATE OR REPLACE FUNCTION analytics_hourly_activity(p_hours INT DEFAULT 48)
RETURNS TABLE(hour TIMESTAMPTZ, aircraft_count BIGINT, ship_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT
    date_trunc('hour', sampled_at) as hour,
    COUNT(*) FILTER (WHERE entity_type = 'aircraft') as aircraft_count,
    COUNT(*) FILTER (WHERE entity_type = 'ship') as ship_count
  FROM position_snapshots
  WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY hour
  ORDER BY hour;
$$;

-- 4) Top tracked entities
CREATE OR REPLACE FUNCTION analytics_top_entities(p_hours INT DEFAULT 24, p_limit INT DEFAULT 30)
RETURNS TABLE(entity_id TEXT, entity_type TEXT, callsign TEXT, name TEXT, flag TEXT, snapshots BIGINT) LANGUAGE sql STABLE AS $$
  SELECT
    entity_id,
    MAX(entity_type) as entity_type,
    MAX(callsign) as callsign,
    MAX(name) as name,
    MAX(flag) as flag,
    COUNT(*) as snapshots
  FROM position_snapshots
  WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY entity_id
  ORDER BY snapshots DESC
  LIMIT p_limit;
$$;

-- 5) Altitude distribution (buckets)
CREATE OR REPLACE FUNCTION analytics_altitude_distribution(p_hours INT DEFAULT 24)
RETURNS TABLE(bucket TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT bucket, COUNT(*) as count FROM (
    SELECT CASE
      WHEN altitude IS NULL THEN 'Unknown'
      WHEN altitude < 100 THEN 'Ground (<100m)'
      WHEN altitude < 1000 THEN 'Low (100-1000m)'
      WHEN altitude < 5000 THEN 'Medium (1-5km)'
      WHEN altitude < 10000 THEN 'High (5-10km)'
      WHEN altitude < 15000 THEN 'Very High (10-15km)'
      ELSE 'Stratosphere (15km+)'
    END as bucket
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND entity_type = 'aircraft'
  ) sub
  GROUP BY bucket
  ORDER BY CASE bucket
    WHEN 'Ground (<100m)' THEN 1
    WHEN 'Low (100-1000m)' THEN 2
    WHEN 'Medium (1-5km)' THEN 3
    WHEN 'High (5-10km)' THEN 4
    WHEN 'Very High (10-15km)' THEN 5
    WHEN 'Stratosphere (15km+)' THEN 6
    ELSE 7
  END;
$$;

-- 6) Speed distribution
CREATE OR REPLACE FUNCTION analytics_speed_distribution(p_hours INT DEFAULT 24)
RETURNS TABLE(bucket TEXT, entity_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT bucket, entity_type, COUNT(*) as count FROM (
    SELECT entity_type, CASE
      WHEN speed IS NULL THEN 'Unknown'
      WHEN speed < 50 THEN '0-50 kn'
      WHEN speed < 150 THEN '50-150 kn'
      WHEN speed < 300 THEN '150-300 kn'
      WHEN speed < 500 THEN '300-500 kn'
      WHEN speed < 700 THEN '500-700 kn'
      ELSE '700+ kn'
    END as bucket
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND speed IS NOT NULL
  ) sub
  GROUP BY bucket, entity_type
  ORDER BY CASE bucket
    WHEN '0-50 kn' THEN 1 WHEN '50-150 kn' THEN 2 WHEN '150-300 kn' THEN 3
    WHEN '300-500 kn' THEN 4 WHEN '500-700 kn' THEN 5 WHEN '700+ kn' THEN 6 ELSE 7
  END;
$$;

-- 7) Conflicts by zone
CREATE OR REPLACE FUNCTION analytics_conflicts_by_zone(p_hours INT DEFAULT 72)
RETURNS TABLE(zone TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(zone, 'Unknown') as zone, COUNT(*) as count
  FROM conflict_events
  WHERE published_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY zone ORDER BY count DESC LIMIT 20;
$$;

-- 8) Conflicts by type
CREATE OR REPLACE FUNCTION analytics_conflicts_by_type(p_hours INT DEFAULT 72)
RETURNS TABLE(event_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(event_type, 'unknown') as event_type, COUNT(*) as count
  FROM conflict_events
  WHERE published_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY event_type ORDER BY count DESC;
$$;

-- 9) News by source
CREATE OR REPLACE FUNCTION analytics_news_by_source(p_hours INT DEFAULT 72)
RETURNS TABLE(source TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count
  FROM news_archive
  WHERE published_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY source ORDER BY count DESC LIMIT 20;
$$;

-- 10) Alerts by severity
CREATE OR REPLACE FUNCTION analytics_alerts_by_severity(p_hours INT DEFAULT 72)
RETURNS TABLE(severity TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT severity, COUNT(*) as count
  FROM alert_archive
  WHERE timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY severity
  ORDER BY CASE severity
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5
  END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- supabase/migrations/001_profiles.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Migration 001 — profiles table + auto-create trigger
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Profiles table (one row per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan              text        NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  stripe_customer_id text,
  plan_expires_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for Stripe lookups
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 3. RLS — users can read their own profile, backend (service_role) can write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- service_role bypasses RLS automatically — no extra policy needed for backend writes

-- 4. Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Backfill existing users (users created before this migration)
INSERT INTO public.profiles (id, plan)
SELECT id, 'free'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verify:
-- SELECT * FROM public.profiles;
-- ============================================================

-- ──────────────────────────────────────────────────────────────────────────
-- supabase/migrations/002_subscriptions.sql
-- ──────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Migration 002 — extend profiles with Stripe subscription fields
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add Stripe subscription tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id         text,
  ADD COLUMN IF NOT EXISTS subscription_status     text NOT NULL DEFAULT 'inactive';
  -- subscription_status values: 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled'

-- Index for webhook lookups by subscription ID
CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
  ON public.profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================
-- Verify:
-- SELECT id, plan, subscription_status, plan_expires_at FROM public.profiles;
-- ============================================================

-- ──────────────────────────────────────────────────────────────────────────
-- Newsletter subscribers (used by /api/newsletter, had no migration)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- LOCKDOWN — backend-only tables: RLS on, no anon/authenticated policies
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_all_alert_archive"      ON alert_archive;
DROP POLICY IF EXISTS "anon_all_position_snapshots" ON position_snapshots;
DROP POLICY IF EXISTS "anon_all_daily_stats"        ON daily_stats;
DROP POLICY IF EXISTS "allow_all_conflict_events"   ON conflict_events;
DROP POLICY IF EXISTS "allow_all_news_archive"      ON news_archive;
DROP POLICY IF EXISTS "allow_all_ai_insights"       ON ai_insights;

-- Analytics RPCs scan position_snapshots — callable only by the backend
REVOKE EXECUTE ON FUNCTION analytics_fleet_composition(INT)       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_aircraft_types(INT)          FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_hourly_activity(INT)         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_top_entities(INT, INT)       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_altitude_distribution(INT)   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_speed_distribution(INT)      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_conflicts_by_zone(INT)       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_conflicts_by_type(INT)       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_news_by_source(INT)          FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION analytics_alerts_by_severity(INT)      FROM anon, authenticated, public;
GRANT  EXECUTE ON FUNCTION analytics_fleet_composition(INT), analytics_aircraft_types(INT),
  analytics_hourly_activity(INT), analytics_top_entities(INT, INT), analytics_altitude_distribution(INT),
  analytics_speed_distribution(INT), analytics_conflicts_by_zone(INT), analytics_conflicts_by_type(INT),
  analytics_news_by_source(INT), analytics_alerts_by_severity(INT) TO service_role;

-- profiles keeps its "Users can read own profile" policy (frontend plan check)
