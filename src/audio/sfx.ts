/**
 * Procedural sound effects: every sound is a small recipe of oscillators / filtered noise with
 * envelopes, synthesised on the fly (no audio files). A voice cap and per-sound rate limits keep
 * rapid fire from turning into mush or overloading older phones.
 *
 * Priorities (polish batch 2): when all MAX_VOICES are busy, a new sound steals the OLDEST voice of the lowest
 * priority below its own (faded out over ~5 ms, no click) and is dropped only when everything playing ranks as high
 * or higher. Hurt / death / the lance / room clear / pickups / items / bosses / UI rank above kills, kills above
 * everything else, and hit / splash / zap spam ranks lowest (with 2-3 voice caps of their own), so the sounds that say
 * something happened are never lost to the din. A hurt (`duck`) dips every other sound by ~6 dB for 0.25 s (and the
 * engine dips the music with it); the hurt itself plays past the dip.
 */

import { ATTACK_RECIPES, type AttackSfxName } from './sfxAttack';
import { ENEMY_RECIPES, type EnemySfxName } from './sfxEnemies';
import { GAMEPLAY_RECIPES, type GameplaySfxName } from './sfxGameplay';
import type { LibrarySfxName } from './sfxLibrary';
import { noise, osc, type Recipe, type Voice } from './synth';

export type { Recipe, Voice } from './synth';

/** Phase 1 core sounds (UI, shooting, dummies, hurt/death). */
export type CoreSfxName = 'shoot' | 'hit' | 'splash' | 'dummy_pop' | 'ui_click' | 'ui_back' | 'hurt' | 'death' | 'spawn';
/** Sounds built into the player (core + gameplay + enemy + attack recipe files). */
export type SfxName = CoreSfxName | GameplaySfxName | EnemySfxName | AttackSfxName;

/** Every playable sound: the built-in recipes plus the library in sfxLibrary.ts (registered at startup). */
export type SoundName = SfxName | LibrarySfxName;

export const MAX_VOICES = 20;

/** Voice priorities (higher wins a voice). */
export const PRIO_SPAM = 0;
export const PRIO_NORMAL = 1;
export const PRIO_KILL = 2;
export const PRIO_HIGH = 3;

/** Priorities by name (recipes may set their own; everything else is PRIO_NORMAL). */
const PRIORITY: Readonly<Record<string, number>> = {
  // Spam: hits, splashes, zaps, pops, sparks — heard plenty even when a few are dropped.
  shoot: PRIO_SPAM,
  splash: PRIO_SPAM,
  hit: PRIO_SPAM,
  foe_hit: PRIO_SPAM,
  enemy_hurt: PRIO_SPAM,
  enemy_hurt_squish: PRIO_SPAM,
  swipe_hit: PRIO_SPAM,
  chain_zap: PRIO_SPAM,
  split_pop: PRIO_SPAM,
  shot_boom: PRIO_SPAM,
  bounce_tink: PRIO_SPAM,
  bounce_ping: PRIO_SPAM,
  crackle: PRIO_SPAM,
  laser_zap: PRIO_SPAM,
  eshot_pop: PRIO_SPAM,
  crate_hit: PRIO_SPAM,
  fire_hit: PRIO_SPAM,
  tink: PRIO_SPAM,
  charge_tick: PRIO_SPAM,
  // Kills.
  foe_die: PRIO_KILL,
  foe_die_big: PRIO_KILL,
  st_shatter: PRIO_KILL,
  enemy_die_squish: PRIO_KILL,
  enemy_die_crunch: PRIO_KILL,
  enemy_die_pop: PRIO_KILL,
  dummy_pop: PRIO_KILL,
  explosion: PRIO_KILL,
  explosion_big: PRIO_KILL,
  // What must always be heard: getting hurt, the lance, room clears, pickups and items, bosses, the UI.
  hurt: PRIO_HIGH,
  death: PRIO_HIGH,
  player_hurt: PRIO_HIGH,
  player_die: PRIO_HIGH,
  lance_fire: PRIO_HIGH,
  lance_ready: PRIO_HIGH,
  room_clear: PRIO_HIGH,
  gate_shut: PRIO_HIGH,
  gate_open: PRIO_HIGH,
  item_get: PRIO_HIGH,
  item_pickup: PRIO_HIGH,
  pickup: PRIO_HIGH,
  coin: PRIO_HIGH,
  coin_big: PRIO_HIGH,
  coin_silver: PRIO_HIGH,
  coin_gold: PRIO_HIGH,
  coin_lucky: PRIO_HIGH,
  key: PRIO_HIGH,
  bomb_pickup: PRIO_HIGH,
  heart: PRIO_HIGH,
  heart_tin: PRIO_HIGH,
  heart_ember: PRIO_HIGH,
  tin_heart: PRIO_HIGH,
  ember_heart: PRIO_HIGH,
  tin_break: PRIO_HIGH,
  spark: PRIO_HIGH,
  spark_cell: PRIO_HIGH,
  spark_cell_full: PRIO_HIGH,
  trinket: PRIO_HIGH,
  chest_open: PRIO_HIGH,
  transformation: PRIO_HIGH,
  secret_found: PRIO_HIGH,
  trapdoor: PRIO_HIGH,
  achievement: PRIO_HIGH,
  boss_roar: PRIO_HIGH,
  boss_death: PRIO_HIGH,
  denied: PRIO_HIGH,
  locked: PRIO_HIGH,
  ui_click: PRIO_HIGH,
  ui_back: PRIO_HIGH,
  menu_move: PRIO_HIGH,
  menu_select: PRIO_HIGH,
  menu_back: PRIO_HIGH,
  shop_buy: PRIO_HIGH,
  power_up: PRIO_HIGH,
  tonic: PRIO_HIGH,
  charged: PRIO_HIGH,
};

