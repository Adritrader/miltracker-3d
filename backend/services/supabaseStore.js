/**
 * supabaseStore.js — Historical data persistence via Supabase (PostgreSQL)
 *
 * All methods are fire-and-forget safe: they catch errors internally
 * so a Supabase outage never breaks the real-time pipeline.
 *
 * Tables: alert_archive, position_snapshots, daily_stats
 * Migration: backend/migrations/001_initial.sql
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[Supabase] Connected →', SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0]);
} else {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set — historical storage disabled');
}

/** Check if Supabase is configured */
export function isEnabled() {
  return supabase !== null;
}

// ─── Alert Archive ──────────────────────────────────────────────────────────

// Track already-archived alert IDs — seeded from DB on first call to survive restarts
const archivedAlertIds = new Set();
let alertDeduplicateSeeded = false;

async function seedArchivedIds() {
  if (alertDeduplicateSeeded || !supabase) return;
  alertDeduplicateSeeded = true;
  try {
    // Fetch last 48h of alert_ids from DB to pre-fill the in-memory Set
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data } = await supabase
      .from('alert_archive')
      .select('alert_id')
      .gte('created_at', cutoff)
      .limit(5000);
    for (const row of (data || [])) {
      if (row.alert_id) archivedAlertIds.add(row.alert_id);
    }
    console.log(`[Supabase] Seeded ${archivedAlertIds.size} known alert IDs from DB`);
  } catch (err) {
    console.warn('[Supabase] seedArchivedIds error:', err.message);
    alertDeduplicateSeeded = false; // retry next call
  }
}

/**
 * Archive new alerts. Deduplicates by alert_id using an in-memory Set seeded
 * from the DB on startup, so restarts don't cause re-inserts.
 */
export async function archiveAlerts(alerts) {
  if (!supabase || !alerts?.length) return;
  await seedArchivedIds();
  try {
    const newAlerts = alerts.filter(a => a.id && !archivedAlertIds.has(a.id));
    if (newAlerts.length === 0) return;

    const rows = newAlerts.map(a => ({
      alert_id:    a.id,
      title:       (a.title || '').slice(0, 500),
      summary:     (a.message || '').slice(0, 1000),
      severity:    a.severity,
      credibility: a.credibility ?? null,
      lat:         a.lat ?? null,
      lon:         a.lon ?? null,
      region:      a.geocodedFrom || null,
      source:      a.source || null,
      event_type:  a.type || 'news_alert',
      url:         a.url || null,
      timestamp:   a.timestamp || new Date().toISOString(),
    }));

    const { error } = await supabase.from('alert_archive').insert(rows);
    if (error) throw error;

    for (const a of newAlerts) archivedAlertIds.add(a.id);
    // Prevent unbounded growth — trim if over 10k entries
    if (archivedAlertIds.size > 10000) {
      const arr = [...archivedAlertIds];
      archivedAlertIds.clear();
      for (const id of arr.slice(-5000)) archivedAlertIds.add(id);
    }
    console.log(`[Supabase] Archived ${newAlerts.length} new alerts`);
  } catch (err) {
    console.error('[Supabase] archiveAlerts error:', err.message);
  }
}

// ─── Position Snapshots ─────────────────────────────────────────────────────

let lastPositionSave = 0;
const POSITION_INTERVAL_MS = 10 * 60_000; // every 10 minutes

/**
 * Sample current positions and insert into position_snapshots.
 * Throttled to one save every 10 minutes to conserve storage.
 */
