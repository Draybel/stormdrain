# Testing STORMDRAIN (Phase 5 guide)

Four layers, from fast and narrow to slow and wide. All of them run headless except e2e.

| Layer | Where | What it proves | Command |
|---|---|---|---|
| Unit / content | `tests/*.test.ts` | rules of each module, content validation, save codec… | `npm test` |
| Synergy stress | `tests/stress-synergy.test.ts` | any build, any room: no crash, NaN, escape, cap breach, leak; bounded step time | part of `npm test` |
| Play-bot + explorer | `tests/bot.test.ts`, `tests/explorer.test.ts` | whole runs play through: every floor, track, route, ending and character | part of `npm test` |
| End-to-end | `e2e/*.spec.ts` | real WebKit on both iPhone 15 profiles: boot, touch, HUD, saves, debug menu | `npm run test:e2e` |

`npm run typecheck` / `npm run build` complete the gate. CI (`.github/workflows/deploy.yml`) runs typecheck → tests →
build → GitHub Pages on every push to `main`; the e2e job runs beside it and never blocks the deploy (on CI a failed e2e
test keeps a Playwright trace, uploaded with `test-results/`). The actions are pinned to their current major tags, all
on GitHub's Node 24 runtime (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5, upload-artifact v7);
only the deploy job holds `pages: write` / `id-token: write`. `tests/ci-workflow.test.ts` keeps that contract.

## Switches (environment variables)

| Variable | Effect |
|---|---|
| `STRESS=full` | exhaustive stress: the carrier matrix at 1 and 3 modifier stacks, 5 s each, and 1000 random stacks (≈ 40 s) |
| `STRESS_STACKS=<n>` | number of random stacks (default 120) |
| `STRESS_VERBOSE=1` | one line per stress build (avg / p99 / max, peak pool sizes, kills) |
| `BOT_FULL=1` | every character × every run kind × `BOT_SEEDS` seeds (default 3; ≈ 6 min) |
| `BOT_VERBOSE=1` | print each run's notes (teleport fallbacks, fight time-outs, top-ups) |
| `BOT_DEBUG=1` | per-fight stats (shots, hits, distance, line of sight, the build) and a map of every teleport's room |
| `EXPLORE_SEEDS`, `EXPLORE_FULL`, `EXPLORE_FIRST` | the explorer soak's seed count / whole runs / first seed |
| `PERF_SLACK=<x>` | multiplies every timing budget (default 1; **3 when `CI` is set**) |

## The synergy stress test

`tests/helpers/stress.ts` `runStress(build)` plays one build in `STRESS_ROOM` (rocks, a tinted rock, a crate, an urn, a
pit): 0.75 s at rest (the build's at-rest pool levels — orbit blades, familiars' idle shots…), then the fight (waves of a
chapter's real enemies keep coming; sometimes a boss; aim at the nearest foe, charge and release, strafe; actives,
consumables, bombs and the dash for item stacks), then the clear (fight on up to 8 s, then `clearRoom`), then settling:
every transient pool must return to its at-rest level within 25 s (projectiles, beams, swipes, allied puddles, enemy
shots, shockwaves, bombs, queued / live explosions, pending volley specs, particles), temporary effects stay bounded and
the event queue never overflows.

`checkWorld(sim, particles)` is the per-tick invariant check (shared with the bot): finite numbers everywhere, the caps
(projectiles 700, beams 48 × ≤ 384 points, swipes 16, chain arcs 32/tick, live explosions 48, explosion queue 64,
enemies 64, enemy shots 400, puddles 48, shockwaves 16, pickups 64, bombs 16, pedestals 12, particles 800, events 1024)
and nothing more than 16 px outside the room (familiars 32). The particle cap is real: a headless `WorldFx` +
`ParticleSystem` consume the events exactly like the run scene does.

A pool refuses to grow past its capacity, so "count ≤ cap" on its own could never fail. The verification pass added
the checks that can: `checkCapacities` (once per build / bot run) pins every pool's capacity to the cap ARCHITECTURE
documents, and `checkWorld` also checks what no pool enforces — orbit blades ≤ `orbitMax`, beam trace points per tick
within the shared budget (+ one half fork per beam), no enemy alive at 0 HP outside a boss's death sequence (a room
that could never clear), no event ever dropped, the player's health (0 ≤ red ≤ redMax, containers + bonus ≤ 12, no
empty bonus heart, no red at all on `noRedHearts`), coins / bombs / keys whole numbers 0-99, the active's charge (Bolt's
is fractional) within 0..max, the mechanic's burrow / firefly / soak state, and at most `TEMPS_MAX` (120) temporary
effects. `tests/verify-characters.test.ts` breaks each of these on purpose and expects `checkWorld` to say so.

