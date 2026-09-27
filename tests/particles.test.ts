/**
 * Polish batch 2 (B2-5): the particle budget — important bursts first, cosmetic ones yield — and bucketed drawing
 * (canvas state changes per (colour, alpha level), not per particle).
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import { ALPHA_LEVELS, COSMETIC_LIMIT, PARTICLE_CAP, P_RING, P_SQUARE, ParticleSystem } from '../src/render/particles';
import { ScreenShake } from '../src/render/shake';
import { WorldFx } from '../src/render/worldFx';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

const DT = 1 / 60;

/** A canvas context stand-in that counts state changes and fill calls. */
function countingCtx(): { ctx: CanvasRenderingContext2D; sets: { fill: number; alpha: number; rects: number } } {
  const sets = { fill: 0, alpha: 0, rects: 0 };
  let fill = '';
  let alpha = 1;
  const ctx = {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      sets.fill++;
      fill = v;
    },
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(v: number) {
      sets.alpha++;
      alpha = v;
    },
    fillRect() {
      sets.rects++;
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, sets };
}

describe('particle priorities', () => {
  it('cosmetic spawns stop at their share; important ones recycle the oldest cosmetic, then the oldest important', () => {
    const P = new ParticleSystem();
    for (let i = 0; i < PARTICLE_CAP; i++) P.spawnCosmetic(0, 0, 0, 0, 5, '#ffffff');
    expect(P.count).toBe(COSMETIC_LIMIT);
    expect(P.refusedCosmetic).toBe(PARTICLE_CAP - COSMETIC_LIMIT);
    // Fill the rest with important ones, then keep going: cosmetic ones are taken over first, oldest first.
    const first = P.pool.items[0]!;
    for (let i = 0; i < PARTICLE_CAP - COSMETIC_LIMIT; i++) P.spawn(0, 0, 0, 0, 5, '#ff0000');
    expect(P.count).toBe(PARTICLE_CAP);
    const p = P.spawn(1, 2, 0, 0, 5, '#00ff00')!;
    expect(p).toBe(first);
    expect(p.important).toBe(true);
    expect(P.count).toBe(PARTICLE_CAP);
    for (let i = 0; i < PARTICLE_CAP * 3; i++) expect(P.spawn(0, 0, 0, 0, 5, '#0000ff')).not.toBeNull();
    expect(P.count).toBe(PARTICLE_CAP);
    expect(P.refusedImportant).toBe(0);
    // At the cap nothing cosmetic gets in.
    expect(P.spawnCosmetic(0, 0, 0, 0, 1, '#fff')).toBeNull();
  });

  it('a 15-item build firing 30 s into waves never refuses an important spawn and stays under the cap', () => {
    const sim = makeSim('particles-build', { room: OPEN_ROOM });
    const w = sim.world;
    w.godMode = true;
    w.player.placeAt(40, 56);
    for (const id of ['twin-straws', 'acorn-buckshot', 'crab-claws', 'lantern-moth', 'geode', 'rooftop-rod', 'party-popper', 'toadstool-cap', 'rubber-ball', 'firecracker-pouch', 'static-cling', 'leaky-bucket', 'kaleidoscope', 'magnifying-glass', 'trick-candle']) {
      sim.giveItem(id);
    }
    const particles = new ParticleSystem();
    const fx = new WorldFx(particles, new ScreenShake());
    const input = makeInput({ fireHeld: true, aimX: 1, aimY: 0 });
    const foes = ['scurrier', 'spitshell', 'grate-gazer', 'drizzle-blob', 'sogwing', 'puddle-toad'];
    let spawned = 0;
    let kills = 0;
    let clears = 0;
    let peak = 0;
    for (let t = 0; t < 30 * 60; t++) {
      let alive = 0;
      for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i]!.dead) alive++;
      for (; alive < 6; alive++, spawned++) sim.spawnEnemy(foes[spawned % foes.length]!, 110 + ((spawned * 37) % 90), 16 + ((spawned * 23) % 80), { champion: false });
      const a = (t / 90) % (Math.PI * 2);
      input.aimX = Math.cos(a);
      input.aimY = Math.sin(a);
      sim.step(input);
      clearEdges(input);
      const q = sim.events;
      for (let i = 0; i < q.count; i++) {
        const e = q.at(i);
        if (e.type === 'enemyKilled') kills++;
        fx.onEvent(e);
      }
      // A room-clear chime every 2 s, like a run of quick rooms.
      if (t % 120 === 60) {
        fx.onEvent({ type: 'roomClear', x: 104, y: 56, a: 0, b: 0, id: '' });
        clears++;
      }
      fx.tick(w, DT);
      particles.update(DT);
      expect(particles.count).toBeLessThanOrEqual(PARTICLE_CAP);
      peak = Math.max(peak, particles.count);
    }
    expect(kills).toBeGreaterThan(30);
    expect(clears).toBe(15);
    expect(particles.refusedImportant).toBe(0);
    // It was busy: the cosmetic share got used and trimmed.
    expect(peak).toBeGreaterThan(COSMETIC_LIMIT * 0.5);
  });
});

describe('bucketed particle drawing', () => {
  it('sets fillStyle / globalAlpha at most once per (colour, level) bucket, whatever the count', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#123456', '#abcdef', '#fedcba'];
    for (const n of [50, 400, PARTICLE_CAP]) {
      const P = new ParticleSystem();
      for (let i = 0; i < n; i++) {
        const p = P.spawn(i % 300, (i * 7) % 180, 0, 0, 1, colors[i % colors.length]!, 1 + (i % 3), i % 5 === 0 ? P_RING : P_SQUARE)!;
        p.life = Math.random(); // every fade level
      }
      const { ctx, sets } = countingCtx();
      P.draw(ctx, 0, 0);
      expect(sets.fill).toBeLessThanOrEqual(colors.length * ALPHA_LEVELS);
      expect(sets.alpha).toBeLessThanOrEqual(ALPHA_LEVELS + 1);
      expect(sets.fill + sets.alpha).toBeLessThan(100);
      expect(sets.rects).toBeGreaterThanOrEqual(n);
    }
  });

  it('draws every particle once, in its own colour at its quantised alpha', () => {
    const P = new ParticleSystem();
    P.spawn(10, 10, 0, 0, 1, '#ff0000');
    const q = P.spawn(20, 20, 0, 0, 1, '#00ff00')!;
    q.life = 0.1; // t = 0.1 → a quarter of the fade → level 2 of 6
    const calls: string[] = [];
    let fill = '';
    let alpha = 1;
    const ctx = {
      set fillStyle(v: string) {
        fill = v;
      },
      set globalAlpha(v: number) {
        alpha = v;
      },
      fillRect(x: number, y: number) {
        calls.push(`${fill}@${alpha.toFixed(3)}:${x},${y}`);
      },
    } as unknown as CanvasRenderingContext2D;
    P.draw(ctx, 0, 0);
    expect(calls.sort()).toEqual(['#00ff00@0.333:20,20', '#ff0000@1.000:10,10']);
  });
});
