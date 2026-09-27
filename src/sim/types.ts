/**
 * Data shapes shared by sim, content and render (ARCHITECTURE §5 — THE source of truth).
 * DOM-free: content files import these types and must stay loadable in node.
 *
 * Conventions
 * - Ids are plain strings (kebab-case for content, e.g. 'brick-chip'); aliases below document intent.
 * - Health amounts are in HALF-HEART units unless a field says otherwise.
 * - Distances in px, times in seconds, speeds in px/s (ARCHITECTURE §3).
 * - Room templates / floor layouts are owned by the floor generator (src/sim/floor/types.ts); only
 *   RoomType / ROOM_TYPES / RoomTemplate are re-exported here.
 */

// ── Sprites ──────────────────────────────────────────────────────────────────

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

// ── Ids ──────────────────────────────────────────────────────────────────────

export type ItemId = string;
export type EnemyId = string;
export type BossId = string;
export type CharacterId = string;
export type ChapterId = string;
export type SynergyId = string;
export type SetId = string;
export type AchievementId = string;
export type FamiliarId = string;
export type DropTableId = string;
/** Name of a function registered with `registerHook` (src/sim/hooks.ts, content in src/content/hooks). */
export type HookId = string;

/** Item pools (where an item can be rolled). */
export const POOL_IDS = [
  'treasure',
  'shop',
  'boss',
  'secret',
  'deepSecret',
  'cursed',
  'broker',
  'challenge',
  /** Lockbox / chest rolls (trinkets, consumables). */
  'chest',
  /** Old Pell the wandering trader. */
  'trader',
] as const;
export type PoolId = (typeof POOL_IDS)[number];

/**
 * Room types (DESIGN.md "Rooms") and the room template shape. The floor generator owns them
 * (src/sim/floor/types.ts); they are re-exported here so content code has one place to import from.
 * The Broker's Nook room type is 'nook' (its item pool is still the 'broker' PoolId above).
 */
export { ROOM_TYPES, type RoomTemplate, type RoomType } from './floor/types';

// ── Stats ────────────────────────────────────────────────────────────────────

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

export type StatId = keyof Stats;

/** Every stat, in a fixed order (iteration without Object.keys). */
export const STAT_IDS: readonly StatId[] = [
  'damage',
  'fireRate',
  'shotSpeed',
  'range',
  'moveSpeed',
  'luck',
  'shotSize',
  'knockback',
];

// ── Attack pipeline ids (ARCHITECTURE §4 — implemented by the attack pipeline, declared here) ─────

/** Attack types. Primary precedence: lance > laser > boomerang > melee > marble (§4.2). */
export const CARRIER_IDS = ['marble', 'lance', 'laser', 'boomerang', 'melee', 'bomb', 'charge', 'orbit'] as const;
export type CarrierId = (typeof CARRIER_IDS)[number];

/** Shot modifiers by hook stage (§4.4). Every one must work with every carrier. */
export const MOD_IDS = [
  // spawn
  'extraShots',
  'spread',
  'backShot',
  'sideShots',
  'circleFirst',
  'inaccuracy',
  // motion
  'homing',
  'wavy',
  'spiral',
  'orbitPlayer',
  'boomerang',
  'grow',
  'shrink',
  'accelerate',
  'decelerate',
  'bounce',
  'phase',
  // hit / expire
  'pierce',
  'split',
  'chain',
  'explode',
  'puddle',
  'poison',
  'burn',
  'freeze',
  'slow',
  'charm',
  'fear',
  'knockback',
] as const;
export type ModId = (typeof MOD_IDS)[number];

/** Shot silhouette hints for ShotStyle composition (§4.6). */
export type ShapeHint = 'marble' | 'spiky' | 'bomb' | 'blade' | 'crescent' | 'star' | 'gear' | 'shard' | 'bubble';
/** Trail kinds for ShotStyle composition (§4.6). */
export type TrailKind = 'none' | 'embers' | 'bubbles' | 'ice' | 'sparks' | 'wisps' | 'dust' | 'drops';

export interface StyleOverride {
  color?: string;
  shape?: ShapeHint;
  trail?: TrailKind;
  /** Extra glow radius (px). */
  glow?: number;
}

// ── Pickups ──────────────────────────────────────────────────────────────────

