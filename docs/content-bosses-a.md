# Boss pack A: Drowned Nursery, Rootcellar, Candlewick Crypt and two minibosses

Six bosses (two per chapter) for chapter 1 alt and both chapter 2 tracks, and two minibosses that roam
chapters 1-2 on both tracks. The pack also adds three boss pattern kinds and a hook that gives every
boss a second shape for its later phases.

Files:

- `src/content/bosses/{drowned_nursery,rootcellar,candlewick_crypt}.ts` hold the bosses.
  `src/content/bosses/minibosses-a.ts` holds the minibosses.
- `src/content/sprites/bossesA{Nursery,Root,Crypt,Mini}.ts` hold the art. Each boss has two sprites, a
  base one and a later-phase one of the same size and anchor, both painted with `paint.ts`.
- `src/sim/bosses/patterns-a.ts` holds the new pattern kinds `lineStrike`, `orbitDash` and `clusterLob`.
  They are registered with one line at the end of `BOSS_PATTERN_KINDS` (`sim/types.ts`), plus an import
  and a `...PATTERNS_A` spread at the end of `PATTERNS` (`sim/bosses/patterns.ts`).
- `src/content/hooks/bosses-a.ts` holds the phase-look hooks, `bossesA.<boss>`.
- `tests/content-bosses-a.test.ts` tests all of the above. `tests/bosses.test.ts` had two selection
  checks that assumed the Rootcellar and the Crypt had no bosses; they now check membership, and a new
  line tests the borrow rule on a chapter that has no bosses.

## Roster

HP follows chapter depth, since Wren deals about 10 damage a second at base:

- Chapter 1 alt: 280-300 HP and 2 phases, like the Gutterways pair.
- Chapter 2: 400-450 HP and 3 phases, with faster later phases (pace up to 1.3), denser rings and more adds.
- Minibosses: 150 HP and 2 phases. Their home chapter is the Gutterways, so on floors 3-4 `bossHpFor`
  adds 14 % per floor.

Music is `boss_floodgate` for the bosses and `miniboss` for the minibosses. Bosses drop `bossSpill`;
minibosses drop `champion`, a small extra on top of the run's `minibossReward`.

| Boss | Chapter | HP | Phases (threshold): signature |
|---|---|---|---|
| Pirouetta | drowned_nursery | 280 | Curtain Up: circles you, a two-arm note spiral, a lap of the room, sheet-music walls, a curtsy teleport. Overwound (50 %): a double ring as the spring snaps, a reversing 3-arm spiral, laps firing inward, double curtsies, balloons. |
| Sir Sopsalot | drowned_nursery | 300 | Soggy: squelch slams, bathwater puddles, button bursts, bath ducks. Unstitched (50 %): a stuffing puff, triple tumble charges, double slams, toy blocks raining, slowing stuffing rings. |
| Grandmother Brine | rootcellar | 420 | Steeping: brine puddles, onions that burst where they land, stepped rings, gherklings. Fermenting (60 %): a brine spill, a brine-jet sweep, double onion volleys, a vinegar spiral, crock hops. Sour (25 %): a brine jar, twin jets, onions that leave puddles, triple rings, jars dropping. |
| Old Knotroot | rootcellar | 440 | Buried: three root lines at you, tunnel and erupt, wailing rings, taproots. Uprooted (60 %): a clod shower, then charges, double root volleys, double tunnels, a 4-arm spiral. Wailing (30 %): a scream of rings, roots in all six directions, a reversing spiral, lunges, a grumblemole. |
| Vesperwing | candlewick_crypt | 400 | Drawn to the Flame: laps, slowing dust rings, swoops, dusk moths. Singed (55 %): an ember flare, spirals, fanned laps, dripping cinders, bursting swoops, gust walls. Guttering (20 %): more moths, a 4-arm reversing spiral, burning scales that pool, converging laps, triple rings. |
| Wickwarden | candlewick_crypt | 450 | Lit: wax puddles, wax drip lines, ember rings, aimed fans. Melting (60 %): waxwraiths, a hot wax trail, heavy slams, a 4-arm spiral, five drip lines, wax blobs bursting into sparks. Wick's End (25 %): rings, a 5-arm reversing spiral, the ceiling dripping, more blobs. |
| Bumbershoot (miniboss) | ch. 1-2, both tracks | 150 | Rain-shake rings, swoops (it snaps shut to dart), aimed fans. Inside Out (50 %): the caught rain pours down, spinning laps, spirals, triple swoops. |
| Puddlestomp (miniboss) | ch. 1-2, both tracks | 150 | Hops with a splash ring on each landing, stomps, kicked puddles, charges. Odd Boots (50 %): splits into two single boots that fight separately (the core `split`). |

In headless god-mode fights with the real attack pipeline and the test bot:

| Group | Time to kill | Enemy shots per second |
|---|---|---|
| Chapter 1 alt bosses | 35-39 s | 3-8 |
| Chapter 2 bosses | 51-59 s | 7-13 |
| Gutterways bosses, for comparison | 28-33 s | 2-7 |

The escalation test requires the chapter 2 average density to be at least 1.3 times the chapter 1 alt
average.

