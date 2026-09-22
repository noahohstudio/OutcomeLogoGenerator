import { THEMES, THEME_ORDER } from './themes.js';
import { GROUPS, START, loadStore, saveStore, makeVariant, nextName, randomFor, nextSeed, active, cloneColors } from './state.js';
import { LogoView } from './render.js';
import { buildPanel, makeEditable, parseNum } from './ui.js';
import { renderTabs } from './tabs.js';
import { createHistory } from './history.js';
import { exportSVG, exportPNG, copySVG } from './export.js';

const $ = (id) => document.getElementById(id);
const store = loadStore();
const view = new LogoView($('logo'));
let sync = () => {};
let tabTimer;
let zoom = 1; // viewport zoom: session-only, shared by every variant, never saved

function applyThemeVars(name) {
  const root = document.documentElement;
  root.dataset.theme = name;
  for (const [k, v] of Object.entries(THEMES[name].ui)) {
    if (v == null) root.style.removeProperty(`--${k}`);
    else root.style.setProperty(`--${k}`, v);
  }
  root.dataset.glow = THEMES[name].ui.glow ? 'on' : 'off';
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === name));
}

const PERF = /[?&]perf\b/.test(location.search);   // add ?perf to the URL to see live fps and render resolution
function hud(v) {
  const p = v.params;
  $('hud-name').textContent = `${v.name} · ${Math.round(p.count)} pebbles · seed ${p.seed}`;
  $('hud-view').textContent = `rotate ${Math.round(((p.rotate % 360) + 360) % 360)}° · tilt ${Math.round(p.tiltX)}/${Math.round(p.tiltY)} · ${Math.round(zoom * 100)}%${PERF ? ` · ${view.stats()}` : ''}`;
}

function refresh({ morph = true, tabs = false } = {}) {
  const v = active(store);
  view.set(v.params, v.colors, store.theme, !morph);
  sync(v.params, v.colors, store.theme);
  hud(v);
  if (tabs) renderTabs($('tabs'), store, handlers);
  saveStore(store);
}

// continuous input (slider drags, rotate drags) can fire several times per frame: apply the state at once,
// but update the view, panel and storage once per frame
let soon = 0;
function refreshSoon() { if (!soon) soon = requestAnimationFrame(() => { soon = 0; refresh(); }); }

// thumbnails are refreshed shortly after the last change (never while renaming)
function scheduleTabs() {
  clearTimeout(tabTimer);
  tabTimer = setTimeout(() => { if (!document.activeElement?.closest?.('.tabs')) renderTabs($('tabs'), store, handlers); }, 350);
}

// undo / redo: whole-design snapshots (variants, active tab, mode, recently closed)
const history = createHistory({
  snapshot: () => JSON.parse(JSON.stringify({ variants: store.variants, activeId: store.activeId, theme: store.theme, closed: store.closed })),
  restore(snap) {
    Object.assign(store, snap);
    applyThemeVars(store.theme);
    refresh({ tabs: true });
  },
  onChange({ canUndo, canRedo }) { $('undo').disabled = !canUndo; $('redo').disabled = !canRedo; },
});

const ctx = {
  params: () => active(store).params,
  colors: () => active(store).colors,
  // discrete = its own undo step (a shuffle, a toggle); otherwise rapid changes to the same control coalesce into one step
  setParams(patch, discrete = false) { history.record(discrete ? null : `p:${Object.keys(patch)}`); Object.assign(active(store).params, patch); if (discrete) refresh(); else refreshSoon(); scheduleTabs(); },
  setColors(patch, discrete = false) {
    history.record(discrete ? null : `c:${Object.keys(patch)}`);
    const v = active(store);
    Object.assign(v.colors, patch);
    if (patch.bg !== undefined && v.colors.fill === 'hole') v.colors.pebble = v.colors.bg;
    v.custom = true;
    if (discrete) refresh(); else refreshSoon();
    scheduleTabs();
  },
  shuffleSeed() { ctx.setParams({ seed: nextSeed(active(store).params) }, true); },
  resetColors() { history.record(null); const v = active(store); v.colors = cloneColors(THEMES[store.theme].logo); v.custom = false; refresh({ tabs: true }); },
  randomize(group) { history.record(null); Object.assign(active(store).params, randomFor(GROUPS[group])); refresh(); scheduleTabs(); },
  reset(group) { history.record(null); const p = active(store).params; for (const k of GROUPS[group]) p[k] = START[k]; if (group === 'view') zoomTo(1); refresh(); scheduleTabs(); },
};