/** Pickup kinds by name (content/data side). The sim maps them to numeric kinds (sim/pickupKinds.ts). */
export const PICKUP_NAMES = [
  'coin',
  'silverCoin',
  'goldCoin',
  'luckyCoin',
  'bomb',
  'doubleBomb',
  'key',
  'keyRing',
  'halfHeart',
  'heart',
  'tinHeart',
  'emberHeart',
  'sparkSmall',
  'sparkFull',
  'satchel',
  'lockbox',
  /** A trinket lying on the floor (item id chosen from a pool when dropped by a table). */
  'trinket',
  /** A consumable lying on the floor (item id chosen from a pool when dropped by a table). */
  'consumable',
] as const;
export type PickupName = (typeof PICKUP_NAMES)[number];

export interface PickupSpawnSpec {
  kind: PickupName;
  count?: number;
}

/** One weighted outcome of a drop-table roll. */
export interface DropEntry {
  kind: PickupName;
  weight: number;
  /** How many of `kind` this outcome spawns (default 1). */
  count?: number;
  /** For 'trinket' / 'consumable': the item pool to draw from (default 'chest'). */
  pool?: PoolId;
}

/** Seeded, data-driven loot (rolled with the run's lootRng). Content: src/content/drops/*.ts. */
export interface DropTableDef {
  id: DropTableId;
  /** Number of rolls, inclusive range. */
  rolls: readonly [number, number];
  /** Weight of "nothing" for each roll (0 = always drops). */
  nothing?: number;
  /** Luck scaling: each point of luck multiplies the nothing-weight by (1 - luck*this), floor 20 %. */
  luck?: number;
  entries: readonly DropEntry[];
}

// ── Effects ──────────────────────────────────────────────────────────────────

export const TRIGGER_EVENTS = ['hurt', 'roomClear', 'kill', 'fire', 'floorStart', 'bomb', 'pickup', 'use'] as const;
export type TriggerOn = (typeof TRIGGER_EVENTS)[number];

/** Boolean player flags (set by 'flag' effects). */
export const PLAYER_FLAGS = [
  /** Crosses pits, ignores spikes. */
  'flying',
  /** Shots pass through obstacles (read by the attack pipeline). */
  'spectral',
  /** Pickups drift toward you. */
  'magnet',
  /** Two trinket slots. */
  'extraTrinket',
  /** Two consumable slots. */
  'extraConsumable',
  /** Your own explosions don't hurt you. */
  'explosionImmune',
  'spikeImmune',
  'fireImmune',
  /** Red heart pickups turn into Tin hearts (Marrow). */
  'noRedHearts',
  /** Secret-room hints are always shown. */
  'seeSecrets',
  /** Ignores the darkness curse. */
  'darkVision',
  /** Shop and trader prices −25 % (Magpie's Stall, Old Pell). */
  'haggler',
  /** Movement input is mirrored (the Dizzy Tonic, see sim/tonics.ts; read by sim/player.ts). */
  'confused',
  /** Mystery Tonic labels can be read: every bottle shows its real name (sim/tonics.ts). */
  'readLabels',
] as const;
export type PlayerFlag = (typeof PLAYER_FLAGS)[number];

/**
 * Effects come in two families (see src/sim/effects.ts):
 * - PERSISTENT (stat, mod, carrier, familiar, flag, trigger): active while the item is held; recomputed
 *   from the inventory whenever it changes. When executed from a `use` list or a trigger they become
 *   TEMPORARY: `duration` seconds, or until the player leaves the room when omitted.
 * - INSTANT (heal, hearts, pickups, hook): run once — when a fresh item is first picked up, when an
 *   active/consumable is used, or when a trigger fires.
 */
export interface StatEffect {
  type: 'stat';
  stat: StatId;
  /** Added to the base (all adds are summed first). */
  add?: number;
  /** Multiplier (all muls are multiplied, applied after the adds). */
  mul?: number;
  duration?: number;
}

export interface ModEffect {
  type: 'mod';
  mod: ModId;
  /** Stack count contributed (default 1). */
  stacks?: number;
  /** Numeric parameters, summed across stacks (e.g. turn rate, split count). */
  params?: Readonly<Record<string, number>>;
  duration?: number;
}

export interface CarrierEffect {
  type: 'carrier';
  carrier: CarrierId;
  duration?: number;
}

export interface FamiliarEffect {
  type: 'familiar';
  familiar: FamiliarId;
  count?: number;
  duration?: number;
}

export interface FlagEffect {
  type: 'flag';
  flag: PlayerFlag;
  duration?: number;
}

