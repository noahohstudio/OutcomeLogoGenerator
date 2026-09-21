// Renders the concept set to /concepts: one SVG per concept, sheet.svg, sheet.html.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULTS } from '../js/geometry.js';
import { logoSVG, logoBody } from '../js/svg.js';
import { THEMES } from '../js/themes.js';

const light = { ...THEMES.bright.logo };
const dark = { ...THEMES.dark.logo };
const grey = { ink: '#2b2b2b', bg: '#dcdcdc', pebble: '#dcdcdc', fill: 'hole', mix: [] };
const mixed = { ink: '#0b0b0b', bg: '#f2f2f2', pebble: '#f2f2f2', fill: 'mix', mix: ['#f2f2f2', '#bdbdbd', '#8c8c8c', '#5b5b5b'] };

export const CONCEPTS = [
  { id: '01-cluster', name: 'Cluster', note: 'Five pebbles, one pulse', c: light,
    p: { count: 5, size: 0.7, sizeVar: 0.3, chaos: 0.35, relax: 0.7, layout: 'spiral', seed: 4, web: 0.06, rim: 0.055, round: 0.6, square: 0.1, stretch: 0.2, flow: 40, egg: 0.2 } },
  { id: '02-rosette', name: 'Rosette', note: 'One core, six petals', c: grey,
    p: { count: 7, size: 0.72, sizeVar: 0, chaos: 0, relax: 0.8, layout: 'rings', seed: 2, web: 0.055, rim: 0.05, round: 0.75, square: 0.2, stretch: 0, flow: 0, egg: 0 } },
  { id: '03-current', name: 'Current', note: 'Stretched along one flow', c: light,
    p: { count: 6, size: 0.8, sizeVar: 0.25, chaos: 0.3, relax: 0.6, layout: 'grid', seed: 9, web: 0.05, rim: 0.05, round: 0.55, square: 0.1, stretch: 0.85, flow: 38, egg: 0.25 } },
  { id: '04-trio', name: 'Trio', note: 'Three bold faces, closest to the reference', c: dark,
    p: { count: 3, size: 0.8, sizeVar: 0.35, chaos: 0.2, relax: 0.6, layout: 'spiral', seed: 6, web: 0.07, rim: 0.06, round: 0.7, square: 0.2, stretch: 0.15, flow: 60, egg: 0.3 } },
  { id: '05-orbit', name: 'Orbit', note: 'Loose circles inside the circle', c: mixed,
    p: { count: 7, size: 0.2, sizeVar: 0, chaos: 0, relax: 0.9, layout: 'rings', seed: 13, web: 0.05, rim: 0.05, round: 0.3, square: 0, stretch: 0, flow: 0, egg: 0 } },
  { id: '06-drift', name: 'Drift', note: 'Uneven sizes, organic scatter', c: dark,
    p: { count: 8, size: 0.75, sizeVar: 0.65, chaos: 0.85, relax: 0.4, layout: 'spiral', seed: 21, web: 0.05, rim: 0.05, round: 0.55, square: 0.05, stretch: 0.3, flow: 20, egg: 0.2 } },
];

mkdirSync(new URL('../concepts/', import.meta.url), { recursive: true });
const cell = 600, gap = 30, margin = 60, label = 74, k = 2.15;
const W = margin * 2 + 3 * cell + 2 * gap, H0 = margin * 2 + 2 * (cell + label) + gap, H = W, yOff = (W - H0) / 2;
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>`;
const cells = CONCEPTS.map((c, i) => {
  const params = { ...DEFAULTS, ...c.p, seed0: c.p.seed };   // seed0 anchors each concept to its own look
  writeFileSync(new URL(`../concepts/${c.id}.svg`, import.meta.url), logoSVG(params, c.c, { S: 180, tol: 0.2 }));
  const x = margin + (i % 3) * (cell + gap), y = yOff + margin + Math.floor(i / 3) * (cell + label + gap);
  sheet += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${c.c.bg}"/>` +
    `<g transform="translate(${x + cell / 2} ${y + cell / 2}) scale(${k})">${logoBody(params, c.c, 180, 0.2)}</g>` +
    `<text x="${x}" y="${y + cell + 30}" font-family="Menlo, monospace" font-size="20" font-weight="700" fill="#050505">${String(i + 1).padStart(2, '0')}  ${c.name}</text>` +
    `<text x="${x}" y="${y + cell + 56}" font-family="Menlo, monospace" font-size="16" fill="#8f8f8f">${c.note}</text>`;
  return `<figure>${logoSVG(params, c.c, { S: 120, pad: 14, background: true, size: 300 })}<figcaption><b>${c.name}</b><br>${c.note}</figcaption></figure>`;
});
writeFileSync(new URL('../concepts/sheet.svg', import.meta.url), sheet + '</svg>');
writeFileSync(new URL('../concepts/sheet.html', import.meta.url),
`<!doctype html><meta charset="utf-8"><title>Outcome logo concepts</title>
<style>body{margin:0;padding:40px;background:#fff;font:12px/1.4 ui-monospace,Menlo,monospace;color:#050505}
main{display:grid;grid-template-columns:repeat(3,300px);gap:36px 28px}figure{margin:0}svg{display:block}figcaption{margin-top:10px}</style><main>${cells.join('')}</main>`);
console.log('wrote', CONCEPTS.length, 'concepts');
