// Live canvas view. Slider values are targets; the displayed values chase them with exponential smoothing,
// so every change (count, seed, layout, colour, zoom) morphs instead of jumping.
//
// Drawing straight to a 2D canvas keeps each frame to a few Bezier paths on the GPU: no path strings, no DOM or
// style recalculation. Resolution drops automatically if frames run slow and returns to full sharpness when still.
// (Exports and tab thumbnails still use the SVG builders in svg.js.)
import { layoutSites, buildOutlines } from './geometry.js';

const SMOOTH = ['size', 'sizeVar', 'web', 'rim', 'round', 'square', 'stretch', 'flow', 'egg'];
const LAYOUT = ['count', 'layout', 'chaos', 'seed', 'seed0', 'relax', 'sizeVar', 'stretch', 'flow', 'rim'];
const NMAX = 24, RATE = 13, TAU = Math.PI * 2, MAX_DPR = 2;

const hex = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
// true WCAG relative luminance (gamma-decoded per channel) - a plain 0-255 weighted average reads a saturated
// mid-tone like coral as ~0.49 ("light") when its real luminance is ~0.29 ("dark"), which is exactly the case
// that decides whether HUD text over the stage should be black or white.
const lum = (h) => hex(h).reduce((L, v, i) => {
  v /= 255; v = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return L + [0.2126, 0.7152, 0.0722][i] * v;
}, 0);

// closed Catmull-Rom spline through flat [x, y, ...] points, as cubic Beziers
function trace(ctx, f) {
  const n = f.length / 2;
  ctx.moveTo(f[0], f[1]);
  for (let i = 0; i < n; i++) {
    const a = ((i - 1 + n) % n) * 2, b = i * 2, c = ((i + 1) % n) * 2, d = ((i + 2) % n) * 2;
    ctx.bezierCurveTo(f[b] + (f[c] - f[a]) / 6, f[b + 1] + (f[c + 1] - f[a + 1]) / 6,
                      f[c] - (f[d] - f[b]) / 6, f[c + 1] - (f[d + 1] - f[b + 1]) / 6, f[c], f[c + 1]);
  }
  ctx.closePath();
}

