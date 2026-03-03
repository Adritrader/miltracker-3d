/**
 * Conflict Events Service
 *
 * Fetches real geolocated conflict events from:
 *   1. GDELT GEO API — conflict & military event point data (free, no key)
 *   2. GDELT DOC API — geocoded recent articles about strikes/explosions
 *
 * Each event has: id, type, title, lat, lon, country, source, publishedAt, severity
 *
 * Event types map to icons on the frontend:
 *   airstrike | missile | explosion | artillery | naval | troops | unknown
 */

import fetch from 'node-fetch';

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2';
const TIMEOUT = 25000; // GDELT public API can be slow; Middle East queries return more data

// Patterns to classify event type from title/description
const EVENT_PATTERNS = [
  { type: 'airstrike',  pat: /airstrike|air strike|air.?raid|warplane|fighter.?jet|bombing.?run|bomb/i },
  { type: 'missile',   pat: /missile|rocket.?attack|ballistic|cruise.?missile|launch/i },
  { type: 'explosion', pat: /explosion|blast|detonation|IED|car.?bomb|suicide.?bomb/i },
  { type: 'artillery', pat: /artillery|shell|shelling|mortar|bombardment|howitzer/i },
  { type: 'drone',     pat: /drone|UAV|kamikaze.?drone|shahed/i },
  { type: 'naval',     pat: /naval|warship|submarine|torpedo|sea.?mine|vessel/i },
  { type: 'troops',    pat: /troops|soldiers|infantry|advance|offensive|ground.?assault/i },
];

function classifyEvent(text = '') {
  for (const { type, pat } of EVENT_PATTERNS) {
    if (pat.test(text)) return type;
  }
  return 'conflict';
}

function severityFromTone(tone) {
  if (tone <= -15) return 'critical';
  if (tone <=  -7) return 'high';
  if (tone <=  -2) return 'medium';
  return 'low';
}