export interface TriggerEffect {
  type: 'trigger';
  on: TriggerOn;
  /** Base chance 0..1 (default 1). */
  chance?: number;
  /** Chance added per point of luck (default 0). */
  luck?: number;
  /** Upper bound for chance after luck (default 1). */
  maxChance?: number;
  /** Seconds before this trigger can fire again (default 0). */
  cooldown?: number;
  /** Short uppercase notice shown in the top band when it fires (a 'say' event), e.g. 'THE TEACUP BOILS OVER!'. */
  say?: string;
  effects: readonly Effect[];
}

export interface HealEffect {
  type: 'heal';
  /** Half hearts of red health restored (99 = full heal). */
  amount: number;
}

export interface HeartsEffect {
  type: 'hearts';
  /** WHOLE heart containers added (each also filled). Negative removes containers. */
  containers?: number;
  /** Half hearts of red healing. */
  red?: number;
  /** Half hearts of Tin (shield) hearts. */
  tin?: number;
  /** Half hearts of Ember hearts (fire nova when one breaks). */
  ember?: number;
}

export interface PickupsEffect {
  type: 'pickups';
  coins?: number;
  bombs?: number;
  keys?: number;
  /** Active item charge units, or 'full'. */
  charge?: number | 'full';
  /** Physical pickups popped out next to the player / trigger position. */
  spawn?: readonly PickupSpawnSpec[];
  /** Roll this drop table and pop the result out. */
  table?: DropTableId;
}

export interface HookEffect {
  type: 'hook';
  hook: HookId;
  params?: Readonly<Record<string, number | string>>;
}

export type Effect =
  | StatEffect
  | ModEffect
  | CarrierEffect
  | FamiliarEffect
  | FlagEffect
  | TriggerEffect
  | HealEffect
  | HeartsEffect
  | PickupsEffect
  | HookEffect;

export type EffectType = Effect['type'];

// ── Items ────────────────────────────────────────────────────────────────────

export type ItemKind = 'passive' | 'active' | 'trinket' | 'consumable';
export type ItemQuality = 0 | 1 | 2 | 3 | 4;

export interface ActiveSpec {
  /** Charge needed: rooms cleared ('room') or seconds ('timed'). 0 = usable any time. */
  charge: number;
  chargeType: 'room' | 'timed';
  /** Executed on use (persistent effect types become temporary, see Effect). */
  use: readonly Effect[];
}

export type CostumeLayer = 'body' | 'cape' | 'eyes' | 'hat' | 'aura' | 'held';

/**
 * Overlay sprite layer drawn on the character (major items, set transformations). The sprite is
 * anchored like the character's (feet), offset by dx/dy.
 * - `frames: 'dir'` (default when the sprite has 3+ frames): frame 0 facing down, 1 up, 2 side (right;
 *   mirrored for left). A 1-frame sprite is used for every facing.
 * - `frames: 'anim'`: frames cycle at `fps` whatever the facing (auras, crackles).
 */
export interface CostumeDef {
  id: string;
  layer: CostumeLayer;
  sprite: SpriteDef;
  dx?: number;
  dy?: number;
  /** Drawn behind the character (capes, auras). */
  behind?: boolean;
  frames?: 'dir' | 'anim';
  /** Animation speed for `frames: 'anim'` (frames per second, default 8). */
  fps?: number;
  /** Additive glow under the layer: 'r,g,b'. */
  glow?: string;
  /** Occasional spark particles around the character in this colour. */
  sparks?: string;
  /** Additive blending for the layer itself (glowing eyes, auras). */
  additive?: boolean;
}

/** One costume or several layers (e.g. an aura + glowing eyes). */
export type CostumeSpec = CostumeDef | readonly CostumeDef[];

/**
 * Consumable flavours (ItemDef.consumable):
 * - 'tonic': a MYSTERY Tonic bottle. Each run shuffles which bottle colour holds which TonicDef
 *   (sim/tonics.ts); the bottle stays unidentified ('???' + its colour) until first drunk. Its own
 *   `use` list is only the shared "glug" (the effect comes from the shuffle).
 * - 'sticker': a named single-use card whose `use` list is its whole effect.
 */
export type ConsumableKind = 'tonic' | 'sticker';

/** A Mystery Tonic effect (content/items/consumables-tonics.ts), dealt to a bottle colour per run. */
export interface TonicDef {
  id: string;
  /** Shown once identified (e.g. 'Mending Tonic'). */
  name: string;
  /** ONE short line (≤ 46 chars, uppercase like item descriptions). */
  desc: string;
  /** Helps the player (false = a bad trip). */
  good: boolean;
  /** Executed when a bottle holding this effect is drunk (persistent types become temporary). */
  use: readonly Effect[];
}

