/**
 * Twitter / X Auto-Tweet Service
 *
 * Posts critical alerts automatically when new ones are detected.
 * Requires env vars: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *
 * Free tier: 500 tweets/month (~16/day) — only CRITICAL severity is posted.
 * Rate limit: minimum 15 minutes between tweets to stay within quota.
 */

import { TwitterApi } from 'twitter-api-v2';

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
  const title = alert.title?.slice(0, 160) || 'Breaking military alert';
  const location = alert.country
    ? `📍 ${alert.country}`
    : (alert.lat != null ? `📍 ${alert.lat.toFixed(2)}°, ${alert.lon.toFixed(2)}°` : '');

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

// Track already-tweeted alert IDs to avoid duplicates across polls
const tweetedIds = new Set();

/**
 * Called from server.js whenever alerts are refreshed.
 * Picks the most severe new alert not yet tweeted and posts it.
 * @param {Array} alerts — current alerts array from cache
 */
export async function maybeTweetAlert(alerts = []) {
  const xClient = getClient();
  if (!xClient) return; // env vars not set

  const now = Date.now();
  if (now - lastTweetAt < MIN_INTERVAL_MS) return; // rate-limit guard

  // Only post critical severity
  const candidates = alerts.filter(
    a => a.severity === 'critical' && !tweetedIds.has(a.id)
  );
  if (candidates.length === 0) return;

  // Pick the newest one
  const alert = candidates.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )[0];

  const text = buildTweetText(alert);

  try {
    const rwClient = xClient.readWrite;
    await rwClient.v2.tweet(text);
    tweetedIds.add(alert.id);
    lastTweetAt = now;
    // Keep set bounded
    if (tweetedIds.size > 500) {
      const first = tweetedIds.values().next().value;
      tweetedIds.delete(first);
    }
    console.log(`[Twitter] Tweeted alert: ${alert.title?.slice(0, 60)}`);
  } catch (err) {
    console.error('[Twitter] Failed to post tweet:', err.message || err);
  }
}
