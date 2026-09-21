// Pebble-logo geometry. Pure functions, no DOM. Circle radius R = 100 units.
// Pebbles are weighted (power-diagram) Voronoi cells, inset by the web thickness,
// intersected with an optional size cap shape, and rounded with a soft-min so the
// outlines stay smooth. The outer circle is never touched, so it stays perfect.

export const R = 100;
const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const PRES_K = (1.6 * R) ** 2; // weight penalty that shrinks a fading site to nothing

export const DEFAULTS = {
  count: 7, size: 0.85, sizeVar: 0.25, chaos: 0.3, relax: 0.6, layout: 'spiral', seed: 11,
  web: 0.045, rim: 0.045, round: 0.5, square: 0.15, stretch: 0.25, flow: 35, egg: 0.15,
  rotate: 0,
};

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- ordered layouts -------------------------------------------------------
function spiral(n, rad, dDiv = 0, dSpin = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = rad * Math.sqrt((i + 0.5) / n), a = i * (GOLDEN + dDiv) + dSpin;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

function rings(n, rad, phase = []) {
  const pts = [];
  const center = n >= 5;
  if (center) pts.push([0, 0]);
  const left = n - pts.length;
  const nr = Math.max(1, Math.round(Math.sqrt(left / 3)));
  const radii = Array.from({ length: nr }, (_, k) => (rad * 0.74 * (k + 1)) / nr);
  const sum = radii.reduce((a, b) => a + b, 0);
  let placed = 0;
  radii.forEach((r, k) => {
    const cnt = k === nr - 1 ? left - placed : Math.max(1, Math.round((left * r) / sum));
    placed += cnt;
    for (let j = 0; j < cnt; j++) {
      const a = (j / cnt) * TAU + (k % 2) * (Math.PI / Math.max(cnt, 1)) + 0.4 + (phase[k] || 0);
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  });
  return pts.slice(0, n);
}

function hexgrid(n, rad, rot = 0, off = [0, 0]) {
  const pts = [], c = Math.cos(rot), sn = Math.sin(rot);
  for (let q = -8; q <= 8; q++) {
    for (let r = -8; r <= 8; r++) {
      const x = q + r / 2 + off[0], y = (r * Math.sqrt(3)) / 2 + off[1];
      pts.push([x * c - y * sn, x * sn + y * c]);
    }
  }
  const dist = (p) => Math.round(Math.hypot(p[0], p[1]) * 1e4);
  pts.sort((a, b) => dist(a) - dist(b) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const sel = pts.slice(0, n);
  const maxR = Math.max(...sel.map((p) => Math.hypot(p[0], p[1]))) + 0.55;
  return sel.map((p) => [(p[0] / maxR) * rad, (p[1] / maxR) * rad]);
}

// ---- anisotropic metric (stretch cells along a flow direction) -------------
function metric(flowDeg, stretch) {
  const lam = 1 + 2 * stretch;
  const f = (flowDeg * Math.PI) / 180;
  return { lam, f, fx: Math.cos(f), fy: Math.sin(f), c: 1 / (lam * lam) - 1 };
}

const effW = (s) => s.w - (1 - s.p) * (1 - s.p) * PRES_K;

// flat triples [nx, ny, beta] : boundary is n·(x - site) = beta (already inset)
function constraints(sites, i, m, inset) {
  const s = sites[i], out = [];
  for (let j = 0; j < sites.length; j++) {
    const t = sites[j];
    if (j === i || t.p < 0.002) continue;
    const dx = t.x - s.x, dy = t.y - s.y;
    const fd = m.fx * dx + m.fy * dy;
    const gx = dx + m.c * fd * m.fx, gy = dy + m.c * fd * m.fy;
    const gl = Math.hypot(gx, gy);
    if (!(gl > 1e-6)) continue;
    const b = 0.5 * (dx * gx + dy * gy + (effW(s) - effW(t)));
    out.push(gx / gl, gy / gl, b / gl - inset);
  }
  return out;
}

const tables = new Map();
function trig(S) {
  if (!tables.has(S)) {
    const c = new Float64Array(S), s = new Float64Array(S);
    for (let a = 0; a < S; a++) { c[a] = Math.cos((a * TAU) / S); s[a] = Math.sin((a * TAU) / S); }
    tables.set(S, [c, s]);
  }
  return tables.get(S);
}

function softmin(v, n, k) {
  let m = Infinity;
  for (let i = 0; i < n; i++) if (v[i] < m) m = v[i];
  if (k <= 1e-6) return m;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.exp(-(v[i] - m) / k);
  return m - k * Math.log(s);
}

function radial(sites, i, cfg, S, inset, k, capFn, out, pre) {
  const s = sites[i], cons = pre || constraints(sites, i, cfg.m, inset), nc = cons.length / 3;
  const vals = new Float64Array(nc + 1), [ct, st] = trig(S), pp = s.x * s.x + s.y * s.y;
  for (let a = 0; a < S; a++) {
    const ux = ct[a], uy = st[a], pu = s.x * ux + s.y * uy;
    let n = 0;
    vals[n++] = -pu + Math.sqrt(Math.max(pu * pu - pp + cfg.Rin * cfg.Rin, 0));
    for (let c = 0; c < nc; c++) {
      const nu = cons[3 * c] * ux + cons[3 * c + 1] * uy;
      if (nu > 1e-3) vals[n++] = cons[3 * c + 2] / nu;
    }
    let r = softmin(vals, n, k);
    if (capFn) {
      // cap is blended with a much tighter softness, so free-standing pebbles stay clean shapes
      const c = capFn((a * TAU) / S), kk = k * 0.3, m = Math.min(r, c);
      r = kk <= 1e-6 ? m : m - kk * Math.log(1 + Math.exp(-Math.abs(r - c) / kk));
    }
    out[a] = Math.max(r, 0);
  }
}

function makeCap(s, cfg) {
  const base = cfg.capBase * (1 + 0.45 * cfg.sizeVar * s.sv) * Math.max(s.p, 0);
  const a = Math.sqrt(cfg.m.lam), b = 1 / a, e = 2 + cfg.sq * 4;
  return (th) => {
    const t = th - cfg.m.f, c = Math.cos(t), sn = Math.sin(t);
    const r = Math.pow(Math.pow(Math.abs(c) / a, e) + Math.pow(Math.abs(sn) / b, e), -1 / e);
    return base * r * (1 + cfg.egg * 0.35 * c);
  };
}

function prepare(p, sites) {
  const n = Math.max(2, sites.reduce((a, s) => a + s.p, 0));
  const Rin = R * (1 - p.rim), spacing = Rin / Math.sqrt(n);
  return {
    m: metric(p.flow, p.stretch), Rin, spacing, web: p.web * R,
    roundK: p.round * 0.6, capBase: (0.28 + 1.5 * p.size) * spacing,
    sq: p.square, egg: p.egg, sizeVar: p.sizeVar,
  };
}

// ---- layout ----------------------------------------------------------------
// The seed also varies the ordered pattern itself (spiral divergence angle, each ring's phase, grid rotation and
// offset), so a new seed changes the design even at 0% Randomness. It is measured against the design's own starting
// seed (seed0): at seed === seed0 every delta is exactly zero, so a saved design never changes its look.
function patternVariation(seed) {
  const r = rng(((seed | 0) ^ 0x51ed270b) >>> 0);
  return { div: (r() - 0.5) * 0.7, ring: Array.from({ length: 6 }, () => r() * TAU), rot: r() * (Math.PI / 3), off: [r() - 0.5, r() - 0.5], spin: r() * TAU };
}

export function layoutSites(p) {
  const n = Math.round(p.count), Rin = R * (1 - p.rim), rad = Rin * 0.82;
  const v = patternVariation(p.seed), v0 = patternVariation(p.seed0 ?? 0);
  const base = p.layout === 'rings' ? rings(n, rad, v.ring.map((x, k) => x - v0.ring[k]))
    : p.layout === 'grid' ? hexgrid(n, rad, v.rot - v0.rot, [v.off[0] - v0.off[0], v.off[1] - v0.off[1]])
    : spiral(n, rad, v.div - v0.div, v.spin - v0.spin);
  const spacing = Rin / Math.sqrt(Math.max(n, 1)), rnd = rng(p.seed);
  const sites = base.map((pt) => {
    const a = rnd() * TAU, mg = Math.sqrt(rnd()), sv = rnd() * 2 - 1;
    let x = pt[0] + Math.cos(a) * mg * p.chaos * spacing * 1.5;
    let y = pt[1] + Math.sin(a) * mg * p.chaos * spacing * 1.5;
    const r = Math.hypot(x, y);
    if (r > rad) { x *= rad / r; y *= rad / r; }
    return { x, y, w: sv * p.sizeVar * 0.55 * spacing * spacing, sv, p: 1 };
  });
  if (p.relax > 0.001 && n > 1) {
    const cfg = prepare(p, sites), S = 48, buf = new Float64Array(S), [ct, st] = trig(S);
    for (let it = 0; it < 5; it++) {
      const next = sites.map((s, i) => {
        radial(sites, i, cfg, S, 0, 0, null, buf);
        let sr2 = 0, sx = 0, sy = 0;
        for (let a = 0; a < S; a++) { const r = buf[a]; sr2 += r * r; sx += r * r * r * ct[a]; sy += r * r * r * st[a]; }
        if (sr2 < 1e-9) return [s.x, s.y];   // squeezed-out cell: no centroid, keep the site put
        const step = p.relax * 0.8;
        return [s.x + ((2 / 3) * sx / sr2) * step, s.y + ((2 / 3) * sy / sr2) * step];
      });
      next.forEach((q, i) => {
        const r = Math.hypot(q[0], q[1]), lim = Rin * 0.9;
        const k = r > lim ? lim / r : 1;
        sites[i].x = q[0] * k; sites[i].y = q[1] * k;
      });
    }
  }
  return sites;
}

// ---- pebble outlines -------------------------------------------------------
const f2 = (v) => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r); };

export function closedSpline(pts) {
  const n = pts.length;
  let d = `M${f2(pts[0][0])} ${f2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f2(p1[0] + (p2[0] - p0[0]) / 6)} ${f2(p1[1] + (p2[1] - p0[1]) / 6)} ` +
         `${f2(p2[0] - (p3[0] - p1[0]) / 6)} ${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(p2[0])} ${f2(p2[1])}`;
  }
  return d + 'Z';
}


