/**
 * Tiny synthesis helpers shared by every SFX recipe (a leaf module: recipes import it, never the
 * other way round). All nodes are created per play and released by the browser when they stop.
 */

export interface Recipe {
  /** Minimum seconds between two plays of this sound. */
  minGap: number;
  /** Approximate length (s), used for voice accounting. */
  length: number;
  /** Base gain (before bus volumes). */
  gain: number;
  /** Most simultaneous voices of this sound (default: only the global cap). */
  maxVoices?: number;
  /**
   * Voice priority when the pool is full (polish batch 2; default from sfx.ts `sfxPriority` by name): a new sound
   * steals the oldest voice of a LOWER priority, and is dropped only when everything playing ranks as high or higher.
   */
  priority?: number;
  /** Playing this ducks the music and every other sound for a moment (a hurt). */
  duck?: boolean;
  play(v: Voice): void;
}

/** Everything a recipe needs, prepared by the player (so recipes stay tiny). */
export interface Voice {
  ctx: AudioContext;
  out: AudioNode;
  t: number;
  noise: AudioBuffer;
  /** Random ±1 value for per-play variation. */
  jitter: number;
  /** Caller-supplied value (0 by default): pitch / intensity for sounds that follow a level. */
  param: number;
}

export function env(g: GainNode, t: number, attack: number, peak: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

export function osc(v: Voice, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.004): void {
  const o = v.ctx.createOscillator();
  const g = v.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, v.t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), v.t + dur);
  env(g, v.t, attack, peak, dur);
  o.connect(g).connect(v.out);
  o.start(v.t);
  o.stop(v.t + attack + dur + 0.02);
}

export function noise(
  v: Voice,
  filter: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  attack = 0.002,
): void {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  // Random start inside the buffer so repeated hits don't sound identical.
  const offset = Math.random() * Math.max(0, v.noise.duration - dur - 0.05);
  const bq = v.ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, v.t);
  bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), v.t + dur);
  const g = v.ctx.createGain();
  env(g, v.t, attack, peak, dur);
  src.connect(bq).connect(g).connect(v.out);
  src.start(v.t, offset);
  src.stop(v.t + attack + dur + 0.02);
}

/** Plays `fn` with the voice's start time shifted by `dt` seconds (for arpeggios / echoes). */
export function later(v: Voice, dt: number, fn: () => void): void {
  const t = v.t;
  v.t = t + dt;
  fn();
  v.t = t;
}
