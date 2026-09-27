/**
 * Boss runtime state (ARCHITECTURE §6c):
 * - `BossState` hangs off a boss Enemy (`enemy.boss`): its phase, the pattern it is running (with a few
 *   scratch slots), rests, the phase-change roar, the intro and the death sequence, plus what the
 *   renderer needs (animation override, fade, telegraph line, landing marker, enemy beams).
 * - `BossFight` (`world.boss`) is the room's fight as a whole: name / title for the intro card and the
 *   HP bar, total HP over every part (split bosses), the phase, and whether it is over.
 * Plain classes, no imports of sim code (enemy.ts imports this file as a type).
 */

import type { BossDef } from '../types';
import type { CompiledBoss, CompiledPattern } from './compile';

/** An enemy beam (beamSweep): a ray from the boss that is first a thin telegraph, then hurts. */
export class BossBeam {
  on = false;
  /** Telegraph only (harmless, drawn thin and flickering). */
  tele = true;
  /** Angle (rad), length to the first wall / rock (px), width (px). */
  angle = 0;
  len = 0;
  width = 8;
  /** 0 water jet, 1 lightning, 2 ink (render). */
  look = 0;
  /** Half hearts on contact. */
  dmg = 1;
}

export class BossState {
  readonly def: BossDef;
  readonly c: CompiledBoss;
  /** Fight group: the uid of the first part (split parts share it). */
  group = 0;
  phase = 0;
  /** The pattern running (null = baseline movement between patterns). */
  pat: CompiledPattern | null = null;
  /** Index of the last pattern started in the phase list (cycling) / -1. */
  cycle = -1;
  /** Pattern scratch: stage, timer, counters, a locked vector / spot, two angles. */
  mode = 0;
  t = 0;
  n = 0;
  k = 0;
  ax = 0;
  ay = 0;
  a0 = 0;
  a1 = 0;
  /** Seconds of baseline movement before the next pattern. */
  rest = 1;
  /** Phase speed-up (PhaseSpec.pace). */
  pace = 1;
  /** Phase change: roaring and invulnerable for this long (s). */
  invulnT = 0;
  /** The new phase's `enter` pattern starts when the roar ends. */
  enterPending = false;
  /** Intro: idle (the card is up) for this long (s). */
  introT = 0;
  /** Death sequence: seconds left, and the timer to the next blast. */
  dieT = 0;
  boomT = 0;
  /** The death sequence has cleaned the room up (adds, shots). */
  swept = false;

  // ── Presentation (read by the renderer) ──
  /** Animation override ('' = by movement: idle / move / air / windup). */
  anim = '';
  /** 0..1 opacity (teleport fade). */
  fade = 1;
  /** Charge telegraph: a line from the boss along (tellX, tellY). */
  tellLine = false;
  tellX = 0;
  tellY = 0;
  /** Landing / emerging marker (jumps, teleports): seconds left and where. */
  markT = 0;
  markX = 0;
  markY = 0;
  /** Seconds since the last phase change (flash / colour ramp). */
  phaseT = 9;
  readonly beams: readonly BossBeam[] = [new BossBeam(), new BossBeam()];

  constructor(def: BossDef, c: CompiledBoss) {
    this.def = def;
    this.c = c;
  }
}

/** Fight kinds (events, HUD). */
export const FIGHT_BOSS = 0;
export const FIGHT_MINIBOSS = 1;
export const FIGHT_FINAL = 2;

/** The boss fight of the current room (`world.boss`). */
export class BossFight {
  /** A fight is on (HP bar) — stays true through the death sequence. */
  active = false;
  /** The last part fell and the death sequence ended. */
  done = false;
  /** The death sequence is playing. */
  dying = false;
  id = '';
  name = '';
  /** Intro card lines: the flavour line under the name, and the chapter's name. */
  title = '';
  chapter = '';
  kind = FIGHT_BOSS;
  /** uid of the first part. */
  group = 0;
  maxHp = 1;
  hp = 1;
  /** Current phase index / count, and each phase's HP threshold (fraction). */
  phase = 0;
  phases = 1;
  readonly marks: number[] = [];
  /** Intro seconds left / total (the card). */
  introT = 0;
  introMax = 1;
  /** Seconds since the fight began (HUD slide-in). */
  age = 0;
  /** Final bosses: the ending they give (0 = none). */
  ending = 0;

  reset(): void {
    this.active = false;
    this.done = false;
    this.dying = false;
    this.id = '';
    this.name = '';
    this.title = '';
    this.chapter = '';
    this.kind = FIGHT_BOSS;
    this.group = 0;
    this.maxHp = this.hp = 1;
    this.phase = 0;
    this.phases = 1;
    this.marks.length = 0;
    this.introT = 0;
    this.introMax = 1;
    this.age = 0;
    this.ending = 0;
  }
}
