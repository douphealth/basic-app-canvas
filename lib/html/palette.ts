/**
 * Derive a product-box palette from the actual colors used in a blog post.
 *
 * Heuristic, CSS-only (no canvas / no image fetch):
 *  - Scan inline `style="..."` color/background/border declarations.
 *  - Scan <a>/<button>/<h1-h3> color hints.
 *  - Tally hex + rgb() colors, drop near-white / near-black / near-grey.
 *  - The most-frequent vivid color becomes `primary`; we derive siblings.
 *
 * Falls back gracefully — if nothing strong is found, returns undefined so
 * the product box keeps its baked-in defaults.
 */

import type { ProductBoxPalette } from './product-boxes';

type RGB = { r: number; g: number; b: number };

const HEX_RE = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/gi;

const clamp = (n: number, a = 0, b = 255) => Math.max(a, Math.min(b, n));
const toHex = ({ r, g, b }: RGB) =>
  '#' + [r, g, b].map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('');

const parseHex = (h: string): RGB | null => {
  let v = h.replace('#', '');
  if (v.length === 3) v = v.split('').map(c => c + c).join('');
  if (v.length !== 6) return null;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

// HSL helpers
const rgbToHsl = ({ r, g, b }: RGB) => {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R: h = ((G - B) / d + (G < B ? 6 : 0)); break;
      case G: h = ((B - R) / d + 2); break;
      default: h = ((R - G) / d + 4);
    }
    h *= 60;
  }
  return { h, s, l };
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1)      [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else             [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
};

/** Vivid enough to be a brand color? */
const isVivid = (rgb: RGB) => {
  const { s, l } = rgbToHsl(rgb);
  // exclude near-greys (s low), too dark or too light
  return s >= 0.35 && l >= 0.18 && l <= 0.78;
};

/** Bin colors into ~30° hue buckets to consolidate similar shades. */
const bucketKey = (rgb: RGB) => {
  const { h } = rgbToHsl(rgb);
  return Math.round(h / 30) % 12;
};

const mix = (a: RGB, t: RGB, amount: number): RGB => ({
  r: a.r + (t.r - a.r) * amount,
  g: a.g + (t.g - a.g) * amount,
  b: a.b + (t.b - a.b) * amount,
});

const lighten = (rgb: RGB, amount: number) => {
  const { h, s, l } = rgbToHsl(rgb);
  return hslToRgb(h, s, clamp(l + amount, 0, 1) as number);
};
const shiftHue = (rgb: RGB, deg: number) => {
  const { h, s, l } = rgbToHsl(rgb);
  return hslToRgb((h + deg + 360) % 360, s, l);
};

export const extractPalette = (html: string): ProductBoxPalette | undefined => {
  if (!html) return undefined;
  const counts = new Map<number, { rgb: RGB; n: number; sumS: number }>();

  const consider = (rgb: RGB) => {
    if (!isVivid(rgb)) return;
    const k = bucketKey(rgb);
    const { s } = rgbToHsl(rgb);
    const cur = counts.get(k);
    if (cur) { cur.n += 1; cur.sumS += s; }
    else counts.set(k, { rgb, n: 1, sumS: s });
  };

  let m: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(html))) {
    const rgb = parseHex(m[0]);
    if (rgb) consider(rgb);
  }
  RGB_RE.lastIndex = 0;
  while ((m = RGB_RE.exec(html))) {
    consider({ r: +m[1], g: +m[2], b: +m[3] });
  }

  if (counts.size === 0) return undefined;

  // Pick winner: weight by occurrences * average saturation (vivid + frequent).
  let winner: { rgb: RGB; score: number } | null = null;
  for (const v of counts.values()) {
    const score = v.n * (v.sumS / v.n);
    if (!winner || score > winner.score) winner = { rgb: v.rgb, score };
  }
  if (!winner) return undefined;

  const primary = winner.rgb;
  const primary2 = shiftHue(primary, 18);                  // gradient companion
  const primaryLight = lighten(primary, 0.12);             // softer accent
  const accentTint = mix(primary, { r: 255, g: 255, b: 255 }, 0.92); // ~8% tint
  const accentBorder = mix(primary, { r: 255, g: 255, b: 255 }, 0.78);
  // Ensure accent text stays readable: darken primary toward black.
  const accentText = mix(primary, { r: 0, g: 0, b: 0 }, 0.25);

  return {
    primary:       toHex(primary),
    primary2:      toHex(primary2),
    primaryLight:  toHex(primaryLight),
    accentTint:    toHex(accentTint),
    accentBorder:  toHex(accentBorder),
    accentText:    toHex(accentText),
  };
};
