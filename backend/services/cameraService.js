/**
 * cameraService.js — curated list of publicly available live cameras
 * located in or near active conflict zones sourced from opencctv.org.
 *
 * All feeds are sourced from transportation agencies, weather services,
 * and other official public sources aggregated by opencctv.org.
 * No credentials required — all URLs are publicly accessible.
 *
 * Feed types:
 *   IFRAME  – embed URL rendered inside an <iframe> (YouTube, EarthCam, panomax …)
 *   IMAGE   – JPEG snapshot URL refreshed every 5 s
 */

export const CONFLICT_CAMERAS = [
  // ── Ukraine ─────────────────────────────────────────────────────────────────
  {
    id:         136316,
    name:       'Kyiv – Maidan Nezalezhnosti',
    location:   'Kyiv, Ukraine',
    country:    'UA',
    conflictZone: 'ukraine',
    lat:        50.4501,
    lon:        30.5234,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/-Q7FuPINDjA?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/ukraine/kyiv/kyiv/kyiv-maidan-nezalezhnosti-dw-136316',
  },
  {
    id:         136317,
    name:       'Kyiv – Sophia Square',
    location:   'Kyiv, Ukraine',
    country:    'UA',
    conflictZone: 'ukraine',
    lat:        50.4528,
    lon:        30.5147,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/NZK0ChTLb4I?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/ukraine/kyiv/kyiv/kyiv-sophia-square-136317',
  },
  {
    id:         136346,
    name:       'Sumy – City Panorama',
    location:   'Sumy Oblast, Ukraine (near Russian border)',
    country:    'UA',
    conflictZone: 'ukraine',
    lat:        50.9080,
    lon:        34.7985,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/XcDFb1bOIQQ?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/ukraine/sumy-oblast/sumy/sumy-city-panorama-136346',
  },
  {
    id:         136326,
    name:       'Odesa – April 10 Square',
    location:   'Odesa, Ukraine',
    country:    'UA',
    conflictZone: 'ukraine',
    lat:        46.4840,
    lon:        30.7380,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/9_SH86NwGyM?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/ukraine/odesa-oblast/odesa/odesa-april-10-square-136326',
  },
  {
    id:         136318,
    name:       'Odesa – Deribasovskaya Street',
    location:   'Odesa, Ukraine',
    country:    'UA',
    conflictZone: 'ukraine',
    lat:        46.4846,
    lon:        30.7402,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/5hHelJALhEo?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/ukraine/odesa-oblast/odesa/odesa-deribasovskaya-street-136318',
  },
  {
    id:         136328,
    name:       'Odesa – Opera Theater',
    location:   'Odesa, Ukraine',
    country:    'UA',
    conflictZone: 'ukraine',
    lat:        46.4860,
    lon:        30.7360,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/PWKjaA-wNho?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/ukraine/odesa-oblast/odesa/odesa-opera-theater-136328',
  },

  // ── Israel / Jerusalem ──────────────────────────────────────────────────────
  {
    id:         127066,
    name:       'Western Wall Live Cam',
    location:   'Jerusalem, Israel',
    country:    'IL',
    conflictZone: 'lebanon',
    lat:        31.7766,
    lon:        35.2338,
    feedType:   'IMAGE',
    feedUrl:    'https://www.earthcam.com/cams/includes/image.php?playbutton=0&logo=0&s=1&img=aYt6QmLtgmOpu%2F5KETCRNQ%3D%3D',
    sourceUrl:  'https://opencctv.org/cameras/israel/western-wall-cam-127066',
  },
  {
    id:         139084,
    name:       'Wailing Wall, Jerusalem',
    location:   'Jerusalem, Israel',
    country:    'IL',
    conflictZone: 'lebanon',
    lat:        31.7778,
    lon:        35.2299,
    feedType:   'IFRAME',
    feedUrl:    'https://share.earthcam.net/tJ90CoLmq7TzrY396Yd88FszUBQXSsaa2UfVVJUL4rU!.tJ90CoLmq7TzrY396Yd88Oz5cQ2aIzlk7JZQa_rfG-I!.tJ90CoLmq7TzrY396Yd88IeuFjluq6-N-qCt4Hnjc9w!',
    sourceUrl:  'https://opencctv.org/cameras/israel/wailing-wall-jerusalem-139084',
  },
  {
    id:         139082,
    name:       'Jerusalem Skyline – Inbal Hotel',
    location:   'Jerusalem, Israel',
    country:    'IL',
    conflictZone: 'lebanon',
    lat:        31.7706,
    lon:        35.2218,
    feedType:   'IFRAME',
    feedUrl:    'https://inbalhotel.panomax.com/',
    sourceUrl:  'https://opencctv.org/cameras/israel/jerusalem-skyline-from-inbal-hotel-139082',
  },

  // ── Taiwan Strait ───────────────────────────────────────────────────────────
  {
    id:         'tw-keelung-port',
    name:       'Keelung Harbour Approach',
    location:   'Keelung, Taiwan (Taiwan Strait entry)',
    country:    'TW',
    conflictZone: 'taiwan_strait',
    lat:        25.1276,
    lon:        121.7392,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/cEIpZj1YRAU?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/taiwan',
  },
  {
    id:         'tw-taipei-101',
    name:       'Taipei 101 City Panorama',
    location:   'Taipei, Taiwan',
    country:    'TW',
    conflictZone: 'taiwan_strait',
    lat:        25.0330,
    lon:        121.5654,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/5t3VeXFl7DU?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras/taiwan',
  },

  // ── Red Sea / Gulf of Aden ──────────────────────────────────────────────────
  {
    id:         'ye-aden-port',
    name:       'Aden Port Approach',
    location:   'Aden, Yemen (Gulf of Aden)',
    country:    'YE',
    conflictZone: 'red_sea',
    lat:        12.8000,
    lon:        44.9800,
    feedType:   'IFRAME',
    feedUrl:    'https://www.youtube.com/embed/K9p2fxbgq_g?autoplay=1&mute=1',
    sourceUrl:  'https://opencctv.org/cameras',
  },
];

/** Returns the full camera list. Designed to be extended with live scraping. */
export function getCameras() {
  return CONFLICT_CAMERAS;
}
