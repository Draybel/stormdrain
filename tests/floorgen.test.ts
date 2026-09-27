/**
 * Floor generator: layout invariants over 5000 seeds × floors 1..13 × both tracks, determinism,
 * stream independence, distributions, speed — plus room template validation and picking.
 */

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import {
  DEAD_END_TYPES,
  DIR_BITS,
  DIR_DX,
  DIR_DY,
  DIR_OPPOSITE,
  FLOOR_CURSES,
  FLOORGEN_VERSION,
  MAX_FLOOR,
  ROOM_TEMPLATES,
  ROOM_TYPES,
  TEMPLATE_COLS,
  TEMPLATE_ROWS,
  baseRoomCount,
  curseChance,
  finalBossFor,
  floorToAscii,
  generateFloor,
  isFinalFloor,
  layoutBounds,
  neighborRoom,
  openNook,
  pickTemplates,
  regularDoorCount,
  roomAt,
  templateChar,
  templateGrid,
  templateRng,
  validateTemplate,
  validateTemplates,
  type FloorLayout,
  type FloorTrack,
  type RoomTemplate,
  type RoomType,
} from '../src/sim/floor';
import generic from '../src/content/rooms/generic';
import { hashString } from '../src/engine/rng';
import { perfBudget } from './helpers/perf';

const SEEDS = 5000;
const TRACKS: readonly FloorTrack[] = ['main', 'alt'];
const FLOORS = Array.from({ length: MAX_FLOOR }, (_, i) => i + 1);

// ── Invariant checker ─────────────────────────────────────────────────────────────────────────

function cellRoom(L: FloorLayout, x: number, y: number): number {
  return roomAt(L, x, y);
}

