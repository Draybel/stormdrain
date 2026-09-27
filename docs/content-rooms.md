# Room templates — chapter rooms & special variants

Hand-made 13 × 7 layouts on top of the 25 generic ones (`src/content/rooms/generic.ts`). Format, legend, validator
and picking: ARCHITECTURE §5 and docs/floorgen.md. Everything here is auto-discovered through `ROOM_TEMPLATES`
(`src/sim/floor/library.ts`); nothing else needs wiring.

```
src/content/rooms/<chapterId>.ts   5 normal rooms per chapter, chapters: ['<chapterId>'] (12 files, 60 rooms)
src/content/rooms/special-*.ts     12 special-room variants for every chapter (chapters: ['*'])
tests/content-rooms.test.ts        counts, naming, validator in all 4 mirrorings, house rules, 500-seed picking
```

## Naming

- Chapter rooms: `<prefix>.normal.<name>`, one prefix per chapter: `gutter` (gutterways), `nursery`
  (drowned_nursery), `cellar` (rootcellar), `crypt` (candlewick_crypt), `works` (grinding_works), `foundry`
  (rust_foundry), `hollow` (mushroom_hollow), `grotto` (glimmer_grotto), `orchard` (bone_orchard), `vault`
  (frostbitten_vault), `storm` (eye_of_storm), `nest` (hollow_nest).
- Special variants: `special.<type>.<name>` (type lower-cased, e.g. `special.deepsecret.reliquary`).
- Adding a room to a chapter = append it to that chapter's file; the test requires `chapters` to be exactly
  `['<file name>']` there.

## House rules (tests/content-rooms.test.ts, stricter than `validateTemplate`)

1. No `e`/`E` spawn and no hazard (`^`, `f`) within 2 steps (Manhattan) of a door front — you never enter into a hit.
2. The tile one step in from each door front — (6,1), (11,3), (6,5), (1,3) — is safe, open floor.
3. Braziers are solid in the sim, so nothing may be reachable only *through* a fire.
4. Every safe tile is reachable without touching spikes or fire. Exception: Thorn Rooms (`cursed`) may seal loot in
   thorns (`special.cursed.briar_pockets`: each chest costs a spike step in and out).
5. At most two tinted rocks per room (each is guaranteed loot).
6. Normal rooms: spawn budget by difficulty — d1 2-5 spawns and no elite, d2 3-7, d3 5-10 with at least one elite;
   at most one free `c`/`p`; at least 45 open tiles.
7. Boss / miniboss arenas: `B` on the centre tile (6,3), columns 4-8 × rows 1-5 free of blocking tiles (room for
   56 px bosses), no hazards, and (boss variants) at least 4 blocking tiles of cover.
8. No two hand-made rooms share a layout in any mirroring, and none copies a generic one.

## Difficulty ladder

`pickTemplates` aims at 1.0 on floor 1 → 3.0 on floor 13 (+ up to 0.35 toward the boss) and gives chapter rooms
×3 weight, so each chapter's five rooms follow its floors:

| chapters | floors | difficulties | share of normal rooms from the chapter file (500 seeds × 2 floors) |
|---|---|---|---|
| gutterways, drowned_nursery | 1-2 | 1 1 1 2 2 | ≈ 62 % |
| rootcellar, candlewick_crypt | 3-4 | 1 1 2 2 3 | ≈ 54 % |
| grinding_works, rust_foundry | 5-6 | 1 2 2 2 3 | ≈ 55 % |
| mushroom_hollow, glimmer_grotto | 7-8 | 2 2 2 3 3 | ≈ 55 % |
| bone_orchard, frostbitten_vault | 9-10 | 2 2 3 3 3 | ≈ 54 % |
| eye_of_storm, hollow_nest | 11-12 | 2 3 3 3 3 | ≈ 57 % |

The rest come from the generic set. Even the off-curve room of a chapter (e.g. a d3 room on floors 3-4) is picked
100+ times over the 1000 floors; the test asserts ≥ 50.

## Chapter themes (how tiles read per chapter)

