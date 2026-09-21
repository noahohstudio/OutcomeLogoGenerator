// App state: per-variant parameters + colours, persisted in localStorage.
import { DEFAULTS, layoutSites } from './geometry.js';
import { THEMES } from './themes.js';

const KEY = 'outcome-logo-generator:v1';
export const LAYOUTS = ['spiral', 'rings', 'grid'];
export const VIEW_DEFAULTS = { tiltX: 0, tiltY: 0 };
export const ALL_DEFAULTS = { ...DEFAULTS, ...VIEW_DEFAULTS };

// What a brand-new session opens with (a calm five-pebble mark).
export const START = {
  ...ALL_DEFAULTS, count: 5, size: 0.7, sizeVar: 0.3, chaos: 0.35, relax: 0.7, layout: 'spiral', seed: 4, seed0: 4,
  web: 0.06, rim: 0.055, round: 0.6, square: 0.1, stretch: 0.2, flow: 40, egg: 0.2,
};

// keys touched by each card's Randomise / Reset
export const GROUPS = {
  pebbles: ['count', 'size', 'sizeVar', 'chaos', 'relax', 'layout', 'seed'],
  web: ['web', 'rim'],
  shape: ['round', 'square', 'stretch', 'flow', 'egg'],
  view: ['rotate', 'tiltX', 'tiltY'],
};

const rand = Math.random;
const pick = (a) => a[Math.floor(rand() * a.length)];
export function randomFor(keys) {
  const all = {
    count: 3 + Math.floor(rand() * 8), size: 0.5 + rand() * 0.35, sizeVar: rand() * 0.55, chaos: rand() * 0.9,
    relax: 0.35 + rand() * 0.55, layout: pick(LAYOUTS), seed: Math.floor(rand() * 9999),
    web: 0.035 + rand() * 0.035, rim: 0.04 + rand() * 0.025, round: 0.3 + rand() * 0.6, square: rand() * 0.4,
    stretch: rand() * 0.9, flow: Math.floor(rand() * 180), egg: rand() * 0.4,
    rotate: Math.floor(rand() * 360), tiltX: Math.round((rand() - 0.5) * 50), tiltY: Math.round((rand() - 0.5) * 50),
  };
  return Object.fromEntries(keys.filter((k) => k in all).map((k) => [k, all[k]]));
}

const uid = () => Math.random().toString(36).slice(2, 8);
export const cloneColors = (c) => ({ ...c, mix: [...(c.mix || [])] });

export function makeVariant(name, params, colors, custom = false) {
  return { id: uid(), name, params: { ...params }, colors: cloneColors(colors), custom };
}

export function nextName(variants) {
  const used = new Set(variants.map((v) => v.name));
  for (let i = 0; i < 26 * 4; i++) {
    const n = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) + 1 : '');
    if (!used.has(n)) return n;
  }
  return 'V' + uid();
}

function fresh() {
  const v = makeVariant('A', START, THEMES.bright.logo);
  return { theme: 'bright', activeId: v.id, variants: [v], closed: [] };
}

export function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.variants) && s.variants.length && THEMES[s.theme]) {
      // seed0 anchors a design's look: designs saved before it existed keep exactly the arrangement they have now
      s.variants.forEach((v) => { v.params = { ...ALL_DEFAULTS, ...v.params }; delete v.params.zoom; if (v.params.seed0 == null) v.params.seed0 = v.params.seed; });
      if (!s.variants.some((v) => v.id === s.activeId)) s.activeId = s.variants[0].id;
      s.closed = Array.isArray(s.closed) ? s.closed.slice(0, 10) : [];
      return s;
    }
  } catch { /* ignore corrupt storage */ }
  return fresh();
}

let timer;
export function saveStore(s) {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ } }, 250);
}

export const active = (s) => s.variants.find((v) => v.id === s.activeId);

// A seed whose arrangement visibly differs from the current one (Shuffle / R should never be a no-op,
// e.g. at low Randomness). Tries a few random seeds and takes the first that moves pebbles by 30% of a pebble.
export function nextSeed(params) {
  const cur = layoutSites(params), spacing = (100 * (1 - params.rim)) / Math.sqrt(Math.max(params.count, 1));
  let best = Math.floor(Math.random() * 99999), bestMove = -1;
  for (let i = 0; i < 8; i++) {
    const seed = Math.floor(Math.random() * 99999);
    const next = layoutSites({ ...params, seed });
    const move = next.reduce((a, t, k) => a + Math.hypot(t.x - cur[k].x, t.y - cur[k].y), 0) / next.length / spacing;
    if (move > 0.3) return seed;
    if (move > bestMove) { best = seed; bestMove = move; }
  }
  return best;
}