Timing: sim step times per build (the particle layer is timed apart). A build whose p99 exceeds 8 ms × `PERF_SLACK` is
replayed (deterministically) up to twice and fails only if it stays slow. On a desktop the whole matrix averages ≈ 0.01
ms per step and 1000 random stacks ≈ 0.025 ms (p99 ≈ 0.3 ms).

A failing build prints its label and seed (`stack #37 (juniper, 23 items)` + the item list): `runStress` with the same
`StressBuild` replays it exactly.

## The play-bot

`tests/helpers/bot.ts` `new Bot(sim, opts).play()` / `playRun(sim, opts)` — options: `untilFloor` (14 = to the end),
`takeGrate`, `itemsPerFloor` (random treasure passives each floor, seeded), `roomLimit` / `bossLimit` (s of real
fighting before the fallback: 45 / 150), `stuckLimit` (s without progress before a teleport: 4), `maxTicks`, `onEnter`,
`onTick` (extra invariants; a returned string is a problem).

How it plays: see the file header. It only moves with the stick along an 8-way Dijkstra path over the 13 × 7 cells
(blocking tiles, pits unless flying, pedestals / props, open exits unless they're the goal; corners cut only where the
physics allows), re-planned when the goal or her cell changes, smoothed by line of sight (never within reach of an exit
that isn't the goal). Loot it can't take right now (full health, 99 coins) is skipped; a moving pickup is followed.
On a final-boss floor it saves the boss room for last and holds its actives / consumables (a teleport could land it
there); Pip burrows only at a foe, never with an open exit in the room.

The report: `problems` (the test fails on any: exceptions, invalid states, soft-locks — a room that never clears, doors
that stay shut with nothing to fight, a door that won't let her through, a boss that doesn't spawn / die, a boss that
fell without going through all its phases, an item for coins / keys that wouldn't sell after the top-up, no trapdoor,
an exit that doesn't work, a floor change without an exit, death in god mode), `notes` (teleport fallbacks, fight
time-outs, coin / key / bomb top-ups), per-floor records (boss killed by the fight or the fallback, rooms visited, secrets
bombed, things bought — only purchases a 'buy' event confirms —, chests, items), tick / walk / teleport counts, doors
walked and locks opened, boss fights and the phases they went through, and `simMs`. The coverage test asks, over the
whole-run cases, for ≥ 75 % of room entries through a door, locks opened, and more secret walls bombed, purchases and
boss fights (≥ 2 phases each) than runs.

What the default test plays (≈ 50 s, 1 M ticks ≈ 5 hours of play): each of the 8 characters one whole run — main (1-12,
Old Thunderhead, the whirlpool, 13, The Undertow → Ending 3), alt (1-12 alt, The Nestmother → Ending 2), routes (the
hidden routes forced: floor 1 main → grate → alt → rejoin at chapter 6 → Ending 1) in turn; plus one floor per main floor
1-11 with its grate forced. Together they must cover every floor of both tracks and floor 13, bomb secrets, buy, open
chests, take items and grates, and kill most bosses by fighting.

With the boss packs merged (content merge 2) every boss room it enters holds the chapter's own boss (20 bosses, 8
minibosses, the full finals); `BOT_FULL` then played 83 runs, 25 766 doors, 3 095 purchases, and only 3 boss fights
(and 49 room fights) needed the fallback after their time limit.

Bugs it found and fixed (pinned in `tests/verify-5.test.ts`): doors ignored the Dizzy Tonic's mirrored movement (no
door worked for 6 s); a prop could shove loot into the seam between two corner-touching blocks; loot dropped by a flyer
over a crate pile or a pit spawned inside it; coins lodged in the 7 px seam between two neighbouring pit lips.

## End-to-end (WebKit)

