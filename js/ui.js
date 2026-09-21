// Control panel: cards of sliders / slash-toggles / colour rows, built from a schema.
import { GROUPS } from './state.js';
import { swatchesFor } from './themes.js';

// display units: value shown = param * scale, with `dec` decimals and a suffix
const UNITS = {
  int: { scale: 1, dec: 0, suffix: '' },
  pct: { scale: 100, dec: 0, suffix: '%' },
  pct1: { scale: 100, dec: 1, suffix: '%' },
  deg: { scale: 1, dec: 0, suffix: '°', wrap: true },
  sdeg: { scale: 1, dec: 0, suffix: '°' },
};
const fmtFor = (row) => {
  const u = UNITS[row.unit];
  return (v) => { const x = u.wrap ? ((v % 360) + 360) % 360 : v; return (Math.round(x * u.scale * 10 ** u.dec) / 10 ** u.dec).toFixed(u.dec) + u.suffix; };
};

export const SCHEMA = [
  { id: 'pebbles', title: 'Pebbles', rows: [
    { k: 'count', label: 'Amount', min: 2, max: 24, step: 1, unit: 'int' },
    { k: 'size', label: 'Size', min: 0.1, max: 1, step: 0.01, unit: 'pct' },
    { k: 'sizeVar', label: 'Variation', min: 0, max: 1, step: 0.01, unit: 'pct' },
    { k: 'chaos', label: 'Randomness', min: 0, max: 1, step: 0.01, unit: 'pct' },
    { k: 'relax', label: 'Evenness', min: 0, max: 1, step: 0.01, unit: 'pct' },
    { k: 'layout', label: 'Order', opts: [['spiral', 'Spiral'], ['rings', 'Rings'], ['grid', 'Grid']] },
    { k: 'seed', label: 'Seed', shuffle: true },
  ] },
  { id: 'web', title: 'Web', rows: [
    { k: 'web', label: 'Thickness', min: 0.005, max: 0.14, step: 0.001, unit: 'pct1' },
    { k: 'rim', label: 'Outline', min: 0.01, max: 0.12, step: 0.001, unit: 'pct1' },
  ] },
  { id: 'shape', title: 'Shape', rows: [
    { k: 'round', label: 'Roundness', min: 0, max: 1, step: 0.01, unit: 'pct' },
    { k: 'square', label: 'Squareness', min: 0, max: 1, step: 0.01, unit: 'pct' },
    { k: 'stretch', label: 'Stretch', min: 0, max: 1, step: 0.01, unit: 'pct' },
    { k: 'flow', label: 'Angle', min: 0, max: 180, step: 1, unit: 'sdeg' },
    { k: 'egg', label: 'Egg', min: 0, max: 1, step: 0.01, unit: 'pct' },
  ] },
  { id: 'view', title: 'View', rows: [
    { k: 'rotate', label: 'Rotate', min: 0, max: 360, step: 1, unit: 'deg' },
    { k: 'tiltX', label: 'Tilt X', min: -60, max: 60, step: 1, unit: 'sdeg' },
    { k: 'tiltY', label: 'Tilt Y', min: -60, max: 60, step: 1, unit: 'sdeg' },
  ] },
  { id: 'color', title: 'Color', color: true },
];

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}


// Double-click a readout to type a value. Enter/Tab/blur commit, Escape cancels, Up/Down nudge live.
export const parseNum = (s) => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
export const parseHex = (s) => {
  let t = String(s).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(t)) t = t.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(t) ? `#${t.toLowerCase()}` : null;
};

export function makeEditable(node, { text, parse, commit, nudge }) {
  node.classList.add('editable');
  node.title = 'Double-click to type a value';
  node.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (node.querySelector('input')) return;
    const original = node.textContent;
    const input = el('input', { type: 'text', class: 'val-edit', 'aria-label': 'Edit value', spellcheck: 'false', autocomplete: 'off' });
    input.value = text();
    node.textContent = '';
    node.append(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = ok ? parse(input.value) : null;
      input.remove();
      node.textContent = original;
      if (v !== null && v !== undefined) commit(v);
    };
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter' || ev.key === 'Tab') finish(true);
      else if (ev.key === 'Escape') finish(false);
      else if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && nudge) {
        ev.preventDefault();
        const next = nudge(input.value, (ev.key === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 10 : 1));
        if (next !== null) { input.value = next.text; commit(next.value); }
      }
    });
    input.addEventListener('blur', () => finish(true));
  });
}