const handlers = {
  select(id) { if (id !== store.activeId) { store.activeId = id; refresh({ tabs: true }); } },
  add() {
    history.record(null);
    const keys = [...GROUPS.pebbles, ...GROUPS.web, ...GROUPS.shape];
    const v = makeVariant(nextName(store.variants), { ...START, ...randomFor(keys) }, THEMES[store.theme].logo);
    store.variants.push(v); store.activeId = v.id;
    refresh({ tabs: true });
    $('tabs').scrollTo({ left: 1e5, behavior: 'smooth' });
  },
  remove(id) {
    history.record(null);
    if (store.variants.length === 1) { active(store).params = { ...START }; refresh({ tabs: true }); return; }
    const i = store.variants.findIndex((v) => v.id === id);
    const [gone] = store.variants.splice(i, 1);
    store.closed.unshift({ variant: gone, index: i });
    store.closed.length = Math.min(store.closed.length, 10);
    if (store.activeId === id) store.activeId = store.variants[Math.max(0, i - 1)].id;
    refresh({ tabs: true });
  },
  reopen() {
    const item = store.closed[0];
    if (!item) return;
    history.record(null);
    store.closed.shift();
    const v = item.variant;
    while (store.variants.some((x) => x.name === v.name)) v.name += "'";      // keep tab names unique
    if (store.variants.some((x) => x.id === v.id)) v.id = Math.random().toString(36).slice(2, 8);
    store.variants.splice(Math.min(item.index, store.variants.length), 0, v);
    store.activeId = v.id;
    refresh({ tabs: true });
  },
  rename(id, name) { history.record(null); store.variants.find((v) => v.id === id).name = name; refresh({ tabs: true }); },
};

function setTheme(name) {
  history.record(null);
  store.theme = name;
  applyThemeVars(name);
  for (const v of store.variants) if (!v.custom) v.colors = cloneColors(THEMES[name].logo);
  refresh({ tabs: true });
}

// ---- header ----
$('modes').replaceChildren(...THEME_ORDER.flatMap((n, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.mode = n; b.textContent = THEMES[n].label;
  b.addEventListener('click', () => setTheme(n));
  if (!i) return [b];
  const s = document.createElement('span'); s.textContent = '/';
  return [s, b];
}));

$('btn-save').addEventListener('click', () => {
  history.record(null);
  const cur = active(store);
  const v = makeVariant(nextName(store.variants), cur.params, cur.colors, cur.custom);
  store.variants.splice(store.variants.indexOf(cur) + 1, 0, v);
  store.activeId = v.id;
  refresh({ tabs: true });
  const b = $('btn-save');
  b.textContent = `✓ Saved as ${v.name}`;
  setTimeout(() => { b.textContent = '● Save variant'; }, 1400);
});

const menu = $('export-menu'), expBtn = $('btn-export');
const closeMenu = () => { menu.hidden = true; expBtn.setAttribute('aria-expanded', 'false'); };
expBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; expBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
document.addEventListener('click', closeMenu);
menu.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const v = active(store), what = t.dataset.export;
  if (what === 'svg') exportSVG(v, false);
  if (what === 'svg-bg') exportSVG(v, true);
  if (what === 'png') await exportPNG(v);
  if (what === 'copy') { await copySVG(v); t.textContent = 'Copied ✓'; setTimeout(() => { t.textContent = 'Copy SVG'; closeMenu(); }, 900); return; }
  closeMenu();
});

// ---- drag to rotate, shift-drag to tilt, double-click to reset ----
const prev = $('preview');
const wrap = (a) => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEAD = 32;
let drag = null;
const pointers = new Map();   // active pointers, for two-finger pinch on touch screens
let pinch = null;
const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
prev.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) { pinch = { d0: spread(), z0: zoom }; drag = null; prev.classList.remove('drag'); return; }
  if (pointers.size > 2) return;
  const r = $('logo').getBoundingClientRect(), p = active(store).params;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = Math.atan2(e.clientY - cy, e.clientX - cx);
  const inside = Math.hypot(e.clientX - cx, e.clientY - cy) < DEAD;
  drag = { tilt: e.shiftKey, cx, cy, last: inside ? null : a, acc: 0, rot0: p.rotate, x0: e.clientX, y0: e.clientY, tx0: p.tiltX, ty0: p.tiltY };
  try { prev.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
  prev.classList.add('drag');
});
prev.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && pointers.size >= 2) { zoomTo((pinch.z0 * spread()) / pinch.d0); return; }
  if (!drag) return;
  if (drag.tilt) {
    ctx.setParams({ tiltY: clamp(drag.ty0 + (e.clientX - drag.x0) * 0.25, -60, 60), tiltX: clamp(drag.tx0 - (e.clientY - drag.y0) * 0.25, -60, 60) });
  } else {
    // angles flip near the centre, so a small dead zone keeps a drag through the middle from jumping
    const dx = e.clientX - drag.cx, dy = e.clientY - drag.cy;
    if (Math.hypot(dx, dy) < DEAD) { drag.last = null; return; }
    const a = Math.atan2(dy, dx);
    if (drag.last !== null) drag.acc += wrap(a - drag.last);
    drag.last = a;
    ctx.setParams({ rotate: drag.rot0 + (drag.acc * 180) / Math.PI });
  }
});
const endDrag = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; drag = null; prev.classList.remove('drag'); };
prev.addEventListener('pointerup', endDrag);
prev.addEventListener('pointercancel', endDrag);
prev.addEventListener('dblclick', () => {
  const p = active(store).params;
  ctx.setParams({ rotate: Math.round(p.rotate / 360) * 360, tiltX: 0, tiltY: 0 });
});


