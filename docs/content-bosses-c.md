# Boss pack C — chapters 5-6

Six bosses and three minibosses for the deepest chapters, three new boss pattern kinds, and a per-boss hook
that gives every one of them a new look in its later phase(s). Everything is original (names, text, art).

## Files

| File | What |
|---|---|
| `src/content/bosses/bone_orchard.ts` | Marrowbough, The Gloamkeeper (chapter 5 main, floors 9-10) |
| `src/content/bosses/frostbitten_vault.ts` | Hoarquill, The Vaultwarden (chapter 5 alt, floors 9-10) |
| `src/content/bosses/eye_of_storm.ts` | Squallvane (chapter 6 main, the floor-11 boss; floor 12 is Old Thunderhead) |
| `src/content/bosses/hollow_nest.ts` | Ambergut (chapter 6 alt, the floor-11 boss; floor 12 is The Nestmother) |
| `src/content/bosses/minibosses-c.ts` | Tatterjack, Shiverwing, Slagjacket |
| `src/content/sprites/bossesC*.ts` | the art (`bossesCPaint.ts`: thick strokes, curves, cracks, polygons, shear, `bossSprite`) |
| `src/content/hooks/bosses-c.ts` | `phaseLook` hooks: later-phase sprites, wings, depth pace |
| `src/sim/bosses/patterns-c.ts` | pattern kinds `dropLine`, `halo`, `ricochet` |
| `tests/content-bosses-c.test.ts` | validation, looks, selection, depth, the new kinds, god-mode fights |

Shared files touched (one line each, additive): `src/sim/types.ts` (`'dropLine', 'halo', 'ricochet'` at the end of
`BOSS_PATTERN_KINDS`) and `src/sim/bosses/patterns.ts` (`import { PATTERNS_C }` + `...PATTERNS_C` at the end of
`PATTERNS`).

## The fights

HP: a Gutterways boss borrowed on floor 9 would have ≈ 2 × its 260-300 (`bossHpFor`), so chapter-5 bosses have
500-560 and the floor-11 bosses 640-660 (three phases). Headless god-mode fights with Wren's base shots take
60-100 s (bosses) and 18-35 s (minibosses). A strafing, non-dodging bot is hit 16-22 times a minute in chapter 5
and 23-24 in chapter 6 (Gutterways 11-16, the placeholder finals 13-25): harder the deeper, still readable.
Every phase has 3-5 patterns, and every later phase adds a colour wash (`tint`), a speed-up (`pace` 1.2-1.3), an
entrance (`enter`: shields, adds, puddles, a strike storm) and a new sprite.

| Boss | Phase 1 | Later phase(s) |
|---|---|---|
| **Marrowbough** — the bone tree the orchard grew from (52×56) | *Rooted*: bone-apples lobbed in three fanned lines (`dropLine`), stepped bone rings, Gravecaws off its limbs, a rain of apples | *Withered* (50 %): cracks of glowing marrow, a burning ribcage; three Gloam Lanterns swing round it (shields that shoot), a two-ring halo of bone shards, a cross of apples on you, it uproots and stomps (`jumpSlam`), a reversing spiral |
| **The Gloamkeeper** — the hooded lamplighter (40×54, flies) | *Lit*: blinks with an ember ring, embers that circle then converge (`halo` aim 1), a sweep of lantern light, aimed bursts | *Guttering* (50 %): the lantern cracks and a green flame gets loose; lost lanterns join, triple blinks, burning oil in an X (`dropLine` X + creep), twin light sweeps, a spiral, a halo flung as one ring (`halo` aim 2: stand in its hole) |
| **Hoarquill** — a frost hedgehog wearing the vault's coins (48×40) | *Bristling*: curls up and ricochets (`ricochet`, quills at every bounce), a bristling quill halo, wide fans, rings that speed up | *Shedding* (50 %): quills snapped, coins falling, red eyes; slush puddles, longer rolls that lean toward you, a four-arm spiral, converging halos, Slushpups, icicles shaken down |
| **The Vaultwarden** — frozen armour with a key for a sword (40×54) | *On Duty*: shield bashes with a ring on the bonk, key slams raising lines of ice (`dropLine` debris), frost walls with a gap, a frost beam | *Cracked Plate* (50 %): the helm splits and light spills out; Rime Wraiths, triple bashes with falling ice, a cross of ice on you, a formation halo, twin beams |
| **Squallvane** — the iron rooster weathervane (48×56, flies) | *Gusting*: a four-arm spiral, walls of leaves, lightning chains striking toward you (`dropLine` bolts), rusty flak | *Struck* (65 %): white-hot and crackling; a strike storm, twin lightning sweeps, a cross of strikes on you, a spark halo, a reversing five-arm spiral. *Unmoored* (25 %): the rod snaps, it tumbles round the room (`ricochet`), Staticlings, strikes everywhere, an X of lightning, a fast spiral, wide twin sweeps |
| **Ambergut** — the queen's hungriest grub (52×36) | *Gorging*: tunnels and erupts (ring + shockwave), sticky amber, spit fans, Grublings | *Pupating* (60 %, a 40×48 paper cocoon, still): two Papercuts circle it, two-ring halos, a reversing spiral, lines of amber drips, stepped rings. *Hatched* (25 %, a 48×44 scruffy wasp, **flies**): stinger dives, a four-arm spiral, aimed bursts, an X of amber, Papercuts |