/** The voice priority of a sound (its recipe's own, else by name, else PRIO_NORMAL). */
export function sfxPriority(name: string): number {
  const r = recipeFor(name);
  if (r?.priority !== undefined) return r.priority;
  return Object.prototype.hasOwnProperty.call(PRIORITY, name) ? PRIORITY[name]! : PRIO_NORMAL;
}

/** Sounds that duck the mix when they play (their own recipe can say so too). */
const DUCKERS = new Set(['hurt', 'player_hurt']);

/** How far a hurt dips everything else (gain; ≈ −6 dB), for how long (s), and the ramps (s). */
export const DUCK_LEVEL = 0.5;
export const DUCK_HOLD = 0.25;
export const DUCK_ATTACK = 0.02;
export const DUCK_RELEASE = 0.12;
/** A stolen voice fades out over this long (s): no click. */
export const STEAL_FADE = 0.005;

const CORE_RECIPES: Record<CoreSfxName, Recipe> = {
  // Soft glassy "pip".
  shoot: {
    minGap: 0.03,
    length: 0.1,
    gain: 0.5,
    play(v) {
      const f = 1180 * (1 + v.jitter * 0.05);
      osc(v, 'triangle', f, f * 0.55, 0.075, 0.35);
      osc(v, 'sine', f * 2, f * 1.1, 0.04, 0.08);
    },
  },
  // Marble lands / plinks on stone.
  splash: {
    minGap: 0.04,
    length: 0.08,
    gain: 0.35,
    maxVoices: 3,
    play(v) {
      const f = 1600 * (1 + v.jitter * 0.12);
      osc(v, 'sine', f, f * 0.35, 0.05, 0.25);
      noise(v, 'highpass', 3000, 5000, 0.7, 0.035, 0.12);
    },
  },
  // Thwack into burlap.
  hit: {
    minGap: 0.025,
    length: 0.12,
    gain: 0.6,
    play(v) {
      noise(v, 'bandpass', 1400 * (1 + v.jitter * 0.1), 700, 1.4, 0.07, 0.5);
      osc(v, 'sine', 210, 90, 0.08, 0.45);
    },
  },
  // Bloop + puff of straw.
  dummy_pop: {
    minGap: 0.06,
    length: 0.35,
    gain: 0.7,
    play(v) {
      osc(v, 'sine', 240, 760, 0.09, 0.45, 0.005);
      osc(v, 'square', 120, 60, 0.12, 0.08);
      noise(v, 'lowpass', 3200, 260, 0.9, 0.3, 0.45, 0.01);
    },
  },
  // Dummy grows back.
  spawn: {
    minGap: 0.1,
    length: 0.2,
    gain: 0.25,
    play(v) {
      osc(v, 'triangle', 300, 620, 0.14, 0.3, 0.02);
      noise(v, 'lowpass', 900, 2000, 0.8, 0.12, 0.12, 0.02);
    },
  },
  ui_click: {
    minGap: 0.03,
    length: 0.08,
    gain: 0.35,
    play(v) {
      osc(v, 'square', 880, 860, 0.03, 0.18);
      const t = v.t;
      v.t = t + 0.035;
      osc(v, 'square', 1320, 1300, 0.035, 0.14);
      v.t = t;
    },
  },
  ui_back: {
    minGap: 0.03,
    length: 0.1,
    gain: 0.35,
    play(v) {
      osc(v, 'square', 660, 650, 0.035, 0.16);
      const t = v.t;
      v.t = t + 0.04;
      osc(v, 'square', 440, 430, 0.05, 0.14);
      v.t = t;
    },
  },
  hurt: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.6,
    play(v) {
      osc(v, 'sawtooth', 520, 130, 0.25, 0.3);
      noise(v, 'bandpass', 1800, 400, 1, 0.15, 0.3);
    },
  },
  death: {
    minGap: 0.3,
    length: 0.8,
    gain: 0.6,
    play(v) {
      osc(v, 'triangle', 660, 110, 0.7, 0.4, 0.01);
      osc(v, 'sine', 330, 55, 0.75, 0.3, 0.01);
      noise(v, 'lowpass', 2000, 150, 0.7, 0.5, 0.25, 0.02);
    },
  },
};