const NO_COSTUMES: readonly CostumeDef[] = [];

/** A costume spec as a list of layers (allocates for a single def: callers cache the result). */
export function costumeList(c: CostumeSpec | undefined): readonly CostumeDef[] {
  if (!c) return NO_COSTUMES;
  return Array.isArray(c) ? (c as readonly CostumeDef[]) : [c as CostumeDef];
}

export interface ItemDef {
  id: ItemId;
  /** Shown on the pickup banner (uppercase font). Original names only. */
  name: string;
  /** ONE short line shown under the name. */
  desc: string;
  kind: ItemKind;
  quality: ItemQuality;
  pools: readonly PoolId[];
  tags: readonly string[];
  set?: SetId;
  /** Persistent while held; instants run once when a fresh copy is first picked up. */
  effects: readonly Effect[];
  /** kind 'active': charge + use effects. */
  active?: ActiveSpec;
  /** kind 'consumable': executed once when used. */
  use?: readonly Effect[];
  /** kind 'consumable': a Mystery Tonic bottle or a sticker (see ConsumableKind). */
  consumable?: ConsumableKind;
  /** 14×14 icon (a string is a placeholder reference until art exists). */
  sprite: SpriteDef | string;
  costume?: CostumeSpec;
  unlock?: AchievementId;
}

// ── Enemies & bosses ───────────────────────────────────────────────────────────

/**
 * Movement behaviours of the shared library (sim/enemies/behaviors/movement.ts). Each reads its
 * numeric params (with defaults and sane ranges declared next to its code) from `MoveSpec.params`.
 */
export const MOVE_KINDS = [
  'idle',
  'wander',
  'chase',
  'chasePath',
  'hop',
  'dash',
  'orbitPlayer',
  'keepDistance',
  'burrow',
  'teleport',
  'wallCrawl',
  'float',
  'turret',
  'bounce', // ext-a: sim/enemies/behaviors/ext-a.ts
  'lurk', // ext-a
  'intercept', // ext-b: sim/enemies/behaviors/ext-b.ts
  'swoop', // ext-b
  'ambush', // ext-b
] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

/** Attack behaviours (sim/enemies/behaviors/attacks.ts). `ringN` with count 8 is the classic ring of 8. */
export const ATTACK_KINDS = [
  'aimedShot',
  'cardinal4',
  'ringN',
  'spreadFan',
  'burst',
  'lob',
  'spawnMinion',
  'landShockwave',
  'leaveTrail',
  'spiral', // ext-a: sim/enemies/behaviors/ext-a.ts
  'stream', // ext-b: sim/enemies/behaviors/ext-b.ts
] as const;
export type AttackKind = (typeof ATTACK_KINDS)[number];

/** On-death effects (sim/enemies/behaviors/death.ts). */
export const DEATH_KINDS = ['explode', 'split', 'ringN'] as const;
export type DeathKind = (typeof DEATH_KINDS)[number];

/** Colour/shape variants of enemy projectiles (render/enemyRenderer.ts draws each). */
export const ENEMY_SHOT_STYLES = ['muck', 'water', 'dust', 'ink', 'ember', 'ice', 'charm'] as const;
export type EnemyShotStyle = (typeof ENEMY_SHOT_STYLES)[number];

/** Movement behaviour from the shared library (sim/enemies/behaviors), parameterised by data. */
export interface MoveSpec {
  kind: MoveKind;
  params?: Readonly<Record<string, number>>;
}

export interface AttackSpec {
  kind: AttackKind;
  /** Seconds between uses. */
  cooldown: number;
  /**
   * Numeric parameters. Shared by every attack: `windup` (telegraph s), `range` / `minRange` (px),
   * `on` (0 timer, 1 hop landing, 2 burrow emerge, 3 teleport appear, 4 dash bonk), `still` (1 = stop
   * moving during the wind-up), `first` (seconds before the first use). Per-kind params: see attacks.ts.
   */
  params?: Readonly<Record<string, number>>;
  /** spawnMinion: the enemy to spawn. */
  enemy?: EnemyId;
  /** Projectile look (defaults to the enemy's `shot`). */
  shot?: EnemyShotStyle;
}

