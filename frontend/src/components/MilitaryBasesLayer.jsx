/**
 * MilitaryBasesLayer – renders strategic military points on the globe
 * Airports, air bases, naval bases, missile sites — static dataset.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';

// ── Static military facilities ─────────────────────────────────────────────
// type: 'airbase' | 'naval' | 'airport' | 'missile' | 'radar'
const BASES = [
  // ── MIDDLE EAST / GULF ────────────────────────────────────────────────────
  { id: 'al_dhafra',     name: 'Al Dhafra AFB',            lat: 24.249, lon: 54.542, type: 'airbase', country: 'UAE',           note: 'US/UAE joint — F-35, B-52 ops' },
  { id: 'al_minhad',     name: 'Al Minhad AFB',            lat: 24.983, lon: 55.366, type: 'airbase', country: 'UAE',           note: 'Coalition hub, Dubai area' },
  { id: 'al_udeid',      name: 'Al Udeid AFB',             lat: 25.117, lon: 51.316, type: 'airbase', country: 'Qatar',         note: 'USAF largest ME base — B-52, F-22' },
  { id: 'ali_al_salem',  name: 'Ali Al Salem AFB',         lat: 29.348, lon: 47.522, type: 'airbase', country: 'Kuwait',        note: 'USAF & Kuwait fighters' },
  { id: 'iran_isfahan',  name: 'Isfahan IAP / IRIAF',      lat: 32.752, lon: 51.861, type: 'airbase', country: 'Iran',          note: 'IRIAF F-14, F-4 base' },
  { id: 'iran_tehran',   name: 'Mehrabad / IRIAF Tehran',  lat: 35.688, lon: 51.314, type: 'airbase', country: 'Iran',          note: 'Iran AF HQ, drone ops' },
  { id: 'iran_tabriz',   name: 'Tabriz AFB',               lat: 38.134, lon: 46.235, type: 'airbase', country: 'Iran',          note: 'Northern IRIAF base' },
  { id: 'iran_bushehr',  name: 'Bushehr AFB / Nuclear',    lat: 28.944, lon: 50.840, type: 'missile', country: 'Iran',          note: 'Nuclear site + naval base' },
  { id: 'iran_bandar',   name: 'Bandar Abbas Naval Base',  lat: 27.219, lon: 56.363, type: 'naval',   country: 'Iran',          note: 'IRIN — Strait of Hormuz command' },
  { id: 'iran_chabahar', name: 'Chabahar Naval Base',      lat: 25.290, lon: 60.643, type: 'naval',   country: 'Iran',          note: 'Strategic Indian Ocean access' },
  { id: 'iran_fordow',   name: 'Fordow Enrichment Site',   lat: 34.883, lon: 49.823, type: 'missile', country: 'Iran',          note: 'Underground nuclear facility' },
  { id: 'khoramabad',    name: 'Khoramabad AFB',           lat: 33.435, lon: 48.282, type: 'airbase', country: 'Iran',          note: 'Western IRIAF base' },
  { id: 'saudi_prince',  name: 'Prince Sultan AFB',        lat: 24.062, lon: 47.580, type: 'airbase', country: 'Saudi Arabia',  note: 'USAF/RSAF — F-15, Patriot' },
  { id: 'saudi_king',    name: 'King Khalid Military City',lat: 27.900, lon: 45.530, type: 'airbase', country: 'Saudi Arabia',  note: 'Central Saudi mil complex' },
  { id: 'bahrain_5th',   name: 'NSA Bahrain (US 5th Fleet)',lat:26.209, lon: 50.596, type: 'naval',   country: 'Bahrain',       note: 'HQ US Navy 5th Fleet' },
  { id: 'bahrain_isa',   name: 'Isa AFB',                  lat: 26.033, lon: 50.652, type: 'airbase', country: 'Bahrain',       note: 'F-16, Typhoon' },
  { id: 'oman_muscat',   name: 'Seeb / Sultan Qaboos AFB', lat: 23.594, lon: 58.284, type: 'airbase', country: 'Oman',          note: 'RAF Oman, Typhoon' },
  { id: 'oman_masirah',  name: 'Masirah Island AFB',       lat: 20.675, lon: 58.890, type: 'airbase', country: 'Oman',          note: 'US/UK strategic outpost' },
  { id: 'djibouti_lem',  name: 'Camp Lemonnier',           lat: 11.547, lon: 43.159, type: 'airbase', country: 'Djibouti',      note: 'USAF AFRICOM hub — drones, SOF' },
  { id: 'diego_garcia',  name: 'Diego Garcia (BIOT)',      lat: -7.312, lon: 72.423, type: 'airbase', country: 'UK/US',         note: 'B-2, B-52 strategic bomber base' },
  { id: 'nevatim',       name: 'Nevatim AFB',              lat: 31.208, lon: 35.012, type: 'airbase', country: 'Israel',        note: 'IAF F-35I Adir home' },
  { id: 'hatzerim',      name: 'Hatzerim AFB',             lat: 31.225, lon: 34.663, type: 'airbase', country: 'Israel',        note: 'F-16I Sufa' },
  { id: 'tel_nof',       name: 'Tel Nof AFB',              lat: 31.840, lon: 34.818, type: 'airbase', country: 'Israel',        note: 'F-15 Eagles, air refueling' },
  { id: 'israel_dimona', name: 'Negev Nuclear Research',   lat: 30.961, lon: 35.145, type: 'missile', country: 'Israel',        note: 'Undeclared nuclear site' },
  { id: 'yemen_aden',    name: 'Aden Airport / Coalition', lat: 12.829, lon: 45.028, type: 'airbase', country: 'Yemen',         note: 'Coalition air ops, contested' },
  { id: 'turkey_incirlik',name:'Incirlik AFB',             lat: 37.002, lon: 35.426, type: 'airbase', country: 'Turkey/US',     note: 'NATO nuclear weapons — B61 bombs' },
  { id: 'turkey_konya',  name: 'Konya AFB',                lat: 37.980, lon: 32.562, type: 'airbase', country: 'Turkey',        note: 'TurAF F-16, NATO exercises' },
  { id: 'turkey_diyarbakir',name:'Diyarbakir AFB',         lat: 37.893, lon: 40.200, type: 'airbase', country: 'Turkey',        note: 'TurAF F-16 — Kurdish ops' },
  { id: 'syria_khmeimim',name: 'Khmeimim AFB (Syria)',     lat: 35.401, lon: 35.948, type: 'airbase', country: 'Russia',        note: 'Russian ME HQ — Su-35, Su-34, S-400' },
  { id: 'syria_tartus',  name: 'Tartus Naval Base (Russia)',lat:34.887, lon: 35.855, type: 'naval',   country: 'Russia',        note: 'Only Russian Mediterranean naval base' },

  // ── UKRAINE / RUSSIA ──────────────────────────────────────────────────────
  { id: 'ua_myrhorod',   name: 'Myrhorod AB',              lat: 49.984, lon: 33.614, type: 'airbase', country: 'Ukraine',       note: 'Su-27 base' },
  { id: 'ua_starokon',   name: 'Starokostiantyniv AB',     lat: 49.700, lon: 27.220, type: 'airbase', country: 'Ukraine',       note: 'Su-24M strikes' },
  { id: 'ua_dnipro',     name: 'Dnipro International',     lat: 48.358, lon: 35.099, type: 'airport', country: 'Ukraine',       note: 'Military logistics hub' },
  { id: 'ru_morozovsk',  name: 'Morozovsk AFB',            lat: 48.318, lon: 41.828, type: 'airbase', country: 'Russia',        note: 'Su-34 strike ops' },
  { id: 'ru_millerovo',  name: 'Millerovo AFB',            lat: 48.981, lon: 40.282, type: 'airbase', country: 'Russia',        note: 'Su-34, MiG-29' },
  { id: 'ru_sevastopol', name: 'Sevastopol / Belbek AFB',  lat: 44.689, lon: 33.576, type: 'naval',   country: 'Russia',        note: 'Black Sea HQ (contested)' },
  { id: 'ru_engels',     name: 'Engels-2 AFB',             lat: 51.413, lon: 46.177, type: 'airbase', country: 'Russia',        note: 'Tu-95MS, Tu-160 nuclear bombers' },
  { id: 'ru_olenya',     name: 'Olenya AFB',               lat: 68.152, lon: 33.465, type: 'airbase', country: 'Russia',        note: 'Tu-22M3, MiG-31' },
  { id: 'ru_kaliningrad',name: 'Kaliningrad (Chkalovsk)',  lat: 54.889, lon: 20.591, type: 'airbase', country: 'Russia',        note: 'S-400, Iskander + Su-27 — NATO flank' },
  { id: 'ru_pskov',      name: 'Pskov AFB',                lat: 57.783, lon: 28.390, type: 'airbase', country: 'Russia',        note: 'Il-76 VTA + 76th Airborne Div.' },

  // ── SPAIN ─────────────────────────────────────────────────────────────────
  { id: 'es_moron',      name: 'Moron AFB (US/Spain)',     lat: 37.175, lon: -5.617, type: 'airbase', country: 'Spain/US',      note: 'USAFE forward base, KC-135 tankers' },
  { id: 'es_rota',       name: 'Rota Naval Station',       lat: 36.628, lon: -6.349, type: 'naval',   country: 'Spain/US',      note: 'US 6th Fleet destroyer forward base, Aegis BMD' },
  { id: 'es_zaragoza',   name: 'Zaragoza AFB',             lat: 41.666, lon: -1.041, type: 'airbase', country: 'Spain',         note: 'A-10 exercises, NATO alert' },
  { id: 'es_torrejon',   name: 'Torrejón AFB',             lat: 40.496, lon: -3.446, type: 'airbase', country: 'Spain',         note: 'SpAF F-18 Hornet home' },
  { id: 'es_los_llanos', name: 'Los Llanos AFB',           lat: 38.948, lon: -1.863, type: 'airbase', country: 'Spain',         note: 'Eurofighter Typhoon' },

  // ── FRANCE ────────────────────────────────────────────────────────────────
  { id: 'fr_istres',     name: 'Istres-Le Tubé AFB',       lat: 43.521, lon: 4.924,  type: 'airbase', country: 'France',        note: 'Rafale B, ASMP-A nuclear bombs' },
  { id: 'fr_avord',      name: 'Avord AFB',                lat: 47.054, lon: 2.636,  type: 'airbase', country: 'France',        note: 'E-3F AWACS + KC-135' },
  { id: 'fr_mont_de',    name: 'Mont-de-Marsan AFB',       lat: 43.906, lon: -0.500, type: 'airbase', country: 'France',        note: 'Rafale test + EW units' },
  { id: 'fr_luxeuil',    name: 'Luxeuil-Saint-Sauveur AFB',lat: 47.781, lon: 6.363,  type: 'airbase', country: 'France',        note: 'Rafale nuclear strike' },
  { id: 'fr_toulon',     name: 'Toulon Naval Base',        lat: 43.075, lon: 5.928,  type: 'naval',   country: 'France',        note: 'French Navy HQ, Charles de Gaulle CVN' },
  { id: 'fr_brest',      name: 'Brest Naval Base',         lat: 48.389, lon: -4.486, type: 'naval',   country: 'France',        note: 'SSBN nuclear submarines home' },

  // ── GERMANY ───────────────────────────────────────────────────────────────
  { id: 'ramstein',      name: 'Ramstein AFB',             lat: 49.437, lon: 7.600,  type: 'airbase', country: 'Germany/US',    note: 'USAFE HQ, C-17, F-35' },
  { id: 'de_spangdahlem',name: 'Spangdahlem AFB',          lat: 50.126, lon: 6.692,  type: 'airbase', country: 'Germany/US',    note: 'F-16C, A-10 — NATO QRA' },
  { id: 'de_jagel',      name: 'Jagel AFB',                lat: 54.566, lon: 9.567,  type: 'airbase', country: 'Germany',       note: 'Tornado IDS strike, SAR' },
  { id: 'de_nörvenich',  name: 'Nörvenich AFB',            lat: 50.831, lon: 6.659,  type: 'airbase', country: 'Germany',       note: 'Eurofighter Typhoon QRA' },
  { id: 'de_buechel',    name: 'Büchel AFB',               lat: 50.174, lon: 7.063,  type: 'missile', country: 'Germany/NATO',  note: 'NATO nuclear B61-12 bombs (DCA)' },
  { id: 'de_kiel',       name: 'Kiel Naval Base',          lat: 54.328, lon: 10.152, type: 'naval',   country: 'Germany',       note: 'Deutsche Marine submarine base' },

  // ── UK ────────────────────────────────────────────────────────────────────
  { id: 'lakenheath',    name: 'RAF Lakenheath',           lat: 52.409, lon: 0.561,  type: 'airbase', country: 'UK/US',         note: 'F-35A, F-15E — 48th FW' },
  { id: 'mildenhall',    name: 'RAF Mildenhall',           lat: 52.362, lon: 0.486,  type: 'airbase', country: 'UK/US',         note: 'KC-135, U-2, RC-135 ISR' },
  { id: 'uk_brize',      name: 'RAF Brize Norton',         lat: 51.752, lon: -1.580, type: 'airbase', country: 'UK',            note: 'A400M, Voyager tanker, strategic lift' },
  { id: 'uk_coningsby',  name: 'RAF Coningsby',            lat: 53.093, lon: -0.167, type: 'airbase', country: 'UK',            note: 'Typhoon QRA — UK air defence' },
  { id: 'uk_lossiemouth',name: 'RAF Lossiemouth',          lat: 57.705, lon: -3.339, type: 'airbase', country: 'UK',            note: 'P-8A MRA1, Typhoon — Atlantic' },
  { id: 'uk_devonport',  name: 'HMNB Devonport',          lat: 50.369, lon: -4.186, type: 'naval',   country: 'UK',            note: 'Royal Navy largest base, frigates/SSNs' },
  { id: 'uk_faslane',    name: 'HMNB Clyde (Faslane)',     lat: 56.072, lon: -4.790, type: 'naval',   country: 'UK',            note: 'UK SSBN Trident nuclear submarine home' },
  { id: 'uk_northwood',  name: 'PJHQ Northwood',          lat: 51.617, lon: -0.518, type: 'radar',   country: 'UK',            note: 'UK Permanent Joint HQ' },

  // ── ITALY ─────────────────────────────────────────────────────────────────
  { id: 'aviano',        name: 'Aviano AFB',               lat: 46.031, lon: 12.596, type: 'airbase', country: 'Italy/US',      note: 'F-16 fighters, 31st FW' },
  { id: 'sigonella',     name: 'NAS Sigonella',            lat: 37.401, lon: 14.923, type: 'naval',   country: 'Italy/US',      note: 'P-8 Poseidon, ISR drones, Global Hawk' },
  { id: 'it_ghedi',      name: 'Ghedi AFB',                lat: 45.395, lon: 10.267, type: 'missile', country: 'Italy/NATO',    note: 'B61-12 DCA nuclear — Tornado IDS' },
  { id: 'it_trapani',    name: 'Trapani-Birgi AFB',        lat: 37.915, lon: 12.500, type: 'airbase', country: 'Italy',         note: 'Eurofighter, Libya ops hub' },
  { id: 'it_taranto',    name: 'Taranto-Grottaglie Naval', lat: 40.518, lon: 17.408, type: 'naval',   country: 'Italy',         note: 'Italian Navy carrier base (Cavour)' },

  // ── POLAND / EASTERN FLANK ────────────────────────────────────────────────
  { id: 'pl_lask',       name: 'Lask AFB',                 lat: 51.551, lon: 19.180, type: 'airbase', country: 'Poland',        note: 'F-35A (2024), US forward rotation' },
  { id: 'pl_malbork',    name: 'Malbork AFB',              lat: 54.026, lon: 19.134, type: 'airbase', country: 'Poland/US',     note: 'US F-15 enhanced forward presence' },
  { id: 'pl_powidz',     name: 'Powidz AFB',               lat: 52.379, lon: 17.853, type: 'airbase', country: 'Poland/US',     note: 'USAF strategic airlift, Reaper drones' },
  { id: 'pl_redzikowo',  name: 'Redzikowo (Aegis Ashore)', lat: 54.477, lon: 17.096, type: 'missile', country: 'Poland/NATO',   note: 'NATO BMD Aegis Ashore — SM-3' },
  { id: 'ee_amari',      name: 'Amari AFB',                lat: 59.258, lon: 24.207, type: 'airbase', country: 'Estonia/NATO',  note: 'NATO Baltic QRA rotation' },
  { id: 'lt_siauliai',   name: 'Siauliai AFB',             lat: 55.893, lon: 23.395, type: 'airbase', country: 'Lithuania/NATO',note: 'NATO Baltic Air Policing' },
  { id: 'ro_deveselu',   name: 'Deveselu (Aegis Ashore)',  lat: 44.205, lon: 23.989, type: 'missile', country: 'Romania/NATO',  note: 'NATO BMD — SM-3 Block IB' },
  { id: 'ro_mihail',     name: 'Mihail Kogalniceanu AFB',  lat: 44.361, lon: 28.488, type: 'airbase', country: 'Romania/US',    note: 'Black Sea NATO hub, US F-16' },
  { id: 'bg_bezmer',     name: 'Bezmer AFB',               lat: 42.455, lon: 26.354, type: 'airbase', country: 'Bulgaria/US',   note: 'US forces rotation, Black Sea' },

  // ── NATO HQs ──────────────────────────────────────────────────────────────
  { id: 'mons_shape',    name: 'SHAPE / NATO HQ',          lat: 50.451, lon: 3.944,  type: 'radar',   country: 'NATO/Belgium',  note: 'NATO Supreme HQ Europe' },
  { id: 'naples_jfc',    name: 'JFC Naples (NATO)',        lat: 40.827, lon: 14.183, type: 'radar',   country: 'NATO/Italy',    note: 'NATO Joint Force Command South' },
  { id: 'nato_e3',       name: 'NATO AWACS Geilenkirchen', lat: 51.046, lon: 6.042,  type: 'radar',   country: 'NATO/Germany',  note: '18 E-3A Sentry — cooperative NATO AEW' },
  { id: 'souda_bay',     name: 'Souda Bay NAS',            lat: 35.531, lon: 24.070, type: 'naval',   country: 'Greece/US',     note: 'E. Mediterranean NATO naval hub' },

  // ── NORWAY / ARCTIC ───────────────────────────────────────────────────────
  { id: 'no_bodo',       name: 'Bodø Main Air Station',   lat: 67.269, lon: 14.365, type: 'airbase', country: 'Norway',        note: 'F-35A QRA — High North/Arctic' },
  { id: 'no_andoya',     name: 'Andøya Space / P-8',       lat: 69.292, lon: 16.145, type: 'airbase', country: 'Norway/US',     note: 'P-8A Arctic maritime patrol' },
  { id: 'no_ramsund',    name: 'Ramsund Naval Station',   lat: 68.516, lon: 16.858, type: 'naval',   country: 'Norway',        note: 'NATO submarine base' },

  // ── NETHERLANDS / BELGIUM ─────────────────────────────────────────────────
  { id: 'nl_volkel',     name: 'Volkel AFB',               lat: 51.657, lon: 5.708,  type: 'missile', country: 'Netherlands/NATO',note:'B61-12 DCA nuclear — F-35A' },
  { id: 'nl_leeuwarden', name: 'Leeuwarden AFB',           lat: 53.228, lon: 5.760,  type: 'airbase', country: 'Netherlands',   note: 'F-35A NATO QRA — North Sea' },
  { id: 'be_kleine',     name: 'Kleine Brogel AFB',        lat: 51.168, lon: 5.470,  type: 'missile', country: 'Belgium/NATO',  note: 'B61-12 DCA nuclear — F-35A (2025)' },

  // ── ASIA-PACIFIC ──────────────────────────────────────────────────────────
  { id: 'kadena',        name: 'Kadena AFB',               lat: 26.358, lon: 127.769,type: 'airbase', country: 'Japan/US',      note: 'Largest USAF base in Asia — F-15, U-2' },
  { id: 'yokosuka',      name: 'Yokosuka Naval Base',      lat: 35.290, lon: 139.668,type: 'naval',   country: 'Japan/US',      note: 'US 7th Fleet HQ' },
  { id: 'camp_humphreys',name: 'Camp Humphreys',           lat: 36.960, lon: 127.025,type: 'airbase', country: 'S.Korea/US',    note: 'Largest US military base overseas' },
  { id: 'osan',          name: 'Osan AFB',                 lat: 37.090, lon: 127.030,type: 'airbase', country: 'S.Korea/US',    note: 'A-10, F-16, RC-135' },
  { id: 'nk_sunan',      name: 'Sunan AB / Pyongyang Intl',lat:39.224, lon: 125.670,type: 'airbase', country: 'N.Korea',       note: 'KJU fleet, IL-76, missile tests' },
  { id: 'guam_andersen', name: 'Andersen AFB',             lat: 13.584, lon: 144.929,type: 'airbase', country: 'US',            note: 'B-52, B-2 Pacific bomber alert' },
  { id: 'taiwan_hsinchu',name: 'Hsinchu AFB',              lat: 24.817, lon: 120.939,type: 'airbase', country: 'Taiwan',        note: 'IDF + Mirage 2000' },
  { id: 'china_longtian',name: 'Longtian AFB',             lat: 25.665, lon: 119.764,type: 'airbase', country: 'China',         note: 'PLAAF opposite Taiwan Strait' },
  { id: 'china_sanya',   name: 'Yulin Naval Base',         lat: 18.223, lon: 109.548,type: 'naval',   country: 'China',         note: 'PLAN submarine base, S. China Sea' },
  { id: 'cn_fiery_cross',name: 'Fiery Cross Reef',         lat:  9.549, lon: 112.893,type: 'airbase', country: 'China',         note: 'Artificial island, J-11 base' },

  // ── USA ───────────────────────────────────────────────────────────────────
  { id: 'pentagon',      name: 'Pentagon / JBMHH',         lat: 38.871, lon: -77.056,type: 'radar',   country: 'US',            note: 'DoD HQ' },
  { id: 'norad',         name: 'Cheyenne Mountain NORAD',  lat: 38.744, lon:-104.846,type: 'radar',   country: 'US',            note: 'Nuclear-hardened C2' },
  { id: 'langley',       name: 'Langley-Eustis AFB',       lat: 37.082, lon: -76.360,type: 'airbase', country: 'US',            note: 'F-22 Raptor home' },
  { id: 'nellis',        name: 'Nellis AFB / Area 51',     lat: 36.234, lon:-115.034,type: 'airbase', country: 'US',            note: 'Red Flag exercises, stealth ops' },
];

// ── Type configurations ─────────────────────────────────────────────────────
const TYPE_CONFIG = {
  airbase:  { color: '#4af7ff', icon: 'AB', size: 11 },
  airport:  { color: '#00aaff', icon: 'AP', size: 11 },
  naval:    { color: '#3399ff', icon: 'NB', size: 11 },
  missile:  { color: '#ff6600', icon: 'MS', size: 11 },
  radar:    { color: '#00ff88', icon: 'RD', size: 11 },
};

function makeBaseIcon(cfg) {
  const sz = 48;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><circle cx="${sz/2}" cy="${sz/2}" r="${sz/2 - 2}" fill="rgba(5,8,16,0.8)" stroke="${cfg.color}" stroke-width="1.8"/><text x="${sz/2}" y="${sz/2+1}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-weight="bold" font-size="${cfg.size}" fill="${cfg.color}">${cfg.icon}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const _iconCache = {};
function getBaseIcon(type) {
  if (!_iconCache[type]) {
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.airbase;
    _iconCache[type] = makeBaseIcon(cfg);
  }
  return _iconCache[type];
}

const MilitaryBasesLayer = ({ viewer, visible, onSelect }) => {
  const entitiesRef = useRef([]);
  const dsRef       = useRef(null);

  const getDS = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (dsRef.current && !viewer.dataSources.contains(dsRef.current)) dsRef.current = null;
    if (!dsRef.current) {
      dsRef.current = new Cesium.CustomDataSource('military_bases');
      viewer.dataSources.add(dsRef.current);
    }
    return dsRef.current;
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    for (const e of entitiesRef.current) ds.entities.remove(e);
    entitiesRef.current = [];

    if (!visible) return;

    for (const base of BASES) {
      const cfg  = TYPE_CONFIG[base.type] || TYPE_CONFIG.airbase;
      const icon = getBaseIcon(base.type);

      const entity = ds.entities.add({
        id: `base-${base.id}`,
        position: Cesium.Cartesian3.fromDegrees(base.lon, base.lat, 100),
        billboard: {
          image: icon,
          width:  32,
          height: 32,
          verticalOrigin:  Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scaleByDistance: new Cesium.NearFarScalar(5e4, 1.4, 8e6, 0.4),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.0e7),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${base.country} · ${base.name}`,
          font: 'bold 13px "Share Tech Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString(cfg.color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 18),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          scaleByDistance: new Cesium.NearFarScalar(5e4, 1.2, 4e6, 0.0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        // Custom data for popup
        _milData: {
          type: 'base',
          id:   base.id,
          name: base.name,
          lat:  base.lat,
          lon:  base.lon,
          country: base.country,
          baseType: base.type,
          note: base.note,
        },
      });
      entitiesRef.current.push(entity);
    }
  }, [viewer, visible, getDS]);

  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (ds) ds.show = visible;
  }, [viewer, visible, getDS]);

  // Click selection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !onSelect) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (picked?.id?._milData?.type === 'base') {
        onSelect(picked.id._milData);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => { if (!handler.isDestroyed()) handler.destroy(); };
  }, [viewer, onSelect]);

  return null;
};

export default MilitaryBasesLayer;
