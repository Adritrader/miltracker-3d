/**
 * Twitter / X Auto-Tweet Service
 *
 * Posts critical alerts automatically when new ones are detected.
 * Requires env vars: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *
 * Free tier: 500 tweets/month (~16/day) — only CRITICAL severity is posted.
 * Rate limit: minimum 15 minutes between tweets to stay within quota.
 * Images: OpenStreetMap static map (free, no API key required).
 */

import { TwitterApi } from 'twitter-api-v2';
import fetch from 'node-fetch';

const MIN_INTERVAL_MS = 15 * 60_000; // 15 min between tweets
let lastTweetAt = 0;
let client = null;

function getClient() {
  if (client) return client;
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) return null;
  client = new TwitterApi({
    appKey:            X_API_KEY,
    appSecret:         X_API_SECRET,
    accessToken:       X_ACCESS_TOKEN,
    accessSecret:      X_ACCESS_TOKEN_SECRET,
  });
  return client;
}

function severityEmoji(severity) {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high':     return '⚠️';
    default:         return '📡';
  }
}

function buildTweetText(alert) {
  const emoji = severityEmoji(alert.severity);
  const severity = alert.severity.toUpperCase();
  const title = alert.title?.slice(0, 140) || 'Breaking military alert';
  const location = alert.country
    ? `📍 ${alert.country}`
    : (alert.lat != null ? `📍 ${Number(alert.lat).toFixed(2)}°, ${Number(alert.lon).toFixed(2)}°` : '');

  const parts = [
    `${emoji} [${severity}] ${title}`,
    location,
    '',
    '🌐 Live tracking: https://livewar3d.com',
    '',
    '#LiveWar3D #BreakingNews #MilitaryTracking',
  ].filter(l => l !== undefined);

  return parts.join('\n').slice(0, 280);
}

// Fetch a static satellite map image centered on lat/lon (free OSM-based service)
async function fetchMapImage(lat, lon) {
  if (lat == null || lon == null) return null;
  const zoom = 7;
  const url = `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${lat},${lon}&zoom=${zoom}&size=800x400` +
    `&markers=${lat},${lon},red-pushpin`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'LiveWar3D/1.0 (https://livewar3d.com)' },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Post a tweet with optional map image attached
async function postTweet(xClient, text, lat, lon) {
  const rwClient = xClient.readWrite;

  const imgBuffer = await fetchMapImage(lat, lon);
  if (imgBuffer) {
    try {
      const mediaId = await rwClient.v1.uploadMedia(imgBuffer, { mimeType: 'image/png' });
      await rwClient.v2.tweet({ text, media: { media_ids: [mediaId] } });
      return true;
    } catch (imgErr) {
      console.warn('[Twitter] Image upload failed, falling back to text-only:', imgErr.message);
    }
  }

  // Fallback: text-only tweet
  await rwClient.v2.tweet(text);
  return true;
}

// Track already-tweeted alert IDs to avoid duplicates across polls
const tweetedIds = new Set();

/**
 * Called from server.js whenever alerts are refreshed.
 * Picks the most severe new alert not yet tweeted and posts it.
 * @param {Array} alerts — current alerts array from cache
 */
export async function maybeTweetAlert(alerts = []) {
  const xClient = getClient();
  if (!xClient) return;

  const now = Date.now();
  if (now - lastTweetAt < MIN_INTERVAL_MS) return;

  const candidates = alerts.filter(
    a => a.severity === 'critical' && !tweetedIds.has(a.id)
  );
  if (candidates.length === 0) return;

  const alert = candidates.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )[0];

  try {
    await postTweet(xClient, buildTweetText(alert), alert.lat, alert.lon);
    tweetedIds.add(alert.id);
    lastTweetAt = now;
    if (tweetedIds.size > 500) tweetedIds.delete(tweetedIds.values().next().value);
    console.log(`[Twitter] Auto-tweeted: ${alert.title?.slice(0, 60)}`);
  } catch (err) {
    console.error('[Twitter] Failed to post tweet:', err.message || err);
  }
}

/**
 * Manual/admin trigger — posts a specific alert or a generic launch tweet.
 * @param {object|null} alert — alert object, or null for a generic tweet
 */
export async function tweetNow(alert = null) {
  const xClient = getClient();
  if (!xClient) throw new Error('X API credentials not configured');

  const text = alert
    ? buildTweetText(alert)
    : `🌐 LiveWar3D is now live — real-time military aircraft, naval vessels & conflict alerts worldwide.\n\nhttps://livewar3d.com\n\n#LiveWar3D #MilitaryTracking #BreakingNews`;

  await postTweet(xClient, text, alert?.lat, alert?.lon);
  if (alert) {
    tweetedIds.add(alert.id);
    lastTweetAt = Date.now();
  }
  console.log(`[Twitter] Manual tweet sent: ${text.slice(0, 60)}`);
}