const RECIPES: Record<SfxName, Recipe> = { ...CORE_RECIPES, ...GAMEPLAY_RECIPES, ...ENEMY_RECIPES, ...ATTACK_RECIPES };

/** Recipes added by other modules (sfxLibrary.ts). Built-in RECIPES win on a name clash. */
const EXTRA = new Map<string, Recipe>();

/** Registers extra recipes; names that already exist (core or registered) are skipped and returned. */
export function registerSfx(recipes: Readonly<Record<string, Recipe>>): string[] {
  const skipped: string[] = [];
  for (const name of Object.keys(recipes)) {
    if (Object.prototype.hasOwnProperty.call(RECIPES, name) || EXTRA.has(name)) skipped.push(name);
    else EXTRA.set(name, recipes[name]!);
  }
  return skipped;
}

function recipeFor(name: string): Recipe | undefined {
  if (Object.prototype.hasOwnProperty.call(RECIPES, name)) return (RECIPES as Readonly<Record<string, Recipe>>)[name];
  return EXTRA.get(name);
}

/** Names of every playable sound (core first). */
export function sfxNames(): string[] {
  return [...Object.keys(RECIPES), ...EXTRA.keys()];
}

/** Names of the built-in recipes (core, gameplay, enemy and attack files). */
export function coreSfxNames(): string[] {
  return Object.keys(RECIPES);
}