// ---- lean paths for export ---------------------------------------------------
// Picks only the anchors a curve needs (dense where it bends, sparse where it is calm) and joins them with
// cubic Beziers, so the SVG stays clean to edit in Illustrator / Figma. tol is in logo units (circle radius = 100).
function anchorTangents(P, idx) {
  const m = idx.length;
  return idx.map((_, k) => {
    const a = P[idx[(k - 1 + m) % m]], b = P[idx[(k + 1) % m]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];              // unit tangent
  });
}

// Bezier handles from unit tangents. Handle length d / (3 cos^2(alpha/2)), alpha = angle between tangent and chord,
// is exact for a circular arc, so calm curves stay round instead of turning into polygons.
function segment(a, b, ta, tb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-9;
  const ux = dx / d, uy = dy / d;
  const ha = d / (3 * Math.cos(Math.acos(Math.min(1, Math.max(-1, ta[0] * ux + ta[1] * uy))) / 2) ** 2);
  const hb = d / (3 * Math.cos(Math.acos(Math.min(1, Math.max(-1, tb[0] * ux + tb[1] * uy))) / 2) ** 2);
  return [[a[0] + ta[0] * ha, a[1] + ta[1] * ha], [b[0] - tb[0] * hb, b[1] - tb[1] * hb]];
}

const distToSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

// Error is the true distance from each dense point to the fitted curve (not a same-parameter comparison,
// which over-reports because a Bezier's t is not arc length).
export function fitPath(P, tol = 0.15, maxAnchors = 64) {
  const N = P.length, SAMP = 20;
  let idx = [0, N >> 2, N >> 1, (3 * N) >> 2], maxErr = 0;
  for (let iter = 0; iter < 80; iter++) {
    const T = anchorTangents(P, idx), m = idx.length, adds = [];
    maxErr = 0;
    for (let k = 0; k < m; k++) {
      const i0 = idx[k], i1 = idx[(k + 1) % m] + (k === m - 1 ? N : 0);
      const a = P[i0], b = P[i1 % N], [c1, c2] = segment(a, b, T[k], T[(k + 1) % m]);
      const poly = [];
      for (let q = 0; q <= SAMP; q++) {
        const t = q / SAMP, u = 1 - t;
        poly.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
                   u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]);
      }
      let worst = 0, worstAt = -1;
      for (let j = i0 + 1; j < i1; j++) {
        const q = P[j % N];
        let best = Infinity;
        for (let r = 0; r < SAMP; r++) best = Math.min(best, distToSeg(q, poly[r], poly[r + 1]));
        if (best > worst) { worst = best; worstAt = j % N; }
      }
      maxErr = Math.max(maxErr, worst);
      if (worst > tol && i1 - i0 > 1) adds.push(worstAt);
    }
    if (!adds.length || idx.length >= maxAnchors) break;
    idx = [...new Set([...idx, ...adds])].sort((x, y) => x - y);
  }
  const T = anchorTangents(P, idx), m = idx.length;
  let d = `M${f2(P[idx[0]][0])} ${f2(P[idx[0]][1])}`;
  for (let k = 0; k < m; k++) {
    const a = P[idx[k]], b = P[idx[(k + 1) % m]], [c1, c2] = segment(a, b, T[k], T[(k + 1) % m]);
    d += `C${f2(c1[0])} ${f2(c1[1])} ${f2(c2[0])} ${f2(c2[1])} ${f2(b[0])} ${f2(b[1])}`;
  }
  return { d: d + 'Z', anchors: m, maxErr };
}