// ---- zoom: scales about the centre, so the logo always stays centred (log scale, 1x sits mid-slider) ----
const Z_MIN = 0.25, Z_MAX = 4;
const zToT = (z) => Math.log(z / Z_MIN) / Math.log(Z_MAX / Z_MIN);
const tToZ = (t) => Z_MIN * Math.pow(Z_MAX / Z_MIN, t);
const zr = $('zoom-range'), zv = $('zoom-val');
function zoomTo(z) {
  zoom = clamp(z, Z_MIN, Z_MAX);
  view.setZoom(zoom);
  syncZoom(zoom);
  hud(active(store));
}
const zoomBy = (f) => zoomTo(zoom * f);
function syncZoom(z) {
  zr.value = zToT(z);
  zr.style.setProperty('--p', `${zToT(z) * 100}%`);
  zv.textContent = `${Math.round(z * 100)}%`;
}
zr.addEventListener('input', () => zoomTo(tToZ(+zr.value)));
$('zoom-in').addEventListener('click', () => zoomBy(1.25));
$('zoom-out').addEventListener('click', () => zoomBy(1 / 1.25));
for (const t of ['pointerdown', 'dblclick']) $('zoom').addEventListener(t, (e) => e.stopPropagation()); // keep drag-rotate off the control
// zoom by pinching. A trackpad pinch arrives as ctrl+wheel in Chrome/Firefox and as gesture events in Safari
// (two fingers on a touch screen are handled above). Plain scrolling never zooms.
prev.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.01)); }, { passive: false });
let gestureZoom = 1;
prev.addEventListener('gesturestart', (e) => { e.preventDefault(); gestureZoom = zoom; });
prev.addEventListener('gesturechange', (e) => { e.preventDefault(); zoomTo(gestureZoom * e.scale); });
prev.addEventListener('gestureend', (e) => e.preventDefault());
makeEditable(zv, {
  text: () => String(Math.round(zoom * 100)),
  parse: (s) => { const n = parseNum(s); return n === null ? null : clamp(n / 100, Z_MIN, Z_MAX); },
  commit: zoomTo,
  nudge: (s, dir) => { const z = clamp(((parseNum(s) ?? 100) + dir * 5) / 100, Z_MIN, Z_MAX); return { value: z, text: String(Math.round(z * 100)) }; },
});

// ---- undo / redo ----
$('undo').addEventListener('click', () => history.undo());
$('redo').addEventListener('click', () => history.redo());
for (const t of ['pointerdown', 'dblclick']) $('history').addEventListener(t, (e) => e.stopPropagation());

// ---- keyboard ----
addEventListener('keydown', (e) => {
  if (e.target.matches?.('input:not([type=range]), textarea')) return;
  if (e.metaKey || e.ctrlKey) {
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); $('btn-save').click(); }
    else if (k === 'z') { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); }
    else if (k === 'y') { e.preventDefault(); history.redo(); }
    return;
  }
  if (e.key === '+' || e.key === '=') zoomBy(1.25);
  if (e.key === '-' || e.key === '_') zoomBy(1 / 1.25);
  if (e.key === '0') zoomTo(1);
  if (e.key === 'r') ctx.shuffleSeed();
  if (e.key === 'R') { history.record(null); for (const g of ['pebbles', 'web', 'shape']) Object.assign(active(store).params, randomFor(GROUPS[g])); refresh(); scheduleTabs(); }
});

if (PERF) setInterval(() => hud(active(store)), 500);

// ---- boot ----
sync = buildPanel($('panel'), ctx);
applyThemeVars(store.theme);
refresh({ morph: false, tabs: true });
zoomTo(1);
