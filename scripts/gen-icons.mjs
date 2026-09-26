#!/usr/bin/env node
/**
 * Generates the PWA / home-screen icons from original pixel art (no external assets):
 * Wren's yellow raincoat hood with glowing eyes and a glowing candle-gold marble, in front of a
 * storm-drain pipe mouth in a dark brick wall, with rain and drain water.
 *
 *   npm run icons            → writes public/icons/*.png (commit them)
 *   node scripts/gen-icons.mjs --out <dir>   → writes somewhere else (previews)
 *
 * Includes a tiny dependency-free PNG encoder (node:zlib deflate + CRC-32).
 * Exports are used by tests/pwa-icons.test.ts (types in gen-icons.d.mts).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

// ── PNG encoder ──────────────────────────────────────────────────────────────

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (ISO-HDLC, as used by PNG and zlib). */
export function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/**
 * Encode 8-bit RGBA pixels (row-major, `width * height * 4` bytes) as a PNG.
 * `alpha: false` writes an opaque RGB image (colour type 2) and ignores the alpha bytes.
 * Rows use the "Up" filter, which makes scaled-up pixel art compress to almost nothing.
 */
export function encodePng(width, height, rgba, { alpha = true } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`bad PNG size ${width}x${height}`);
  }
  if (rgba.length !== width * height * 4) throw new RangeError('pixel buffer size does not match width*height*4');
  const ch = alpha ? 4 : 3;
  const stride = width * ch;
  const raw = new Uint8Array((stride + 1) * height);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = x * ch;
      cur[d] = rgba[s];
      cur[d + 1] = rgba[s + 1];
      cur[d + 2] = rgba[s + 2];
      if (alpha) cur[d + 3] = rgba[s + 3];
    }
    const o = y * (stride + 1);
    raw[o] = 2; // filter: Up (prior row is all zeros for y = 0)
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (cur[i] - prev[i]) & 0xff;
    prev.set(cur);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // colour type: RGBA / RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace
  const idat = new Uint8Array(deflateSync(raw, { level: 9 }));
  const parts = [PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ── Icon art (original) ──────────────────────────────────────────────────────

const PALETTE = {
  // Wren's raincoat (same colours as the in-game sprite)
  o: '#0d0b14', // outline
  Y: '#f5c52e', // coat
  y: '#c98a1f', // coat shade
  h: '#fff09a', // coat highlight
  d: '#7a4f17', // hood rim / seams
  k: '#1d1830', // dark inside the hood
  e: '#eaf7ff', // glowing eyes
  t: '#6b4a2f', // coat toggle
  // The marble
  N: '#b8561a', // deep amber edge (glowing things get no dark outline)
  n: '#e8862e', // rim
  m: '#ffcf57', // core
  M: '#fffbe8', // hot spot
};

/** Hood + shoulders, 20×22. The last row repeats downward when the icon is taller. */
const HOOD = [
  '.......oooooo.......',
  '.....ooYYYYYYoo.....',
  '....oYhhYYYYYYyo....',
  '...oYhhYYYYYYYYyo...',
  '..oYhYYYYYYYYYYYyo..',
  '..oYhYYYYYYYYYYYyo..',
  '.oYhYYddddddddYYYyo.',
  '.oYhYdkkkkkkkkdYYyo.',
  'oYhYYdkkkkkkkkdYYyyo',
  'oYhYdkkkkkkkkkkdYyyo',
  'oYhYdkeekkkkeekdYyyo',
  'oYhYdkeekkkkeekdYyyo',
  'oYhYdkeekkkkeekdYyyo',
  'oYYYdkkkkkkkkkkdYyyo',
  'oYYYYdkkkkkkkkdYyyyo',
  '.oYYYYddddddddYyyyo.',
  '..oyYYYYYYYYYYYYyo..',
  '.oYYYYYYYddYYYYYyyo.',
  'oYhYYYYYYdtYYYYYyyyo',
  'oYhYYYYYYdYYYYYYyyyo',
  'oYhYYYYYYdtYYYYYyyyo',
  'oYhYYYYYYdYYYYYYyyyo',
];

/** The glowing marble, 9×9. */
const MARBLE = [
  '...NNN...',
  '.NNmmmNN.',
  '.NmMMmmN.',
  'NmMMmmmnN',
  'NmMmmmmnN',
  'NmmmmmnnN',
  '.NmmmnnN.',
  '.NNnnnNN.',
  '...NNN...',
];

const BG = {
  wall: '#0b0d14',
  brick: ['#151a26', '#131723', '#171d2b'],
  mortar: '#0a0b11',
  ring: '#39435a',
  ringLight: '#56648a',
  ringShade: '#232a3b',
  void: '#05060a',
  bar: '#141925',
  barLight: '#1f2636',
  rain: '#2c4561',
  water: '#1a2c40',
  waterLight: '#3b5f7e',
};

const HALO = [255, 158, 56]; // same warm halo as the in-game marbles

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function validateMap(name, rows, legend) {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`${name} row ${i} is ${r.length} wide, expected ${w}`);
    for (const ch of r) if (ch !== '.' && !(ch in legend)) throw new Error(`${name} row ${i}: unknown colour '${ch}'`);
  });
}

validateMap('HOOD', HOOD, PALETTE);
validateMap('MARBLE', MARBLE, PALETTE);

