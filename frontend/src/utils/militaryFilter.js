/**
 * Client-side military filtering and categorization logic
 */

// ── Country data: ISO-2 code → { name, emoji } ────────────────────────────
const COUNTRY_DATA = {
  US: { name: 'United States',   emoji: '🇺🇸' },
  GB: { name: 'United Kingdom',  emoji: '🇬🇧' },
  UK: { name: 'United Kingdom',  emoji: '🇬🇧' }, // alias
  FR: { name: 'France',          emoji: '🇫🇷' },
  DE: { name: 'Germany',         emoji: '🇩🇪' },
  RU: { name: 'Russia',          emoji: '🇷🇺' },
  CN: { name: 'China',           emoji: '🇨🇳' },
  IL: { name: 'Israel',          emoji: '🇮🇱' },
  TR: { name: 'Turkey',          emoji: '🇹🇷' },
  IR: { name: 'Iran',            emoji: '🇮🇷' },
  UA: { name: 'Ukraine',         emoji: '🇺🇦' },
  IN: { name: 'India',           emoji: '🇮🇳' },
  PK: { name: 'Pakistan',        emoji: '🇵🇰' },
  SA: { name: 'Saudi Arabia',    emoji: '🇸🇦' },
  AU: { name: 'Australia',       emoji: '🇦🇺' },
  JP: { name: 'Japan',           emoji: '🇯🇵' },
  KR: { name: 'South Korea',     emoji: '🇰🇷' },
  KP: { name: 'North Korea',     emoji: '🇰🇵' },
  BR: { name: 'Brazil',          emoji: '🇧🇷' },
  CA: { name: 'Canada',          emoji: '🇨🇦' },
  PL: { name: 'Poland',          emoji: '🇵🇱' },
  IT: { name: 'Italy',           emoji: '🇮🇹' },
  ES: { name: 'Spain',           emoji: '🇪🇸' },
  NL: { name: 'Netherlands',     emoji: '🇳🇱' },
  NO: { name: 'Norway',          emoji: '🇳🇴' },
  SE: { name: 'Sweden',          emoji: '🇸🇪' },
  BE: { name: 'Belgium',         emoji: '🇧🇪' },
  GR: { name: 'Greece',          emoji: '🇬🇷' },
  RO: { name: 'Romania',         emoji: '🇷🇴' },
  FI: { name: 'Finland',         emoji: '🇫🇮' },
  DK: { name: 'Denmark',         emoji: '🇩🇰' },
  PT: { name: 'Portugal',        emoji: '🇵🇹' },
  CY: { name: 'Cyprus',          emoji: '🇨🇾' },
  KW: { name: 'Kuwait',          emoji: '🇰🇼' },
  AE: { name: 'UAE',             emoji: '🇦🇪' },
  QA: { name: 'Qatar',           emoji: '🇶🇦' },
  BH: { name: 'Bahrain',         emoji: '🇧🇭' },
  JO: { name: 'Jordan',          emoji: '🇯🇴' },
  EG: { name: 'Egypt',           emoji: '🇪🇬' },
  LB: { name: 'Lebanon',         emoji: '🇱🇧' },
  SY: { name: 'Syria',           emoji: '🇸🇾' },
  IQ: { name: 'Iraq',            emoji: '🇮🇶' },
  YE: { name: 'Yemen',           emoji: '🇾🇪' },
  TW: { name: 'Taiwan',          emoji: '🇹🇼' },
  SG: { name: 'Singapore',       emoji: '🇸🇬' },
  MY: { name: 'Malaysia',        emoji: '🇲🇾' },
  TH: { name: 'Thailand',        emoji: '🇹🇭' },
  ID: { name: 'Indonesia',       emoji: '🇮🇩' },
  PH: { name: 'Philippines',     emoji: '🇵🇭' },
  VN: { name: 'Vietnam',         emoji: '🇻🇳' },
  NATO: { name: 'NATO',          emoji: '🔵' },
};

