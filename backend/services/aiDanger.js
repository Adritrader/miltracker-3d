/**
 * AI Danger Detection Service
 * 
 * 1. Rule-based local analysis (no API required)
 * 2. Google Gemini API (free: 1500 req/day with key)
 *    – Get key at: https://aistudio.google.com/app/apikey
 */

import fetch from 'node-fetch';

// Each entry: [apiVersion, modelId]
// Ordered newest → oldest. On 404 we log and try next.
const GEMINI_CANDIDATES = [
  ['v1beta', 'gemini-2.0-flash'],
  ['v1beta', 'gemini-2.0-flash-001'],
  ['v1',     'gemini-2.0-flash'],
  ['v1',     'gemini-2.0-flash-001'],
  ['v1beta', 'gemini-1.5-flash-latest'],
  ['v1beta', 'gemini-1.5-flash-001'],
  ['v1',     'gemini-1.5-flash-latest'],
  ['v1',     'gemini-1.5-flash-001'],
];
const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

// ─── Static conflict / restricted zones ────────────────────────────────────────
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

// ── Haversine distance in km ──────────────────────────────────────────────────
function distKm(lat1, lon1, lat2, lon2) {
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
      lat: item.lat || null,
      lon: item.lon || null,
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

  let lastErr;
  for (const [apiVer, model] of GEMINI_CANDIDATES) {
    const url = `${GEMINI_HOST}/${apiVer}/models/${model}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        const errTxt = await res.text();
        const msg = `[AI] ${model} (${apiVer}) → HTTP ${res.status}: ${errTxt.slice(0, 120)}`;
        console.warn(msg);
        lastErr = new Error(msg);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[AI] ${model} (${apiVer}) → no JSON in response`);
        lastErr = new Error(`No JSON in ${model} response`);
        continue;
      }
      const result = JSON.parse(jsonMatch[0]);
      console.log(`[AI] Success with model ${model}`);
      return { ...result, model, source: 'gemini', timestamp: new Date().toISOString() };
    } catch (e) {
      console.warn(`[AI] ${model} (${apiVer}) → exception: ${e.message}`);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Gemini models failed — check Railway logs for details');
}