export class SfxPlayer {
  private readonly ctx: AudioContext;
  private readonly out: AudioNode;
  /** Every voice but the duckers plays through this (the hurt duck dips it). */
  private readonly duckBus: GainNode;
  private readonly noiseBuf: AudioBuffer;
  private readonly last = new Map<string, number>();
  /** End times of playing voices (fixed slots, no allocation). */
  private readonly voiceEnds = new Float64Array(MAX_VOICES);
  /** Start times, priorities and output gains of the voices (stealing picks the oldest of the lowest priority). */
  private readonly voiceStarts = new Float64Array(MAX_VOICES);
  private readonly voicePrios = new Int8Array(MAX_VOICES);
  private readonly voiceGains: (GainNode | null)[] = new Array<GainNode | null>(MAX_VOICES).fill(null);
  /** Which sound each voice slot is playing (for per-sound voice limits). */
  private readonly voiceNames: (string | null)[] = new Array<string | null>(MAX_VOICES).fill(null);
  private readonly voice: Voice;
  /** Called when a ducking sound plays (the engine dips the music with it). */
  onDuck: ((level: number, hold: number) => void) | null = null;
  /** Diagnostics: sounds dropped (everything playing ranked as high or higher) and voices stolen. */
  dropped = 0;
  stolen = 0;
  /** Plays per name that were dropped (tests / tools). */
  readonly droppedBy = new Map<string, number>();

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;
    this.duckBus = ctx.createGain();
    this.duckBus.connect(out);
    // One second of white noise shared by every noise-based recipe.
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.voice = { ctx, out, t: 0, noise: this.noiseBuf, jitter: 0, param: 0 };
  }

  /**
   * @param pan    -1 (left) .. 1 (right)
   * @param volume 0..1 extra scale
   * @param param  recipe-specific level (pitch / intensity), default 0
   */
  play(name: SoundName, pan = 0, volume = 1, param = 0): void {
    const r = recipeFor(name);
    if (!r) return;
    const now = this.ctx.currentTime;
    const last = this.last.get(name);
    if (last !== undefined && now - last < r.minGap) return;
    const prio = r.priority ?? sfxPriority(name);
    // Find a free voice slot (and count this sound's live voices for its own limit); remember the oldest voice of
    // the lowest priority in case the pool is full.
    let slot = -1;
    let same = 0;
    let victim = -1;
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voiceEnds[i]! <= now) {
        if (slot < 0) slot = i;
        continue;
      }
      if (this.voiceNames[i] === name) same++;
      const vp = this.voicePrios[i]!;
      if (vp >= prio) continue;
      if (victim < 0 || vp < this.voicePrios[victim]! || (vp === this.voicePrios[victim]! && this.voiceStarts[i]! < this.voiceStarts[victim]!)) victim = i;
    }
    if (r.maxVoices !== undefined && same >= r.maxVoices) return;
    if (slot < 0) {
      if (victim < 0) {
        // Everything playing ranks as high or higher: this one is dropped.
        this.dropped++;
        this.droppedBy.set(name, (this.droppedBy.get(name) ?? 0) + 1);
        return;
      }
      this.steal(victim, now);
      slot = victim;
    }
    this.voiceEnds[slot] = now + r.length;
    this.voiceStarts[slot] = now;
    this.voicePrios[slot] = prio;
    this.voiceNames[slot] = name;
    this.last.set(name, now);
    const ducker = r.duck === true || DUCKERS.has(name);
    if (ducker) this.duck(now);

    // Per-voice gain (+ optional panner). Nodes are released by the browser once the
    // scheduled sources stop, so nothing needs manual cleanup. A ducking sound bypasses the duck.
    const dest = ducker ? this.out : this.duckBus;
    const g = this.ctx.createGain();
    g.gain.value = r.gain * volume;
    this.voiceGains[slot] = g;
    if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(dest);
    } else {
      g.connect(dest);
    }
    const v = this.voice;
    v.out = g;
    v.t = now + 0.005;
    v.jitter = Math.random() * 2 - 1;
    v.param = param;
    r.play(v);
  }

  /** Voices sounding now (tests / tools). */
  liveVoices(): number {
    const now = this.ctx.currentTime;
    let n = 0;
    for (let i = 0; i < MAX_VOICES; i++) if (this.voiceEnds[i]! > now) n++;
    return n;
  }

  /** Takes a voice over: its output fades to silence over STEAL_FADE (its sources run out unheard). */
  private steal(i: number, now: number): void {
    const g = this.voiceGains[i];
    if (g) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(0, now + STEAL_FADE);
    }
    this.voiceGains[i] = null;
    this.voiceEnds[i] = now;
    this.stolen++;
  }

  /** A hurt: every other sound dips to DUCK_LEVEL for DUCK_HOLD s (smooth ramps), and the music with it. */
  duck(now = this.ctx.currentTime): void {
    const p = this.duckBus.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(DUCK_LEVEL, now + DUCK_ATTACK);
    p.setValueAtTime(DUCK_LEVEL, now + DUCK_ATTACK + DUCK_HOLD);
    p.linearRampToValueAtTime(1, now + DUCK_ATTACK + DUCK_HOLD + DUCK_RELEASE);
    this.onDuck?.(DUCK_LEVEL, DUCK_HOLD);
  }
}
