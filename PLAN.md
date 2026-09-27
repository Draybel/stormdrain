# STORMDRAIN — Build Plan

**How to resume:** find the first unchecked box below; that phase is in progress. Read ARCHITECTURE.md (code contract),
DESIGN.md (game bible) and DECISIONS.md (choices made) first. Run `npm test` and `npm run build` to see the state.
Every phase ends with: tests green → PLAN.md updated → commit. The game must stay playable after every phase.

Priorities if time runs short: (1) feel of movement/shooting/synergies, (2) mobile controls + saving, (3) content volume.

## Phase 0 — Scaffold
- [x] git repo, package.json, Vite 8 / TypeScript 7 / Vitest 5 / Playwright 1.63 (WebKit installed)
- [x] tsconfig, vite.config (base './'), playwright.config (iPhone 15 landscape profiles), .gitignore
- [x] ARCHITECTURE.md, DESIGN.md, PLAN.md, DECISIONS.md

## Phase 1 — Engine core (boots on iPhone, Wren moves and shoots in a room)
- [x] index.html with iOS full-screen meta tags, safe-area CSS, no scroll/zoom/select/callout
- [x] Display: 384×192 back-buffer, nearest-neighbor scale-to-fit inside safe area, letterbox, DPR aware, resize/orientation
- [x] Fixed 60 Hz loop with accumulator; perf counters
- [x] Input: pointer multi-touch floating sticks (4-dir snap + 360 option), buttons hit-tested first; keyboard
- [x] Seeded RNG, math/vec utils, pools, event ring buffer
- [x] Sprite system (pixel maps + palettes → cached canvases, flash variants), pixel font, Wren sprite w/ walk/hurt/death
- [x] Audio engine with iOS unlock, a few procedural SFX
- [x] Scene manager (title → run), rotate-phone screen, lifecycle pause
- [x] Headless `Sim` skeleton stepping in node; first vitest tests; playwright boot smoke test
- [x] Independent verification pass: Input unit tests + multi-touch/safe-area e2e, portrait tap-through fix,
      movement retune (0.08 s start / 0.1 s stop), glyph/HUD/glow/splash visual fixes, debug events no longer lost