## Pattern kinds (`patterns-a.ts`)

All three follow the core contract. Each opens with a telegraph (`bossTell`, flash, squash, pose). Timers
are divided by pace, and speeds are multiplied by the square root of pace. State lives only in the
BossState scratch slots. Nothing is allocated per tick, and every shot goes through the enemy pools.

### `lineStrike`

Marked strikes ripple out along lines from the boss toward the target: roots bursting up, wax dripping.
Each mark is a falling lob, so the landing marker is the warning and `air` is never scaled by pace.

| Param | Default | Meaning |
|---|---|---|
| `lines` | 1 | Lines per volley |
| `fan` | 30 | Degrees between neighbouring lines |
| `around` | 0 | 1 spreads the lines evenly all round instead of fanning them at the target |
| `count` | 7 | Marks per line |
| `start` | 8 | Distance of the first mark beyond the boss's edge, in px |
| `step` | 18 | Spacing between marks, in px |
| `interval` | 0.09 | Seconds between neighbouring marks |
| `air` | 0.7 | Warning time before a mark lands, in s |
| `splash` | 9 | Hit radius of each strike, in px |
| `dmg` | 1 | Damage per strike |
| `bolt` | 0 | 1 = lightning strikes instead of falling debris |
| `creep` | 0 | 1 = each strike leaves a puddle |
| `repeats` | 1 | Volleys; each one is re-aimed |
| `gap` | 0.5 | Pause between volleys, in s |

### `orbitDash`

The boss runs a lap around the room's centre (`center` 0) or around where the target stood (`center` 1).
The lap is an ellipse squeezed to fit inside the walls, and it is marked while the boss winds up. The boss
joins the lap at its nearest point and fires on the way round.

| Param | Default | Meaning |
|---|---|---|
| `radius` | 70 | Lap radius, in px (squeezed vertically to fit) |
| `spin` | 140 | Speed along the lap, in degrees per second |
| `time` | 2.4 | Seconds on the lap |
| `center` | 0 | 0 = the room's centre, 1 = where the target stood |
| `dir` | 0 | Lap direction; 0 = random |
| `rate` | 3 | Volleys per second |
| `shots` | 1 | Shots per volley |
| `spread` | 24 | Fan width of a volley, in degrees |
| `aim` | 0 | 0 = at the target, 1 = inward (converging), 2 = outward |

It also takes the usual shot params.

### `clusterLob`

Lobbed globs with landing markers. Each one bursts into a ring of `split` shots where it lands, and
`creep` 1 leaves a puddle too. The first glob of each volley lands on the target; the rest scatter within
`spread`. Other params: `count`, `volleys`, `gap`, `air`, `height`, `splash`, `dmg`, `size`, `life`.

## Phase looks (`hooks/bosses-a.ts`)

Each boss names a hook, `bossesA.<boss>`, whose table gives the sprite for each phase. The last entry
repeats for any later phases.

- **When the look changes:** `phase` swaps `enemy.sprite` at the roar, under the phase flash. Puddlestomp
  waits until its split entrance has run.
- **Split parts:** `tick` keeps every part of the fight in its phase's look. Parts are spawned wearing the
  def's sprite, so without this they would show the old look.
- **Scope:** `enemy.sprite` is read only by the renderer. The def's sprite stays the bestiary picture,
  and the phase `tint` still washes the colour on top.

The looks:

- **Pirouetta:** overwound, with cracked porcelain, a snapped arm, the mainspring sprung, a torn tutu and
  glowing eyes.
- **Sir Sopsalot:** unstitched, with stuffing bursting out, the button eye dangling, a torn ear and a
  collapsed hat.
- **Grandmother Brine:** fermenting, with a cracked and seeping crock, a chipped rim, bubbles, a cracked
  lens, red eyes and wilted dill.
- **Old Knotroot:** uprooted, standing on forked root legs, with split bark, wilted leaves and
  smouldering eyes.
- **Vesperwing:** singed, with burnt-through holes, charred edges and flames at the wing tips.
- **Wickwarden:** melting, slumped and overflowing, with blue-hot flames and a bent shoulder candle.
- **Bumbershoot:** inside out, a torn cup of lining with the spokes sticking up.
- **Puddlestomp:** each split part is one scuffed, taped boot.

## Notes for the shared docs (not edited here)

- **ARCHITECTURE.md §6c Patterns:** add `lineStrike`, `orbitDash` and `clusterLob`
  (`sim/bosses/patterns-a.ts`).
- **ARCHITECTURE.md §6c Content:** list this pack.
- **ARCHITECTURE.md §6c Hooks:** note that a boss hook may swap `enemy.sprite` for a phase look. This is
  presentation only; the renderer draws `enemy.sprite`.
- **Merged:** the hooks now declare their sprites (`BossHook.looks`), so validation checks every phase look and
  `EnemyRenderer.prepare` rasterises them ahead of time (no first-use cost at the phase change).
- **ARCHITECTURE.md §5:** `BOSS_PATTERN_KINDS` grew; no shapes changed.
- **tests/bosses.test.ts:** its chapter-pool checks were relaxed to membership, and a new line tests the
  borrow rule on a chapter that has no bosses.
