import { R, layoutSites, buildPebbles, rotateSites } from './geometry.js';

import { THEMES } from './themes.js';

export const DEFAULT_COLORS = { ...THEMES.bright.logo };

const CIRCLE = `M${-R} 0A${R} ${R} 0 1 0 ${R} 0A${R} ${R} 0 1 0 ${-R} 0Z`;

export function pebblesFor(params, S = 96, tol = 0) {
  const sites = rotateSites(layoutSites(params), params.rotate);
  return buildPebbles(sites, { ...params, flow: params.flow + params.rotate }, S, tol);
}

// Inner SVG elements (no <svg> wrapper). Rotation is baked into the geometry.
export function logoBody(params, colors = DEFAULT_COLORS, S = 120, tol = 0) {
  const pebbles = pebblesFor(params, S, tol);
  if (colors.fill === 'hole') {
    return `<path fill="${colors.ink}" fill-rule="evenodd" d="${CIRCLE}${pebbles.map((p) => p.d).join('')}"/>`;
  }
  const fills = pebbles.map((p, k) => (colors.fill === 'mix' && colors.mix.length ? colors.mix[k % colors.mix.length] : colors.pebble));
  return `<circle r="${R}" fill="${colors.ink}"/>` + pebbles.map((p, k) => `<path fill="${fills[k]}" d="${p.d}"/>`).join('');
}

export function logoSVG(params, colors = DEFAULT_COLORS, opts = {}) {
  const { S = 120, tol = 0, pad = 0, background = false, size } = opts;
  const v = R + pad, dim = size ? ` width="${size}" height="${size}"` : '';
  const bg = background ? `<rect x="${-v}" y="${-v}" width="${2 * v}" height="${2 * v}" fill="${colors.bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-v} ${-v} ${2 * v} ${2 * v}"${dim}>${bg}${logoBody(params, colors, S, tol)}</svg>`;
}
