/**
 * aiAircraftIntel.js — AI-powered aircraft intelligence enrichment
 *
 * Given a callsign/registration + ICAO hex + aircraft type, asks Gemini to
 * identify: country, air base, squadron, mission role, and a Wikipedia/image URL.
 *
 * Results are cached in a persistent LRU map so each unique callsign is only
 * queried once. The cache is also persisted to disk via diskCache.
 */

import fetch from 'node-fetch';
import { loadCache, saveCache } from './diskCache.js';

const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

// ── In-memory LRU cache ─────────────────────────────────────────────────────
const MAX_CACHE = 2000;
let intelCache = new Map(); // callsign/icao → result
let resolvedModel = null;   // { apiVer, model } — shared across calls

// Load from disk on startup
try {
  const disk = loadCache('aircraft_intel', null);
  if (disk && typeof disk === 'object') {
    // Convert plain object back to Map
    const entries = Array.isArray(disk) ? disk : Object.entries(disk);
    intelCache = new Map(entries.slice(-MAX_CACHE));
    console.log(`[AircraftIntel] Loaded ${intelCache.size} cached entries from disk`);
  }
} catch { /* ignore */ }

function persistCache() {
  try {
    saveCache('aircraft_intel', [...intelCache].slice(-MAX_CACHE));
  } catch { /* ignore */ }
}

// ── Gemini model resolution (reuses same pattern as aiDanger) ───────────────
const PREFERRED_MODELS = [
  'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite',
  'gemini-1.5-flash', 'gemini-1.5-flash-latest',
  'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro',
];

async function getModel(key) {
  if (resolvedModel) return resolvedModel;

  for (const apiVer of ['v1beta', 'v1']) {
    try {
      const res = await fetch(
        `${GEMINI_HOST}/${apiVer}/models?key=${key}&pageSize=50`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const available = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''));

      for (const p of PREFERRED_MODELS) {
        if (available.includes(p)) {
          resolvedModel = { apiVer, model: p };
          return resolvedModel;
        }
      }
      if (available.length) {
        resolvedModel = { apiVer, model: available[0] };
        return resolvedModel;
      }
    } catch { /* try next */ }
  }
  throw new Error('No Gemini model available');
}

// ── Rate limiting — max 10 calls per minute to stay well within free tier ───
let callTimestamps = [];
const MAX_CALLS_PER_MIN = 10;

function canCall() {
  const now = Date.now();
  callTimestamps = callTimestamps.filter(t => now - t < 60_000);
  return callTimestamps.length < MAX_CALLS_PER_MIN;
}

function recordCall() {
  callTimestamps.push(Date.now());
}

// ── Main: identify a single aircraft ────────────────────────────────────────

/**
 * Query Gemini to identify an aircraft from its callsign, ICAO hex, type, etc.
 *
 * @param {object} params
 * @param {string} params.callsign  — e.g. "CONDR31"
 * @param {string} params.icao24    — e.g. "ae1234"
 * @param {string} params.registration — e.g. "09-5001"
 * @param {string} params.aircraftType — ICAO type code e.g. "B52"
 * @param {string} params.country   — operator country if known
 * @returns {object|null} { country, airBase, squadron, role, unitInsignia, photoUrl, wikiUrl, confidence, source }
 */