export interface DeathSpec {
  kind: DeathKind;
  params?: Readonly<Record<string, number>>;
  /** split: spawn this enemy instead of shrunken copies of itself. */
  enemy?: EnemyId;
  shot?: EnemyShotStyle;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  /** Contact damage in half hearts. */
  contact: number;
  move: MoveSpec;
  attacks: readonly AttackSpec[];
  /** Needs `anims.idle` and `anims.move` (frame lists); optional `anims.windup` / `anims.air`. */
  sprite: SpriteDef | string;
  flying?: boolean;
  chapters: readonly ChapterId[];
  /** Spawn weight inside its chapters' pools (0 = never rolled, e.g. minions). */
  weight: number;
  championable: boolean;
  /** Bestiary blurb. */
  bestiary: string;
  drops?: DropTableId;
  /** Knockback impulses are divided by this (default 1). Turrets and wall crawlers ignore knockback. */
  mass?: number;
  /** Effects when it dies (explode, split into smaller copies, ring of shots). */
  onDeath?: readonly DeathSpec[];
  /** Ink / goo colours for hit and death bursts. */
  goo?: readonly string[];
  /** Default projectile look for its attacks. */
  shot?: EnemyShotStyle;
  /** Status duration multiplier (bosses resist: < 1; below 0.75 freeze only slows). Default 1. */
  resist?: number;
  /** Big enemies get a 1-2 frame hit-stop when they die (presentation). */
  big?: boolean;
}

/** Status effects on hittables (sim/enemies/status.ts). `knockback` is an impulse, not a timed status. */
export const STATUS_KINDS = ['poison', 'burn', 'freeze', 'slow', 'charm', 'fear', 'knockback'] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

/**
 * Champion variants (content/champions/*.ts): a rare roll on a championable enemy that changes its
 * numbers, adds a behaviour flag and a coloured outline, and drops extra loot.
 */
export interface ChampionDef {
  id: string;
  name: string;
  /** Outline / glow colour. */
  color: string;
  /** Relative weight among champions. */
  weight: number;
  hpMul?: number;
  speedMul?: number;
  /** Collision radius / sprite scale. */
  sizeMul?: number;
  /** Attack cooldown multiplier. */
  cooldownMul?: number;
  /** Splits into this many half-size copies on death. */
  split?: number;
  /** Ring of this many shots on death. */
  deathRing?: number;
  /** Regrows this fraction of max HP per second (after a short delay since the last hit). */
  regen?: number;
  /** Flickers: faded (intangible, harmless) part of the time. */
  phantom?: boolean;
  /** Coins dropped on death [min, max]. */
  coins?: readonly [number, number];
  /** Extra drop table rolled on death (besides the enemy's own). */
  drops?: DropTableId;
}

/**
 * Boss attack patterns (sim/bosses/patterns.ts): the big telegraphed moves a boss phase cycles through,
 * composed by data. Each kind declares its numeric params as `name: [default, min, max]` like the enemy
 * behaviours (validated by validateBossDef).
 */
export const BOSS_PATTERN_KINDS = [
  /** Telegraphed charge across the room (bonk on walls: shake, optional shot ring / debris). */
  'charge',
  /** Crouch → leap (landing marker) → slam: shockwave rings + optional shot ring. */
  'jumpSlam',
  /** Rings of shots, repeated (with spin: a stepped spiral). */
  'ring',
  /** A rotating stream of shots (arms, turn rate, duration). */
  'spiral',
  /** Walls of shots crossing the room with a gap to slip through. */
  'wave',
  /** Aimed fans in quick bursts. */
  'aimedBurst',
  /** Calls adds (spec.enemy). */
  'summon',
  /** A telegraphed damaging beam that sweeps an arc (rocks are cover). */
  'beamSweep',
  /** Digs in, tunnels toward the player (mound), rumbles, erupts. */
  'burrow',
  /** Fades out, blinks to a marked spot, attacks on reappearing. */
  'teleport',
  /** Slams a wall: debris (or lightning with `bolt`) rains on marked spots. */
  'debrisRain',
  /** Splits into smaller parts sharing the fight's health (usually a phase `enter`). */
  'split',
  /** Orbiting shield orbs that soak up shots (spec.enemy, default 'bubble-ward'). */
  'shields',
  /** Lobbed globs that leave hazard puddles (muck, water, fire…). */
  'hazard',
  /** Runs a named boss hook (registerBossHook) — per-boss code. */
  'hook',
  'dropLine', 'halo', 'ricochet', // boss pack C: sim/bosses/patterns-c.ts
] as const;
export type BossPatternKind = (typeof BOSS_PATTERN_KINDS)[number];