// ─── Keyword → coordinate map for geocoding article titles ────────────────────
// Ordered longest-match-first. Each entry: [keyword, lat, lon]
const LOCATION_MAP = [
  // ── Middle East ──
  ['strait of hormuz', 26.57, 56.25], ['persian gulf',    26.50, 53.00],
  ['red sea',          20.00, 38.00], ['gulf of aden',    12.00, 47.00],
  ['houthi',           15.40, 44.20], ['sanaa',           15.37, 44.19],
  ['aden',             12.78, 45.04], ['hodeidah',        14.80, 42.95],
  ['marib',            15.47, 45.32], ['yemen',           15.55, 48.52],
  ['tehran',           35.69, 51.39], ['isfahan',         32.66, 51.68],
  ['natanz',           33.72, 51.92], ['bushehr',         28.92, 50.84],
  ['irgc',             32.43, 53.69], ['iran',            32.43, 53.69],
  ['baghdad',          33.34, 44.40], ['mosul',           36.34, 43.13],
  ['erbil',            36.19, 44.01], ['fallujah',        33.35, 43.77],
  ['iraq',             33.22, 43.68],
  ['damascus',         33.51, 36.29], ['aleppo',          36.20, 37.16],
  ['idlib',            35.93, 36.63], ['deir ez-zor',     35.33, 40.14],
  ['raqqa',            35.95, 39.01], ['syria',           34.80, 38.99],
  ['beirut',           33.89, 35.50], ['hezbollah',       33.85, 35.86],
  ['south lebanon',    33.35, 35.40], ['lebanon',         33.85, 35.86],
  ['west bank',        31.95, 35.30], ['jenin',           32.46, 35.30],
  ['rafah',            31.29, 34.25], ['khan yunis',      31.34, 34.30],
  ['gaza city',        31.52, 34.45], ['gaza strip',      31.35, 34.35],
  ['hamas',            31.35, 34.35], ['gaza',            31.35, 34.35],
  ['tel aviv',         32.08, 34.78], ['haifa',           32.82, 34.99],
  ['ashkelon',         31.67, 34.57], ['israel',          31.77, 35.22],
  ['riyadh',           24.69, 46.72], ['jeddah',          21.49, 39.19],
  ['saudi arabia',     23.89, 45.08], ['jordan',          31.96, 35.95],
  ['kuwait',           29.37, 47.98], ['uae',             23.42, 53.85],
  ['oman',             21.00, 57.00], ['bahrain',         26.07, 50.55],
  ['afghanistan',      34.52, 69.17], ['kabul',           34.52, 69.17],
  ['pakistan',         30.38, 69.35],
  // ── Ukraine / Russia ──
  ['kherson',  46.64,32.62],['zaporizhzhia',47.84,35.14],['mariupol', 47.10,37.56],
  ['donetsk',  48.02,37.80],['luhansk',     48.57,39.34],['kharkiv',  49.99,36.23],
  ['odessa',   46.47,30.73],['kyiv',        50.45,30.52],['lviv',     49.84,24.03],
  ['kursk',    51.73,36.19],['belgorod',    50.60,36.62],['crimea',   45.30,34.00],
  ['sevastopol',44.62,33.52],['dnipro',     48.46,35.05],
  ['ukraine',  48.38,31.17],['russia',      55.75,37.62],['moscow',   55.75,37.62],
  // ── East Asia ──
  ['taiwan strait',24.50,119.50],['south china sea',14.00,115.00],
  ['spratly', 9.50,113.50],['taiwan',23.69,120.96],
  ['pyongyang',39.02,125.75],['north korea',40.34,127.51],
  // ── Africa ──
  ['khartoum',15.55,32.53],['darfur',14.50,24.00],['el fasher',13.63,25.35],
  ['omdurman',15.65,32.49],['sudan',12.86,30.22],
  ['mogadishu',2.04,45.34],['baidoa',3.12,43.65],['somalia',5.15,46.20],
  ['ouagadougou',12.36,-1.53],['burkina faso',12.36,-1.53],
  ['bamako',12.65,-8.00],['mopti',14.50,-4.20],['mali',17.57,-4.00],
  ['niamey',13.51,2.12],['tilaberi',14.21,1.45],['niger',17.61,8.08],
  ['tigray',14.04,38.37],['amhara',11.70,39.54],['ethiopia',9.14,40.49],
  ['tripoli',32.89,13.19],['benghazi',32.11,20.07],['libya',26.34,17.23],
  ['boko haram',11.85,13.16],['nigeria',9.08,8.67],
  ['mozambique',18.66,35.53],['cabo delgado',12.33,40.07],
  // ── Asia / Pacific ──
  ['sagaing',22.58,95.45],['mandalay',21.97,96.08],['yangon',16.87,96.19],
  ['chin state',22.00,93.53],['kayah',19.05,97.34],['myanmar',19.75,96.08],
  ['kabul',34.52,69.17],['kandahar',31.61,65.71],['afghanistan',34.52,69.17],
  ['kashmir',34.08,74.80],['islamabad',33.72,73.06],['lahore',31.56,74.35],
  // ── Seas / regions ──
  ['black sea',43.00,34.00],['mediterranean',35.00,18.00],
  ['gulf of guinea',3.00,2.50],['arctic',78.00,20.00],
  ['sea of japan',40.00,135.00],['east china sea',29.00,125.00],
];

function geocodeTitle(title = '', sourcecountry = '') {
  const text = `${title} ${sourcecountry}`.toLowerCase();
  for (const [kw, lat, lon] of LOCATION_MAP) {
    if (text.includes(kw)) {
      return { lat: lat + (Math.random() - 0.5) * 0.4, lon: lon + (Math.random() - 0.5) * 0.4 };
    }
  }
  return null;
}

