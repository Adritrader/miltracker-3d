/**
 * cameraService.js — curated list of publicly available live cameras
 * located in or near active conflict zones and strategic military chokepoints.
 *
 * Sources: YouTube 24/7 live streams, EarthCam, panomax, Skyline Webcams,
 * and other publicly accessible webcam feeds. No credentials required.
 *
 * Feed types:
 *   IFRAME  – embed URL rendered inside an <iframe> (YouTube, EarthCam, panomax …)
 *   IMAGE   – JPEG snapshot URL refreshed every 5 s
 */

export const CONFLICT_CAMERAS = [

  // ══════════════════════════════════════════════════════════════════
  // UKRAINE — active war zone
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ua-kyiv-maidan',
    name: 'Kyiv – Maidan Nezalezhnosti',
    location: 'Kyiv, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 50.4501, lon: 30.5234,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/-Q7FuPINDjA?autoplay=1&mute=1',
  },
  {
    id: 'ua-kyiv-sophia',
    name: 'Kyiv – Sophia Square',
    location: 'Kyiv, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 50.4528, lon: 30.5147,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/NZK0ChTLb4I?autoplay=1&mute=1',
  },
  {
    id: 'ua-kyiv-podil',
    name: 'Kyiv – Podil District',
    location: 'Kyiv, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 50.4649, lon: 30.5186,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/BmBcQqWNAiI?autoplay=1&mute=1',
  },
  {
    id: 'ua-sumy',
    name: 'Sumy – City Panorama',
    location: 'Sumy Oblast, Ukraine (near Russian border)',
    country: 'UA', conflictZone: 'ukraine',
    lat: 50.9080, lon: 34.7985,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/XcDFb1bOIQQ?autoplay=1&mute=1',
  },
  {
    id: 'ua-kharkiv',
    name: 'Kharkiv – Freedom Square',
    location: 'Kharkiv, Ukraine (near front)',
    country: 'UA', conflictZone: 'ukraine',
    lat: 49.9935, lon: 36.2304,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/fKgcjb3SXG8?autoplay=1&mute=1',
  },
  {
    id: 'ua-lviv',
    name: 'Lviv – Rynok Square',
    location: 'Lviv, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 49.8419, lon: 24.0315,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/DPFS7YWDNHE?autoplay=1&mute=1',
  },
  {
    id: 'ua-dnipro',
    name: 'Dnipro – City Center',
    location: 'Dnipro (Dnipropetrovsk), Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 48.4647, lon: 35.0462,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/7nFDpDqC6Zk?autoplay=1&mute=1',
  },
  {
    id: 'ua-odesa-april',
    name: 'Odesa – April 10 Square',
    location: 'Odesa, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 46.4840, lon: 30.7380,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/9_SH86NwGyM?autoplay=1&mute=1',
  },
  {
    id: 'ua-odesa-derib',
    name: 'Odesa – Deribasovskaya Street',
    location: 'Odesa, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 46.4846, lon: 30.7402,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/5hHelJALhEo?autoplay=1&mute=1',
  },
  {
    id: 'ua-odesa-opera',
    name: 'Odesa – Opera Theater',
    location: 'Odesa, Ukraine',
    country: 'UA', conflictZone: 'ukraine',
    lat: 46.4860, lon: 30.7360,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/PWKjaA-wNho?autoplay=1&mute=1',
  },
  {
    id: 'ua-zaporizhzhia',
    name: 'Zaporizhzhia – City Square',
    location: 'Zaporizhzhia, Ukraine (near nuclear plant)',
    country: 'UA', conflictZone: 'ukraine',
    lat: 47.8388, lon: 35.1396,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/WpDxJVGFTF0?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // ISRAEL / LEBANON — active conflict front
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'il-western-wall',
    name: 'Western Wall Live Cam',
    location: 'Jerusalem, Israel',
    country: 'IL', conflictZone: 'lebanon',
    lat: 31.7766, lon: 35.2338,
    feedType: 'IMAGE',
    feedUrl: 'https://www.earthcam.com/cams/includes/image.php?playbutton=0&logo=0&s=1&img=aYt6QmLtgmOpu%2F5KETCRNQ%3D%3D',
  },
  {
    id: 'il-wailing-wall',
    name: 'Kotel – Wailing Wall',
    location: 'Jerusalem, Israel',
    country: 'IL', conflictZone: 'lebanon',
    lat: 31.7778, lon: 35.2299,
    feedType: 'IFRAME',
    feedUrl: 'https://share.earthcam.net/tJ90CoLmq7TzrY396Yd88FszUBQXSsaa2UfVVJUL4rU!.tJ90CoLmq7TzrY396Yd88Oz5cQ2aIzlk7JZQa_rfG-I!.tJ90CoLmq7TzrY396Yd88IeuFjluq6-N-qCt4Hnjc9w!',
  },
  {
    id: 'il-jerusalem-skyline',
    name: 'Jerusalem Skyline Panorama',
    location: 'Jerusalem, Israel',
    country: 'IL', conflictZone: 'lebanon',
    lat: 31.7706, lon: 35.2218,
    feedType: 'IFRAME',
    feedUrl: 'https://inbalhotel.panomax.com/',
  },
  {
    id: 'il-tel-aviv-rabin',
    name: 'Tel Aviv – Rabin Square',
    location: 'Tel Aviv, Israel',
    country: 'IL', conflictZone: 'lebanon',
    lat: 32.0853, lon: 34.7818,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1',
  },
  {
    id: 'il-haifa-port',
    name: 'Haifa – Port Panorama',
    location: 'Haifa, Israel (naval base city)',
    country: 'IL', conflictZone: 'lebanon',
    lat: 32.8191, lon: 34.9983,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/IVkWBjWvJT8?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // TAIWAN STRAIT — high-tension zone
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'tw-keelung-port',
    name: 'Keelung Harbour Approach',
    location: 'Keelung, Taiwan (Taiwan Strait entry)',
    country: 'TW', conflictZone: 'taiwan_strait',
    lat: 25.1276, lon: 121.7392,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/cEIpZj1YRAU?autoplay=1&mute=1',
  },
  {
    id: 'tw-taipei-101',
    name: 'Taipei 101 City Panorama',
    location: 'Taipei, Taiwan',
    country: 'TW', conflictZone: 'taiwan_strait',
    lat: 25.0330, lon: 121.5654,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/5t3VeXFl7DU?autoplay=1&mute=1',
  },
  {
    id: 'tw-kaohsiung',
    name: 'Kaohsiung – Port District',
    location: 'Kaohsiung, Taiwan (major naval port)',
    country: 'TW', conflictZone: 'taiwan_strait',
    lat: 22.6273, lon: 120.3014,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/tHXEIGCVxwk?autoplay=1&mute=1',
  },
  {
    id: 'tw-tamsui',
    name: 'Tamsui – River & Strait View',
    location: 'New Taipei, Taiwan (strait-facing coast)',
    country: 'TW', conflictZone: 'taiwan_strait',
    lat: 25.1694, lon: 121.4415,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1',
  },
  {
    id: 'tw-hualien',
    name: 'Hualien – East Coast',
    location: 'Hualien, Taiwan (Pacific coast, PLAAF patrol zone)',
    country: 'TW', conflictZone: 'taiwan_strait',
    lat: 23.9771, lon: 121.6044,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/g4y3xN4N9Jg?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // BOSPHORUS STRAIT — strategic maritime chokepoint
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'tr-bosphorus-main',
    name: 'Bosphorus Strait – Live',
    location: 'Istanbul, Turkey (Black Sea gateway)',
    country: 'TR', conflictZone: 'bosphorus',
    lat: 41.1171, lon: 29.0609,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/PtVG7Xt4C5k?autoplay=1&mute=1',
  },
  {
    id: 'tr-istanbul-levent',
    name: 'Istanbul – Levent Skyline',
    location: 'Istanbul, Turkey',
    country: 'TR', conflictZone: 'bosphorus',
    lat: 41.0809, lon: 29.0110,
    feedType: 'IFRAME',
    feedUrl: 'https://www.skylinewebcams.com/en/webcam/turkiye/istanbul/istanbul/levent.html',
  },
  {
    id: 'tr-istanbul-galata',
    name: 'Istanbul – Galata Bridge & Horn',
    location: 'Istanbul, Turkey',
    country: 'TR', conflictZone: 'bosphorus',
    lat: 41.0200, lon: 28.9740,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/R3WMQOBXB4A?autoplay=1&mute=1',
  },
  {
    id: 'tr-canakkale',
    name: 'Çanakkale – Dardanelles Strait',
    location: 'Çanakkale, Turkey (Aegean gateway)',
    country: 'TR', conflictZone: 'bosphorus',
    lat: 40.1553, lon: 26.4142,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/6HijZ3V2MYs?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // KOREAN PENINSULA — DMZ / active standoff
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'kr-seoul-gwanghwamun',
    name: 'Seoul – Gwanghwamun Square',
    location: 'Seoul, South Korea',
    country: 'KR', conflictZone: 'korea',
    lat: 37.5759, lon: 126.9768,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/OtaHXHfPRGs?autoplay=1&mute=1',
  },
  {
    id: 'kr-seoul-namsan',
    name: 'Seoul – Namsan Tower View',
    location: 'Seoul, South Korea',
    country: 'KR', conflictZone: 'korea',
    lat: 37.5512, lon: 126.9882,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/yxpGVKxI89k?autoplay=1&mute=1',
  },
  {
    id: 'kr-busan-port',
    name: 'Busan – Port & Strait View',
    location: 'Busan, South Korea (2nd fleet port)',
    country: 'KR', conflictZone: 'korea',
    lat: 35.1796, lon: 129.0756,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/MlZd6Yd7kBk?autoplay=1&mute=1',
  },
  {
    id: 'kr-incheon',
    name: 'Incheon – Harbor Live',
    location: 'Incheon, South Korea (Yellow Sea)',
    country: 'KR', conflictZone: 'korea',
    lat: 37.4563, lon: 126.7052,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/aHrCkVxL9oE?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // BALTIC SEA — NATO–Russia frontier
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ee-tallinn',
    name: 'Tallinn – Old Town Panorama',
    location: 'Tallinn, Estonia (NATO frontline state)',
    country: 'EE', conflictZone: 'baltic',
    lat: 59.4370, lon: 24.7536,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/F3C3SR4p5vw?autoplay=1&mute=1',
  },
  {
    id: 'lv-riga',
    name: 'Riga – Old Town Live',
    location: 'Riga, Latvia (NATO)',
    country: 'LV', conflictZone: 'baltic',
    lat: 56.9496, lon: 24.1052,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/RDi76MxdMhc?autoplay=1&mute=1',
  },
  {
    id: 'lt-vilnius',
    name: 'Vilnius – Cathedral Square',
    location: 'Vilnius, Lithuania (NATO)',
    country: 'LT', conflictZone: 'baltic',
    lat: 54.6872, lon: 25.2797,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/ibWwE_oVFhA?autoplay=1&mute=1',
  },
  {
    id: 'fi-helsinki',
    name: 'Helsinki – South Harbour',
    location: 'Helsinki, Finland (Russia land border)',
    country: 'FI', conflictZone: 'baltic',
    lat: 60.1674, lon: 24.9522,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/gJsgSBfBGPw?autoplay=1&mute=1',
  },
  {
    id: 'pl-gdansk',
    name: 'Gdańsk – Baltic Port',
    location: 'Gdańsk, Poland (Suwalki Gap corridor)',
    country: 'PL', conflictZone: 'baltic',
    lat: 54.3520, lon: 18.6466,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/nbW7GA2d0SY?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // BLACK SEA — NATO maritime operations
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ro-constanta',
    name: 'Constanța – Black Sea Port',
    location: 'Constanța, Romania (NATO Black Sea flank)',
    country: 'RO', conflictZone: 'black_sea',
    lat: 44.1598, lon: 28.6348,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/hLt7O_RdBrI?autoplay=1&mute=1',
  },
  {
    id: 'bg-varna',
    name: 'Varna – Black Sea Waterfront',
    location: 'Varna, Bulgaria (Black Sea NATO port)',
    country: 'BG', conflictZone: 'black_sea',
    lat: 43.2141, lon: 27.9147,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/Nj6AlKfR47Q?autoplay=1&mute=1',
  },
  {
    id: 'ge-batumi',
    name: 'Batumi – Black Sea Coast',
    location: 'Batumi, Georgia (Russia–Georgia tension)',
    country: 'GE', conflictZone: 'black_sea',
    lat: 41.6417, lon: 41.6367,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/p3Vj9RFQiLA?autoplay=1&mute=1',
  },
  {
    id: 'ge-tbilisi',
    name: 'Tbilisi – Freedom Square',
    location: 'Tbilisi, Georgia',
    country: 'GE', conflictZone: 'black_sea',
    lat: 41.6941, lon: 44.8337,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/dRfkM7UhHxk?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // SOUTH CHINA SEA — competing territorial claims
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ph-manila-bay',
    name: 'Manila Bay – Harbor Cam',
    location: 'Manila, Philippines (SCS claimant)',
    country: 'PH', conflictZone: 'south_cs',
    lat: 14.5901, lon: 120.9622,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/OznDJBi3bFY?autoplay=1&mute=1',
  },
  {
    id: 'vn-danang',
    name: 'Da Nang – Beach & Port',
    location: 'Da Nang, Vietnam (near Paracel Islands)',
    country: 'VN', conflictZone: 'south_cs',
    lat: 16.0544, lon: 108.2022,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/hbkLMLjP3sU?autoplay=1&mute=1',
  },
  {
    id: 'hk-victoria-harbour',
    name: 'Hong Kong – Victoria Harbour',
    location: 'Hong Kong, China (SCS gateway)',
    country: 'HK', conflictZone: 'south_cs',
    lat: 22.2855, lon: 114.1577,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/cFZ4YTGJHCY?autoplay=1&mute=1',
  },
  {
    id: 'vn-hochiminh',
    name: 'Ho Chi Minh City – Saigon River',
    location: 'Ho Chi Minh City, Vietnam',
    country: 'VN', conflictZone: 'south_cs',
    lat: 10.7769, lon: 106.7009,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/0M2jrSLyLOI?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // PERSIAN GULF — naval presence zone
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ae-dubai-marina',
    name: 'Dubai – Marina Skyline',
    location: 'Dubai, UAE (Persian Gulf)',
    country: 'AE', conflictZone: 'persiangulf',
    lat: 25.0819, lon: 55.1367,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/KKJkDjdW9BI?autoplay=1&mute=1',
  },
  {
    id: 'ae-dubai-burjal',
    name: 'Dubai – Burj Al Arab Coast',
    location: 'Dubai, UAE',
    country: 'AE', conflictZone: 'persiangulf',
    lat: 25.1412, lon: 55.1853,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/VCflPgzRnkk?autoplay=1&mute=1',
  },
  {
    id: 'ae-abudhabi',
    name: 'Abu Dhabi – Corniche Live',
    location: 'Abu Dhabi, UAE (5th Fleet area)',
    country: 'AE', conflictZone: 'persiangulf',
    lat: 24.4539, lon: 54.3773,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/JNjHpFCNGqo?autoplay=1&mute=1',
  },

  // ══════════════════════════════════════════════════════════════════
  // RED SEA & HORN OF AFRICA — Houthi threat corridor
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'ye-aden-port',
    name: 'Aden Harbour',
    location: 'Aden, Yemen (Gulf of Aden)',
    country: 'YE', conflictZone: 'red_sea',
    lat: 12.8000, lon: 44.9800,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/K9p2fxbgq_g?autoplay=1&mute=1',
  },
  {
    id: 'il-eilat',
    name: 'Eilat – Red Sea Port',
    location: 'Eilat, Israel (Red Sea tip)',
    country: 'IL', conflictZone: 'red_sea',
    lat: 29.5581, lon: 34.9482,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/GBhYfQvz80A?autoplay=1&mute=1',
  },
  {
    id: 'eg-suez-canal',
    name: 'Suez Canal – Port Said Entrance',
    location: 'Port Said, Egypt (Suez Canal)',
    country: 'EG', conflictZone: 'red_sea',
    lat: 31.2565, lon: 32.2841,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/bGl7pX5UTDs?autoplay=1&mute=1',
  },
  {
    id: 'dj-djibouti',
    name: 'Djibouti – Doraleh Port',
    location: 'Djibouti (US/French/Chinese naval base)',
    country: 'DJ', conflictZone: 'red_sea',
    lat: 11.5892, lon: 43.1456,
    feedType: 'IFRAME',
    feedUrl: 'https://www.youtube.com/embed/9mBYOgCzF9M?autoplay=1&mute=1',
  },

];

/** Returns the full camera list. */
export function getCameras() {
  return CONFLICT_CAMERAS;
}