| chapter | rooms | tiles |
|---|---|---|
| Gutterways | culverts, grate_rows, leaf_drift, cistern, spillway | open drains / grates = pits, leaf drifts = crates + stones |
| Drowned Nursery | toy_blocks, crib, bathtub, music_box, playpen | toy blocks / pens = crates, crib bars & music-box comb = metal, bathtub = pit |
| Rootcellar | pantry, mole_holes, root_tangle, pickle_barrels, burrow_warren | jars = urns, crates, roots = rocks, mole holes = pits |
| Candlewick Crypt | candle_pews, sarcophagi, wax_pools, altar, niches | candles = fire, tombs = metal, pews = crates, wax = pits |
| Grinding Works | cogwheel, conveyor, pistons, switchyard, crusher | metal-block machinery, spike plates |
| Rust Foundry | slag_runnel, furnace_row, crucible, ingot_stacks, pour_floor | slag = pits, furnaces = fire in metal, ingots = metal |
| Mushroom Hollow | fairy_ring, twin_rings, glowcap_grove, spore_circle, beetle_burrows | ring clearings of rock caps, glowcaps = tinted rock, burrows = pits |
| Glimmer Grotto | crystal_veins, geode, chasm, prism_hall, echo_chamber | crystal columns = metal / tinted rock, chasms = pits |
| Bone Orchard | tree_rows, graveyard, lantern_walk, crow_roost, bramble_hedge | bone trees = rocks, headstones = metal, lanterns = fire, brambles = spikes |
| Frostbitten Vault | strongroom, icicle_hall, frozen_hoard, cold_storage, deep_freeze | mirror-symmetric vaults: metal walls, icicles = spikes, ice holes = pits |
| Eye of the Storm | cloudbreak, eye_wall, gale_lanes, lightning_rods, skyholes | open arenas, holes in the clouds = pit islands, rods = metal |
| Hollow Nest | paper_comb, amber_cells, brood_chamber, paper_tunnels, queens_hall | wasp paper = crates (shoot shortcuts), amber = tinted rock, brood cells = pits |

## Special variants (chapters `['*']`)

| file | id | type | d | notes |
|---|---|---|---|---|
| special-keepsake.ts | special.treasure.shrine | treasure | 1 | pedestal between iron posts, two urns |
| | special.treasure.crate_cache | treasure | 1 | crate enclosure open N/S (or shoot in) |
| special-hideyhole.ts | special.secret.lost_and_found | secret | 1 | chest, 4 pickups, urns |
| | special.deepsecret.reliquary | deepSecret | 1 | pedestal + 4 pickups in iron brackets |
| special-arena.ts | special.challenge.corner_pens | challenge | 2 | waves climb out of 4 corner pens; reward in the centre |
| | special.challenge.moat_ring | challenge | 3 | reward on a moated island with two 1-tile ways in |
| special-thorn.ts | special.cursed.thorn_crown | cursed | 2 | pedestal + 2 chests inside a thorn crown, open N/S/E/W |
| | special.cursed.briar_pockets | cursed | 3 | each chest sealed in thorns; the pedestal between them is free |
| special-boss.ts | special.boss.bulwarks | boss | 1 | L-shaped stone cover in the corners |
| | special.boss.crate_barricade | boss | 2 | destructible cover that erodes during the fight |
| | special.boss.flooded_corners | boss | 3 | pit corners shrink the room, 4 stones for cover |
| | special.miniboss.standing_stones | miniboss | 2 | a loose ring of stones |

Treasure and deep-secret variants are difficulty 1 like the generic ones, so every floor rotates evenly through them;
boss / challenge / cursed variants spread over 1-3 so early floors favour the easier arenas.

## Integration notes

- Normal rooms may put the room-clear reward's centre tile under a prop (rootcellar pantry, crypt altar, …) — spawn
  it on the nearest free tile (docs/floorgen.md step 3).
- Two normal rooms carry a free marker: `nursery.normal.crib` (`p`, a toy in the crib) and
  `vault.normal.frozen_hoard` (`c`, the frozen chest).
- Breakable-heavy rooms (`cellar.normal.pickle_barrels` 12 urns + 7 crates, `cellar.normal.pantry`,
  `nest.*` paper walls) follow the generic urn hall / crates rooms; retune the `urn` / `crate` drop tables in the
  balance pass rather than the layouts.
- Chapter palettes / tilesets are still placeholders (`GUTTER`); the tile readings above are what the chapter art pass
  should draw (e.g. crates as toy blocks in the Nursery, as paper comb in the Nest).
