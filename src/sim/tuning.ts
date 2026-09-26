/**
 * Feel tuning — the numbers that make movement and shooting feel tight.
 * Kept in one place so they can be tweaked without hunting through logic.
 */

export const PLAYER_TUNING = {
  /** Collision circle radius (centred on the feet). */
  radius: 5,
  /** Acceleration while the stick is pushed (px/s²). ~4 ticks to top speed. */
  accel: 1500,
  /** Deceleration when released (px/s²). Gives a ~5 px "short slide". */
  decel: 1150,
  /** Accel multiplier while pushing against the current velocity (snappy reversals). */
  turnBoost: 1.75,
  /** Height above the ground a marble is released at (px) — eye level. */
  shotHeight: 7,
  /** Marble spawn distance ahead of the feet along the aim (px). */
  muzzleForward: 3,
  /** Sideways offset for alternating left/right "eye" shots (px). */
  eyeOffset: 2,
  /** Fraction of the player's velocity inherited by marbles. */
  inheritVelocity: 0.25,
  /** Invulnerability after being hurt (s). */
  hurtInvuln: 1.0,
  /** Duration of the hurt pose (s). */
  hurtPose: 0.35,
} as const;

export const MARBLE_TUNING = {
  /** Downward acceleration once the range is used up (px/s²). */
  dropGravity: 560,
  /** Horizontal drag while dropping (1/s). */
  dropDrag: 4,
  /** Hard lifetime cap (s) — safety net. */
  maxAge: 6,
  /** Max px per collision sub-step (prevents tunnelling). */
  substep: 4,
  /** Tile collisions use a slightly smaller circle so marbles graze past rock corners. */
  tileRadiusScale: 0.7,
} as const;

export const DUMMY_TUNING = {
  hp: 20,
  radius: 6,
  /** Seconds before a popped dummy pops back up. */
  respawn: 2.4,
  /** White hit-flash duration (s). */
  flash: 0.09,
  /** Visual nudge spring (stiffness, damping) and clamp (px). */
  spring: 340,
  damping: 15,
  maxNudge: 5,
} as const;
