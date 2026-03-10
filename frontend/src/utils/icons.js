/**
 * SVG icons encoded as data URIs for Cesium billboards
 */

// Military jet silhouette (white, transparent background)
export const AIRCRAFT_SVG = (heading = 0, color = '#ffffff') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
    <g transform="rotate(${heading}, 16, 16)">
      <!-- Body -->
      <polygon points="16,2 19,14 16,18 13,14" fill="${color}" opacity="0.95"/>
      <!-- Wings -->
      <polygon points="13,14 2,22 8,22 16,18 24,22 30,22 19,14" fill="${color}" opacity="0.85"/>
      <!-- Tail -->
      <polygon points="16,18 14,26 16,28 18,26" fill="${color}" opacity="0.8"/>
      <!-- Tail fins -->
      <polygon points="14,22 10,28 14,27" fill="${color}" opacity="0.7"/>
      <polygon points="18,22 22,28 18,27" fill="${color}" opacity="0.7"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Helicopter silhouette (top-down view, rotor blades + elongated body)
export const HELICOPTER_SVG = (heading = 0, color = '#ffffff') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
    <g transform="rotate(${heading}, 16, 16)">
      <!-- Main rotor blades -->
      <ellipse cx="16" cy="16" rx="13" ry="2.5" fill="${color}" opacity="0.7"/>
      <ellipse cx="16" cy="16" rx="2.5" ry="13" fill="${color}" opacity="0.7"/>
      <!-- Hub -->
      <circle cx="16" cy="16" r="2.5" fill="${color}" opacity="1"/>
      <!-- Fuselage -->
      <ellipse cx="16" cy="19" rx="3.5" ry="6" fill="${color}" opacity="0.95"/>
      <!-- Tail boom -->
      <rect x="15" y="24" width="2" height="5" fill="${color}" opacity="0.8"/>
      <!-- Tail rotor -->
      <ellipse cx="16" cy="29" rx="4" ry="1" fill="${color}" opacity="0.65"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Ship silhouette (white, top-down view)
export const SHIP_SVG = (heading = 0, color = '#00aaff') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
    <g transform="rotate(${heading}, 16, 16)">
      <!-- Hull -->
      <ellipse cx="16" cy="16" rx="5" ry="13" fill="${color}" opacity="0.9"/>
      <!-- Bridge -->
      <rect x="13" y="11" width="6" height="8" rx="1" fill="${color}" opacity="0.7"/>
      <!-- Bow -->
      <polygon points="11,5 16,1 21,5" fill="${color}" opacity="0.95"/>
      <!-- Stern -->
      <rect x="12" y="27" width="8" height="2" rx="1" fill="${color}" opacity="0.6"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// News pin icon
export const NEWS_SVG = (color = '#ffaa00') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
    <circle cx="12" cy="10" r="7" fill="${color}" opacity="0.9"/>
    <polygon points="9,16 15,16 12,23" fill="${color}" opacity="0.9"/>
    <text x="12" y="14" text-anchor="middle" fill="#000" font-size="10" font-weight="bold" font-family="monospace">!</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Alert pin icon
export const ALERT_SVG = (color = '#ff3b3b') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="44" height="44">
    <polygon points="16,2 30,28 2,28" fill="${color}" opacity="0.9"/>
    <text x="16" y="24" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="monospace">!</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Get color based on country
export function getAircraftColor(country) {
  const colors = {
    'United States': '#4488ff',
    'United Kingdom': '#4488ff',
    'France': '#0055aa',
    'Germany': '#555555',
    'Russia': '#cc2222',
    'China': '#dd1111',
    'Israel': '#0066cc',
    'Turkey': '#cc4400',
    'Iran': '#008800',
    'Ukraine': '#ffcc00',
    'North Korea': '#884400',
  };
  return colors[country] || '#ffffff';
}

/**
 * Altitude → color gradient (HSL interpolation)
 * Ground/low → cyan, mid → green/yellow, high → orange/red
 * @param {number} altM  Altitude in metres (barometric or geometric)
 * @returns {string} CSS hex color
 */
export function getAltitudeColor(altM = 0) {
  // Quantize to 500 m steps for cache efficiency (~30 distinct colours)
  const alt = Math.round(Math.max(0, Math.min(altM, 15000)) / 500) * 500;
  const t = alt / 15000; // 0 (ground) → 1 (high)
  // Gradient: cyan → green → yellow → orange → red
  let r, g, b;
  if (t < 0.25)      { const s = t / 0.25;       r = 0;             g = 255;           b = 255 * (1 - s); }  // cyan → green
  else if (t < 0.5)  { const s = (t - 0.25) / 0.25; r = 255 * s;   g = 255;           b = 0; }              // green → yellow
  else if (t < 0.75) { const s = (t - 0.5) / 0.25;  r = 255;       g = 255 * (1 - s); b = 0; }              // yellow → orange/red
  else               { const s = (t - 0.75) / 0.25;  r = 255;      g = 0;             b = 0; }              // red
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function getShipColor(flag) {
  const colors = {
    US: '#4488ff', UK: '#4488ff', FR: '#0055aa', DE: '#555555',
    RU: '#cc2222', CN: '#dd1111', IL: '#0066cc', TR: '#cc4400',
    NO: '#cc0000', NL: '#ff6600',
  };
  return colors[flag] || '#00aaff';
}