// Outline points for every visible pebble as a flat Float64Array [x0, y0, x1, y1, ...]. The canvas renderer draws
// these directly (no path strings, no DOM); buildPebbles below turns them into SVG paths for export and thumbnails.
export function buildOutlines(sites, p, S = 96) {
  const cfg = prepare(p, sites), buf = new Float64Array(S), hard = new Float64Array(S), [ct, st] = trig(S), out = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (s.p < 0.004) continue;
    const cons = constraints(sites, i, cfg.m, cfg.web / 2), cap = makeCap(s, cfg);
    radial(sites, i, cfg, S, 0, 0, cap, hard, cons);
    let rms = 0;
    for (let a = 0; a < S; a++) rms += hard[a] * hard[a];
    rms = Math.sqrt(rms / S);
    radial(sites, i, cfg, S, 0, cfg.roundK * rms, cap, buf, cons);
    let maxr = 0;
    const pts = new Float64Array(2 * S);
    for (let a = 0; a < S; a++) { maxr = Math.max(maxr, buf[a]); pts[2 * a] = s.x + buf[a] * ct[a]; pts[2 * a + 1] = s.y + buf[a] * st[a]; }
    if (maxr < 0.6) continue;
    out.push({ i, pts, r: maxr });
  }
  return out;
}

export function buildPebbles(sites, p, S = 96, tol = 0) {
  return buildOutlines(sites, p, S).map(({ i, pts, r }) => {
    const pairs = Array.from({ length: S }, (_, a) => [pts[2 * a], pts[2 * a + 1]]);
    const fitted = tol > 0 ? fitPath(pairs, tol) : null;
    return { i, d: fitted ? fitted.d : closedSpline(pairs), anchors: fitted ? fitted.anchors : S, cx: sites[i].x, cy: sites[i].y, r };
  });
}

export function rotateSites(sites, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return sites.map((q) => ({ ...q, x: q.x * c - q.y * s, y: q.x * s + q.y * c }));
}