// Operator strings (ownOp field from ADS-B) → ISO-2 code
const OPERATOR_TO_CODE = {
  // USA
  'USAF':            'US', 'US AIR FORCE':    'US', 'UNITED STATES AIR FORCE': 'US',
  'USN':             'US', 'US NAVY':         'US', 'UNITED STATES NAVY':      'US',
  'USMC':            'US', 'US MARINE CORPS': 'US', 'USARMY':                  'US',
  'US ARMY':         'US', 'USCG':            'US', 'US COAST GUARD':          'US',
  'AFSOC':           'US', 'ACC':             'US', 'AMC':                     'US',
  'UNITED STATES':   'US',
  // UK
  'RAF':   'GB', 'ROYAL AIR FORCE': 'GB', 'RN': 'GB',
  'ROYAL NAVY': 'GB', 'AAC': 'GB', 'ARMY AIR CORPS': 'GB',
  'UNITED KINGDOM': 'GB',
  // France
  'FAF':  'FR', 'FRENCH AIR FORCE': 'FR', 'ARMEE DE L AIR': 'FR',
  'MARINE NATIONALE': 'FR', 'FRENCH NAVY': 'FR',
  // Germany
  'LUFTWAFFE': 'DE', 'GERMAN AIR FORCE': 'DE', 'BUNDESWEHR': 'DE',
  // Russia
  'VKS': 'RU', 'RUSSIAN AIR FORCE': 'RU', 'VMF': 'RU',
  'RUSSIAN NAVY': 'RU', 'RUSSIAN AEROSPACE': 'RU',
  // China
  'PLAAF': 'CN', 'PLAN': 'CN', 'PLA AIR FORCE': 'CN', 'PLA NAVY': 'CN',
  // Israel
  'IAF': 'IL', 'ISRAEL AIR FORCE': 'IL', 'IDF': 'IL',
  // Turkey
  'THK': 'TR', 'TURKISH AIR FORCE': 'TR',
  // Iran
  'IRIAF': 'IR', 'IRANIAN AIR FORCE': 'IR', 'IRGC': 'IR', 'IRIAF/IRGC': 'IR',
  // Saudi Arabia
  'RSAF': 'SA', 'ROYAL SAUDI AIR FORCE': 'SA',
  // Australia
  'RAAF': 'AU', 'ROYAL AUSTRALIAN AIR FORCE': 'AU',
  // Canada
  'RCAF': 'CA', 'ROYAL CANADIAN AIR FORCE': 'CA',
  // India
  'IAF IN': 'IN', 'INDIAN AIR FORCE': 'IN',
  // Japan
  'JASDF': 'JP', 'JMSDF': 'JP', 'JAPAN AIR SELF-DEFENSE FORCE': 'JP',
  // South Korea
  'ROKAF': 'KR', 'SOUTH KOREAN AIR FORCE': 'KR',
  // Italy
  'AMI': 'IT', 'ITALIAN AIR FORCE': 'IT',
  // Spain
  'EJERCITO DEL AIRE': 'ES', 'SPANISH AIR FORCE': 'ES',
  // Netherlands
  'RNLAF': 'NL', 'ROYAL NETHERLANDS AIR FORCE': 'NL',
  // Norway
  'RNoAF': 'NO', 'ROYAL NORWEGIAN AIR FORCE': 'NO',
  // Poland
  'POLISH AIR FORCE': 'PL',
  // NATO
  'NATO': 'NATO', 'NATO AWACS': 'NATO',
};

// Full country names → ISO-2 (for `origin_country` strings)
const NAME_TO_CODE = {};
for (const [code, { name }] of Object.entries(COUNTRY_DATA)) {
  NAME_TO_CODE[name.toUpperCase()] = code;
}
// Common aliases
NAME_TO_CODE['USA'] = 'US';
NAME_TO_CODE['RUSSIA'] = 'RU';
NAME_TO_CODE['CHINA'] = 'CN';
NAME_TO_CODE['IRAN'] = 'IR';
NAME_TO_CODE['UK'] = 'GB';
NAME_TO_CODE['SOUTH KOREA'] = 'KR';
NAME_TO_CODE['NORTH KOREA'] = 'KP';
NAME_TO_CODE['SAUDI ARABIA'] = 'SA';

/**
 * Resolve any country/operator string to { code, name, emoji }.
 * Returns unknown placeholder if nothing matches.
 */