/** Deterministic hash → [0, 1). */
function rand(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Compose the icon on a `size`×`size` pixel grid (RGBA). The layout scales with the grid, so the
 * same art makes the favicon, the "any" icons, the apple-touch icon and the maskable icon.
 * - `headX`, `headY`: where the centre of the hood's face sits (fractions of the grid).
 */
export function composeIcon(size, { headX = 0.42, headY = 0.56 } = {}) {
  const px = new Uint8Array(size * size * 4);
  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = 255;
  };
  const get = (x, y) => {
    const i = (y * size + x) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };

  const hx = Math.round(size * headX - HOOD[0].length / 2);
  const hy = Math.round(size * headY - 8);
  const pipeCx = hx + 9.5;
  const pipeCy = hy + 7.5;
  const pipeR = size * 0.4;

  // 1. brick wall
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / 4);
    const off = (row & 1) * 4;
    for (let x = 0; x < size; x++) {
      const col = Math.floor((x + off) / 8);
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      put(x, y, hex(mortar ? BG.mortar : BG.brick[Math.floor(rand(row, col) * BG.brick.length)]));
    }
  }

  // 2. the drain pipe mouth (a dark round opening with a grate) framing Wren's head
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - pipeCx;
      const dy = y + 0.5 - pipeCy;
      const d = Math.hypot(dx, dy);
      if (d > pipeR) continue;
      if (d > pipeR - 2) {
        const lit = dx + dy < -pipeR * 0.5;
        const dark = dx + dy > pipeR * 0.6;
        put(x, y, hex(lit ? BG.ringLight : dark ? BG.ringShade : BG.ring));
      } else {
        const bar = Math.round(x - pipeCx + 0.5) % 4 === 0;
        put(x, y, hex(bar ? (dx < 0 ? BG.barLight : BG.bar) : BG.void));
      }
    }
  }

  // 3. rain (behind Wren)
  const drops = Math.round(size * 0.45);
  for (let i = 0; i < drops; i++) {
    const x = Math.floor(rand(i, 11) * size);
    const y = Math.floor(rand(i, 23) * (size - 6));
    for (let k = 0; k < 3; k++) put(x - (k === 2 ? 1 : 0), y + k, hex(BG.rain));
  }

  // 4. drain water along the bottom
  const waterTop = size - Math.max(2, Math.round(size * 0.08));
  for (let y = waterTop; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const glint = y === waterTop && rand(x, 5) < 0.35;
      put(x, y, hex(glint ? BG.waterLight : BG.water));
    }
  }

  // 5. Wren (the coat continues below the art on tall grids)
  for (let y = hy; y < size; y++) {
    const row = HOOD[Math.min(y - hy, HOOD.length - 1)];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch !== '.') put(hx + i, y, hex(PALETTE[ch]));
    }
  }

  // 6. the marble's glow (additive, in pixel-art bands), then the marble
  const mx = hx + HOOD[0].length - 2;
  const my = hy + 1;
  const mcx = mx + MARBLE[0].length / 2;
  const mcy = my + MARBLE.length / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - mcx, y + 0.5 - mcy);
      const a = d <= 5.6 ? 0.75 : d <= 6.8 ? 0.5 : d <= 8 ? 0.3 : d <= 9.2 ? 0.14 : 0;
      if (a === 0) continue;
      const c = get(x, y);
      put(x, y, [
        Math.min(255, Math.round(c[0] + HALO[0] * a)),
        Math.min(255, Math.round(c[1] + HALO[1] * a)),
        Math.min(255, Math.round(c[2] + HALO[2] * a)),
      ]);
    }
  }
  MARBLE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(mx + i, my + j, hex(PALETTE[row[i]]));
  });
  return px;
}

/** Nearest-neighbour upscale of a square RGBA grid, then centre-crop to `crop` px. */
export function scaleIcon(px, size, scale, crop = size * scale) {
  const full = size * scale;
  const off = Math.floor((full - crop) / 2);
  const out = new Uint8Array(crop * crop * 4);
  for (let y = 0; y < crop; y++) {
    const sy = Math.floor((y + off) / scale);
    for (let x = 0; x < crop; x++) {
      const sx = Math.floor((x + off) / scale);
      const s = (sy * size + sx) * 4;
      const d = (y * crop + x) * 4;
      out[d] = px[s];
      out[d + 1] = px[s + 1];
      out[d + 2] = px[s + 2];
      out[d + 3] = px[s + 3];
    }
  }
  return out;
}

/**
 * Every icon the app ships. `grid` = art resolution, `scale` = pixel size, `crop` = final size.
 * The maskable icon keeps Wren and the marble inside the central 80 % safe zone.
 */
export const ICONS = [
  { file: 'icon-32.png', grid: 32, scale: 1 },
  { file: 'icon-192.png', grid: 32, scale: 6 },
  { file: 'icon-512.png', grid: 32, scale: 16 },
  { file: 'apple-touch-icon-180.png', grid: 30, scale: 6 },
  { file: 'icon-maskable-512.png', grid: 40, scale: 13, crop: 512, headY: 0.5 },
];

export function renderIcon(spec) {
  const art = composeIcon(spec.grid, { headY: spec.headY });
  const size = spec.crop ?? spec.grid * spec.scale;
  const pixels = scaleIcon(art, spec.grid, spec.scale, size);
  return { size, png: encodePng(size, size, pixels, { alpha: false }) };
}

export function main(argv = process.argv.slice(2)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 ? resolve(argv[outIdx + 1]) : join(here, '..', 'public', 'icons');
  mkdirSync(outDir, { recursive: true });
  for (const spec of ICONS) {
    const { size, png } = renderIcon(spec);
    writeFileSync(join(outDir, spec.file), png);
    console.log(`${spec.file.padEnd(28)} ${size}x${size}  ${png.length} bytes`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
