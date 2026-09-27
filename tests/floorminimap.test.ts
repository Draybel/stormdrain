/** Minimap knowledge model: reveal rules, secret rooms, Lost Map curse, map items, save/load. */

import { describe, expect, it } from 'vitest';
import {
  DIR_BITS,
  MapVis,
  createMinimap,
  discoverRoom,
  enterRoom,
  generateFloor,
  hasIcon,
  isRoomShown,
  loadMinimap,
  neighborRoom,
  openNook,
  revealMap,
  roomIcon,
  roomVis,
  setLostMap,
  type FloorLayout,
  type MinimapState,
} from '../src/sim/floor';

function regularNeighbours(L: FloorLayout, i: number): number[] {
  const out: number[] = [];
  const r = L.rooms[i]!;
  for (let d = 0; d < 4; d++) {
    if ((r.doors & DIR_BITS[d]!) === 0 || (r.secretDoors & DIR_BITS[d]!) !== 0) continue;
    out.push(neighborRoom(L, i, d));
  }
  return out;
}

/** A room next to the secret room (so we can stand beside the hidden wall). */
function secretNeighbour(L: FloorLayout): number {
  for (let d = 0; d < 4; d++) {
    const nb = neighborRoom(L, L.secret, d);
    if (nb >= 0) return nb;
  }
  throw new Error('secret room without neighbours');
}

/** Walks the regular-door tree from start to `target`, entering every room on the way. */
function walkTo(state: MinimapState, L: FloorLayout, target: number): void {
  const prev = new Array<number>(L.rooms.length).fill(-2);
  prev[L.start] = -1;
  const q = [L.start];
  while (q.length) {
    const i = q.shift()!;
    for (const nb of regularNeighbours(L, i)) {
      if (prev[nb] !== -2) continue;
      prev[nb] = i;
      q.push(nb);
    }
  }
  const path: number[] = [];
  for (let i = target; i !== -1; i = prev[i]!) path.unshift(i);
  for (const i of path) enterRoom(state, L, i);
}

