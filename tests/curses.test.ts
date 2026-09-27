/**
 * Polish batch 1 (B1-5): floor curses never hide the HUD, and every curse has an original name. The retired
 * 'unknown' curse (it hid the hearts) became the Leaky Roof ('leak'); the Lost Map ('lostMap', now the Soggy Map)
 * keeps the map drawn with only the visited rooms on it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CURSE_HINTS, CURSE_ICONS, CURSE_NAMES, CURSE_SHORT } from '../src/content/sprites/mapIcons';
import { FLOOR_CURSES, migrateCurse, type FloorCurse } from '../src/sim/floor/types';
import { upgradeRunData } from '../src/sim/run/run';
import type { RunSnapshot } from '../src/sim/run/types';
import { Sim } from '../src/sim/sim';
import { makeInput, stepN } from './helpers/sim';

describe('curse names and ids', () => {
  it("keeps six curses in the seeded order, 'leak' in the retired 'unknown' slot", () => {
    expect(FLOOR_CURSES).toEqual(['darkness', 'lostMap', 'maze', 'blind', 'leak', 'deluge']);
    expect(migrateCurse('unknown')).toBe('leak');
    expect(migrateCurse('maze')).toBe('maze');
    expect(migrateCurse('from-the-future')).toBeNull();
  });

  it('every curse has an original name, a short name, a one-line hint and a 7×7 icon', () => {
    expect(CURSE_NAMES).toEqual({
      darkness: 'CURSE OF THE BLACKOUT',
      lostMap: 'CURSE OF THE SOGGY MAP',
      maze: 'CURSE OF THE SHIFTING PIPES',
      blind: 'CURSE OF THE FOGGED GLASS',
      leak: 'CURSE OF THE LEAKY ROOF',
      deluge: 'CURSE OF THE DELUGE',
    });
    for (const c of FLOOR_CURSES) {
      expect(CURSE_SHORT[c].length).toBeLessThanOrEqual(14);
      expect(CURSE_HINTS[c].length).toBeLessThanOrEqual(46);
      expect([CURSE_ICONS[c].w, CURSE_ICONS[c].h]).toEqual([7, 7]);
    }
    expect(new Set(FLOOR_CURSES.map((c) => CURSE_ICONS[c].id)).size).toBe(FLOOR_CURSES.length);
  });

  it('no borrowed curse names anywhere in src/', () => {
    const banned = /OF DARKNESS|OF THE MAZE|OF THE BLIND|OF THE UNKNOWN|OF THE LOST/;
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|html|json)$/.test(f) && banned.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk(join(__dirname, '..', 'src'));
    expect(hits).toEqual([]);
  });
});

describe('older saves', () => {
  it("a snapshot whose floor curse is 'unknown' restores as the Leaky Roof (and so does a forced curse mode)", () => {
    const sim = Sim.newRun('old-curse', { curse: 'leak' });
    const snap = JSON.parse(JSON.stringify(sim.snapshot())) as RunSnapshot;
    // What a save from before the rename looks like.
    (snap.run.layout as { curse: string }).curse = 'unknown';
    snap.run.curseMode = 'unknown';
    const back = Sim.fromSnapshot(snap);
    expect(back.run!.data.layout.curse).toBe('leak');
    expect(back.run!.data.curseMode).toBe('leak');
    expect(back.world.curse).toBe('leak');
    // And the next floor keeps it (the forced mode).
    back.run!.skipFloor();
    expect(back.world.curse).toBe('leak');
    // Rolled floors and 'none' are left alone; an unknown future id becomes no curse.
    const d = JSON.parse(JSON.stringify(sim.snapshot().run)) as RunSnapshot['run'];
    d.curseMode = 'roll';
    (d.layout as { curse: string | null }).curse = 'from-the-future';
    upgradeRunData(d);
    expect(d.curseMode).toBe('roll');
    expect(d.layout.curse).toBeNull();
  });
});

// ── The HUD under every curse (a recording 2D context; the sprite cache draws into fake canvases) ──

interface DrawCall {
  img: unknown;
  x: number;
  y: number;
}

function fakeContext(calls: DrawCall[] | null): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: () => ({ width: 0 }),
    drawImage: (img: unknown, x: number, y: number) => {
      calls?.push({ img, x, y });
    },
  };
  return new Proxy(state, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('the HUD never hides the hearts', () => {
  beforeAll(() => {
    vi.stubGlobal('document', {
      createElement: () => {
        const ctx = fakeContext(null);
        return { width: 1, height: 1, getContext: () => ctx };
      },
    });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.each([null, ...FLOOR_CURSES] as (FloorCurse | null)[])('curse %s: every heart is drawn', async (curse) => {
    const { Hud, HEARTS_X, HEARTS_Y } = await import('../src/render/hud');
    const { getFrame } = await import('../src/render/sprites');
    const { HEART_SPRITE } = await import('../src/content/sprites/ui');
    const { TIN_HEART_SPRITE } = await import('../src/content/sprites/pickups');
    const sim = Sim.newRun('hud-curse', { curse });
    const w = sim.world;
    expect(w.curse).toBe(curse);
    // Two and a half red hearts of three, plus a Tin heart.
    w.player.health.red -= 1;
    const tinBefore = w.player.health.bonusCount;
    w.player.health.bonusKind[tinBefore] = 1;
    w.player.health.bonusHalves[tinBefore] = 2;
    w.player.health.bonusCount++;
    stepN(sim, makeInput(), 1);
    const calls: DrawCall[] = [];
    const hud = new Hud();
    const box = { x: 340, y: 60, w: 24, h: 24 };
    hud.draw(fakeContext(calls), w, { active: box, consumable: { ...box, y: 120 } }, 0);
    const at = (img: unknown, x: number, y: number) => calls.some((c) => c.img === img && c.x === x && c.y === y);
    const containers = w.player.health.redMax >> 1;
    for (let i = 0; i < containers; i++) {
      const hp = w.player.health.red - i * 2;
      const frame = hp >= 2 ? 0 : hp === 1 ? 1 : 2;
      expect(at(getFrame(HEART_SPRITE, frame), HEARTS_X + i * 10, HEARTS_Y), `heart ${i}`).toBe(true);
    }
    expect(at(getFrame(TIN_HEART_SPRITE, 0), HEARTS_X + containers * 10, HEARTS_Y)).toBe(true);
  });
});
