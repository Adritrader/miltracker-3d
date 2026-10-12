/**
 * wikiSummary.js – Wikipedia REST page summaries (photo + short extract)
 * for bases and named ships. No API key; the REST API is CORS-open.
 */

import { useEffect, useState } from 'react';

const API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const MAX_CACHE = 300;
const _cache = new Map(); // title → Promise<summary|null>

/** Pick an image ~640px wide: the original if small enough, else a resized thumb. */
function pickImage(j) {
  const orig  = j.originalimage;
  const thumb = j.thumbnail;
  if (orig?.source && orig.width <= 800) return orig.source;
  if (thumb?.source) return thumb.source.replace(/\/\d+px-/, '/640px-');
  return null;
}

/**
 * Fetch a page summary. `validate(json)` can reject an article that resolved
 * to the wrong topic (e.g. a ship name landing on a person or a town).
 */
export function fetchWikiSummary(title, validate) {
  if (!title) return Promise.resolve(null);
  const key = title + (validate ? '|v' : '');
  if (_cache.has(key)) return _cache.get(key);
  const p = fetch(API + encodeURIComponent(title.replace(/ /g, '_')))
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j || j.type !== 'standard') return null;
      if (validate && !validate(j)) return null;
      return {
        title:   j.title,
        extract: j.extract || '',
        image:   pickImage(j),
        url:     j.content_urls?.desktop?.page || null,
      };
    })
    .catch(() => {
      _cache.delete(key); // network error — allow a retry later
      return null;
    });
  _cache.set(key, p);
  if (_cache.size > MAX_CACHE) _cache.delete(_cache.keys().next().value);
  return p;
}

/** React hook: `{ summary, loading }` for a title (null title → nothing). */
export function useWikiSummary(title, validate) {
  const [state, setState] = useState({ summary: null, loading: !!title });
  useEffect(() => {
    if (!title) { setState({ summary: null, loading: false }); return; }
    let alive = true;
    setState({ summary: null, loading: true });
    fetchWikiSummary(title, validate).then(summary => {
      if (alive) setState({ summary, loading: false });
    });
    return () => { alive = false; };
    // validate is expected to be a stable module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
  return state;
}
