/**
 * Client-side news geocoder
 * Matches news headlines to known conflict locations
 */

const KNOWN_LOCATIONS = {
  'ukraine': { lat: 48.38, lon: 31.17 },
  'kyiv': { lat: 50.45, lon: 30.52 },
  'kharkiv': { lat: 49.99, lon: 36.23 },
  'zaporizhzhia': { lat: 47.84, lon: 35.14 },
  'odessa': { lat: 46.47, lon: 30.73 },
  'mariupol': { lat: 47.10, lon: 37.56 },
  'donetsk': { lat: 48.02, lon: 37.80 },
  'russia': { lat: 55.75, lon: 37.62 },
  'moscow': { lat: 55.75, lon: 37.62 },
  'belgorod': { lat: 50.60, lon: 36.62 },
  'kursk': { lat: 51.73, lon: 36.19 },
  'israel': { lat: 31.77, lon: 35.22 },
  'gaza': { lat: 31.35, lon: 34.35 },
  'tel aviv': { lat: 32.08, lon: 34.78 },
  'west bank': { lat: 32.00, lon: 35.25 },
  'lebanon': { lat: 33.85, lon: 35.86 },
  'beirut': { lat: 33.89, lon: 35.50 },
  'hezbollah': { lat: 33.85, lon: 35.86 },
  'iran': { lat: 32.43, lon: 53.69 },
  'tehran': { lat: 35.69, lon: 51.39 },
  'iraq': { lat: 33.22, lon: 43.68 },
  'baghdad': { lat: 33.34, lon: 44.40 },
  'syria': { lat: 34.80, lon: 38.99 },
  'damascus': { lat: 33.51, lon: 36.29 },
  'aleppo': { lat: 36.20, lon: 37.16 },
  'yemen': { lat: 15.55, lon: 48.52 },
  'sanaa': { lat: 15.37, lon: 44.19 },
  'houthi': { lat: 15.55, lon: 48.52 },
  'taiwan': { lat: 23.69, lon: 120.96 },
  'taiwan strait': { lat: 24.50, lon: 119.50 },
  'china': { lat: 35.86, lon: 104.19 },
  'beijing': { lat: 39.91, lon: 116.39 },
  'south china sea': { lat: 14.00, lon: 115.00 },
  'north korea': { lat: 40.34, lon: 127.51 },
  'pyongyang': { lat: 39.02, lon: 125.75 },
  'south korea': { lat: 37.57, lon: 126.98 },
  'myanmar': { lat: 19.75, lon: 96.08 },
  'sudan': { lat: 12.86, lon: 30.22 },
  'khartoum': { lat: 15.55, lon: 32.53 },
  'somalia': { lat: 5.15, lon: 46.20 },
  'mogadishu': { lat: 2.04, lon: 45.34 },
  'sahel': { lat: 14.49, lon: 0.22 },
  'mali': { lat: 17.57, lon: -4.00 },
  'niger': { lat: 17.61, lon: 8.08 },
  'burkina faso': { lat: 12.36, lon: -1.53 },
  'red sea': { lat: 20.00, lon: 38.00 },
  'persian gulf': { lat: 26.50, lon: 53.00 },
  'strait of hormuz': { lat: 26.57, lon: 56.25 },
  'black sea': { lat: 43.00, lon: 34.00 },
  'mediterranean': { lat: 35.00, lon: 18.00 },
  'afghanistan': { lat: 33.93, lon: 67.71 },
  'pakistan': { lat: 30.38, lon: 69.35 },
  'india': { lat: 20.59, lon: 78.96 },
  'kashmir': { lat: 34.08, lon: 74.80 },
  'nato': { lat: 50.84, lon: 4.36 },
  'balkans': { lat: 44.02, lon: 21.00 },
  'libya': { lat: 26.34, lon: 17.23 },
  'tripoli': { lat: 32.89, lon: 13.19 },
  'ethiopia': { lat: 9.14, lon: 40.49 },
  'tigray': { lat: 14.04, lon: 38.37 },
  'venezuela': { lat: 6.42, lon: -66.59 },
  'arctic': { lat: 78.00, lon: 20.00 },
};

export function geocodeNewsItem(item) {
  if (item.lat && item.lon) return item;
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();

  for (const [keyword, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (text.includes(keyword)) {
      return {
        ...item,
        lat: coords.lat + (Math.random() - 0.5) * 0.3,
        lon: coords.lon + (Math.random() - 0.5) * 0.3,
        geocoded: true,
        geocodedFrom: keyword,
      };
    }
  }
  return item; // Not geocoded, will be filtered out
}
