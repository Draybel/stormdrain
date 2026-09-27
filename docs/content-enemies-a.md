# Enemy content A — chapters 1 alt to 3

23 original enemies for The Drowned Nursery, The Rootcellar, The Candlewick Crypt, The Grinding Works and
The Rust Foundry (21 chapter enemies plus 2 that roam several chapters), and three behaviours they needed
that the Phase 2C library did not have.

Files:

- `src/content/enemies/{drowned_nursery,rootcellar,candlewick_crypt,grinding_works,rust_foundry}.ts` hold
  the defs. The cross-chapter Dust Bunny and Lost Balloon live in `drowned_nursery.ts`, their first chapter.
- `src/content/sprites/enemiesA{Nursery,Root,Crypt,Works,Foundry}.ts` hold the pixel art.
- `src/sim/enemies/behaviors/ext-a.ts` has the `bounce` and `lurk` moves and the `spiral` attack.
- `tests/content-enemies-a.test.ts` tests all of the above.

## Roster

Chapter pools are the union rule (`enemiesInChapter`): every enemy that lists the chapter, so nothing was
added to the chapter files.

| Chapter (floors) | Enemy | Movement | Attacks / on death |
|---|---|---|---|
| Drowned Nursery (1-2) | Bathtub Paddler | `bounce` diagonal | aimed squirt after a ricochet (`on: 4`) |
| | Lullaby Box | `turret` | `spiral`: 2 arms × 8 slow notes |
| | Puddle Poppet | `teleport` | 3 drips as it reappears (`on: 3`) |
| | Sprung Jack | `lurk` (a shut toy box) | 5-fan as it springs out (`on: 3`), then aimed spit |
| Rootcellar (3-4) | Creeping Taproot | `wallCrawl` | burst of 3 thorny seeds |
| | Brine Jar | `wander` | 2 brine lobs that pool; breaks into 2 Gherklings |
| | Gherkling | `hop` (quick) | contact only (also a rare pool pick) |
| | Grumblemole | `burrow` | dirt ring on surfacing + 3 clods |
| | Radish Rammer | `dash` (aimed) | clod fan when it bonks a wall |
| Candlewick Crypt (3-4) | Dusk Moth | `orbitPlayer` (flying) | burst of 3 dust puffs |
| | Tallow Trudger | `chase` | hot wax trail + a flicked spark |
| | Grim Candelabra | `turret` | 3-flame fan + a turning ring of 6 |
| | Waxwraith | `float` | a wax lob that pools |
| Grinding Works (5-6) | Runaway Cog | `bounce` diagonal, contact 1 heart | 4-way sparks off every wall |
| | Whistling Kettle | `keepDistance` | fan of 5 steam puffs that slow and fade |
| | Tick-Tock Mouse | `dash` (fast) | ring of 6 bolts on bonk |
| | Mad Cuckoo | `turret` | 4-shot burst + a turning ring of 8 |
| Rust Foundry (5-6) | Slag Blob | `hop` | 4 sparks on landing; splits in two |
| | Potbelly | `chasePath`, contact 1 heart | fan of 5 cinders + a coal lob that bursts into 5 |
| | Slag Crucible | `turret` | `spiral`: 3 arms × 8 + 3 molten lobs that pool |
| | Clinker | `lurk` (a coal lump) | ring of 8 as it flares up, then a hot-coal trail |
| Nursery, Rootcellar, Crypt | Dust Bunny | `keepDistance` | aimed ring of 6 slowing dust; splits in two |
| Nursery, Works, Foundry | Lost Balloon | `float` | pops into a ring of 8 droplets |

Inside each chapter, every enemy has its own movement kind and its own move + attack + death signature
(a test enforces this). HP rises with depth: the chapter 1 average is 18, chapter 2 is 25 and chapter 3 is 39.
Chapter 1 hits for half a heart only. Chapter 3 has the full-heart bruisers (Runaway Cog, Potbelly) and the
densest volleys, up to 24 shots from one Slag Crucible spiral.

