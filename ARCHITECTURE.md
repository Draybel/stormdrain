# STORMDRAIN — Architecture Contract

This file is the shared contract for everyone (human or agent) working on the code.
If you change a contract described here, update this file in the same commit.

Priorities, in order: **(1) feel of movement, shooting and item synergies, (2) mobile controls and saving, (3) content quantity.**

---

## 1. Tech & layout

- Plain TypeScript (strict), HTML5 Canvas 2D, Vite. **No game engine or framework, no runtime dependencies.**
- Unit tests: Vitest (node environment, `tests/**/*.test.ts`). E2E: Playwright + WebKit (`e2e/`), iPhone 15 landscape profiles.
- `vite.config.ts` uses `base: './'` so the build works from any GitHub Pages sub-path.

```
src/
  main.ts            bootstrap: canvas, loop, scenes, input, audio, lifecycle, SW registration
  engine/            loop, display/scaling, input (touch+keyboard), rng, math, pools, events
  sim/               PURE game logic. No DOM, no canvas, no audio objects. Runs headless in node.
    attack/          THE attack pipeline (carriers, modifiers, shots, beams, style)
    ...              world, player, enemies, bosses, floor gen, items, stats, pickups, run state
  content/           DATA ONLY (plus small named behaviour hooks): items, enemies, bosses, characters,
                     rooms, chapters, synergies, sets, achievements, familiars, music, sprites
  render/            renderer, sprite cache, pixel font, HUD, minimap, particles, lighting, effects
  ui/                canvas UI scenes & widgets (title, menus, pause, collection, settings...)
  audio/             Web Audio engine, procedural SFX, sequencer + chapter music
  meta/              save/load, migrations, settings, unlocks, achievements, lifetime stats
  debug/             hidden debug menu, perf overlay
tests/               vitest unit + simulation tests (floorgen, items, save, synergy stress, bot)
e2e/                 playwright webkit tests
scripts/             node build helpers (icon generation, service worker manifest)
public/              static files copied verbatim (manifest, icons)
```

### Content registries (IMPORTANT for parallel work)
Every content type lives in its own folder and is **auto-discovered** with `import.meta.glob(..., { eager: true })`.
Adding content = adding a new file. **Never** hand-maintain a central list of content imports.

```
src/content/items/*.ts        export default ItemDef[]        (passives, actives, trinkets, consumables)
src/content/enemies/*.ts      export default EnemyDef[]
src/content/bosses/*.ts       export default BossDef[]        (bosses, minibosses, final bosses)
src/content/characters/*.ts   export default CharacterDef[]
src/content/rooms/*.ts        export default RoomTemplate[]
src/content/chapters/*.ts     export default ChapterDef[]
src/content/synergies/*.ts    export default SynergyDef[]
src/content/sets/*.ts         export default ItemSetDef[]
src/content/achievements/*.ts export default AchievementDef[]
src/content/familiars/*.ts    export default FamiliarDef[]
src/content/music/*.ts        export default MusicTrack[]
src/content/hooks/*.ts        side-effect modules that call registerHook(name, fn) for unusual behaviour
```
`src/content/registry.ts` builds the lookup maps and **throws on duplicate ids** (a unit test enforces this).

---

## 2. Display, loop, input

- **Internal resolution: 384 × 192** (2:1, fits the iPhone 15 safe area of ~734×372 pt).
  All game drawing happens on a 384×192 back-buffer; each frame it is blitted to the display canvas
  (sized to CSS px × devicePixelRatio) with `imageSmoothingEnabled = false`, scaled uniformly to fit
  **inside the safe area** (`env(safe-area-inset-*)`), letterboxed with black. Nothing (HUD included)
  is ever drawn outside the safe area.
- Room: 13 × 7 tiles of 16 px = 208 × 112 px interior, 16 px walls → 240 × 144 outer, centered horizontally,
  flush toward the bottom leaving a HUD band. Side margins (72 px) hold HUD + buttons.
