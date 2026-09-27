/**
 * Polish batch 2 (B2-3): enemy shots never look like player shots. Every enemy shot look carries the foe signature
 * (dark outline, dark core, dark drop-halo) at every radius; every composed player style has a white-hot centre.
 */

import { describe, expect, it } from 'vitest';
import { ENEMY_SHOT_STYLES } from '../src/sim/types';
import { SHOT_LOOKS } from '../src/render/enemyRenderer';
import { ENEMY_HALO_ALPHA, enemyShotPixels, luma, playerShotPixels, type PixelSprite } from '../src/render/shotPixels';
import { carrierItem, modItem } from './helpers/attack';
import { makeSim } from './helpers/sim';
import { MOD_IDS } from '../src/sim/types';

function px(p: PixelSprite, x: number, y: number): [number, number, number, number] {
  const i = (y * p.size + x) * 4;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!, p.data[i + 3]!];
}

function lumaAt(p: PixelSprite, x: number, y: number): number {
  const [r, g, b] = px(p, x, y);
  return luma(r, g, b);
}

describe('enemy shot looks', () => {
  it('has one look per enemy shot style', () => {
    expect(SHOT_LOOKS.length).toBe(ENEMY_SHOT_STYLES.length);
  });

  it('every look, every radius: a dark outline, a dark core, a dark drop-halo — no bright centre', () => {
    for (let s = 0; s < SHOT_LOOKS.length; s++) {
      const look = SHOT_LOOKS[s]!;
      for (let r = 1; r <= 8; r++) {
        const p = enemyShotPixels(look, r);
        const c = (p.size - 1) / 2;
        let darkOutline = 0;
        let darkInside = 0;
        let halo = 0;
        for (let y = 0; y < p.size; y++) {
          for (let x = 0; x < p.size; x++) {
            const [, , , a] = px(p, x, y);
            if (a === 0) continue;
            const d = Math.hypot(x - c, y - c);
            const l = lumaAt(p, x, y);
            if (a === ENEMY_HALO_ALPHA && l < 1) halo++;
            else if (a === 255 && l < 40) {
              if (d > r + 0.4) darkOutline++;
              else darkInside++;
            }
          }
        }
        const tag = `${ENEMY_SHOT_STYLES[s]} r${r}`;
        expect(darkOutline, tag).toBeGreaterThanOrEqual(4);
        expect(darkInside, tag).toBeGreaterThanOrEqual(1);
        expect(halo, tag).toBeGreaterThanOrEqual(4);
        // The centre is never the bright pixel a player's shot has.
        expect(lumaAt(p, c, c), tag).toBeLessThan(200);
      }
    }
  });

  it('allied shots keep the bright look (no dark core or halo)', () => {
    const p = enemyShotPixels(SHOT_LOOKS[ENEMY_SHOT_STYLES.indexOf('charm')]!, 3, false);
    const c = (p.size - 1) / 2;
    expect(lumaAt(p, c, c)).toBeGreaterThan(60);
    let halo = 0;
    for (let i = 3; i < p.data.length; i += 4) if (p.data[i] === ENEMY_HALO_ALPHA) halo++;
    expect(halo).toBe(0);
  });
});

describe('player shot looks', () => {
  /** Builds whose shot colours sit next to an enemy look: lime (muck), orange (ember), cyan (water / ice), and more. */
  const BUILDS: string[][] = [
    ['rubber-ball', 'toadstool-cap', 'twin-straws'],
    ['firecracker-pouch', 'trick-candle', 'party-popper'],
    ['leaky-bucket', 'geode', 'ice-cube-tray'],
    ['lantern-moth', 'rooftop-rod', 'static-cling'],
    ['neon-tube'],
    ['broken-oar'],
    ['rusty-boomerang'],
    [],
  ];

  it('every composed style has a white-hot centre on every shape with a middle', () => {
    const styles = BUILDS.map((items) => {
      const sim = makeSim('shot-looks');
      for (const id of items) sim.giveItem(id);
      return sim.world.player.attack.style;
    });
    // And one style per modifier (its colour dominating) plus a few carriers.
    for (const m of MOD_IDS) {
      const sim = makeSim('shot-looks-mod');
      sim.giveItem(modItem(m));
      sim.giveItem(modItem(m));
      styles.push(sim.world.player.attack.style);
    }
    for (const c of ['bomb', 'marble'] as const) {
      const sim = makeSim('shot-looks-carrier');
      sim.giveItem(carrierItem(c));
      styles.push(sim.world.player.attack.style);
    }
    for (const st of styles) {
      for (const shape of [0, 1, 2, 3, 5, 6, 7]) {
        for (const r of [1, 2, 3, 4, 6, 9, 12]) {
          const p = playerShotPixels(st, shape, r, 0.3);
          const c = (p.size - 1) / 2;
          const [, , , a] = px(p, c, c);
          expect(a, `${st.key} shape ${shape} r${r}`).toBe(255);
          expect(lumaAt(p, c, c), `${st.key} shape ${shape} r${r}`).toBeGreaterThan(240);
        }
      }
    }
  });
});

describe('the thrown crescent (polish batch 4, B4-8)', () => {
  it('is an open C with sharp horns and a bright inner edge — never a ring, never a dark-cored disc', () => {
    const sim = makeSim('crescent-look');
    const st = sim.world.player.attack.style;
    for (const r of [2, 3, 4, 6, 9]) {
      for (const rot of [0, 1.1, 2.6]) {
        const p = playerShotPixels(st, 4, r, rot);
        const c = (p.size - 1) / 2;
        // Open: the middle (inside the bite) is empty, and so is the point behind it along the heading.
        expect(px(p, c, c)[3], `r${r} rot${rot} middle`).toBe(0);
        const bx = Math.round(c - Math.cos(rot) * r * 0.9);
        const by = Math.round(c - Math.sin(rot) * r * 0.9);
        expect(px(p, bx, by)[3], `r${r} rot${rot} bite`).toBe(0);
        // The blade bulges along the heading.
        const fx = Math.round(c + Math.cos(rot) * r * 0.95);
        const fy = Math.round(c + Math.sin(rot) * r * 0.95);
        expect(px(p, fx, fy)[3], `r${r} rot${rot} front`).toBe(255);
        // A bright inner edge.
        let bright = 0;
        for (let y = 0; y < p.size; y++) for (let x = 0; x < p.size; x++) if (px(p, x, y)[3] === 255 && lumaAt(p, x, y) > 235) bright++;
        expect(bright, `r${r} rot${rot}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
