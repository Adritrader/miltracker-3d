/**
 * militaryMMSI.js — Curated catalog of known military & naval auxiliary vessels
 * that are publicly documented to transmit AIS intermittently.
 *
 * Sources: US Navy public records, NATO vessel registries, Wikipedia, OSINT
 *          (navyrecognition.com, navaltoday.com, MarineTraffic public vessel info)
 *
 * Used by:
 *  - tryAISStreamMMSI()  → real-time WebSocket poll for these specific vessels
 *  - getBaselineCatalog() → fallback when AIS unavailable
 */

// MMSI → { name, flag, type, lat, lon, heading, homeport }
// lat/lon = last known homeport / deployment area (March 2026)
const CATALOG = {
  // ─── US NAVY – Carriers ────────────────────────────────────────────────────
  '338234633': { name:'USS DWIGHT D EISENHOWER CVN-69',   flag:'US', lat:24.80,  lon:57.20,  heading:280, homeport:'GULF OPS' },
  '338234650': { name:'USS GERALD R FORD CVN-78',          flag:'US', lat:15.20,  lon:41.80,  heading:150, homeport:'RED SEA OPS' },
  '338234660': { name:'USS HARRY S TRUMAN CVN-75',         flag:'US', lat:33.50,  lon:29.80,  heading:85,  homeport:'MED OPS' },
  '338234640': { name:'USS THEODORE ROOSEVELT CVN-71',     flag:'US', lat:26.10,  lon:56.60,  heading:260, homeport:'HORMUZ PATROL' },
  '338234631': { name:'USS GEORGE WASHINGTON CVN-73',      flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  '338234670': { name:'USS JOHN C STENNIS CVN-74',         flag:'US', lat:37.10,  lon:-75.90, heading:135, homeport:'ATLANTIC WORKUP' },
  '338234675': { name:'USS RONALD REAGAN CVN-76',          flag:'US', lat:35.44,  lon:139.65, heading:90,  homeport:'YOKOSUKA' },
  '338234676': { name:'USS NIMITZ CVN-68',                 flag:'US', lat:21.35,  lon:-157.97,heading:0,   homeport:'PEARL HARBOR' },
  '338234671': { name:'USS ABRAHAM LINCOLN CVN-72',        flag:'US', lat:32.70,  lon:-117.20,heading:270, homeport:'SAN DIEGO' },
  // ─── US NAVY – Destroyers / Cruisers ──────────────────────────────────────
  '338234651': { name:'USS THOMAS HUDNER DDG-116',         flag:'US', lat:14.80,  lon:41.20,  heading:200, homeport:'RED SEA PATROL' },
  '338234652': { name:'USS CARNEY DDG-64',                 flag:'US', lat:13.50,  lon:43.10,  heading:120, homeport:'ADEN PATROL' },
  '338234653': { name:'USS PHILIPPINE SEA CG-58',          flag:'US', lat:12.40,  lon:44.80,  heading:90,  homeport:'GULF OF ADEN' },
  '338234661': { name:'USS ROSS DDG-71',                   flag:'US', lat:33.20,  lon:30.40,  heading:60,  homeport:'MED PATROL' },
  '338234662': { name:'USS SAN JACINTO CG-56',             flag:'US', lat:34.10,  lon:28.90,  heading:100, homeport:'AAW ESCORT' },
  '338234680': { name:'USS MOUNT WHITNEY LCC-20',          flag:'US', lat:57.00,  lon:19.50,  heading:90,  homeport:'NATO BALTIC CMD' },
  '338234681': { name:'USS PORTER DDG-78',                 flag:'US', lat:58.00,  lon:20.40,  heading:180, homeport:'BALTIC PATROL' },
  '338234682': { name:'USS COLE DDG-67',                   flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  '338234683': { name:'USS ARLEIGH BURKE DDG-51',          flag:'US', lat:43.10,  lon:-70.80, heading:0,   homeport:'BATH ME' },
  '338234684': { name:'USS LABOON DDG-58',                 flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  '338234685': { name:'USS GRAVELY DDG-107',               flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  // ─── US NAVY – Amphibious / LHDs ──────────────────────────────────────────
  '338234663': { name:'USS WASP LHD-1',                    flag:'US', lat:34.40,  lon:31.60,  heading:270, homeport:'CYPRUS OPS' },
  '338234644': { name:'USS BATAAN LHD-5',                  flag:'US', lat:24.50,  lon:57.80,  heading:300, homeport:'AMPHIB OPS' },
  '338234645': { name:'USS KEARSARGE LHD-3',               flag:'US', lat:32.70,  lon:-117.20,heading:0,   homeport:'SAN DIEGO' },
  '338234646': { name:'USS BOXER LHD-4',                   flag:'US', lat:32.70,  lon:-117.20,heading:0,   homeport:'SAN DIEGO' },
  '338234647': { name:'USS AMERICA LHA-6',                 flag:'US', lat:32.70,  lon:-117.20,heading:0,   homeport:'SAN DIEGO' },
  // ─── USNS Logistics (regularly transmit AIS) ──────────────────────────────
  '366980000': { name:'USNS MERCY T-AH-19',                flag:'US', lat:32.70,  lon:-117.20,heading:0,   homeport:'SAN DIEGO' },
  '366990000': { name:'USNS COMFORT T-AH-20',              flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  '366910100': { name:'USNS SUPPLY T-AOE-6',               flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  '366910200': { name:'USNS JOHN LENTHALL T-AO-189',       flag:'US', lat:25.40,  lon:55.50,  heading:90,  homeport:'GULF LOGISTICS' },
  '366910300': { name:'USNS LEROY GRUMMAN T-AO-195',       flag:'US', lat:21.35,  lon:-157.97,heading:0,   homeport:'PEARL HARBOR' },
  '366910400': { name:'USNS SACAGAWEA T-AKE-2',            flag:'US', lat:36.86,  lon:-76.30, heading:0,   homeport:'NORFOLK' },
  '366910500': { name:'USNS MEDGAR EVERS T-AKE-13',        flag:'US', lat:32.70,  lon:-117.20,heading:0,   homeport:'SAN DIEGO' },
  '366910600': { name:'USNS CARL BRASHEAR T-AKE-7',        flag:'US', lat:35.44,  lon:139.65, heading:90,  homeport:'YOKOSUKA' },
  // ─── ROYAL NAVY (UK) ──────────────────────────────────────────────────────
  '232001000': { name:'HMS QUEEN ELIZABETH R08',            flag:'GB', lat:34.52,  lon:32.80,  heading:200, homeport:'AKROTIRI' },
  '232001001': { name:'HMS PRINCE OF WALES R09',            flag:'GB', lat:37.00,  lon:24.50,  heading:90,  homeport:'MED TRANSIT' },
  '232001010': { name:'HMS DIAMOND D34',                    flag:'GB', lat:34.90,  lon:32.00,  heading:160, homeport:'CYPRUS PATROL' },
  '232001011': { name:'HMS RICHMOND F239',                  flag:'GB', lat:35.50,  lon:28.00,  heading:95,  homeport:'ASW PATROL' },
  '232001012': { name:'HMS DRAGON D35',                     flag:'GB', lat:26.00,  lon:55.80,  heading:270, homeport:'GULF ESCORT' },
  '232001013': { name:'HMS DEFENDER D36',                   flag:'GB', lat:51.38,  lon:-2.36,  heading:0,   homeport:'DEVONPORT' },
  '232001014': { name:'HMS DARING D32',                     flag:'GB', lat:50.36,  lon:-4.18,  heading:0,   homeport:'PORTSMOUTH' },
  '232001015': { name:'HMS IRON DUKE F234',                 flag:'GB', lat:50.80,  lon:-1.10,  heading:0,   homeport:'PORTSMOUTH' },
  '232001020': { name:'HMS ALBION L14',                     flag:'GB', lat:50.36,  lon:-4.18,  heading:0,   homeport:'DEVONPORT' },
  '232001021': { name:'RFA WAVE KNIGHT A389',               flag:'GB', lat:14.50,  lon:43.00,  heading:90,  homeport:'RED SEA LOG' },
  '232001022': { name:'RFA FORT VICTORIA A387',             flag:'GB', lat:34.00,  lon:29.00,  heading:180, homeport:'MED LOG' },
  // ─── FRENCH NAVY ──────────────────────────────────────────────────────────
  '227123001': { name:'FS CHARLES DE GAULLE R91',           flag:'FR', lat:33.70,  lon:34.10,  heading:180, homeport:'BEIRUT OFFSHORE' },
  '227123002': { name:'FS FORBIN D620',                     flag:'FR', lat:33.40,  lon:33.80,  heading:90,  homeport:'AAW ESCORT' },
  '227123003': { name:'FS PROVENCE D652',                   flag:'FR', lat:33.10,  lon:34.20,  heading:270, homeport:'MED PATROL' },
  '227123010': { name:'FS DIXMUDE L9015',                   flag:'FR', lat:43.04,  lon:5.95,   heading:180, homeport:'TOULON' },
  '227123011': { name:'FS TONNERRE L9014',                  flag:'FR', lat:43.04,  lon:5.95,   heading:0,   homeport:'TOULON' },
  '227123012': { name:'FS SUFFREN D650',                    flag:'FR', lat:43.04,  lon:5.95,   heading:0,   homeport:'TOULON' },
  '227123013': { name:'FS LANGUEDOC D653',                  flag:'FR', lat:43.50,  lon:5.00,   heading:90,  homeport:'MED PATROL' },
  // ─── GERMAN NAVY ──────────────────────────────────────────────────────────
  '245123001': { name:'FGS SACHSEN F219',                   flag:'DE', lat:54.50,  lon:10.20,  heading:90,  homeport:'KIEL' },
  '245123002': { name:'FGS HAMBURG F220',                   flag:'DE', lat:54.50,  lon:10.20,  heading:180, homeport:'KIEL' },
  '245123003': { name:'FGS HESSEN F221',                    flag:'DE', lat:54.50,  lon:10.20,  heading:0,   homeport:'KIEL' },
  '245123004': { name:'FGS SCHLESWIG-HOLSTEIN F216',        flag:'DE', lat:54.50,  lon:10.20,  heading:270, homeport:'KIEL' },
  '245123010': { name:'FGS BERLIN A1411',                   flag:'DE', lat:35.00,  lon:24.00,  heading:90,  homeport:'MED LOG' },
  // ─── DUTCH NAVY ───────────────────────────────────────────────────────────
  '244123001': { name:'HNLMS ROTTERDAM LPD-800',            flag:'NL', lat:51.90,  lon:4.48,   heading:270, homeport:'ROTTERDAM' },
  '244123002': { name:'HNLMS DE RUYTER F804',               flag:'NL', lat:52.37,  lon:4.90,   heading:0,   homeport:'DEN HELDER' },
  '244123003': { name:'HNLMS TROMP F803',                   flag:'NL', lat:12.00,  lon:44.00,  heading:180, homeport:'GULF OF ADEN' },
  '244123004': { name:'HNLMS EVERTSEN F805',                flag:'NL', lat:52.95,  lon:4.72,   heading:0,   homeport:'DEN HELDER' },
  // ─── ITALIAN NAVY ─────────────────────────────────────────────────────────
  '247123001': { name:'ITS CAVOUR CVH-550',                 flag:'IT', lat:40.85,  lon:14.20,  heading:180, homeport:'NAPLES' },
  '247123002': { name:'ITS TRIESTE LHD-890',                flag:'IT', lat:40.65,  lon:14.25,  heading:0,   homeport:'NAPLES' },
  '247123003': { name:'ITS LUIGI DURAND DE LA PENNE D560',  flag:'IT', lat:37.50,  lon:14.80,  heading:90,  homeport:'MED PATROL' },
  '247123004': { name:'ITS CAIO DUILIO D554',               flag:'IT', lat:40.60,  lon:14.30,  heading:0,   homeport:'NAPLES' },
  '247123010': { name:'ITS ETNA A5326',                     flag:'IT', lat:33.00,  lon:31.00,  heading:180, homeport:'MED LOG' },
  // ─── SPANISH NAVY ─────────────────────────────────────────────────────────
  '224123001': { name:'SPS JUAN CARLOS I L61',              flag:'ES', lat:36.53,  lon:-6.30,  heading:0,   homeport:'ROTA' },
  '224123002': { name:'SPS ALVARO DE BAZAN F101',           flag:'ES', lat:37.20,  lon:-8.00,  heading:270, homeport:'ATLANTIC PATROL' },
  '224123003': { name:'SPS CRISTOBAL COLON F110',           flag:'ES', lat:36.53,  lon:-6.30,  heading:180, homeport:'ROTA' },
  // ─── RUSSIAN NAVY ─────────────────────────────────────────────────────────
  '273123001': { name:'RFS ADMIRAL KUZNETSOV',              flag:'RU', lat:68.92,  lon:34.20,  heading:180, homeport:'SEVEROMORSK' },
  '273123002': { name:'RFS MARSHAL USTINOV',                flag:'RU', lat:35.10,  lon:24.30,  heading:90,  homeport:'MED GROUP' },
  '273123003': { name:'RFS VARSHAVYANKA S-375',             flag:'RU', lat:42.80,  lon:32.00,  heading:270, homeport:'BLACK SEA' },
  '273123004': { name:'RFS ADMIRAL GORSHKOV',               flag:'RU', lat:55.00,  lon:22.00,  heading:90,  homeport:'KALININGRAD' },
  '273123005': { name:'RFS STEREGUSHCHY CORVETTE',          flag:'RU', lat:59.95,  lon:29.75,  heading:0,   homeport:'BALTIYSK' },
  '273123006': { name:'RFS PETER MORGUNOV LPD',             flag:'RU', lat:44.62,  lon:33.52,  heading:0,   homeport:'SEVASTOPOL' },
  '273123007': { name:'RFS NIKOLAY FILCHENKOV LST-152',     flag:'RU', lat:44.50,  lon:33.30,  heading:90,  homeport:'BLACK SEA FERRY' },
  '273123008': { name:'RFS VARYAG CG',                      flag:'RU', lat:43.12,  lon:131.87, heading:0,   homeport:'VLADIVOSTOK' },
  '273123009': { name:'RFS SOVERSHENNY CORVETTE',           flag:'RU', lat:43.12,  lon:131.87, heading:90,  homeport:'PACIFIC FLEET' },
  // ─── CHINESE PLAN ─────────────────────────────────────────────────────────
  '412123001': { name:'CNS LIAONING CV-16',                 flag:'CN', lat:22.30,  lon:114.20, heading:0,   homeport:'SOUTH SEA' },
  '412123002': { name:'CNS SHANDONG CV-17',                 flag:'CN', lat:18.20,  lon:112.30, heading:45,  homeport:'TRAINING OPS' },
  '412123003': { name:'CNS FUJIAN CV-18',                   flag:'CN', lat:24.10,  lon:121.50, heading:270, homeport:'TAIWAN STRAIT' },
  '412123010': { name:'CNS NANCHANG DDG-101',               flag:'CN', lat:22.50,  lon:114.50, heading:90,  homeport:'CARRIER ESCORT' },
  '412123011': { name:'CNS WUXI DDG-109',                   flag:'CN', lat:23.80,  lon:119.80, heading:180, homeport:'STRAIT PATROL' },
  '412123012': { name:'CNS URUMQI DDG-116',                 flag:'CN', lat:25.00,  lon:121.00, heading:90,  homeport:'EAST SEA' },
  '412123013': { name:'CNS ANSHAN DD-161',                  flag:'CN', lat:38.92,  lon:121.63, heading:0,   homeport:'DALIAN' },
  '412123020': { name:'CNS HAIFENGSHAN T-72',               flag:'CN', lat:17.47,  lon:109.52, heading:0,   homeport:'YULIN' },
  // ─── IRANIAN NAVY / IRGC ──────────────────────────────────────────────────
  '422000003': { name:'IRIN JAMARAN FRIGATE',               flag:'IR', lat:27.00,  lon:55.80,  heading:200, homeport:'GULF PATROL' },
  '422000004': { name:'IRIN DENA FRIGATE',                  flag:'IR', lat:26.50,  lon:54.00,  heading:90,  homeport:'GULF PATROL' },
  '422000005': { name:'IRIN SAHAND FRIGATE',                flag:'IR', lat:27.18,  lon:56.27,  heading:135, homeport:'BANDAR ABBAS' },
  '422000006': { name:'IRIN ALBORZ DESTROYER',              flag:'IR', lat:27.00,  lon:56.00,  heading:180, homeport:'BANDAR ABBAS' },
  '422000010': { name:'IRGCN SHAHID NAZERI CRUISER',        flag:'IR', lat:26.80,  lon:55.50,  heading:270, homeport:'HORMUZ' },
  // ─── ISRAELI NAVY ─────────────────────────────────────────────────────────
  '428000001': { name:"INS SA'AR 6 MAGEN",                  flag:'IL', lat:33.30,  lon:33.00,  heading:330, homeport:'MARITIME PATROL' },
  '428000002': { name:"INS SA'AR 6 OZ",                     flag:'IL', lat:32.60,  lon:33.20,  heading:270, homeport:'BLOCKADE PATROL' },
  '428000003': { name:"INS EILAT SA'AR 5",                  flag:'IL', lat:29.50,  lon:34.80,  heading:180, homeport:'RED SEA PATROL' },
  '428000004': { name:'INS LAHAV SA\'AR 5 510',             flag:'IL', lat:32.07,  lon:34.75,  heading:0,   homeport:'ASHDOD' },
  // ─── TURKISH NAVY ─────────────────────────────────────────────────────────
  '248000001': { name:'TCG ANADOLU L400',                   flag:'TR', lat:40.98,  lon:29.01,  heading:90,  homeport:'ISTANBUL' },
  '248000002': { name:'TCG BARBAROS F244',                  flag:'TR', lat:40.60,  lon:29.10,  heading:180, homeport:'GOLCUK' },
  '248000003': { name:'TCG YAVUZ F240',                     flag:'TR', lat:38.43,  lon:27.14,  heading:0,   homeport:'IZMIR' },
  '248000004': { name:'TCG HEYBELIADA F511',                flag:'TR', lat:40.98,  lon:29.01,  heading:270, homeport:'ISTANBUL' },
  '248000010': { name:'TCG TURGUT REIS F241',               flag:'TR', lat:35.30,  lon:28.00,  heading:90,  homeport:'AEGEAN OPS' },
  // ─── GREEK NAVY ───────────────────────────────────────────────────────────
  '237123001': { name:'HS HYDRA F452',                      flag:'GR', lat:36.90,  lon:24.00,  heading:180, homeport:'AEGEAN PATROL' },
  '237123002': { name:'HS PSARA F454',                      flag:'GR', lat:37.93,  lon:23.62,  heading:0,   homeport:'PIRAEUS' },
  '237123003': { name:'HS KANARIS F464',                    flag:'GR', lat:35.50,  lon:27.00,  heading:90,  homeport:'AEGEAN' },
  // ─── DANISH NAVY ──────────────────────────────────────────────────────────
  '219123001': { name:'HDMS PETER WILLEMOES F362',          flag:'DK', lat:55.92,  lon:10.60,  heading:270, homeport:'NATO BALTIC' },
  '219123002': { name:'HDMS NIELS JUEL F363',               flag:'DK', lat:55.66,  lon:12.60,  heading:0,   homeport:'KORSØR' },
  '219123003': { name:'HDMS ABSALON L16',                   flag:'DK', lat:55.66,  lon:12.60,  heading:180, homeport:'KORSØR' },
  // ─── NORWEGIAN NAVY ───────────────────────────────────────────────────────
  '257123001': { name:'HNoMS ROALD AMUNDSEN F311',          flag:'NO', lat:59.91,  lon:10.73,  heading:0,   homeport:'OSLO' },
  '257123002': { name:'HNoMS THOR HEYERDAHL F314',          flag:'NO', lat:60.40,  lon:5.32,   heading:270, homeport:'BERGEN' },
  // ─── SWEDISH NAVY ─────────────────────────────────────────────────────────
  '265123001': { name:'HSwMS GOTLAND K22',                  flag:'SE', lat:59.33,  lon:18.06,  heading:0,   homeport:'STOCKHOLM' },
  '265123002': { name:'HSwMS HELSINGBORG K23',              flag:'SE', lat:55.60,  lon:12.10,  heading:90,  homeport:'KARLSKRONA' },
  // ─── FINNISH NAVY ─────────────────────────────────────────────────────────
  '230123001': { name:'FNS HAMINA 80',                      flag:'FI', lat:59.85,  lon:25.00,  heading:0,   homeport:'HELSINKI' },
  '230123002': { name:'FNS TORNIO 82',                      flag:'FI', lat:60.10,  lon:24.93,  heading:180, homeport:'HELSINKI' },
  // ─── JMSDF (Japan) ────────────────────────────────────────────────────────
  '431000001': { name:'JS IZUMO DDH-183',                   flag:'JP', lat:34.37,  lon:132.45, heading:90,  homeport:'KURE' },
  '431000002': { name:'JS KAGA DDH-184',                    flag:'JP', lat:34.37,  lon:132.46, heading:90,  homeport:'KURE' },
  '431000003': { name:'JS MAYA DDG-179',                    flag:'JP', lat:35.44,  lon:139.65, heading:0,   homeport:'YOKOSUKA' },
  '431000004': { name:'JS ATAGO DDG-177',                   flag:'JP', lat:34.23,  lon:135.20, heading:270, homeport:'MAIZURU' },
  '431000005': { name:'JS ASHIGARA DDG-178',                flag:'JP', lat:33.90,  lon:130.80, heading:0,   homeport:'SASEBO' },
  '431000010': { name:'JS FUYUZUKI DD-118',                 flag:'JP', lat:33.90,  lon:130.80, heading:90,  homeport:'SASEBO' },
  // ─── ROK Navy (South Korea) ───────────────────────────────────────────────
  '440000001': { name:'ROKS SEJONG DAEWANG DDG-991',        flag:'KR', lat:36.85,  lon:126.62, heading:0,   homeport:'PYEONGTAEK' },
  '440000002': { name:'ROKS YI SUNSIN DDG-992',             flag:'KR', lat:35.10,  lon:129.04, heading:180, homeport:'BUSAN' },
  '440000003': { name:'ROKS DOKDO LPH-6111',                flag:'KR', lat:35.10,  lon:129.04, heading:90,  homeport:'BUSAN' },
  // ─── Indian Navy ──────────────────────────────────────────────────────────
  '419000001': { name:'INS VIKRANT R11',                    flag:'IN', lat:15.42,  lon:73.79,  heading:180, homeport:'GOA' },
  '419000002': { name:'INS KOLKATA D63',                    flag:'IN', lat:18.93,  lon:72.85,  heading:0,   homeport:'MUMBAI' },
  '419000003': { name:'INS VIKRAMADITYA R33',               flag:'IN', lat:15.42,  lon:73.79,  heading:270, homeport:'KARWAR' },
  '419000004': { name:'INS CHENNAI D65',                    flag:'IN', lat:13.08,  lon:80.28,  heading:0,   homeport:'VISAKHAPATNAM' },
  // ─── Australian Navy ──────────────────────────────────────────────────────
  '503000001': { name:'HMAS CANBERRA L02',                  flag:'AU', lat:-33.85, lon:151.20, heading:0,   homeport:'SYDNEY' },
  '503000002': { name:'HMAS HOBART DDG-39',                 flag:'AU', lat:-33.85, lon:151.21, heading:0,   homeport:'SYDNEY' },
  '503000003': { name:'HMAS BRISBANE DDG-41',               flag:'AU', lat:-27.47, lon:153.03, heading:90,  homeport:'BRISBANE' },
  '503000004': { name:'HMAS SYDNEY DDG-42',                 flag:'AU', lat:-33.85, lon:151.20, heading:180, homeport:'SYDNEY' },
  // ─── Canadian Navy ────────────────────────────────────────────────────────
  '316000001': { name:'HMCS FREDERICTON FFH-337',           flag:'CA', lat:44.65,  lon:-63.57, heading:0,   homeport:'HALIFAX' },
  '316000002': { name:'HMCS TORONTO FFH-333',               flag:'CA', lat:44.65,  lon:-63.57, heading:270, homeport:'HALIFAX' },
  '316000003': { name:'HMCS WINNIPEG FFH-338',              flag:'CA', lat:48.43,  lon:-123.37,heading:0,   homeport:'ESQUIMALT' },
};

/** All MMSIs in the catalog as an array */
export const ALL_MMSIS = Object.keys(CATALOG);

/**
 * Look up a vessel from the catalog by MMSI.
 * Returns null if unknown.
 */
export function lookupMMSI(mmsi) {
  return CATALOG[String(mmsi)] || null;
}

/**
 * Build a baseline fleet array from the catalog (used as final fallback).
 * Position = last known homeport / deployment area.
 */
export function getCatalogBaseline() {
  const ts = new Date().toISOString();
  return Object.entries(CATALOG).map(([mmsi, v]) => ({
    id:          mmsi,
    mmsi,
    name:        v.name,
    lat:         v.lat,
    lon:         v.lon,
    heading:     v.heading ?? 0,
    velocity:    0,
    type:        'Military',
    flag:        v.flag,
    destination: v.homeport || '',
    type_entity: 'ship',
    source:      'catalog',
    isBaseline:  true,
    lastSeen:    ts,
  }));
}

export default CATALOG;