- Fixed-timestep simulation at **60 Hz** (accumulator, max 4 catch-up steps, drop the rest). Render once per rAF.
- `InputState` (plain object, reused, no allocations) is the ONLY way the sim reads input:
  `moveX, moveY` (analog −1..1), `aimX, aimY` (unit vector or 0,0), `fireHeld`, `firePressed`, `fireReleased`,
  `bomb`, `active`, `consumable`, `pause`, `map` (edge-triggered booleans cleared after each sim tick).
- Touch (Pointer Events on the canvas, `touch-action:none`, multi-touch by pointerId):
  - Left half: floating move stick. Right half: floating shoot stick. Shoot stick snaps to 4 directions
    unless Settings → Aim = 360°. Holding the shoot stick = `fireHeld` (charges charge attacks); release = `fireReleased`.
  - Buttons (bomb, active, consumable, pause, minimap) are hit-tested **before** sticks; a pointer that starts on a
    button never becomes a stick. UI buttons activate on pointer-up inside the button (also on click for desktop).
  - `touchstart/touchmove` `preventDefault` (passive:false) on the canvas only; `gesturestart` prevented;
    CSS disables selection, callouts, overscroll, zoom. DOM text inputs (seed entry, save import/export)
    are the only exceptions and live in a DOM modal layer.