export async function snapshotPositions(aircraft, ships) {
  if (!supabase) return;
  const now = Date.now();
  if (now - lastPositionSave < POSITION_INTERVAL_MS) return;
  lastPositionSave = now;

  try {
    const rows = [];

    // Aircraft — only those with valid positions
    for (const a of (aircraft || [])) {
      if (a.lat == null || a.lon == null) continue;
      rows.push({
        entity_type:   'aircraft',
        entity_id:     a.id || a.icao24 || a.callsign,
        callsign:      a.callsign || null,
        name:          null,
        flag:          a.country || null,
        lat:           a.lat,
        lon:           a.lon,
        altitude:      a.altitude ?? null,
        heading:       a.heading ?? a.track ?? null,
        speed:         a.velocity ?? null,
        registration:  a.registration || null,
        aircraft_type: a.aircraftType || a.typeName || null,
        squawk:        a.squawk || null,
        on_ground:     a.on_ground ?? null,
        vertical_rate: a.vertical_rate ?? null,
        carrier_name:  a.carrierName || null,
        carrier_ops:   a.carrierOps || null,
        source:        a.source || null,
      });
    }

    // Ships
    for (const s of (ships || [])) {
      if (s.lat == null || s.lon == null) continue;
      rows.push({
        entity_type: 'ship',
        entity_id:   s.id || s.mmsi,
        callsign:    null,
        name:        s.name || null,
        flag:        s.flag || null,
        lat:         s.lat,
        lon:         s.lon,
        altitude:    null,
        heading:     s.heading ?? null,
        speed:       s.velocity ?? null,
        ship_type:   s.shipType || s.type_name || null,
        destination: s.destination || null,
        imo:         s.imo || null,
        source:      s.source || null,
      });
    }

    if (rows.length === 0) return;

    // Strip extended columns that require migration 002
    const BASIC_KEYS = ['entity_type','entity_id','callsign','name','flag','lat','lon','altitude','heading','speed','sampled_at'];
    const stripExtended = (row) => Object.fromEntries(BASIC_KEYS.filter(k => k in row).map(k => [k, row[k]]));

    // Supabase has a max payload size — batch in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('position_snapshots').insert(chunk);
      if (error) {
        // If columns don't exist (migration 002 not applied), retry with basic columns
        if (error.message?.includes('column')) {
          const basic = chunk.map(stripExtended);
          const { error: e2 } = await supabase.from('position_snapshots').insert(basic);
          if (e2) throw e2;
        } else {
          throw error;
        }
      }
    }

    console.log(`[Supabase] Snapshot: ${rows.length} positions (${aircraft?.length || 0} ac + ${ships?.length || 0} ships)`);
  } catch (err) {
    console.error('[Supabase] snapshotPositions error:', err.message);
  }
}

// ─── Daily Stats ────────────────────────────────────────────────────────────

let lastStatsSave = 0;
const STATS_INTERVAL_MS = 10 * 60_000; // update stats every 10 minutes

/**
 * Upsert today's aggregate stats. Writes at most every 10 minutes
 * with the LATEST counts, so the row reflects peak/end-of-day values.
 */
export async function upsertDailyStats({ aircraftCount, shipCount, alertCount, conflictCount, newsCount, criticalAlerts }) {
  if (!supabase) return;
  const now = Date.now();
  if (now - lastStatsSave < STATS_INTERVAL_MS) return;
  lastStatsSave = now;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  try {
    const { error } = await supabase.from('daily_stats').upsert({
      date:            today,
      aircraft_count:  aircraftCount  || 0,
      ship_count:      shipCount      || 0,
      alert_count:     alertCount     || 0,
      conflict_count:  conflictCount  || 0,
      news_count:      newsCount      || 0,
      critical_alerts: criticalAlerts || 0,
    }, { onConflict: 'date' });
    if (error) throw error;
    console.log(`[Supabase] Daily stats for ${today} upserted (ac:${aircraftCount} ships:${shipCount} alerts:${alertCount})`);
  } catch (err) {
    console.error('[Supabase] upsertDailyStats error:', err.message);
  }
}

// ─── Cleanup — purge old position snapshots ─────────────────────────────────

const RETENTION_DAYS = 14;

/**
 * Delete position snapshots older than RETENTION_DAYS.
 * Called once on startup and then once per day.
 */
export async function purgeOldSnapshots() {
  if (!supabase) return;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
    const { error, count } = await supabase
      .from('position_snapshots')
      .delete({ count: 'exact' })
      .lt('sampled_at', cutoff);
    if (error) throw error;
    console.log(`[Supabase] Purged ${count ?? '?'} snapshots older than ${RETENTION_DAYS}d`);
  } catch (err) {
    console.error('[Supabase] purgeOldSnapshots error:', err.message);
  }
}

// ─── Query: Entity trail ────────────────────────────────────────────────────

/**
 * Fetch historical positions for a specific entity.
 * @param {string} entityId
 * @param {number} hours — look-back window (default 24)
 * @returns {Array<{lat, lon, altitude, heading, speed, sampled_at}>}
 */
