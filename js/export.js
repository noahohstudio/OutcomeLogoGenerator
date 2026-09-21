// Export the active variant: SVG (true holes, rotation baked in), PNG, or clipboard.
import { logoSVG } from './svg.js';

export function svgString(v, { background = false, size } = {}) {
  return logoSVG(v.params, v.colors, { S: 180, tol: 0.2, background, pad: background ? 12 : 0, size });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const fileBase = (v) => `outcome-logo-${v.name.toLowerCase()}`;

export function exportSVG(v, background) {
  download(new Blob([svgString(v, { background })], { type: 'image/svg+xml' }), `${fileBase(v)}${background ? '-bg' : ''}.svg`);
}

export async function exportPNG(v, px = 2048) {
  const url = URL.createObjectURL(new Blob([svgString(v, { background: true, size: px })], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  canvas.getContext('2d').drawImage(img, 0, 0, px, px);
  URL.revokeObjectURL(url);
  canvas.toBlob((b) => download(b, `${fileBase(v)}.png`), 'image/png');
}

export async function copySVG(v) {
  await navigator.clipboard.writeText(svgString(v));
}