/** Returns the first broken rule for a layout, or null. */
function checkLayout(L: FloorLayout, allowAltNext: boolean): string | null {
  const f = L.floorIndex;
  const rooms = L.rooms;
  const n = rooms.length;
  if (L.width !== 11 || L.height !== 11) return 'grid must be 11×11';
  if (L.cells.length !== 121) return 'cells size';

  // Cells ↔ rooms, no overlaps, in bounds.
  let filled = 0;
  for (const c of L.cells) if (c >= 0) filled++;
  if (filled !== n) return `cells hold ${filled} rooms, layout has ${n}`;
  for (let i = 0; i < n; i++) {
    const r = rooms[i]!;
    if (r.index !== i) return `room ${i} has index ${r.index}`;
    if (r.gx < 0 || r.gy < 0 || r.gx >= 11 || r.gy >= 11) return `room ${i} out of bounds`;
    if (L.cells[r.gy * 11 + r.gx] !== i) return `room ${i} cell mismatch (overlap?)`;
  }

  // Types & counts.
  const count: Partial<Record<RoomType, number>> = {};
  for (const r of rooms) count[r.type] = (count[r.type] ?? 0) + 1;
  const final = isFinalFloor(f);
  if (count.start !== 1 || rooms[0]!.type !== 'start' || L.start !== 0) return 'start room must be room 0';
  if (rooms[0]!.gx !== 5 || rooms[0]!.gy !== 5) return 'start room must be in the middle';
  if (count.boss !== 1) return `${count.boss} boss rooms`;
  if (count.treasure !== 1) return `${count.treasure} treasure rooms`;
  if ((count.shop ?? 0) !== (final ? 0 : 1)) return `${count.shop} shops on floor ${f}`;
  if (count.secret !== 1 || count.deepSecret !== 1) return 'needs one secret and one deep secret room';
  if ((count.miniboss ?? 0) > 1 || (count.challenge ?? 0) > 1 || (count.cursed ?? 0) > 1) return 'optional room twice';
  if (f < 2 && count.challenge) return 'challenge room before floor 2';
  if (count.nook) return 'nook present before openNook';
  if (rooms[L.boss]?.type !== 'boss' || rooms[L.secret]?.type !== 'secret' || rooms[L.deepSecret]?.type !== 'deepSecret') {
    return 'boss/secret/deepSecret indices wrong';
  }
  const grown = n - 2;
  if (grown < baseRoomCount(f) || grown > baseRoomCount(f) + 5) return `room count ${grown} on floor ${f}`;

  // Doors: symmetric; regular doors exactly between adjacent non-secret rooms; secret walls around secret rooms.
  for (const r of rooms) {
    if ((r.secretDoors & ~r.doors) !== 0) return `room ${r.index}: secretDoors ⊄ doors`;
    if ((r.hints & ~r.secretDoors) !== 0) return `room ${r.index}: hints ⊄ secretDoors`;
    if ((r.lockedDoors & ~(r.doors & ~r.secretDoors)) !== 0) return `room ${r.index}: lockedDoors not regular doors`;
    if (r.secret !== (r.type === 'secret' || r.type === 'deepSecret')) return `room ${r.index}: secret flag`;
    if (r.secret && r.hints !== 0) return 'hints belong on the visible side';
    for (let d = 0; d < 4; d++) {
      const bit = DIR_BITS[d]!;
      const back = DIR_BITS[DIR_OPPOSITE[d]!]!;
      const nb = cellRoom(L, r.gx + DIR_DX[d]!, r.gy + DIR_DY[d]!);
      const has = (r.doors & bit) !== 0;
      if (nb < 0) {
        if (has) return `room ${r.index}: door into nothing`;
        continue;
      }
      const o = rooms[nb]!;
      const secretPair = r.secret || o.secret;
      if (r.secret && o.secret) return 'secret rooms touch';
      // Every adjacent pair is connected (tree growth; secret rooms open to all neighbours).
      if (!has) return `rooms ${r.index} and ${nb} touch without a door`;
      if (((o.doors & back) !== 0) !== has) return `door ${r.index}->${nb} not symmetric`;
      const sec = (r.secretDoors & bit) !== 0;
      if (sec !== secretPair) return `door ${r.index}->${nb}: secret wall mismatch`;
      if (((o.secretDoors & back) !== 0) !== sec) return `secret wall ${r.index}->${nb} not symmetric`;
      if (((r.lockedDoors & bit) !== 0) !== ((o.lockedDoors & back) !== 0)) return 'locked door not symmetric';
    }
  }

  // Reachability: regular doors reach every non-secret room; bombing (secret walls) reaches the rest.
  const distReg = new Array<number>(n).fill(-1);
  const distAll = new Array<number>(n).fill(-1);
  for (const [dist, useSecret] of [
    [distReg, false],
    [distAll, true],
  ] as const) {
    dist[0] = 0;
    const q = [0];
    while (q.length) {
      const i = q.shift()!;
      const r = rooms[i]!;
      for (let d = 0; d < 4; d++) {
        const bit = DIR_BITS[d]!;
        if ((r.doors & bit) === 0) continue;
        if (!useSecret && (r.secretDoors & bit) !== 0) continue;
        const nb = neighborRoom(L, i, d);
        if (nb < 0) return 'door without neighbour';
        if (dist[nb]! < 0) {
          dist[nb] = dist[i]! + 1;
          q.push(nb);
        }
      }
    }
  }
  for (const r of rooms) {
    if (distAll[r.index]! < 0) return `room ${r.index} (${r.type}) unreachable`;
    if (r.secret) {
      if (distReg[r.index]! >= 0) return `secret room ${r.index} reachable without bombing`;
      if ((r.doors & ~r.secretDoors) !== 0) return 'secret room has a regular door';
      let best = 99;
      for (let d = 0; d < 4; d++) {
        const nb = neighborRoom(L, r.index, d);
        if (nb >= 0) best = Math.min(best, rooms[nb]!.dist + 1);
      }
      if (r.dist !== best) return `secret room dist ${r.dist} != ${best}`;
    } else {
      if (distReg[r.index]! < 0) return `room ${r.index} (${r.type}) needs bombing to reach`;
      if (r.dist !== distReg[r.index]) return `room ${r.index} dist ${r.dist} != ${distReg[r.index]}`;
    }
  }

  // Boss: the farthest room, a dead end, far enough.
  const boss = rooms[L.boss]!;
  let maxDist = 0;
  for (const r of rooms) if (!r.secret) maxDist = Math.max(maxDist, r.dist);
  if (boss.dist !== maxDist) return `boss at ${boss.dist}, farthest room at ${maxDist}`;
  if (L.bossDist !== boss.dist) return 'bossDist field';
  if (boss.dist < 3) return 'boss too close to the start';

  // Dead ends for specials.
  for (const r of rooms) {
    if (DEAD_END_TYPES.includes(r.type) && regularDoorCount(r) !== 1) return `${r.type} room is not a dead end`;
  }

  // Secret room: ≥2 neighbours, never the boss room, never next to the nook cell.
  const s = rooms[L.secret]!;
  let sN = 0;
  for (let d = 0; d < 4; d++) {
    const nb = cellRoom(L, s.gx + DIR_DX[d]!, s.gy + DIR_DY[d]!);
    if (nb < 0) continue;
    sN++;
    if (rooms[nb]!.type === 'boss') return 'secret room touches the boss room';
  }
  if (sN < 2) return `secret room has ${sN} neighbours`;
  // "Prefer 3+": a 2-neighbour secret room only when no valid 3+ cell existed.
  if (sN === 2 && bestSecretCandidate(L) >= 3) return 'secret room ignored a 3-neighbour cell';

  // Deep secret: exactly one neighbour, a normal room.
  const ds = rooms[L.deepSecret]!;
  let dN = 0;
  let dType: RoomType | null = null;
  for (let d = 0; d < 4; d++) {
    const nb = cellRoom(L, ds.gx + DIR_DX[d]!, ds.gy + DIR_DY[d]!);
    if (nb < 0) continue;
    dN++;
    dType = rooms[nb]!.type;
  }
  if (dN !== 1 || dType !== 'normal') return `deep secret touches ${dN} rooms (${dType})`;

  // Nook reserve: free, next to the boss room, touching nothing else.
  const nk = L.nook;
  if (nk.room !== -1) return 'nook opened already';
  if (nk.gx < 0 || nk.gy < 0 || nk.gx >= 11 || nk.gy >= 11) return 'nook out of bounds';
  if (cellRoom(L, nk.gx, nk.gy) !== -1) return 'nook cell occupied';
  if (boss.gx + DIR_DX[nk.side]! !== nk.gx || boss.gy + DIR_DY[nk.side]! !== nk.gy) return 'nook not beside the boss';
  for (let d = 0; d < 4; d++) {
    const nb = cellRoom(L, nk.gx + DIR_DX[d]!, nk.gy + DIR_DY[d]!);
    if (nb >= 0 && nb !== L.boss) return `nook cell touches ${rooms[nb]!.type}`;
  }

  // Locks.
  for (const r of rooms) {
    const shouldLock = r.type === 'treasure' && f >= 3;
    if (r.locked !== shouldLock) return `${r.type} locked=${r.locked} on floor ${f}`;
    if (shouldLock && r.lockedDoors !== (r.doors & ~r.secretDoors)) return 'treasure door not locked';
    if (r.lockedDoors !== 0 && !shouldLock) {
      // The treasure room's parent carries the matching lock bit.
      for (let d = 0; d < 4; d++) {
        if ((r.lockedDoors & DIR_BITS[d]!) === 0) continue;
        if (rooms[neighborRoom(L, r.index, d)]!.type !== 'treasure') return 'locked door not leading to treasure';
      }
    }
  }

  // Finals.
  const fb = finalBossFor(f, L.track);
  if (L.finalBoss !== fb || boss.finalBoss !== fb) return 'final boss flag';
  for (const r of rooms) if (r.type !== 'boss' && r.finalBoss !== null) return 'final boss flag on a non-boss room';

  // Hidden route.
  const flagged = rooms.filter((r) => r.hiddenRoute).map((r) => r.index);
  if (L.hiddenRoute === -1) {
    if (flagged.length) return 'hiddenRoute flag without layout.hiddenRoute';
  } else {
    if (!allowAltNext || L.track !== 'main' || f >= 12) return 'hidden route where not allowed';
    if (flagged.length !== 1 || flagged[0] !== L.hiddenRoute) return 'hidden route flag mismatch';
    const t = rooms[L.hiddenRoute]!.type;
    if (t !== 'secret' && t !== 'boss') return `hidden route in a ${t} room`;
  }

  if (L.curse !== null && !FLOOR_CURSES.includes(L.curse)) return 'bad curse';
  if (L.chapter !== (f === 13 ? 7 : Math.ceil(f / 2))) return 'chapter';
  return null;
}

