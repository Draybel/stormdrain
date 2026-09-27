import { describe, expect, it } from 'vitest';
import { FakeAudioContext, type FakeScheduledSource } from '../src/audio/music/fakeAudioContext';
import {
  coreSfxNames,
  DUCK_LEVEL,
  MAX_VOICES,
  PRIO_HIGH,
  PRIO_SPAM,
  sfxNames,
  sfxPriority,
  SfxPlayer,
  type Recipe,
  type SoundName,
  type Voice,
} from '../src/audio/sfx';
import { LIBRARY_SFX_NAMES, SFX_LIBRARY, SHADOWED_SFX } from '../src/audio/sfxLibrary';

const RECIPES = SFX_LIBRARY as Readonly<Record<string, Recipe>>;
/** A library-only sound with a voice limit (plain 'coin' is a built-in recipe without one). */
const LIB_COIN = 'coin_silver' satisfies SoundName;

/**
 * Names the game design asks for (DESIGN.md pickups, lance, rooms, menus...). Some live in the
 * built-in recipe files (coin, key, heart, lance_*, chest_open...), the rest in the library.
 */
const REQUIRED = [
  'coin', 'coin_silver', 'coin_gold', 'coin_lucky', 'key', 'bomb_pickup', 'heart', 'heart_tin', 'heart_ember',
  'spark_cell', 'chest_open', 'door_open', 'door_close', 'door_lock', 'door_unlock', 'bomb_fuse', 'explosion_big',
  'explosion_small', 'enemy_hurt', 'enemy_die_squish', 'enemy_die_crunch', 'enemy_die_pop', 'boss_roar', 'boss_death',
  'lance_charge', 'lance_ready', 'lance_fire', 'crackle', 'laser_zap', 'boomerang_whoosh', 'melee_swipe', 'chain_zap',
  'freeze', 'burn', 'poison', 'split_pop', 'bounce_ping', 'item_pickup', 'transformation', 'secret_found', 'trapdoor',
  'stairs', 'shop_buy', 'cant_afford', 'slot_spin', 'slot_win', 'slot_lose', 'donation', 'achievement', 'menu_move',
  'menu_select', 'menu_back', 'player_hurt', 'player_die', 'heal', 'curse', 'teleport',
];

function voiceFor(ctx: FakeAudioContext, jitter: number, t = 0.25): Voice {
  const player = ctx.createGain();
  player.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  return {
    ctx: ctx.asAudioContext(),
    out: player as unknown as AudioNode,
    t,
    noise: noise as unknown as AudioBuffer,
    jitter,
    param: 0,
  };
}

describe('sfx library', () => {
  it('has ~60+ uniquely named, easy-to-call recipes', () => {
    expect(LIBRARY_SFX_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(LIBRARY_SFX_NAMES).size).toBe(LIBRARY_SFX_NAMES.length);
    for (const n of LIBRARY_SFX_NAMES) expect(n).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
  });

  it('covers every sound the design needs (built-in + library)', () => {
    const have = new Set<string>(sfxNames());
    expect(REQUIRED.filter((n) => !have.has(n))).toEqual([]);
  });

  it('never collides with (and is never shadowed by) a core recipe', () => {
    expect(SHADOWED_SFX).toEqual([]);
    const core = new Set(coreSfxNames());
    expect(LIBRARY_SFX_NAMES.filter((n) => core.has(n))).toEqual([]);
    const all = sfxNames();
    expect(new Set(all).size).toBe(all.length);
    for (const n of LIBRARY_SFX_NAMES) expect(all).toContain(n);
  });

  it.each(LIBRARY_SFX_NAMES.map((n) => [n] as const))('%s is well-formed and plays cleanly', (name) => {
    const r = RECIPES[name]!;
    expect(r.minGap).toBeGreaterThan(0);
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.gain).toBeGreaterThan(0);
    expect(r.gain).toBeLessThanOrEqual(1);
    expect(r.maxVoices).toBeGreaterThanOrEqual(1);
    for (const jitter of [-1, 0, 1]) {
      const ctx = new FakeAudioContext();
      const v = voiceFor(ctx, jitter);
      expect(() => r.play(v)).not.toThrow();
      expect(ctx.sources.length).toBeGreaterThan(0);
      for (const s of ctx.sources as FakeScheduledSource[]) {
        expect(s.startTime).toBeGreaterThanOrEqual(v.t - 1e-9);
        expect(Number.isFinite(s.stopTime)).toBe(true);
        // Voice accounting is honest: nothing rings much past the declared length.
        expect(s.stopTime - v.t).toBeLessThanOrEqual(r.length + 0.15);
      }
    }
  });

  it('gives each play a slightly different pitch', () => {
    const firstFreq = (jitter: number) => {
      const ctx = new FakeAudioContext();
      RECIPES[LIB_COIN]!.play(voiceFor(ctx, jitter));
      const osc = ctx.created.find((n) => n.kind === 'oscillator') as unknown as { frequency: { events: { value: number }[] } };
      return osc.frequency.events[0]!.value;
    };
    expect(firstFreq(-1)).toBeLessThan(firstFreq(0));
    expect(firstFreq(1)).toBeGreaterThan(firstFreq(0));
    expect(firstFreq(1) / firstFreq(0)).toBeLessThan(1.06);
  });
});

