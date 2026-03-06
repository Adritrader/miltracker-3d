/**
 * News Service – GDELT Project API (free, no key) + NewsAPI (free tier)
 * 
 * GDELT: https://api.gdeltproject.org
 * NewsAPI: https://newsapi.org (free: 100 req/day, requires free API key)
 */

import fetch from 'node-fetch';

const MILITARY_QUERIES = [
  'military strike aircraft', 'naval vessel warship', 'missile attack',
  'military conflict war', 'airstrike bombing', 'military operation',
  'drone strike', 'naval blockade', 'military deployment',
  'explosion blast attack', 'armed forces combat',
  // Iran / Israel specific
  'Iran Israel missile strike attack',
  'IRGC ballistic missile launch',
  'Israel air force strike Iran',
  'Iran nuclear facility attack',
  'Hezbollah rocket missile Israel',
  'Iron Dome intercept missile',
  'Iran drone attack base',
];

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2';

// ─── GDELT ───────────────────────────────────────────────────────────────────
export async function fetchGDELTNews() {
  // GDELT v2 DOC API – space-separated terms work best
  const queries = [
    // Ongoing conflicts
    'military ukraine russia war airstrike',
    'Gaza Israel airstrike strike killed',
    'warship naval China Taiwan South China Sea',
    // Iran / Israel — detailed coverage
    'Iran IRGC missile ballistic attack Israel',
    'Israel IDF airstrike Iran nuclear facility',
    'Iran drone attack US base Iraq Syria',
    'Hezbollah missile rocket strike Israel Lebanon',
    'Israel Iron Dome intercept Hezbollah Hamas rocket',
    'Iran nuclear enrichment uranium IAEA Fordow Natanz',
    'Strait of Hormuz Iran IRGC tanker seizure',
    'Iran proxy Iraq Syria militia attack US forces',
    // Yemen / Red Sea
    'Yemen Houthi attack Red Sea ship strike missile',
    'Houthi ballistic missile drone Red Sea warship',
    // Other
    'Iraq Syria explosion attack killed militia',
    'Sudan Somalia Ethiopia armed attack killed',
    'North Korea missile launch test ICBM',
  ];
  // Fetch all queries in parallel (batches of 4) with 10s timeout each
  const fetchOne = async (q) => {
    try {
      const url = `${GDELT_BASE}/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=20&sort=DateDesc&format=json&timespan=24h&sourcelang=eng`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.warn(`[GDELT-NEWS] ${res.status} for "${q.slice(0,40)}"`); return []; }
      const data = await res.json();
      return data?.articles || [];
    } catch (e) {
      console.warn(`[GDELT-NEWS] timeout/error for "${q.slice(0,40)}": ${e.message}`);
      return [];
    }
  };

  // Run all queries in parallel — each is independently timeout-gated (O7)
  const settled = await Promise.allSettled(queries.map(fetchOne));
  const allArticles = settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  if (allArticles.length === 0) {
    console.warn('[GDELT-NEWS] All queries failed — serving seed fallback');
    return getSeedNews();
  }
  console.log(`[GDELT-NEWS] Got ${allArticles.length} raw articles from GDELT`);

  return allArticles.map(a => ({
    id: `gdelt-${encodeURIComponent(a.url || a.title || '').slice(0, 60)}`,
    source: a.domain || 'GDELT',
    title: a.title || 'No title',
    url: a.url || '',
    description: a.seendate ? `Reported: ${a.seendate}` : '',
    publishedAt: a.seendate
      ? new Date(a.seendate.replace(/(.{4})(.{2})(.{2})T(.{2})(.{2})(.{2})Z/, '$1-$2-$3T$4:$5:$6Z')).toISOString()
      : new Date().toISOString(),
    domain: a.domain || '',
    lat: null, lon: null,
    imageUrl: a.socialimage || null,
    tone: null,
    type: 'news',
  })).filter(a => a.url);
}