/** Highest neighbour count of any valid secret-room cell (empty, not by boss/nook). */
function bestSecretCandidate(L: FloorLayout): number {
  let best = 0;
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 11; x++) {
      const here = cellRoom(L, x, y);
      if (here >= 0 && here !== L.secret) continue;
      if (x === L.nook.gx && y === L.nook.gy) continue;
      if (Math.abs(x - L.nook.gx) + Math.abs(y - L.nook.gy) === 1) continue;
      let k = 0;
      let bad = false;
      for (let d = 0; d < 4; d++) {
        const nb = cellRoom(L, x + DIR_DX[d]!, y + DIR_DY[d]!);
        if (nb < 0 || nb === L.secret || nb === L.deepSecret) continue;
        k++;
        if (L.rooms[nb]!.type === 'boss') bad = true;
      }
      if (!bad) best = Math.max(best, k);
    }
  }
  return best;
}

// ── Layout properties over many seeds ─────────────────────────────────────────────────────────

describe(`generateFloor over ${SEEDS} seeds`, () => {
  for (const track of TRACKS) {
    it(`every floor on the ${track} track obeys the layout rules`, () => {
      const failures: string[] = [];
      for (const f of FLOORS) {
        for (let seed = 0; seed < SEEDS && failures.length < 5; seed++) {
          const s = seed * 2654435761 + f; // spread seeds over the u32 range
          const L = generateFloor(s >>> 0, f, track, { allowAltNext: true });
          const err = checkLayout(L, true);
          if (err) failures.push(`seed ${s >>> 0} floor ${f} ${track}: ${err}\n${floorToAscii(L).join('\n')}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('keeps each rule on the most common option sets too', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const f of FLOORS) {
        const L = generateFloor(seed, f, 'main', { curses: false });
        expect(checkLayout(L, false)).toBeNull();
        expect(L.curse).toBeNull();
        expect(L.hiddenRoute).toBe(-1);
      }
    }
  });

  it('rolls optional rooms, hints, routes and curses at about the designed rates', () => {
    const N = 4000;
    let mini = 0;
    let challenge = 0;
    let cursed = 0;
    let secretWalls = 0;
    let hinted = 0;
    let routes = 0;
    let routeInSecret = 0;
    let secret3 = 0;
    const curses = new Map<number, number>();
    const size = new Map<number, number>();
    for (const f of FLOORS) {
      for (let seed = 0; seed < N; seed++) {
        const L = generateFloor(seed, f, 'main', { allowAltNext: true });
        const types = L.rooms.map((r) => r.type);
        if (f === 5) {
          if (types.includes('miniboss')) mini++;
          if (types.includes('challenge')) challenge++;
          if (types.includes('cursed')) cursed++;
          const s = L.rooms[L.secret]!;
          let k = 0;
          for (let d = 0; d < 4; d++) {
            if (s.doors & DIR_BITS[d]!) {
              k++;
              secretWalls++;
              const nb = L.rooms[neighborRoom(L, L.secret, d)]!;
              if (nb.hints & DIR_BITS[DIR_OPPOSITE[d]!]!) hinted++;
            }
          }
          if (k >= 3) secret3++;
          if (L.hiddenRoute >= 0) {
            routes++;
            if (L.rooms[L.hiddenRoute]!.type === 'secret') routeInSecret++;
          }
        }
        if (L.curse) curses.set(f, (curses.get(f) ?? 0) + 1);
        size.set(f, (size.get(f) ?? 0) + L.rooms.length - 2);
      }
    }
    expect(mini / N).toBeGreaterThan(0.3);
    expect(mini / N).toBeLessThan(0.4);
    expect(challenge / N).toBeGreaterThan(0.25);
    expect(challenge / N).toBeLessThan(0.35);
    expect(cursed / N).toBeGreaterThan(0.2);
    expect(cursed / N).toBeLessThan(0.3);
    expect(hinted / secretWalls).toBeGreaterThan(0.35);
    expect(hinted / secretWalls).toBeLessThan(0.45);
    expect(routes / N).toBeGreaterThan(0.35);
    expect(routes / N).toBeLessThan(0.45);
    expect(routeInSecret / routes).toBeGreaterThan(0.45);
    expect(routeInSecret / routes).toBeLessThan(0.65);
    expect(secret3 / N).toBeGreaterThan(0.5); // 3+ neighbours preferred
    // Curses: rare on floor 1, common deep down, monotonic-ish in between.
    expect((curses.get(1) ?? 0) / N).toBeLessThan(0.08);
    expect((curses.get(13) ?? 0) / N).toBeGreaterThan(0.38);
    expect(curses.get(12)!).toBeGreaterThan(curses.get(4)!);
    expect(curseChance(1)).toBeLessThan(curseChance(7));
    // Room counts: about 8 on floor 1, about 18 deep.
    const avg = (f: number) => size.get(f)! / N;
    expect(avg(1)).toBeGreaterThanOrEqual(8);
    expect(avg(1)).toBeLessThan(10);
    expect(avg(13)).toBeGreaterThanOrEqual(17.5);
    expect(avg(13)).toBeLessThan(20);
    for (let f = 2; f <= 13; f++) expect(avg(f)).toBeGreaterThanOrEqual(avg(f - 1) - 0.3);
  });

  it('produces varied maps', () => {
    const shapes = new Set<string>();
    for (let seed = 0; seed < 200; seed++) shapes.add(floorToAscii(generateFloor(seed, 3, 'main')).join('\n'));
    expect(shapes.size).toBeGreaterThan(195);
    let sameAcrossTracks = 0;
    for (let seed = 0; seed < 200; seed++) {
      const a = floorToAscii(generateFloor(seed, 3, 'main')).join('\n');
      const b = floorToAscii(generateFloor(seed, 3, 'alt')).join('\n');
      if (a === b) sameAcrossTracks++;
    }
    expect(sameAcrossTracks).toBeLessThan(3);
  });
});

// ── Determinism & streams ─────────────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same (seed, floor, track, opts) gives an identical layout, whatever ran before', () => {
    for (let seed = 0; seed < 400; seed++) {
      for (const f of FLOORS) {
        for (const track of TRACKS) {
          const a = JSON.stringify(generateFloor(seed * 7919, f, track, { allowAltNext: true }));
          generateFloor(seed + 1, (f % 13) + 1, track); // disturb the shared scratch buffers
          const b = JSON.stringify(generateFloor(seed * 7919, f, track, { allowAltNext: true }));
          expect(b).toBe(a);
        }
      }
    }
  });

  it('options only touch their own stream', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const f of [1, 4, 9, 12, 13]) {
        const base = generateFloor(seed, f, 'main');
        const noCurse = generateFloor(seed, f, 'main', { curses: false });
        const forced = generateFloor(seed, f, 'main', { forceCurse: 'maze' });
        const alt = generateFloor(seed, f, 'main', { allowAltNext: true, hiddenRouteChance: 1 });
        const strip = (L: FloorLayout) =>
          JSON.stringify({ ...L, curse: null, hiddenRoute: -1, rooms: L.rooms.map((r) => ({ ...r, hiddenRoute: false })) });
        expect(strip(noCurse)).toBe(strip(base));
        expect(strip(forced)).toBe(strip(base));
        expect(strip(alt)).toBe(strip(base));
        expect(noCurse.curse).toBeNull();
        expect(forced.curse).toBe('maze');
        expect(alt.curse).toBe(base.curse);
        if (f < 12) expect(alt.hiddenRoute).toBeGreaterThanOrEqual(0);
        else expect(alt.hiddenRoute).toBe(-1);
      }
    }
  });

  it('respects the curse pool and the alt-track route rules', () => {
    for (let seed = 0; seed < 500; seed++) {
      const L = generateFloor(seed, 13, 'main', { cursePool: ['darkness'] });
      expect(L.curse === null || L.curse === 'darkness').toBe(true);
      const A = generateFloor(seed, 5, 'alt', { allowAltNext: true, hiddenRouteChance: 1 });
      expect(A.hiddenRoute).toBe(-1); // already on the alt track
    }
  });

  it('matches the pinned fingerprint (bump FLOORGEN_VERSION if layouts change on purpose)', () => {
    let h = 0;
    for (let seed = 1; seed <= 25; seed++) {
      for (const f of FLOORS) {
        for (const track of TRACKS) {
          const L = generateFloor(seed, f, track, { allowAltNext: true });
          h = hashString(`${h}|${floorToAscii(L).join('/')}|${L.curse}|${L.hiddenRoute}|${L.rooms.map((r) => r.hints).join(',')}`);
        }
      }
    }
    expect({ version: FLOORGEN_VERSION, fingerprint: h }).toEqual({ version: 1, fingerprint: FINGERPRINT });
  });

  it('rejects bad arguments', () => {
    expect(() => generateFloor(1, 0, 'main')).toThrow(RangeError);
    expect(() => generateFloor(1, 14, 'main')).toThrow(RangeError);
    expect(() => generateFloor(1, 2.5, 'main')).toThrow(RangeError);
    expect(() => generateFloor(1, 3, 'sideways' as FloorTrack)).toThrow(RangeError);
  });

  it('generates a floor in well under 2 ms on average', () => {
    const t0 = performance.now();
    let n = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const f of FLOORS) {
        generateFloor(seed + 99991, f, seed & 1 ? 'alt' : 'main', { allowAltNext: true });
        n++;
      }
    }
    const avg = (performance.now() - t0) / n;
    expect(avg).toBeLessThan(perfBudget(2));
  });
});

/** Pinned hash of 650 layouts (seeds 1..25 × 13 floors × 2 tracks) for FLOORGEN_VERSION 1. */
const FINGERPRINT = 418574008;

// ── Queries & the Broker's Nook ───────────────────────────────────────────────────────────────

describe('layout queries', () => {
  it('roomAt / neighborRoom / layoutBounds agree with the grid', () => {
    const L = generateFloor(42, 6, 'main');
    expect(roomAt(L, -1, 0)).toBe(-1);
    expect(roomAt(L, 11, 3)).toBe(-1);
    for (const r of L.rooms) {
      expect(roomAt(L, r.gx, r.gy)).toBe(r.index);
      for (let d = 0; d < 4; d++) {
        const nb = neighborRoom(L, r.index, d);
        if (r.doors & DIR_BITS[d]!) expect(nb).toBe(roomAt(L, r.gx + DIR_DX[d]!, r.gy + DIR_DY[d]!));
        else expect(nb).toBe(-1);
      }
    }
    const b = layoutBounds(L);
    for (const r of L.rooms) {
      expect(r.gx).toBeGreaterThanOrEqual(b.minX);
      expect(r.gx).toBeLessThanOrEqual(b.maxX);
      expect(r.gy).toBeGreaterThanOrEqual(b.minY);
      expect(r.gy).toBeLessThanOrEqual(b.maxY);
    }
  });

  it('openNook adds a dead-end nook behind the boss room, once', () => {
    for (let seed = 0; seed < 200; seed++) {
      const L = generateFloor(seed, (seed % 13) + 1, 'main');
      pickTemplates(L, ROOM_TEMPLATES, 'gutterways', templateRng(seed, L.floorIndex, 'main'));
      const before = L.rooms.length;
      const idx = openNook(L);
      expect(openNook(L)).toBe(idx);
      expect(L.rooms.length).toBe(before + 1);
      const nook = L.rooms[idx]!;
      expect(nook.type).toBe('nook');
      expect(nook.templateId).toBe(L.nook.templateId);
      expect(nook.templateId).not.toBeNull();
      expect(regularDoorCount(nook)).toBe(1);
      expect(neighborRoom(L, idx, DIR_OPPOSITE[L.nook.side]!)).toBe(L.boss);
      expect(neighborRoom(L, L.boss, L.nook.side)).toBe(idx);
      expect(nook.dist).toBe(L.bossDist + 1);
      for (let d = 0; d < 4; d++) {
        const nb = roomAt(L, nook.gx + DIR_DX[d]!, nook.gy + DIR_DY[d]!);
        if (nb >= 0) expect(nb).toBe(L.boss);
      }
    }
  });
});

// ── Templates ─────────────────────────────────────────────────────────────────────────────────

function tpl(grid: string[], type: RoomType = 'normal', extra: Partial<RoomTemplate> = {}): RoomTemplate {
  return { id: 'test.t', chapters: ['*'], type, difficulty: 1, grid, ...extra };
}

const OK_GRID = [
  '.............',
  '..#.......#..',
  '....e...e....',
  '.............',
  '.............',
  '..#.......#..',
  '.............',
];

describe('room templates', () => {
  it('all shipped templates validate and ids are unique', () => {
    expect(ROOM_TEMPLATES.length).toBeGreaterThanOrEqual(16);
    expect(validateTemplates(ROOM_TEMPLATES)).toEqual([]);
  });

  it('the generic set covers every room type for every chapter, and normal rooms at every difficulty', () => {
    for (const type of ROOM_TYPES) {
      expect(generic.some((t) => t.type === type && t.chapters.includes('*')), type).toBe(true);
    }
    for (const d of [1, 2, 3]) {
      expect(generic.filter((t) => t.type === 'normal' && t.difficulty === d).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('templates stay valid when mirrored', () => {
    for (const t of ROOM_TEMPLATES) {
      for (let flip = 0; flip < 4; flip++) {
        const g = templateGrid(t, flip);
        expect(validateTemplate({ ...t, grid: g })).toEqual([]);
        for (let r = 0; r < TEMPLATE_ROWS; r++) {
          for (let c = 0; c < TEMPLATE_COLS; c++) expect(templateChar(t, flip, c, r)).toBe(g[r]![c]);
        }
      }
    }
    const t = tpl(['#............', ...OK_GRID.slice(1)]);
    expect(templateGrid(t, 1)[0]).toBe('............#');
    expect(templateGrid(t, 2)[6]).toBe('#............');
    expect(templateGrid(t, 3)[6]).toBe('............#');
  });

  it('accepts a good template', () => {
    expect(validateTemplate(tpl(OK_GRID))).toEqual([]);
  });

  it.each([
    ['too few rows', tpl(OK_GRID.slice(1)), /7 rows/],
    ['short row', tpl([...OK_GRID.slice(0, 6), '......']), /row 6 needs 13/],
    ['illegal char', tpl([...OK_GRID.slice(0, 6), '......@......']), /illegal character "@"/],
    ['blocked north door', tpl(['......#......', ...OK_GRID.slice(1)]), /door N/],
    ['hazard at the west door', tpl([...OK_GRID.slice(0, 3), '^............', ...OK_GRID.slice(4)]), /door W/],
    ['enemy beside a door', tpl([...OK_GRID.slice(0, 3), '...........e.', ...OK_GRID.slice(4)]), /enemy spawn next to door E/],
    [
      'walled-off pocket',
      tpl(['.............', '.###.........', '.#p#.........', '.###e........', ...OK_GRID.slice(4)]),
      /unreachable tile "p"/,
    ],
    [
      'pit-locked pedestal',
      tpl(['.............', '.OOO.........', '.OiO.........', '.OOO.........', ...OK_GRID.slice(4)], 'treasure'),
      /unreachable tile "i"/,
    ],
    [
      'doors only linked through spikes',
      tpl(['.....^.^.....', '.....^.^.....', '^^^^^^^^^^^^^', '.....e.......', '^^^^^^^^^^^^^', '.............', '.............']),
      /hazard-free path/,
    ],
    ['shop slot in a normal room', tpl([...OK_GRID.slice(0, 3), '.....S.......', ...OK_GRID.slice(4)]), /marker "S"/],
    ['normal room without enemies', tpl(OK_GRID.map((r) => r.replace(/e/g, '.'))), /enemy spawn/],
    ['two boss spawns', tpl(['.............', '..B.......B..', ...OK_GRID.slice(2).map((r) => r.replace(/e/g, '.'))], 'boss'), /exactly one boss/],
    ['enemies in a treasure room', tpl([...OK_GRID.slice(0, 3), '......i......', ...OK_GRID.slice(4)], 'treasure'), /marker "e"/],
    ['bad difficulty', tpl(OK_GRID, 'normal', { difficulty: 4 as 1 }), /difficulty/],
    ['wildcard mixed with chapters', tpl(OK_GRID, 'normal', { chapters: ['*', 'gutterways'] }), /'\*'/],
    ['unknown type', tpl(OK_GRID, 'lounge' as RoomType), /unknown type/],
    ['blocked boss centre', tpl(['.............', '...B.........', '.............', '......#......', ...OK_GRID.slice(4).map((r) => r.replace(/e/g, '.'))], 'boss'), /centre/],
  ])('rejects: %s', (_name, t, re) => {
    const errs = validateTemplate(t);
    expect(errs.join('\n')).toMatch(re);
  });

  it('reports duplicate ids', () => {
    const t = tpl(OK_GRID);
    expect(validateTemplates([t, { ...t }]).join('\n')).toMatch(/duplicate/);
  });
});

describe('pickTemplates', () => {
  const extra: RoomTemplate[] = [
    { ...generic.find((t) => t.id === 'gen.normal.stones')!, id: 'test.gutter.only', chapters: ['gutterways'] },
    { ...generic.find((t) => t.id === 'gen.normal.stones')!, id: 'test.other.only', chapters: ['rootcellar'] },
  ];
  const lib = [...ROOM_TEMPLATES, ...extra];
  const byId = new Map(lib.map((t) => [t.id, t]));

  it('gives every room a template of its type and chapter, deterministically', () => {
    for (let seed = 0; seed < 300; seed++) {
      const f = (seed % 13) + 1;
      const a = generateFloor(seed, f, 'main');
      const b = generateFloor(seed, f, 'main');
      pickTemplates(a, lib, 'gutterways', templateRng(seed, f, 'main'));
      pickTemplates(b, [...lib].reverse(), 'gutterways', templateRng(seed, f, 'main'));
      expect(b.rooms.map((r) => [r.templateId, r.flip])).toEqual(a.rooms.map((r) => [r.templateId, r.flip]));
      expect(b.nook.templateId).toBe(a.nook.templateId);
      for (const r of a.rooms) {
        const t = byId.get(r.templateId!)!;
        expect(t, `${r.type} has a template`).toBeDefined();
        expect(t.type).toBe(r.type);
        expect(t.id).not.toBe('test.other.only');
        expect(r.flip).toBeGreaterThanOrEqual(0);
        expect(r.flip).toBeLessThanOrEqual(3);
      }
      expect(byId.get(a.nook.templateId!)!.type).toBe('nook');
    }
  });

  it('prefers chapter-specific layouts and harder layouts deeper down', () => {
    let chapterPicks = 0;
    const diff = (f: number) => {
      let sum = 0;
      let n = 0;
      for (let seed = 0; seed < 300; seed++) {
        const L = generateFloor(seed, f, 'main');
        pickTemplates(L, lib, 'gutterways', templateRng(seed, f, 'main'));
        for (const r of L.rooms) {
          if (r.type !== 'normal') continue;
          if (r.templateId === 'test.gutter.only') chapterPicks++;
          sum += byId.get(r.templateId!)!.difficulty;
          n++;
        }
      }
      return sum / n;
    };
    const d1 = diff(1);
    const d7 = diff(7);
    const d13 = diff(13);
    expect(d1).toBeLessThan(1.7);
    expect(d7).toBeGreaterThan(d1);
    expect(d13).toBeGreaterThan(d7);
    expect(d13).toBeGreaterThan(2.3);
    expect(chapterPicks).toBeGreaterThan(100);
  });

  it('leaves templateId null for a type with no template', () => {
    const L = generateFloor(3, 2, 'main');
    pickTemplates(L, ROOM_TEMPLATES.filter((t) => t.type !== 'shop'), 'gutterways', new Rng(1));
    for (const r of L.rooms) {
      if (r.type === 'shop') expect(r.templateId).toBeNull();
      else expect(r.templateId).not.toBeNull();
    }
  });
});
