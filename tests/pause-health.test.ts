/**
 * Polish batch 1 (B1-7): the pause menu's STATS show HEALTH (red hearts now / max, Tin and Ember on top) next to
 * damage, fire rate, shot speed, range, speed and luck; the character card labels her max hearts. DOM-free parts
 * (the pause scene is built over a stand-in app; nothing is drawn).
 */

import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/content/registry';
import { BONUS_EMBER, BONUS_TIN, addBonus } from '../src/sim/health';
import { Sim } from '../src/sim/sim';
import type { App } from '../src/ui/app';
import { maxHearts } from '../src/ui/characterSelect';
import { PauseScene } from '../src/ui/pause';
import { healthParts, healthText } from '../src/ui/statRows';

/** The pause scene over a run, with just enough of an App for it to read the run. */
function pauseOver(sim: Sim): Record<string, unknown> {
  const noop = () => undefined;
  const app = {
    audio: { play: noop, music: { muffle: noop } },
    scenes: { find: (name: string) => (name === 'run' ? { sim } : undefined) },
    nav: { resume: noop, settings: noop, title: noop, debug: noop },
    input: { lastDevice: 'touch' },
  } as unknown as App;
  const scene = new PauseScene(app);
  scene.enter();
  return scene.describe();
}

describe('HEALTH in the pause stats', () => {
  it('Wren: red hearts now / max, then Tin and Ember', () => {
    const sim = Sim.newRun('pause-wren', { curse: null });
    const h = sim.world.player.health;
    expect(healthText(h)).toBe('3/3');
    let d = pauseOver(sim);
    expect(d.health).toBe('3/3');
    expect(Object.keys(d.stats as object).sort()).toEqual(['damage', 'fireRate', 'luck', 'moveSpeed', 'range', 'shotSpeed']);
    h.red -= 1;
    addBonus(h, BONUS_TIN, 4);
    addBonus(h, BONUS_EMBER, 2);
    d = pauseOver(sim);
    expect(d.health).toBe('2.5/3 +2 TIN +1 EMBER');
    expect(healthParts(h).map((p) => p.text)).toEqual(['2.5/3', '+2 TIN', '+1 EMBER']);
  });

  it('Marrow (no red containers): only her Tin hearts', () => {
    const sim = Sim.newRun('pause-marrow', { curse: null }, CHARACTERS.get('marrow')!);
    const h = sim.world.player.health;
    expect(h.redMax).toBe(0);
    expect(pauseOver(sim).health).toBe('3 TIN');
    addBonus(h, BONUS_EMBER, 1);
    expect(healthText(h)).toBe('3 TIN +0.5 EMBER');
    // Nothing at all left reads as 0/0 rather than an empty line.
    h.bonusCount = 0;
    expect(healthText(h)).toBe('0/0');
  });

  it('the character card shows each character’s max hearts', () => {
    expect(maxHearts(CHARACTERS.get('wren')!)).toEqual({ red: 3, tin: 0, ember: 0 });
    expect(maxHearts(CHARACTERS.get('pip')!)).toEqual({ red: 4, tin: 0, ember: 0 });
    expect(maxHearts(CHARACTERS.get('marrow')!)).toEqual({ red: 0, tin: 3, ember: 0 });
    expect(maxHearts(CHARACTERS.get('bolt')!)).toEqual({ red: 3, tin: 1, ember: 0 });
  });
});

type Rect = { id: string; x: number; y: number; w: number; h: number };

/** Pairs of rects that overlap, and rects outside the panel. */
function layoutProblems(d: Record<string, unknown>): string[] {
  const rects = d.statRects as Rect[];
  const panel = d.panel as Rect;
  const out: string[] = [];
  for (const r of rects) {
    if (r.x < panel.x + 2 || r.y < panel.y + 2 || r.x + r.w > panel.x + panel.w - 2 || r.y + r.h > panel.y + panel.h - 2) out.push(`${r.id} outside the panel`);
    if (r.id !== 'items.label' && r.y + r.h > (d.gridTop as number) - 8) out.push(`${r.id} runs into the ITEMS heading`);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(`${a.id} overlaps ${b.id}`);
    }
  }
  return out;
}

describe('the STATS block fits (384×192)', () => {
  it('nothing overlaps and everything stays in the panel, even with long values', () => {
    for (const ch of ['wren', 'marrow', 'pip', 'bolt']) {
      const sim = Sim.newRun(`pause-fit-${ch}`, { curse: null }, CHARACTERS.get(ch)!);
      const p = sim.world.player;
      expect(layoutProblems(pauseOver(sim))).toEqual([]);
      // The longest values: a heart and a half of each kind, huge stats.
      p.health.bonusCount = 0;
      p.health.redMax = 10;
      p.health.red = 9;
      addBonus(p.health, BONUS_TIN, 5);
      addBonus(p.health, BONUS_EMBER, 7);
      Object.assign(p.stats, { damage: 99.99, fireRate: 12.34, shotSpeed: 888, range: 888, moveSpeed: 192, luck: -12.5 });
      const d = pauseOver(sim);
      expect(d.health).toBe('4.5/5 +2.5 TIN +3.5 EMBER');
      expect(layoutProblems(d)).toEqual([]);
    }
  });
});