function sliderRow(row, ctx, reg) {
  const id = `c-${row.k}`, fmt = fmtFor(row), u = UNITS[row.unit];
  const wrap = el('div', { class: 'row' });
  const input = el('input', { type: 'range', id, min: row.min, max: row.max, step: row.step });
  const out = el('output', { for: id });
  const paint = (v) => {
    input.style.setProperty('--p', `${((Math.min(Math.max(v, row.min), row.max) - row.min) / (row.max - row.min)) * 100}%`);
    out.textContent = fmt(v);
  };
  input.addEventListener('input', () => { const v = +input.value; paint(v); ctx.setParams({ [row.k]: v }); });
  wrap.append(el('label', { for: id }, row.label), input, out);
  let last;
  reg.push((p) => { const v = +p[row.k]; if (v === last) return; last = v; input.value = row.k === 'rotate' ? ((v % 360) + 360) % 360 : v; paint(v); });

  // typed value (display units) -> param value, clamped to the slider range and rounded to its step
  const toParam = (n) => {
    let v = Math.min(row.max, Math.max(row.min, n / u.scale));
    v = Number((Math.round(v / row.step) * row.step).toFixed(6));
    if (row.k === 'rotate') { // take the equivalent angle nearest the current one so it doesn't spin the long way round
      const cur = ctx.params().rotate, d = ((((n - cur) % 360) + 540) % 360) - 180;
      v = cur + d;
    }
    return v;
  };
  makeEditable(out, {
    text: () => fmt(ctx.params()[row.k]),
    parse: (s) => { const n = parseNum(s); return n === null ? null : toParam(n); },
    commit: (v) => ctx.setParams({ [row.k]: v }),
    nudge: (s, dir) => {
      const n = parseNum(s) ?? ctx.params()[row.k] * u.scale;
      const v = toParam(n + dir * row.step * u.scale);
      return { value: v, text: fmt(v) };
    },
  });
  return wrap;
}

function optsRow(row, ctx, reg) {
  const wrap = el('div', { class: 'row opts' });
  const set = el('div', { class: 'set', role: 'group', 'aria-label': row.label });
  const btns = row.opts.map(([val, name], i) => {
    const b = el('button', { type: 'button' }, name);
    b.addEventListener('click', () => ctx.setParams({ [row.k]: val }, true));
    if (i) set.append(el('i', {}, '/'));
    set.append(b);
    return [val, b];
  });
  wrap.append(el('span', { class: 'lab' }, row.label), set);
  let last;
  reg.push((p) => { if (p[row.k] === last) return; last = p[row.k]; btns.forEach(([val, b]) => b.classList.toggle('on', p[row.k] === val)); });
  return wrap;
}

function shuffleRow(row, ctx, reg) {
  const wrap = el('div', { class: 'row opts' });
  const set = el('div', { class: 'set' });
  const num = el('span', {}, '');
  const b = el('button', { type: 'button', title: 'Reshuffle within the current settings (R)' }, 'Shuffle ↻');
  b.addEventListener('click', () => ctx.shuffleSeed());
  set.append(num, el('i', {}, '/'), b);
  wrap.title = 'Seed: the starting arrangement. Any number gives a different one; Randomness sets how far it drifts from the ordered pattern.';
  wrap.append(el('span', { class: 'lab' }, row.label), set);
  let last;
  reg.push((p) => { if (p.seed === last) return; last = p.seed; num.textContent = `#${p.seed}`; });
  makeEditable(num, {
    text: () => String(ctx.params().seed),
    parse: (s) => { const n = parseNum(s); return n === null ? null : Math.min(99999, Math.max(0, Math.round(n))); },
    commit: (v) => ctx.setParams({ seed: v }),
    nudge: (s, dir) => { const v = Math.min(99999, Math.max(0, Math.round((parseNum(s) ?? ctx.params().seed) + dir))); return { value: v, text: String(v) }; },
  });
  return wrap;
}

function colorRow(label, key, ctx, reg) {
  const wrap = el('div', { class: 'row color' });
  const hex = el('span', { class: 'hex' });
  const sw = el('span', { class: 'sw' });
  const input = el('input', { type: 'color', 'aria-label': label });
  input.addEventListener('input', () => ctx.setColors({ [key]: input.value }));
  sw.append(input);
  wrap.append(el('span', { class: 'lab' }, label), hex, sw);
  let last;
  reg.push((p, c) => { if (c[key] === last) return; last = c[key]; hex.textContent = c[key]; sw.style.background = c[key]; input.value = c[key]; });
  makeEditable(hex, { text: () => ctx.colors()[key], parse: parseHex, commit: (v) => ctx.setColors({ [key]: v }) });
  return wrap;
}

