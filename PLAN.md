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
- [ ] Wire the side-track modules into the run: floor generator (docs/floorgen.md "Integration checklist": door and
      secret-wall tiles, transitions, marker spawning, nook, grate, curse effects, minimap rendering, saving the
      layout) and music cues (docs/audio.md "Suggested wiring": title, floor start / trapdoor sting, boss intros,
      shop / secret rooms, item fanfare, game over, pause muffle)
- [x] Floor generator (grid, room count by depth, dead ends, all special room placement rules, secret hints)
      (module done, integration pending) — `src/sim/floor`: tree maps on an 11×11 grid, boss at the farthest dead
      end, treasure / shop / miniboss / challenge / cursed, secret + deep secret, Broker's Nook cell, hint walls,
      hidden-route grate, final-boss flags, seeded curses; deterministic, ≈0.03 ms per floor
- [ ] Room templates schema + ~12 templates; chapter data for chapter 1; tile rendering per chapter palette
      (schema, validation, mirroring and seeded picking + 25 generic templates covering all 11 room types: module
      done, integration pending; chapter 1 data exists as the 2C stand-in; tile rendering per chapter palette to do)
- [ ] Doors (normal, locked, boss, treasure lock, secret wall, cursed spikes), room transitions & clearing, rewards
      (2C: combat flow — waves at `e`/`E` markers, barred doors while enemies live, roomClear + reward drop — in sim/arena.ts)
- [ ] HUD (hearts, coins/bombs/keys, active + charge, consumable/trinket, minimap w/ tap-to-expand)
      (everything but the minimap was done in Phase 2A; the minimap knowledge model — visited / seen / mapped,
      reveal items, Lost Map curse — is in `src/sim/floor/minimap.ts`, rendering + tap-to-expand to do)
- [ ] Boss framework (phases ≥2, patterns, HP bar, intro card) + 1 boss + 1 miniboss; trapdoor to next floor
- [ ] Shop, treasure room, secret rooms, challenge arena, cursed room, Broker's Nook, donation jar, slot machine, trader
- [ ] Floor progression through chapter list (main/alt tracks), floor transition effect
      (the generator already knows tracks, `chapterOfFloor`, `isFinalFloor`, `finalBossFor`)
- [x] Unit tests: floor generation over thousands of seeds (reachability + special rooms)
      (tests/floorgen.test.ts: 5000 seeds × 13 floors × 2 tracks, determinism, pinned fingerprint, templates;
      tests/floorminimap.test.ts)

## Phase 4 — Meta, saving & mobile polish
- [ ] Wire the save/PWA modules in (docs/saving.md): stores + `meta.endTick()` + `registerServiceWorker()` in
      main.ts, `saveRunNow()` → `RunSaveStore` + `meta.flush()`, a Sim snapshot / restore, notices for restored /
      corrupt / newer saves, save-survives-reload e2e, iPhone Add to Home Screen + offline check
- [x] Versioned save envelope + migrations; meta save on change; run autosave on room transition + background
      (module done, integration pending) — `src/meta`: checksummed `{ v, data, sum }` slots with `.bak` /
      `.corrupt`, step-by-step migrations, `MetaStore` (end-of-tick / 5 s saves), `RunSaveStore`; the autosave
      call sites and the Sim snapshot come with the wiring item above
- [ ] Title (Continue / New Run / Daily / Seed / Collection / Bestiary / Stats / Achievements / Settings)
- [ ] Character select (locked silhouettes), seed entry (DOM input modal), daily run
- [ ] Pause menu with stats + items; settings (volumes, aim mode, shake, button size, left-handed?); save export/import
      (export / import codes `SD1:` are done in `src/meta/exportCode.ts`; the menus and the DOM modal to do)
- [ ] Achievements framework + unlocks (items, characters, routes, endings); collection, bestiary, stats pages
      (the saved data — unlocks, achievements, counters, collection, bestiary, lifetime stats, daily results — is in
      `MetaState`; the framework and pages to do)
- [x] PWA: manifest, generated icons, service worker (offline), iOS meta tags; GitHub Pages base path
      (module done, integration pending: call `registerServiceWorker()` from main.ts) — `public/manifest.webmanifest`,
      `npm run icons`, build-time `dist/sw.js` (scripts/sw-plugin.mjs), relative URLs for any Pages sub-path
- [x] Unit tests: save round-trip + migrations + export/import
      (tests/save-*.test.ts, tests/pwa-*.test.ts)

## Phase 5 — Test infrastructure & tools
- [ ] Synergy stress test (all carrier×modifier pairs + hundreds of 10–30 item stacks; crashes/NaN/object counts/frame time)
- [ ] Headless god-mode bot plays every floor (all tracks & finals)
- [ ] Playwright WebKit e2e: boot w/o console errors, touch taps on menu buttons, HUD fully on screen, save survives reload
- [ ] Hidden debug menu (spawn item/enemy, god mode, skip floor, reveal map)
      (2D: menu + items / foes / cheats done; skip floor and reveal map wait for the Phase 3 floors)
- [ ] GitHub Actions: test + deploy to GitHub Pages on push

## Phase 6 — Content expansion (parallel)
- [ ] Passive items → 100+
- [ ] Active items → 25+ (charge bars), trinkets → 30+, consumables → 20+ (incl. 10 mystery Tonics)
- [ ] Enemies → 40+ with champion variants (2C: 8 chapter 1 enemies + all 7 champion variants)
- [ ] Bosses → 20+, minibosses → 8+, final bosses → 3 (each with ≥2 phases)
- [ ] Room templates → 60+ across chapters; 12 chapter themes (6 main + 6 alt); floor curses
      (25 generic templates so far; the generator rolls curses — their effects to do)
- [ ] Characters → 7 with unique mechanics; achievements & unlock chain; 8+ item sets (transformations)
- [ ] 40+ hand-crafted special synergies + SYNERGIES.md
- [x] Music: unique loop per chapter (+ boss/final themes); full SFX set
      (module done, integration pending) — 27 tracks in `src/content/music` (title, 12 chapter loops, 3 boss,
      miniboss, 3 finals, shop, secret, jingles, stingers), `app.audio.music` director, ~60-recipe SFX library on
      top of the Phase 2 sounds; the game doesn't call the music yet (Phase 3 wiring item)
- [ ] Hidden routes to alt chapters; endings 1–3 with ending screens

## Phase 7 — Integration, balance & performance
- [ ] Merge all content; full test suite green; bot clears every floor/track
- [ ] Perf pass on absurd builds (projectile/particle caps, no hot-loop allocations); 60 fps target
- [ ] Balance pass (drop rates, prices, boss HP, item pools, unlock pacing)

## Phase 8 — Polish
- [ ] Juice pass (hit-stop, shake, flashes, floor transition), Storm Lance showcase, costume layers
- [ ] Mobile UX pass (button sizes, safe areas, tap targets), e2e re-run on both iPhone viewports

## Phase 9 — Docs & finish
- [ ] README.md (beginner GitHub + Pages + iPhone home screen guide; separate saves warning)
- [ ] SYNERGIES.md complete; DECISIONS.md complete; final summary
