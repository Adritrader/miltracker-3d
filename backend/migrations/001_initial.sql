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
CREATE POLICY "anon_all_alert_archive"      ON alert_archive      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_position_snapshots" ON position_snapshots FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_daily_stats"        ON daily_stats        FOR ALL TO anon USING (true) WITH CHECK (true);
