/**
 * Shared bits for boss pack B's sprites (bossesBWorks / Foundry / Hollow / Grotto / Mini): the frame
 * layout every boss sprite of the pack uses, and small painting helpers on top of ./paint.ts.
 *
 * Every boss gets one SpriteDef PER PHASE LOOK (same size and anchor, different art: colour shift,
 * cracks, extra parts). The boss def carries the first; its hook (content/hooks/bosses-b.ts) swaps
 * `enemy.sprite` to the phase's look when the phase begins. Frames of each look, in this order:
 *   0-1 idle, 2-3 move, 4 windup (telegraph), 5 roar (firing / shouting), 6 slam / air, 7 hurt.
 */

import type { SpriteAnim, SpriteDef } from '../../sim/types';
import { Pix } from './paint';

/** The standard animation table of a pack-B boss sprite (frames in the order above). */
export function bossAnims(idleFps = 3, moveFps = 6, chargeFps = 12, air = 6): Readonly<Record<string, SpriteAnim>> {
  return {
    idle: { frames: [0, 1], fps: idleFps, loop: true },
    move: { frames: [2, 3], fps: moveFps, loop: true },
    charge: { frames: [2, 3], fps: chargeFps, loop: true },
    windup: { frames: [4], fps: 1, loop: true },
    roar: { frames: [5], fps: 1, loop: true },
    slam: { frames: [6], fps: 1, loop: true },
    air: { frames: [air], fps: 1, loop: true },
    hurt: { frames: [7], fps: 1, loop: true },
  };
}

export function bossSprite(
  id: string,
  w: number,
  h: number,
  anchorY: number,
  palette: Readonly<Record<string, string>>,
  frames: readonly (readonly string[])[],
  anims: Readonly<Record<string, SpriteAnim>> = bossAnims(),
): SpriteDef {
  return { id, w, h, anchorY, palette, frames, anims };
}

/**
 * A toothed wheel: pixels within `rim` of (cx, cy), plus `teeth` teeth reaching `tip` (rotated by
 * `rot`); teeth listed in `broken` are snapped off (stubs). Paints `c` (only on empty pixels when
 * `under` is set, so it can go behind what is already drawn).
 */
export function gear(
  p: Pix,
  cx: number,
  cy: number,
  rim: number,
  tip: number,
  teeth: number,
  rot: number,
  c: string,
  broken: readonly number[] = [],
  under = false,
): void {
  const step = (Math.PI * 2) / teeth;
  for (let y = Math.floor(cy - tip - 1); y <= Math.ceil(cy + tip + 1); y++) {
    for (let x = Math.floor(cx - tip - 1); x <= Math.ceil(cx + tip + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > tip) continue;
      let inside = r <= rim;
      if (!inside) {
        const a = Math.atan2(dy, dx) - rot;
        const k = (((Math.round(a / step) % teeth) + teeth) % teeth) | 0;
        const tooth = Math.cos(a * teeth) > 0.05;
        inside = tooth && (broken.includes(k) ? r <= rim + 1.2 : true);
      }
      if (!inside) continue;
      if (under && p.on(x, y)) continue;
      p.set(x, y, c);
    }
  }
}

/** A jagged crack from (x0, y0) to (x1, y1): dark pixels with a glowing seam beside them. */
export function crack(p: Pix, x0: number, y0: number, x1: number, y1: number, dark: string, glow: string, seed = 0): void {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
  let px = x0;
  let py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : ((i * 7 + seed * 3) % 5) - 2;
    const nx = x0 + (x1 - x0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? j * 0.6 : 0);
    const ny = y0 + (y1 - y0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? 0 : j * 0.6);
    p.line(px, py, nx, ny, dark);
    if (p.get(px + 1, py) !== '.' && p.get(px + 1, py) !== dark) p.set(px + 1, py, glow);
    px = nx;
    py = ny;
  }
}

/** Only where something is already painted: repaints the pixels of `from` inside the ellipse. */
export function recolor(p: Pix, cx: number, cy: number, rx: number, ry: number, from: string, to: string): void {
  p.map((x, y, cur) => {
    if (cur !== from) return null;
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1 ? to : null;
  });
}

/** A filled triangle (pixel centres inside). */
export function tri(p: Pix, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: string): void {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(d) < 1e-6) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) p.set(x, y, c);
    }
  }
}

/**
 * A crystal shard growing from (x, y) toward `angle` (rad): a thin diamond `len` px long and `wid` px
 * wide, lit side `lit`, dark side `dark`, a white glint `glint` near the tip.
 */
export function shard(p: Pix, x: number, y: number, len: number, angle: number, wid: number, lit: string, dark: string, glint: string): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tx = x + c * len;
  const ty = y + s * len;
  const mx = x + c * len * 0.35;
  const my = y + s * len * 0.35;
  const nx = -s * wid * 0.5;
  const ny = c * wid * 0.5;
  tri(p, x, y, mx + nx, my + ny, tx, ty, lit);
  tri(p, x, y, mx - nx, my - ny, tx, ty, dark);
  p.set(x + c * len * 0.7 + nx * 0.3, y + s * len * 0.7 + ny * 0.3, glint);
}

/** A small soft puff (steam, smoke, spores): an ellipse of `c` with a `hi` highlight. */
export function puff(p: Pix, x: number, y: number, r: number, c: string, hi: string): void {
  p.ellipse(x, y, r, r * 0.8, c);
  p.set(x - Math.round(r * 0.4), y - Math.round(r * 0.3), hi);
}