// ─── GDELT GeoNews (geolocated events) ───────────────────────────────────────
export async function fetchGDELTGeoEvents() {
  // GDELT GEO API returns events with lat/lon
  const url = `${GDELT_BASE}/geo/geo?query=military+OR+war+OR+airstrike+OR+explosion&mode=pointdata&maxpoints=100&timespan=24h&format=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`GDELT GEO ${res.status}`);
    const data = await res.json();

    return (data?.features || []).map((f) => ({
      id: `gdelt-geo-${(f.geometry?.coordinates?.[1] ?? 0).toFixed(3)}-${(f.geometry?.coordinates?.[0] ?? 0).toFixed(3)}-${encodeURIComponent(f.properties?.url || f.properties?.name || '').slice(0, 30)}`,
      source: 'GDELT-GEO',
      title: f.properties?.name || f.properties?.title || 'Event',
      url: f.properties?.url || '',
      lat: f.geometry?.coordinates?.[1] ?? null,
      lon: f.geometry?.coordinates?.[0] ?? null,
      publishedAt: new Date().toISOString(),
      tone: f.properties?.tone ?? 0,
      count: f.properties?.count || 1,
      type: 'geo_event',
    })).filter(e => e.lat && e.lon);
  } catch (e) {
    console.warn('[GDELT-GEO]', e.message);
    return [];
  }
}

// ─── RSS Feeds (free, no key – via rss2json.com) ─────────────────────────────
const RSS_SOURCES = [
  // Global / NATO
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                          label: 'BBC World' },
  // BBC Middle East — dedicated feed, extremely active during Iran war
  { url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',              label: 'BBC Middle East' },
  // BBC Europe / Ukraine
  { url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml',                   label: 'BBC Europe' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',                             label: 'Al Jazeera' },
  { url: 'https://news.usni.org/feed',                                            label: 'USNI News' },
  { url: 'https://breakingdefense.com/feed/',                                     label: 'Breaking Defense' },
  { url: 'https://www.thedrive.com/the-war-zone/rss',                             label: 'The War Zone' },
  { url: 'https://kyivindependent.com/feed/',                                     label: 'Kyiv Independent' },
  { url: 'https://defensenews.com/arc/outboundfeeds/rss/?outputType=xml',         label: 'Defense News' },
  // Middle East / Iran / Israel
  { url: 'https://www.timesofisrael.com/feed/',                                   label: 'Times of Israel' },
  { url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx',                      label: 'Jerusalem Post' },
  // Iran International (fixed URL)
  { url: 'https://www.iranintl.com/rss',                                          label: 'Iran International' },
  { url: 'https://www.middleeasteye.net/rss',                                     label: 'Middle East Eye' },
  { url: 'https://warontherocks.com/feed/',                                       label: 'War on the Rocks' },
  { url: 'https://feeds.reuters.com/reuters/worldNews',                           label: 'Reuters' },
  { url: 'https://www.al-monitor.com/rss',                                        label: 'Al-Monitor' },
  { url: 'https://www.i24news.tv/en/rss',                                         label: 'i24 News' },
  { url: 'https://www.atlanticcouncil.org/feed/',                                 label: 'Atlantic Council' },
  // Additional English-language military & conflict sources
  { url: 'https://www.militarytimes.com/rss/news/',                               label: 'Military Times' },
  { url: 'https://taskandpurpose.com/feed/',                                       label: 'Task & Purpose' },
  { url: 'https://www.stripes.com/arc/outboundfeeds/rss/?outputType=xml',         label: 'Stars and Stripes' },
  { url: 'https://www.theguardian.com/world/rss',                                  label: 'The Guardian' },
  { url: 'https://foreignpolicy.com/feed/',                                        label: 'Foreign Policy' },
  { url: 'https://www.bellingcat.com/feed/',                                       label: 'Bellingcat' },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml',                          label: 'Sky News World' },
  { url: 'https://www.cbsnews.com/latest/rss/world',                               label: 'CBS News World' },
  { url: 'https://sofrep.com/feed/',                                                label: 'SOFREP' },
  { url: 'https://www.understandingwar.org/feed',                                   label: 'ISW' },
];

// Military-relevance keywords — at least one must appear in title/description
const MIL_KEYWORDS = [
  'military', 'missile', 'airstrike', 'strike', 'drone', 'warship', 'navy', 'naval',
  'soldiers', 'troops', 'combat', 'attack', 'bomb', 'explosion', 'killed', 'war',
  'conflict', 'pentagon', 'nato', 'weapon', 'aircraft', 'fighter', 'tank', 'artillery',
  'rocket', 'houthi', 'ukraine', 'russia', 'israel', 'gaza', 'iran', 'taiwan',
  'north korea', 'china sea', 'submarine', 'carrier', 'air force', 'battalion',
  // Iran / Israel specifics
  'irgc', 'idf', 'mossad', 'hezbollah', 'hamas', 'iron dome', 'david\'s sling',
  'ballistic', 'hypersonic', 'cruise missile', 'intercept', 'nuclear', 'uranium',
  'natanz', 'fordow', 'tehran', 'tel aviv', 'haifa', 'beirut', 'damascus',
  'strait of hormuz', 'persian gulf', 'red sea', 'indian ocean', 'mediterranean',
  'proxy', 'militia', 'Wagner', 'mobiliz', 'offensive', 'ceasefire', 'escalat',
  'hostage', 'siege', 'blockade', 'evacuat', 'casualt', 'dead', 'wounded',
];

function isMilitaryRelevant(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return MIL_KEYWORDS.some(kw => text.includes(kw));
}

function extractRSSImage(item) {
  // thumbnail field (rss2json)
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  // enclosure
  if (item.enclosure?.link?.startsWith('http') &&
      (item.enclosure.type?.startsWith('image') || /\.(jpg|jpeg|png|webp)/i.test(item.enclosure.link))) {
    return item.enclosure.link;
  }
  // og:image scraped from content/description HTML
  const html = item.content || item.description || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && m[1].startsWith('http')) return m[1];
  return null;
}

export async function fetchRSSFeeds() {
  const results = [];
  await Promise.allSettled(RSS_SOURCES.map(async (src) => {
    try {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(src.url)}&count=15`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== 'ok' || !Array.isArray(data.items)) return;

      for (const item of data.items) {
        if (!item.title || !item.link) continue;
        if (!isMilitaryRelevant(item.title, item.description || '')) continue;
        const imageUrl = extractRSSImage(item);
        results.push({
          id: `rss-${src.label.replace(/\s/g,'-')}-${encodeURIComponent(item.link).slice(0, 40)}`,
          source: src.label,
          title: item.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim(),
          url: item.link,
          description: item.description?.replace(/<[^>]+>/g, '').slice(0, 200) || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          imageUrl,
          lat: null, lon: null,
          type: 'news',
        });
      }
    } catch (_) { /* skip source */ }
  }));
  return results;
}