export function resolveCountry(input = '') {
  if (!input) return { code: '??', name: 'Unknown', emoji: '🏳' };
  const upper = input.trim().toUpperCase();

  // 1. Direct ISO-2 code (e.g. flag field on ships)
  if (COUNTRY_DATA[upper]) {
    const d = COUNTRY_DATA[upper];
    return { code: upper, name: d.name, emoji: d.emoji };
  }
  // 2. Operator name
  if (OPERATOR_TO_CODE[upper]) {
    const code = OPERATOR_TO_CODE[upper];
    const d = COUNTRY_DATA[code];
    return { code, name: d?.name || code, emoji: d?.emoji || '🏳' };
  }
  // 3. Full country name
  if (NAME_TO_CODE[upper]) {
    const code = NAME_TO_CODE[upper];
    const d = COUNTRY_DATA[code];
    return { code, name: d?.name || input, emoji: d?.emoji || '🏳' };
  }
  // 4. Partial match in operator table
  for (const [key, code] of Object.entries(OPERATOR_TO_CODE)) {
    if (upper.includes(key) || key.includes(upper)) {
      const d = COUNTRY_DATA[code];
      return { code, name: d?.name || code, emoji: d?.emoji || '🏳' };
    }
  }
  // 5. Return as-is with white flag
  return { code: '??', name: input, emoji: '🏳' };
}

// Legacy exports kept for backward compatibility
export const COUNTRY_FLAGS = Object.fromEntries(
  Object.entries(COUNTRY_DATA).map(([, { name, emoji }]) => [name, emoji])
);

/**
 * Derive country name from ICAO24 hex prefix (military allocations).
 * Used as fallback when ownOp/origin_country is not set.
 * Returns ISO-2 code.
 */
export function icaoToCountry(hex = '') {
  const h = hex.toUpperCase();
  if (h.startsWith('AE') || h.startsWith('AD'))          return 'US';
  if (h.startsWith('43C') || h.startsWith('43D') || h.startsWith('43E')) return 'GB';
  if (h.startsWith('394') || h.startsWith('395') || h.startsWith('396')) return 'FR';
  if (h.startsWith('3C4') || h.startsWith('3C5') || h.startsWith('3C6') || h.startsWith('3C7')) return 'DE';
  if (h.startsWith('010') || h.startsWith('011') || h.startsWith('012') || h.startsWith('013') || h.startsWith('01')) return 'RU';
  if (h.startsWith('78')  || h.startsWith('79')  || h.startsWith('7A')  || h.startsWith('7B'))  return 'CN';
  if (h.startsWith('738') || h.startsWith('739')) return 'KR';
  if (h.startsWith('840') || h.startsWith('841')) return 'JP';
  if (h.startsWith('710') || h.startsWith('711')) return 'IN';
  if (h.startsWith('76C') || h.startsWith('76D')) return 'IL';
  if (h.startsWith('74C') || h.startsWith('74D')) return 'TR';
  if (h.startsWith('73C') || h.startsWith('73D')) return 'IR';
  if (h.startsWith('EB')  || h.startsWith('EC'))  return 'BE';
  if (h.startsWith('484') || h.startsWith('485')) return 'AU';
  if (h.startsWith('C0')  || h.startsWith('C1'))  return 'CA';
  return '';
}

/**
 * Human-readable names for ICAO aircraft type designators.
 * Covers the most common military types visible in ADS-B feeds.
 */
export const AIRCRAFT_TYPE_NAMES = {
  // US transports / tankers
  C17:  'C-17 Globemaster III',
  C5M:  'C-5M Super Galaxy',
  C5:   'C-5 Galaxy',
  C130: 'C-130 Hercules',
  C130J:'C-130J Super Hercules',
  KC135:'KC-135 Stratotanker',
  KC46: 'KC-46 Pegasus',
  C12:  'C-12 Huron',
  C21:  'C-21A Learjet',
  C32:  'C-32A (757 VIP)',
  C37:  'C-37 Gulfstream',
  C40:  'C-40 Clipper (737)',
  VC25: 'VC-25 Air Force One',
  // US bombers
  B52:  'B-52 Stratofortress',
  B1:   'B-1 Lancer',
  B2:   'B-2 Spirit',
  // US fighters/attack
  F15:  'F-15 Eagle',
  F16:  'F-16 Fighting Falcon',
  F18:  'F/A-18 Hornet',
  F35:  'F-35 Lightning II',
  A10:  'A-10 Thunderbolt II',
  F22:  'F-22 Raptor',
  // US ISR / special
  RC135:'RC-135 Rivet Joint',
  E3:   'E-3 Sentry (AWACS)',
  E8:   'E-8 JSTARS',
  U2:   'U-2 Dragon Lady',
  RQ4:  'RQ-4 Global Hawk',
  MQ9:  'MQ-9 Reaper',
  P8:   'P-8 Poseidon',
  EP3:  'EP-3 Aries',
  // US rotary
  V22:  'V-22 Osprey',
  UH60: 'UH-60 Black Hawk',
  CH47: 'CH-47 Chinook',
  AH64: 'AH-64 Apache',
  // European
  A400:'A400M Atlas',
  MRTT:'A330 MRTT Tanker',
  E145:'Embraer 145 (AEW)',
  F2:  'Rafale',
  EF:  'Eurofighter Typhoon',
  TPHR:'Typhoon',
  PA18:'PA-18 (Observation)',
  DO28:'Do-228 Maritime Patrol',
  // Russian
  IL76:'Il-76 Candid',
  IL78:'Il-78 Midas (tanker)',
  IL20:'Il-20 Coot-A (ISR)',
  TU95:'Tu-95 Bear',
  TU22:'Tu-22M Backfire',
  TU160:'Tu-160 Blackjack',
  SU27:'Su-27 Flanker',
  SU57:'Su-57 Felon',
  MIG31:'MiG-31 Foxhound',
  // Generic
  GLF5:'Gulfstream V',
  GLF6:'Gulfstream VI',
  F900:'Falcon 900',
  CL60:'Challenger 600',
};

