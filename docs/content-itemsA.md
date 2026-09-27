# Items pack A — 42 passives, 5 sets, 5 familiars

Content only (no engine changes). Everything is auto-discovered:

| What | Where |
|---|---|
| Items (42 passives) | `src/content/items/passives-a-{stormcaller,mothkin,clockwork,sporeling,waxen,general}.ts` |
| Set definitions | `src/content/sets/{stormcaller,mothkin,clockwork,sporeling,waxen}.ts` |
| Familiars (5) | `src/content/familiars/itemsA.ts` |
| Hook `itemsA.sporeCloud` | `src/content/hooks/itemsA.ts` |
| Art (icons, familiars, costumes, raster helpers) | `src/content/sprites/itemsA*.ts` |
| Tests | `tests/content-items-a.test.ts` |

Descriptions follow the banner rule (uppercase, ≤ 46 characters, only glyphs the pixel font has). No item
sets `unlock`. Tags: a category (`modifier`, `weird`, `familiar`, `stat-up`, `luck`, `health`) plus the
DESIGN.md set name; every set member also carries its set's tag, so synergies can require `{ tag }`.

## Sets (hold 3 distinct members; each set has 5-6)

| Set | Members | Bonus | Look |
|---|---|---|---|
| Stormcaller | Brass Kite Key, Wool Mitten, Crackle Candy, Falling Barometer, Blinkbug, Static Cling | chain (+1 jump), damage +0.5 then ×1.15 | cape of static (back layer + clasp / back panel), blue glow, sparks |
| Mothkin | Feathery Antennae, Pouch of Wing Dust, Porch Bulb, Eyespot Charm, Gloamwing, Snug Cocoon | flying, slow, puddle (dust), move +8 | flapping dusty wings with eyespots, dust sparks |
| Clockwork | Pocket Metronome, Loose Mainspring, Tin Cuckoo, Ratchet Wrench, Clockwork Heart, Whirring Cog | fire rate +0.5 then ×1.2, bounce with `bounces: -1` = one ricochet (gear-shaped shots) | turning gear halo |
| Sporeling | Earthstar, Foxfire Cap, Fairy Ring, Toddlecap, Shelf Fungus | **+1 heart container (instant)**, every kill → `itemsA.sporeCloud` | toadstool cap |
| Waxen | Trick Candle, Sealing Wax, Candelabra, Candle Snuffer, Tallow Tot | burn (+1 s), damage +0.5, `fireImmune`, `darkVision` | candle crown, flickering, warm glow |

Notes for the set runtime:
- `sets/sporeling.ts` holds an INSTANT effect (`hearts: { containers: 1 }`). Today's `recomputePlayer`
  only applies a set's persistent effects, so the heart needs the runtime to run a set's instants once
  when it completes (and never again for the same set in the run).
- Today's engine counts duplicate copies toward `need` (two Pocket Metronomes + one more clockwork item
  complete Clockwork). The tests only rely on 3 DISTINCT members, so either rule works.
- Set costume `sparks` / `glow` are declared like item costumes; `render/attackFx.ts` currently looks
  sparks up with `findItem(id)` only, so `set:<id>` entries don't spark yet.

## General items (no set)

- Stat multipliers (duplicates compound): Lead Marble (damage ×1.3), Cold Brew Can (+0.5 then ×1.1 fire
  rate), Magnifying Glass (size ×1.35, damage ×1.15), Slingshot Band (speed / range ×1.25), Gold Star
  Badge (×1.1 to damage, fire rate, shot speed, range; ×1.05 move; +0.5 luck), Spyglass (pierce, range
  ×1.25, speed ×1.15).
- Luck engines: Wishing Penny (+1 luck; cleared rooms may roll the `roomClear` table again), Weighted Die
  (+2 luck; kills may drop Lucky Coins, which add luck), Ladybug Brooch (+1 luck; getting hurt may give a
  Tin heart), Tracing Paper (each volley may double the next one or two; overlapping copies stack).
- "Useless alone": Carousel Horse (circleFirst + accelerate), Snail Mail Stamp (shots ×0.5 speed, ×1.5
  size, ×1.6 damage), Rearview Mirror (backShot + boomerang), Greasy Gloves (range ×0.55, explode, wild aim).

## Triggers and budgets

- Per-volley / per-kill triggers only grant TIMED boosts, and per-kill boosts have a cooldown (Ratchet
  Wrench: one click per 0.5 s, +0.5 fire rate for 4 s). A trigger's cooldown belongs to its effect object,
  so copies of one item share it — that keeps live temporary effects bounded at any kill rate (an
  uncooled per-kill boost reached 3 000+ temps and 7 ms/step in the every-item ×3 test; now ≈1 ms).
- Falling Barometer's hurt boosts (damage ×1.25, fire rate +0.4) last until you leave the room and
  compound per hit (i-frames bound them).
- `itemsA.sporeCloud { radius, dmg, poison, power }`: `dmg` × player damage to everything in reach
  (`api.damageArea`), then poison (`poison` s, `power` × player damage per tick, ≥ 1) on enemies and
  dummies, plus a green status puff. Kills it causes fire 'kill' again (nesting stops at depth 3).
  It uses the World's pools directly and mirrors `SRC_BOMB` (= 1) as a local constant — importing
  `sim/hittable` from a hook would drag the sim into the registry's hook loading.

## Familiars

Blinkbug (hover, 0.3 scale, fires 1.5× as often), Gloamwing (orbit, blocks shots, contact 3, 0.3 scale,
0.7× rate), Tin Cuckoo (follow, 0.35, 1.3×), Toddlecap (chase, contact 5), Tallow Tot (follow, 0.5, 0.75×).

## Renames made to avoid clashes with parallel work

The actives / trinkets pack uses Static Balloon, Puffball, Carbon Paper, Wishbone, Mothball and Birthday
Candles, a trinket is called Cracked Monocle and an enemy Dusk Moth, so this pack's versions are Static
Cling, Earthstar, Tracing Paper, Wishing Penny, Eyespot Charm, Trick Candle, Spyglass and Gloamwing.
