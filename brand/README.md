# Outcome brand — company colours + logo (for now)

Chosen 2026-09-22. Marked "for now" — treat as the working palette until the visual identity is finalised.

## Colours

| Name   | Hex       | Role |
|--------|-----------|------|
| Forest | `#0E3B2C` | Dark ink — text, primary-button fill, logo ink |
| Coral  | `#FF5A4E` | Vivid accent — logo window stage, hover glow |
| Cream  | `#FFF1E6` | Light chrome — page/panel background, text on the forest button |

These are wired into the tool's **Company** colour mode: `js/themes.js` → `THEMES.company` (chrome tokens) and
`COMPANY_SWATCHES` (the three one-click presets in the Color card — Forest-on-cream, Coral-on-forest,
Cream-on-forest, matching the two lockups below). They're also in the Figma design-system file
(`IMD0NSFxZTGdkCbMzmQ5Oc`) as the Company mode of the `Theme` variable collection.

## Logo

`outcome-logo-a.svg` is the current pick for the company mark — a single evenodd compound path (circle disc
minus pebble faces), filled forest for use on light backgrounds. It reverses to coral-on-forest or
cream-on-forest for dark backgrounds (see the reference lockups this was chosen from).

Used as:
- the mark in the tool's own header (`index.html`, `.brand .mark`, `fill="currentColor"` so it themes with
  Bright/Dark/Company automatically)
- the browser-tab favicon (`<link rel="icon">` in `index.html`)

The `-a` suffix is the user's own naming — later options would be `outcome-logo-b.svg` etc.
