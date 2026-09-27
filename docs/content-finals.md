# Final bosses (content pack)

The three finals of DESIGN.md "Final bosses & endings", replacing the Phase 3B placeholders. Ids, `final`
keys and endings are unchanged (the floor generator, the run's ending flow, saves and tests know them).

| Boss | Where | HP | Phases | Ending |
|---|---|---|---|---|
| Old Thunderhead (`old-thunderhead`) | floor 12, main track | 1400 | Brooding · Gathering Storm (0.55) · The Last Downpour (0.2) | 1 Clear Skies |
| The Nestmother (`nestmother`) | floor 12, alt track | 1500 | Queen's Court · Swarming (0.6) · Hive Fury (0.25) | 2 The Quiet Hive |
| The Undertow (`undertow`) | floor 13 (whirlpool) | 1900 | The Current · Churning (0.7) · The Deep (0.4) · What the Rain Kept (0.15) | 3 What the Rain Kept |

Files (all new except the three one-line registrations and the death hook noted below):

- `src/content/bosses/finals.ts` — the BossDefs (patterns, params, loot `bossSpill`, themes, lines).
- `src/content/sprites/finals-thunderhead.ts`, `finals-nestmother.ts`, `finals-undertow.ts` — one 56 px sprite
  per phase (the same anchor), painted with `sprites/paint.ts`; frames idle ×2, move ×2, windup, roar, hurt
  (+ air for the Nestmother, spin ×4 for the Undertow).
- `src/sim/bosses/patterns-finals.ts` — eight new generic pattern kinds (below), spread into `PATTERNS`
  (`patterns.ts`) and listed at the end of `BOSS_PATTERN_KINDS` (`sim/types.ts`).
- `src/content/hooks/bosses-finals.ts` — per-boss code (`registerBossHook`): Thunderhead's looming drift and
  the blackout, the Undertow's pull, the phase looks (`enemy.sprite` swapped when a phase begins), the lines, the
  send-offs.
- `src/sim/bosses/hooks.ts` + `brain.ts` (additive): `BossHook.dying(ctx)` — called every tick of the death
  sequence (`ctx.t` = seconds left); the first call may lengthen `ctx.b.dieT`. The finals use it for their
  send-off (+1.1-1.3 s).
- `tests/content-bosses-finals.test.ts`.

## The fights

**Old Thunderhead** — a colossal grumpy old storm cloud (bushy white brows, a bulb of a nose, a droopy
moustache). It looms along the top of the room, drifting after Wren but backing off rather than sitting on her
(hook `tick`, through `enemy.sepX/Y`, so the integrator's bounds and collision still apply).
- Brooding: lightning walking at her (`strikes` line), rain curtains with a gap (`curtain`), a gust that shoves
  her sideways with rain blown along (`gust`), a thunderclap (`clap`: flash, ring, shockwave), a cross of strikes.
- Gathering Storm (towers into a sheared anvil, glowing eyes, sparks): enter — three little cloudlets
  (`brood` of Grumbleclouds at 0.6 size, 14 HP); three fanned lightning lines, slanted curtains, stronger gusts
  from a random side, double claps, a lightning beam sweep, an X of strikes, more cloudlets.
- The Last Downpour (near-black, cracked with glowing veins, a crown of bolts): enter — **the blackout** (hook
  pattern `thunderhead-blackout`, ~4.5 s): the room goes dark (the Curse of Darkness overlay — `world.curse`
  borrowed, the floor's own curse put back after), straight shots and cloudlets are swallowed when the lights go
  out, three bolts strike around Wren every ~0.6 s (their markers inside her own light), and a distant strike
  lights the whole room for a moment every ~1.1 s. Also: rings of strikes closing on her, fast curtains, triple
  claps, a sucking gust (it inhales), a spinning spiral, twin lightning beams.
- Send-off: a last tantrum of harmless lightning all over the room while the cloud rains itself out (shrinks),
  then the sun breaks through ("...FINE. HAVE YOUR SUNSHINE.").

**The Nestmother** — the paper-wasp queen (paper-cell crown, glossy compound eyes, four paper wings, a tapering
striped abdomen). She circles Wren (`orbitPlayer`) firing stingers between moves.
- Queen's Court: larvae hatch on marked spots round Wren (`brood` of Grublings), the stinger dive (`dive`: she
  rises out of reach, her shadow hunts Wren, locks and blinks, plunges — ring of stingers + shockwave, smashing
  any crate she lands on), paper walls (`barricade`: wads arc onto cells between her and Wren and set into crates
  — break them with shots; they may drop the usual crate loot), fans of stingers, honey puddles (`hazard`).
- Swarming (torn wings, cracked crown, honey oozing, red eyes): enter — three Nest Drones; curving stinger
  spirals, double dives, double walls, more honey, lunging charges, more larvae.
- Hive Fury (ember-glowing stripes, burning eyes, tattered wings, dripping stinger): enter — five drones circle her
  as a guard (`shields`); double spirals, triple dives, larvae, honey rain, wide stinger fans, swirling rings.
- Send-off: her paper walls crumble one by one (no loot), honey spatters ("HUSH NOW... THE HIVE IS SLEEPY...").

**The Undertow** — the living whirlpool at the bottom of every drain (one enormous eye, lost things bobbing round
its rim — a paper boat, a rubber duck, a button, a key, one of Wren's marbles). It keeps to the middle of the room
and **drags Wren toward it** (hook `tick`: 14 / 20 / 26 / 34 px/s by phase — she walks at 96 — half on a
flyer), with silent churning sparkles round it. Not flying (a floor whirlpool, depth-sorted with Wren), mass 100.
- The Current: enter — four Bubble Wards; debris gathers, circles it and is flung at Wren piece by piece
  (`vortex`), a water tentacle (`strikes` tentacle: a snaking line of marked spouts that splash up and spray),
  a curving spiral, swirling rings.
- Churning (deeper, bloodshot): enter — five wards the other way; a debris spray flung along the spin (with an
  extra pull), twin tentacles, twin water jets, a reversed spiral, puddles.
- The Deep (two water tentacles rise from the rim, the iris glows): enter — a radial burst of debris; a
  six-armed reversing spiral, rings of spouts closing on her (twice), three tentacles, aimed debris with a strong
  pull, wide twin jets.
- What the Rain Kept (last stand: four tentacles, a cracked blazing eye, the lost things shining): enter — a
  16-piece debris spray; a dense but slow six-armed spiral, three tentacles leaving puddles, rapid aimed debris
  with the strongest pull, alternating rings, a tidal clap.
- Send-off: the water settles in splashes, the lost things surface with golden glints, the whirlpool closes.

## The pattern kinds (`sim/bosses/patterns-finals.ts`)

All follow the core library's rules (params `[default, min, max]`, a telegraph first, ÷ pace / × √pace, the enemy
shot pools). Any boss may use them.

| Kind | What | Key params |
|---|---|---|
| `strikes` | marked strikes along a shape: 0 a line walking at the target, 1 a cross (2 `tilt` = X), 2 a ring, 3 snaking tentacles; lightning (`bolt` 1) or water spouts (lobs that splash, `spray` droplets, `creep`) | shape, count, paths, fan, step, radius, delay, air, splash, sway, repeats, gap |
| `curtain` | sheets of rain from the ceiling with a gap that opens near the target and shifts sheet by sheet; `slant` drifts it (drops come in through the side wall on the same line) | sheets, gap, spacing, hole, shift, slant, speed |
| `gust` | wind: pushes the player (`pushPlayer`: her shove channel, settling at exactly `force` px/s, ramped) away from / toward the boss or to a random side, dust streaks, rain blown in from the upwind wall | time, force, dir, rain, speed |
| `clap` | thunderclaps: a flash (or a burst, `flash` 0), a ring of shots, a shockwave | claps, gap, count, alt, waves, waveRadius, waveSpeed |
| `brood` | adds with their own HP / size, around the boss, around the target (never on her) or anywhere; they fade in (`hatch`) | count, max, hp, scale, place, dist, hatch — needs `enemy` |
| `dive` | rises (untouchable by contact), the shadow follows the target, locks (blinking), plunges: ring + shockwave, `crushCrates` where it lands | rise, height, track, follow, lock, fall, count, ring, waves, crush |
| `barricade` | wads arc onto cells across the line to the target and set into crates (never on the player, a door front, an enemy, loot; `max` crates in the room) | cells, gaps, walls, air, max |
| `vortex` | debris rises round the boss, is drawn into an orbit, then flung at the target one by one (`fling` 0), along the spin (1) or straight out (2); optional extra `pull` | count, radius, spin, hold, fling, interval, speed, pull |

`vortex` tags its circling shots with `EnemyShot.creepR` (unused by non-lob shots); `strikes` keeps a random
offset / sway phase in `BossState.tellX/Y` (its charge line is off).

## Notes

- Tuning: a base-stat god-mode bot takes ~3-3.7 min in an open arena (the boss tests allow 5), a build with 4×
  Wren's damage ~40-60 s (a crude dodging bot takes ~6-11 hits a minute from them, about what it takes from the
  Gutterways bosses at base stats); in the real boss rooms (rocks, pits, adds to distract it) the dumb bot needs
  4-5 min — tests fight them in the open or kill them outright.
- Darkness borrows `world.curse` (the only darkness the renderer has). The floor's curse is kept aside and put
  back when the blackout ends, is cut short, the phase changes or the boss falls; a debug kill mid-blackout leaves
  the room dark until the next room entry (which resets the curse from the layout). While dark, the HUD shows the
  darkness icon and a Deluge floor loses its slip.
- Forces on the player (gust, pull, vortex pull) go through `Player.pushX/Y`, the channel enemy contact uses, so
  they add up with contact shoves and respect walls, rocks and pits.
- Cosmetic effects only use events that nothing tracks as progress (`lobLand`, `splash`, `eshotPop`,
  `enemyDash`, `sfx`, `shake`, `npcSay`, `tileBreak` for crumbling walls).