function colorCard(body, ctx, reg) {
  const chips = el('div', { class: 'chips' });
  body.append(chips);
  const fill = el('div', { class: 'row opts' });
  const set = el('div', { class: 'set' });
  const fbtns = [['hole', 'Hole'], ['solid', 'Solid'], ['mix', 'Mix']].map(([val, name], i) => {
    const b = el('button', { type: 'button' }, name);
    b.addEventListener('click', () => ctx.setColors({ fill: val }, true));
    if (i) set.append(el('i', {}, '/'));
    set.append(b);
    return [val, b];
  });
  fill.append(el('span', { class: 'lab' }, 'Pebbles'), set);
  body.append(fill, colorRow('Ink', 'ink', ctx, reg), colorRow('Pebble', 'pebble', ctx, reg), colorRow('Background', 'bg', ctx, reg));

  const mixRow = el('div', { class: 'row color' });
  const mixSw = el('span', { style: 'display:flex;gap:6px;justify-content:flex-end' });
  const mixInputs = [0, 1, 2, 3].map((i) => {
    const sw = el('span', { class: 'sw', style: 'margin-left:0' });
    const input = el('input', { type: 'color', 'aria-label': `Mix ${i + 1}` });
    input.addEventListener('input', () => { const mix = [...ctx.colors().mix]; mix[i] = input.value; ctx.setColors({ mix }); });
    sw.append(input); mixSw.append(sw);
    return [sw, input];
  });
  mixRow.append(el('span', { class: 'lab' }, 'Mix'), mixSw, el('span'));
  body.append(mixRow);
  const reset = el('div', { class: 'btnrow' });
  const rb = el('button', { type: 'button', class: 'btn' }, 'Use theme colors');
  rb.addEventListener('click', () => ctx.resetColors());
  reset.append(rb);
  body.append(reset);

  let lastSig;
  reg.push((p, c, theme) => {
    const sig = JSON.stringify([theme, c.fill, c.ink, c.bg, c.mix]);
    if (sig === lastSig) return;
    lastSig = sig;
    fbtns.forEach(([val, b]) => b.classList.toggle('on', c.fill === val));
    mixInputs.forEach(([sw, input], i) => { const col = c.mix[i] || '#888888'; sw.style.background = col; input.value = col; });
    chips.replaceChildren(...swatchesFor(theme).map((s) => {
      const b = el('button', { type: 'button', class: 'chip', title: s.name, 'aria-label': s.name });
      b.style.background = `radial-gradient(circle, ${s.ink} 0 9px, transparent 9.6px), ${s.bg}`;
      b.classList.toggle('on', c.ink.toLowerCase() === s.ink && c.bg.toLowerCase() === s.bg);
      b.addEventListener('click', () => ctx.setColors({ ink: s.ink, bg: s.bg, pebble: s.bg }, true));
      return b;
    }));
  });
}

export function buildPanel(panel, ctx) {
  const reg = [];
  for (const card of SCHEMA) {
    const sec = el('section', { class: 'card' });
    const head = el('div', { class: 'card-h' });
    const ico = el('button', { type: 'button', class: 'ico', 'aria-label': `Toggle ${card.title}`, 'aria-expanded': 'true' });
    head.append(ico, el('h2', {}, card.title));
    if (!card.color) {
      const acts = el('div', { class: 'acts' });
      const rnd = el('button', { type: 'button', title: `Randomise the ${card.title.toLowerCase()} settings (Shift+R randomises everything)` }, 'Randomise'), rst = el('button', { type: 'button', title: `Reset the ${card.title.toLowerCase()} settings` }, 'Reset');
      rnd.addEventListener('click', () => ctx.randomize(card.id));
      rst.addEventListener('click', () => ctx.reset(card.id));
      acts.append(rnd, el('span', {}, '/'), rst);
      head.append(acts);
    }
    // the whole header toggles the card (not the Randomise / Reset actions); the CSS animates height, fade and the icon
    head.addEventListener('click', (e) => {
      if (e.target.closest('.acts')) return;
      ico.setAttribute('aria-expanded', String(sec.classList.toggle('collapsed') === false));
    });
    const body = el('div', { class: 'card-b' });
    const inner = el('div', { class: 'card-i' });
    body.append(inner);
    if (card.color) colorCard(inner, ctx, reg);
    else for (const row of card.rows) inner.append(row.opts ? optsRow(row, ctx, reg) : row.shuffle ? shuffleRow(row, ctx, reg) : sliderRow(row, ctx, reg));
    [...inner.children].forEach((c, i) => c.style.setProperty('--i', String(i)));   // stagger index for the open animation
    sec.append(head, body);
    panel.append(sec);
  }
  return (p, c, theme) => reg.forEach((fn) => fn(p, c, theme));
}
