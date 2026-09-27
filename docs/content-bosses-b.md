# Boss pack B — chapters 3-4

Six bosses and two minibosses for the Grinding Works, the Rust Foundry, the Mushroom Hollow and the Glimmer
Grotto (eight bosses since polish batch 4 added Hammerjaw and Facetta, so the alt chapters have two each), three new boss pattern kinds and a per-phase LOOK for every one of them. Built on the boss framework
(ARCHITECTURE §6c); everything is data except the three pattern kinds and one small hook.

| File | What |
|---|---|
| `src/content/bosses/grinding_works.ts` | Old Governor, Gnawgear |
| `src/content/bosses/rust_foundry.ts` | Bellowbelly, Hammerjaw (polish batch 4) |
| `src/content/bosses/mushroom_hollow.ts` | Grandmother Gill, Bramblehorn |
| `src/content/bosses/glimmer_grotto.ts` | Hushwing, Facetta (polish batch 4) |
| `src/content/bosses/minibosses-b.ts` | Canshell, Glowtail (all four chapters) |
| `src/content/sprites/bossesB{Kit,Works,Foundry,Hollow,Grotto,Mini}.ts` | the art (one SpriteDef per phase look) |
| `src/content/hooks/bosses-b.ts` | `bossesB.<id>`: swaps the sprite to the phase's look |
| `src/sim/bosses/patterns-b.ts` | `podBurst`, `closingRing`, `gearSpokes` |
| `tests/content-bosses-b.test.ts` | validation, art, the new kinds, pools / runs, god-mode fights |

Registration edits outside the owned files (one line each, at the END of the lists): `BOSS_PATTERN_KINDS`
(`src/sim/types.ts`) gained `'podBurst', 'closingRing', 'gearSpokes'`; `PATTERNS` (`src/sim/bosses/patterns.ts`)
spreads `...PATTERNS_B` last (plus its import). Existing kind indices (carried by 'bossTell') are unchanged.

## The roster

HP is tuned by depth: chapter 3's own bosses have 480-540 base HP and chapter 4's 580-600, the minibosses 220-240.
Since polish batch 4 every boss and miniboss is scaled by the floor it is met on (`bossHpFor`: × (1 + 0.3 × (floor − 1)),
so ×2.2-2.5 on floors 5-6 and ×2.8-3.1 on floors 7-8) and a phase can't be left before it has been fought 3 s. Base Wren (3.5 × 3 shots/s, god-mode bot, open room) needs ≈ 60-75 s for chapter 3, ≈ 65-100 s
for chapter 4, ≈ 25-45 s for the minibosses (the Gutterways bosses: ≈ 30 s) — a floor 5-8 build is much faster.
Every boss uses the 'boss_pressure' theme (chapters 3-4), minibosses 'miniboss'. Contact 1 heart for the heavies
(Gnawgear, Bellowbelly, Bramblehorn), ½ heart otherwise.