export interface BossPatternSpec {
  kind: BossPatternKind;
  /** Numeric params (see the kind's ParamSpec in sim/bosses/patterns.ts). */
  params?: Readonly<Record<string, number>>;
  /** summon / shields: the enemy to call. */
  enemy?: EnemyId;
  /** hook: the registered boss hook name. */
  hook?: string;
  /** Projectile look (default: the boss's `shot`). */
  shot?: EnemyShotStyle;
  /** Pick weight in 'random' order (default 1). */
  weight?: number;
}

export interface PhaseSpec {
  /** The phase starts when the fight's HP falls to this fraction (1 for the first phase). */
  at: number;
  name?: string;
  /** Baseline movement between patterns (the enemy movement library). */
  move: MoveSpec;
  /** Enemy-library attacks that run on their own timers between patterns (may be empty). */
  attacks: readonly AttackSpec[];
  speedMul?: number;
  summon?: { enemy: EnemyId; count: number; cooldown: number };
  /** Boss patterns of this phase (sim/bosses/patterns), used in `order`. */
  patterns?: readonly BossPatternSpec[];
  /** 'cycle' (default: in order) or 'random' (seeded, weighted, never the same twice in a row). */
  order?: 'cycle' | 'random';
  /** Seconds of baseline movement between two patterns [min, max] (default [1, 1.6]). */
  rest?: readonly [number, number];
  /** A pattern run once when the phase begins, right after the roar (split, shields, summon…). */
  enter?: BossPatternSpec;
  /** Colour shift of this phase: the sprite is washed toward this #rrggbb (render). */
  tint?: string;
  /** Speed-up of this phase: rests / telegraphs ÷ pace, shot speeds × √pace (default 1). */
  pace?: number;
}

export interface BossDef {
  id: BossId;
  name: string;
  kind: 'boss' | 'miniboss' | 'final';
  chapters: readonly ChapterId[];
  hp: number;
  /** At least 2 phases. */
  phases: readonly PhaseSpec[];
  /** 32-56 px, anims `idle` + `move` (optional `windup`, `air`, `slam`, `roar`, `hurt`). */
  sprite: SpriteDef | string;
  /** Collision radius / visual size, px. */
  size: number;
  /** Music track id (music registry). */
  music?: string;
  drops?: DropTableId;
  /** Baseline walking speed, px/s (× phase speedMul; default 30). */
  speed?: number;
  /** Contact damage in half hearts (default 1). */
  contact?: number;
  /** Knockback mass (default 6; minibosses 3). */
  mass?: number;
  /** Status duration multiplier (default 0.5; minibosses 0.65; below 0.75 freeze only slows). */
  resist?: number;
  /** Crosses pits and rocks. */
  flying?: boolean;
  /** Default projectile look. */
  shot?: EnemyShotStyle;
  /** Hit / death burst colours. */
  goo?: readonly string[];
  /** Intro card line under the name (default: the chapter's name). */
  title?: string;
  /** Final bosses: which final this is (floor 12 main / 12 alt / 13) and the ending it gives (1-3). */
  final?: 'thunderhead' | 'nestmother' | 'undertow';
  ending?: number;
  /** Pick weight in its chapter's pool (default 1). */
  weight?: number;
  /** Bestiary blurb. */
  bestiary?: string;
  /** Named boss hook (registerBossHook) with per-boss code (tick / phase start). */
  hook?: string;
}

// ── Characters ───────────────────────────────────────────────────────────────

/** Starting health, half hearts. */
export interface HeartSpec {
  redMax: number;
  /** Starting red (defaults to redMax). */
  red?: number;
  tin?: number;
  ember?: number;
}

export interface StartPickups {
  coins: number;
  bombs: number;
  keys: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  desc: string;
  stats: Stats;
  hearts: HeartSpec;
  startItems: readonly ItemId[];
  startPickups: StartPickups;
  sprite: SpriteDef;
  /** Base shot colour (ShotStyle, ARCHITECTURE §4.6); default candle-gold. */
  shotColor?: string;
  /** Hook id of the character's unique mechanic (registered in src/content/hooks). */
  mechanic: HookId;
  /** The mechanic in one or two short lines for the character select (Phase 4B), e.g. 'LUCKY MARBLE: ...'. */
  mechanicDesc?: string;
  unlock?: AchievementId;
}

// ── Chapters ─────────────────────────────────────────────────────────────────

export type Track = 'main' | 'alt';
export type CurseId = 'darkness' | 'lostMap' | 'maze' | 'blind' | 'unknown' | 'deluge';