`playwright.config.ts`: two projects — `iphone15-safari` (Playwright's iPhone 15 landscape, 734 × 343) and
`iphone15-homescreen` (852 × 393, touch, DPR 3) — one worker, no retries; `webServer` builds and serves on :4173
(`reuseExistingServer`: stop your own preview server before running, or it is reused as is). Specs use `window.__SD`
(ARCHITECTURE §9) for state and real `page.touchscreen.tap()` on button centres (`__SD.button(id).css`).

Coverage of the Phase 5 checklist: boots without console errors (`boot`, every spec tracks errors); real touch taps on
menu buttons (`boot`, `menus`, `characters`); the full HUD inside the viewport / safe area (`hud`: two heart rows, 99s,
active + charge, consumable + two trinkets, minimap, pause, bomb, Pip's DASH; default / left-handed / 150 % / both; with
the iPhone insets emulated on the home-screen profile); a save surviving a reload + Continue (`save`, `content`);
multi-touch move + shoot (`touch`, `boot`); the debug menu by 5 taps on PAUSED and by keyboard, with spawns, the BOSSES
tab, god mode, reveal map, go to boss, skip floor, UNLOCK ALL / RESET UNLOCKS (`debug`). Every character PLAYED by two
synthetic thumbs (`characters-play`, home-screen profile: an in-page driver moves the floating sticks every animation
frame — strafe round the nearest foe, aim at it, lift the thumb for charge shots, tap DASH — until the wave is dead,
then checks the character's mechanic in real play), and a new player's locked roster / queued toasts / achievements page.
Content merge 2 (`bosses`, home-screen profile): one boss of each pack and a final taken through every phase in WebKit —
each phase wears its own look (`BossHook.looks`, pre-rendered), screenshots to `e2e/__screens__/boss-*`, no errors.
Screenshots from these land in `e2e/__screens__` (git-ignored) for a human look.
Polish batch 3 (mobile UX, saving, PWA): `touch` — thumbs on the letterbox (the home-screen insets emulated on
`#safe-probe`; a Safari tab's own black bars) reach full speed / fire at 0°, two sticks + a BOMB tap leave the perf
overlay alone while the three-finger hold on a menu toggles it; `hud` — right / left-handed × 75-150 % × with / without
Pip's DASH on both profiles (and with the insets): no HIT rect (`ButtonInfo.pad`) on a resting stick ring
(`__SD.stickRests()`), another button or the HUD, every run button >= 44 CSS px, and a touch on each ring centre + 6 px
gets its stick (fires, no bomb, no dash); `save` — a cleared boss room survives a reload, a background in a cleared room
keeps what was picked up, an injected exception returns to the title with the save untouched; `menus` — Import without
the keyboard, PASTE with a stubbed clipboard, backdrop taps, ENTER SEED through a rotation to portrait and back; `pwa` —
`navigator.standalone` stubbed by an init script (Safari tab / home-screen app notices) and a simulated update
(`__SD.debug.pwaUpdate()`) → RELOAD → Continue.

Stable by construction: wait on state (`waitForFunction` on `__SD`), never on fixed sleeps longer than a frame or two,
and every run is seeded or driven by debug actions.

## Adding things

- New content is picked up automatically: the stress test draws from `allItems()`, the bot plays whatever rooms, enemies
  and bosses the floors roll, the debug menu lists every item / enemy / boss.
- A new pool or cap: add it to `checkCapacities` / `checkWorld` (and to the settle levels if it is transient); a new
  invariant also gets a "breaks on purpose" case in `tests/verify-characters.test.ts`.
- A new character: add it to `e2e/characters-play.spec.ts` (`IDS` + a mechanic check) as well as tests/characters.test.ts.
- A CI change: `tests/ci-workflow.test.ts` checks the workflow as text (actions on Node-24 majors, the permissions).
- A new floor exit or special room interaction: teach the bot (`collect`, `moveOn`, `stepOnto`) so runs keep ending.
- A new timing assertion: `perfBudget(ms)` + `steadyTiming(first, budget, again)` so a busy CI box doesn't fail it.
- Feel and render numbers (polish batch 2): `tests/helpers/dps.ts` `aimedDps` (a pinned boss-sized target, perfect play) for
  "a synergy never weakens the aimed attack" checks (tests/attack-dps.test.ts); the real `WorldFx` + `ScreenShake` +
  `ParticleSystem` headless for shake / flash / particle budgets (tests/juice.test.ts, tests/particles.test.ts);
  `tests/helpers/fakeCanvas.ts` `installFakeCanvas()` (a stub `document` whose canvases accept every call and count
  them) for render caches and warm-up counts (tests/render-cache.test.ts, tests/warmup.test.ts); shot sprites are pure
  pixel maps (`render/shotPixels.ts`) a test can read directly (tests/shot-looks.test.ts). In e2e, time frames with
  `__SD.perf` / `__SD.perfFrames(since)` (raw per-frame costs and rAF gaps) — never the smoothed `renderMs` alone.