| Miniboss | Chapters (home first) | Phase 1 | Phase 2 |
|---|---|---|---|
| **Tatterjack** — a scarecrow hopping on its pole (30×34) | Bone Orchard, Eye of the Storm | every hop sends a small shockwave; stomps, straw fans, a crow | *Unstuffed*: double stomps, a spinning straw spiral, converging straw halos, two crows |
| **Shiverwing** — a frost bat with crystal wings (36×26, flies) | Glimmer Grotto, Frostbitten Vault | a screech ring to step over, swoops, rings that speed up, Echo Bats | *Shattering*: pink cracked crystals, a torn wing; a crystal halo, falling shards, triple swoops, stepped rings |
| **Slagjacket** — an iron-and-slag yellowjacket (32×28, flies) | Rust Foundry, Hollow Nest | stinger dives, slag drips, spark bursts | *Overheated*: plates gone, a white-hot core; triple dives with sparks, a spiral, a line of burning slag toward you |

Bosses use `music: 'boss_undercurrent'` (the chapter 5-6 theme) and the `bossSpill` drop table; minibosses use
`music: 'miniboss'` and the run's `minibossReward`. Adds are existing enemies only (Gravecaw, Gloam Lantern,
Slushpup, Rime Wraith, Staticling, Grubling, Papercut, Echo Bat).

## The new pattern kinds (`src/sim/bosses/patterns-c.ts`)

Same contract as the library (params `[default, min, max]`, a telegraph first, timers ÷ pace, speeds × √pace,
shots through the enemy pools, nothing allocated per tick). Self-contained (no import of `patterns.ts`).

- **`dropLine`** — a domino of marked drops. `layout` 0: `lines` lines fanned `fan`° apart from the boss toward
  the target (`start` px beyond its edge); 1: a cross (the row and column through where the target stood); 2: an X.
  `count` drops per line / arm, `spacing` px apart, `step` s apart; `look` 0 globs lobbed from the boss, 1 falling
  debris, 2 lightning; `splash`, `dmg`, `split` (shots out of each landing), `creep` + `creepLife`. The landing
  rings are the telegraph; the gaps between lines are the way out.
- **`halo`** — `count` shots spawn on a circle (`radius` from the boss's centre; `rings` 2 adds a wider ring
  turning the other way) and orbit it at `spin` rad/s (tangential velocity + `curve`, so they need no per-tick
  work) for `hold` s, then are let go at `speed`: `aim` 0 outward, 1 each toward the target (converging), 2 all
  toward the target as one formation. The halo's shots are tagged by their exact turn rate (plus a tiny per-halo
  nudge), so the release finds them in the shot pool without a list. `repeats` halos in a row.
- **`ricochet`** — an aim line (`tellLine`) and a wind-up, then a roll at `speed` that reflects off walls, rocks
  and pits (walkers) or walls (flyers) `bounces` times (`home` 0-1 bends each bounce toward the target; never a
  flat ping-pong, never back into the wall), bursting `ring` shots at every bounce ('bonk'), then bonks to a stop
  ('bossSlam') and is dazed for `stun` s. Wedged for 0.25 s or out of `maxTime`: it stops early.

## The boss hook (`src/content/hooks/bosses-c.ts`)

Every pack-C boss names a hook built by `phaseLook(name, { sprites, home, flyFrom? })`:
- `phase(ctx, i)` swaps `enemy.sprite` to the phase's sprite the moment the roar starts (the white flash hides
  the swap) and `tick` re-asserts it (split parts, fights started without an intro). Only the renderer reads
  `enemy.sprite`; the hook lists its sprites in `BossHook.looks` (merge), so validation checks them and
  `EnemyRenderer.prepare` rasterises them ahead of time.
- `flyFrom`: from that phase on the boss flies (`enemy.flying`; the Ambergut hatches).
- Depth pace: `pace` = the phase's pace × `depthPace(home, world.chapter)` = 1 + 6 % per chapter deeper than the
  home one (clamped 0.85-1.25; set, never compounded). It speeds up the multi-chapter minibosses deeper down and
  slows a boss borrowed by a shallower chapter without its own (since the merge every chapter has its own bosses). HP depth scaling stays `bossHpFor`'s.

## Art

Painted with `content/sprites/paint.ts` plus `bossesCPaint.ts`; 1 px outline, lit from the top-left, side views
face right, anchors in the lower body. Each sprite has idle / move / windup / roar / slam / air / charge / hurt
(`bossSprite`). Later-phase sprites keep the same animation names so every pose works in every phase. 20 sprites: 9 bosses' first looks + 11 later looks.