export interface ChapterDef {
  id: ChapterId;
  name: string;
  /** The two floor numbers (1-12). */
  floors: readonly [number, number];
  track: Track;
  /**
   * Tile colours (hex). Every key of CHAPTER_PALETTE_KEYS is required (content validation checks it):
   * the room renderer recolours the tileset with them.
   */
  palette: Readonly<Record<string, string>>;
  /**
   * `'<floor pattern>/<wall pattern>'` from content/sprites/tilesets.ts, e.g. 'flagstone/brick',
   * 'checker/panel', 'hex/paper'.
   */
  tileset: string;
  enemyPool: readonly EnemyId[];
  bossPool: readonly BossId[];
  minibossPool: readonly BossId[];
  /** Music track id (music registry). */
  music: string;
  curses?: readonly CurseId[];
  /** Chapter-specific decoration (floor decals, wall trims, ambience). */
  decor?: ChapterDecor;
}

/** Palette keys every ChapterDef.palette must define (the tileset recolour reads them). */
export const CHAPTER_PALETTE_KEYS = [
  'floor',
  'floorLight',
  'floorDark',
  'mortar',
  'deep',
  'brick',
  'brickShade',
  'brickLight',
  'moss',
  'mossLight',
  'stone',
  'stoneLight',
  'stoneShade',
  'void',
  'voidSpeck',
  'water',
  'waterLight',
  'leaf',
  'leafLight',
] as const;

/** Ambient particles a chapter's rooms show (render/worldFx). */
export type ChapterAmbience = 'none' | 'drips' | 'spores' | 'embers' | 'snow' | 'motes' | 'wind';

export interface ChapterDecor {
  /** Small floor decals scattered on plain floor (any size up to 16×16). */
  floor: readonly SpriteDef[];
  /** Trims hung along the top wall (up to 16 px wide, drawn from the wall's bottom edge up). */
  wall?: readonly SpriteDef[];
  /** Decal count range per room (default [4, 8]). */
  count?: readonly [number, number];
  /** Streaks running down the top wall ('' = none), hex colour. */
  streak?: string;
  ambience?: ChapterAmbience;
}

// ── Synergies, sets, familiars, achievements ─────────────────────────────────

/** An item id, or "at least `count` (default 1) DISTINCT held items with this tag". */
export type Requirement = ItemId | { tag: string; count?: number };

/**
 * A special synergy (ARCHITECTURE §4.7, sim/effects.ts): active while every requirement holds (re-checked
 * on every inventory change, so it switches off when an item is lost). While active its persistent effects
 * join the loadout (source = the synergy id) and `style` tints the shots. The first time it switches on in
 * a run: a 'synergy' event (the SYNERGY: NAME banner), its instant effects and `hook` run once.
 */
export interface SynergyDef {
  id: SynergyId;
  name: string;
  requires: readonly Requirement[];
  effects: readonly Effect[];
  style?: StyleOverride;
  hook?: HookId;
}

/**
 * Transformation (sim/effects.ts): holding `need` DISTINCT items whose `set` is this id transforms the
 * player for the rest of the run (kept even if a set item is lost later; saved with the run): a
 * 'transform' event (fanfare + big banner), the costume layers (they replace item layers of the same
 * layer slot), persistent `effects` as a loadout source (source = the set id), `style` on the shots.
 * Instant effects (hearts, heal, pickups, hook effects) and `hook` run once, at the transformation.
 */
export interface ItemSetDef {
  id: SetId;
  name: string;
  desc: string;
  /** Distinct items needed (default design: 3). */
  need: number;
  effects: readonly Effect[];
  costume?: CostumeSpec;
  hook?: HookId;
  /** Look of the player's shots while transformed (like SynergyDef.style). */
  style?: StyleOverride;
}

/**
 * Familiar movement (sim/attack/familiars.ts):
 * - follow: joins the follower chain trailing the player (spaced along her recent path);
 * - hover: like follow, bobbing a little higher (render);
 * - orbit: circles the player, blocks enemy shots it touches;
 * - guard: orbits closer and slower, blocks enemy shots;
 * - chase: runs at the nearest enemy (contact damage), returns to the player when there is none.
 */
export type FamiliarBehavior = 'follow' | 'orbit' | 'guard' | 'chase' | 'hover';