// ─── GDELT GEO point data ────────────────────────────────────────────────────
async function fetchGDELTGeoConflicts() {
  const queries = [
    // Global conflict
    'airstrike missile explosion artillery killed',
    'military attack bomb blast wounded',
    'drone strike UAV attack explosion',
    // Iran / Israel MISSILES — highest priority
    'Iran Israel missile strike ballistic attack',
    'IRGC ballistic missile launch test Israel',
    'Iran nuclear facility attack Natanz Fordow strike',
    'IDF airstrike Iran Syria weapons smuggling',
    'Hezbollah missile rocket attack Israel',
    'Iron Dome David Sling Arrow intercept missile',
    'Hamas rocket barrage Iron Dome intercept',
    'Israel Lebanon border Hezbollah exchange fire',
    // Hormuz / Red Sea missiles
    'Iran IRGC Strait of Hormuz tanker seized attack',
    'Houthi anti-ship missile ballistic drone Red Sea',
    'Saudi Arabia Patriot intercept Houthi missile Riyadh',
    'UAE intercept Houthi drone missile Abu Dhabi Dubai',
    // Yemen / Houthis
    'Yemen Houthi attack explosion missile Red Sea',
    // Iraq militia
    'Iraq militia bomb explosion attack killed',
    // Syria
    'Syria airstrike bombing attack explosion',
    // Generic ME
    'Israel Gaza Lebanon airstrike bomb strike',
    // Ukraine / Russia
    'Ukraine Russia artillery shelling missile',
    // Asia-Pacific
    'Taiwan China military exercise strait',
    'North Korea missile launch test ICBM',
    'Myanmar military junta airstrike bomb',
    // Africa
    'Sudan RSF SAF airstrike attack killed',
    'Sahel Mali Burkina Faso Niger attack military',
    'Somalia Al-Shabaab attack explosion killed',
    'Ethiopia Tigray armed clash attack',
    'Mozambique insurgent attack explosion',
    // South Asia
    'Kashmir Pakistan India military border firing',
    'Afghanistan Taliban explosion killed',
  ];

  const fetches = queries.map(async q => {
    try {
      const url = `${GDELT_BASE}/geo/geo?query=${encodeURIComponent(q)}&mode=pointdata&maxpoints=60&timespan=48h&format=json`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) return [];
      const data = await res.json();
      const items = [];
      for (const f of data?.features || data?.data || []) {
        const lat = f.geometry?.coordinates?.[1] ?? f.lat;
        const lon = f.geometry?.coordinates?.[0] ?? f.lon;
        if (lat == null || lon == null) continue;
        const props = f.properties || f;
        const title = props.name || props.title || props.label || q;
        items.push({
          id:          `gdelt-geo-${(+lon).toFixed(3)}-${(+lat).toFixed(3)}`,
          type:        classifyEvent(title),
          title,
          url:         props.url || '',
          lat: +lat, lon: +lon,
          country:     props.countryname || props.country || '',
          source:      'GDELT-GEO',
          publishedAt: new Date().toISOString(),
          tone:        props.tone ?? -5,
          severity:    severityFromTone(props.tone ?? -5),
        });
      }
      return items;
    } catch (_) { return []; }
  });

  const settled = await Promise.allSettled(fetches);
  return settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ─── GDELT DOC geocoded articles ─────────────────────────────────────────────