export async function identifyAircraft({ callsign, icao24, registration, aircraftType, country }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  // Build a cache key from the most stable identifiers
  const cacheKey = (callsign || icao24 || registration || '').toUpperCase().trim();
  if (!cacheKey) return null;

  // Check cache first
  if (intelCache.has(cacheKey)) {
    return intelCache.get(cacheKey);
  }

  // Rate limit check
  if (!canCall()) {
    console.log(`[AircraftIntel] Rate limited — skipping ${cacheKey}`);
    return null;
  }

  try {
    const { apiVer, model } = await getModel(key);

    const prompt = `You are a military aviation intelligence analyst with expert knowledge of military aircraft worldwide, including callsign conventions, ICAO hex allocations, squadron assignments, and air base locations.

Given the following aircraft data:
- Callsign: ${callsign || 'unknown'}
- ICAO Hex: ${icao24 || 'unknown'}
- Registration: ${registration || 'unknown'}
- Aircraft Type (ICAO): ${aircraftType || 'unknown'}
- Country (from ADS-B): ${country || 'unknown'}

Identify this aircraft and respond with a JSON object:
{
  "country": "Full country name operating this aircraft",
  "countryCode": "ISO 3166-1 alpha-2 code (e.g. US, GB, FR)",
  "airBase": "Home air base name and location (e.g. 'Whiteman AFB, Missouri')",
  "squadron": "Squadron/unit designation and name (e.g. '509th Bomb Wing')",
  "role": "Primary mission role (e.g. 'Strategic Bomber', 'Air Superiority Fighter', 'ISR/Reconnaissance', 'Maritime Patrol', 'Aerial Refueling', 'Transport', 'SIGINT')",
  "aircraftName": "Full aircraft name (e.g. 'B-2A Spirit', 'F-35A Lightning II')",
  "unitInsignia": "Unit nickname or insignia name if known (e.g. 'The Grim Reapers')",
  "notes": "One sentence with any notable operational context or interesting facts about this specific unit or aircraft",
  "confidence": "HIGH, MEDIUM, or LOW — how confident you are in this identification",
  "photoKeywords": "3-4 search keywords for finding a photo of this specific aircraft type in military livery (e.g. 'F-35A USAF Eglin')"
}

RULES:
- Use ONLY well-established, publicly available OSINT knowledge about military callsign patterns and ICAO hex allocations
- If the callsign matches a known pattern (e.g. CONDR = Condor = B-2 Spirit), use that knowledge
- If the ICAO hex falls in a known military range (e.g. AE/AF = US military), use that to identify the country
- If you cannot identify with reasonable confidence, set confidence to "LOW" and fill in what you can
- Do NOT invent or fabricate information — if unknown, use "Unknown"
- Respond ONLY with the JSON object, no other text`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    };

    const url = `${GEMINI_HOST}/${apiVer}/models/${model}:generateContent?key=${key}`;

    recordCall();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      resolvedModel = null;
      throw new Error(`Gemini ${model} HTTP ${res.status}: ${errTxt.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response for ${cacheKey}`);

    const result = JSON.parse(jsonMatch[0]);

    const intel = {
      country:       result.country || null,
      countryCode:   result.countryCode || null,
      airBase:       result.airBase || null,
      squadron:      result.squadron || null,
      role:          result.role || null,
      aircraftName:  result.aircraftName || null,
      unitInsignia:  result.unitInsignia || null,
      notes:         result.notes || null,
      confidence:    result.confidence || 'LOW',
      photoKeywords: result.photoKeywords || null,
      source:        'gemini',
      model,
      queriedAt:     new Date().toISOString(),
    };

    // Cache result
    intelCache.set(cacheKey, intel);
    // Evict oldest if over limit
    if (intelCache.size > MAX_CACHE) {
      const oldest = intelCache.keys().next().value;
      intelCache.delete(oldest);
    }
    persistCache();

    console.log(`[AircraftIntel] ${cacheKey} → ${intel.squadron || 'Unknown'} (${intel.confidence})`);
    return intel;

  } catch (err) {
    console.error(`[AircraftIntel] Error identifying ${cacheKey}:`, err.message);
    // Cache the failure briefly so we don't hammer the API
    const failResult = { country: null, confidence: 'FAILED', error: err.message, queriedAt: new Date().toISOString() };
    intelCache.set(cacheKey, failResult);
    return null;
  }
}

// ── Batch: identify multiple aircraft (queued, throttled) ───────────────────

/**
 * Enrich an array of aircraft with AI intel.
 * Only queries uncached aircraft, up to `maxNew` per batch to stay within rate limits.
 * Returns the full array with `.aiIntel` added to enriched entries.
 */
export async function enrichBatchWithIntel(aircraft, maxNew = 5) {
  if (!process.env.GEMINI_API_KEY || !aircraft?.length) return aircraft;

  let newQueries = 0;
  const enriched = [];

  for (const ac of aircraft) {
    const cacheKey = (ac.callsign || ac.icao24 || ac.registration || '').toUpperCase().trim();
    if (!cacheKey) { enriched.push(ac); continue; }

    // Already cached?
    if (intelCache.has(cacheKey)) {
      const cached = intelCache.get(cacheKey);
      if (cached && cached.confidence !== 'FAILED') {
        enriched.push({ ...ac, aiIntel: cached });
      } else {
        enriched.push(ac);
      }
      continue;
    }

    // Only query up to maxNew per batch
    if (newQueries >= maxNew) {
      enriched.push(ac);
      continue;
    }

    const intel = await identifyAircraft({
      callsign:     ac.callsign,
      icao24:       ac.icao24,
      registration: ac.registration,
      aircraftType: ac.aircraftType,
      country:      ac.country,
    });

    if (intel && intel.confidence !== 'FAILED') {
      enriched.push({ ...ac, aiIntel: intel });
      newQueries++;
    } else {
      enriched.push(ac);
    }
  }

  if (newQueries > 0) {
    console.log(`[AircraftIntel] Batch: ${newQueries} new identifications, ${intelCache.size} total cached`);
  }

  return enriched;
}

/**
 * Look up cached intel for a specific entity (no API call).
 */
export function getCachedIntel(entityId) {
  const key = (entityId || '').toUpperCase().trim();
  return intelCache.get(key) || null;
}

/**
 * Get cache stats.
 */
export function getIntelCacheStats() {
  return { size: intelCache.size, max: MAX_CACHE };
}