- Keyboard (desktop testing): WASD move, Arrow keys shoot (last pressed wins), E bomb, Space active, Q consumable,
  Esc/P pause, Tab map, Backquote (`) debug menu.
- Audio unlocks on the first pointerdown/touchend/keydown (resume AudioContext + silent buffer).
- `visibilitychange`(hidden) / `pagehide` / `blur`: pause the run, **save the run**, suspend audio.
- Portrait orientation (height > width): draw a "rotate your phone" screen and pause.

---

## 3. Simulation core (headless-capable)

- `src/sim` never touches `window`, `document`, canvas or AudioContext. It communicates outward through a
  **ring-buffer event queue** of `GameEvent`s (`{type, x, y, a, b, id}` numeric/string fields, pooled) that render
  and audio consume: sfx names, hits, deaths, explosions, shake, flash, pickup text, room enter, boss intro, etc.
- `new Sim(options)` can be stepped in node: `sim.step(input)`; tests/bot/stress use this directly.
  Options: `{ seed?, character?, room? }`. `step()` clears the event queue first, so after a step the queue holds
  exactly that tick's events; consumers must drain it after every step (the run scene does, per tick).
  Event types and their field meanings are documented in `src/engine/events.ts`.
- Feel constants (acceleration, marble drop, dummy spring...) live in `src/sim/tuning.ts`, not in logic files.
- **Seeded RNG** (`engine/rng.ts`, sfc32 or mulberry32; state serializable). Streams:
  - `floorRng(seed, floorIndex, track)` → floor layout, room templates, pre-rolled pedestal items/shop stock.
    Floor contents depend ONLY on (seed, floor, track, meta-unlocks snapshot taken at run start) — never on play.
  - `lootRng` (run-level, serialized) → drops; `combatRng` (serialized) → in-room randomness.
- Entities are pooled classes with an `alive` flag; removal = swap-remove or free-list. Hot loops use scratch vectors,
  no closures/arrays/objects allocated per tick. Collision is circle-vs-circle for actors/shots and circle-vs-grid for tiles.
- Units: pixels and seconds (dt = 1/60). Room-local coordinates: (0,0) = top-left of the interior floor.
- Grid tiles: `floor, rock, rockTinted (drops loot), metal (indestructible), pit, spikes, fire (extinguishable, damages),
  crate (destructible by shots), urn (destructible, drops), secretWall`, plus doors on the four wall centers.

### Health model
Half-heart units. `redMax` (containers ×2), `red`, bonus hearts stack in order after red:
- **Tin hearts** — temporary shield hearts, absorb damage first, gone when depleted.
- **Ember hearts** — bonus hearts; when one is emptied it releases a fire nova that damages nearby enemies.
Damage order: ember/tin (last gained first) → red. Invulnerability frames after hurt (~1 s, flicker).

### Stats
`damage, fireRate (shots/sec), shotSpeed, range (px), moveSpeed, luck` + hidden `shotSize, knockback`.
Computed from character base + all item effects: sum of `add`, then product of `mul`, then clamps
(fireRate soft-capped with diminishing returns, moveSpeed ≤ 2.0×base). Recompute only when items change.

---

## 4. THE ATTACK PIPELINE (the heart of the game)

Goal: **every item that affects attacks is a composable modifier.** Adding an item never requires special-case code
for other items. Any combination must work, and stacking must snowball.

### 4.1 AttackProfile
Rebuilt whenever items change (`buildAttackProfile(player)`), never per shot. Contains:
- `carriers: Set<CarrierId>` and the resolved `primary` carrier.
- `mods: Map<ModId, ModStack>` (stack count + summed params), and pre-sorted hook lists per stage
  (`spawn`, `motion`, `hit`, `expire`) so firing iterates flat arrays.
- Numbers: damage, shots per volley, spread, shot speed, range, size, knockback, status chances, etc.
- `style: ShotStyle` — composed visuals (see 4.6), cached.

### 4.2 Carriers (attack types)
Primary precedence: **lance > laser > boomerang > melee > marble**. The primary decides *how damage travels*.
Every non-primary carrier the player holds becomes a **rider** that merges into the primary — combinations always
produce something new, nothing is silently replaced.

| Carrier | As primary | As rider (merges into the primary) |
|---|---|---|
| `marble` (default) | round glowing projectile | — (default, not an item) |
| `lance` (Storm Lance) | hold to charge (meter on the character); release: huge thick beam traced instantly to the far wall, pierces everything, ticks rapid damage over ~0.5 s; flash, shake, boom | — (always primary when held) |
| `laser` | thin rapid beam, short duration, fires at fire-rate | shots/beams sprout thin side-lasers at nearby enemies; lance gets feathered sub-beams |
| `boomerang` | thrown spinning blade: flies out, returns, pierces | adds `boomerang` motion: shots return; beams bend back into a U; melee crescents fly out and back |
| `melee` | close-range arc swipe + a short crescent wave projectile | lance/laser sweep across an arc while active; marbles launch out of a swipe that also hits close |
| `bomb` | (rider only) shots look like tiny bombs and explode | explode on hit; beams explode at intervals along their length; swipes explode at the tip |
| `charge` | (rider only) hold to charge, release = damage/size multiplier by charge % | lance overcharges (wider, longer); laser becomes a charged burst |
| `orbit` | (rider only) spinning blades orbit the player and hit | blades inherit all hit modifiers and fire a mini version of the primary when you fire |

### 4.3 Shots: one abstraction for everything
All damage delivery is built from two primitives that share the same modifier hooks:
- **Projectile** (pooled): marbles, blades, crescents, bomb shots, split children, familiar shots.
- **Beam** (pooled): lance and laser. A beam's geometry is produced each tick by **tracing a virtual projectile**:
  step along from the origin in small steps (≈4 px), applying the *same motion modifiers* a projectile would
  (homing steers, wavy wiggles, bounce reflects off walls, boomerang bends back, spiral curls, orbit rotates the
  origin angle), up to max length / step cap. Result: a polyline (≤ 128 points) that is collided and drawn.
  So every motion modifier automatically works on beams. The beam re-traces every tick of its life (so homing
  beams follow moving enemies and orbiting/melee-rider beams sweep).
- Melee swipes are a short-lived arc hitbox **plus** a crescent projectile, so projectile modifiers apply to melee.
- Orbit blades are projectiles with a permanent orbit motion.

`fireVolley(sim, source, origin, dir, profile, scale)` is the single entry point. The player, familiars
(`scale` ≈ 0.35–0.5) and item hooks all call it, so **familiars inherit every modifier and carrier** (a familiar with
the Storm Lance fires its own smaller beams).

### 4.4 Modifier hook stages
Modifiers are plain objects registered by id in `sim/attack/modifiers/*.ts`:
```ts
interface ModifierDef {
  id: ModId; color?: string; trail?: TrailKind; shape?: ShapeHint; order: number;
  spawn?(ctx: SpawnCtx, stack: ModStack): void;              // edit the volley: add shots, angles, delays
  initShot?(s: ShotState, stack: ModStack): void;             // set per-shot params once
  motion?(s: ShotState, stack: ModStack, sim: SimView, dt: number): void; // per-step velocity/pos transform
  hit?(s: ShotState, target: Hittable, stack: ModStack, sim: SimView): void; // on damaging something
  wall?(s: ShotState, stack: ModStack, sim: SimView, nx: number, ny: number): boolean; // return true = survive
  expire?(s: ShotState, stack: ModStack, sim: SimView): void;
}
```
`ShotState` is the shared view used by projectiles AND beam trace cursors (pos, vel, dir, speed, traveled, age,
damage, size, depth, flags, hitCount, pierceLeft, bounceLeft, owner, style, per-modifier scratch slots).
For beams, `hit/expire` run at the hit point along the path, **rate-limited per beam per target** (e.g. every 4 ticks).

Required modifiers (all must work with every carrier; the stress test enforces it):
- spawn: `extraShots` (+1 per stack, fan), `spread`, `backShot`, `sideShots`, `circleFirst` (shots circle you, then launch), `inaccuracy`
- motion: `homing`, `wavy`, `spiral`, `orbitPlayer`, `boomerang`, `grow`, `shrink`, `accelerate`, `decelerate`, `bounce`, `phase` (through rocks)
- hit/expire: `pierce`, `split` (depth ≤ 3), `chain` (lightning arcs, ≤ N targets), `explode`, `puddle`, `poison`, `burn`, `freeze`, `slow`, `charm`, `fear`, `knockback`

### 4.5 Stacking rules (snowball!)
- Stacks add intensity: homing turn rate, split count, chain jumps, bounce count, explosion radius, status duration…
- Multiplicative stat items multiply. Extra shots multiply with split, split with chain, etc. — it SHOULD get absurd.
- Guardrails degrade gracefully instead of blocking: global caps (projectiles 700, enemy shots 400, beams 48,
  particles 1500, explosions 48 live, chain arcs 32/tick, split depth 3, puddles 48). When a cap is hit, children
  merge into bigger/stronger shots (damage is conserved) rather than vanishing.

### 4.6 Visible combos: ShotStyle
Composed once per profile: base color from character, tinted by each modifier's color (weighted blend + outline),
size from stats, shape hint (marble, spiky, bomb, blade, crescent, star, gear…), trail kinds (embers, bubbles, ice,
sparks, wisps…), glow. Pre-rendered into a cached sprite per (style, size bucket). Beams get core/glow colors and
jitter from the same style. **Major items also add character costumes** (overlay sprite layers).

### 4.7 Special synergies
`SynergyDef { id, name, requires: ItemId[] (or tags), effects: Effect[], style?: StyleOverride, hook?: string }`.
Evaluated when inventory changes; active ones are added to the profile like items. Automatic stacking is the default;
special synergies add unique flourishes on top. All listed in SYNERGIES.md.

---

## 5. Content data shapes (summary — see `src/sim/types.ts` for the source of truth)

- `ItemDef { id, name, desc, kind: 'passive'|'active'|'trinket'|'consumable', quality 0-4, pools: PoolId[],
  tags: string[], set?: SetId, effects: Effect[], active?: { charge: number, chargeType: 'room'|'timed', use: Effect[] },
  sprite: SpriteDef | string, costume?: CostumeDef, unlock?: AchievementId }`
- `Effect` = discriminated union: `stat`, `mod`, `carrier`, `familiar`, `heal`, `hearts`, `pickups`, `trigger`
  (`on: 'hurt'|'roomClear'|'kill'|'fire'|'floorStart'|'bomb'|'pickup'|'use'`, chance, luck scaling, effects),
  `flag` (flight, spectral, etc.), `hook` (named code in `content/hooks`).
- `EnemyDef { id, name, hp, speed, radius, contact (half hearts), move: MoveSpec, attacks: AttackSpec[], sprite,
  flying?, chapters: ChapterId[], weight, championable, bestiary }` — behaviours come from a shared library
  (`sim/enemies/behaviors`), parameterised by data.
- `BossDef { id, name, kind: 'boss'|'miniboss'|'final', chapters, hp, phases: PhaseSpec[] (≥2), sprite, size, music? }`.
- `RoomTemplate { id, chapters: ChapterId[] | ['*'], type: RoomType, difficulty: 1-3, grid: string[7] }` (13 chars/row).
  Legend: `.` floor `#` rock `$` tinted rock `M` metal `O` pit `^` spikes `f` fire `x` crate `u` urn `e` enemy spawn
  `E` strong/elite spawn `c` chest spot `p` pickup spot `i` item pedestal `S` shop slot `B` boss spawn.
  Test-only markers (Phase 1 training room, `src/content/testRoom.ts`, deliberately outside `content/rooms/`):
  `@` player start, `D` training dummy.
- `CharacterDef { id, name, desc, stats, hearts, startItems, startPickups, sprite, mechanic: hookId, unlock? }`.
- `ChapterDef { id, name, floors: [n, n+1], track: 'main'|'alt', palette, tileset, enemyPool, bossPool, minibossPool,
  music, curses? }`.

---

## 6. Floors

- Grid map (up to 11×11 cells), start in the middle, grows by random walk with Isaac-like constraints.
  Room count scales with floor depth. Single-size rooms (13×7).
- Special rooms placed on dead ends: boss (farthest), treasure, shop, miniboss, challenge, cursed.
- **Secret room**: cell adjacent to ≥ 2 (prefer 3+) existing rooms, never adjacent to boss; entered by bombing the wall.
  **Deep secret room** (the harder one): adjacent to exactly one normal room, not adjacent to special rooms.
  Occasional subtle hints (cracked-looking wall tile, drip particles) with seeded chance.
- Broker's Nook (risk-reward room): may appear after a boss; items cost max health; higher chance with no damage taken
  on the floor.
- Every room must be reachable (unit test over thousands of seeds), special rooms present and correctly placed.

## 7. Saving
- `localStorage` keys: `stormdrain.meta`, `stormdrain.run`. Envelope `{ v: number, data, sum }`.
- Migrations: `migrations[v] = (old) => new`; loader upgrades step by step; never throws away unknown fields.
- Meta saves immediately on change (debounced to the end of the tick). Run saves on every room transition and on
  background/pause. Title screen shows **Continue** when a run save exists.
- Export/Import: `SD1:` + base64(JSON envelope) with checksum; import validates and migrates.

## 7b. Scenes & UI
- `ui/scene.ts` is a stack: the top scene gets updates and keys and owns the hit-testable buttons; `overlay` scenes
  (pause, settings) draw over the scene below. Scenes never import each other: navigation goes through `App.nav`
  (built in `main.ts`). Menu buttons are canvas-drawn `UiButton`s (>= 24 game px tall, about 44 pt).
- Debug perf overlay: Backquote on desktop, three-finger tap on touch screens.

## 8. Rendering & audio
- Sprites are code: `{ w, h, palette: { [ch]: color }, frames: string[][] }`, rendered once into cached canvases.
  White hit-flash and tinted variants cached lazily. Animations: idle/walk, hurt, death.
- Layers: pre-rendered room background → shadows → pickups/props → enemies → player/familiars → projectiles →
  beams (`lighter`) → particles → lighting/darkness → HUD → touch controls → UI overlays.
- Particles are presentation-only, pooled, capped. Screen shake/hit flash scale with Settings.
- Audio: procedural SFX recipes by name with voice limits; step-sequencer music with lookahead scheduling,
  a unique loop per chapter (+ boss variants), crossfades.

## 9. Testing hooks
- `window.__SD` (all builds): read-only accessors for tests (scene name, run state summary, HUD rects, button rects,
  fps, `sim` handle) and `__SD.debug` actions (god mode, spawn, skip floor) used by E2E and the debug menu.
  Current shape (`src/debug/sdHooks.ts`): `scene`, `stack`, `fps`, `ticks`, `view` (game image rect in CSS px +
  `scale` = CSS px per game px), `safe`, `portrait`, `buttons()` / `button(id)` (game rect + `css` rect with centre
  `cx, cy` for taps), `sim`, `run()` (SimSummary), `counts`, `debug.{overlay, hurt, kill, aim360, newRun, title, pause}`.
  Button ids are `<scene>.<name>` (e.g. `title.newRun`, `run.pause`, `pause.resume`).
- Headless: `tests/helpers/sim.ts` builds a `Sim` with a seed + character and steps it with scripted input.