export class LogoView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = canvas.closest('.preview');
    this.sites = []; this.tgt = [];
    this.target = null; this.disp = null; this.rot = 0;
    this.zoom = 1; this.zoomT = 1;
    this.col = null; this.colT = null;
    this.scale = 1;                       // adaptive resolution factor (1 = full sharpness)
    this.raf = 0; this.last = 0; this.frameEma = 0; this.frames = 0; this.settled = true;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  // params: full variant params. snap = jump instead of morphing (used on first load).
  set(params, colors, snap = false) {
    const first = !this.target || snap;
    const layoutChanged = first || LAYOUT.some((k) => params[k] !== this.target[k]);
    this.target = { ...params };
    if (first) {
      this.disp = Object.fromEntries(SMOOTH.map((k) => [k, params[k]]));
      this.rot = params.rotate; this.sites = []; this.tgt = [];
    }
    if (layoutChanged) this.retarget(first);
    this.setColors(colors, first);
    this.canvas.style.transform = params.tiltX || params.tiltY ? `rotateX(${params.tiltX}deg) rotateY(${params.tiltY}deg)` : 'none';
    this.kick();
  }

  setZoom(z, snap = false) { this.zoomT = z; if (snap) this.zoom = z; this.kick(); }

  retarget(first) {
    const ts = layoutSites(this.target);
    for (let i = 0; i < NMAX; i++) {
      const t = ts[i];
      if (t) {
        this.tgt[i] = { x: t.x, y: t.y, w: t.w, sv: t.sv, p: 1 };
        const s = this.sites[i];
        if (!s || first) this.sites[i] = { ...this.tgt[i], p: first ? 1 : 0 };
        else if (s.p < 0.02) Object.assign(s, { x: t.x, y: t.y, w: t.w, sv: t.sv });
      } else if (this.sites[i]) {
        this.tgt[i] = { ...this.sites[i], p: 0 };
      }
    }
  }

  setColors(colors, snap = false) {
    // The main window shows ink and background swapped - the disc reads in what the Color card calls
    // "Background" and the holes reveal what it calls "Ink". Purely a display choice for this one view:
    // thumbnails (tabs.js), export (export.js) and the Color card itself all use the real, un-swapped values.
    const dispInk = colors.bg, dispStage = colors.ink;
    const t = { fill: colors.fill, ink: hex(dispInk), pebble: hex(colors.pebble), mix: (colors.mix || []).map(hex) };
    this.colT = t;
    if (!this.col || snap) this.col = { fill: t.fill, ink: [...t.ink], pebble: [...t.pebble], mix: t.mix.map((c) => [...c]) };
    this.col.fill = t.fill;
    if (this.col.mix.length !== t.mix.length) this.col.mix = t.mix.map((c) => [...c]);
    // the stage colour is a CSS variable (it transitions in CSS); holes are cut out, so they always match it
    this.preview.style.setProperty('--stage', dispStage);
    // pick whichever of black/white actually contrasts more against the stage, rather than a flat 0.5 luminance
    // split (the true black/white crossover sits around L=0.18, not 0.5 - see lum() above)
    const bgL = lum(dispStage);
    const readsBetterOnBlack = (bgL + 0.05) / 0.05 >= 1.05 / (bgL + 0.05);
    this.preview.style.setProperty('--hud', readsBetterOnBlack ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)');
    this.kick();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * this.scale;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;   // resizing clears the canvas
      if (this.target) this.draw(this.settled ? 130 : 72);
    }
  }

  stats() { return `${Math.round(this.fps || 0)}fps · res ${Math.round(this.scale * 100)}%`; }

  kick() {
    this.settled = false;
    if (!this.raf) { this.last = performance.now(); this.frames = 0; this.raf = requestAnimationFrame(this.tick); }
  }

  tick = (now) => {
    const gap = now - this.last;
    const dt = Math.min(0.05, gap / 1000 || 0.016);
    this.last = now;
    const a = 1 - Math.exp(-dt * RATE);
    let err = 0;

    for (const k of SMOOTH) {
      const d = this.target[k] - this.disp[k];
      this.disp[k] += d * a;
      err += Math.abs(d) / (k === 'flow' ? 20 : 1);
    }
    const dr = this.target.rotate - this.rot;
    this.rot += dr * a; err += Math.abs(dr) / 20;
    const dz = this.zoomT - this.zoom;
    this.zoom += dz * a; err += Math.abs(dz);

    for (let i = 0; i < NMAX; i++) {
      const s = this.sites[i], t = this.tgt[i];
      if (!s || !t) continue;
      if (!(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.w))) { s.x = t.x; s.y = t.y; s.w = t.w; }
      s.x += (t.x - s.x) * a; s.y += (t.y - s.y) * a; s.w += (t.w - s.w) * a; s.sv = t.sv;
      const dp = t.p - s.p;
      s.p += dp * Math.min(1, a * 0.9);
      err += Math.abs(t.x - s.x) / 10 + Math.abs(t.y - s.y) / 10 + Math.abs(dp);
      if (t.p === 0 && s.p < 0.004) s.p = 0;
    }

    const c = this.col, ct = this.colT;
    const tween = (x, y) => { for (let j = 0; j < 3; j++) { const d = y[j] - x[j]; x[j] += d * a; err += Math.abs(d) / 255; } };
    tween(c.ink, ct.ink); tween(c.pebble, ct.pebble);
    c.mix.forEach((m, i) => tween(m, ct.mix[i]));

    this.settled = err < 0.004;

    // adaptive resolution: if the frame interval says we're under ~45 fps, render fewer pixels while things move
    this.frames++;
    if (this.frames > 4 && gap < 200) {
      this.frameEma = this.frameEma ? this.frameEma * 0.85 + gap * 0.15 : gap;
      this.fps = this.fps ? this.fps * 0.9 + (1000 / gap) * 0.1 : 1000 / gap;
    }
    if (!this.settled && this.frames > 10 && this.frameEma > 22 && this.scale > 0.55) {
      this.scale = Math.max(0.55, this.scale - 0.15); this.frameEma = 0; this.frames = 5; this.resize();
    }
    if (this.settled && this.scale < 1) { this.scale = 1; this.resize(); }

    this.draw(this.settled ? 130 : 72);
    this.raf = this.settled ? 0 : requestAnimationFrame(this.tick);
  };

  draw(S) {
    const { ctx, canvas } = this, W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // the mark spans 88% of the smaller side and is centred exactly, whatever the window shape. On mid-width windows
    // an equal gutter on both sides keeps it clear of the zoom / undo controls without moving the centre.
    const px = W / (canvas.clientWidth || W), gutter = canvas.clientWidth >= 600 ? 64 * px : 0;
    const side = Math.min(W - 2 * gutter, H);
    const k = ((side * 0.88) / 208) * this.zoom;
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.rotate((this.rot * Math.PI) / 180);

    const outs = buildOutlines(this.sites, { ...this.target, ...this.disp }, S), c = this.col;
    ctx.fillStyle = css(c.ink);
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, TAU);
    if (c.fill === 'hole') {
      for (const o of outs) trace(ctx, o.pts);   // pebbles are real holes: one even-odd path
      ctx.fill('evenodd');
    } else {
      ctx.fill();
      for (const o of outs) {
        ctx.beginPath();
        trace(ctx, o.pts);
        ctx.fillStyle = css(c.fill === 'mix' && c.mix.length ? c.mix[o.i % c.mix.length] : c.pebble);
        ctx.fill();
      }
    }
  }
}
