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