Balance probe: a scratch bot, not committed, kited, aimed and dodged shots, puddles and lob markers. It got
depth-appropriate stat items (none / +1 damage and +0.75 fire rate / twice that) and fought 16 waves of 5 per
chapter. Every new chapter cost it about as much health per wave as the Gutterways baseline:

| Chapter | Half hearts lost per wave |
|---|---|
| Gutterways (baseline) | 4.2 |
| Drowned Nursery | 3.4 |
| Rootcellar | 4.4 |
| Candlewick Crypt | 4.1 |
| Grinding Works | 4.1 |
| Rust Foundry | 4.3 |

Enemy shots per wave rose with depth, from 52 in the Gutterways to about 210 in chapter 3.

## New behaviours (`ext-a.ts`)

Each was added with a one-line edit to `MOVE_KINDS` / `ATTACK_KINDS` in `src/sim/types.ts`, plus one import
line and one map line each in `movement.ts` / `attacks.ts`. `ext-a.ts` imports neither of those files, so
there is no import cycle.

### `bounce` (move)

It moves in straight lines and snaps its velocity, so ricochets are crisp.

| Param | Default | Meaning |
|---|---|---|
| `axis` | 0 | 0 = diagonal headings, snapped to the four diagonals after every ricochet. 1 = horizontal patrol, 2 = vertical patrol. |
| `seek` | 0.3 | Chance that a diagonal ricochet heads toward the target, if that direction still leads away from the wall. |
| `pause` | 0 | Seconds it stops and re-winds after each ricochet. The pause is telegraphed with an `enemyWindup` event. |

- **Ricochet trigger:** last tick's grid collision pushed against the heading (the same test as the dash bonk).
  Rocks and pits count as walls for walkers.
- **Attacks:** every ricochet fires the enemy's `on: 4` (ON_BONK) attacks.
- **Getting unstuck:** when something that isn't the grid wedges it (a pedestal, a crowd), it turns around
  after 0.4 s.

### `lurk` (move, `handlesFear`)

It plays dead, and looks like part of the room, until its target comes within `wake` px (default 48) or it is
hit. Then it rouses for `rouse` s (default 0.5; telegraph plus `enemyWindup`) and chases: around obstacles on
the shared flow field with `path` 1 (the default), straight at the target with 0.

- **Attacks while dormant:** timer attacks (`on: 0`, including passive trails) are held.
- **Waking:** the `on: 3` (ON_APPEAR) attacks fire the moment it wakes, after the telegraph. Timer attacks
  start a beat later.
- **Sprites:** the idle animation is the disguise, windup is the waking pose and move is the awake creature.
- **Fear:** a frightened lurker flees once awake and stays still while dormant.

### `spiral` (attack; shot params like every shooter)

A stream of `count` shots per arm (default 10), `interval` s apart (default 0.1), with `arms` evenly spaced
streams (default 1).

| Mode | How the stream turns |
|---|---|
| `aim` 0 (default) | At `spin` °/s (default 150; negative turns anticlockwise). The angle comes from sim time plus a per-enemy offset, so no state is stored and neighbours don't sync. |
| `aim` 1 | Sweeps `sweep`° (default 90) across the target like a hose. |

It runs on the burst machinery (`burstLeft` / `burstT` / `burstA`), so it pauses the enemy's other timer
attacks while it streams and stops when the enemy is frozen, afraid or underground.

## Notes for the shared docs (not edited here)

- **ARCHITECTURE.md §3 "Enemies":**
  - Add `bounce` and `lurk` to the movement kinds.
  - Add `spiral` to the attacks.
  - Note that `on` 3 also means "lurker wakes" and `on` 4 also means "bouncer ricochets".
- **ARCHITECTURE.md §5:** `MOVE_KINDS` / `ATTACK_KINDS` grew. No shapes changed.
- **Sprites:** the Runaway Cog's four spin frames are made by a tiny rasteriser that runs once at module load
  (`gearRows` + `stamp` in `enemiesAWorks.ts`). They are still plain pixel rows that `validateSpriteDef`
  checks.