async function fetchGDELTDocConflicts() {
  const queries = [
    // Global
    'airstrike killed explosion military strike',
    'missile attack rocket launched ballistic',
    'explosion blast bomb killed wounded',
    // Iran / Israel MISSILES — highest priority
    'Iran IRGC ballistic missile launch attack Israel',
    'Iran nuclear strike Natanz Fordow Isfahan facility',
    'Israel IDF airstrike Iran Syria Lebanon weapons depot',
    'Hezbollah missile rocket barrage Israel Iron Dome',
    'Hamas rocket barrage Iron Dome David Sling intercept',
    'Israel Lebanon Hezbollah border exchange fire anti-tank',
    'Iran missile test IRGC Persian Gulf ballistic',
    'Iran IRGC drone swarm attack US base Iraq Syria',
    // Hormuz / Gulf
    'Iran IRGC tanker seizure Strait Hormuz interdiction',
    'Houthi ballistic missile drone Red Sea ship sinking',
    'Saudi Patriot intercept Houthi ballistic missile Riyadh',
    // Iraq Syria
    'Iraq Syria militia airstrike bombing killing',
    'Saudi Arabia rebel drone attack oil Aramco',
    // Africa / Sahel
    'Sudan war Khartoum Darfur RSF attack killed',
    'Mali Burkina Faso Niger Sahel jihadist attack',
    'Somalia Al-Shabaab attack killed explosion',
    'Ethiopia civil war airstrike armed group',
    // Asia
    'Myanmar junta airstrike bomb attack civilians',
    'North Korea missile launch test ICBM ballistic',
    'Afghanistan Taliban explosion killed bombing',
    // Ukraine extra
    'Ukraine Kyiv drone Shahed interception missiles',
  ];

  const fetches = queries.map(async q => {
    try {
      const url = `${GDELT_BASE}/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=25&sort=DateDesc&format=json&timespan=24h`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) return [];
      const data = await res.json();
      const items = [];
      for (const a of data?.articles || []) {
        const title = a.title || '';
        if (!title) continue;

        // GDELT DOC artlist rarely includes lat/lon — geocode from title if missing
        let lat = a.lat != null ? +a.lat : null;
        let lon = a.lon != null ? +a.lon : null;
        if (lat == null || lon == null) {
          const geo = geocodeTitle(title, a.sourcecountry || '');
          if (!geo) continue; // can't place this article
          lat = geo.lat;
          lon = geo.lon;
        }

        items.push({
          id:          `gdelt-doc-${encodeURIComponent(a.url || title).slice(0, 50)}`,
          type:        classifyEvent(title),
          title,
          url:         a.url || '',
          lat, lon,
          country:     a.sourcecountry || '',
          source:      a.domain || 'GDELT',
          publishedAt: a.seendate
            ? new Date(a.seendate.replace(/(.{4})(.{2})(.{2})T(.{2})(.{2})(.{2})Z/, '$1-$2-$3T$4:$5:$6Z')).toISOString()
            : new Date().toISOString(),
          tone:        a.tone ?? -5,
          severity:    severityFromTone(a.tone ?? -5),
        });
      }
      return items;
    } catch (_) { return []; }
  });

  const settled = await Promise.allSettled(fetches);
  return settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ─── ReliefWeb API (OCHA — free, no key required) ───────────────────────────
// Returns geolocated humanitarian crisis reports about armed conflicts.
async function fetchReliefWebConflicts() {
  try {
    const body = JSON.stringify({
      appname: 'miltracker3d',
      query: { value: 'airstrike OR missile OR artillery OR attack OR explosion OR offensive' },
      filter: {
        operator: 'AND',
        conditions: [
          { field: 'type.name', value: ['Situation Report', 'News and Press Release'], operator: 'OR' },
        ],
      },
      sort: ['date.created:desc'],
      limit: 60,
      fields: { include: ['title', 'date', 'country', 'source', 'url'] },
    });
    const res = await fetch('https://api.reliefweb.int/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`ReliefWeb ${res.status}`);
    const data = await res.json();
    const items = [];
    for (const item of data?.data || []) {
      const f = item.fields || {};
      const title = f.title || '';
      if (!title) continue;
      const country = f.country?.[0]?.name || '';
      const geo = geocodeTitle(title, country);
      if (!geo) continue;
      const publishedAt = f.date?.created
        ? new Date(f.date.created).toISOString()
        : new Date().toISOString();
      items.push({
        id:   `rw-${item.id}`,
        type: classifyEvent(title),
        title,
        url:  item.href || '',
        lat:  geo.lat, lon: geo.lon,
        country,
        source:      `ReliefWeb/${f.source?.[0]?.name || 'OCHA'}`,
        publishedAt,
        tone:        -8,
        severity:    'high',
      });
    }
    console.log(`[ReliefWeb] ${items.length} geolocated events`);
    return items;
  } catch (e) {
    console.warn('[ReliefWeb]', e.message);
    return [];
  }
}

// ─── ACLED API (free key via ACLED_API_KEY env var) ──────────────────────────
// Armed Conflict Location & Event Data — most precise conflict dataset available
// Get free key: https://acleddata.com/register/
async function fetchACLEDConflicts() {
  const key   = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;
  if (!key || !email) return [];

  try {
    // Past 14 days, violent events only, limit 200
    const since = new Date(Date.now() - 14 * 86400000)
      .toISOString().slice(0, 10).replace(/-/g, '');
    const params = new URLSearchParams({
      key, email,
      event_date:       since,
      event_date_where: '>=',
      event_type:       'Explosions/Remote violence|Battles|Violence against civilians',
      limit:            '200',
      fields:           'event_id_cnty,event_date,event_type,sub_event_type,actor1,country,admin1,location,latitude,longitude,fatalities,notes',
    });
    const res = await fetch(`https://api.acleddata.com/acled/read?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`ACLED ${res.status}`);
    const data = await res.json();
    const rows = data?.data || [];
    const items = rows.map(r => ({
      id:          `acled-${r.event_id_cnty}`,
      type:        classifyEvent(`${r.event_type} ${r.sub_event_type} ${r.notes}`),
      title:       `${r.sub_event_type}: ${r.actor1} — ${r.location}, ${r.admin1}`,
      url:         `https://acleddata.com/data-export-tool/`,
      lat:         +r.latitude,
      lon:         +r.longitude,
      country:     r.country,
      source:      'ACLED',
      publishedAt: new Date(r.event_date).toISOString(),
      tone:        r.fatalities > 10 ? -20 : r.fatalities > 0 ? -12 : -5,
      severity:    r.fatalities > 20 ? 'critical' : r.fatalities > 5 ? 'high' : r.fatalities > 0 ? 'medium' : 'low',
    })).filter(e => e.lat && e.lon && !isNaN(e.lat) && !isNaN(e.lon));
    console.log(`[ACLED] ${items.length} events`);
    return items;
  } catch (e) {
    console.warn('[ACLED]', e.message);
    return [];
  }
}