## Phase 2 — Combat & the attack pipeline
- [x] Types for items/effects/stats; content registries via import.meta.glob with duplicate-id checks (2A)
- [x] Stats computation (add → mul → clamps), health model (red, Tin, Ember, half hearts), i-frames (2A)
- [x] Attack pipeline: AttackProfile, carriers (marble, lance, laser, boomerang, melee, bomb, charge, orbit) with rider merges
      (2B: `sim/attack/`, fireVolley as the single entry point, every carrier pair merges, carrier copies stack,
      Wren's keeper marble, guardrails that merge instead of dropping)
- [x] All shot modifiers (spawn / motion / hit / expire stages), beam tracing via virtual projectile
      (2B: all 29, stacking table in ARCHITECTURE §4.5; beams fork, bounce, bend, ring, sweep; trace budget)
- [x] ShotStyle composition (color/size/shape/trail), cached shot sprites, beam rendering with glow
      (2B: accents, trails, costume layers — Storm Lance aura + eyes)
- [x] Storm Lance full treatment (charge meter, flash, shake, boom, crackle)
- [x] Familiars inheriting the profile (2B: follower chain, orbiters; Lamplet, Paper Boat, Bottlecap Beetle)
- [x] Enemy behaviour library + ~6 enemies, enemy projectiles, contact damage, knockback, status effects (2C: 13
      movement kinds, 9 attack kinds, 3 death effects; 8 Gutterways enemies; enemy shots/creep/shockwaves; statuses on
      enemies + dummies; unified Hittable interface; 7 champion variants; training-yard arena with doors + room clear)
- [x] Room grid collisions: rocks, pits, spikes, fire, crates, urns, metal; bombs (placed) & explosions (2A)
- [x] Pickups (coins, bombs, keys, hearts, spark cells, chests) + item pedestals + pickup name/description banner (2A)
- [x] Inventory (passives w/ duplicates, active + charge room/timed, trinket & consumable slots, counters), effect
      engine (stat/heal/hearts/pickups/flag/trigger/hook; mod/carrier/familiar recorded for the pipeline), HUD
      (hearts, counters, charge bar, item icons, banner), training yard with every prop/pickup kind (2A)
- [x] ~20 starter items covering every carrier & modifier; particles & screen shake & hit flash
      (2A: 14 items — 6 stat items + one of each active/passive/trinket/consumable flavour; 2B: 7 carriers,
      3 familiars, 29 modifier items)
- [x] Starter item set + debug spawner (2D): 7 attack types, 19 modifier items, 5 weird items, 6 familiars (every
      carrier and modifier covered, hand-drawn icons, costumes on major items, DESIGN set tags); hidden debug menu
      (Backquote / 5 taps on PAUSED: spawn/give any item, spawn any enemy, god mode, heal, +10 pickups, clear room,
      waves, perf overlay); training yard with rotating pedestals, a wave bell and endless waves;
      tests/starter-items.test.ts + e2e/debug.spec.ts
- [x] Independent verification pass (Phase 2): composition detector + tests (no modifier pair silently replaces
      another on any primary; every hit / status modifier lands through every delivery), homing reachability,
      tiny-planet / spiral / beam-speed / phase / ring / bomb+explode / beam-slot / swipe-cap fixes, cosmetic event
      cap, charmed allies spared by your blasts, debug spawns on free floor, beam render 79 → 9 ms with 48 lances
      (filled outlines, lite mode, room clip), every-item ×3 perf + determinism tests, WebKit visual pass
- [x] Unit tests: stats, item effects, every carrier × modifier pair smoke test
      (2A: stats, health, inventory swaps, pickups, chests, bombs, drop tables, triggers; 2B: tests/attack-pairs.test.ts —
      every carrier × modifier, every carrier pair, 1 and 5 stacks, targeted behaviour, all modifiers ×5 perf/caps)

## Phase 3 — Floors, rooms & bosses
Side tracks merged after Phase 2 (standalone, tested modules; see docs/floorgen.md, docs/audio.md, docs/saving.md):
floor generator + room templates + minimap model (`src/sim/floor`), music + SFX library (`src/audio/music`,
`src/audio/sfxLibrary.ts`), saves + PWA (`src/meta`, `src/pwa`). The next agent starts by wiring them in.
- [x] Wire the side-track modules into the run: floor generator (docs/floorgen.md "Integration checklist": door and
      secret-wall tiles, transitions, marker spawning, nook, grate, curse effects, minimap rendering, saving the
      layout) and music cues (docs/audio.md "Suggested wiring": title, floor start / trapdoor sting, boss intros,
      shop / secret rooms, item fanfare, game over, pause muffle)
      (3A: `src/sim/run` — New Run is a real run; every checklist item but the hidden-route grate (M2's track
      switching; see the status table in docs/floorgen.md); `Sim.snapshot()` / `Sim.fromSnapshot()` store the whole
      layout; all the music cues above)
- [x] Floor generator (grid, room count by depth, dead ends, all special room placement rules, secret hints)
      (module done, integration pending) — `src/sim/floor`: tree maps on an 11×11 grid, boss at the farthest dead
      end, treasure / shop / miniboss / challenge / cursed, secret + deep secret, Broker's Nook cell, hint walls,
      hidden-route grate, final-boss flags, seeded curses; deterministic, ≈0.03 ms per floor
- [x] Room templates schema + ~12 templates; chapter data for chapter 1; tile rendering per chapter palette
      (schema, validation, mirroring and seeded picking + 25 generic templates covering all 11 room types; 3A: all 12
      ChapterDefs got palettes, tilesets (6 floor × 5 wall patterns, recoloured per chapter) and decor — decals, wall
      trims, ambience; rooms render in their chapter's look)
- [x] Doors (normal, locked, boss, treasure lock, secret wall, cursed spikes), room transitions & clearing, rewards
      (2C: combat flow in sim/arena.ts; 3A: door kinds + frames, key locks, bombable secret walls with hints, Thorn Room
      toll, camera-slide transitions with spawn safety, challenge waves, clears + seeded rewards)
- [x] HUD (hearts, coins/bombs/keys, active + charge, consumable/trinket, minimap w/ tap-to-expand)
      (3A: compact minimap in its slot, tap / Tab → the big map overlay (pauses), Lost Map '?', curse icon)
- [x] Boss framework (phases ≥2, patterns, HP bar, intro card) + 1 boss + 1 miniboss; trapdoor to next floor
      (3A: the trapdoor; 3B: `src/sim/bosses` — BossDef phases with thresholds, a 15-kind pattern library composed by
      data + per-boss hooks, roar / invulnerability / colour shift on phase changes, split parts, orbiting shields,
      enemy beams, the death sequence (chain explosions, slow motion, flash) → pedestal + heart + trapdoor, seeded
      selection per chapter (union rule); HP bar + intro card; content: Sodden Snarl, Brimwell, Pipewhip (miniboss)
      and placeholder-but-playable Old Thunderhead / The Nestmother / The Undertow)
- [x] Shop, treasure room, secret rooms, challenge arena, cursed room, Broker's Nook, donation jar, slot machine, trader
      (3A: treasure, secret / deep secret, challenge, cursed (toll), the nook and priced shop items; 3B: Magpie + goods
      for sale + haggler + the donation jar, the Gumball Gambler, Old Pell (3 keys), the arena's pressure plate + 3
      waves, Thorn Room chest-or-item, the Forgotten Pocket's better item or big loot, the Moth Broker's two-deal choice
      with the Tin-heart price; seen / locked items leave the pools)
- [x] Floor progression through chapter list (main/alt tracks), floor transition effect
      (3A: trapdoor → next floor on the same track, iris + floor card; 3B: the hidden-route grate → the alt track, the
      alt route into chapter 6 behind Ending 1, final bosses → endings 1 / 2, the whirlpool → floor 13 → ending 3)
- [x] Unit tests: floor generation over thousands of seeds (reachability + special rooms)
      (tests/floorgen.test.ts: 5000 seeds × 13 floors × 2 tracks, determinism, pinned fingerprint, templates;
      tests/floorminimap.test.ts)

## Phase 4 — Meta, saving & mobile polish
- [x] Wire the save/PWA modules in (docs/saving.md): stores + `meta.endTick()` + `registerServiceWorker()` in
      main.ts, `saveRunNow()` → `RunSaveStore` + `meta.flush()`, a Sim snapshot / restore, notices for restored /
      corrupt / newer saves, save-survives-reload e2e, iPhone Add to Home Screen + offline check
      (3A: the Sim snapshot / restore API; 4A: `meta/save.ts` `GameSave` — meta saves at the end of the tick / every 5 s,
      the run save at run start, every room entry, pause, background and quit-to-title, cleared on death / victory,
      abandoned by a New Run; Continue on the title restores the exact room; persisted settings; toasts for restored /
      damaged / newer-version / no-storage saves; the service worker registered in production; e2e/save.spec.ts (reload →
      Continue) + e2e/pwa.spec.ts (manifest, icons, sw.js, registration). A real iPhone Add to Home Screen + airplane-mode
      check still needs a device)
- [x] Versioned save envelope + migrations; meta save on change; run autosave on room transition + background
      — `src/meta`: checksummed `{ v, data, sum }` slots with `.bak` / `.corrupt`, step-by-step migrations,
      `MetaStore` (end-of-tick / 5 s saves), `RunSaveStore`; wired in 4A (above)
- [x] Title (Continue / New Run / Daily / Seed / Collection / Bestiary / Stats / Achievements / Settings)
      (4A: Continue / New Run / Settings + the save notice line; 4B: the play column in the arch, page tiles on the walls,
      Settings in the corner, the daily tick, keyboard navigation (`MenuNav`) — every button >= 27 game px ≈ 45 pt)
- [x] Character select (locked silhouettes), seed entry (DOM input modal), daily run
      (4B: `ui/characterSelect.ts` — N characters, paged strip, silhouettes + unlock hints, stat bars, START; 8-character seed
      codes `meta/seedCode.ts` + `RunSeedInfo` in RunData; the DOM modal layer `ui/domModal.ts`; the daily seed from the UTC
      date, one scored attempt per day claimed at start, practice replays; seeded runs = practice (no run feats / endings))
- [x] Pause menu with stats + items; settings (volumes, aim mode, shake, button size, left-handed?); save export/import
      (4B: pause — character, floor, seed, curse, time, six stats with icons, item grid (tap to read), active + charge,
      trinkets, consumable, transformations; settings — master / music / sfx / shake sliders (drag + tap), show fps, aim
      4-way / 360°, left-handed (sticks + thumb columns swap), button size 75-150 %, export (select all + copy) / import
      (validate → confirm → replace) DOM modals; the secret 5 taps on PAUSED still open the debug menu)
- [x] Achievements framework + unlocks (items, characters, routes, endings)
      (4A: `meta/achievements.ts` — counter + event conditions with id / value / at-least filters, rewards into the
      meta unlock sets incl. items / characters naming the achievement, trophy toast + sfx; `meta/tracker.ts` records the
      collection, bestiary, lifetime stats, counters and daily results from a run's events; `meta/unlocks.ts` — locked
      items never roll (pedestals, shops, drop tables) and new runs carry the unlock snapshot incl. 'ending1' / 'ending2';
      15 achievements in `content/achievements/core.ts`, 6 starter items locked behind them)
- [x] Collection, bestiary, stats and achievements pages (the data is all in `MetaState` / `__SD.meta()`)
      (4B: collection '?' / silhouette / colour / padlock grid + details; bestiary foes / bosses with counts and animated
      sprites; stats in two scrolling columns incl. the daily results; achievements with dates, rewards and hidden ones;
      game-over screen (killer, floor, seed, items, time; retry seed / new run / title); e2e/menus.spec.ts)
- [x] PWA: manifest, generated icons, service worker (offline), iOS meta tags; GitHub Pages base path
      (4A: `registerServiceWorker()` + `requestPersistentStorage()` called from main.ts) — `public/manifest.webmanifest`,
      `npm run icons`, build-time `dist/sw.js` (scripts/sw-plugin.mjs), relative URLs for any Pages sub-path
- [x] Unit tests: save round-trip + migrations + export/import
      (tests/save-*.test.ts, tests/pwa-*.test.ts; 4A: tests/save-continue.test.ts (snapshot → RunSaveStore → reload →
      restore), tests/meta-progress.test.ts, tests/achievements.test.ts, tests/sets-synergies.test.ts)
- [x] Independent verification pass (Phases 3-4): a god-mode explorer (tests/helpers/explorer.ts) over 200 seeds × floors
      1-4 + whole runs to all three endings + 1 221 snapshot forks that must retrace the original; a real-WebKit touch
      playthrough (title → character → run → rooms, fights, items, shop, secret wall, boss, trapdoor, pause, stats, quit,
      Continue) with screenshots; save robustness (background mid-room, reload, damaged / newer / v0 saves, export /
      import); HUD vs playfield / safe area / left-handed / 150 % buttons. Fixed: the nook's shared room object (restores
      diverged), the boss reward next to the hatch (grabbing it dropped you through), loot resting on floor exits, a fully
      damaged run save silently dropping Continue, damaged / old meta not written back, a false "GAME UPDATED" toast on
      first visits (WebKit service-worker event order), stale room notices, the lingering boss card, bright empty-slot icons,
      "1 RUNS" wording (tests/explorer.test.ts, tests/verify-3-4.test.ts, tests/pwa-sw.test.ts, e2e/save.spec.ts)
- [x] Item-set transformations engine + special synergy engine (4A, sim/effects.ts): 'need' distinct set items →
      'transform' (fanfare, big banner, costume layers swap, style, persistent effects as a loadout source, one-time
      instants + hook), kept for the run and saved; synergies switch on / off with the inventory, style overrides,
      'SYNERGY: NAME' pill the first time; the set / synergy CONTENT is Phase 6 (content agents)

## Phase 5 — Test infrastructure & tools
Guide: docs/testing.md (layers, switches, the stress harness, the bot, e2e coverage, CI).
- [x] Synergy stress test (all carrier×modifier pairs + hundreds of 10–30 item stacks; crashes/NaN/object counts/frame time)
      (Phase 5: tests/stress-synergy.test.ts + tests/helpers/stress.ts — every carrier × every modifier and every carrier pair
      vs waves of real enemies (+ bosses), 120 seeded random stacks from ALL items through the pickup flow for every character
      (`STRESS=full`: the matrix at 1 and 3 stacks + 1000 stacks); per-tick NaN / caps (incl. the presentation particles) /
      bounds, pools back to rest after the clear, avg / p99 / max step time with a sustained-p99 budget. Clean: ≈ 1 M ticks,
      p99 ≈ 0.3 ms, no leaks)
- [x] Headless god-mode bot plays every floor (all tracks & finals)
      (Phase 3-4 verification: tests/helpers/explorer.ts — every floor 1-13, both tracks via grates, all three finals and
      endings; tests/explorer.test.ts, `EXPLORE_SEEDS` / `EXPLORE_FULL` for longer soaks. Phase 5: the play-bot
      tests/helpers/bot.ts + tests/bot.test.ts — walks rooms through doors on grid paths (teleport only when stuck, logged),
      fights with the real pipeline and random items, bombs, keys, chests, shops, bosses, trapdoor / grate / whirlpool;
      every character over main 1-12 + 13, alt 1-12 and the forced hidden routes (`RunOptions.hiddenRouteChance`), a grate
      on each main floor 1-11; `BOT_FULL` = 8 characters × 3 kinds × 3 seeds. Found and fixed: Dizzy Tonic doors, loot
      shoved into block seams by props, loot spawned inside crates / pits, coins lodged between pit lips — tests/verify-5.test.ts)
- [x] Playwright WebKit e2e: boot w/o console errors, touch taps on menu buttons, HUD fully on screen, save survives reload
      (boot / touch / floors specs; 4A: e2e/save.spec.ts — a run save survives a reload and Continue resumes it; Phase 5:
      e2e/hud.spec.ts — the full HUD (two heart rows, counters, active + charge, consumable + trinkets, minimap, pause, bomb,
      Pip's DASH) inside the image / viewport / safe area and off the room in four layouts and with the iPhone insets)
- [x] Hidden debug menu (spawn item/enemy, god mode, skip floor, reveal map)
      (2D: menu + items / foes / cheats; 3A: skip floor, reveal map, go to boss, next curse, training yard, new run;
      `__SD.debug.runAt(floor, track, curse, seed)`; Phase 5: a BOSSES tab (fight any boss here), UNLOCK ALL / RESET UNLOCKS
      (second tap confirms), keys 1-4; e2e/debug.spec.ts drives it all by touch and keyboard in a floor run)
- [x] GitHub Actions: test + deploy to GitHub Pages on push
      (Phase 5: .github/workflows/deploy.yml — npm ci, typecheck, test, build, upload-pages-artifact + deploy-pages
      (pages / id-token permissions, one `pages` concurrency group), plus a non-blocking WebKit e2e job; timing budgets get
      3× slack on CI (tests/helpers/perf.ts))
- [x] Independent verification pass (characters + achievements, Phase 5 tooling): every character played in WebKit by two
      synthetic thumbs with its mechanic checked (e2e/characters-play.spec.ts, screenshots of the select cards, fights,
      locked roster, toasts, achievements page); the stress / bot invariants made able to fail (pool capacities pinned to
      the documented caps, orbit blades, beam trace budget, 0-HP enemies, dropped events, health / counters / charge /
      mechanic state) and proven to (tests/verify-characters.test.ts); the bot counts only real purchases, checks every
      boss goes through all its phases, counts doors / locks; BOT_FULL (83 runs) and STRESS=full clean. Fixed: Sable's
      pickpocket paid a boss again and again once an add's uid shared its slot; the CI build job's configure-pages step
      (no pages permission) and Node-20 action majors; no e2e traces on CI; the achievement count (53, not 54); the
      character card's stat rows running into the loadout line (tests/ci-workflow.test.ts pins the workflow)

## Phase 6 — Content expansion (parallel)
- [x] Passive items → 100+
      (content merge: 129 passives — 45 starter + items pack A 42 (docs/content-itemsA.md) + pack B 42
      (docs/content-itemsB.md); 5 + 4 new familiars; costumes on the major items; every set member tagged)
- [x] Active items → 25+ (charge bars), trinkets → 30+, consumables → 20+ (incl. 10 mystery Tonics)
      (content merge, items pack C (docs/content-items-c.md): 28 actives, 34 trinkets, 23 consumables — 10 Mystery Tonic
      bottles dealt from the run seed and saved with the run, 11 stickers; map / teleport items wired to the floor run)
- [x] Enemies → 40+ with champion variants (2C: 8 chapter 1 enemies + all 7 champion variants)
      (content merge: 56 enemies — 53 in chapter pools (every chapter ≥ 3) + the Glint Mite minion + 2 boss minions; enemy
      packs A (chapters 1 alt-3, 23) and B (chapters 4-6, 22), behaviours bounce / lurk / intercept / swoop / ambush and
      spiral / stream; docs/content-enemies-a.md, -b.md)
- [x] Bosses → 20+, minibosses → 8+, final bosses → 3 (each with ≥2 phases)
      (3B: the framework + 2 Gutterways bosses, 1 miniboss and placeholder versions of the 3 finals; content merge 2:
      20 bosses, 8 minibosses, 3 finals — boss packs A (Drowned Nursery, Rootcellar, Candlewick Crypt + 2 minibosses,
      docs/content-bosses-a.md), B (Grinding Works, Rust Foundry, Mushroom Hollow, Glimmer Grotto + 2,
      docs/content-bosses-b.md), C (Bone Orchard, Frostbitten Vault, Eye of the Storm, Hollow Nest + 3,
      docs/content-bosses-c.md): every chapter has a boss and a miniboss of its own, 2-3 phases each with a new look
      per phase (`BossHook.looks`), HP rising with depth, 9 new pattern kinds; the full finals (docs/content-finals.md):
      Old Thunderhead 3 phases (walking lightning, rain curtains, wind, a blackout), The Nestmother 3 (larvae, stinger
      dives, paper walls), The Undertow 4 (the pull, flung debris, spout tentacles), a sprite per phase, themed
      send-offs (`BossHook.dying`), 8 new pattern kinds; ids, keys and endings unchanged)
- [x] Room templates → 60+ across chapters; 12 chapter themes (6 main + 6 alt); floor curses
      (97 templates: 25 generic + 60 chapter rooms (5 per chapter) + 12 special variants (docs/content-rooms.md); 3A: the 12
      chapter looks and all six curse effects)
- [x] 8+ item sets (transformations)
      (content merge: the nine DESIGN.md sets, need 3 of 5-6 members each — Stormcaller, Mothkin, Clockwork, Sporeling, Waxen
      (pack A), Toybox, Ossuary, Tidewalker, Glimmer (pack B) — each with its costume, style and bonus, through the 4A engine)
- [x] Characters → 7 with unique mechanics; achievements & unlock chain
      (4A: the achievement framework and 15 first achievements; characters pass: Pip (burrow dash + DASH button / Shift),
      Marrow (Tin only + boomerang), Juniper (firefly jar), Bolt (charge rider + wind-up actives), Sable (melee, pickpocket,
      haggler), Mosswick (puddles + soak) and the secret Drizzle (floats, cloudburst when hit) — original 14×16 sprites in
      Wren's frame layout, `sim/mechanics.ts`, `innate` effects; 53 achievements (core / heroes / milestones) with badge
      icons and reward lines, 45 gated items, character / route unlocks, robbing Magpie's jar; docs/characters.md;
      tests/characters.test.ts, tests/achievements-content.test.ts, e2e/characters.spec.ts)
- [x] 40+ hand-crafted special synergies + SYNERGIES.md
      (4A: the synergy engine is verified and tested; synergies pass: 63 synergies in 7 files (lance, carriers, elements,
      sets, trinkets, actives, oddities) with 26 generic `syn.*` hooks (sky bolts, forking lightning, steam cones,
      tethers, lassos, puddles…), a look of their own each, SYNERGIES.md checked against the data; docs/content-synergies.md;
      content merge 2: requirements read a per-recompute index of what is held — O(1) per requirement)
- [x] Music: unique loop per chapter (+ boss/final themes); full SFX set
      (module done, integration pending) — 27 tracks in `src/content/music` (title, 12 chapter loops, 3 boss,
      miniboss, 3 finals, shop, secret, jingles, stingers), `app.audio.music` director, ~60-recipe SFX library on
      top of the Phase 2 sounds; wired into the title / runs / pause in Phase 3A
- [x] Hidden routes to alt chapters; endings 1–3 with ending screens
      (3B: routes, whirlpool and endings flow done with run options standing in for the meta unlocks; 4A: 'ending1' /
      'ending2' / item unlocks now come from the meta save; 4B: the ending screens — a painted vignette and a typed epilogue
      per ending, unlock notices, the run summary; the floor card got its opening animation and a floor-progress track.
      Content merge 2: the full final bosses replaced the 3B placeholders — see "Bosses → 20+")

## Phase 7 — Integration, balance & performance
- [x] Merge all content; full test suite green; bot clears every floor/track
      (content merge 1: items A / B / C, enemies A / B and room templates merged into main — 46 unit-test files (2 179 tests), e2e green,
      the explorer clean over 200 seeds × floors 1-4 + 10 whole runs; characters pass: characters + achievements done on main;
      content merge 2: boss packs A / B / C, the finals and the synergies merged — tests/content-integration-bosses.test.ts
      (own boss / miniboss per chapter in real runs, finals' endings, phase looks, UNDER THE ROOTS, a synergy in a run →
      IT CLICKS); totals: 129 passives, 28 actives, 34 trinkets, 23 consumables, 56 enemies, 20 bosses, 8 minibosses,
      3 finals, 97 room templates, 9 sets, 63 synergies, 53 achievements, 8 characters; the play-bot over every floor /
      track with the new bosses (default + BOT_FULL: 83 runs, 3 of the boss fights needed the fallback), the synergy stress
      test (+ STRESS=full), 62 unit-test files (2 652 tests), build and e2e (98 passed, 12 skipped by design) green)
- [ ] Perf pass on absurd builds (projectile/particle caps, no hot-loop allocations); 60 fps target
- [ ] Balance pass (drop rates, prices, boss HP, item pools, unlock pacing)

## Phase 8 — Polish
- [ ] Juice pass (hit-stop, shake, flashes, floor transition), Storm Lance showcase, costume layers
- [ ] Mobile UX pass (button sizes, safe areas, tap targets), e2e re-run on both iPhone viewports

## Phase 9 — Docs & finish
- [ ] README.md (beginner GitHub + Pages + iPhone home screen guide; separate saves warning)
- [ ] SYNERGIES.md complete; DECISIONS.md complete; final summary