export interface FamiliarDef {
  id: FamiliarId;
  name: string;
  desc: string;
  /** Needs 1+ frames (2 frames = idle bob animation); anchored at the feet. */
  sprite: SpriteDef | string;
  behavior: FamiliarBehavior;
  radius: number;
  /**
   * Scale of the player's AttackProfile when it fires (0 = never fires; ~0.35-0.5 typical). Shooters
   * fire through fireVolley with the player's profile, so they inherit every carrier and modifier.
   */
  attackScale: number;
  /** Fire-rate multiplier vs the player's (default 1). */
  fireRateMul?: number;
  /** Damage per touch to enemies (every 0.3 s per target). */
  contactDamage?: number;
  /** Movement speed, px/s (default 110). */
  speed?: number;
  /** Destroys hostile enemy shots it touches (orbit / guard default true). */
  blocks?: boolean;
  /** Glow colour 'r,g,b' (render). */
  glow?: string;
}

/**
 * Things that happen in a run that an achievement can wait for (reported by the meta tracker,
 * src/meta/tracker.ts). Each carries an `id` and a `value` the condition may filter on:
 */
export const ACHIEVEMENT_EVENTS = [
  /** An enemy died: id = enemy id. */
  'enemyKilled',
  /** A boss fight was won: id = boss id; value = 0 boss, 1 miniboss, 2 final boss. */
  'bossKilled',
  /** An item was picked up fresh: id = item id; value = items held afterwards. */
  'itemCollected',
  /** Items held at once (passives incl. duplicates + the active + trinkets): value. */
  'itemsHeld',
  /** Familiars at once: value. */
  'familiars',
  /** Coins held at once: value. */
  'coinsHeld',
  /** A floor began: value = floor number; id = chapter id. */
  'floorReached',
  /** A chapter began: value = chapter number (1-6); id = chapter id. */
  'chapterReached',
  /** A floor was finished (its exit taken, or the run won there) without taking damage: value = floor. */
  'noDamageFloor',
  /** A run was won with an ending: value = the ending (1 Clear Skies, 2 The Quiet Hive, 3 What the Rain Kept). */
  'endingReached',
  /** A run was won: id = character id; value = the ending. */
  'characterWin',
  /** The player transformed: id = set id. */
  'transformation',
  /** A special synergy switched on for the first time in a run: id = synergy id. */
  'synergy',
  /** A secret wall was blasted open: value = 0 secret room, 1 deep secret. */
  'secretFound',
  /** A chest opened: id = 'satchel' | 'lockbox'. */
  'chestOpened',
  /** The player died: value = floor. */
  'death',
] as const;
export type AchievementEvent = (typeof ACHIEVEMENT_EVENTS)[number];

/**
 * A lifetime counter reached `atLeast`. `counter` is a stat (runs, wins, deaths, kills, bossKills,
 * itemsCollected, floorsCleared, playTimeSec, bestFloor, winStreak, bestWinStreak), a meta counter id
 * (chestsOpened, secretsFound, activesUsed… — any id the tracker bumps, src/meta/metaState.ts COUNTER_IDS),
 * or a keyed count: 'killed.<enemy or boss id>', 'collected.<item id>', 'charWins.<character id>',
 * 'charRuns.<character id>', 'achievements' (earned so far), 'discovered' (items seen).
 */
export interface AchievementCounterCondition {
  kind?: 'counter';
  counter: string;
  atLeast: number;
}

/** An event happened (optionally only with this id, this exact value, or at least this value). */
export interface AchievementEventCondition {
  kind: 'event';
  event: AchievementEvent;
  id?: string;
  /** The event's value must equal this (e.g. ending 2). */
  value?: number;
  /** The event's value must be at least this (e.g. 10 items held). */
  atLeast?: number;
}

export type AchievementCondition = AchievementCounterCondition | AchievementEventCondition;

/**
 * An achievement's reward (the meta unlock sets, src/meta/metaState.ts): 'item' → items, 'character' →
 * characters, 'route' → routes, 'ending' → endings ('ending1' opens the alt route into chapter 6;
 * 'ending1' + 'ending2' open the whirlpool to floor 13), 'challenge' → challenges; 'chapter' / 'feature'
 * are kept for later menus. Items / characters whose `unlock` names the achievement are unlocked by it too.
 */
export interface UnlockRef {
  kind: 'item' | 'character' | 'route' | 'ending' | 'challenge' | 'chapter' | 'feature';
  id: string;
}

export interface AchievementDef {
  id: AchievementId;
  name: string;
  desc: string;
  /** Not listed (name and description) until earned. */
  hidden?: boolean;
  condition: AchievementCondition;
  unlocks: readonly UnlockRef[];
}
