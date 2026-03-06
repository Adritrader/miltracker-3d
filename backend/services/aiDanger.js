/**
 * AI Danger Detection Service
 * 
 * 1. Rule-based local analysis (no API required)
 * 2. Google Gemini API (free: 1500 req/day with key)
 *    – Get key at: https://aistudio.google.com/app/apikey
 */

import fetch from 'node-fetch';

const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

// Cache the resolved model so we only call listModels once per process
let resolvedGeminiModel = null; // { apiVer, model }

/**
 * Discover which Gemini model is actually available for this API key by
 * calling the listModels endpoint, then picking the best generateContent model.
 */
async function resolveGeminiModel(key) {
  if (resolvedGeminiModel) return resolvedGeminiModel;

  // Preference order: fastest/cheapest first
  const PREFERRED = [
    'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite',
    'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-001',
    'gemini-1.5-flash-002', 'gemini-1.5-pro', 'gemini-1.5-pro-latest',
    'gemini-1.0-pro', 'gemini-pro',
  ];

  for (const apiVer of ['v1beta', 'v1']) {
    try {
      const res = await fetch(
        `${GEMINI_HOST}/${apiVer}/models?key=${key}&pageSize=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const available = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', '')); // "models/gemini-2.0-flash" → "gemini-2.0-flash"

      console.log(`[AI] Available models (${apiVer}):`, available.join(', '));

      // Pick highest-preference model that's in the available list
      for (const preferred of PREFERRED) {
        if (available.includes(preferred)) {
          resolvedGeminiModel = { apiVer, model: preferred };
          console.log(`[AI] Selected model: ${preferred} (${apiVer})`);
          return resolvedGeminiModel;
        }
      }
      // If none of our preferred list matched, use whatever is available
      if (available.length > 0) {
        resolvedGeminiModel = { apiVer, model: available[0] };
        console.log(`[AI] Fallback model: ${available[0]} (${apiVer})`);
        return resolvedGeminiModel;
      }
    } catch (e) {
      console.warn(`[AI] listModels (${apiVer}) failed:`, e.message);
    }
  }
  throw new Error('No Gemini models available for this API key — check Google AI Studio');
}

/** Call this at startup to log available models immediately. */
export async function probeGeminiModel(key) {
  try { await resolveGeminiModel(key); } catch (e) { console.error('[AI] Probe failed:', e.message); }
}

// ─── Static conflict / restricted zones ────────────────────────────────────────
// NOTE (I2): These are circular threat zones (lat/lon/radius) used for danger zone
// visualisation and alert generation on the backend.
// Different purpose from OPERATIONAL_ZONES in frontend/src/utils/militaryFilter.js,
// which are rectangular bounding boxes used only to filter aircraft display on the map.
// When adding/removing a major conflict area, update BOTH lists.
const CONFLICT_ZONES = [
  { id: 'ukraine',       name: 'Ukraine Conflict Zone',          lat: 48.38, lon: 31.17, radius: 600, severity: 'critical', color: '#ff0000' },
  { id: 'gaza',          name: 'Gaza Strip Operations',          lat: 31.35, lon: 34.35, radius: 80,  severity: 'critical', color: '#ff0000' },
  { id: 'israel_north',  name: 'Israel–Lebanon Front',            lat: 33.10, lon: 35.45, radius: 120, severity: 'critical', color: '#ff0000' },
  { id: 'lebanon',       name: 'Lebanese Airspace (active ops)', lat: 33.70, lon: 35.80, radius: 180, severity: 'high',     color: '#ff6600' },
  { id: 'iran_nuclear',  name: 'Iran Nuclear Sites (Natanz/Fordow)', lat: 34.00, lon: 51.50, radius: 200, severity: 'critical', color: '#ff0000' },
  { id: 'iran_airspace', name: 'Iran Airspace Restricted',       lat: 32.43, lon: 53.69, radius: 700, severity: 'critical', color: '#ff0000' },
  { id: 'strait_hormuz', name: 'Strait of Hormuz',               lat: 26.57, lon: 56.28, radius: 120, severity: 'critical', color: '#ff0000' },
  { id: 'persiangulf',   name: 'Persian Gulf (Active Ops)',      lat: 26.50, lon: 53.00, radius: 400, severity: 'critical', color: '#ff0000' },
  { id: 'red_sea',       name: 'Red Sea (Houthi Zone)',          lat: 20.00, lon: 38.00, radius: 500, severity: 'critical', color: '#ff0000' },
  { id: 'gulf_aden',     name: 'Gulf of Aden',                         lat: 12.00, lon: 46.00, radius: 300, severity: 'high',     color: '#ff6600' },
  { id: 'iraq_syria',    name: 'Iraq-Syria Border Ops',                lat: 34.00, lon: 40.00, radius: 350, severity: 'high',     color: '#ff6600' },
  // Mar 2026: Iranian missile/drone attacks on coalition bases
  { id: 'bahrain',       name: 'Bahrain / US 5th Fleet HQ',           lat: 26.07, lon: 50.55, radius: 80,  severity: 'critical', color: '#ff0000' },
  { id: 'kuwait',        name: 'Kuwait (US Base Under Attack)',         lat: 29.37, lon: 47.98, radius: 150, severity: 'critical', color: '#ff0000' },
  { id: 'cyprus',        name: 'Cyprus (RAF Akrotiri Attacked)',        lat: 34.72, lon: 33.05, radius: 120, severity: 'critical', color: '#ff0000' },
  { id: 'taiwan_strait', name: 'Taiwan Strait Tensions',               lat: 24.50, lon: 119.50,radius: 300, severity: 'high',     color: '#ff6600' },
  { id: 'south_cs',      name: 'South China Sea',                lat: 14.00, lon: 115.00,radius: 800, severity: 'high',     color: '#ff6600' },
  { id: 'uae_op_zone',   name: 'UAE Operational Zone',           lat: 24.50, lon: 54.50, radius: 200, severity: 'high',     color: '#ff6600' },
  { id: 'north_korea',   name: 'Korean Peninsula',               lat: 38.00, lon: 127.00,radius: 300, severity: 'high',     color: '#ff6600' },
  { id: 'syria',         name: 'Syrian Airspace',                lat: 34.80, lon: 38.99, radius: 250, severity: 'high',     color: '#ff6600' },
  { id: 'somalia',       name: 'Gulf of Aden / Somalia',         lat: 11.00, lon: 49.00, radius: 400, severity: 'medium',   color: '#ffaa00' },
  { id: 'russia_border', name: 'NATO-Russia Border',             lat: 57.00, lon: 27.00, radius: 500, severity: 'medium',   color: '#ffaa00' },
  { id: 'sahel',         name: 'Sahel Region',                   lat: 14.49, lon: 0.22,  radius: 800, severity: 'medium',   color: '#ffaa00' },
];

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

// ─── Location keyword → coordinates (used to geocode text-only alerts) ────────
// Ordered by specificity (more specific first — city/landmark before country)
const ALERT_LOCATIONS = [
  // Specific stadiums / landmarks
  { kw: 'azadi stadium',    lat: 35.731, lon: 51.332 },
  { kw: 'azadi',            lat: 35.731, lon: 51.332 },  // Azadi Tower / Stadium, Tehran
  // Cities — sorted roughly most-conflict-relevant first
  { kw: 'kyiv',             lat: 50.450, lon: 30.520 },
  { kw: 'kharkiv',          lat: 49.993, lon: 36.230 },
  { kw: 'zaporizhzhia',     lat: 47.840, lon: 35.140 },
  { kw: 'odessa',           lat: 46.470, lon: 30.730 },
  { kw: 'mariupol',         lat: 47.100, lon: 37.560 },
  { kw: 'donetsk',          lat: 48.020, lon: 37.800 },
  { kw: 'kherson',          lat: 46.640, lon: 32.620 },
  { kw: 'belgorod',         lat: 50.600, lon: 36.620 },
  { kw: 'kursk',            lat: 51.730, lon: 36.190 },
  { kw: 'tel aviv',         lat: 32.080, lon: 34.780 },
  { kw: 'haifa',            lat: 32.819, lon: 34.999 },
  { kw: 'jerusalem',        lat: 31.768, lon: 35.214 },
  { kw: 'tel-aviv',         lat: 32.080, lon: 34.780 },
  { kw: 'gaza',             lat: 31.350, lon: 34.350 },
  { kw: 'rafah',            lat: 31.297, lon: 34.251 },
  { kw: 'khan yunis',       lat: 31.343, lon: 34.304 },
  { kw: 'west bank',        lat: 32.000, lon: 35.250 },
  { kw: 'ramallah',         lat: 31.900, lon: 35.200 },
  { kw: 'beirut',           lat: 33.888, lon: 35.495 },
  { kw: 'southern lebanon', lat: 33.200, lon: 35.350 },
  { kw: 'tehran',           lat: 35.690, lon: 51.390 },
  { kw: 'isfahan',          lat: 32.660, lon: 51.660 },
  { kw: 'natanz',           lat: 33.720, lon: 51.727 },
  { kw: 'fordow',           lat: 34.884, lon: 49.986 },
  { kw: 'bushehr',          lat: 28.920, lon: 50.840 },
  { kw: 'bahrain',          lat: 26.070, lon: 50.550 },
  { kw: 'manama',           lat: 26.215, lon: 50.586 },
  { kw: 'sitra',            lat: 26.090, lon: 50.650 },  // BAPCO refinery island
  { kw: 'damascus',         lat: 33.510, lon: 36.290 },
  { kw: 'aleppo',           lat: 36.200, lon: 37.160 },
  { kw: 'deir ez-zor',      lat: 35.340, lon: 40.140 },
  { kw: 'baghdad',          lat: 33.340, lon: 44.400 },
  { kw: 'mosul',            lat: 36.340, lon: 43.130 },
  { kw: 'erbil',            lat: 36.190, lon: 44.010 },
  { kw: 'eastern syria',    lat: 34.600, lon: 40.800 },
  { kw: 'sanaa',            lat: 15.370, lon: 44.190 },
  { kw: 'aden',             lat: 12.780, lon: 45.030 },
  { kw: 'hodeidah',         lat: 14.800, lon: 42.954 },
  { kw: 'pyongyang',        lat: 39.020, lon: 125.750 },
  { kw: 'taipei',           lat: 25.040, lon: 121.510 },
  { kw: 'moscow',           lat: 55.750, lon: 37.620 },
  { kw: 'minsk',            lat: 53.900, lon: 27.570 },
  { kw: 'tripoli',          lat: 32.890, lon: 13.190 },
  { kw: 'khartoum',         lat: 15.550, lon: 32.530 },
  { kw: 'mogadishu',        lat: 2.040,  lon: 45.340 },
  // Regions / waterways last (broad match)
  { kw: 'strait of hormuz', lat: 26.570, lon: 56.280 },
  { kw: 'persian gulf',     lat: 26.500, lon: 53.000 },
  { kw: 'red sea',          lat: 20.000, lon: 38.000 },
  { kw: 'gulf of aden',     lat: 12.000, lon: 46.000 },
  { kw: 'black sea',        lat: 43.000, lon: 34.000 },
  { kw: 'south china sea',  lat: 14.000, lon: 115.000 },
  { kw: 'taiwan strait',    lat: 24.500, lon: 119.500 },
  { kw: 'ukraine',          lat: 48.380, lon: 31.170 },
  { kw: 'israel',           lat: 31.770, lon: 35.220 },
  { kw: 'lebanon',          lat: 33.850, lon: 35.860 },
  { kw: 'iran',             lat: 32.430, lon: 53.690 },
  { kw: 'iraq',             lat: 33.220, lon: 43.680 },
  { kw: 'syria',            lat: 34.800, lon: 38.990 },
  { kw: 'yemen',            lat: 15.550, lon: 48.520 },
  { kw: 'taiwan',           lat: 23.690, lon: 120.960 },
  { kw: 'north korea',      lat: 40.340, lon: 127.510 },
  { kw: 'russia',           lat: 55.750, lon: 37.620 },
  { kw: 'china',            lat: 35.860, lon: 104.190 },
  { kw: 'afghanistan',      lat: 33.930, lon: 67.710 },
  { kw: 'pakistan',         lat: 30.380, lon: 69.350 },
  { kw: 'sudan',            lat: 12.860, lon: 30.220 },
  { kw: 'somalia',          lat: 5.150,  lon: 46.200 },
  { kw: 'libya',            lat: 26.340, lon: 17.230 },
  { kw: 'mali',             lat: 17.570, lon: -4.000 },
  { kw: 'niger',            lat: 17.610, lon: 8.080 },
  { kw: 'myanmar',          lat: 19.750, lon: 96.080 },
  { kw: 'venezuela',        lat: 6.420,  lon: -66.590 },
  { kw: 'kashmir',          lat: 34.080, lon: 74.800 },
];

// Deterministic jitter — same title+keyword always maps to the same offset so
// alerts don't jump position between poll cycles.
function stableJitter(seed, range) {
  let h = 0x12345678;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9) | 0;
  return ((h >>> 0) / 0xFFFFFFFF - 0.5) * range;
}

/**
 * Try to assign lat/lon to an alert by keyword-matching its title + message.
 * Returns { lat, lon } or null if no match.
 */
function geocodeAlert(title = '', message = '') {
  const text = `${title} ${message}`.toLowerCase();
  for (const loc of ALERT_LOCATIONS) {
    if (text.includes(loc.kw)) {
      // Stable jitter based on title+keyword so same alert never changes position
      const seed = title.slice(0, 40) + loc.kw;
      return {
        lat: loc.lat + stableJitter(seed + 'lat', 0.15),
        lon: loc.lon + stableJitter(seed + 'lon', 0.15),
        geocodedFrom: loc.kw,
      };
    }
  }
  return null;
}

// ── Haversine distance in km ──────────────────────────────────────────────────
// Exported so carrierAirWing.js can share the same implementation (T7).
export function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Severity classification from news headline+description ──────────────────
const CRITICAL_KW = [
  // Generic combat
  /\b(war|warfare|missile.?strike|airstrike|air.?strike|bomb(ing)?|explosion|blast|warhead|invasion|nuclear|hypersonic|attack(ed|s)?|naval.?battle|combat|offensive|strikes?)\b/i,
  // Casualties
  /\b(killed|dead|casualties|fatalities|civilians.?dead|wounded.?killed|mass.?casualt)\b/i,
  // Iran / Israel specific
  /\b(ballistic.?missile|cruise.?missile|missile.?launch|missile.?barrage|missile.?salvo|missile.?attack)\b/i,
  /\b(Iron.?Dome|David.?Sling|Arrow.?3|intercept(ed|s)?|air.?defense.?intercept)\b/i,
  /\b(IRGC|Quds.?Force|Islamic.?Revolutionary|Hezbollah|Hamas|Islamic.?Jihad)\b/i,
  /\b(IDF.?strike|Israeli.?airstrike|Israel.?attack|Israel.?bomb)\b/i,
  /\b(Iran.?missile|Iran.?attack|Iran.?nuclear|Iran.?strike|Iranian.?strike)\b/i,
  /\b(Natanz|Fordow|Bushehr|Isfahan.?nuclear|uranium.?enrichment)\b/i,
  /\b(Houthi.?(missile|rocket|drone|attack|strike)|Ansarallah.?attack)\b/i,
  /\b(Red.?Sea.?(attack|missile|ship.?hit)|Strait.?of.?Hormuz.?(seized|blocked|closed))\b/i,
];
const HIGH_KW = [
  /\b(military|troops|deployed|warship|air.?force|navy|marines|special.?forces|fighter.?(jet|aircraft)|intercept|escalat|conflict|hostil|threat|alert|clash|incursion|provoc)\b/i,
  /\b(IRGC|IDF|Hezbollah|Hamas|Houthi|Patriot|F-35|F-15|Su-57|drone.?strike|UAV.?attack)\b/i,
  /\b(Iran|Israel|Gaza|Lebanon|Syria|Iraq|Yemen|Hormuz|Persian.?Gulf|Red.?Sea)\b/i,
];
const MEDIUM_KW = [
  /\b(drill|exercise|sanction|tension|standoff|mobiliz|reinforce|dispatch|patrol|surveillance|warning|buildup)\b/i,
];

function classifySeverity(title = '', description = '') {
  const text = `${title} ${description}`;
  if (CRITICAL_KW.some(re => re.test(text))) return 'critical';
  if (HIGH_KW.some(re => re.test(text)))     return 'high';
  if (MEDIUM_KW.some(re => re.test(text)))   return 'medium';
  return 'low';
}

/**
 * Convert news items into alert objects.
 * Only items that match at least medium severity are converted.
 */
export function alertsFromNews(newsItems = []) {
  const alerts = [];
  for (const item of newsItems) {
    const severity = classifySeverity(item.title, item.description);
    if (severity === 'low') continue; // skip low-relevance items
    const id = `news-${Buffer.from(item.url || item.title || '').toString('base64').slice(0, 24)}`;
    const geo = (item.lat != null && item.lon != null)
      ? { lat: item.lat, lon: item.lon }
      : (geocodeAlert(item.title, item.description) ?? { lat: null, lon: null });
    alerts.push({
      id,
      type: 'news_alert',
      severity,
      title: item.title || 'Breaking News',
      message: item.description || item.title || '',
      source: item.source,
      url: item.url,
      image: item.image || null,
      timestamp: item.publishedAt || new Date().toISOString(),
      lat: geo.lat,
      lon: geo.lon,
      geocodedFrom: geo.geocodedFrom || null,
    });
  }
  // Sort critical first, then by newest
  return alerts
    .sort((a, b) => {
      const sev = { critical: 4, high: 3, medium: 2, low: 1 };
      if (sev[b.severity] !== sev[a.severity]) return sev[b.severity] - sev[a.severity];
      return new Date(b.timestamp) - new Date(a.timestamp);
    })
    .slice(0, 30);
}

// ─── Local rule-based analysis (zones only — no alert generation) ─────────────
export function analyzeLocalDanger(aircraft, ships, news) {
  // Only return static danger zones for the globe overlay.
  // Alerts are now derived exclusively from real news (see alertsFromNews).
  return {
    dangerZones: CONFLICT_ZONES,
    alerts: [],
  };

}

// ─── Gemini AI analysis ────────────────────────────────────────────────────────
export async function analyzeWithGemini(newsItems, aircraft, ships) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const headlines = newsItems.map(n => n.title).join('\n');
  const acSummary = aircraft.slice(0, 10).map(a =>
    `${a.callsign} (${a.country}) at ${Math.round(a.altitude)}m near lat:${a.lat?.toFixed(1)} lon:${a.lon?.toFixed(1)}`
  ).join(', ');
  const shipSummary = ships.slice(0, 5).map(s =>
    `${s.name} (${s.flag})`
  ).join(', ');

  const prompt = `You are a military intelligence analyst AI. Analyze the following real-time data and provide a brief threat assessment.

CURRENT NEWS HEADLINES:
${headlines}

ACTIVE MILITARY AIRCRAFT (sample): ${acSummary || 'No data'}
ACTIVE WARSHIPS (sample): ${shipSummary || 'No data'}

Provide a JSON response with:
{
  "threatLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "2-3 sentence geopolitical summary",
  "hotspots": [{"location": "name", "lat": number, "lon": number, "reason": "short explanation"}],
  "recommendations": ["watch item 1", "watch item 2"],
  "timestamp": "ISO timestamp"
}

Be factual, concise, and analytical. Do not speculate beyond available data.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
  };

  // Discover the best available model (cached after first call)
  const { apiVer, model } = await resolveGeminiModel(key);
  const url = `${GEMINI_HOST}/${apiVer}/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    // Reset so next call re-discovers (model may have been removed)
    resolvedGeminiModel = null;
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${errTxt.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in ${model} response`);

  const result = JSON.parse(jsonMatch[0]);
  console.log(`[AI] Analysis complete — model: ${model}`);
  return { ...result, model, source: 'gemini', timestamp: new Date().toISOString() };
}
