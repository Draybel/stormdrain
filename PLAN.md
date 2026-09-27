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
- [ ] Attack pipeline: AttackProfile, carriers (marble, lance, laser, boomerang, melee, bomb, charge, orbit) with rider merges
- [ ] All shot modifiers (spawn / motion / hit / expire stages), beam tracing via virtual projectile
- [ ] ShotStyle composition (color/size/shape/trail), cached shot sprites, beam rendering with glow
- [ ] Storm Lance full treatment (charge meter, flash, shake, boom, crackle)
- [ ] Familiars inheriting the profile
- [x] Enemy behaviour library + ~6 enemies, enemy projectiles, contact damage, knockback, status effects (2C: 13
      movement kinds, 9 attack kinds, 3 death effects; 8 Gutterways enemies; enemy shots/creep/shockwaves; statuses on
      enemies + dummies; unified Hittable interface; 7 champion variants; training-yard arena with doors + room clear)
- [x] Room grid collisions: rocks, pits, spikes, fire, crates, urns, metal; bombs (placed) & explosions (2A)
- [x] Pickups (coins, bombs, keys, hearts, spark cells, chests) + item pedestals + pickup name/description banner (2A)
- [x] Inventory (passives w/ duplicates, active + charge room/timed, trinket & consumable slots, counters), effect
      engine (stat/heal/hearts/pickups/flag/trigger/hook; mod/carrier/familiar recorded for the pipeline), HUD
      (hearts, counters, charge bar, item icons, banner), training yard with every prop/pickup kind (2A)
- [ ] ~20 starter items covering every carrier & modifier; particles & screen shake & hit flash
      (2A: 14 items — 6 stat items + one of each active/passive/trinket/consumable flavour; carrier/mod items → 2B)
- [ ] Unit tests: stats, item effects, every carrier × modifier pair smoke test
      (2A done: stats, health, inventory swaps, pickups, chests, bombs, drop tables, triggers; carrier × mod → 2B)

## Phase 3 — Floors, rooms & bosses
- [ ] Floor generator (grid, room count by depth, dead ends, all special room placement rules, secret hints)
- [ ] Room templates schema + ~12 templates; chapter data for chapter 1; tile rendering per chapter palette
- [ ] Doors (normal, locked, boss, treasure lock, secret wall, cursed spikes), room transitions & clearing, rewards
      (2C: combat flow — waves at `e`/`E` markers, barred doors while enemies live, roomClear + reward drop — in sim/arena.ts)
- [ ] HUD (hearts, coins/bombs/keys, active + charge, consumable/trinket, minimap w/ tap-to-expand)
      (everything but the minimap was done in Phase 2A)
- [ ] Boss framework (phases ≥2, patterns, HP bar, intro card) + 1 boss + 1 miniboss; trapdoor to next floor
- [ ] Shop, treasure room, secret rooms, challenge arena, cursed room, Broker's Nook, donation jar, slot machine, trader
- [ ] Floor progression through chapter list (main/alt tracks), floor transition effect
- [ ] Unit tests: floor generation over thousands of seeds (reachability + special rooms)

## Phase 4 — Meta, saving & mobile polish
- [ ] Versioned save envelope + migrations; meta save on change; run autosave on room transition + background
- [ ] Title (Continue / New Run / Daily / Seed / Collection / Bestiary / Stats / Achievements / Settings)
- [ ] Character select (locked silhouettes), seed entry (DOM input modal), daily run
- [ ] Pause menu with stats + items; settings (volumes, aim mode, shake, button size, left-handed?); save export/import
- [ ] Achievements framework + unlocks (items, characters, routes, endings); collection, bestiary, stats pages
- [ ] PWA: manifest, generated icons, service worker (offline), iOS meta tags; GitHub Pages base path
- [ ] Unit tests: save round-trip + migrations + export/import

## Phase 5 — Test infrastructure & tools
- [ ] Synergy stress test (all carrier×modifier pairs + hundreds of 10–30 item stacks; crashes/NaN/object counts/frame time)
- [ ] Headless god-mode bot plays every floor (all tracks & finals)
- [ ] Playwright WebKit e2e: boot w/o console errors, touch taps on menu buttons, HUD fully on screen, save survives reload
- [ ] Hidden debug menu (spawn item/enemy, god mode, skip floor, reveal map)
- [ ] GitHub Actions: test + deploy to GitHub Pages on push

## Phase 6 — Content expansion (parallel)
- [ ] Passive items → 100+
- [ ] Active items → 25+ (charge bars), trinkets → 30+, consumables → 20+ (incl. 10 mystery Tonics)
- [ ] Enemies → 40+ with champion variants (2C: 8 chapter 1 enemies + all 7 champion variants)
- [ ] Bosses → 20+, minibosses → 8+, final bosses → 3 (each with ≥2 phases)
- [ ] Room templates → 60+ across chapters; 12 chapter themes (6 main + 6 alt); floor curses
- [ ] Characters → 7 with unique mechanics; achievements & unlock chain; 8+ item sets (transformations)
- [ ] 40+ hand-crafted special synergies + SYNERGIES.md
- [ ] Music: unique loop per chapter (+ boss/final themes); full SFX set
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