describe('minimap model', () => {
  it('starts with the start room visited and its door neighbours seen', () => {
    for (let seed = 0; seed < 200; seed++) {
      const L = generateFloor(seed, (seed % 13) + 1, 'main', { curses: false });
      const m = createMinimap(L);
      expect(m.current).toBe(L.start);
      expect(roomVis(m, L.start)).toBe(MapVis.Visited);
      const around = new Set(regularNeighbours(L, L.start));
      for (const r of L.rooms) {
        if (r.index === L.start) continue;
        expect(roomVis(m, r.index)).toBe(around.has(r.index) ? MapVis.Seen : MapVis.Unknown);
      }
    }
  });

  it('never reveals a secret room through its hidden wall, until discovered or entered', () => {
    for (let seed = 0; seed < 200; seed++) {
      const L = generateFloor(seed, (seed % 13) + 1, 'main', { curses: false });
      const m = createMinimap(L);
      const nb = secretNeighbour(L);
      walkTo(m, L, nb);
      expect(m.current).toBe(nb);
      expect(roomVis(m, L.secret)).toBe(MapVis.Unknown);
      expect(roomIcon(m, L, L.secret)).toBeNull();
      discoverRoom(m, L, L.secret); // wall bombed open
      expect(roomVis(m, L.secret)).toBe(MapVis.Seen);
      expect(roomIcon(m, L, L.secret)).toBe('secret');
      enterRoom(m, L, L.secret);
      expect(roomVis(m, L.secret)).toBe(MapVis.Visited);
      // From inside, every neighbour behind the (now known) walls is revealed.
      for (let d = 0; d < 4; d++) {
        const o = neighborRoom(L, L.secret, d);
        if (o >= 0) expect(roomVis(m, o)).toBeGreaterThanOrEqual(MapVis.Seen);
      }
      // The deep secret room stays hidden.
      expect(roomVis(m, L.deepSecret)).toBe(MapVis.Unknown);
    }
  });

  it('shows special room icons once seen, never for normal rooms', () => {
    const L = generateFloor(7, 4, 'main', { curses: false });
    const m = createMinimap(L);
    for (const r of L.rooms) {
      const icon = roomIcon(m, L, r.index);
      if (!hasIcon(r.type)) expect(icon).toBeNull();
      else expect(icon).toBe(roomVis(m, r.index) >= MapVis.Seen ? r.type : null);
    }
    walkTo(m, L, L.boss);
    expect(roomIcon(m, L, L.boss)).toBe('boss');
    expect(roomIcon(m, L, L.start)).toBeNull();
  });

  it('visiting every reachable room reveals the whole map except the secrets', () => {
    for (let seed = 0; seed < 100; seed++) {
      const L = generateFloor(seed, 8, 'alt', { curses: false });
      const m = createMinimap(L);
      for (const r of L.rooms) if (!r.secret) walkTo(m, L, r.index);
      for (const r of L.rooms) {
        expect(roomVis(m, r.index)).toBe(r.secret ? MapVis.Unknown : MapVis.Visited);
      }
    }
  });

  it('the Soggy Map curse shows only the rooms already visited, and lifting it restores the map', () => {
    const L = generateFloor(11, 6, 'main', { forceCurse: 'lostMap' });
    const m = createMinimap(L);
    expect(m.lostMap).toBe(true);
    // Only the start room at first: its neighbours were seen through the doors, but stay off the map.
    for (const r of L.rooms) expect(isRoomShown(m, r.index)).toBe(r.index === L.start);
    walkTo(m, L, L.boss);
    const visited = new Set<number>();
    for (const r of L.rooms) if (m.vis[r.index] === MapVis.Visited) visited.add(r.index);
    expect(visited.has(L.start) && visited.has(L.boss)).toBe(true);
    for (const r of L.rooms) {
      expect(isRoomShown(m, r.index)).toBe(visited.has(r.index));
      expect(roomVis(m, r.index)).toBe(visited.has(r.index) ? MapVis.Visited : MapVis.Unknown);
    }
    // The boss room was visited: its icon shows. An unvisited special room shows no icon, even once revealed.
    expect(roomIcon(m, L, L.boss)).toBe('boss');
    const treasure = L.rooms.find((r) => r.type === 'treasure')!.index;
    expect(visited.has(treasure)).toBe(false);
    revealMap(m, L, 'full');
    expect(roomIcon(m, L, treasure)).toBeNull();
    expect(isRoomShown(m, treasure)).toBe(false);
    const v = m.version;
    setLostMap(m, false);
    expect(m.version).toBeGreaterThan(v);
    expect(isRoomShown(m, L.start)).toBe(true);
    expect(roomVis(m, L.start)).toBe(MapVis.Visited);
    expect(roomIcon(m, L, L.boss)).toBe('boss');
    expect(createMinimap(generateFloor(11, 6, 'main', { forceCurse: 'darkness' })).lostMap).toBe(false);
  });

  it('map items reveal the layout, the icons and the secrets', () => {
    const L = generateFloor(5, 9, 'main', { curses: false });
    const m = createMinimap(L);
    revealMap(m, L, 'layout');
    for (const r of L.rooms) {
      if (r.secret) expect(roomVis(m, r.index)).toBe(MapVis.Unknown);
      else expect(roomVis(m, r.index)).toBeGreaterThanOrEqual(MapVis.Mapped);
    }
    // Outline only: special rooms that were not seen yet still hide their icon.
    const far = L.rooms.find((r) => hasIcon(r.type) && !r.secret && roomVis(m, r.index) === MapVis.Mapped)!;
    expect(far).toBeDefined();
    expect(roomIcon(m, L, far.index)).toBeNull();

    const c = createMinimap(L);
    revealMap(c, L, 'icons');
    for (const r of L.rooms) {
      if (hasIcon(r.type) && !r.secret) expect(roomIcon(c, L, r.index)).toBe(r.type);
      if (r.type === 'normal' && roomVis(c, r.index) === MapVis.Unknown) expect(isRoomShown(c, r.index)).toBe(false);
    }
    expect(roomVis(c, L.secret)).toBe(MapVis.Unknown);

    const s = createMinimap(L);
    revealMap(s, L, 'secrets');
    expect(roomIcon(s, L, L.secret)).toBe('secret');
    expect(roomIcon(s, L, L.deepSecret)).toBe('deepSecret');

    const full = createMinimap(L);
    revealMap(full, L, 'full');
    for (const r of L.rooms) expect(roomVis(full, r.index)).toBeGreaterThanOrEqual(MapVis.Seen);
    // Revealing never lowers what was already known.
    expect(roomVis(full, L.start)).toBe(MapVis.Visited);
  });

  it('grows with the Broker\'s Nook and bumps its version on every change', () => {
    const L = generateFloor(3, 3, 'main', { curses: false });
    const m = createMinimap(L);
    const v0 = m.version;
    walkTo(m, L, L.boss);
    expect(m.version).toBeGreaterThan(v0);
    const nook = openNook(L);
    expect(roomVis(m, nook)).toBe(MapVis.Unknown);
    discoverRoom(m, L, nook);
    expect(m.vis.length).toBe(L.rooms.length);
    expect(roomIcon(m, L, nook)).toBe('nook');
    enterRoom(m, L, nook);
    expect(roomVis(m, nook)).toBe(MapVis.Visited);
  });

  it('round-trips through JSON and tolerates garbage', () => {
    const L = generateFloor(9, 10, 'alt', { curses: false });
    const m = createMinimap(L);
    walkTo(m, L, L.boss);
    discoverRoom(m, L, L.secret);
    const back = loadMinimap(JSON.parse(JSON.stringify(m)), L);
    expect(back.vis).toEqual(m.vis);
    expect(back.current).toBe(m.current);
    expect(back.lostMap).toBe(m.lostMap);

    const junk = loadMinimap({ vis: ['x', 9, 3], current: 999 }, L);
    expect(junk.vis.length).toBe(L.rooms.length);
    expect(junk.current).toBe(L.start);
    expect(roomVis(junk, L.start)).toBe(MapVis.Visited);
    for (const v of junk.vis) expect([0, 1, 2, 3]).toContain(v);
    expect(loadMinimap(null, L).current).toBe(L.start);
  });
});