describe('SfxPlayer with the library', () => {
  function player() {
    const ctx = new FakeAudioContext();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    return { ctx, sfx: new SfxPlayer(ctx.asAudioContext(), out as unknown as AudioNode) };
  }

  it('plays every core and library sound by name without throwing', () => {
    const { ctx, sfx } = player();
    for (const name of sfxNames()) {
      ctx.currentTime += 3.5; // every voice free, every gap passed
      const before = ctx.sources.length;
      expect(() => sfx.play(name as SoundName, 0.3, 0.8)).not.toThrow();
      expect(ctx.sources.length).toBeGreaterThan(before);
    }
  });

  it('ignores unknown names', () => {
    const { ctx, sfx } = player();
    sfx.play('definitely_not_a_sound' as SoundName);
    sfx.play('constructor' as SoundName);
    sfx.play('toString' as SoundName);
    expect(ctx.sources.length).toBe(0);
  });

  it('enforces per-sound voice limits and minimum gaps', () => {
    const { ctx, sfx } = player();
    const coin = RECIPES[LIB_COIN]!;
    const count = () => ctx.created.filter((n) => n.kind === 'oscillator').length;
    // Faster than minGap: only the first plays.
    sfx.play(LIB_COIN);
    const one = count();
    sfx.play(LIB_COIN);
    expect(count()).toBe(one);
    // Spaced past minGap but inside the sound's length: capped at maxVoices.
    let plays = 1;
    const tries = Math.floor((coin.length - 0.01) / (coin.minGap + 0.001));
    expect(tries).toBeGreaterThan(coin.maxVoices!);
    for (let i = 0; i < tries; i++) {
      ctx.currentTime += coin.minGap + 0.001;
      const b = count();
      sfx.play(LIB_COIN);
      if (count() > b) plays++;
    }
    expect(plays).toBe(coin.maxVoices);
    // Once the voices have finished, it plays again.
    ctx.currentTime += coin.length + 0.01;
    const b = count();
    sfx.play(LIB_COIN);
    expect(count()).toBeGreaterThan(b);
  });

  it('keeps the global voice cap under a flood of different sounds', () => {
    const { sfx } = player();
    for (const name of LIBRARY_SFX_NAMES) {
      sfx.play(name);
      // Never more than the global cap sounding at once (higher priorities take voices over, never add them).
      expect(sfx.liveVoices()).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(sfx.liveVoices()).toBe(MAX_VOICES);
  });
});

describe('SfxPlayer priorities (polish batch 2)', () => {
  function player() {
    const ctx = new FakeAudioContext();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const sfx = new SfxPlayer(ctx.asAudioContext(), out as unknown as AudioNode);
    return { ctx, sfx };
  }
  /** Every low-priority (spam) sound, to fill the pool. */
  const SPAM = sfxNames().filter((n) => sfxPriority(n) === PRIO_SPAM);

  /** 200 spam plays a few ms apart (hit / splash / zaps…), then keeps them coming until every voice is busy. */
  function flood(ctx: FakeAudioContext, sfx: SfxPlayer): void {
    for (let i = 0; i < 200; i++) {
      ctx.currentTime += 0.002;
      sfx.play((i % 2 === 0 ? 'foe_hit' : 'splash') as SoundName);
      sfx.play(SPAM[i % SPAM.length] as SoundName);
    }
    // Fill every voice left with sounds of normal priority (they last a while).
    for (const n of sfxNames()) {
      if (sfx.liveVoices() >= MAX_VOICES) break;
      if (sfxPriority(n) === PRIO_SPAM || sfxPriority(n) === PRIO_HIGH || n === 'foe_die') continue;
      sfx.play(n as SoundName);
    }
  }

  it('ranks hurt / room clear above kills above hits', () => {
    expect(sfxPriority('hurt')).toBeGreaterThan(sfxPriority('foe_die'));
    expect(sfxPriority('room_clear')).toBeGreaterThan(sfxPriority('foe_die'));
    expect(sfxPriority('lance_fire')).toBe(PRIO_HIGH);
    expect(sfxPriority('foe_die')).toBeGreaterThan(sfxPriority('foe_hit'));
    for (const n of ['foe_hit', 'splash', 'chain_zap', 'split_pop', 'shot_boom']) {
      expect(sfxPriority(n)).toBe(PRIO_SPAM);
    }
  });

  it('after a flood of hits, a hurt, a room clear and a kill all start — each by stealing a voice', () => {
    const { ctx, sfx } = player();
    flood(ctx, sfx);
    expect(sfx.liveVoices()).toBe(MAX_VOICES);
    for (const n of ['hurt', 'room_clear', 'foe_die'] as const) {
      const before = ctx.sources.length;
      const stolen = sfx.stolen;
      sfx.play(n);
      expect(ctx.sources.length, n).toBeGreaterThan(before);
      expect(sfx.stolen, n).toBe(stolen + 1);
      expect(sfx.liveVoices()).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(sfx.droppedBy.get('hurt') ?? 0).toBe(0);
  });

  it('a stolen voice fades out (no click)', () => {
    const { ctx, sfx } = player();
    flood(ctx, sfx);
    const gainsBefore = ctx.created.filter((n) => n.kind === 'gain').length;
    sfx.play('room_clear');
    const faded = ctx.created
      .filter((n) => n.kind === 'gain')
      .slice(0, gainsBefore)
      .some((g) => (g as unknown as { gain: { events: { type: string; value: number; time: number }[] } }).gain.events.some((e) => e.type === 'linear' && e.value === 0 && e.time > ctx.currentTime && e.time <= ctx.currentTime + 0.01));
    expect(faded).toBe(true);
  });

  it('respects per-sound caps; spam never steals from higher priorities', () => {
    const { ctx, sfx } = player();
    for (let i = 0; i < 60; i++) {
      ctx.currentTime += 0.031;
      sfx.play('foe_hit');
    }
    // foe_hit holds at most 3 voices however hard it is spammed (0.12 s long, played every 31 ms).
    expect(sfx.liveVoices()).toBeLessThanOrEqual(3);
    // A pool full of high-priority sounds: spam is dropped, never steals.
    const { ctx: c2, sfx: s2 } = player();
    for (const n of sfxNames()) {
      if (s2.liveVoices() >= MAX_VOICES) break;
      if (sfxPriority(n) === PRIO_HIGH) s2.play(n as SoundName);
    }
    expect(s2.liveVoices()).toBe(MAX_VOICES);
    const stolen = s2.stolen;
    const before = c2.sources.length;
    for (const n of SPAM) s2.play(n as SoundName);
    s2.play('foe_die');
    expect(s2.stolen).toBe(stolen);
    expect(c2.sources.length).toBe(before);
    expect(s2.dropped).toBeGreaterThan(0);
  });

  it('a hurt ducks the other sounds (and the music) with smooth ramps', () => {
    const { ctx, sfx } = player();
    const calls: [number, number][] = [];
    sfx.onDuck = (level, hold) => calls.push([level, hold]);
    ctx.currentTime = 1;
    sfx.play('hurt');
    expect(calls).toEqual([[DUCK_LEVEL, 0.25]]);
    // The duck bus is the first gain the player made (after the test's output): a ramp down to about −6 dB and back
    // up, no jumps.
    const bus = ctx.created.filter((n) => n.kind === 'gain')[1] as unknown as { gain: { events: { type: string; value: number; time: number }[] } };
    const ev = bus.gain.events;
    const down = ev.find((e) => e.type === 'linear' && e.value === DUCK_LEVEL)!;
    const up = ev.find((e) => e.type === 'linear' && e.value === 1)!;
    expect(down.time).toBeGreaterThan(1);
    expect(down.time).toBeLessThan(1.05);
    expect(up.time - down.time).toBeGreaterThanOrEqual(0.25);
    expect(20 * Math.log10(DUCK_LEVEL)).toBeCloseTo(-6, 0);
    // The hurt itself plays past the dip (straight to the output, not through the duck bus).
    const hurtGain = ctx.created.filter((n) => n.kind === 'gain').at(-1) as unknown as { outputs: Set<unknown> };
    expect(hurtGain.outputs.has(bus)).toBe(false);
  });
});
