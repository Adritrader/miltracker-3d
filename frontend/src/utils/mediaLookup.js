/**
 * mediaLookup.js – military entity → Wikimedia Commons image URL
 * Each ICAO type-code maps to a unique, specific photograph.
 */

const W = (filename, w = 400) => {
  // encodeURIComponent over-encodes () which breaks Wikimedia lookup — keep them literal
  const encoded = encodeURIComponent(filename)
    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${w}`;
};

// Aircraft: unique photo per ICAO type-code
const AIRCRAFT_IMAGES = {
  // ── US Fighters / Multi-role ──────────────────────────────────────────────
  F35:   W('F-35A_flight_(1).jpg'),
  F35A:  W('F-35A_AF_Serial_No._09-5000_during_flight_(2).jpg'),
  F35B:  W('F-35B_STOVL_aircraft_in_flight.jpg'),
  F35C:  W('F-35C_conducting_at-sea_demonstration.jpg'),
  F22:   W('F-22_Raptor_edit1_(cropped).jpg'),
  F16:   W('F-16_June_2008.jpg'),
  F16C:  W('Turkish_Air_Force_F-16C_Fighting_Falcon.jpg'),
  F15:   W('F-15C_Eagle_of_the_144th_Fighter_Wing_over_California.jpg'),
  F15C:  W('F-15C_Eagle_of_the_144th_Fighter_Wing_over_California.jpg'),
  F15E:  W('F-15E_Strike_Eagle_Barksdale.jpg'),
  F15EX: W('F-15EX_Eagle_II_first_flight.jpg'),
  F18:   W('FA-18C_Hornet_VFA-83_drops_a_GBU-32.jpg'),
  FA18:  W('FA-18C_Hornet_VFA-83_drops_a_GBU-32.jpg'),
  F18E:  W('FA-18E_Super_Hornet_VFA-115.jpg'),
  F18F:  W('FA-18F_Super_Hornet_VFA-11.jpg'),
  A10:   W('A-10_CAS.jpg'),
  A10C:  W('A-10_Thunderbolt_II_In-flight-0-1.jpg'),
  F117:  W('F-117_Nighthawk_Front_from_above.jpg'),
  // ── US Strategic Bombers ─────────────────────────────────────────────────
  B52:   W('B-52_Stratofortress.jpg'),
  B52H:  W('B-52H_Stratofortress_-_2014_Pacific_Air_Forces_photo.jpg'),
  B2:    W('B-2_Spirit_026.jpg'),
  B21:   W('B-21_Raider_in_flight_2023.jpg'),
  B1:    W('B-1B_Lancer_after_refueling.jpg'),
  B1B:   W('B-1B_Lancer_after_refueling.jpg'),
  // ── US ISR / Patrol ───────────────────────────────────────────────────────
  U2:    W('Lockheed_U-2_(1).jpg'),
  U2S:   W('Lockheed_U-2S_60-6926_side_view.jpg'),
  SR71:  W('Lockheed_SR-71_Blackbird.jpg'),
  RC135: W('RC-135_264.jpg'),
  RC35:  W('RC-135V_Rivet_Joint_55-3121.jpg'),
  E3:    W('E-3_Sentry_over_Iraq.jpg'),
  E3TF:  W('E-3_Sentry_over_Iraq.jpg'),
  E8:    W('E-8C_JSTARS_YGALLERY.jpg'),
  P8:    W('P-8A_Poseidon_2012.jpg'),
  P8A:   W('737-800P_Boeing_P-8A_Poseidon_(P8)_-_US_Navy.jpg'),
  P3:    W('P-3C_Orion_of_VP-30_in_flight.jpg'),
  P3C:   W('P-3_Orion_VP-8_over_Norwegian_Sea_2011.jpg'),
  EP3:   W('EP-3E_Aries_II.jpg'),
  RQ4:   W('RQ-4_Global_Hawk.jpg'),
  RQ4B:  W('RQ-4B_Global_Hawk_in_flight.jpg'),
  MQ9:   W('MQ-9_Reaper_in_flight_(2007).jpg'),
  MQ9A:  W('MQ-9_Reaper_Armed_side_view.jpg'),
  MQ1:   W('Predator_unmanned_aircraft.jpg'),
  RQ170: W('RQ-170_Sentinel_2007.jpg'),
  // ── US Tankers / Airlift ─────────────────────────────────────────────────
  KC135: W('KC-135A_Stratotanker.jpg'),
  KC10:  W('KC-10A_-_Refueling_E-3_Sentry.jpg'),
  KC46:  W('KC-46A_Pegasus_2015.jpg'),
  KC46A: W('KC-46A_on_take-off_run,_2015.jpg'),
  C17:   W('C-17_globemaster_III.jpg'),
  C17A:  W('C-17_Globemaster_III_at_RIAT_2010.jpg'),
  C130:  W('Lockheed_C-130_Hercules_EC.jpg'),
  C130J: W('C-130J_Super_Hercules.jpg'),
  C5:    W('C-5_Galaxy_in_flight.jpg'),
  C5M:   W('C-5M_Super_Galaxy.jpg'),
  C2:    W('Grumman_C-2A_Greyhound.jpg'),
  // ── Russian AF ───────────────────────────────────────────────────────────
  SU27:  W('Flanker_20.jpg'),
  SU27S: W('Su-27_-_RIAT_2010_(4914318064).jpg'),
  SU30:  W('Su-30MKI_in_2009.jpg'),
  SU30M: W('Su-30MKK_in_2007.jpg'),
  SU30MK:W('Su-30MKI_in_2009.jpg'),
  SU34:  W('Sukhoi_Su-34_at_MAKS-2009.jpg'),
  SU35:  W('Su-35S_at_2011_MAKS.jpg'),
  SU35S: W('Su-35S_cropped.jpg'),
  SU57:  W('Su-57_at_the_2019_MAKS.jpg'),
  SU24:  W('Su-24_Fencer.jpg'),
  SU25:  W('Su-25T_in_flight.jpg'),
  SU25T: W('Su-25TM_in_flight.jpg'),
  MIG29: W('MiG-29_(1).jpg'),
  MIG29S:W('MiG-29_Fulcrum_(8576695199).jpg'),
  MIG31: W('MiG-31_(Rostov)_2.jpg'),
  MIG31B:W('MiG-31BM_Foxhound_MAKS-2009.jpg'),
  MIG35: W('MiG-35_(MSC2017).jpg'),
  TU95:  W('Tupolev_Tu-95MS.jpg'),
  TU22:  W('Tupolev_Tu-22M3_Backfire.jpg'),
  TU22M: W('Tupolev_Tu-22M3_Backfire.jpg'),
  TU160: W('Tupolev_Tu-160_Beliy_Lebed_(White_Swan).jpg'),
  TU142: W('Tupolev_Tu-142.jpg'),
  IL76:  W('Ilyushin_Il-76_RA-78836.jpg'),
  IL76M: W('Ilyushin_Il-76_Russian_Air_Force.jpg'),
  IL78:  W('IL-78_Midas.jpg'),
  AN124: W('Antonov_An-124_Ruslan.jpg'),
  AN22:  W('Antonov_An-22.jpg'),
  // ── Chinese AF ───────────────────────────────────────────────────────────
  J10:   W('J-10B_at_Airshow_China_2014.jpg'),
  J10A:  W('PLA_J-10A_02.jpg'),
  J11:   W('J-11_of_PLA_Air_Force.jpg'),
  J11B:  W('J-11B_of_PLA_Air_Force_2010.jpg'),
  J16:   W('J-16_fighter.jpg'),
  J20:   W('J-20_at_2016_Zhuhai_Airshow_(cropped).jpg'),
  H6:    W('H-6K_bomber.jpg'),
  H6K:   W('H-6K_at_Zhuhai_Airshow_2016.jpg'),
  Y20:   W('Y-20_at_2014_Zhuhai_Airshow.jpg'),
  // ── European AF ──────────────────────────────────────────────────────────
  RFLA:  W('Dassault_Rafale_02.jpg'),
  RAFM:  W('Dassault_Rafale_M_French_navy.jpg'),
  TPHY:  W('Eurofighter_Typhoon.jpg'),
  EURT:  W('Eurofighter_DA5_in_flight.jpg'),
  A400:  W('A400M_first_flight_Airbus.jpg'),
  A400M: W('A400M_Atlas_at_Paris_Air_Show_2015.jpg'),
  GRIPE: W('Saab_JAS_39_Gripen.jpg'),
  JAS39: W('JAS-39C_Gripen_cropped.jpg'),
  TORS:  W('Panavia_Tornado_GR4.jpg'),
  GR4:   W('Panavia_Tornado_GR4.jpg'),
  MRTT:  W('Airbus_A330_MRTT_RAF_ZZ338.jpg'),
  // ── Israeli AF ───────────────────────────────────────────────────────────
  F16I:  W('F-16I_Sufa_-_Israel.jpg'),
  F15I:  W('F-15I_Raam.jpg'),
  // ── Helicopters — US ─────────────────────────────────────────────────────
  AH64:  W('AH-64E_Apache_Guardian.jpg'),
  AH64E: W('AH-64E_Apache_Guardian.jpg'),
  AH64D: W('AH-64D_Apache_Longbow.jpg'),
  UH60:  W('UH-60_Black_Hawk.jpg'),
  UH60M: W('UH-60M_Black_Hawk.jpg'),
  MH60:  W('MH-60S_Knighthawk_at_sea.jpg'),
  HH60:  W('HH-60G_Pave_Hawk.jpg'),
  SH60:  W('SH-60B_over_Red_Sea.jpg'),
  MH60R: W('MH-60R_Seahawk_dips_sonar.jpg'),
  CH47:  W('CH-47_Chinook_during_Operation_Jaws.jpg'),
  CH47F: W('CH-47F_Chinook_landing.jpg'),
  MH47:  W('MH-47G_Chinook_SOAR.jpg'),
  CH53:  W('CH-53E_Super_Stallion_landing.jpg'),
  MH53:  W('MH-53E_Sea_Dragon.jpg'),
  V22:   W('MV-22_Osprey_MCC-461.jpg'),
  MV22:  W('MV-22_Osprey_MCC-461.jpg'),
  CV22:  W('CV-22_Osprey.jpg'),
  OH58:  W('OH-58D_Kiowa_Warrior.jpg'),
  // ── Helicopters — European ───────────────────────────────────────────────
  NH90:  W('NH90_TTH_in_Slovenia.jpg'),
  EC725: W('Caracal_helicopter_French_air_force.jpg'),
  H225M: W('Caracal_helicopter_French_air_force.jpg'),
  AS532: W('AS_532_Cougar_Helikopter_(Turkey).jpg'),
  AS565: W('AS565_Panther_helicopter.jpg'),
  AS665: W('EC665_Tiger_HAD.jpg'),
  EC665: W('EC665_Tiger_HAD.jpg'),
  EC135: W('EC_135_Bundeswehr.jpg'),
  EC635: W('EC635_ALAT.jpg'),
  AW101: W('AgustaWestland_AW101_Merlin_HM1_ZH822.jpg'),
  AW159: W('AgustaWestland_AW159_Wildcat.jpg'),
  LYNX:  W('Westland_Lynx_HMA8.jpg'),
  AS332: W('AS_332_Super_Puma_French_ALAT.jpg'),
  SA330: W('SA_330_Puma_helicopter.jpg'),
  SA342: W('SA_342_Gazelle_French_Army.jpg'),
  SA316: W('SA316_Alouette_III.jpg'),
  // ── Helicopters — Russian ────────────────────────────────────────────────
  MI8:   W('Mil_Mi-8_cropped_clean.jpg'),
  MI8T:  W('Mil_Mi-8MTV_Russian_AF.jpg'),
  MI17:  W('Mi-17_of_the_Afghan_Air_Force.jpg'),
  MI24:  W('Mil_Mi-24_Hind_helicopter.jpg'),
  MI24V: W('Mi-24V_Hind.jpg'),
  MI28:  W('Mi-28N_in_2009.jpg'),
  MI28N: W('Mi-28N_at_MAKS-2013.jpg'),
  KA52:  W('Ka-52_at_MAKS-2007.jpg'),
  KA27:  W('Ka-27_Helix_Russian_Navy.jpg'),
  KA31:  W('Ka-31_AEW_helicopter.jpg'),
  MI26:  W('Mil_Mi-26T_at_ILA_2006.jpg'),
  // ── Helicopters — Chinese ────────────────────────────────────────────────
  Z10:   W('Z-10_helicopter.jpg'),
  Z19:   W('Z-19_helicopter.jpg'),
  Z20:   W('Z-20_helicopter_2019.jpg'),
  Z9:    W('Z-9_Haitun.jpg'),
  // ── SIGINT / Special ─────────────────────────────────────────────────────
  E2:    W('E-2C_Hawkeye_of_VAW-126.jpg'),
  E2C:   W('E-2C_Hawkeye_of_VAW-126.jpg'),
  E2D:   W('E-2D_Advanced_Hawkeye.jpg'),
  EA18G: W('EA-18G_Growler_101_VA.jpg'),
  EA6B:  W('EA-6B_Prowler.jpg'),
  EC130: W('EC-130H_Compass_Call.jpg'),
  AC130: W('AC-130W_Stinger_II.jpg'),
  MC130: W('MC-130H_Combat_Talon_II.jpg'),
  WC135: W('WC-135W_Constant_Phoenix_nose.jpg'),
};

// Fallback by broad category keyword
const AIRCRAFT_FALLBACK = W('F-16_June_2008.jpg');

/** Return image URL for a given ICAO type code, or null if not in catalogue */
export function getAircraftImageUrl(typeCode) {
  if (!typeCode) return null;
  const key = typeCode.toUpperCase().replace(/[-\s/]/g, '');
  return AIRCRAFT_IMAGES[key] || null;
}

// Ships: name-matched first, type-matched second
const SHIP_BY_NAME = [
  // US carriers
  [/FORD|CVN.?78/i,              W('USS_Gerald_R._Ford_(CVN-78).jpg')],
  [/TRUMAN|CVN.?75/i,            W('USS_Harry_S._Truman_underway_2013.jpg')],
  [/EISENHOWER|CVN.?69/i,        W('USS_Dwight_D._Eisenhower_(CVN-69).jpg')],
  [/NIMITZ|CVN.?68/i,            W('USS_Nimitz_(CVN-68)_underway.jpg')],
  [/REAGAN|CVN.?76/i,            W('USS_Ronald_Reagan_CVN-76_at_sea.jpg')],
  [/LINCOLN|CVN.?72/i,           W('USS_Abraham_Lincoln_(CVN-72)_underway.jpg')],
  [/WASHINGTON|CVN.?73/i,        W('USS_George_Washington_(CVN-73)_underway.jpg')],
  [/STENNIS|CVN.?74/i,           W('USS_John_C_Stennis_(CVN74)_underway.jpg')],
  [/AMERICA|LHA.?6/i,            W('USS_America_(LHA-6)_underway.jpg')],
  [/WASP|LHD.?1/i,               W('USS_Wasp_(LHD-1).jpg')],
  [/ZUMWALT|DDG.?1000/i,         W('USS_Zumwalt_(DDG-1000).jpg')],
  [/ARLEIGH.?BURKE|DDG.?51/i,    W('USS_Arleigh_Burke_(DDG-51).jpg')],
  [/TICONDEROGA|CG.?47/i,        W('USS_Ticonderoga_(CG-47).jpg')],
  // UK
  [/QUEEN.?ELIZABETH/i,          W('HMS_Queen_Elizabeth_(R08)_in_the_English_Channel,_August_2020.jpg')],
  [/PRINCE.?OF.?WALES/i,         W('HMS_Prince_of_Wales_(R09)_in_the_North_Atlantic.jpg')],
  // France
  [/DE.?GAULLE/i,                W('Charles_de_Gaulle_(R91)_underway.jpg')],
  // Russia
  [/KUZNETSOV/i,                 W('Kuznetsov_class_aircraft_carrier.jpg')],
  [/MOSKVA/i,                    W('Moskva_(cruiser,_1983).jpg')],
  [/PETER.?THE.?GREAT|PYOTR/i,   W('Pyotr_Velikiy_2004.jpg')],
  // China
  [/LIAONING|CV.?16/i,           W('CNS_Liaoning_(CV-16).jpg')],
  [/SHANDONG|CV.?17/i,           W('Chinese_aircraft_carrier_Shandong.jpg')],
  [/FUJIAN|CV.?18/i,             W('Chinese_aircraft_carrier_Fujian.jpg')],
  // NATO
  [/ROTTERDAM/i,                 W('HNLMS_Rotterdam_(L800).jpg')],
  [/SACHSEN/i,                   W('FGS_Sachsen_(F219).jpg')],
];

const SHIP_BY_TYPE = {
  carrier:    W('USS_Gerald_R._Ford_(CVN-78).jpg'),
  destroyer:  W('USS_Arleigh_Burke_(DDG-51).jpg'),
  cruiser:    W('USS_Bunker_Hill_(CG-52)_fires_a_torpedo.jpg'),
  ssbn:       W('USS_Ohio_(SSBN-726)_underway.jpg'),
  submarine:  W('USS_Virginia_(SSN-774)_underway.jpg'),
  frigate:    W('HMNZS_Te_Kaha_-_Frigate.jpg'),
  corvette:   W('INS_Kamorta_(P28).jpg'),
  amphibious: W('USS_America_(LHA-6)_underway.jpg'),
  patrol:     W('USS_Hurricane_(PC-3).jpg'),
  tanker:     W('USNS_Henry_J._Kaiser_(T-AO-187).jpg'),
};

export function getShipImageUrl(shipData) {
  const name = (shipData?.name || '').toUpperCase();
  const t    = (shipData?.type || shipData?.shipType || '').toLowerCase();

  // 1. Match by vessel name (regex list)
  for (const [re, url] of SHIP_BY_NAME) {
    if (re.test(name)) return url;
  }

  // 2. Infer type from the ship name itself (catches "CVN-78", "DDG-51", "LHD" etc.)
  const nameAndType = name + ' ' + t;
  if (/\bCVN\b|CVH|CARRIER|AIRCRAFT CARRIER/.test(nameAndType))      return SHIP_BY_TYPE.carrier;
  if (/\bLHD\b|\bLHA\b|\bLPD\b|WASP|AMERICA|BATAAN|AMPHIB/.test(nameAndType)) return SHIP_BY_TYPE.amphibious;
  if (/\bDDG\b|\bDD\b|DESTROYER|ARLEIGH|BURKE|COLE|CARNEY|PORTER|ROSS|THOMAS|DIAMOND|RICHMOND|DRAGON|ZUMWALT/.test(nameAndType)) return SHIP_BY_TYPE.destroyer;
  if (/\bCG\b|CRUISER|MONTEREY|TICONDEROGA|SAN JACINTO|PHILIPPINE SEA|BUNKER/.test(nameAndType)) return SHIP_BY_TYPE.cruiser;
  if (/SSBN|BALLISTIC/.test(nameAndType))    return SHIP_BY_TYPE.ssbn;
  if (/\bSSN\b|SUBMARINE|VARSHAVYANKA/.test(nameAndType)) return SHIP_BY_TYPE.submarine;
  if (/FRIGATE|FFG|\bF\d{3}\b|FORBIN|PROVENCE|SACHSEN|RICHMOND|JAMARAN|DENA|SAHAND|PETER WILLEMOES|HAMINA|LUIGI/.test(nameAndType)) return SHIP_BY_TYPE.frigate;
  if (/CORVETTE|FAST ATTACK|PATROL BOAT|MINE LAYER|DHOW|IRGCN/.test(nameAndType)) return SHIP_BY_TYPE.patrol;
  if (/SA.AR|EILAT/.test(nameAndType))       return SHIP_BY_TYPE.destroyer; // Israeli Sa'ar class
  if (/TANKER|REPLENISH|AOE|AOR|KAISER/.test(nameAndType)) return SHIP_BY_TYPE.tanker;

  // 3. Match by type string (original logic)
  if (/carrier|cvn|cvf|cva/.test(t))        return SHIP_BY_TYPE.carrier;
  if (/destroyer|ddg/.test(t))               return SHIP_BY_TYPE.destroyer;
  if (/cruiser|cg|clg/.test(t))              return SHIP_BY_TYPE.cruiser;
  if (/ssbn|ballistic/.test(t))              return SHIP_BY_TYPE.ssbn;
  if (/ssn|submarine|sub/.test(t))           return SHIP_BY_TYPE.submarine;
  if (/frigate|ffg/.test(t))                 return SHIP_BY_TYPE.frigate;
  if (/corvette/.test(t))                    return SHIP_BY_TYPE.corvette;
  if (/lhd|lha|amphib/.test(t))             return SHIP_BY_TYPE.amphibious;
  if (/patrol|pc/.test(t))                   return SHIP_BY_TYPE.patrol;
  if (/tanker|replenish|aoe|aor/.test(t))    return SHIP_BY_TYPE.tanker;

  // 4. Default: use destroyer photo for any unmatched military vessel
  return SHIP_BY_TYPE.destroyer;
}

// Military bases
const BASE_IMAGES = {
  airbase: W('Ramstein_Air_Base_aerial_view_2019.jpg'),
  naval:   W('Naval_Station_Norfolk_aerial.jpg'),
  airport: W('Bagram_Defense_007.jpg'),
  missile: W('Minuteman-III-Missile-Silo.jpg'),
  radar:   W('PAVE_PAWS_Radar_Clear_AFS_Alaska.jpg'),
  army:    W('Fort_Hood_aerial_2019.jpg'),
};

export function getBaseImageUrl(baseType) {
  return BASE_IMAGES[baseType] || null;
}

// Conflict event types
const CONFLICT_IMAGES = {
  airstrike:  W('F-15E_Strike_Eagle_Barksdale.jpg'),
  missile:    W('Tomahawk_Block_IV_cruise_missile.jpg'),
  explosion:  W('Beirut_explosion_2020_largest_shockwave.jpg'),
  artillery:  W('M198_howitzer_camp_liberty.jpg'),
  drone:      W('MQ-9_Reaper_Armed_side_view.jpg'),
  naval:      W('USS_Arleigh_Burke_(DDG-51).jpg'),
  troops:     W('US_Army_patrol_Afghanistan.jpg'),
  conflict:   W('Explosion_at_a_hotel.jpg'),
  riot:       W('Police_in_riot_gear.jpg'),
};

export function getConflictImageUrl(type) {
  return CONFLICT_IMAGES[type] || null;
}