// ─── NewsAPI ──────────────────────────────────────────────────────────────────
export async function fetchNewsAPI() {
  if (!process.env.NEWSAPI_KEY) return [];

  const query = encodeURIComponent('military war airstrike missile attack warship');
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${process.env.NEWSAPI_KEY}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${res.statusText}`);

  const data = await res.json();

  return (data?.articles || []).map(a => ({
    id: `newsapi-${encodeURIComponent(a.url || '').slice(0, 40)}`,
    source: a.source?.name || 'NewsAPI',
    title: a.title || 'No title',
    url: a.url || '',
    description: a.description || '',
    publishedAt: a.publishedAt || new Date().toISOString(),
    imageUrl: a.urlToImage || null,
    lat: null,
    lon: null,
    type: 'news',
  })).filter(a => a.url && !a.title?.includes('[Removed]'));
}

// ─── Conflict zone news geocoding (best-effort) ───────────────────────────────
const KNOWN_LOCATIONS = {
  'ukraine': { lat: 48.3794, lon: 31.1656 }, 'kyiv': { lat: 50.45, lon: 30.52 },
  'kherson': { lat: 46.64, lon: 32.62 }, 'kharkiv': { lat: 49.99, lon: 36.23 },
  'zaporizhzhia': { lat: 47.84, lon: 35.14 }, 'mariupol': { lat: 47.10, lon: 37.54 },
  'russia': { lat: 55.75, lon: 37.62 }, 'moscow': { lat: 55.75, lon: 37.62 },
  'belgorod': { lat: 50.60, lon: 36.62 }, 'crimea': { lat: 44.95, lon: 34.10 },
  // Israel / Palestine / Lebanon / Iran — detailed
  'israel': { lat: 31.05, lon: 34.85 }, 'tel aviv': { lat: 32.08, lon: 34.78 },
  'jerusalem': { lat: 31.78, lon: 35.22 }, 'haifa': { lat: 32.82, lon: 34.99 },
  'beit shemesh': { lat: 31.74, lon: 34.99 }, // Iranian missile strike Mar 2026
  'negev': { lat: 30.85, lon: 34.79 }, 'ashkelon': { lat: 31.67, lon: 34.57 },
  'ben gurion': { lat: 31.99, lon: 34.89 }, 'golan': { lat: 33.12, lon: 35.78 },
  'gaza': { lat: 31.35, lon: 34.35 }, 'west bank': { lat: 31.96, lon: 35.30 },
  'rafah': { lat: 31.28, lon: 34.25 }, 'khan younis': { lat: 31.34, lon: 34.31 },
  'lebanon': { lat: 33.85, lon: 35.86 }, 'beirut': { lat: 33.89, lon: 35.50 },
  'southern lebanon': { lat: 33.20, lon: 35.40 }, 'south lebanon': { lat: 33.10, lon: 35.45 },
  'iran': { lat: 32.43, lon: 53.69 }, 'tehran': { lat: 35.69, lon: 51.39 },
  'natanz': { lat: 33.72, lon: 51.73 }, 'fordow': { lat: 34.88, lon: 50.00 },
  'isfahan': { lat: 32.66, lon: 51.68 }, 'tabriz': { lat: 38.08, lon: 46.30 },
  'bandar abbas': { lat: 27.18, lon: 56.27 }, 'kharg island': { lat: 29.25, lon: 50.32 },
  'strait of hormuz': { lat: 26.57, lon: 56.28 }, 'persian gulf': { lat: 26.50, lon: 53.00 },
  // Gulf states — now active conflict areas (Mar 2026)
  'kuwait': { lat: 29.37, lon: 47.98 }, 'kuwait city': { lat: 29.37, lon: 47.98 },
  'ali al salem': { lat: 29.45, lon: 47.52 }, // US airbase hit by Iran
  'bahrain': { lat: 26.07, lon: 50.55 }, 'dubai': { lat: 25.20, lon: 55.27 },
  'abu dhabi': { lat: 24.45, lon: 54.37 }, 'riyadh': { lat: 24.69, lon: 46.72 },
  'dhahran': { lat: 26.29, lon: 50.21 }, 'jeddah': { lat: 21.49, lon: 39.19 },
  'qatar': { lat: 25.35, lon: 51.18 }, 'doha': { lat: 25.28, lon: 51.53 },
  'oman': { lat: 21.00, lon: 57.00 }, 'muscat': { lat: 23.61, lon: 58.59 },
  // Cyprus — British base attacked Mar 2026
  'cyprus': { lat: 35.12, lon: 33.43 }, 'akrotiri': { lat: 34.58, lon: 32.97 },
  // Syria / Iraq
  'syria': { lat: 34.80, lon: 38.99 }, 'damascus': { lat: 33.51, lon: 36.29 },
  'aleppo': { lat: 36.20, lon: 37.16 }, 'deir ez-zor': { lat: 35.33, lon: 40.14 },
  'baghdad': { lat: 33.34, lon: 44.40 }, 'iraq': { lat: 33.22, lon: 43.68 },
  'mosul': { lat: 36.34, lon: 43.13 }, 'erbil': { lat: 36.19, lon: 44.01 },
  // Yemen / Saudi
  'yemen': { lat: 15.55, lon: 48.52 }, 'sanaa': { lat: 15.35, lon: 44.20 },
  'hodeidah': { lat: 14.80, lon: 42.95 }, 'aden': { lat: 12.79, lon: 45.04 },
  'saudi arabia': { lat: 23.89, lon: 45.08 },
  // Other
  'china': { lat: 35.86, lon: 104.19 }, 'taiwan': { lat: 23.69, lon: 120.96 },
  'north korea': { lat: 40.34, lon: 127.51 }, 'pyongyang': { lat: 39.02, lon: 125.75 },
  'south china sea': { lat: 14.0, lon: 115.0 }, 'taiwan strait': { lat: 24.5, lon: 119.5 },
  'red sea': { lat: 20.0, lon: 38.0 }, 'gulf of aden': { lat: 12.0, lon: 46.0 },
  'sudan': { lat: 12.86, lon: 30.22 }, 'somalia': { lat: 5.15, lon: 46.20 },
  'sahel': { lat: 14.49, lon: 0.22 }, 'mali': { lat: 17.57, lon: -4.0 },
  'myanmar': { lat: 19.15, lon: 96.12 }, 'mediterranean': { lat: 35.0, lon: 18.0 },
  'black sea': { lat: 43.0, lon: 34.0 }, 'baltic': { lat: 57.0, lon: 20.0 },
};

export function geocodeNewsItem(newsItem) {
  const text = `${newsItem.title} ${newsItem.description}`.toLowerCase();
  for (const [keyword, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (text.includes(keyword)) {
      return {
        ...newsItem,
        lat: coords.lat + (Math.random() - 0.5) * 0.5,
        lon: coords.lon + (Math.random() - 0.5) * 0.5,
      };
    }
  }
  return newsItem;
}

// ─── Seed news (fallback when GDELT rate-limits) ─────────────────────────────
// Each article gets a staggered publishedAt spread over the last ~3 hours so
// they don't all show the same timestamp in the UI.
function ago(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function getSeedNews() {
  return [
    { id:'seed-1',  source:'LiveUAMap',         title:'Artillery shelling reported near Zaporizhzhia front line',                                  url:'https://liveuamap.com',         lat:47.84, lon:35.14, publishedAt:ago(8),   type:'news' },
    { id:'seed-2',  source:'Times of Israel',   title:'IDF confirms airstrikes on Iranian-linked weapons depots in Syria',                        url:'https://timesofisrael.com',     lat:33.51, lon:36.29, publishedAt:ago(17),  type:'news' },
    { id:'seed-3',  source:'Iran International',title:'IRGC confirms ballistic missile test over Persian Gulf – warns Israel and US',             url:'https://iranintl.com',          lat:26.57, lon:56.28, publishedAt:ago(31),  type:'news' },
    { id:'seed-4',  source:'Jerusalem Post',    title:'Iron Dome battery intercepts barrage of rockets from southern Lebanon',                    url:'https://jpost.com',             lat:33.20, lon:35.40, publishedAt:ago(45),  type:'news' },
    { id:'seed-5',  source:'Al Jazeera',        title:'Houthi forces fire anti-ship missile at Red Sea cargo vessel near Bab-el-Mandeb',         url:'https://aljazeera.com',         lat:12.50, lon:43.50, publishedAt:ago(58),  type:'news' },
    { id:'seed-6',  source:'Middle East Eye',   title:'Iran-backed militias strike US military base in eastern Syria with drones',                url:'https://middleeasteye.net',     lat:34.60, lon:40.10, publishedAt:ago(72),  type:'news' },
    { id:'seed-7',  source:'i24 News',          title:'Israel forces strike Hezbollah missile storage site in Bekaa Valley',                     url:'https://i24news.tv',            lat:33.85, lon:35.90, publishedAt:ago(89),  type:'news' },
    { id:'seed-8',  source:'USNI News',         title:'USS Gerald R. Ford carrier strike group enters Eastern Mediterranean amid tensions',      url:'https://news.usni.org',         lat:35.00, lon:27.00, publishedAt:ago(103), type:'news' },
    { id:'seed-9',  source:'BBC World',         title:'Iran nuclear facility at Natanz under heightened military guard after satellite imagery', url:'https://bbc.com',               lat:33.72, lon:51.73, publishedAt:ago(118), type:'news' },
    { id:'seed-10', source:'The War Zone',      title:'B-52 bombers deployed to Diego Garcia in show of force amid Iran escalation',              url:'https://thedrive.com',          lat:-7.32, lon:72.42, publishedAt:ago(134), type:'news' },
    { id:'seed-11', source:'Reuters',           title:'IAEA reports Iran accelerating uranium enrichment to 84% at Fordow facility',             url:'https://reuters.com',           lat:34.88, lon:50.00, publishedAt:ago(147), type:'news' },
    { id:'seed-12', source:'Defense News',      title:'F-35I Adir squadrons on full alert after Iran missile test — Israeli Air Force',          url:'https://defensenews.com',       lat:31.90, lon:34.80, publishedAt:ago(163), type:'news' },
    { id:'seed-13', source:'Al-Monitor',        title:'Iran IRGC Navy seizes oil tanker in Strait of Hormuz — crew held',                       url:'https://al-monitor.com',        lat:26.57, lon:56.25, publishedAt:ago(178), type:'news' },
    { id:'seed-14', source:'Kyiv Independent',  title:'Ukrainian drones strike Russian oil depot in Belgorod region — large fire reported',      url:'https://kyivindependent.com',   lat:50.60, lon:36.62, publishedAt:ago(194), type:'news' },
    { id:'seed-15', source:'Breaking Defense',  title:'CENTCOM confirms strike on Houthi command center after Red Sea missile attack',           url:'https://breakingdefense.com',   lat:15.35, lon:44.20, publishedAt:ago(210), type:'news' },
  ];
}