| Boss | Chapter | HP | Phases (at) | Patterns (phase by phase) |
|---|---|---|---|---|
| Old Governor | grinding_works | 480 | Regulating (1) · Overpressure (0.5) | gearSpokes 4×3, steam beamSweep, stepped ring 14 ×3, rivet aimedBurst · (enter: 2 Tick-Tock Mice) twin steam jets, closingRing 18 ×2, gearSpokes 5×4, debrisRain (rivets), summon mice |
| Gnawgear | grinding_works | 480 | Grinding (1) · Stripped (0.45) | double charge (tooth ring on the wall), gearSpokes 3×4, bolt aimedBurst, summon a Runaway Cog · (enter: 2 cogs) triple charge + debris, ember gearSpokes 5×4, reversing ember spiral, double jumpSlam |
| Bellowbelly | rust_foundry | 540 | Stoked (1) · Red Hot (0.65) · Meltdown (0.3) | podBurst slag bombs (fire puddles), red flame beamSweep, ember rings, lobbed cinders between · (enter: slag puddles round itself) belly flop with double shockwave, 5-bomb podBurst, spark spiral, twin flame breath · (enter: 2 Slag Blobs) 7 bombs anywhere, closingRing of fire, reversing 4-arm spiral, molten debrisRain (puddles), double flops |
| Grandmother Gill | mushroom_hollow | 580 | Dozing (1) · Sporulating (0.66) · Overripe (0.3) | spore rings that drift to a stop (accel −40), spore podBurst (sticky puddles), summon Puffcaps, sneeze fans · (enter: 4 Puffcap SHIELDS — each bursts into spores when popped) spore spiral, closingRing, podBurst 5, walls of spores · (enter: 2 Puffcaps) 5-arm reversing spiral, 7 pods anywhere, stepped rings 20 ×4, sticky puddles round her, fresh shields |
| Bramblehorn | mushroom_hollow | 600 | Rooting (1) · Taking Wing (0.5) | double charge + mushroom debris, burrow + erupt (ring + shockwave), spore aimedBurst, wing-hop jumpSlam · (enter: 2 Mossback Beetles) triple charge with rings, triple flying slams, mushroom rain, double burrow, leading fans |
| Hammerjaw | rust_foundry | 520 | Cold Iron (1) · White Heat (0.62) · Slag Heap (0.28) | an anvil golem: jumpSlam with a shockwave and ember ring, gearSpokes 4×3, ember aimedBurst, 3 slag podBurst (fire puddles) · (enter: 2 rings of 18) double charge with debris, double slams with two waves, 3-arm spiral, red beamSweep · (enter: 2 Slag Blobs) molten debrisRain (puddles, slams), 6-arm gearSpokes, closingRing of 18, triple slams |
| Hushwing (flying) | glimmer_grotto | 600 | Listening (1) · Resonating (0.66) · Shattering (0.3) | screech rings, ECHO (an outward call, then a closingRing from the walls onto the bat), teleport + fan, crystal debrisRain · (enter: 2 Echo Bats) crystal cage closingRing ×2, 4-arm spiral, double teleport with rings, twin light beams · (enter: a 24-shot burst) 6-arm crystal gearSpokes, double echo, dense crystal rain, stepped rings, teleports with wide fans |
| Facetta | glimmer_grotto | 580 | Dormant (1) · Singing (0.64) · Prism Heart (0.3) | a crystal tortoise that wanders: spinning double rings, 3 crystal podBurst, 5-arm gearSpokes, crystal debrisRain · (enter: 3 Glint Mites) twin light beamSweep, closingRing of 18, 4-arm spiral, 5-pod podBurst, a 3-shot aimed fan every 2.6 s · (enter: a 24-shot burst) she chases — 7-arm gearSpokes, a 200° twin beam, dense crystal rain, double charge with rings |
| Canshell (mini) | chapters 3-4 | 220 | Scuttling (1) · Tucked In (0.5) | circles you (orbitPlayer), rush charge, claw-snap fans, podBurst bottle caps · (enter: ring of 12) triple rolling charge with rings, spinning gearSpokes, leading fans |
| Glowtail (mini) | chapters 3-4 | 240 | Glowing (1) · Flare (0.5) | burrow + erupt ring, twin light spiral, sticky goo hazard · (enter: goo round itself) double dives with a shockwave, closingRing of light, triple reversing ember spiral |

Adds come from the chapters' own rosters (Tick-Tock Mouse, Runaway Cog, Slag Blob, Puffcap, Mossback Beetle,
Echo Bat, Glint Mite) — the pack adds no enemies. Puffcaps used as `shields` keep their death ring, so popping a shield
costs a burst of spores.

## Phase looks

