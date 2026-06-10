// ---------------------------------------------------------------------------
// extract-palette.mjs — pywal for the web.
//
// Reads public/wallpaper.{jpg,jpeg,png}, clusters its colours, and generates:
//   src/styles/palette.css   (CSS custom properties the whole site uses)
//   src/data/wallpaper.json  (which file was used, + the palette)
//   public/favicon.svg       (a ">_" prompt glyph in the accent colour)
//
// Swap the wallpaper file, rebuild, and the entire site re-themes itself.
// Runs automatically before `astro dev` and `astro build` (see package.json).
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(root, 'public');

// ---------- find the wallpaper ----------
const candidates = ['wallpaper.jpg', 'wallpaper.jpeg', 'wallpaper.png'];
const file = candidates.find((f) => fs.existsSync(path.join(PUB, f)));

// ---------- decode ----------
async function decode(filePath) {
  const buf = fs.readFileSync(filePath);
  if (/\.png$/i.test(filePath)) {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(buf);
    return { data: png.data, width: png.width, height: png.height };
  }
  const jpeg = (await import('jpeg-js')).default;
  const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { data: img.data, width: img.width, height: img.height };
}

// ---------- colour maths ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

const hex = (rgb) => '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Raise lightness until the colour reads clearly on a near-black glass panel. */
function readable(rgb, bg, min = 5.4) {
  let [h, s, l] = rgbToHsl(rgb);
  s = clamp(s, 0.35, 0.95); // keep some sat so it doesn't wash to grey
  let out = hslToRgb([h, s, l]);
  let guard = 0;
  while (contrast(out, bg) < min && l < 0.95 && guard++ < 40) {
    l += 0.02;
    out = hslToRgb([h, s, l]);
  }
  return out;
}

// ---------- k-means ----------
function kmeans(pixels, k = 7, iters = 14) {
  // seed with evenly spaced samples
  const centers = Array.from({ length: k }, (_, i) => [...pixels[Math.floor((i / k) * pixels.length)]]);
  let assign = new Array(pixels.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = pixels[i][0] - centers[c][0];
        const dy = pixels[i][1] - centers[c][1];
        const dz = pixels[i][2] - centers[c][2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = c; }
      }
      assign[i] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const s = sum[assign[i]];
      s[0] += pixels[i][0]; s[1] += pixels[i][1]; s[2] += pixels[i][2]; s[3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sum[c][3]) centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
  }
  const weights = new Array(k).fill(0);
  assign.forEach((a) => weights[a]++);
  return centers.map((c, i) => ({ rgb: c.map(Math.round), weight: weights[i] / pixels.length }));
}

// ---------- palette selection ----------
function buildPalette(clusters) {
  const scored = clusters.map((c) => {
    const [h, s, l] = rgbToHsl(c.rgb);
    // favour saturated, mid-lightness colours that actually appear in the image
    const fit = l > 0.12 && l < 0.85 ? 1 : 0.25;
    return { ...c, h, s, l, score: s * fit * Math.sqrt(c.weight + 0.02) };
  }).sort((a, b) => b.score - a.score);

  const accentC = scored[0];
  const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const accent2C = scored.find((c) => hueDist(c.h, accentC.h) > 40) ?? scored[1] ?? accentC;
  const darkest = [...clusters].sort((a, b) => rgbToHsl(a.rgb)[2] - rgbToHsl(b.rgb)[2])[0];

  // deep background: take the darkest cluster's hue, clamp it nearly black
  const [dh, ds] = rgbToHsl(darkest.rgb);
  const bgDeep = hslToRgb([dh, clamp(ds, 0.1, 0.5), 0.055]);
  const bgPanel = hslToRgb([dh, clamp(ds, 0.1, 0.45), 0.09]);

  const accent = readable(accentC.rgb, bgDeep);
  const accent2 = readable(accent2C.rgb, bgDeep);
  const fg = hslToRgb([dh, 0.08, 0.92]);
  const fgDim = hslToRgb([dh, 0.07, 0.66]);

  return {
    accent: hex(accent),
    accent2: hex(accent2),
    accentRaw: hex(accentC.rgb.map(Math.round)),
    bgDeep: hex(bgDeep),
    bgPanel: hex(bgPanel),
    fg: hex(fg),
    fgDim: hex(fgDim),
    swatches: scored.slice(0, 6).map((c) => hex(c.rgb)),
  };
}

const FALLBACK = {
  accent: '#ffb454', accent2: '#7fd1c0', accentRaw: '#d18a2d',
  bgDeep: '#0c0a08', bgPanel: '#141109', fg: '#ebe6df', fgDim: '#a89f93',
  swatches: ['#ffb454', '#7fd1c0', '#d18a2d', '#403020', '#1a140c', '#0c0a08'],
};

// ---------- run ----------
let palette = FALLBACK;
let usedFile = null;

if (file) {
  try {
    const { data, width, height } = await decode(path.join(PUB, file));
    const total = width * height;
    const step = Math.max(1, Math.floor(total / 26000)); // ~26k samples
    const pixels = [];
    for (let i = 0; i < total; i += step) {
      const o = i * 4;
      pixels.push([data[o], data[o + 1], data[o + 2]]);
    }
    palette = buildPalette(kmeans(pixels));
    usedFile = file;
    console.log(`[palette] ${file} → accent ${palette.accent} · accent2 ${palette.accent2} · bg ${palette.bgDeep}`);
  } catch (e) {
    console.warn(`[palette] failed to read ${file} (${e.message}) — using fallback amber palette`);
  }
} else {
  console.warn('[palette] no public/wallpaper.{jpg,png} found — using fallback amber palette');
}

const css = `/* GENERATED by scripts/extract-palette.mjs — do not edit.
 * Source: ${usedFile ?? 'fallback palette (no wallpaper found)'}
 * Swap public/${usedFile ?? 'wallpaper.jpg'} and rebuild to re-theme the site. */
:root {
  --accent: ${palette.accent};
  --accent-2: ${palette.accent2};
  --accent-raw: ${palette.accentRaw};
  --accent-dim: color-mix(in srgb, ${palette.accent} 34%, transparent);
  --accent-faint: color-mix(in srgb, ${palette.accent} 12%, transparent);
  --bg-deep: ${palette.bgDeep};
  --bg-panel: ${palette.bgPanel};
  --fg: ${palette.fg};
  --fg-dim: ${palette.fgDim};
  --glass: color-mix(in srgb, ${palette.bgDeep} 58%, transparent);
  --glass-border: color-mix(in srgb, ${palette.fg} 9%, transparent);
}
`;

fs.mkdirSync(path.join(root, 'src/styles'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/styles/palette.css'), css);
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'src/data/wallpaper.json'),
  JSON.stringify({ file: usedFile, palette }, null, 2),
);

// favicon: a ">_" prompt in the accent colour
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="13" fill="${palette.bgDeep}"/>
<rect width="64" height="64" rx="13" fill="none" stroke="${palette.accent}" stroke-opacity=".45" stroke-width="3"/>
<path d="M16 22l12 10-12 10" fill="none" stroke="${palette.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="34" y="40" width="15" height="6" rx="3" fill="${palette.accent2}"/>
</svg>`;
fs.writeFileSync(path.join(PUB, 'favicon.svg'), favicon);

console.log('[palette] wrote src/styles/palette.css, src/data/wallpaper.json, public/favicon.svg');
