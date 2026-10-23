/**
 * geminiModel.js — shared Gemini model selection for aiDanger + aiAircraftIntel.
 *
 * Google retires model versions regularly ("models/gemini-2.5-flash is no
 * longer available to new users" → 404) while still listing them, so:
 *  - prefer the rolling `-latest` aliases, which always point at a live model;
 *  - skip non-text variants (tts, image, live, preview…) in the fallback;
 *  - remember models that 404'd so a re-resolve can't pick them again
 *    (previously every error reset the choice and re-picked the same dead model).
 */

import fetch from 'node-fetch';

const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

// Fast/cheap first. Aliases first so retirements don't break us.
const PREFERRED = [
  'gemini-flash-lite-latest', 'gemini-flash-latest',
  'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite',
];
const NON_TEXT = /tts|image|audio|live|embedding|transcribe|robotics|computer-use|nano-banana|lyria|veo|imagen|preview|exp|research|antigravity|customtools/i;

const _dead = new Set();   // model ids that returned 404 / "no longer available"
let _resolved = null;      // { apiVer, model }

function sanitize(msg = '') {
  return String(msg).replace(/([?&]key=)[^&\s"']*/gi, '$1[REDACTED]');
}

/** Pick the best usable model for this key (cached until a model is marked dead). */
export async function resolveGeminiModel(key) {
  if (_resolved && !_dead.has(_resolved.model)) return _resolved;
  _resolved = null;

  for (const apiVer of ['v1beta', 'v1']) {
    try {
      // The catalogue is >50 entries now — a small page could hide the aliases
      const res = await fetch(`${GEMINI_HOST}/${apiVer}/models?key=${key}&pageSize=1000`,
        { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      const available = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(m => !_dead.has(m));

      const pick = PREFERRED.find(m => available.includes(m))
        || available.find(m => /^gemini-.*flash/.test(m) && !NON_TEXT.test(m))
        || available.find(m => /^gemini-/.test(m) && !NON_TEXT.test(m));
      if (pick) {
        _resolved = { apiVer, model: pick };
        console.log(`[AI] Selected Gemini model: ${pick} (${apiVer})`);
        return _resolved;
      }
    } catch (e) {
      console.warn(`[AI] listModels (${apiVer}) failed:`, sanitize(e.message));
    }
  }
  throw new Error('No usable Gemini model for this API key — check Google AI Studio');
}

/**
 * Report a failed generateContent call. 404 (retired/unknown model) marks the
 * model dead so the next resolve picks another; other statuses (429 quota,
 * 5xx) keep the current choice — re-resolving would not help.
 */
export function reportGeminiFailure(model, status) {
  if (status === 404) {
    _dead.add(model);
    console.warn(`[AI] Gemini model ${model} unavailable (404) — will pick another`);
  }
}

export { GEMINI_HOST, sanitize as sanitizeGeminiError };
