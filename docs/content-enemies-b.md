# Chapters 4-6 enemies (content track B)

22 rolled enemies (+ 1 minion) for the second half of the run, and the four behaviours they added to the
shared library. Everything is data (`EnemyDef`, ARCHITECTURE §5) composed from `sim/enemies/behaviors`.

| File | Contents |
|---|---|
| `src/content/enemies/{mushroom_hollow, glimmer_grotto, bone_orchard, frostbitten_vault, eye_of_storm, hollow_nest}.ts` | the defs, one file per chapter |
| `src/content/sprites/enemiesB{Mushroom, Grotto, Orchard, Vault, Storm, Nest}.ts` | pixel art (idle / move, windup, air) |
| `src/sim/enemies/behaviors/ext-b.ts` | `intercept`, `swoop`, `ambush` (movement) and `stream` (attack) |
| `tests/content-enemies-b.test.ts` | validation, 10 s room runs, chapter waves, density, behaviour tests |

Registration of the extension is one line in each list: `MOVE_KINDS` / `ATTACK_KINDS` (`sim/types.ts`) and
`...EXT_B_MOVES` / `...EXT_B_ATTACKS` at the end of `MOVES` (`movement.ts`) / `ATTACKS` (`attacks.ts`).
Pools follow the registry's union rule: every enemy lists its chapter in `chapters`; the chapter stubs' explicit
`enemyPool`s stay empty.

## Roster

HP, speed (px/s), contact (half hearts). Every timer attack has a ≥ 0.25 s wind-up (flash + windup frame);
event attacks fire on a telegraphed event (hop landing, surfacing, teleport arrival, dash bonk / dive end).

### The Mushroom Hollow (ch. 4 main, floors 7-8) — spores, glowcaps, beetles
| Enemy | HP | Move | Attacks |
|---|---|---|---|
| Puffcap | 18 | `hop` | ring of 6 slow, fizzling spores on every landing; 5-spore ring on death |
| Glowcap | 26 | `burrow` (rumbling glow) | aimed ring of 8 on surfacing; aimed pair while up |
| Mossback Beetle | 34 | `dash` (aimed, bonks walls) | 5-shot fan at you when it bonks |
| Morelob | 24 | `keepDistance` | 2 spore lobs that leave stinging creep |

### The Glimmer Grotto (ch. 4 alt, floors 7-8) — crystals, echo bats
| Enemy | HP | Move | Attacks |
|---|---|---|---|
| Echo Bat | 16 | `float` (flying) | screech = ground ring (`landShockwave`, 60 px); 3-pellet fan |
| Quartz Creeper | 26 | `wallCrawl` | 4-shot quartz burst |
| Geode Tumbler | 38 | `chase` (heavy) | 4-shot gravel fan; splits into 3 Glint Mites |
| Glint Mite (minion) | 7 | `chasePath`, fast | — (weight 0: only from a Geode Tumbler) |

### The Bone Orchard (ch. 5 main, floors 9-10) — bone trees, crows, lanterns
| Enemy | HP | Move | Attacks |
|---|---|---|---|
| Gravecaw | 28 | `dash`, flying (dive-bombs over pits, bonks walls) | 3-feather fan (not point-blank) |
| Bonebark | 60 | `turret` | 3 crab-apple lobs that burst into 6 seeds each; turning 10-ring up close |
| Gloam Lantern | 30 | `teleport` (flying look) | aimed ring of 8 embers on arrival; leading ember |
| Rattlebones | 30 | `chasePath` | leading bone throw; comes back once at 80 % size (`split` ×1) |

### The Frostbitten Vault (ch. 5 alt, floors 9-10) — ice, frozen treasure
| Enemy | HP | Move | Attacks |
|---|---|---|---|
| Rimechest | 64 | `ambush` (a shut chest until you come within 64 px or shoot it) | 5 icy coins; bites for a full heart; always drops a pickup (`champion` table) |
| Slushpup | 40 | `dash` (belly-slides) | slush creep trail; ring of 6 ice on bonk |
| Rime Wraith | 38 | `orbitPlayer` (flying) | 4 shards that start slow and accelerate; slow, turning 10-ring |

### The Eye of the Storm (ch. 6 main, floors 11-12) — clouds, lightning, wind
| Enemy | HP | Move | Attacks |
|---|---|---|---|
| Grumblecloud | 46 | `float` (flying) | 3 bolt lobs that burst into 4 on landing; 5-drop fan |
| Staticling | 32 | `teleport` every ~1.8 s | ring of 12 on arrival (turns 15° per ring); fast zap triplets |
| Whirligust | 42 | `orbitPlayer` (flying) | `stream`: 2-armed spiral, 14 steps × 26° (28 leaves), turning 40° per stream |
| Stormkite | 38 | `swoop` (flying) | 5-shot fan as each dive ends; zap pairs |

