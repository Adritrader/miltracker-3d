/**
 * Client-side military filtering and categorization logic
 */

export const COUNTRY_FLAGS = {
  'United States': '🇺🇸', 'Russia': '🇷🇺', 'China': '🇨🇳',
  'United Kingdom': '🇬🇧', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Israel': '🇮🇱', 'Turkey': '🇹🇷', 'Iran': '🇮🇷', 'Ukraine': '🇺🇦',
  'India': '🇮🇳', 'Pakistan': '🇵🇰', 'Saudi Arabia': '🇸🇦',
  'Australia': '🇦🇺', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'North Korea': '🇰🇵', 'Brazil': '🇧🇷', 'Canada': '🇨🇦',
  'Poland': '🇵🇱', 'Italy': '🇮🇹', 'Spain': '🇪🇸',
  'Netherlands': '🇳🇱', 'Norway': '🇳🇴', 'Sweden': '🇸🇪',
  'Belgium': '🇧🇪', 'Greece': '🇬🇷', 'Romania': '🇷🇴',
};

/**
 * Derive country name from ICAO24 hex prefix (military allocations).
 * Used as fallback when ownOp/origin_country is not set.
 */
export function icaoToCountry(hex = '') {
  const h = hex.toUpperCase();
  if (h.startsWith('AE') || h.startsWith('AD'))          return 'United States';
  if (h.startsWith('43C') || h.startsWith('43D') || h.startsWith('43E')) return 'United Kingdom';
  if (h.startsWith('394') || h.startsWith('395') || h.startsWith('396')) return 'France';
  if (h.startsWith('3C4') || h.startsWith('3C5') || h.startsWith('3C6') || h.startsWith('3C7')) return 'Germany';
  if (h.startsWith('010') || h.startsWith('011') || h.startsWith('012') || h.startsWith('013') || h.startsWith('01')) return 'Russia';
  if (h.startsWith('78')  || h.startsWith('79')  || h.startsWith('7A')  || h.startsWith('7B'))  return 'China';
  if (h.startsWith('738') || h.startsWith('739')) return 'South Korea';
  if (h.startsWith('840') || h.startsWith('841')) return 'Japan';
  if (h.startsWith('710') || h.startsWith('711')) return 'India';
  if (h.startsWith('76C') || h.startsWith('76D')) return 'Israel';
  if (h.startsWith('74C') || h.startsWith('74D')) return 'Turkey';
  if (h.startsWith('73C') || h.startsWith('73D')) return 'Iran';
  if (h.startsWith('EB')  || h.startsWith('EC'))  return 'Belgium';
  if (h.startsWith('484') || h.startsWith('485')) return 'Australia';
  if (h.startsWith('C0')  || h.startsWith('C1'))  return 'Canada';
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
