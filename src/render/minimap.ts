/**
 * Minimap drawing from the pure knowledge model (sim/floor/minimap.ts): per room Unknown (skipped),
 * Mapped (outline), Seen (dim, with its special icon), Visited (filled); the current room blinks.
 * - compact: the HUD map in its slot (top right), centred on the current room, special rooms as dots;
 * - big: the whole floor with 5×5 icons and door connectors (the map overlay).
 * Both are cached into canvases keyed by the model's `version` (+ room count): per frame it is one
 * sub-rect drawImage and a blinking rectangle. The Lost Map curse shows a '?' instead.
 */

import { MAP_DOT_COLOR, MAP_ICONS } from '../content/sprites/mapIcons';
import { layoutBounds } from '../sim/floor/generate';
import { MapVis, roomIcon, roomVis, type MinimapState } from '../sim/floor/minimap';
import { DIR_BITS, type FloorLayout } from '../sim/floor/types';
import { ctx2d, makeCanvas } from './canvas';
import { drawTextCentered, type TextStyle } from './font';
import { getFrame } from './sprites';

const C_VISITED = '#8e98b5';
const C_SEEN = '#3a4460';
const C_OUTLINE = '#56648a';
const C_CURRENT = '#ffffff';
const C_CONNECT = '#56648a';
const QUESTION: TextStyle = { color: '#c9d3f0', shadow: '#07080d', scale: 2 };

/** A drawn map and what it was drawn from (numbers only: checked every frame, no key strings). */
interface Cached {
  canvas: HTMLCanvasElement | null;
  layout: FloorLayout | null;
  version: number;
  rooms: number;
  lostMap: boolean;
}

function newCache(): Cached {
  return { canvas: null, layout: null, version: -1, rooms: -1, lostMap: false };
}

/** Whole-floor map at a given cell pitch (rooms are pitch-1 boxes). */
function renderMap(c: Cached, layout: FloorLayout, map: MinimapState, pw: number, ph: number, big: boolean): HTMLCanvasElement {
  if (c.canvas && c.layout === layout && c.version === map.version && c.rooms === layout.rooms.length && c.lostMap === map.lostMap) {
    return c.canvas;
  }
  const w = layout.width * pw + 1;
  const h = layout.height * ph + 1;
  if (!c.canvas || c.canvas.width !== w || c.canvas.height !== h) c.canvas = makeCanvas(w, h);
  const g = ctx2d(c.canvas);
  g.clearRect(0, 0, w, h);
  const bw = pw - 1;
  const bh = ph - 1;
  if (big) {
    // Door connectors under the rooms (only between rooms that are both drawn).
    g.fillStyle = C_CONNECT;
    for (const r of layout.rooms) {
      if (roomVis(map, r.index) === MapVis.Unknown) continue;
      for (let s = 1; s <= 2; s++) {
        // East (s 1) and south (s 2) neighbours: each pair once.
        const bit = DIR_BITS[s]!;
        if ((r.doors & bit) === 0) continue;
        const nx = r.gx + (s === 1 ? 1 : 0);
        const ny = r.gy + (s === 2 ? 1 : 0);
        const n = layout.cells[ny * layout.width + nx] ?? -1;
        if (n < 0 || roomVis(map, n) === MapVis.Unknown) continue;
        // Secret walls only once a side of them is known to be open (the secret room is shown).
        if ((r.secretDoors & bit) !== 0 && roomVis(map, r.secret ? r.index : n) < MapVis.Seen) continue;
        if (s === 1) g.fillRect(r.gx * pw + bw, r.gy * ph + (bh >> 1) - 1, 2, 3);
        else g.fillRect(r.gx * pw + (bw >> 1) - 1, r.gy * ph + bh, 3, 2);
      }
    }
  }
  for (const r of layout.rooms) {
    const vis = roomVis(map, r.index);
    if (vis === MapVis.Unknown) continue;
    const x = r.gx * pw;
    const y = r.gy * ph;
    if (vis === MapVis.Mapped) {
      g.strokeStyle = C_OUTLINE;
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      continue;
    }
    g.fillStyle = vis === MapVis.Visited ? C_VISITED : C_SEEN;
    g.fillRect(x, y, bw, bh);
    if (vis === MapVis.Seen) {
      g.fillStyle = C_OUTLINE;
      g.fillRect(x, y, bw, 1);
    }
    const type = roomIcon(map, layout, r.index);
    if (!type) continue;
    if (big) {
      const icon = MAP_ICONS[type];
      if (icon) g.drawImage(getFrame(icon, 0), x + ((bw - icon.w) >> 1), y + ((bh - icon.h) >> 1));
    } else {
      g.fillStyle = MAP_DOT_COLOR[type] ?? '#ffffff';
      g.fillRect(x + ((bw - 2) >> 1), y + ((bh - 2) >> 1), 2, 2);
    }
  }
  c.layout = layout;
  c.version = map.version;
  c.rooms = layout.rooms.length;
  c.lostMap = map.lostMap;
  return c.canvas;
}

