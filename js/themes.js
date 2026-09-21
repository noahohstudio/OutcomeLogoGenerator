// Everything is greyscale until the brand colours are decided.
// `company` holds PLACEHOLDER values: swap them here (and in the Figma variables) once the palette is chosen.
// ui   = tool chrome tokens (mapped to CSS variables). glow = the brand primary used for the button hover glow (null = none)
// logo = default logo colours for that theme. fill: 'hole' | 'solid' | 'mix'

export const THEMES = {
  bright: {
    label: 'Bright',
    ui: { bg: '#ffffff', panel: '#efefef', text: '#050505', muted: '#8f8f8f', line: '#dcdcdc', btn: '#dcdcdc', btnText: '#050505', accent: '#050505', accentText: '#ffffff', canvas: '#f7f7f7', glow: null },
    logo: { ink: '#0b0b0b', bg: '#f7f7f7', pebble: '#f7f7f7', fill: 'hole', mix: ['#d9d9d9', '#b4b4b4', '#8c8c8c', '#5f5f5f'] },
  },
  dark: {
    label: 'Dark',
    ui: { bg: '#0b0b0b', panel: '#181818', text: '#f2f2f2', muted: '#7a7a7a', line: '#2a2a2a', btn: '#262626', btnText: '#f2f2f2', accent: '#f2f2f2', accentText: '#0b0b0b', canvas: '#101010', glow: null },
    logo: { ink: '#f2f2f2', bg: '#101010', pebble: '#101010', fill: 'hole', mix: ['#3a3a3a', '#5f5f5f', '#8c8c8c', '#b4b4b4'] },
  },
  company: {
    label: 'Company',
    ui: { bg: '#ecebe4', panel: '#e0ded3', text: '#0f1210', muted: '#7f7f74', line: '#cdcbbf', btn: '#d3d1c4', btnText: '#0f1210', accent: '#0f1210', accentText: '#d8ff3a', canvas: '#d8ff3a', glow: '#d8ff3a' },
    logo: { ink: '#0f1210', bg: '#d8ff3a', pebble: '#d8ff3a', fill: 'hole', mix: ['#ecebe4', '#2f6b57', '#ff7a59', '#0f1210'] },
  },
};

export const THEME_ORDER = ['bright', 'dark', 'company'];

// One-click logo colour presets shown in the COLOR card (ink on background).
export const GREY_SWATCHES = [
  { name: 'Black',    ink: '#0b0b0b', bg: '#f2f2f2' },
  { name: 'Graphite', ink: '#2b2b2b', bg: '#dcdcdc' },
  { name: 'Steel',    ink: '#6b6b6b', bg: '#ececec' },
  { name: 'Fog',      ink: '#c9c9c9', bg: '#2a2a2a' },
  { name: 'White',    ink: '#f2f2f2', bg: '#0b0b0b' },
];

export const COMPANY_SWATCHES = [
  { name: 'Lime',   ink: '#0f1210', bg: '#d8ff3a' },
  { name: 'Forest', ink: '#2f6b57', bg: '#ecebe4' },
  { name: 'Ember',  ink: '#ff7a59', bg: '#0f1210' },
];

export const swatchesFor = (theme) => (theme === 'company' ? [...COMPANY_SWATCHES, ...GREY_SWATCHES.slice(0, 2)] : GREY_SWATCHES);
