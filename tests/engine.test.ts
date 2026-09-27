import { afterEach, describe, expect, it, vi } from 'vitest';
import { FRAME_RING, FrameStats, percentileOf } from '../src/engine/frameStats';
import { Loop } from '../src/engine/loop';
import { EventQueue } from '../src/engine/events';
import { Pool, type Poolable } from '../src/engine/pool';
import { AIM_STICK, MOVE_STICK, VirtualStick } from '../src/engine/sticks';
import { ButtonRegistry, makeButton } from '../src/engine/buttons';
import { angleDiff, approach, clampLength, snap4, vec2, wrapAngle } from '../src/engine/math';

class Thing implements Poolable {
  alive = false;
  slot = 0;
  value = 0;
}

describe('Pool', () => {
  it('allocates up to capacity then refuses, without creating objects', () => {
    const pool = new Pool(4, () => new Thing());
    const created = new Set(pool.items);
    const got = [pool.alloc(), pool.alloc(), pool.alloc(), pool.alloc()];
    expect(got.every((t) => t && created.has(t))).toBe(true);
    expect(pool.alloc()).toBeNull();
    expect(pool.refused).toBe(1);
    expect(pool.count).toBe(4);
  });

  it('keeps live objects dense and survives release during backwards iteration', () => {
    const pool = new Pool(8, () => new Thing());
    for (let i = 0; i < 8; i++) pool.alloc()!.value = i;
    for (let i = pool.count - 1; i >= 0; i--) {
      const t = pool.items[i]!;
      if (t.value % 2 === 0) pool.release(t);
    }
    expect(pool.count).toBe(4);
    const live = pool.items.slice(0, pool.count).map((t) => t.value).sort();
    expect(live).toEqual([1, 3, 5, 7]);
    pool.items.forEach((t, i) => expect(t.slot).toBe(i));
    pool.items.slice(0, pool.count).forEach((t) => expect(t.alive).toBe(true));
    pool.items.slice(pool.count).forEach((t) => expect(t.alive).toBe(false));
    pool.release(pool.items[7]!); // releasing a dead object is a no-op
    expect(pool.count).toBe(4);
  });
});

describe('EventQueue', () => {
  it('stores events in order and overwrites the oldest when full', () => {
    const q = new EventQueue(4);
    for (let i = 0; i < 6; i++) q.emit('hit', i, 0, i);
    expect(q.count).toBe(4);
    expect(q.dropped).toBe(2);
    expect([0, 1, 2, 3].map((i) => q.at(i).a)).toEqual([2, 3, 4, 5]);
    q.clear();
    expect(q.count).toBe(0);
    q.emit('pop', 1, 2, 3, 4, 'dummy');
    expect(q.at(0)).toMatchObject({ type: 'pop', x: 1, y: 2, a: 3, b: 4, id: 'dummy' });
  });

  it('discards the oldest events, wrapping around the ring', () => {
    const q = new EventQueue(4);
    for (let i = 0; i < 6; i++) q.emit('hit', i, 0, i); // holds 2..5, head wrapped
    q.discard(3);
    expect(q.count).toBe(1);
    expect(q.at(0).a).toBe(5);
    q.emit('pop', 0, 0, 6);
    expect([q.at(0).a, q.at(1).a]).toEqual([5, 6]);
    q.discard(0);
    expect(q.count).toBe(2);
    q.discard(99);
    expect(q.count).toBe(0);
  });
});

describe('VirtualStick', () => {
  it('move stick: deadzone, analog magnitude, clamp and follow', () => {
    const s = new VirtualStick(MOVE_STICK);
    s.begin(1, 50, 100);
    s.move(52, 100); // inside deadzone
    expect(s.outX).toBe(0);
    s.move(50 + MOVE_STICK.radius / 2, 100);
    expect(s.outX).toBeGreaterThan(0.3);
    expect(s.outX).toBeLessThan(0.6);
    s.move(50 + 200, 100); // far past the rim: origin follows, output saturates
    expect(s.outX).toBeCloseTo(1, 5);
    expect(s.originX).toBeCloseTo(250 - MOVE_STICK.radius, 5);
    expect(Math.hypot(s.knobDX, s.knobDY)).toBeCloseTo(MOVE_STICK.radius, 5);
    s.end();
    expect(s.active).toBe(false);
    expect(s.outX).toBe(0);
  });

  it('move stick reaches full output a little before the rim (saturation)', () => {
    const s = new VirtualStick(MOVE_STICK);
    s.begin(1, 0, 0);
    s.move(MOVE_STICK.radius * MOVE_STICK.saturation, 0);
    expect(s.outX).toBeCloseTo(1, 5);
    s.move(MOVE_STICK.radius * 0.95, 0);
    expect(s.outX).toBe(1);
    // Output grows monotonically from the deadzone edge to the saturation point.
    let prev = 0;
    for (let d = MOVE_STICK.radius * MOVE_STICK.deadzone + 0.5; d <= MOVE_STICK.radius; d += 0.5) {
      s.move(d, 0);
      expect(s.outX).toBeGreaterThanOrEqual(prev);
      prev = s.outX;
    }
  });

  it('move stick magnetises near-axis input onto the axis', () => {
    const s = new VirtualStick(MOVE_STICK);
    s.begin(1, 0, 0);
    s.move(20, 1.5); // ~4° off horizontal
    expect(s.outY).toBe(0);
    expect(s.outX).toBeGreaterThan(0);
  });

  it('aim stick snaps to 4 directions with hysteresis, or aims freely in 360 mode', () => {
    const s = new VirtualStick(AIM_STICK);
    s.begin(2, 300, 100);
    s.move(301, 100);
    expect(s.hasDir).toBe(false); // below activation
    s.move(310, 98);
    expect([s.dirX, s.dirY]).toEqual([1, 0]);
    s.move(310, 90.5); // 46.5° up: still right (hysteresis)
    expect([s.dirX, s.dirY]).toEqual([1, 0]);
    s.move(302, 88); // clearly up now
    expect([s.dirX, s.dirY]).toEqual([0, -1]);
    s.move(300.5, 100); // back near centre: keeps the last direction
    expect(s.hasDir).toBe(true);
    expect([s.dirX, s.dirY]).toEqual([0, -1]);

    const free = new VirtualStick(AIM_STICK);
    free.snap4 = false;
    free.begin(3, 0, 0);
    free.move(6, 6);
    expect(free.dirX).toBeCloseTo(Math.SQRT1_2, 5);
    expect(free.dirY).toBeCloseTo(Math.SQRT1_2, 5);
  });
});

