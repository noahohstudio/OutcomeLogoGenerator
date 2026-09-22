// Bright/Dark stay greyscale by design. `company` holds the brand palette — forest, coral and cream
// (chosen 2026-09-22; still "for now", so update here and in the Figma variables if it changes).
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
    // Forest is the dark ink (text, accent fill, logo ink) — it plays the near-black role the greyscale
    // themes use. Coral is the vivid brand colour (stage, glow, hover) — it plays the role lime used to.
    // Cream is the light chrome (page/panel) and, importantly, the text on the forest accent button: cream
    // on forest reads at ~11:1 contrast, where coral would only clear ~4:1.
    ui: { bg: '#fff1e6', panel: '#f1e6db', text: '#0e3b2c', muted: '#7a8d80', line: '#e2dbd0', btn: '#e7dfd3', btnText: '#0e3b2c', accent: '#0e3b2c', accentText: '#fff1e6', canvas: '#ff5a4e', glow: '#ff5a4e' },
    logo: { ink: '#0e3b2c', bg: '#ff5a4e', pebble: '#ff5a4e', fill: 'hole', mix: ['#fff1e6', '#0e3b2c', '#ff5a4e', '#7a8d80'] },
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

// Forest-on-cream and coral-on-forest are the two lockups in the brand reference; Cream-on-forest is the
// reversed neutral for a third option.
export const COMPANY_SWATCHES = [
  { name: 'Forest', ink: '#0e3b2c', bg: '#fff1e6' },
  { name: 'Coral',  ink: '#ff5a4e', bg: '#0e3b2c' },
  { name: 'Cream',  ink: '#fff1e6', bg: '#0e3b2c' },
];

export const swatchesFor = (theme) => (theme === 'company' ? [...COMPANY_SWATCHES, ...GREY_SWATCHES.slice(0, 2)] : GREY_SWATCHES);
