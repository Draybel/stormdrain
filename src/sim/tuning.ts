/**
 * Feel tuning — the numbers that make movement and shooting feel tight.
 * Kept in one place so they can be tweaked without hunting through logic.
 */

export const PLAYER_TUNING = {
  /** Collision circle radius (centred on the feet). */
  radius: 5,
  /** Acceleration while the stick is pushed (px/s²): 96 px/s top speed in 0.08 s (5 ticks). */
  accel: 1200,
  /** Deceleration when released (px/s²): stops in 0.1 s (6 ticks) with a ~4 px "short slide". */
  decel: 960,
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

export const PICKUP_TUNING = {
  /** Ground friction (1/s): pickups slide and settle within ~0.5 s. */
  friction: 5.5,
  /** Air drag during the pop arc (1/s). */
  airDrag: 1.2,
  /** Gravity for the pop arc (px/s²) and the launch speed range (px/s). */
  gravity: 420,
  popUp: [70, 105] as readonly [number, number],
  popOut: [28, 62] as readonly [number, number],
  /** Landing bounce: restitution, and the slowest fall that still bounces (px/s). */
  bounce: 0.42,
  minBounce: 28,
  /** Restitution against walls/rocks. */
  wallBounce: 0.55,
  /** Seconds after spawning before a popped pickup can be collected (you see it land). */
  collectDelay: 0.3,
  /** Speed given to a pickup the player walks into but can't take (px/s, scaled by PICKUP_PUSH). */
  shove: 70,
  /** Magnet flag: pull radius (px) and acceleration (px/s²). */
  magnetRadius: 64,
  magnetAccel: 520,
  /** Soft separation between overlapping pickups (fraction of overlap resolved per tick). */
  separation: 0.35,
  /** Seconds between "locked" nudges of a lockbox without a key. */
  lockedCooldown: 0.7,
} as const;

export const BOMB_TUNING = {
  radius: 5,
  /** Fuse (s). */
  fuse: 1.4,
  /** Explosion: hittable damage radius (px) and damage. */
  blastRadius: 40,
  damage: 50,
  /** Half hearts dealt to the player caught in the blast. */
  playerDamage: 2,
  /** Tiles whose box comes within this distance of the centre are destroyed (≈ a 3×3 area). */
  tileRadius: 22,
  /** Push on pickups/bombs within blastRadius × pushRange (px/s at the centre, fades out). */
  push: 320,
  pushRange: 1.7,
  /** Chain reaction: other bombs in the blast go off after this delay (s). */
  chainFuse: 0.12,
  friction: 6,
  wallBounce: 0.5,
  /** Walking into a bomb nudges it along (fraction of the player's velocity, plus a minimum). */
  nudge: 1.15,
  nudgeMin: 40,
} as const;

export const HAZARD_TUNING = {
  /** Half hearts from spikes and from touching a fire. */
  spikeDamage: 1,
  fireDamage: 1,
  /** The player's centre must be this far inside a spike tile to be "on" it (px). */
  spikeInset: 3,
  /** Extra reach (px) around a fire's collision box that still burns. */
  fireReach: 1.5,
} as const;

export const ENEMY_TUNING = {
  /** Seconds a fresh enemy is inactive (poof, no moves / attacks / contact) — fair room entries. */
  spawnTime: 0.4,
  /** Default acceleration toward the behaviour's desired velocity (px/s²). */
  accel: 700,
  /** Knockback velocity decay (1/s); frozen enemies slide on "ice" with much less drag. */
  knockDrag: 10,
  frozenDrag: 2.2,
  /** Knockback speed cap (px/s) so stacked impulses never launch anything through walls. */
  maxKnock: 320,
  /** White hit-flash (s). */
  hitFlash: 0.1,
  /** Contact circle = radius × this (a touch forgiving for the player). */
  contactScale: 0.85,
  /** Enemy contact damage pushes the player this fast (px/s), decaying at `playerPushDecay` 1/s. */
  playerPush: 120,
  playerPushDecay: 14,
  /** Soft separation between overlapping enemies (fraction of the overlap resolved per tick). */
  separation: 0.45,
  /** Height enemy shots fly at (render), their max age (s) and collision sub-step (px). */
  shotHeight: 5,
  shotMaxAge: 4,
  shotSubstep: 4,
  /** Enemy shots vs the player use this fraction of the player's radius (grazes are forgiven). */
  playerHitScale: 0.8,
  /** Charmed enemies: damage dealt to other enemies per half heart of shot/contact damage. */
  allyDamage: 5,
  /** Charmed contact / allied creep damage interval per victim (s). */
  allyContactEvery: 0.5,
  /** Regrowing champions start healing this long after their last hit (s). */
  regenDelay: 1.2,
  /** Phantom champions: flicker period (s) and the faded (intangible) fraction of it. */
  phantomPeriod: 2.6,
  phantomFaded: 0.32,
  /** Champion chance: base + luck × perLuck, capped. */
  championBase: 0.04,
  championPerLuck: 0.01,
  championMax: 0.2,
  /** Frozen enemies shatter into this many ice shards (allied shots) when killed. */
  shatterShards: 6,
  shardSpeed: 150,
  shardDamage: 5,
  /** Radius at or above which an enemy counts as big (hit-stop on death) unless `big` says so. */
  bigRadius: 8,
} as const;

/** Status effects on enemies / dummies (sim/enemies/status.ts). */
export const STATUS_TUNING = {
  /** No status lasts longer than this (s). */
  maxDuration: 10,
  /** Poison: damage every `poisonTick` s (default power = damage per tick). */
  poisonTick: 0.5,
  poisonDamage: 2.5,
  /** Burn: faster, hotter ticks. */
  burnTick: 0.3,
  burnDamage: 2,
  /** Slow: speed × (1 − power), default power. */
  slowPower: 0.5,
  /** Attack timers of slowed enemies run at this rate. */
  slowAttackRate: 0.6,
  /** Enemies with `resist` below this are never frozen solid (freeze becomes a slow). */
  freezeImmuneBelow: 0.75,
  /** Knockback status: impulse (px/s, before mass) when `power` is 0. */
  knockPower: 180,
} as const;

export const ITEM_TUNING = {
  /** Seconds Wren holds a new item overhead. */
  holdTime: 0.8,
  /** Pedestal collision radius (px). */
  pedestalRadius: 6,
  /** Extra distance at which touching a pedestal takes its item (px). */
  pedestalReach: 1.5,
  /** Lucky Coin: permanent luck per coin. */
  luckyCoinLuck: 0.5,
  /** Timed actives: a small Spark Cell adds this fraction of the max charge. */
  smallSparkTimed: 0.25,
  /** Ember heart nova: radius (px) and damage. */
  novaRadius: 44,
  novaDamage: 14,
} as const;