describe('ButtonRegistry', () => {
  it('hit-tests topmost enabled button with padding', () => {
    const reg = new ButtonRegistry();
    const a = makeButton({ id: 'a', x: 10, y: 10, w: 20, h: 20, pad: 2 });
    const b = makeButton({ id: 'b', x: 20, y: 20, w: 20, h: 20, pad: 0 });
    const c = makeButton({ id: 'c', x: 100, y: 0, w: 10, h: 10, enabled: false });
    reg.use([a, b, c]);
    expect(reg.hitTest(9, 9)?.id).toBe('a'); // padding
    expect(reg.hitTest(25, 25)?.id).toBe('b'); // topmost wins
    expect(reg.hitTest(105, 5)).toBeNull(); // disabled
    expect(reg.hitTest(200, 200)).toBeNull();
    a.held = 1;
    reg.use([b]);
    expect(a.held).toBe(0); // leaving the registry clears pressed state
  });
});

describe('math', () => {
  it('helpers', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(0, -10, 3)).toBe(-3);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 9);
    const v = vec2();
    clampLength(v, 30, 40, 10);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10, 9);
    expect(snap4(v, 0.2, -0.9)).toEqual({ x: 0, y: -1 });
    expect(snap4(v, -0.9, 0.2)).toEqual({ x: -1, y: 0 });
  });
});

describe('FrameStats (raw frame spikes, polish batch 2)', () => {
  it('keeps the worst cost, the worst gap and the frames over 20 ms of the last second', () => {
    const st = new FrameStats();
    let t = 0;
    for (let i = 0; i < 30; i++) st.record((t += 16.7), 5, 16.7);
    expect(st.worstMs).toBe(5);
    expect(st.over20).toBe(0);
    expect(st.gapMs).toBeCloseTo(16.7, 3);
    st.record((t += 612), 28, 612); // a long input handler, then a heavy frame
    st.record((t += 16.7), 22, 16.7);
    expect(st.worstMs).toBe(28);
    expect(st.gapMs).toBeCloseTo(612, 3);
    expect(st.over20).toBe(2);
    // The window rolls: a second of normal frames later the spike is forgotten.
    for (let i = 0; i < 61; i++) st.record((t += 16.7), 4, 16.7);
    expect(st.worstMs).toBe(4);
    expect(st.over20).toBe(0);
    expect(st.gapMs).toBeCloseTo(16.7, 3);
  });

  it('gives the p95 of the window and the raw frames since an index', () => {
    const st = new FrameStats();
    let t = 0;
    for (let i = 1; i <= 60; i++) st.record((t += 16), i, 16); // costs 1..60 ms within one second
    expect(st.percentile(0.95)).toBe(57);
    expect(st.percentile(0.5)).toBe(30);
    const s = st.since(55);
    expect(s.frame).toBe(60);
    expect(s.costs).toEqual([56, 57, 58, 59, 60]);
    expect(s.gaps).toEqual([16, 16, 16, 16, 16]);
    // Only what is still in the ring comes back.
    for (let i = 0; i < FRAME_RING + 10; i++) st.record((t += 16), 1, 16);
    expect(st.since(0).costs.length).toBe(FRAME_RING);
    expect(percentileOf([3, 1, 2], 3, 0.5)).toBe(2);
  });
});

describe('Loop stats from synthetic frame times', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records update + render cost and the rAF gap per frame', () => {
    let clock = 0;
    vi.stubGlobal('performance', { now: () => clock });
    let updates = 0;
    let updateCost = 1;
    const loop = new Loop({
      update() {
        updates++;
        clock += updateCost;
      },
      render() {
        clock += 2;
      },
    });
    let raf = 0;
    for (let i = 0; i < 20; i++) loop.tick((raf += 1000 / 60));
    expect(updates).toBeGreaterThanOrEqual(19);
    expect(loop.stats.worstMs).toBeCloseTo(3, 5);
    expect(loop.stats.over20).toBe(0);
    expect(loop.stats.gapMs).toBeCloseTo(1000 / 60, 3);
    // A 600 ms freeze between frames (an input handler) and a 25 ms tick.
    updateCost = 25;
    loop.tick((raf += 600));
    expect(loop.stats.gapMs).toBeCloseTo(600, 3);
    expect(loop.stats.worstMs).toBeGreaterThanOrEqual(27);
    expect(loop.stats.over20).toBe(1);
    // The smoothed numbers barely move — why the raw ones exist.
    expect(loop.renderMs).toBeLessThan(3);
    updateCost = 1;
    for (let i = 0; i < 70; i++) loop.tick((raf += 1000 / 60));
    expect(loop.stats.gapMs).toBeLessThan(20);
    expect(loop.stats.worstMs).toBeLessThan(5);
    // After a clock reset (back from the background) the hidden time is not a gap.
    loop.resetClock();
    loop.tick((raf += 5000));
    expect(loop.stats.gapMs).toBeLessThan(20);
  });
});