export async function getEntityTrail(entityId, hours = 24) {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const idLower = entityId.toLowerCase();
  const ids = idLower === entityId ? [entityId] : [entityId, idLower];

  // Try full select first (requires migration 002), fall back to basic columns
  const FULL_COLS = 'lat, lon, altitude, heading, speed, callsign, registration, aircraft_type, squawk, on_ground, vertical_rate, carrier_ops, sampled_at';
  const BASIC_COLS = 'lat, lon, altitude, heading, speed, sampled_at';

  for (const cols of [FULL_COLS, BASIC_COLS]) {
    const { data, error } = await supabase
      .from('position_snapshots')
      .select(cols)
      .in('entity_id', ids)
      .gte('sampled_at', cutoff)
      .order('sampled_at', { ascending: true })
      .limit(2000);
    if (!error) return data || [];
    // If it's a column-not-found error, try basic cols; otherwise throw
    if (cols === FULL_COLS && error.message?.includes('column')) continue;
    throw error;
  }
  return [];
}

// ─── Query: Recent alerts ───────────────────────────────────────────────────

/**
 * Fetch recent alerts from the archive.
 * @param {number} hours — look-back window
 * @param {string} severity — optional severity filter
 * @param {number} limit — max results
 */
export async function getRecentAlerts(hours = 48, severity = null, limit = 200) {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  let q = supabase
    .from('alert_archive')
    .select('alert_id, title, summary, severity, credibility, lat, lon, region, source, url, timestamp')
    .gte('timestamp', cutoff)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (severity) q = q.eq('severity', severity);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── Query: Daily stats ─────────────────────────────────────────────────────

/**
 * Fetch daily stats for the last N days.
 */
export async function getDailyStats(days = 14) {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .gte('date', cutoff)
    .order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Query: Active entities (distinct recent entities) ──────────────────────

/**
 * Get distinct entities seen in the last N hours with their latest position.
 */
export async function getActiveEntities(entityType = 'aircraft', hours = 24, limit = 500) {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  // Use a subquery approach: get the latest snapshot per entity
  const { data, error } = await supabase
    .rpc('get_active_entities', { p_entity_type: entityType, p_cutoff: cutoff, p_limit: limit })
    .catch(() => ({ data: null, error: { message: 'RPC not available — using fallback' } }));

  // Fallback: just get recent snapshots and deduplicate client-side
  if (error || !data) {
    const { data: raw, error: e2 } = await supabase
      .from('position_snapshots')
      .select('entity_id, callsign, name, flag, lat, lon, altitude, heading, speed, sampled_at')
      .eq('entity_type', entityType)
      .gte('sampled_at', cutoff)
      .order('sampled_at', { ascending: false })
      .limit(limit * 5);
    if (e2) throw e2;
    // Deduplicate — keep latest per entity_id
    const seen = new Map();
    for (const r of (raw || [])) {
      if (!seen.has(r.entity_id)) seen.set(r.entity_id, r);
    }
    return [...seen.values()].slice(0, limit);
  }
  return data;
}

// ─── Conflict Events Archive ────────────────────────────────────────────────

const archivedConflictIds = new Set();
let conflictDeduplicateSeeded = false;

async function seedConflictIds() {
  if (conflictDeduplicateSeeded || !supabase) return;
  conflictDeduplicateSeeded = true;
  try {
    const cutoff = new Date(Date.now() - 72 * 3600_000).toISOString();
    const { data } = await supabase
      .from('conflict_events')
      .select('event_id')
      .gte('created_at', cutoff)
      .limit(5000);
    for (const r of (data || [])) if (r.event_id) archivedConflictIds.add(r.event_id);
    console.log(`[Supabase] Seeded ${archivedConflictIds.size} conflict IDs from DB`);
  } catch (err) {
    console.warn('[Supabase] seedConflictIds error:', err.message);
    conflictDeduplicateSeeded = false;
  }
}

export async function archiveConflicts(conflicts) {
  if (!supabase || !conflicts?.length) return;
  await seedConflictIds();
  try {
    const fresh = conflicts.filter(c => c.id && !archivedConflictIds.has(c.id));
    if (fresh.length === 0) return;

    const rows = fresh.map(c => ({
      event_id:      c.id,
      event_type:    c.type || null,
      title:         (c.title || '').slice(0, 500),
      url:           c.url || null,
      lat:           c.lat ?? null,
      lon:           c.lon ?? null,
      country:       c.country || null,
      source:        c.source || null,
      severity:      c.severity || null,
      tone:          c.tone ?? null,
      frp:           c.frp ?? null,
      zone:          c.zone || null,
      published_at:  c.publishedAt || null,
      first_seen_at: c.firstSeenAt || null,
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('conflict_events').insert(rows.slice(i, i + 500));
      if (error && !error.message?.includes('duplicate')) throw error;
    }
    for (const c of fresh) archivedConflictIds.add(c.id);
    if (archivedConflictIds.size > 10000) {
      const arr = [...archivedConflictIds];
      archivedConflictIds.clear();
      for (const id of arr.slice(-5000)) archivedConflictIds.add(id);
    }
    console.log(`[Supabase] Archived ${fresh.length} conflict events`);
  } catch (err) {
    console.error('[Supabase] archiveConflicts error:', err.message);
  }
}

export async function getRecentConflicts(hours = 48, source = null, limit = 500) {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  let q = supabase
    .from('conflict_events')
    .select('event_id, event_type, title, url, lat, lon, country, source, severity, tone, frp, zone, published_at')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (source) q = q.eq('source', source);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── News Archive ───────────────────────────────────────────────────────────

const archivedNewsIds = new Set();
let newsDeduplicateSeeded = false;

async function seedNewsIds() {
  if (newsDeduplicateSeeded || !supabase) return;
  newsDeduplicateSeeded = true;
  try {
    const cutoff = new Date(Date.now() - 72 * 3600_000).toISOString();
    const { data } = await supabase
      .from('news_archive')
      .select('news_id')
      .gte('created_at', cutoff)
      .limit(5000);
    for (const r of (data || [])) if (r.news_id) archivedNewsIds.add(r.news_id);
    console.log(`[Supabase] Seeded ${archivedNewsIds.size} news IDs from DB`);
  } catch (err) {
    console.warn('[Supabase] seedNewsIds error:', err.message);
    newsDeduplicateSeeded = false;
  }
}

export async function archiveNews(newsItems) {
  if (!supabase || !newsItems?.length) return;
  await seedNewsIds();
  try {
    const fresh = newsItems.filter(n => n.id && !archivedNewsIds.has(n.id));
    if (fresh.length === 0) return;

    const rows = fresh.map(n => ({
      news_id:       n.id,
      source:        n.source || null,
      title:         (n.title || '').slice(0, 500),
      url:           n.url || null,
      description:   (n.description || '').slice(0, 1000),
      image_url:     n.imageUrl || null,
      lat:           n.lat ?? null,
      lon:           n.lon ?? null,
      tone:          n.tone ?? null,
      news_type:     n.type || 'news',
      published_at:  n.publishedAt || null,
      first_seen_at: n.firstSeenAt || null,
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('news_archive').insert(rows.slice(i, i + 500));
      if (error && !error.message?.includes('duplicate')) throw error;
    }
    for (const n of fresh) archivedNewsIds.add(n.id);
    if (archivedNewsIds.size > 10000) {
      const arr = [...archivedNewsIds];
      archivedNewsIds.clear();
      for (const id of arr.slice(-5000)) archivedNewsIds.add(id);
    }
    console.log(`[Supabase] Archived ${fresh.length} news items`);
  } catch (err) {
    console.error('[Supabase] archiveNews error:', err.message);
  }
}

export async function getRecentNews(hours = 48, source = null, limit = 200) {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  let q = supabase
    .from('news_archive')
    .select('news_id, source, title, url, description, image_url, lat, lon, tone, news_type, published_at')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (source) q = q.eq('source', source);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── AI Insights Archive ────────────────────────────────────────────────────

export async function archiveAIInsight(insight) {
  if (!supabase || !insight) return;
  try {
    const { error } = await supabase.from('ai_insights').insert({
      threat_level:    insight.threatLevel || null,
      summary:         (insight.summary || '').slice(0, 2000),
      hotspots:        insight.hotspots || null,
      recommendations: insight.recommendations || null,
      model:           insight.model || null,
      analyzed_at:     insight.timestamp || new Date().toISOString(),
    });
    if (error) throw error;
    console.log(`[Supabase] Archived AI insight: ${insight.threatLevel}`);
  } catch (err) {
    console.error('[Supabase] archiveAIInsight error:', err.message);
  }
}

export async function getRecentInsights(limit = 20) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ai_insights')
    .select('threat_level, summary, hotspots, recommendations, model, analyzed_at')
    .order('analyzed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
