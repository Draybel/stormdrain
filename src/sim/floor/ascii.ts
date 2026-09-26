/**
 * Debug text rendering of a floor layout (tests, debug menu, docs). Not used by the game loop.
 *
 *   S start   . normal   B boss   T treasure   $ shop   M miniboss   C challenge   X cursed
 *   ? secret  ! deep secret   N nook (opened)   n nook reserve cell
 *   - |  regular door (horizontal / vertical)   # H  locked door   ~ :  secret (bombable) wall
 *   a hidden-route grate shows as a lower-case room letter ('b' boss room) or '/' (secret room)
 */

import type { FloorLayout, RoomType } from './types';

const ROOM_CHAR: Readonly<Record<RoomType, string>> = {
  start: 'S',
  normal: '.',
  treasure: 'T',
  shop: '$',
  boss: 'B',
  miniboss: 'M',
  secret: '?',
  deepSecret: '!',
  challenge: 'C',
  cursed: 'X',
  nook: 'N',
};

export function floorToAscii(layout: FloorLayout): string[] {
  const W = layout.width * 2 - 1;
  const H = layout.height * 2 - 1;
  const g: string[][] = [];
  for (let y = 0; y < H; y++) g.push(new Array<string>(W).fill(' '));
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  const mark = (x: number, y: number, ch: string): void => {
    g[y]![x] = ch;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const r of layout.rooms) {
    let ch = ROOM_CHAR[r.type];
    if (r.hiddenRoute) ch = ch === '?' ? '/' : ch.toLowerCase();
    mark(r.gx * 2, r.gy * 2, ch);
    // East and south connectors (each edge drawn once).
    if (r.doors & 2) {
      const secret = (r.secretDoors & 2) !== 0;
      mark(r.gx * 2 + 1, r.gy * 2, secret ? '~' : r.lockedDoors & 2 ? '#' : '-');
    }
    if (r.doors & 4) {
      const secret = (r.secretDoors & 4) !== 0;
      mark(r.gx * 2, r.gy * 2 + 1, secret ? ':' : r.lockedDoors & 4 ? 'H' : '|');
    }
  }
  if (layout.nook.room < 0) mark(layout.nook.gx * 2, layout.nook.gy * 2, 'n');
  const out: string[] = [];
  for (let y = minY; y <= maxY; y++) out.push(g[y]!.slice(minX, maxX + 1).join('').replace(/\s+$/, ''));
  return out;
}