/** Return human-readable aircraft type or the raw code if not found. */
export function getAircraftTypeName(code = '') {
  if (!code) return '';
  const upper = code.trim().toUpperCase();
  return AIRCRAFT_TYPE_NAMES[upper] || code.trim();
}

export const ALLIANCE_GROUPS = {
  NATO: ['United States', 'United Kingdom', 'France', 'Germany', 'Canada',
    'Italy', 'Spain', 'Netherlands', 'Norway', 'Poland', 'Turkey'],
  'Axis of Concern': ['Russia', 'China', 'Iran', 'North Korea'],
  Other: ['Israel', 'Ukraine', 'India', 'Pakistan', 'Saudi Arabia',
    'Australia', 'Japan', 'South Korea', 'Brazil'],
};

export function getAlliance(country) {
  for (const [group, countries] of Object.entries(ALLIANCE_GROUPS)) {
    if (countries.includes(country)) return group;
  }
  return 'Unknown';
}

export function filterAircraft(aircraft, filters) {
  return aircraft.filter(ac => {
    if (!filters.showAircraft) return false;
    if (filters.country !== 'ALL' && ac.country !== filters.country) return false;
    if (filters.alliance !== 'ALL' && getAlliance(ac.country) !== filters.alliance) return false;
    if (ac.on_ground && !filters.showOnGround) return false;
    return true;
  });
}

export function filterShips(ships, filters) {
  return ships.filter(sh => {
    if (!filters.showShips) return false;
    if (filters.country !== 'ALL') {
      // Ship 'flag' is 2-letter code; map from country name
      const flagMap = {
        'United States':'US', 'Russia':'RU', 'China':'CN',
        'United Kingdom':'GB', 'France':'FR', 'Germany':'DE',
        'Israel':'IL', 'Turkey':'TR', 'Iran':'IR', 'Ukraine':'UA',
        'India':'IN', 'Japan':'JP', 'South Korea':'KR', 'North Korea':'KP',
        'Australia':'AU', 'Canada':'CA', 'Norway':'NO', 'Netherlands':'NL',
        'Spain':'ES', 'Italy':'IT', 'Saudi Arabia':'SA', 'Pakistan':'PK',
        'Taiwan':'TW', 'Poland':'PL', 'Sweden':'SE', 'Finland':'FI',
      };
      const expectedFlag = flagMap[filters.country];
      if (expectedFlag && sh.flag !== expectedFlag) return false;
    }
    return true;
  });
}

export function filterNews(news, filters) {
  return news.filter(n => {
    if (!filters.showNews) return false;
    return true;
  });
}

export function categorizeAircraft(ac) {
  const cs = (ac.callsign || '').toUpperCase();
  if (['RCH', 'REACH', 'JAKE', 'CNV'].some(p => cs.startsWith(p))) return 'Transport';
  if (['PAT', 'NAVY', 'MARCO'].some(p => cs.startsWith(p))) return 'Naval Patrol';
  if (ac.altitude > 15000 && ac.velocity > 200) return 'Fighter/Bomber';
  if (ac.altitude > 18000) return 'ISR/Recon';
  return 'Military';
}
