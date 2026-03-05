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

  // ── USA — Command & Control ───────────────────────────────────────────────
  { id: 'pentagon',       name: 'Pentagon / JBMHH',            lat: 38.871, lon: -77.056, type: 'radar',   country: 'US', note: 'DoD / Joint Force HQ' },
  { id: 'norad',          name: 'Cheyenne Mountain NORAD',     lat: 38.744, lon:-104.846, type: 'radar',   country: 'US', note: 'Nuclear-hardened C2, NORAD/USNORTHCOM' },
  { id: 'jb_andrews',     name: 'Joint Base Andrews',          lat: 38.810, lon: -76.866, type: 'airbase', country: 'US', note: 'Air Force One, 89th AW — presidential airlift' },
  { id: 'peterson',       name: 'Peterson SFB / NORTHCOM',     lat: 38.820, lon:-104.700, type: 'radar',   country: 'US', note: 'USNORTHCOM/USSPACECOM HQ' },
  { id: 'macdill',        name: 'MacDill AFB',                 lat: 27.849, lon: -82.521, type: 'airbase', country: 'US', note: 'USCENTCOM + USSOCOM HQ, KC-135' },
  { id: 'hurlburt',       name: 'Hurlburt Field',              lat: 30.428, lon: -86.689, type: 'airbase', country: 'US', note: 'AFSOC — AC-130, SOF gunships' },

  // ── USA — Fighter / Strike ─────────────────────────────────────────────────
  { id: 'langley',        name: 'JB Langley-Eustis',           lat: 37.082, lon: -76.360, type: 'airbase', country: 'US', note: 'F-22 Raptor — 1st FW, ACC HQ' },
  { id: 'nellis',         name: 'Nellis AFB',                   lat: 36.234, lon:-115.034, type: 'airbase', country: 'US', note: 'Red Flag, USAF Warfare Center, F-35A/F-22' },
  { id: 'tyndall',        name: 'Tyndall AFB',                  lat: 30.069, lon: -85.609, type: 'airbase', country: 'US', note: 'F-22 Raptor rebuild — 325th FW' },
  { id: 'eglin',          name: 'Eglin AFB',                    lat: 30.483, lon: -86.527, type: 'airbase', country: 'US', note: 'F-35A, weapons test — 96th TW' },
  { id: 'seymour_j',      name: 'Seymour Johnson AFB',          lat: 35.338, lon: -77.960, type: 'airbase', country: 'US', note: 'F-15E Strike Eagle — 4th FW' },
  { id: 'shaw',           name: 'Shaw AFB',                     lat: 33.972, lon: -80.470, type: 'airbase', country: 'US', note: 'F-16C/D USAF ACC — 9th AF HQ' },
  { id: 'jb_elmendorf',   name: 'JB Elmendorf-Richardson',     lat: 61.250, lon:-149.798, type: 'airbase', country: 'US', note: 'F-22 Raptors — Pacific/Arctic defense' },
  { id: 'eielson',        name: 'Eielson AFB',                  lat: 64.666, lon:-147.102, type: 'airbase', country: 'US', note: 'F-35A Arctic — 354th FW, PACAF' },
  { id: 'jb_pearl_hickam',name: 'JB Pearl Harbor-Hickam',      lat: 21.335, lon:-157.968, type: 'airbase', country: 'US', note: 'PACAF HQ, F-22, C-17 — Hawaii' },
  { id: 'jb_lewis',       name: 'JB Lewis-McChord',             lat: 47.131, lon:-122.476, type: 'airbase', country: 'US', note: 'C-17 Globemaster, I Corps — largest JBLM' },
  { id: 'travis',         name: 'Travis AFB',                   lat: 38.263, lon:-121.927, type: 'airbase', country: 'US', note: 'C-17, KC-10 strategic airlift hub' },
  { id: 'fairchild',      name: 'Fairchild AFB',                lat: 47.615, lon:-117.656, type: 'airbase', country: 'US', note: 'KC-135 tanker wing — 92nd ARW' },
  { id: 'edwards',        name: 'Edwards AFB',                  lat: 34.905, lon:-117.884, type: 'airbase', country: 'US', note: 'USAF Test Pilot School, X-plane ops' },
  { id: 'luke',           name: 'Luke AFB',                     lat: 33.535, lon:-112.383, type: 'airbase', country: 'US', note: 'Largest F-35A training base — 56th FW' },
  { id: 'hill',           name: 'Hill AFB',                     lat: 41.124, lon:-111.973, type: 'airbase', country: 'US', note: 'F-35A — 388th FW, ICBM depot' },
  { id: 'jb_charleston',  name: 'JB Charleston',                lat: 32.899, lon: -80.040, type: 'airbase', country: 'US', note: 'C-17 Globemaster III — 437th AW' },
  { id: 'dover',          name: 'Dover AFB',                    lat: 39.129, lon: -75.466, type: 'airbase', country: 'US', note: 'C-5M Galaxy, strategic airlift + mortuary' },
  { id: 'jb_mcguire',     name: 'JB McGuire-Dix-Lakehurst',    lat: 40.015, lon: -74.595, type: 'airbase', country: 'US', note: 'KC-10, C-17 — 305th AMW' },
  { id: 'pope',           name: 'Pope Field (Fort Liberty)',    lat: 35.171, lon: -79.015, type: 'airbase', country: 'US', note: 'C-130J, 82nd Airborne support' },
  { id: 'little_rock',    name: 'Little Rock AFB',              lat: 34.916, lon: -92.150, type: 'airbase', country: 'US', note: 'C-130J Hercules — largest C-130 wing' },
  { id: 'dyess',          name: 'Dyess AFB',                    lat: 32.421, lon: -99.854, type: 'airbase', country: 'US', note: 'B-1B Lancer + C-130J' },
  { id: 'ellsworth',      name: 'Ellsworth AFB',                lat: 44.145, lon: -103.103,type: 'airbase', country: 'US', note: 'B-21 Raider (replacing B-1B) — 28th BW' },
  { id: 'barksdale',      name: 'Barksdale AFB',                lat: 32.502, lon: -93.663, type: 'airbase', country: 'US', note: 'B-52H Stratofortress — AFGSC, 2nd BW' },
  { id: 'whiteman',       name: 'Whiteman AFB',                 lat: 38.726, lon: -93.548, type: 'airbase', country: 'US', note: 'B-2 Spirit stealth bomber — 509th BW' },
  { id: 'offutt',         name: 'Offutt AFB',                   lat: 41.118, lon: -95.913, type: 'radar',   country: 'US', note: 'USSTRATCOM HQ — nuclear command' },

  // ── USA — ICBM Fields ──────────────────────────────────────────────────────
  { id: 'warren_afb',     name: 'F.E. Warren AFB',              lat: 41.140, lon:-104.860, type: 'missile', country: 'US', note: 'ICBM wing — 150 Minuteman III (largest)' },
  { id: 'malmstrom',      name: 'Malmstrom AFB',                lat: 47.507, lon:-111.183, type: 'missile', country: 'US', note: '150 Minuteman III ICBMs — 341st MW' },
  { id: 'minot',          name: 'Minot AFB',                    lat: 48.416, lon:-101.358, type: 'missile', country: 'US', note: 'B-52H + 150 Minuteman III — dual-capable' },

  // ── USA — Naval Bases ──────────────────────────────────────────────────────
  { id: 'norfolk',        name: 'Naval Station Norfolk',        lat: 36.942, lon: -76.289, type: 'naval',   country: 'US', note: 'Largest naval base in world — carriers, destroyers' },
  { id: 'nb_san_diego',   name: 'Naval Base San Diego',         lat: 32.680, lon:-117.136, type: 'naval',   country: 'US', note: 'Largest West Coast base — LHD, CG, DDG' },
  { id: 'nb_bremerton',   name: 'Naval Base Kitsap-Bremerton',  lat: 47.566, lon:-122.624, type: 'naval',   country: 'US', note: 'SSBN Trident + carrier maintenance (CVN)' },
  { id: 'mayport',        name: 'Naval Station Mayport',        lat: 30.391, lon: -81.423, type: 'naval',   country: 'US', note: 'Atlantic Fleet destroyers, amphibious' },
  { id: 'kings_bay',      name: 'Naval Sub Base Kings Bay',     lat: 30.797, lon: -81.556, type: 'naval',   country: 'US', note: 'SSBN Ohio-class Trident — 24 SLBMs each' },
  { id: 'groton',         name: 'Naval Sub Base New London',    lat: 41.362, lon: -72.089, type: 'naval',   country: 'US', note: 'US submarine school + SSN/SSGN base' },
  { id: 'nas_pensacola',  name: 'NAS Pensacola',                lat: 30.352, lon: -87.317, type: 'naval',   country: 'US', note: 'Naval Aviation HQ + Blue Angels home' },
  { id: 'nas_jacksonville',name:'NAS Jacksonville',             lat: 30.235, lon: -81.681, type: 'naval',   country: 'US', note: 'P-8A Poseidon, E-6B TACAMO' },
  { id: 'ns_everett',     name: 'Naval Station Everett',        lat: 48.009, lon:-122.229, type: 'naval',   country: 'US', note: 'Carrier strike group forward homeport (CVN)' },
  { id: 'nas_lemoore',    name: 'NAS Lemoore',                  lat: 36.333, lon:-119.952, type: 'naval',   country: 'US', note: 'F/A-18E/F Super Hornet — largest fighter base' },
  { id: 'nas_oceana',     name: 'NAS Oceana',                   lat: 36.820, lon: -76.034, type: 'naval',   country: 'US', note: 'F/A-18 home — East Coast master jet base' },
  { id: 'nas_whidbey',    name: 'NAS Whidbey Island',           lat: 48.352, lon:-122.655, type: 'naval',   country: 'US', note: 'EA-18G Growler EW — VAQ squadrons' },
  { id: 'dam_neck',       name: 'Dam Neck Annex (SEAL Team 6)', lat: 36.681, lon: -76.018, type: 'radar',   country: 'US', note: 'DEVGRU (SEAL Team 6) — Tier 1 SOF' },

  // ── AMERICAS ──────────────────────────────────────────────────────────────
  { id: 'soto_cano',      name: 'Soto Cano AB (Honduras)',      lat: 14.382, lon: -87.621, type: 'airbase', country: 'US/Honduras', note: 'USSOUTHCOM JTF-Bravo, UH-60, C-130' },
  { id: 'comalapa',       name: 'Comalapa Forward Op (El Sal)', lat: 13.441, lon: -89.056, type: 'airbase', country: 'US/El Salv.', note: 'DEA counter-narco forward base' },
  { id: 'aruba_ream',     name: 'Reina Beatrix Fwd (Aruba)',    lat: 12.501, lon: -70.015, type: 'airbase', country: 'US/NL',       note: 'USCG/US forward operating location, Caribbean' },
  { id: 'curacao_fol',    name: 'Hato FOL (Curaçao)',           lat: 12.189, lon: -68.960, type: 'airbase', country: 'US/NL',       note: 'USCG P-3C counter-drug ops' },
  { id: 'canada_cold_lk', name: 'Cold Lake AFB (Canada)',       lat: 54.405, lon:-110.280, type: 'airbase', country: 'Canada',      note: 'CF-18/F-35 (planned), NORAD QRA' },
  { id: 'canada_bagotville',name:'Bagotville AFB (Canada)',     lat: 48.331, lon: -70.996, type: 'airbase', country: 'Canada',      note: 'CF-18 — NORAD Eastern QRA' },
  { id: 'canada_esquimalt',name:'CFB Esquimalt (Canada)',       lat: 48.435, lon:-123.424, type: 'naval',   country: 'Canada',      note: 'RCN Pacific Fleet HQ' },
  { id: 'canada_halifax', name: 'CFB Halifax (Canada)',         lat: 44.629, lon: -63.585, type: 'naval',   country: 'Canada',      note: 'RCN Atlantic Fleet — destroyers, submarines' },
  { id: 'brazil_aeronautica',name:'Anápolis AFB (Brazil)',      lat:-16.356, lon: -48.964, type: 'airbase', country: 'Brazil',      note: 'FAB F-39 Gripen NG home — 1st GAvCA' },
  { id: 'colombia_tres',  name: 'Tres Esquinas AB (Colombia)',  lat:  0.746, lon: -75.234, type: 'airbase', country: 'Colombia/US', note: 'FARC/ELN counter-insurgency ops, US liaison' },
  { id: 'chile_punta',    name: 'Punta Arenas AFB (Chile)',     lat:-53.002, lon: -70.845, type: 'airbase', country: 'Chile',       note: 'FAC — Antarctic gateway, maritime patrol' },
  { id: 'gtmo',           name: 'Guantanamo Bay NB (Cuba)',     lat: 19.906, lon: -75.095, type: 'naval',   country: 'US',          note: 'Oldest US overseas base, detention facility' },
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
    ds.show = visible;

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
          disableDepthTestDistance: 2e6,
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
          disableDepthTestDistance: 2e6,
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

  // Click selection handled centrally by Globe3D (§0.18)

  return null;
};

export default MilitaryBasesLayer;
