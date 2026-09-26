/**
 * Data shapes shared by sim, content and render (ARCHITECTURE §5 — source of truth).
 * DOM-free: content files import these types and must stay loadable in node.
 * Phase 1 defines only what the engine core needs; later phases extend this file.
 */

/**
 * A sprite as code: every frame is `h` strings of `w` characters; each character is looked up in
 * `palette` ('.' and ' ' are transparent). Rendered once into cached canvases by render/sprites.ts.
 */
export interface SpriteDef {
  /** Stable id used as a cache/debug key. */
  id: string;
  w: number;
  h: number;
  palette: Readonly<Record<string, string>>;
  frames: readonly (readonly string[])[];
  /** Named animations (frame indices into `frames`). */
  anims?: Readonly<Record<string, SpriteAnim>>;
  /** Anchor (usually the feet) in sprite pixels; defaults to bottom-centre. */
  anchorX?: number;
  anchorY?: number;
}

export interface SpriteAnim {
  frames: readonly number[];
  /** Frames per second (time-driven) — some anims are driven by distance instead. */
  fps: number;
  loop: boolean;
}

/** Character / player stats in natural units (see ARCHITECTURE §3 Stats). */
export interface Stats {
  /** Damage per marble. */
  damage: number;
  /** Shots per second. */
  fireRate: number;
  /** Projectile speed, px/s. */
  shotSpeed: number;
  /** Distance a marble travels before dropping, px. */
  range: number;
  /** Top walking speed, px/s. */
  moveSpeed: number;
  luck: number;
  /** Marble collision radius, px (hidden stat). */
  shotSize: number;
  /** Knockback impulse on hit, px/s (hidden stat). */
  knockback: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  desc: string;
  stats: Stats;
  /** Starting red health in half-heart units (6 = three hearts). */
  redMax: number;
  sprite: SpriteDef;
}