export class MinimapRenderer {
  private readonly compact: Cached = newCache();
  private readonly big: Cached = newCache();

  /** The HUD map inside (x, y, w, h), centred on the current room. */
  drawCompact(ctx: CanvasRenderingContext2D, layout: FloorLayout, map: MinimapState, x: number, y: number, w: number, h: number, time: number): void {
    if (map.lostMap) {
      drawTextCentered(ctx, '?', x + w / 2, y + (h >> 1) - 5, QUESTION);
      return;
    }
    const PW = 6;
    const PH = 5;
    const src = renderMap(this.compact, layout, map, PW, PH, false);
    const cur = layout.rooms[map.current];
    if (!cur) return;
    const iw = w - 4;
    const ih = h - 4;
    // Source rect centred on the current room, clamped to the map canvas.
    let sx = cur.gx * PW + ((PW - 1) >> 1) - (iw >> 1);
    let sy = cur.gy * PH + ((PH - 1) >> 1) - (ih >> 1);
    const dx = x + 2;
    const dy = y + 2;
    let ox = 0;
    let oy = 0;
    if (sx < 0) {
      ox = -sx;
      sx = 0;
    }
    if (sy < 0) {
      oy = -sy;
      sy = 0;
    }
    const sw = Math.min(iw - ox, src.width - sx);
    const sh = Math.min(ih - oy, src.height - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(src, sx, sy, sw, sh, dx + ox, dy + oy, sw, sh);
    // The current room blinks softly.
    const cx = dx + ox + cur.gx * PW - sx;
    const cy = dy + oy + cur.gy * PH - sy;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 6);
    ctx.fillStyle = C_CURRENT;
    ctx.fillRect(cx, cy, PW - 1, PH - 1);
    ctx.globalAlpha = 1;
  }

  /** The whole floor centred on (cx, cy); returns its drawn size. */
  drawBig(ctx: CanvasRenderingContext2D, layout: FloorLayout, map: MinimapState, cx: number, cy: number, time: number): { w: number; h: number } {
    const PW = 15;
    const PH = 11;
    const src = renderMap(this.big, layout, map, PW, PH, true);
    const b = layoutBounds(layout);
    const sx = b.minX * PW;
    const sy = b.minY * PH;
    const sw = (b.maxX - b.minX + 1) * PW;
    const sh = (b.maxY - b.minY + 1) * PH;
    const x = Math.round(cx - sw / 2);
    const y = Math.round(cy - sh / 2);
    if (map.lostMap) {
      drawTextCentered(ctx, '?', cx, cy - 5, QUESTION);
      return { w: 12, h: 12 };
    }
    ctx.drawImage(src, sx, sy, sw, sh, x, y, sw, sh);
    const cur = layout.rooms[map.current];
    if (cur) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 6);
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + cur.gx * PW - sx - 0.5, y + cur.gy * PH - sy - 0.5, PW, PH);
      ctx.globalAlpha = 1;
    }
    return { w: sw, h: sh };
  }
}