Every boss / miniboss has one SpriteDef per phase (same size and anchor) and a hook `bossesB.<id>`
(`BOSS_B_LOOKS` in `content/hooks/bosses-b.ts`): its `phase` callback swaps `enemy.sprite` when the phase begins (at
the start of the roar, under the white phase flash) and its `tick` keeps the reference in step (one comparison).
The renderer draws `enemy.sprite` as it always did, and the phase's `tint` wash still ramps in on top. The looks
change more than colour: the Governor goes red-hot with glowing cracks, leaking steam and flung-out flyballs;
Gnawgear loses teeth and its shoulder gear cracks; Bellowbelly's door hangs open, then its iron splits and drips
slag; Gill wakes (glowing gills / spots, spores), then rots (torn cap, sprouts, a cracked lens); Bramblehorn flings
its shell open over buzzing wings; Hushwing's crystals grow into a mane, then shatter; Hammerjaw's iron glows at every edge and its eyes burn white,
then white-hot cracks split it, its horn snaps and slag drips; Facetta's spires grow tall and glow as she hums, then
her shell cracks open on a prism heart; Canshell hides in its can
and rolls; Glowtail's lantern flares coral. The bestiary, the intro card and the game-over screen show the first
look (the def's sprite).

Art conventions (`bossesBKit.ts`): 8 frames per look — 0-1 idle, 2-3 move, 4 windup, 5 roar, 6 slam / air, 7 hurt —
and the standard anims table (`bossAnims`); painted with `paint.ts` plus the kit's `gear`, `crack`, `tri`, `shard`
and `puff` helpers; 1 px outline; bodies lit from the top-left; side views face right.

## The new pattern kinds (`sim/bosses/patterns-b.ts`)

All follow the library's rules: params `[default, min, max]` (validated), a 'bossTell' telegraph first, timers ÷
pace, shot speeds × √pace, everything through the enemy shot pools (caps, charm), no per-tick allocation.

- **podBurst** — lobbed pods to marked spots (the lob marker is the telegraph) that burst into a ring of `split`
  shots where they land (the lob pool's `split`), optionally leaving a puddle. `count`, `split`, `air`, `height`,
  `spread`, `where` (0 round the target — the first pod right on it —, 1 round the boss, 2 anywhere), `stagger`,
  `splash`, `creep` / `radius` / `life`, `dmg`, `size`.
- **closingRing** — `count` shots appear on a circle round the target (or the boss) with `hole` left out, start
  slow (`speed`) and speed up (`accel`) as they close in, `repeats` times `gap` s apart. `edge` 1 starts every shot
  where its ray meets the room's walls; `out` > 0 first fires an outward ring from the boss and waits `delay` —
  together an echo coming back. Shots never appear inside rocks, outside the room or within 16 px of the player.
- **gearSpokes** — `volleys` volleys of `arms` straight spokes, `len` shots per spoke at `speed`, `speed + step`, …,
  turning `turn`° per volley (direction picked per use; `aim` points the first spoke at the target). Lanes between
  the spokes widen with distance.

## Tests

`tests/content-bosses-b.test.ts`: content validation, unique names, ≥ 3 patterns per phase, rising pace / tints,
HP by depth; the 25 sprites (Hammerjaw and Facetta: 3 looks each) (8 frames, anims, outline, same size / anchor per boss, a different first frame per
look); each new kind in a test arena (pods land and burst and leave puddles; the ring forms round the target with
its gap, heads inward and speeds up; the echo flies out then re-forms at the walls; spokes = arms × len shots at
rising speeds); chapter pools (union rule, both minibosses in all four chapters, two different Works bosses on
floors 5 / 6) and real runs on floors 5-8 meeting them at the right HP; god-mode fights of all eight with the real
attack pipeline (every phase, every look worn, never out of the room, no NaN, peak shots under the cap);
walkers never inside a rock with cover in the room; determinism; the look swapping during the roar; Puffcap
shields bursting into spores. The framework's own suite (`tests/bosses.test.ts`) fights them too.

## For ARCHITECTURE.md (merge)

- §6c Patterns: add "`podBurst`, `closingRing`, `gearSpokes` (boss pack B, `patterns-b.ts`)" after `hook`.
- §6c Content: "Chapters 3-4 (boss pack B, docs/content-bosses-b.md) — Old Governor, Gnawgear (the Grinding
  Works), Bellowbelly (the Rust Foundry), Grandmother Gill, Bramblehorn (the Mushroom Hollow), Hushwing (the Glimmer
  Grotto); minibosses Canshell, Glowtail (chapters 3-4). Phase looks: one sprite per phase, swapped by the boss's
  hook (`content/hooks/bosses-b.ts`)."
- §1 docs list: `content-bosses-b.md`.
