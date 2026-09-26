/**
 * Title screen art, generated once: a storm-drain tunnel mouth backdrop and the STORMDRAIN logo
 * (two-tone raincoat yellow with a dark outline and little drips).
 */

import { Rng } from '../engine/rng';
import { GAME_H, GAME_W } from '../engine/screen';
import { ctx2d, makeCanvas, parseHexColor } from './canvas';
import { drawText, measureText, textHeight } from './font';

export const TITLE_GROUND_Y = 150;
const ARCH_CX = 192;
const ARCH_INNER = 100;
const ARCH_OUTER = 118;

function put(d: Uint8ClampedArray, i: number, css: string): void {
  const c = parseHexColor(css);
  d[i] = c[0]!;
  d[i + 1] = c[1]!;
  d[i + 2] = c[2]!;
  d[i + 3] = 255;
}

export function buildTitleBackdrop(): HTMLCanvasElement {
  const c = makeCanvas(GAME_W, GAME_H);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(GAME_W, GAME_H);
  const d = img.data;
  const rng = new Rng('title-backdrop');
  const wallBands = ['#070a12', '#090c16', '#0b0f1a', '#0d121f', '#0f1524', '#111829'];
  // Per-segment brick tint for the arch ring (stable pattern).
  const segTint: number[] = [];
  for (let i = 0; i < 64; i++) segTint.push(rng.int(0, 2));

  for (let y = 0; y < GAME_H; y++) {
    for (let x = 0; x < GAME_W; x++) {
      const i = (y * GAME_W + x) * 4;
      const dx = x - ARCH_CX;
      const dy = y - TITLE_GROUND_Y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (y >= TITLE_GROUND_Y) {
        // Ledge on the sides, water channel running into the tunnel.
        const inChannel = Math.abs(dx) < ARCH_INNER - 4 + (y - TITLE_GROUND_Y) * 1.2;
        if (y === TITLE_GROUND_Y && !inChannel) put(d, i, '#2a3350');
        else if (!inChannel) put(d, i, y < TITLE_GROUND_Y + 3 ? '#1a2133' : '#131929');
        else if (y === TITLE_GROUND_Y) put(d, i, '#1d2a40');
        else {
          const ripple = (x * 7 + y * 13) % 29 === 0 || (x + y * 5) % 41 === 0;
          put(d, i, ripple ? '#1c2c46' : y < TITLE_GROUND_Y + 6 ? '#0a1322' : '#0c1627');
        }
        continue;
      }
      if (r < ARCH_INNER) {
        // Tunnel darkness with faint rings of receding sections.
        const ring = Math.abs(r - 72) < 0.6 || Math.abs(r - 48) < 0.6 || Math.abs(r - 28) < 0.6;
        const depth = r / ARCH_INNER;
        put(d, i, ring ? '#0c111d' : depth > 0.8 ? '#06080f' : depth > 0.5 ? '#05070c' : '#030409');
        continue;
      }
      if (r < ARCH_OUTER) {
        // Brick voussoirs: radial mortar every ~7.5°, one mortar ring in the middle.
        const ang = Math.atan2(-dy, dx); // 0..PI across the arch
        const seg = Math.floor((ang / Math.PI) * 24 + (r > 109 ? 0.5 : 0));
        const segFrac = (ang / Math.PI) * 24 + (r > 109 ? 0.5 : 0) - seg;
        const mortar = Math.abs(r - 109) < 0.7 || segFrac < 0.06 || r < ARCH_INNER + 0.9 || r > ARCH_OUTER - 0.9;
        if (mortar) put(d, i, '#0b0e17');
        else {
          const tint = segTint[(seg + (r > 109 ? 31 : 0)) & 63]!;
          const light = r > ARCH_OUTER - 3 ? 1 : 0; // top edge catches a little light
          put(d, i, ['#1c2336', '#20283d', '#252e46'][Math.min(2, tint + light)]!);
        }
        continue;
      }
      // Background wall: faint brick courses fading into the dark.
      const band = wallBands[Math.min(wallBands.length - 1, Math.floor(y / 25))]!;
      const course = Math.floor(y / 7);
      const off = course % 2 === 0 ? 0 : 9;
      const mortar = y % 7 === 0 || (x + off) % 18 === 0;
      put(d, i, mortar ? '#06080e' : band);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Moss hanging from the arch and dripping stains.
  for (let k = 0; k < 40; k++) {
    const ang = rng.range(0.15, Math.PI - 0.15);
    const x = Math.round(ARCH_CX + Math.cos(ang) * (ARCH_INNER - 1));
    const y = Math.round(TITLE_GROUND_Y - Math.sin(ang) * (ARCH_INNER - 1));
    ctx.fillStyle = rng.chance(0.5) ? '#2d4632' : '#3d5a3c';
    ctx.fillRect(x, y, 1, rng.int(1, 4));
  }
  ctx.fillStyle = 'rgba(110,140,190,0.10)';
  for (let k = 0; k < 26; k++) {
    const x = rng.int(0, GAME_W - 1);
    if (Math.abs(x - ARCH_CX) < ARCH_OUTER) continue;
    ctx.fillRect(x, rng.int(0, 60), 1, rng.int(8, 40));
  }
  return c;
}

/** Bakes the STORMDRAIN logo: 4× text, three-tone fill, 1 px outline, 2 px shadow, drips. */
export function buildLogo(text = 'STORMDRAIN'): HTMLCanvasElement {
  const S = 4;
  const w = measureText(text, S);
  const h = textHeight(1, S);
  // 1) Fill silhouette in three horizontal tones.
  const fill = makeCanvas(w, h);
  const fctx = ctx2d(fill);
  drawText(fctx, text, 0, 0, { color: '#ffd84a', scale: S });
  fctx.globalCompositeOperation = 'source-atop';
  fctx.fillStyle = '#fff3b0';
  fctx.fillRect(0, 0, w, S);
  fctx.fillStyle = '#e8962a';
  fctx.fillRect(0, h - S * 2, w, S * 2);
  fctx.fillStyle = '#c8741c';
  fctx.fillRect(0, h - 2, w, 2);

  // 2) Dark silhouette for outline/shadow.
  const dark = makeCanvas(w, h);
  const dctx = ctx2d(dark);
  dctx.drawImage(fill, 0, 0);
  dctx.globalCompositeOperation = 'source-in';
  dctx.fillStyle = '#0d0b14';
  dctx.fillRect(0, 0, w, h);
  const shade = makeCanvas(w, h);
  const sctx = ctx2d(shade);
  sctx.drawImage(fill, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#243052';
  sctx.fillRect(0, 0, w, h);

  // 3) Compose with room for outline (1), shadow (3) and drips (6).
  const out = makeCanvas(w + 2, h + 10);
  const o = ctx2d(out);
  o.drawImage(shade, 1, 4);
  o.drawImage(dark, 1, 4 - 1);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) o.drawImage(dark, 1 + dx, 1 + dy);
  o.drawImage(fill, 1, 1);

  // 4) Drips from the bottom edge of the letters (raincoat paint running in the rain).
  const px = fctx.getImageData(0, h - 1, w, 1).data;
  const rng = new Rng(text);
  for (let x = 1; x < w - 1; x++) {
    if (px[x * 4 + 3]! < 128 || !rng.chance(0.07)) continue;
    const len = rng.int(2, 5);
    o.fillStyle = '#0d0b14';
    o.fillRect(1 + x - 1, 1 + h, 3, len + 1);
    o.fillStyle = '#e8962a';
    o.fillRect(1 + x, 1 + h - 1, 1, len);
    o.fillStyle = '#ffd84a';
    o.fillRect(1 + x, 1 + h + len - 1, 1, 1);
  }
  return out;
}
