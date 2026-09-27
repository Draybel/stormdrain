/**
 * Polish batch 2 (B2-8): starting a run no longer rasterises every chapter's foes inside the START tap. Preparing a
 * chapter-1 floor builds only what that floor can show (the rest is queued for idle frames, a couple of ms at a time),
 * and a later chapter's sprites still render on demand.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOSSES, CHAPTERS, ENEMIES } from '../src/content/registry';
import { getFrame } from '../src/render/sprites';
import { Warmup } from '../src/render/warmup';
import { WorldRenderer } from '../src/render/worldRenderer';
import { Sim } from '../src/sim/sim';
import { installFakeCanvas } from './helpers/fakeCanvas';

describe('floor warm-up', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preparing a chapter-1 floor builds far fewer than 2,500 canvases; other chapters render on demand', () => {
    const counters = installFakeCanvas();
    const sim = Sim.newRun('warmup-1');
    expect(sim.world.chapter).toBe('gutterways');
    const renderer = new WorldRenderer();
    const q = new Warmup();
    renderer.prepare(sim.world, q);
    // What the START tap itself pays for: the first frame's room, her sprite, a few props.
    const sync = counters.canvases;
    expect(sync).toBeLessThan(150);
    expect(q.pending).toBeGreaterThan(0);
    // Then the idle frames work through the queue at ~2 ms a frame (here: all at once).
    q.flush();
    const chapter1 = counters.canvases;
    expect(chapter1).toBeLessThan(900);
    // The old prepare built every enemy and boss of all twelve chapters (+ doors): several times that.
    const all = new Warmup();
    for (const id of CHAPTERS.keys()) renderer.enemies.warmChapter(id, all);
    all.flush();
    expect(counters.canvases).toBeGreaterThan(chapter1 * 2);
  });

  it('a later chapter\x27s foe still renders the first time it is drawn', () => {
    const counters = installFakeCanvas();
    const sim = Sim.newRun('warmup-2');
    const renderer = new WorldRenderer();
    const q = new Warmup();
    renderer.prepare(sim.world, q);
    q.flush();
    const later = [...ENEMIES.values()].find((d) => typeof d.sprite !== 'string' && !d.chapters.includes('gutterways') && d.chapters.includes('hollow_nest'))!;
    expect(later).toBeTruthy();
    const before = counters.canvases;
    const img = getFrame(later.sprite as Exclude<typeof later.sprite, string>, 0);
    expect(img).toBeTruthy();
    expect(counters.canvases).toBe(before + 1);
  });

  it('a boss intro queues its phase tints; the queue runs within its time budget', () => {
    installFakeCanvas();
    const renderer = new WorldRenderer();
    const q = new Warmup();
    const boss = [...BOSSES.values()].find((b) => typeof b.sprite !== 'string' && b.phases.some((p) => p.tint))!;
    renderer.warmBoss(boss.id, q);
    expect(q.pending).toBeGreaterThan(0);
    // A fake clock: every job "takes" 1 ms, the budget is 2 ms → two or three jobs a step.
    let t = 0;
    const clock = (): number => (t += 1);
    const before = q.pending;
    q.step(2, clock);
    expect(before - q.pending).toBeGreaterThanOrEqual(1);
    expect(before - q.pending).toBeLessThanOrEqual(3);
  });
});
