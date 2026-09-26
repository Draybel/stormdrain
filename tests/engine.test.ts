import { describe, expect, it } from 'vitest';
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