### The Hollow Nest (ch. 6 alt, floors 11-12) — wasp paper, amber, larvae
| Enemy | HP | Move | Attacks |
|---|---|---|---|
| Papercut | 30 | `intercept`, flying, fast | leading stinger pairs (135 px/s) |
| Ambertomb | 80 | slow `wander` (heavy, big) | turning 12-ring; 2 resin lobs (a full heart) leaving creep; bites for a heart |
| Brood Comb | 56 | `turret` | hatches Grublings (≤ 3 alive); `stream` sweep of 9 paper scraps centred on you |
| Grubling | 14 | `burrow` | ring of 6 on surfacing (also rolled on its own, weight 5) |

Difficulty (enforced by the tests): mean HP and mean shots per volley rise tier by tier (floors 7-8 → 9-10 →
11-12); tier 1 averages over 1.5× the Gutterways' HP. A headless bot with no items (6 runs × 30 s, 5 enemies)
saw ≈ 290 / 70 enemy shots per run in chapter 4 (main / alt), ≈ 290 / 400 in chapter 5 and ≈ 820 / 520 in
chapter 6, against ≈ 60 in the Gutterways.

## Behaviour extension (`ext-b.ts`)

State lives in the enemy's `mode / modeT / m0..m3` (`intercept`: m0 / m1 line-of-sight cache, m2 weave phase;
`swoop`: m0 orbit angle, m1 direction, m2 angle set, m3 dive distance left; `ambush`: m0 / m1 line-of-sight cache).
`stream` uses the burst machinery (`burstLeft / burstT / burstA`) and no scratch slots, so it combines with any
movement.

- **`intercept`** — heads for the target's position + her velocity × `lead` s (never more than its own travel
  time to her), weaving across the approach (`weave`, `freq`; fades out within 40 px so it still connects).
  Walkers go straight when the line to that point is clear (checked every 0.12 s), otherwise follow the room's
  shared flow field (like `chasePath`); flyers go straight. Params `lead [0.7, 0, 2]`, `weave [0.35, 0, 1.5]`,
  `freq [1.2, 0.1, 4]`, `recalc [10, 2, 60]`. Fear: the generic flee.
- **`swoop`** (flying) — circles the target at `radius` (`spin` rad/s, flips on walls) for `every` s (±25 %),
  hovers for `windup` s (telegraph + 'enemyWindup', keeps facing her), then locks its heading at her CURRENT
  spot and dives at `diveSpeed` through it and `over` px beyond ('enemyDash'); a wall ends the dive early. Dive
  end: ON_BONK attacks fire (`on: 4`), then it circles again from where it is. Params `radius [60, 20, 120]`,
  `spin [1.5, 0.2, 5]`, `every [2.2, 0.5, 8]`, `windup [0.45, 0.1, 2]`, `diveSpeed [200, 60, 360]`,
  `over [40, 0, 140]`, `dir [0, -1, 1]` (0 = random).
- **`ambush`** — dormant (no movement; its attack clocks are held at ≥ 0.5 s, so it can't shoot while asleep or in
  the first 0.5 s awake) until the target is within `wake` px, it is hurt, or `patience` s have passed (0 = never);
  then a `rouse` s telegraph ('enemyWindup'; the sprite's `windup` frames), then it hunts like `chasePath`.
  Frightened while awake it flees; asleep it keeps playing dead. Params `wake [44, 8, 160]`, `rouse [0.55, 0.1, 2]`,
  `patience [0, 0, 30]`, `recalc [10, 2, 60]`. Sprites of lurkers: `idle` = the disguise, `windup` = waking,
  `move` = awake.
- **`stream`** (attack) — `count` steps `interval` s apart; each step fires one shot per arm (`arms`, evenly
  spaced) and turns `turn`° from the last. `aim: 1` centres the sweep on the target (re-aimed every step, so the
  first step is at −turn·(count−1)/2); `spin` turns the whole pattern per stream. All shot params apply
  (`speed, dmg, size, accel, curve, phase, life`). Frozen / feared / underground cancels the rest of the stream,
  like `burst`. Params `count [12, 2, 32]`, `interval [0.08, 0.03, 0.5]`, `turn [15, -60, 60]`, `arms [1, 1, 4]`,
  `aim [0, 0, 1]`, `spin [0, -90, 90]`.

## Notes for integration
- Chapter palettes / tilesets are still the Gutterways placeholders; the sprites were checked on the chapter 1
  floor colour and in the running dev build (training yard, spawned through `__SD.sim`) and read well there.
- Shot styles are the existing seven; `charm` is avoided for hostile shots (the renderer draws allied shots in it).
- Bonebark (radius 8) and Ambertomb (`big`) get the big-kill hit-stop.
