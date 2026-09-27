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
  /** Curse of the Deluge (slippery floors, unless flying): accel × this (≈ 0.23 s to top speed)… */
  slipAccel: 0.35,
  /** …and decel × this (a ≈ 0.5 s slide to a stop). */
  slipDecel: 0.2,
} as const;

/** Floor runs (sim/run): room entry, doors, trapdoor, curses. */
export const RUN_TUNING = {
  /** Spawn protection after entering a room (s): no damage at all (enemies are still poofing in). */
  entrySafe: 0.5,
  /** Door transitions are ignored this long after entering a room (no instant ping-pong). */
  doorCooldown: 0.35,
  /** Half-width of the doorway trigger along the wall (px): the gap is 16 px, the feet 10. */
  doorReach: 10,
  /** Stick deflection toward the wall that counts as walking into a door. */
  doorPush: 0.3,
  /** "Needs a key" notice / denial cooldown (s). */
  deniedCooldown: 0.8,
  /** Feet within this distance of the trapdoor's centre fall in (px). */
  trapdoorReach: 7,
  /** Curse of the Maze: chance that a door leads to a random visited room instead. */
  mazeChance: 0.2,
  /** Broker's Nook after the boss: chance with / without damage taken on the floor. */
  nookChanceHurt: 0.2,
  nookChanceClean: 0.55,
  /**
   * Placeholder bosses (until the boss framework exists): HP = clamp(def.hp × mul, min, max) ×
   * (1 + depth × (floor − 1)), size × scale.
   */
  bossHpMul: 6,
  bossHpMin: 90,
  bossHpMax: 160,
  bossScale: 1.5,
  minibossHpMul: 3.5,
  minibossHpMin: 45,
  minibossHpMax: 80,
  minibossScale: 1.3,
  bossHpPerFloor: 0.12,
  /** Challenge rooms (Rain Barrel Arena) fight this many waves before the reward appears. */
  challengeWaves: 2,
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

/** Training yard (Phase 2D): rotating pedestals, the bell, endless waves. */
export const YARD_TUNING = {
  /** A rotating pedestal offers a new item this often (s) while nobody stands next to it. */
  rotatePeriod: 7,
  /** Rotating pedestals stagger their first change by this much each (s). */
  rotateStagger: 1.6,
  /** An emptied rotating pedestal refills this long after the player stepped away (s). */
  refillDelay: 1.2,
  /** Rotation pauses while the player is this close (px), so an item never changes under your nose. */
  rotateNear: 36,
  /** Endless waves: the next wave starts this long after a clear (s). */
  autoWaveDelay: 2.5,
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

/**
 * The attack pipeline (sim/attack, ARCHITECTURE §4). Multipliers are relative to the player's stats
 * (damage per shot, shots per second, shot speed, range, shot size, knockback).
 */
export const ATTACK_TUNING = {
  /** Max px per collision sub-step for projectiles. */
  substep: 4,
  /** Hard lifetime of any projectile (s) — safety net for hovering / orbiting shots. */
  maxAge: 6,
  /** A piercing projectile can hit the same target again after this many ticks. */
  rehitTicks: 30,
  /** Height (px) non-marble projectiles fly at (render + splash height). */
  flyHeight: 6,

  // ── Storm Lance (primary) ──
  /** Charge time at the reference fire rate (s); scaled by refRate / fireRate, clamped. */
  lanceCharge: 1.0,
  lanceRefRate: 3,
  lanceChargeMin: 0.25,
  lanceChargeMax: 2.0,
  /** Beam width (px) at shot size 3; grows with sqrt(size / 3) and with extra lance copies. */
  lanceWidth: 12,
  /** Beam life (s), damage tick interval (ticks) and damage per tick (× damage). */
  lanceLife: 0.5,
  lanceEvery: 3,
  lanceDamage: 1.1,
  /** Non-damage hit hooks (statuses, chain, explode…) run on every Nth damage tick per target. */
  lanceHookEvery: 3,
  /** Extra lance copies: damage and width per extra stack. */
  lanceStackDamage: 0.35,
  lanceStackWidth: 3,

  // ── Laser (primary) ──
  laserWidth: 3,
  laserLife: 0.12,
  laserDamage: 1.0,
  laserStackDamage: 0.3,

  // ── Beams (shared) ──
  /** Trace step (px), points per trace, total point budget per beam (forks), max segments. */
  beamStep: 4,
  /**
   * Guardrail: trace points for ALL beams per tick. When many beams are live each gets a share
   * (fewer fork points, and a coarser step so the main line still reaches as far).
   */
  beamTickBudget: 5000,
  beamMaxStep: 12,
  /** Lance hit sparks: at most this many 'beamHit' events per tick. */
  beamHitEvents: 6,
  beamMaxPoints: 128,
  beamBudget: 384,
  beamMaxSegments: 16,
  /** Virtual projectile speed used when tracing (px/s): motion hooks see dt = step / speed. */
  beamSpeed: 240,
  /** Beam origin: px in front of the owner's feet, and the drawn height (render). */
  beamMuzzle: 5,
  beamHeight: 6,
  /** Laser-rider side zaps from projectiles: range (px), interval (s), damage (× damage). */
  sideLaserRange: 72,
  sideLaserEvery: 0.4,
  sideLaserDamage: 0.35,
  /** Laser-rider feathered sub-beams on the lance: angle step (rad), damage, width. */
  featherAngle: 0.13,
  featherDamage: 0.35,
  featherWidth: 2,
  /** Melee rider on beams: the beam sweeps across ± this arc (rad) over its life. */
  beamSweep: 0.96,
  /** Split forks on beams: children per fork = 1 + stacks (max), damage × childDamage, max fork depth. */
  beamForkMax: 5,
  beamForkDamage: 0.5,
  beamForkDepth: 2,
  beamForkSpread: 0.6,

  // ── Boomerang (primary) ──
  boomerangRange: 0.55,
  boomerangDamage: 1.25,
  boomerangPeriod: 1.35,
  boomerangSpeed: 1.05,
  /** Returning blades are caught within this distance of the owner (px, + shot size). */
  catchRadius: 8,

  // ── Melee (primary) ──
  meleeReach: 26,
  /** Half of the ~110° arc (rad). */
  meleeArc: 0.96,
  meleeLife: 0.16,
  meleeDamage: 2.2,
  meleeKnock: 2.5,
  meleePeriod: 1.1,
  crescentRange: 0.55,
  crescentSpeed: 1.1,
  crescentDamage: 1.0,
  /** Melee as a rider: the extra swipe's damage (× damage). */
  meleeRiderDamage: 1.4,

  // ── Bomb rider ──
  bombRadius: 24,
  bombRadiusStack: 6,
  bombDamage: 1.8,
  /** Beams: explosions every N px along the beam (max count), re-armed every N ticks. */
  beamBombSpacing: 44,
  beamBombMax: 5,
  beamBombEvery: 12,

  // ── Charge rider ──
  chargeTime: 0.9,
  chargeMinMul: 0.5,
  chargeMaxMul: 2.5,
  chargeMulStack: 0.5,
  chargeSizeMax: 1.8,
  /** Laser + charge: a burst of up to N lasers, `burstGap` s apart. */
  burstMax: 6,
  burstGap: 0.06,
  /** Lance + charge: overcharge to this level (2 = 100 % extra). */
  overcharge: 2,

  // ── Orbit rider ──
  orbitRadius: 22,
  orbitSpin: 4.2,
  orbitDamage: 0.9,
  orbitRehit: 12,
  orbitMiniScale: 0.4,
  orbitMax: 8,
  orbitSize: 3.5,

  // ── Familiars ──
  familiarSpacing: 13,
  familiarMax: 12,
  familiarSpeed: 110,

  // ── Guardrails (§4.5) ──
  capBeams: 48,
  capSwipes: 16,
  capExplosionsLive: 48,
  explosionWindow: 0.5,
  explosionsPerTick: 6,
  explosionQueue: 64,
  capChainArcs: 32,
  maxSplitDepth: 3,
  maxVolley: 40,
  /** Split children merge when the projectile pool has fewer than this many free slots. */
  poolReserve: 8,
} as const;