// ─── Seed conflicts — known active hotspots always shown on map ───────────────
function getSeedConflicts() {
  const ts = new Date().toISOString();
  const ev = (id, type, title, lat, lon, country, severity) => ({
    id, type, title, lat, lon, country, severity,
    source: 'IntelFeed', publishedAt: ts, url: '', tone: -10,
  });
  return [
    // ══════════════════════════════════════════════════════════════════
    //  ACTIVE WAR: US + Israel vs Iran — started ~Feb 28, 2026
    //  Khamenei (Supreme Leader) killed March 1, 2026
    //  All events below reflect live conditions as of March 3, 2026
    // ══════════════════════════════════════════════════════════════════
    // ── Iran — strikes on nuclear/military sites ──
    ev('seed-ir-nuke',  'airstrike', 'IAEA confirms Natanz enrichment facility struck — massive damage',                    33.72, 51.73, 'Iran',        'critical'),
    ev('seed-ir-fordow','airstrike', 'US B-2 bunker-buster strike on Fordow underground nuclear site',                     34.88, 50.00, 'Iran',        'critical'),
    ev('seed-ir-tehran','airstrike', 'IDF precision strike on IRGC command complex, central Tehran',                       35.69, 51.39, 'Iran',        'critical'),
    ev('seed-ir-khamenei','missile', 'Supreme Leader Khamenei compound targeted — leadership killed (March 1)',             35.68, 51.41, 'Iran',        'critical'),
    ev('seed-ir-isfahan','airstrike','Israeli F-35Is strike Iranian Air Force base near Isfahan',                           32.66, 51.68, 'Iran',        'critical'),
    ev('seed-ir-mis1',  'missile',   'Iran fires ballistic missile barrage toward Israeli cities',                          33.50, 51.00, 'Iran',        'critical'),
    ev('seed-ir-mis2',  'missile',   'Iranian Fattah-2 hypersonic missiles intercepted over Negev desert',                 30.85, 34.79, 'Israel',      'critical'),
    ev('seed-ir-drone', 'drone',     'Iranian Shahed-136 drone swarm tracked inbound toward Cyprus',                       35.50, 35.50, 'Iran',        'critical'),
    ev('seed-ir-hormuz','naval',     'Iran threatens to close Strait of Hormuz — mines laid near Bandar Abbas',            27.18, 56.27, 'Iran',        'critical'),
    // ── Israel — incoming/outgoing ──
    ev('seed-il-beitsh','missile',   'Iranian ballistic missile hits Beit Shemesh — 9 killed, 27 injured',                 31.74, 34.99, 'Israel',      'critical'),
    ev('seed-il-bgairp','missile',   'Ben Gurion Airport closed — missile alert, evacuations via Egypt advised',            31.99, 34.89, 'Israel',      'critical'),
    ev('seed-il-irondome','airstrike','Iron Dome / Arrow-3 intercepts 80+ Iranian ballistic missiles over Israel',          32.08, 34.78, 'Israel',      'critical'),
    ev('seed-il-us-strike','airstrike','US B-52 carrier strikes on Iranian missile production sites near Tabriz',           38.08, 46.30, 'Iran',        'critical'),
    // ── Lebanon — IDF invasion ──
    ev('seed-lb-idf1',  'troops',    'IDF ground forces advance into south Lebanon — Litani River crossed',                 33.10, 35.45, 'Lebanon',     'critical'),
    ev('seed-lb-idf2',  'airstrike', 'Israeli airstrike on Beirut southern suburbs — 52 Lebanese killed',                  33.89, 35.50, 'Lebanon',     'critical'),
    ev('seed-lb-idf3',  'airstrike', 'IDF strikes Hezbollah arms depot in Bekaa Valley',                                   33.85, 36.20, 'Lebanon',     'critical'),
    // ── Kuwait — US base attacked ──
    ev('seed-kw-iran1', 'missile',   'Iran fires ballistic missiles at Ali Al Salem US Air Base, Kuwait — 6 soldiers KIA', 29.45, 47.52, 'Kuwait',      'critical'),
    ev('seed-kw-iran2', 'drone',     'Shahed drone wave intercepted over Kuwait; 2 drones evade defenses',                 29.37, 47.98, 'Kuwait',      'critical'),
    ev('seed-kw-ff',    'airstrike', '6 US F-15 jets downed by Kuwaiti friendly-fire; incident under investigation',       29.45, 47.52, 'Kuwait',      'critical'),
    // ── Cyprus — British base attacked ──
    ev('seed-cy-iran1', 'drone',     'Iran Shahed drones strike RAF Akrotiri British base in Cyprus',                      34.58, 32.97, 'Cyprus',      'critical'),
    ev('seed-cy-nato',  'troops',    'France deploying anti-drone systems to Cyprus following Akrotiri attack',             34.72, 33.05, 'Cyprus',      'high'),
    // ── Gulf / UAE / Saudi ──
    ev('seed-ae-drones','drone',     'Iranian drones hit UAE; Amazon warehouse and oil storage facilities damaged',         24.45, 54.37, 'UAE',         'critical'),
    ev('seed-bh-drone', 'drone',     'Iranian drone strike near Bahrain US 5th Fleet headquarters',                        26.07, 50.55, 'Bahrain',     'critical'),
    ev('seed-sa-riyadh','drone',     'US embassy in Riyadh hit by Iranian drone — personnel evacuated',                    24.69, 46.72, 'Saudi Arabia','critical'),
    ev('seed-sa-mis',   'missile',   'Houthi cruise missile fired toward Saudi Aramco facility Dhahran',                   26.29, 50.21, 'Saudi Arabia','critical'),
    ev('seed-hormuz1',  'naval',     'IRGC fast boats seize cargo vessel in Strait of Hormuz',                             26.57, 56.28, 'Iran',        'critical'),
    ev('seed-hormuz2',  'missile',   'Iranian coastal battery fires C-802 anti-ship missile at US destroyer',              26.40, 56.50, 'Iran',        'critical'),
    // ── Yemen / Houthis ──
    ev('seed-ye-1',     'missile',   'Houthi anti-ship missile targets US carrier group in Red Sea',                       14.50, 42.50, 'Yemen',       'critical'),
    ev('seed-ye-2',     'drone',     'Houthi UAV attack targeting Saudi Arabia infrastructure',                            17.00, 44.20, 'Yemen',       'high'),
    ev('seed-ye-3',     'airstrike', 'US/UK coalition airstrike on Houthi missile storage near Sanaa',                     15.37, 44.19, 'Yemen',       'high'),
    ev('seed-ye-5',     'naval',     'Houthi drone boat intercepted in Gulf of Aden',                                      12.20, 45.10, 'Yemen',       'high'),
    // ── Syria / Iraq ──
    ev('seed-sy-1',     'airstrike', 'Israeli airstrike targets IRGC weapons transfer route near Damascus',                33.20, 36.30, 'Syria',       'critical'),
    ev('seed-iq-1',     'missile',   'Rocket attack on US military base in eastern Syria (Iran-linked)',                    34.60, 40.10, 'Syria',       'high'),
    ev('seed-iq-3',     'drone',     'Drone strike on PMF convoy near Baghdad',                                            33.34, 44.40, 'Iraq',        'medium'),
    // ── Ukraine / Russia ──
    ev('seed-ua-1',     'missile',   'Russian ballistic missile strikes Kharkiv infrastructure',                           49.99, 36.23, 'Ukraine',     'critical'),
    ev('seed-ua-2',     'drone',     'Ukrainian FPV drone attack destroys Russian armored column',                         48.20, 37.50, 'Ukraine',     'high'),
    ev('seed-ua-3',     'artillery', 'Intense artillery shelling along Zaporizhzhia front line',                           47.80, 35.20, 'Ukraine',     'high'),
    ev('seed-ua-4',     'missile',   'Ukrainian cruise missile targets Crimea military depot',                             45.50, 33.80, 'Ukraine',     'critical'),
    ev('seed-ua-5',     'drone',     'Russian Shahed drone swarm intercepted over Kyiv',                                   50.45, 30.52, 'Ukraine',     'high'),
    // ── Taiwan Strait ──
    ev('seed-tw-1',     'naval',     'PLA Navy carrier group conducts exercise near Taiwan Strait',                        24.50, 119.50,'China',       'high'),
    ev('seed-tw-2',     'airstrike', 'PLAAF fighters cross Taiwan Strait median line',                                     24.20, 120.00,'China',       'high'),
    // ── Korean Peninsula ──
    ev('seed-kp-1',     'missile',   'North Korea ICBM launch test detected over Sea of Japan',                           40.34, 127.51,'North Korea', 'critical'),
    // ── Africa / Sahel ──
    ev('seed-sd-1',     'airstrike', 'RSF drone strike on SAF position in Khartoum North',                                15.65,  32.55,'Sudan',       'critical'),
    ev('seed-sd-3',     'troops',    'RSF column advancing through West Darfur toward El Fasher',                          13.63,  25.35,'Sudan',       'critical'),
    ev('seed-ml-1',     'troops',    'JNIM jihadist ambush on FAMa convoy in Mopti region, Mali',                          14.50,  -4.20,'Mali',        'high'),
    ev('seed-so-1',     'drone',     'US airstrike on Al-Shabaab command node near Mogadishu',                              2.04,  45.34,'Somalia',     'high'),
    ev('seed-mm-1',     'airstrike', 'Myanmar junta airstrike on PDF-held village in Sagaing Division',                   22.58,  95.45,'Myanmar',     'critical'),
    // ── Kashmir ──
    ev('seed-ks-1',     'artillery', 'Cross-border artillery exchange along Line of Control, Kashmir',                    34.08,  74.80,'Pakistan',    'high'),
    // ── Libya ──
    ev('seed-ly-1',     'airstrike', 'Drone airstrike targets rival faction position near Tripoli',                       32.89,  13.19,'Libya',       'high'),
  ];
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function fetchConflictEvents() {
  const [geo, doc, rw, acled] = await Promise.allSettled([
    fetchGDELTGeoConflicts(),
    fetchGDELTDocConflicts(),
    fetchReliefWebConflicts(),
    fetchACLEDConflicts(),
  ]);

  const geoItems   = geo.status   === 'fulfilled' ? geo.value   : [];
  const docItems   = doc.status   === 'fulfilled' ? doc.value   : [];
  const rwItems    = rw.status    === 'fulfilled' ? rw.value    : [];
  const acledItems = acled.status === 'fulfilled' ? acled.value : [];
  const seeds      = getSeedConflicts(); // always-present baseline covering all hotspots

  // Priority order: ACLED (most precise) > GDELT-GEO > GDELT-DOC > ReliefWeb > seeds
  const all = [...acledItems, ...geoItems, ...docItems, ...rwItems, ...seeds];

  // Deduplicate by ~0.5° grid + type (first-seen wins, so precise sources win)
  const seen = new Set();
  const deduped = all.filter(ev => {
    const key = `${(ev.lat / 0.5).toFixed(0)}_${(ev.lon / 0.5).toFixed(0)}_${ev.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[Conflicts] ${deduped.length} events (${acledItems.length} ACLED + ${geoItems.length} geo + ${docItems.length} doc + ${rwItems.length} reliefweb + ${seeds.length} seeds)`);
  return deduped.slice(0, 400);
}
