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
    floor/           floor generator, room template schema / validation / picking, minimap model (§6)
    run/             a real run: floors, rooms, doors, special rooms, routes, endings, snapshots (§6b, §6d)
    bosses/          the boss framework: phases, the pattern library, the brain, selection (§6c)
    ...              world, player, enemies, items, stats, pickups, pedestals, coin-operated props
  content/           DATA ONLY (plus small named behaviour hooks): items, enemies, bosses, characters,
                     rooms, chapters, synergies, sets, achievements, familiars, music, sprites
  render/            renderer, sprite cache, pixel font, HUD, minimap, particles, lighting, effects
  ui/                canvas UI scenes & widgets (title, character select, pause, settings, collection, bestiary,
                     stats, achievements, game over, endings) + the DOM modal layer for text entry (§7b)
  audio/             Web Audio engine, procedural SFX (built-in recipes + sfxLibrary), music/ sequencer (§8)
  meta/              save slots, codec, migrations, MetaStore, RunSaveStore, export codes, seed codes, settings, the game's
                     save service, meta tracker, achievements engine, unlocks (§7, §7a)
  pwa/               service-worker registration + pure precache / worker-source builders (§7)
  debug/             hidden debug menu, perf overlay
tests/               vitest unit + simulation tests (floorgen, items, save, synergy stress, bot)
e2e/                 playwright webkit tests
scripts/             node build helpers (gen-icons.mjs → public/icons, sw-plugin.mjs → dist/sw.js)
public/              static files copied verbatim (manifest, icons)
docs/                module guides: floorgen.md (§6), saving.md (§7), audio.md (§8)
```

### Content registries (IMPORTANT for parallel work)
Every content type lives in its own folder and is **auto-discovered** with `import.meta.glob(..., { eager: true })`.
Adding content = adding a new file. **Never** hand-maintain a central list of content imports.

```
src/content/items/*.ts        export default ItemDef[]        (passives, actives, trinkets, consumables)
src/content/enemies/*.ts      export default EnemyDef[]
src/content/bosses/*.ts       export default BossDef[]        (bosses, minibosses, final bosses)
src/content/characters/*.ts   export default CharacterDef[]
src/content/rooms/*.ts        export default RoomTemplate[]  (→ ROOM_TEMPLATES, src/sim/floor/library.ts)
src/content/chapters/*.ts     export default ChapterDef[]
src/content/synergies/*.ts    export default SynergyDef[]
src/content/sets/*.ts         export default ItemSetDef[]
src/content/achievements/*.ts export default AchievementDef[]
src/content/familiars/*.ts    export default FamiliarDef[]
src/content/music/*.ts        export default MusicTrack[]    (→ src/audio/music/registry.ts)
src/content/drops/*.ts        export default DropTableDef[]  (seeded loot tables: urn, crate, satchel, lockbox…)
src/content/champions/*.ts    export default ChampionDef[]   (champion variants; ORDER MATTERS for seeded rolls)
src/content/hooks/*.ts        side-effect modules that call registerHook(name, fn) for unusual behaviour
```
`src/content/registry.ts` builds the lookup maps and **throws on duplicate ids** (a unit test enforces this).
It exports one `Map` per type (`ITEMS`, `ENEMIES`, `BOSSES`, `CHARACTERS`, `CHAPTERS`, `SYNERGIES`, `SETS`,
`ACHIEVEMENTS`, `FAMILIARS`, `DROP_TABLES`, `CHAMPIONS`) plus typed helpers (`getItem` throws on unknown ids, `findItem`
returns undefined, `itemsWithTag`, `itemsInPool`, `findEnemy`, `enemiesInChapter`, `allChampions`, `findSet`,
`findSynergy`, `findAchievement`, `allSets` / `allSynergies` / `allAchievements`…). Rooms and music
are collected by their own modules instead: `ROOM_TEMPLATES` (`sim/floor/library.ts`, checked by `validateTemplates`
in tests/floorgen.test.ts) and `audio/music/registry.ts` (`getTrack`, throws on duplicate ids) — music stays out of
the content registry so the sim, which imports it, never pulls in audio code. `registerItem(def)` / `registerEnemy(def)` / `registerBoss` / `registerSet` / `registerSynergy` / `registerAchievement` exist only for tests/tools. `src/content/validate.ts` (`validateContent()`) checks every
cross-reference (start items, sets, achievements, familiars, drop tables, hooks, chapters…) and every sprite; the
unit tests require it to return no problems. Hook modules get their sim services through `ctx.api` (a `HookApi`,
see `src/sim/hooks.ts`) instead of importing sim modules, which keeps the registry free of import cycles.

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
  Esc/P pause, Tab map, Backquote (`) debug menu (outside a run it toggles the perf overlay).
- Buttons may opt into `draggable` (scrollable lists): a press that moves more than `DRAG_SLOP` (4 game px) becomes a
  drag (`dragged`) that never activates; `downX/downY/curX/curY` give the gesture. The mouse wheel over the canvas goes
  to the top scene's `onWheel(dy, x, y)`.
- Menus take the keyboard too (Phase 4B, `MenuNav`, §7b): keys reach the top scene's `onKey` first (arrows, Enter, Esc…).
  Keys and gestures aimed at the DOM modal layer (`[data-sd-modal]`: seed entry, save import / export) are left to it —
  no game handling, no `preventDefault` (typing a space, Tab, double-tap to select work there).
- Settings → LEFT-HANDED (`Input.setLeftHanded`): the move stick spawns on the right half, the shoot stick on the left, the
  resting hints swap, and `layoutRunButtons(…, leftHanded)` swaps the thumb columns — active + bomb down the left margin
  under the counters, the consumable (and the yard's bell) on the right under pause; pause and the minimap stay top-right.
  The HUD puts the charge bar / trinkets on the side of their button that faces the room.
- Audio unlocks on the first pointerdown/touchend/keydown (resume AudioContext + silent buffer).
- `visibilitychange`(hidden) / `pagehide` / `blur`: pause the run, **save the run** (`saveRunNow()`: the run save + a meta
  flush, §7), suspend audio.
- Portrait orientation (height > width): draw a "rotate your phone" screen, pause, and ignore pointer-downs and menu
  keys (the hidden UI underneath must not be pressable).

---

## 3. Simulation core (headless-capable)

- `src/sim` never touches `window`, `document`, canvas or AudioContext. It communicates outward through a
  **ring-buffer event queue** of `GameEvent`s (`{type, x, y, a, b, id}` numeric/string fields, pooled) that render
  and audio consume: sfx names, hits, deaths, explosions, shake, flash, pickup text, room enter, boss intro, etc.
- `new Sim(options)` can be stepped in node: `sim.step(input)`; tests/bot/stress use this directly.
  Options: `{ seed?, character?, room?, spawns?, run? }` — `run: true | RunOptions` (or `Sim.newRun(seed, opts)`) starts a
  real floor run (§6b); without `room` / `run` the Sim is the training yard. `step()` first discards the events that were in the queue after the
  previous step, so after a step the queue holds that tick's events (preceded by any emitted between ticks, e.g. by
  debug hooks like `sim.hurtPlayer()`); consumers must drain it after every step (the run scene does, per tick).
  Event types and their field meanings are documented in `src/engine/events.ts`. Purely cosmetic, high-volume
  events (shot splashes, bounce sparks, split shards, swipe hits, swatted-shot pops) go through `emitFx`, which skips
  them once the queue already holds `fxCap` events (256 of the 1024), so an absurd build's sparks can never crowd out
  kills / hurts / items or flood render and audio.
- Feel constants (acceleration, marble drop, dummy spring...) live in `src/sim/tuning.ts`, not in logic files.
- **Seeded RNG** (`engine/rng.ts`, sfc32 or mulberry32; state serializable). Streams:
  - `floorRng(seed, floorIndex, track)` → floor layout, room templates, pre-rolled pedestal items/shop stock.
    Floor contents depend ONLY on (seed, floor, track, meta-unlocks snapshot taken at run start) — never on play.
  - `lootRng` (run-level, serialized) → drops; `combatRng` (serialized) → in-room randomness.
- World state for special rooms: `world.boss` (the room's BossFight: intro, HP over every part, phase — §6c),
  `world.props` (`sim/roomProps.ts`: the arena's pressure plate, the hidden-route grate, the whirlpool, the
  skylight, the NPC perched on the top wall), `world.onExplosion(x, y, r)` (a tile-breaking blast went off —
  called from `explodeTiles`; the run breaks gamblers open and cracks the grate with it) and `arena.locked` (doors
  stay shut between the Rain Barrel Arena's waves). `world.lockedItems` (Phase 4A): the run's locked item ids (its meta
  unlock snapshot, §7a) — drop tables never roll them either; null outside runs (the yard offers everything).
- Entities are pooled classes with an `alive` flag; removal = swap-remove or free-list. Hot loops use scratch vectors,
  no closures/arrays/objects allocated per tick. Collision is circle-vs-circle for actors/shots and circle-vs-grid for tiles.
- Units: pixels and seconds (dt = 1/60). Room-local coordinates: (0,0) = top-left of the interior floor.
- Grid tiles: `floor, rock, rockTinted (drops loot), metal (indestructible), pit, spikes, fire (extinguishable, damages),
  crate (destructible by shots), urn (destructible, drops), secretWall`, plus doors on the four wall centers.
  `RoomGrid` also keeps `hp` (hits left: crate 2, urn 1, fire 4 — shots count hits, not damage) and `deco` (cosmetic
  rubble/planks/shards/ash left where something broke). Collision modes (`sim/collision.ts`): WALK (pits block),
  SHOT (flies over pits), FLY (flying players cross pits; props block) and PHASE (only walls block; the future 'phase'
  modifier / 'spectral' flag). Fire and every prop block walking and shots; spikes block nothing but hurt ½ heart
  underfoot unless flying; touching a fire hurts ½ heart. Explosions destroy rocks, tinted rocks (loot), crates, urns,
  put out fires and call `World.onSecretWallBombed(x, y)` for secretWall tiles and for the four wall door slots in
  reach — the floor code decides what is there.
- World entities besides the player: projectiles (700), dummies (16), pickups (64), bombs (16), pedestals (12),
  enemies (64), enemy shots (400), creep puddles (48), shockwaves (16), all pooled (`sim/constants.ts` CAP_*); the
  attack pipeline's beams (48), swipes (16) and familiars (12 stable slots) live in `world.atk` (§4). The event
  queue holds 1024 events per tick.
- `Sim` API used by room/floor code and tools: `roomCleared()` (actives +1 charge, 'roomClear' triggers),
  `floorStarted()`, `loadRoom(layout, spawns)` (returns the layout's non-tile markers), `run` (the floor run, or null),
  `snapshot()` / `Sim.fromSnapshot(snap)` (runs only, §6b), and debug helpers `giveItem`, `spawnPickup`, `placeBomb`, `explode`,
  `hurtPlayer`, `killPlayer`, `spawnItemPedestal(id)` (a pedestal on free floor next to the player; reuses an empty /
  the farthest pedestal when all 12 are taken), `startBossFight(id, x?, y?, { hp?, intro? })` (a BossDef fight in the
  current room: intro, HP bar, doors shut — §6c), `fullHeal`, `addPickups(coins, bombs, keys)`, `clearRoom` (kills every
  enemy, clears enemy shots / creep / shockwaves — a running wave then clears normally), `resetItems`. `SimOptions.spawns` places pickups/chests/pedestals (`sim/roomSpawns.ts`; the floor
  generator may replace it with its own RoomTemplate markers). The training room counts popping every dummy at once
  as a room clear. Combat: `startWave(opts?)` (room combat flow, see "Enemies" below), `spawnEnemy(id, x?, y?, opts?)` (without a
  position: the free floor cell nearest a spot across the room — `arena.nearestFreeSpot`, never a prop / pit /
  pedestal / training dummy; explicit coordinates are used as given),
  `killEnemies()` (debug). `loadRoom` collects the layout's `e` / `E` markers into `world.arena.points / elitePoints`
  (a wave in such a room puts one enemy on each marker); it also clears enemies, enemy shots, creep and shockwaves,
  and every attack in flight (beams, swipes, queues; familiars regroup at the player — `resetAttackRoom`).
  `world.godMode` (debug) makes `damagePlayer` refuse all damage. `damagePlayer(w, halves, source, by?)`: `by` = the
  attacker's enemy uid (contact, enemy shots / lob splashes, creep and shockwaves keep their owner's uid, boss beams); the
  killing blow sets `world.killer` (the enemy / boss def id, looked up over the whole enemy pool — a dead owner's slot keeps
  its uid until reused — '' when unknown) and `world.killedBy` (the DMG_* source): the game-over screen's "TAKEN BY".
- Training yard (the Sim built without a `room`; `content/testRoom.ts`): `RoomSpawn` also has `{ kind: 'bell' }` and
  pedestal spawns take `pool` and `rotate`. ROTATING pedestals (`Pedestal.rotate` = an `ItemFilter`,
  `pedestals.updateRotation`, run with the Sim's room stream) offer a new item every `YARD_TUNING.rotatePeriod` s while
  the player isn't within `rotateNear` px, and refill `refillDelay` s after being emptied; picks never repeat an item
  another pedestal shows (held items may come round again). The BELL is a pedestal slot without an item: bumping it
  emits 'bell' and sets `world.bellRung`, and the Sim starts a wave. `Sim.autoWaves` (debug) starts the next wave
  `autoWaveDelay` s after each clear. The yard: 3 rotating treasure-pool pedestals, a rotating attack-type pedestal,
  both actives, the bell at (1, 5).

### Health model (`sim/health.ts`, pure; `sim/combat.ts` applies it)
Half-heart units. `redMax` (containers ×2), `red`, bonus hearts stack in order after red:
- **Tin hearts** — temporary shield hearts, absorb damage first, gone when depleted.
- **Ember hearts** — bonus hearts; when one is emptied it releases a fire nova that damages nearby enemies.
Damage order: ember/tin (last gained first) → red; damage spills over from one heart to the next. A half bonus
heart is topped up by the same kind, otherwise a new heart starts. Cap: containers + bonus hearts ≤ 12 hearts
(two HUD rows of 6). `damagePlayer(w, halves, source)` is the only way the player gets hurt: it respects i-frames
(`PLAYER_TUNING.hurtInvuln` = 1 s, the renderer flickers the sprite), emits 'hurt', releases one nova per broken
Ember heart, fires the 'hurt' trigger and kills at zero (red and bonus both empty). The only thing that moves the
player is enemy CONTACT damage: a short shove apart (`Player.pushX/Y`, `ENEMY_TUNING.playerPush`, ≈8 px, decays in
~0.15 s) so Wren isn't left standing inside what hit her. Shots, explosions and hazards never push her.

### Stats (`sim/stats.ts`)
`damage, fireRate (shots/sec), shotSpeed, range (px), moveSpeed, luck` + hidden `shotSize, knockback`.
Computed from character base + all item effects: sum of `add`, then product of `mul`, then clamps
(fireRate soft-capped with diminishing returns, moveSpeed ≤ 2.0×base). Recompute only when items change.
Fire-rate soft cap: linear up to 5 shots/s, then `5 + 4·ln(1 + (x−5)/4)` (slope 1 at the knee, unbounded but
slowing). Hard clamps per stat live in `STAT_RULES`. `computeStats` writes into the player's existing `stats`
object (its identity never changes).

### Items, effects, inventory (`sim/effects.ts`, `sim/inventory.ts`, `sim/loadout.ts`)
- Effects are PERSISTENT (`stat, mod, carrier, familiar, flag, trigger`: derived from what is held) or INSTANT
  (`heal, hearts, pickups, hook`: run once). `recomputePlayer(w)` rebuilds stats, flags, trigger lists, slot counts,
  transformations, active synergies and `player.loadout` (mod stacks, carriers, familiars) from passives (duplicates
  count), the active item, trinkets, sets, synergies and temporary effects, then calls
  `recomputeAttack(player)` (`sim/attack/recomputeAttack.ts`), which rebuilds `player.attack` (the AttackProfile,
  §4.1). The loadout also counts carrier copies (`carrierStacks`), lists the held items with a costume (then
  `'set:<id>'` per transformation) and collects `styles` (StyleOverrides of transformations and active synergies, applied
  last by `composeStyle`, §4.6).
- **Transformations** (`ItemSetDef`, Phase 4A): holding `need` DISTINCT items whose `ItemDef.set` is the set's id (duplicates
  count once — `setProgress(p, id)`) adds the id to `player.sets` FOR THE REST OF THE RUN (losing a set item later doesn't
  undo it; `PlayerSnap.sets` saves it). Every set in `player.sets` adds its persistent effects (source = the set id), its
  costume (its layers replace item layers of the same slot — render/attackRenderer CostumeCache) and its `style`. The first
  time: a 'transform' event (fanfare, big banner, light pillar), then its INSTANT effects and `hook` run once — after the
  rebuild, because they may change items (`runFirstActivations`; no re-entrancy into a running recompute).
- **Synergies** (`SynergyDef`, §4.7): active while every requirement holds (`requirementMet`: an item held, or `{ tag, count }`
  = that many DISTINCT held items with the tag), re-checked on every recompute, so they switch off when an item is lost.
  Active ones add persistent effects (source = the synergy id) and `style`. The first activation in a run (`player.synergiesSeen`,
  saved as `PlayerSnap.synergiesSeen`): a 'synergy' event (the SYNERGY: NAME pill), instants + `hook` once.
- Instants run when a FRESH copy is first picked up, when an active/consumable is used, or when a trigger fires.
  Persistent effects executed in those contexts become TEMPORARY: `duration` seconds, else until the player leaves
  the room (`leftRoom`, called by `loadRoom`).
- Triggers: `fireTrigger(w, on, x, y)` at hurt, roomClear, kill (enemy kills and dummy pops credited to the player —
  `creditsPlayer(source)`), fire (each volley), floorStart,
  bomb (placed), pickup (coins/hearts/…; not items), use (active). Chance = `chance + luck × luckScale` clamped to
  `[0, maxChance]`, rolled on combatRng; optional cooldown; nesting stops at depth 3.
- Inventory: passives (ordered, duplicates allowed), ONE active (`charge/max`, 'room' = rooms cleared, 'timed' =
  seconds, fresh actives come charged), trinkets (1 slot, 2 with `extraTrinket`), consumables (1 slot, 2 with
  `extraConsumable`), coins/bombs/keys 0..99. Taking an active while holding one leaves the old one (with its charge)
  on the pedestal; a trinket/consumable into a full slot drops the oldest on the floor. Swapped-out things are not
  "fresh" and can't be re-taken until the player steps away.
- Pickup flow (`collectItem`): slot → one-time instants if fresh → recompute → hold overhead 0.8 s → 'item' event
  (banner NAME + one-line desc). Pedestals (`sim/pedestals.ts`) are solid; touching one takes its item.

### Pickups, chests, bombs (`sim/pickups.ts`, `sim/bombs.ts`, `sim/tileFx.ts`)
- Kinds are numeric (`sim/pickupKinds.ts` `PK`, same order as `PICKUP_NAMES`). Loot pops out with an arc (can't be
  taken for 0.3 s), slides with friction, bounces off walls/props, separates softly, is shoved when the player
  walks into something they can't take, and is blown around by explosions. Red hearts are only taken when they
  heal, bonus hearts when there's room, spark cells with a chargeable active, counters below 99. Satchels open on
  touch, lockboxes need (and use) a key; both roll a drop table.
- Drop tables (`DropTableDef`, `sim/drops.ts`) roll on the run's `lootRng` with luck shrinking the "nothing" weight;
  trinket/consumable entries draw an item from a pool. Test-room pedestal choices use a separate room stream so play
  never shifts them.
- Bombs: 1.4 s fuse (blinks faster), blast 40 px: 50 damage to hittables, 1 heart to the player (bonus first,
  unless `explosionImmune`), tiles within 22 px of the centre (≈3×3), pushes pickups/bombs, chain-lights other bombs
  (0.12 s), then the 'explosion' event (shake, flash, ring, smoke, debris, boom). Walking into a placed bomb (after
  stepping off it once) nudges it.

### Hittables (`sim/hittable.ts`) — the one damage interface
Enemies, training dummies and shot-breakable tiles (one `TileTarget` adapter per cell, made with the World) implement
`Hittable { hitKind, x, y, r, hittable, hurt(dmg, source, kx, ky), applyStatus(kind, duration, power, source) }`.
`queryHittables(w, x, y, r, out, tiles?)` fills a reused array (enemies, then standing dummies, then breakable cells);
`firstHittable` returns the first enemy/dummy. `kx, ky` is a knockback impulse in px/s (divided by the target's mass,
direction remembered for a later `'knockback'` status). Sources (`SRC_PLAYER, SRC_BOMB, SRC_STATUS, SRC_ALLY,
SRC_ENEMY, SRC_HAZARD`) decide kill credit (`creditsPlayer`). The attack pipeline (§4) hits everything through this.
`combat.damageArea` (bombs, novas, hooks, player shot blasts) hurts enemies and dummies; every player attack
(projectiles, beams, swipes, orbit blades, familiars, chains) hits through this interface (§4). Blasts of the player's
own attacks (source `SRC_PLAYER`: explode, the bomb rider) spare charmed enemies like every other player attack;
placed bombs and novas hurt everything in reach.

### Enemies (`sim/enemies/`)
- `Enemy` (pooled): everything comes from its `EnemyDef` = ONE movement behaviour + up to 4 attacks + on-death effects
  from the shared library (`behaviors/movement.ts`, `attacks.ts`, `death.ts`). Each behaviour declares its numeric params
  as `name: [default, min, max]`; `compileEnemy(def)` resolves them once per def (defaults filled, values clamped) and
  `validateEnemyDef` (run by `validateContent`) rejects unknown kinds/params, out-of-range values and bad sprites.
- Movement kinds: `idle, wander, chase, chasePath` (shared per-room Dijkstra flow field `world.flow`, refreshed every
  few ticks, straight line when the way is clear), `hop` (crouch → airborne arc over pits/rocks → land, validated
  landing spot), `dash` (line up → wind-up → straight charge → bonk + daze on walls; `axis` 1/2 = sideways/vertical
  only), `orbitPlayer, keepDistance` (kiter), `burrow` (tunnels under everything, rumbles, surfaces only on open floor),
  `teleport` (fade + destination marker → blink → fade in), `wallCrawl` (slides along the room edge), `float` (flying
  sine drift; flyers only meet the walls), `turret` (pinned). A behaviour writes a desired velocity (`tvx/tvy`); one
  integrator accelerates toward it, adds knockback (decays; frozen enemies slide), soft O(n²) separation, sub-stepped
  grid collision (WALK, or walls-only for flyers / airborne / underground), pedestals and dummies as solid.
- Attacks: `aimedShot, cardinal4, ringN (8 = the ring of 8), spreadFan, burst, lob` (arcing, lands on a marked spot:
  splash / creep / split), `spawnMinion` (capped per spawner), `landShockwave` (expanding ground ring), `leaveTrail`
  (passive damaging creep). Shared params: `windup` (telegraph s), `range/minRange`, `on` (0 timer, 1 hop landing,
  2 burrow emerge, 3 teleport appear, 4 dash bonk), `still`, `first`; shot params `speed, dmg (half hearts), size,
  accel, curve, phase, life`. On death: `explode, split` (copies, generations capped), `ringN`.
- Fairness: every attack and sudden move is telegraphed (`teleT`: flash + squash / wind-up frame); fresh enemies are
  inactive and harmless for `ENEMY_TUNING.spawnTime` (0.4 s, spawn poof). Contact damage uses 0.85 × radius; enemies
  high in a hop, underground, blinking or faded can't touch or be touched.
- Bosses are Enemies too (§6c): `enemy.boss` (a BossState) replaces the movement + attack step; `enemy.dying` (a boss's
  death sequence: untouchable, harmless, still alive for the room clear); tethered enemies (`anchor` = the uid they
  orbit, `anchorR/A/W`: boss shield orbs) ride their orbit, hide when it hides and die with it. `damageEnemy` runs a
  boss hit through `bossDamage` (nothing gets through during a phase change, one blow never skips a threshold) and
  a boss's killing blow through `bossLethal` (the last part plays the death sequence; the brain kills it after).
- Kills: `damageEnemy` / `killEnemy` only flag `dead` (released by `sweepEnemies` after the enemy update and at the end
  of the step) so killing inside any loop is safe. A kill emits 'enemyKilled' (flags: frozen / champion / big), runs
  death effects, champion extras and drop tables, and fires the player's 'kill' trigger when credited.
- Enemy shots (`enemies/shots.ts`, cap 400): walls and rocks stop them unless `phase`, pits don't; they hit the player
  with 0.8 × her radius, pop on contact even during i-frames (`damagePlayer` ignores the damage then). Lobs hurt only
  where they land (`fall` 1 = debris dropping straight onto a marked spot, 2 = a lightning strike; `creepLife` /
  `creepR` size the puddle a glob leaves). Creep puddles (cap 48, oldest recycled) hurt feet that aren't flying; shockwaves (cap 16) hurt once
  as the ring passes. Allied variants (charmed shooter, ice shards) hurt enemies × `allyDamage` instead of the player.
- Status effects (`enemies/status.ts`, on enemies AND dummies): poison (DOT every 0.5 s), burn (DOT every 0.3 s),
  freeze (frozen solid: no moves/attacks/contact; a frozen kill shatters into 6 allied ice shards), slow (speed ×(1 −
  power), attacks ×0.6), charm (targets the nearest other enemy; its shots/contact hurt enemies, never the player),
  fear (flees the player, no attacks), knockback (impulse along the last hit + short daze). Stacking: re-applying keeps
  the LONGER timer and the STRONGER power (no intensity stacking); burn thaws / freeze extinguishes; charm and fear
  replace each other; durations × the target's `resist` (bosses < 1), capped at 10 s; resist < 0.75 turns freeze into
  a slow. DOT ticks don't flash; kill credit goes to the player.
- Champions (`content/champions`, rolled on combatRng at spawn: 4 % + 1 % per luck, max 20 %; a second roll picks one
  by weight): Swift, Bulwark (2× HP, bigger), Splitter, Vengeful (ring of shots on death), Regrowing, Phantom (faded =
  intangible part of the time), Golden (coins). Coloured outline + glow, extra 'champion' drop table.
- Room combat flow (`sim/arena.ts`): `startWave` spawns a weighted pick of the chapter pool (default 'gutterways'; in a
  run the run's chapter) at the room's markers or at free floor ≥ 56 px from the player — or exactly `opts.spawns`
  (`FixedSpawn`: id, x, y, champion, hp, scale; floor runs use this) — and shuts the doors (`arena.doors` animates 0 → 1);
  when every enemy is dead: doors open, 'roomClear' event, `roomCleared()` (actives +1, 'roomClear' triggers), reward
  from the 'roomClear' table at the open floor nearest the centre. `arena.reward = false` (a challenge room's first
  waves) skips all of that: the run starts the next wave at once.
- `world.safeT` — spawn protection after a room entry (0.5 s): `damagePlayer` refuses all damage meanwhile.
- Priced pedestals (`Pedestal.price` coins, `hearts` containers, `keys`; `buyFromPedestal`): touching one pays first
  ('buy' event + 'shop_buy'); can't afford → 'denied' ('poor' / 'noHearts' / 'noKeys' / 'full') and it waits until the
  player steps away. Coin and key prices get the `haggler` flag's −25 % (`haggled`, at least 1). A heart deal never
  takes the last heart; with no containers at all it costs 3 Tin hearts per container (never the last bonus heart).
  Pedestal slots also carry shop GOODS (`goods` = a pickup kind: paid, then handed over by `collectKind`, only when
  `canTakeKind`), choice GROUPS (`group`: taking one makes the others vanish, 'pedestalVanish') and coin-operated
  PROPS (`prop`, `sim/shopProps.ts`: PROP_JAR the donation jar, PROP_SLOTS the Gumball Gambler, PROP_TRADER Old Pell). Events for the bestiary: 'enemySeen' (once per kind
  per run), 'enemyKilled'. Full event list in `engine/events.ts`.

---

## 4. THE ATTACK PIPELINE (the heart of the game)

Goal: **every item that affects attacks is a composable modifier.** Adding an item never requires special-case code
for other items. Any combination must work, and stacking must snowball.

Code: `src/sim/attack/` — `state.ts` (shared shapes), `profile.ts`, `fire.ts`, `shot.ts`, `beam.ts`, `melee.ts`,
`orbit.ts`, `familiars.ts`, `charge.ts` (the trigger finger), `impacts.ts` (explosions, puddles, split, chain),
`style.ts`, `targets.ts` (per-tick target snapshot), `update.ts`, `attackWorld.ts` (`world.atk`), `carriers/*.ts`,
`modifiers/*.ts`. Tuning numbers: `ATTACK_TUNING` in `sim/tuning.ts`.

### 4.1 AttackProfile
Rebuilt whenever items change (`buildAttackProfile(player)`, called by `recomputeAttack(player)` at the end of
`recomputePlayer`), never per shot; stored as `player.attack`. Contains:
- `carrierStacks` (held copies per carrier — duplicates stack), the resolved `primary`, rider stacks (`riderLaser`,
  `riderMelee`, `riderBomb`, `riderCharge`, `riderOrbit`, `riderBoomerang`, `riderMarble`) and `chargeMode`
  (`CM_NONE` / `CM_LANCE` / `CM_CHARGE`).
- `stacks[]` / `held`: one `ModStack { id, index, stacks, params (summed item params), v0..v3 (derived once by
  ModifierDef.prepare), slot (scratch offset) }` per held modifier, plus IMPLICIT stacks: the boomerang carrier
  (primary or rider) adds `boomerang`, the bomb rider adds `explode`, the `spectral` flag adds `phase`.
- Pre-sorted flat hook lists: `spawnHooks, initHooks, motionHooks, hitHooks, statusHooks, wallHooks, expireHooks,
  beamHooks` (sorted by `order`), so firing iterates flat arrays.
- Numbers from the stats: `damage, shotSpeed, range, size, knockback, luck, periodMul` (carrier multiplier on the
  time between volleys; the cadence reads the LIVE fire rate), `chargeTime`, lance width/life/tick damage, laser
  width/life/damage, `orbitCount`, `phase`, `splitStacks`, `keeperMechanic` (Wren).
- `style` / `keeperStyle: ShotStyle` — composed visuals (see 4.6).

### 4.2 Carriers (attack types)
Primary precedence: **lance > laser > boomerang > melee > marble**. The primary decides *how damage travels*.
Every non-primary carrier the player holds becomes a **rider** that merges into the primary — combinations always
produce something new, nothing is silently replaced. `carriers/*.ts` implement `emit(volley, spec)` (as primary)
and `rider(volley, stacks)` (as rider); riders merge in the order marble, melee, laser, boomerang, bomb, charge, orbit.

| Carrier | As primary | As rider (merges into the primary) |
|---|---|---|
| `marble` (default) | round glowing projectile | a half-strength companion marble joins every volley (only if a marble carrier is explicitly held) |
| `lance` (Storm Lance) | hold to charge (meter on the character); release: huge thick beam traced instantly to the far wall, pierces everything, ticks rapid damage over ~0.5 s; flash, shake, boom | — (always primary when held) |
| `laser` | thin rapid beam, short duration, fires at fire-rate | shots/beams sprout thin side-lasers at nearby enemies; lance gets feathered sub-beams |
| `boomerang` | thrown spinning blade: flies out, returns, pierces | adds `boomerang` motion: shots return; beams bend back into a U; melee crescents fly out and back |
| `melee` | close-range arc swipe + a short crescent wave projectile | lance/laser sweep across an arc while active; marbles launch out of a swipe that also hits close |
| `bomb` | (rider only) shots look like tiny bombs and explode | explode on hit; beams explode at intervals along their length; swipes explode at the tip |
| `charge` | (rider only) hold to charge, release = damage/size multiplier by charge % | lance overcharges (wider, longer); laser becomes a charged burst |
| `orbit` | (rider only) spinning blades orbit the player and hit | blades inherit all hit modifiers and fire a mini version of the primary when you fire |

Extra copies of a carrier make it stronger: lance +35 % damage and +3 px width per copy, laser +30 % and +1 px,
boomerang +25 % damage / +15 % size, melee +30 % damage / +15 % reach, bomb +6 px blast radius, charge +0.5× max
multiplier, orbit +1 blade (max 8), marble +10 % size.

Numbers (defaults, `ATTACK_TUNING`):
- **Lance**: charge `1.0 s × 3 / fireRate` clamped 0.25–2 s; releasing before full = fizzle (no damage). Beam
  12 px wide × √(shotSize / 3), life 0.5 s, a damage tick of 1.1 × damage every 3 ticks per target (10 ticks), non-
  damage hit hooks every 3rd tick. Passes through rocks and props (burning crates / urns / fires it crosses);
  only walls stop it. No new charge while its beam is live. Charge rider = overcharge to 200 % (up to ×1.5 damage,
  ×1.6 width, ×1.5 life).
- **Laser**: 3 px, 0.12 s, 1 × damage once per target; pierces enemies but stops at rocks / props (cracking
  breakable ones) unless phasing. Charge rider = a burst of 1–6 lasers 0.06 s apart.
- **Boomerang**: blade × 1.25 damage, 0.55 × range out, turns back and is caught (catch radius 8 px + size),
  pierces everything both ways (re-hits after 14 ticks), phases through rocks on the way back, 1.35 × fire period.
- **Melee**: swipe ±55° (~110°), reach 26 px, 0.16 s, 2.2 × damage, 2.5 × knockback, each target once, swats hostile
  enemy shots, cracks props; plus a crescent (1 × damage, 1.1 × speed, 0.55 × range, pierces 1). One swipe per
  distinct direction (≥ 60° apart, max 4 per volley). 1.1 × fire period.
- **Charge rider**: `0.9 s × 3 / fireRate`; release multiplies damage 0.5 → 2.5 (+0.5 per extra copy) and size
  0.8 → 1.8 by charge. **Orbit rider**: 1 + copies blades (max 8), radius 22 px, 0.9 × damage, re-hit every 12
  ticks, mini volleys at scale 0.4. **Bomb rider**: blasts 24 px (+6 per extra copy), ≥ 1.8 × shot damage, break rocks.

### 4.3 Shots: one abstraction for everything
All damage delivery is built from two primitives that share the same modifier hooks:
- **Projectile** (`Shot`, pooled in `world.projectiles`, cap 700): marbles, blades, crescents, bomb shots, split
  children, familiar shots, orbit blades (`SK_ORBIT`, a permanent orbit). Kinds `SK_MARBLE, SK_BLADE, SK_CRESCENT,
  SK_BOMB, SK_ORBIT`; marbles and bomb shots drop with gravity past their range, the others end there.
- **Beam** (pooled in `world.atk.beams`, cap 48): lance, laser, the lance's feathers (laser rider) and side zaps
  (laser rider on projectiles). A beam's geometry is produced each tick by **tracing a virtual projectile**:
  step along from the origin in small steps (4 px), applying the *same motion modifiers* a projectile would
  (homing steers, wavy wiggles, bounce reflects off walls, boomerang bends back, spiral corkscrews, orbit rotates the
  origin angle), up to max length / step cap. Result: a polyline (≤ 128 points per trace) that is collided and
  drawn. The cursor runs at a virtual speed of 240 px/s and hooks see a UNIFORM dt = step / 240 (accelerate /
  decelerate change the cursor's speed to shape the beam, never how sharply homing / boomerang / spiral bend it).
  The cursor remembers what it passed through this trace (homing moves on to the next target). The beam re-traces every
  tick of its life, from its anchor's current position (so homing beams follow moving enemies and orbiting /
  melee-rider beams sweep). `split` FORKS the trace at the first enemy on the path into 1 + stacks child traces
  (max 5, half damage, depth ≤ min(2, stacks)); points per beam ≤ 384 in ≤ 16 segments. Hit / expire hooks run at
  hit points, rate-limited per beam per target (one slot per target the snapshot can hold — 96 — never taken from a
  live target, so a crowd can't reset rate limits); expire hooks run once at the end point when the beam dies.
  `beamTick` hooks (rings, spins) turn every beam except laser-rider side zaps (they stay on their target).
  Guardrail: all beams share a trace budget of 5000 points per tick — crowded beams get fewer fork points and a
  coarser step (≤ 12 px) so the main line still reaches as far.
- **Swipes** (`world.atk.swipes`, cap 16) are a short-lived arc hitbox **plus** a crescent projectile, so projectile
  modifiers apply to melee; swipe hits run the hit hooks through a pseudo shot (`SK_SWIPE`).
- Orbit blades are projectiles with a permanent orbit motion (`attack/orbit.ts` keeps their count in step).

`fireVolley(sim, source, origin, dir, profile, scale)` is the single entry point. The player, familiars
(`scale` ≈ 0.35–0.5), orbit blades (0.4) and item hooks all call it, so **familiars inherit every modifier and
carrier** (a familiar with the Storm Lance charges with you and fires its own smaller beams). `AttackSource` carries
the owner (`anchor`: player / familiar / blade; beams and returning shots follow it), inherited velocity, the charge
multipliers (`mul`, `sizeMul`, `lifeMul`), `keeper` and `mini` (familiar / blade volleys never trigger more
volleys). A volley starts as one main spec; spawn hooks edit it; specs that don't fit the pool are merged
(damage summed); specs with a `delay` wait in a small queue (`PendingSpecs`); then the primary emits and the riders
merge in. Wren's **Lucky Marble** (`wren.luckyMarble`): the first volley after a wave starts (an uncleared room)
has its main shot as a keeper — ×3 damage, ×1.6 size, pierces everything, gilded star style.

The trigger finger (`attack/charge.ts`, `player.atk`): normal primaries fire at the fire rate while aim is held
(fractional cooldown carry, never banks shots). Charge modes charge while held and fire on release; the charge
meter, 'lanceCharge' ticks and 'lanceReady' come from here. Player volleys fire the 'fire' trigger and the
familiars (`familiarVolleys`; for charge releases they fire regardless of their cooldown).

### 4.4 Modifier hook stages
Modifiers are plain objects registered by id in `sim/attack/modifiers/*.ts` (`modifiers/index.ts` throws if any
`MOD_IDS` entry has no def):
```ts
interface ModifierDef {
  id: ModId; color?: string; trail?: TrailKind; shape?: ShapeHint; order: number;
  status?: boolean;                                           // chain lightning re-applies these
  prepare?(stack: ModStack, profile: AttackProfile): void;    // once per profile build: fill stack.v0..v3
  spawn?(ctx: SpawnCtx, stack: ModStack): void;              // edit the volley: add shots, angles, delays
  initShot?(s: ShotState, stack: ModStack): void;             // set per-shot params once
  motion?(s: ShotState, stack: ModStack, sim: SimView, dt: number): void; // per-step velocity/pos transform
  hit?(s: ShotState, target: Hittable, stack: ModStack, sim: SimView): void; // on damaging something
  wall?(s: ShotState, stack: ModStack, sim: SimView, nx: number, ny: number): boolean; // return true = survive
  expire?(s: ShotState, stack: ModStack, sim: SimView): void;
  beamTick?(b: Beam, stack: ModStack, sim: SimView, dt: number): void; // beams: steer the beam itself (rings, spins)
}
```
`SimView` is the World. `SpawnCtx` holds per-spec `ang` (offset from the aim), `dmg`, `size`, `speed`, `delay`,
`flags` (`SF_MAIN, SF_EXTRA, SF_BACK, SF_SIDE, SF_PELLET, SF_CIRCLE`) plus `beam` (the primary shoots beams), `rng`
(combatRng) and `mergeTo(max)`.
`ShotState` is the shared view used by projectiles AND beam trace cursors: position, height `z`, heading `ang` +
non-accumulating `angOff` + `speed` (velocity is derived; a hook may set a one-step velocity override `ovr/ovx/ovy` —
orbits, corkscrews, circling), owner position `ax, ay`, traveled / range / age / life, `damage = baseDamage ×
dmgMul` and `size = baseSize × sizeMul` (the multipliers reset to 1 before the motion hooks, so grow and shrink
compose), knock, depth, flags (`F_FALLING, F_RETURNING, F_PHASE, F_KEEPER, F_BOMB, F_SIDELASER, F_CIRCLING, F_MINI,
F_CAUGHT, F_CHILD, F_ORBITING` — the last: rides the tiny-planet orbit, homing only picks its target), hitCount,
pierceLeft, bounceLeft, rehit, owner kind, style, `m[]` (3 scratch slots per
modifier at `stack.slot`) and a 4-entry recent-hit memory (piercing shots re-hit a target only after `rehit` ticks).
For beams, `hit/expire` run at the hit point along the path, **rate-limited per beam per target**.
A hit: `target.hurt(damage, SRC_PLAYER, knockback along the motion)` → hit hooks → used up unless pierce is left
(keepers never are). `expire` runs when a shot ends WITHOUT being used up by a hit (range, landing, wall, timeout).

`prepare` may also adjust the profile's beam numbers (decelerate lengthens `lanceLife` / `laserLife`). Motion hooks run
in this order: homing, wavy, orbitPlayer, boomerang, spiral, grow, shrink, accelerate, decelerate (spiral after the
orbit so it can corkscrew around it). A wall bounce clears a one-step velocity override so the reflected heading
takes effect at once.

**Composition rule (verified by `tests/attack-compose.test.ts`):** every trajectory-shaping modifier changes every
primary, and every PAIR of them differs from each of its parts — no modifier may silently override another. Every
hit / status modifier lands through every delivery (marble, lance, laser, boomerang, swipe, orbit blade, familiar).

Required modifiers (all must work with every carrier; the stress test enforces it):
- spawn: `extraShots` (+1 per stack, fan), `spread`, `backShot`, `sideShots`, `circleFirst` (shots circle you, then launch), `inaccuracy`
- motion: `homing`, `wavy`, `spiral`, `orbitPlayer`, `boomerang`, `grow`, `shrink`, `accelerate`, `decelerate`, `bounce`, `phase` (through rocks)
- hit/expire: `pierce`, `split` (depth ≤ 3), `chain` (lightning arcs, ≤ N targets), `explode`, `puddle`, `poison`, `burn`, `freeze`, `slow`, `charm`, `fear`, `knockback`

Player blasts (`explode`, bomb rider) are queued (`impacts.ts`) and never hurt the player; puddles are allied
creep (they hurt enemies, never the player); charmed enemies are left out of the target snapshot.

### 4.5 Stacking rules (snowball!)
- Stacks add intensity: homing turn rate, split count, chain jumps, bounce count, explosion radius, status duration…
- Multiplicative stat items multiply. Extra shots multiply with split, split with chain, etc. — it SHOULD get absurd.
- Guardrails degrade gracefully instead of blocking: global caps (projectiles 700, enemy shots 400, beams 48,
  swipes 16, particles 1500, explosions 48 live, chain arcs 32/tick, split depth 3, puddles 48). When a cap is hit,
  children merge into bigger/stronger shots (damage is conserved) rather than vanishing:
  - a volley bigger than the free pool merges neighbouring specs (damage summed); a beam that can't spawn adds its
    damage to the volley's previous beam; a projectile that can't spawn adds its damage to the previous shot;
  - split children that don't fit (8 slots are kept in reserve) become fewer, stronger, bigger children — or, if
    none fit, their damage lands on the target at once;
  - explosions queue (64, merged by proximity, full queue merges into the nearest); at most 6 go off per tick and
    48 per 0.5 s — the rest wait a tick; chain arcs over 32 per tick add half their damage to the first target;
  - puddles merge into an allied puddle already there (≤ 4 new per tick); the beam trace budget (4.3) bounds
    beam work per tick; the event queue holds 1024 events per tick (cosmetic ones stop at 256, see §3);
  - a swipe that doesn't fit the swipe pool (16) adds its damage to the volley's previous swipe, else to the crescent
    (or projectile) of the same volley.

Per-modifier stacking (s = stacks; "dmg" = the shot's damage):

| Modifier | Stage | 1 stack | Each stack adds / formula |
|---|---|---|---|
| `extraShots` | spawn | +1 shot in a 10° fan (8° for beams) | +1 shot (`params.shots` adds more) |
| `spread` | spawn | 2 pellets (½ dmg, 0.7 size) in a ±14° cone | +2 pellets, cone ±(10 + 4s)° |
| `backShot` | spawn | 1 shot behind you | +1 (fanned 12°) |
| `sideShots` | spawn | 2 shots at ±90° (0.8 dmg) | +2 at ±70°, ±110°, ±50°… |
| `circleFirst` | spawn / motion | one lap (0.45 s, r 14 px) before launching; beams spin 360° in 0.25 s (at most 60 % of their life, so a laser still ends on the aim) | lap +0.1 s, radius +2 px; laps don't use range |
| `inaccuracy` | spawn | ±9° scatter, ±10 % speed, ×1.08 dmg | scatter ±(5 + 4s)°, dmg ×(1 + 0.08s) |
| `homing` | motion | seeks within 104 px at 4.5 rad/s; target = the cheapest REACHABLE one (distance + turn radius × bearing; nothing deep inside its turning circle; not one it just hit) — ahead beats beside, a U-turn only when nothing is ahead | reach 80 + 24s, turn 2.5 + 2s (`params.radius/turn`) |
| `wavy` | motion | ±0.47 rad heading wave per 44 px | amplitude 0.35 + 0.12s (max 1.1) |
| `spiral` | motion | corkscrew: a loop OFFSET at 10.5 rad/s widening to 13 px on top of the path (heading at 0.6 × speed, or the orbit an earlier hook set), range ×1.6; loops close up on a boomerang's way home | loop speed 9 + 1.5s, radius 10 + 3s |
| `orbitPlayer` | spawn / motion / beamTick | shots orbit their owner out to 27 px (then widen 12 px/s), range ×2; with homing they whip out to an enemy their sweep comes up on, then settle back; a heading turn (bounce) tilts the orbit, wavy makes it breathe; beams: every spec of the volley gets s copies, evenly spaced, the ring turning 3.6 rad/s | ring radius 20 + 7s, range ×(1.6 + 0.4s); beams: specs × (1 + s), 3 + 0.6s rad/s |
| `boomerang` | motion | turns back at 48 % of range (beams: after 95 px), steers home at 9 rad/s, caught by the owner | turn 7 + 2s rad/s, turn point +3 %/stack (beams +15 px) |
| `grow` | motion | size ×(1 + 1.4·age) up to ×2, dmg +50 % of the growth | rate 1.1 + 0.3s, max 1.6 + 0.4s (≤ 3.6) |
| `shrink` | motion | starts ×1.75 size & dmg, shrinks to ×0.5 at the end of its range | start 1.5 + 0.25s (≤ 2.75) |
| `accelerate` | motion | +1.9/s speed growth up to ×2.5; beams taper into a thinner (÷√k), harder-hitting (×(1 + 0.5(k − 1))) tip, k = speed ratio | growth 1.4 + 0.5s, max 2 + 0.5s, range +15 %/stack |
| `decelerate` | motion | slows at 1.8/s to 23 % speed (lingers); beams flare wider (×√(1/k)) toward their end and live +20 % (lance) / +25 % (laser) | decay 1.5 + 0.3s, floor 0.25 − 0.02s (≥ 0.12); beam life per stack |
| `bounce` | wall | 2 bounces off walls / rocks / props | +2 bounces (`params.bounces`) |
| `phase` | init | passes rocks and props (walls stop it); the lance already does, so its beams get +15 % damage instead | +10 % range (lance: +15 % damage) |
| `pierce` | init | pierces 3 enemies, ×1.08 dmg (beams ×1.12) | +2 pierces, +8 % dmg (+12 % beams) |
| `split` | hit | splits into 2 children (½ dmg, 0.75 size, 100° fan); children don't re-split | children 1 + s (max 6), depth min(3, s); beams fork (see 4.3) |
| `chain` | hit | lightning to 2 more targets within 60 px, 60 % dmg | jumps 1 + s, range 52 + 8s; re-applies statuses |
| `explode` | hit + expire | 21 px blast, 0.75 × dmg | radius 16 + 5s, dmg 0.5 + 0.25s; bomb rider: its blast (24 px + 6 per extra copy, 1.8 ×, breaks rocks) GROWS by 5 px and 0.25 × per explode item on top |
| `puddle` | hit + expire | allied puddle r 10 px, 3.1 s, 0.25 × dmg per 0.5 s to enemies in it | radius 8 + 2s, life 2.5 + 0.6s, dmg +30 %/stack |
| `poison` | hit (status) | 3.5 s, 0.35 × dmg per 0.5 s (min 1) | +1 s, +40 % power |
| `burn` | hit (status) | 2.75 s, 0.3 × dmg per 0.3 s (min 1) | +0.75 s, +40 % power |
| `freeze` | hit (status) | 22 % chance, frozen 1.6 s | chance +13 % (+2 %/luck), +0.4 s |
| `slow` | hit (status) | always, 2 s at −45 % speed | +0.5 s, −10 % speed (max −80 %) |
| `charm` | hit (status) | 14 % chance, 4 s | chance +8 % (+2 %/luck), +1 s |
| `fear` | hit (status) | 18 % chance, 2.8 s | chance +10 % (+2 %/luck), +0.8 s |
| `knockback` | init + hit | knockback ×2.6, +0.12 s daze | ×(1.8 + 0.8s), daze 0.12s, push 60 + 30s |

Statuses follow the status API's own rules (§3: longer timer / stronger power win, no intensity stacking, bosses
resist); stacks make each application longer and stronger, not more frequent.

### 4.6 Visible combos: ShotStyle
Composed once per profile (`attack/style.ts`, pure data): base colour from the character (`CharacterDef.shotColor`,
default candle-gold), replaced / tinted by the primary carrier (lance electric blue, laser red-pink, boomerang steel,
melee white), then tinted by each modifier's colour weighted by stacks (weighted blend, up to 80 %; with 3+ colours
`vividBlend` keeps the mean hue but restores the inputs' average saturation and brightness, and the final tint uses
`mixVivid`, so big stacks and complementary pairs — the lance's blue + explode's orange — stay vivid instead of
averaging to grey; boomerang / melee tints cover 70 / 80 % of the base so a modifier's colour reads true on them);
rim in the
dominant modifier's colour, dark outline, highlight, and up to **3 accent colours** (the top modifiers' colours,
drawn as sparkle pixels on the shot — combos read at a glance). Shape hint: the carrier first (boomerang blade,
melee crescent, bomb rider bomb), else the strongest shaped modifier (spiky, star, gear, shard, bubble…).
Trail kinds (embers, bubbles, ice, sparks, wisps, dust, drops — up to 3, with colours; bomb shots always spark),
glow radius. Last, the loadout's `styles` (transformations, active synergies) override in order: a colour takes 75 % of the
body and becomes the first accent, a shape replaces the composed one, a trail goes first, glow adds to the radius. Render (`render/attackRenderer.ts`) pre-renders a sprite per (style, shape, size bucket, rotation
frame) and a glow per (style, size); crescents and shards turn with the heading, blades / gears / stars spin.
Beams get core / glow / edge colours and lightning jitter from the same style. Wren's keeper marble has its own
gilded star style.
**Major items also add character costumes** (overlay sprite layers, `CostumeDef`, see §5): the Storm Lance adds a
crackling blue aura (behind, animated, additive, sparks) and glowing storm eyes (per facing).

### 4.7 Special synergies
`SynergyDef { id, name, requires: (ItemId | { tag, count? })[], effects: Effect[], style?: StyleOverride, hook?: string }`
(content: `src/content/synergies/*.ts`). Evaluated on every inventory change (`recomputePlayer`, §3): active ones are added
to the loadout like items (persistent effects, source = the synergy id) and tint the shots (`style`); they switch off again
when a requirement fails. The first activation per run emits 'synergy' (banner) and runs the instant effects and `hook` once.
Automatic stacking is the default; special synergies add unique flourishes on top. All listed in SYNERGIES.md.

### 4.8 Familiars (`attack/familiars.ts`, `content/familiars/*.ts`)
Synced from the loadout (stable slots, cap 12). `follow` / `hover` join a follower chain trailing the player along
her recent path (breadcrumbs every 2 px, 13 px apart); `orbit` / `guard` circle her and swat enemy shots; `chase`
runs at the nearest enemy. Shooters (`attackScale` > 0) fire `fireVolley` with the player's profile at their scale
whenever the player fires and their own cooldown (`period / fireRateMul`) allows — or always on charge releases.
`contactDamage` hurts touched enemies every 0.3 s. Content: Lamplet (follow, 0.45), Paper Boat (follow, 0.35, fires
faster), Bottlecap Beetle (orbit, contact damage, blocks shots); Phase 2D (`content/familiars/critters.ts`): Dustwing
(hover, 0.4, fires a little slower), Roly-Poly (chase, contact 6), Wick Wisp (guard, 0.25, blocks shots, contact 2).

---

## 5. Content data shapes (summary — see `src/sim/types.ts` for the source of truth)

- `ItemDef { id, name, desc, kind: 'passive'|'active'|'trinket'|'consumable', quality 0-4, pools: PoolId[],
  tags: string[], set?: SetId, effects: Effect[], active?: { charge: number, chargeType: 'room'|'timed', use: Effect[] },
  use?: Effect[] (consumables), sprite: SpriteDef (14×14) | string, costume?: CostumeSpec, unlock?: AchievementId }`.
- `CostumeDef { id, layer: 'body'|'cape'|'eyes'|'hat'|'aura'|'held', sprite, dx?, dy?, behind?, frames?: 'dir'|'anim',
  fps?, glow? ('r,g,b'), sparks? (colour), additive? }` anchored like the character; `frames: 'dir'` = frame 0 facing
  down, 1 up, 2 side (mirrored for left); `'anim'` cycles at `fps`. `CostumeSpec` = one def or an array of layers
  (`costumeList(spec)` flattens it). Items and sets may carry costumes.
  `name` is shown uppercase on the banner, `desc` is ONE short line (≤ 46 chars, a test enforces it).
  Item tags: a category (`starter-attack` carriers, `modifier`, `weird`, `familiar`, `starter-stat`, `starter-active`…)
  plus DESIGN.md set names where they fit (`stormcaller, mothkin, clockwork, sporeling, waxen, toybox, ossuary,
  tidewalker, glimmer`) so future transformations (`ItemSetDef` / `SynergyDef` tag requirements) can pick them up.
  The starter set (Phase 2D): `items/starter-attack.ts` (7 carriers), `starter-mods.ts` (19 modifier items),
  `starter-weird.ts` (5 "useless alone, great in combos"), `starter-familiars.ts` (6, one per familiar behaviour and
  then some) — together every carrier and every modifier (tests/starter-items.test.ts enforces coverage).
- `Effect` = discriminated union: `stat` (add/mul), `mod` (stacks, params), `carrier`, `familiar`, `heal` (half hearts),
  `hearts` (containers in whole hearts; red/tin/ember in halves), `pickups` (coins/bombs/keys, charge, spawn[], table),
  `trigger` (`on: 'hurt'|'roomClear'|'kill'|'fire'|'floorStart'|'bomb'|'pickup'|'use'`, chance, luck, maxChance,
  cooldown, `say` (a short notice for the top band, sent as a 'say' event), effects), `flag` (`PLAYER_FLAGS`: flying, spectral, magnet, extraTrinket, extraConsumable,
  explosionImmune, spikeImmune, fireImmune, noRedHearts, seeSecrets, darkVision, haggler), `hook` (named code in
  `content/hooks`, params). Persistent kinds accept an optional `duration` for use/trigger contexts.
- Ids declared for the attack pipeline: `CARRIER_IDS`, `MOD_IDS` (exactly §4.2 / §4.4), `ShapeHint`, `TrailKind`.
- `DropTableDef { id, rolls: [min, max], nothing?, luck?, entries: { kind: PickupName, weight, count?, pool? }[] }`.
- `SynergyDef` (requires item ids or `{ tag, count }`), `ItemSetDef { id, name, desc, need, effects, costume?, hook?, style? }`,
  `FamiliarDef { id, name, desc, sprite, behavior: 'follow'|'hover'|'orbit'|'guard'|'chase', radius, attackScale
  (0 = never fires), fireRateMul?, contactDamage?, speed?, blocks? (swats enemy shots), glow? }` (§4.8),
  `AchievementDef { id, name, desc (≤ 52 chars), hidden?, condition, unlocks: UnlockRef[] }` — `condition` = `{ counter,
  atLeast }` (a lifetime counter: stat, meta counter id or `killed.<id>` / `collected.<id>` / `charWins.<id>` /
  `charRuns.<id>` / `achievements` / `discovered`) or `{ kind: 'event', event: ACHIEVEMENT_EVENTS, id?, value?, atLeast? }`
  (§7a); `UnlockRef { kind: 'item' | 'character' | 'route' | 'ending' | 'challenge' | 'chapter' | 'feature', id }`.
- `EnemyDef { id, name, hp, speed, radius, contact (half hearts), move: MoveSpec, attacks: AttackSpec[], sprite,
  flying?, chapters: ChapterId[], weight, championable, bestiary, drops?, mass?, onDeath?: DeathSpec[], goo?: colours,
  shot?: EnemyShotStyle, resist?, big? }` — behaviours come from a shared library (`sim/enemies/behaviors`),
  parameterised by data. `MoveSpec { kind: MoveKind, params }`, `AttackSpec { kind: AttackKind, cooldown, params,
  enemy?, shot? }`, `DeathSpec { kind: DeathKind, params, enemy?, shot? }` (`MOVE_KINDS`, `ATTACK_KINDS`,
  `DEATH_KINDS`, `ENEMY_SHOT_STYLES`, `STATUS_KINDS` in types.ts). Enemy sprites need `anims.idle` + `anims.move`
  (optional `windup`, `air`), face right, 8-24 px.
- `ChampionDef { id, name, color, weight, hpMul?, speedMul?, sizeMul?, cooldownMul?, split?, deathRing?, regen?,
  phantom?, coins?, drops? }`.
- `BossDef { id, name, kind: 'boss'|'miniboss'|'final', chapters, hp, phases: PhaseSpec[] (≥2), sprite (32-56 px;
  minibosses ≥ 24; anims idle + move, optional windup / air / slam / roar / charge / hurt; anchorY in the lower body),
  size (collision radius), music?, drops?, speed?, contact?, mass?, resist? (< 0.75), flying?, shot?, goo?, title?
  (the intro card's flavour line), final? ('thunderhead' | 'nestmother' | 'undertow') + ending? (1-3), weight?,
  bestiary?, hook? }`. `PhaseSpec { at (HP fraction, 1 first, falling), name?, move (baseline movement: idle, wander,
  chase, chasePath, float, orbitPlayer, keepDistance, hop), attacks (enemy-library AttackSpecs on their timers),
  speedMul?, summon?, patterns?: BossPatternSpec[], order?: 'cycle'|'random', rest?: [min, max] s, enter?:
  BossPatternSpec (runs once when the phase begins), tint? (#rrggbb colour shift), pace? (speed-up) }`.
  `BossPatternSpec { kind: BOSS_PATTERN_KINDS, params?, enemy?, hook?, shot?, weight? }` (§6c). Content lives in
  `src/content/bosses/*.ts`; `validateBossDef` (sim/bosses/validate.ts, run by validateContent) checks it all.
- `RoomTemplate { id, chapters: ChapterId[] | ['*'], type: RoomType, difficulty: 1-3, grid: string[7], weight? }`
  (13 chars/row). Owned by `src/sim/floor/types.ts`; `sim/types.ts` re-exports `RoomTemplate`, `RoomType` and
  `ROOM_TYPES` (`start, normal, treasure, shop, boss, miniboss, secret, deepSecret, challenge, cursed, nook` — the
  Broker's Nook ROOM type is `nook`, its item POOL is `broker`).
  Legend: `.` floor `#` rock `$` tinted rock `M` metal `O` pit `^` spikes `f` fire `x` crate `u` urn `e` enemy spawn
  `E` strong/elite spawn `c` chest spot `p` pickup spot `i` item pedestal `S` shop slot `B` boss spawn.
  `validateTemplate` rules: the tile just inside each door — (6,0), (12,3), (6,6), (0,3) — is `.` (so any template fits
  any door mask and any mirroring) with no `e`/`E` next to it; every walkable tile is reachable on foot (pits, rocks,
  metal, crates, urns block); the four doors are joined by a path without spikes / fire; per-type marker rules
  (normal ≥ 1 spawn, treasure an `i`, shop 2-6 `S`, …; the centre is walkable in start / boss / miniboss / challenge);
  ≤ 10 enemy spawns. Each room gets a mirroring `flip` (bit 1 left/right, bit 2 top/bottom): `templateGrid(tpl, flip)`.
  Test-only markers (Phase 1 training room, `src/content/testRoom.ts`, deliberately outside `content/rooms/`):
  `@` player start, `D` training dummy.
- `CharacterDef { id, name, desc, stats, hearts: { redMax, red?, tin?, ember? } (half hearts), startItems,
  startPickups: { coins, bombs, keys }, sprite, shotColor? (base ShotStyle colour), mechanic: hookId, mechanicDesc? (the
  mechanic in a line or two for the character select, Phase 4B), unlock? }`. Mechanics implemented inside the attack
  pipeline register a placeholder hook (`content/hooks/characters.ts`) so validation can check the reference.
- `ChapterDef { id, name, floors: [n, n+1], track: 'main'|'alt', palette, tileset, enemyPool, bossPool, minibossPool,
  music, curses?, decor? }`. `palette` holds every `CHAPTER_PALETTE_KEYS` colour (floor, floorLight, floorDark, mortar,
  deep, brick, brickShade, brickLight, moss, mossLight, stone, stoneLight, stoneShade, void, voidSpeck, water,
  waterLight, leaf, leafLight — content validation checks them); `tileset` = `'<floor pattern>/<wall pattern>'` from
  `content/sprites/tilesets.ts` (floors: flagstone, checker, earth, slab, plate, hex; walls: brick, blocks, timber,
  panel, paper); `decor: ChapterDecor { floor: SpriteDef[] (decals), wall?: SpriteDef[] (top-wall trims ≤ 16×16),
  count?: [min, max], streak? (wall streak colour), ambience?: 'none'|'drips'|'spores'|'embers'|'snow'|'motes'|'wind' }`
  (sprites in `content/sprites/chapterDecor.ts`). Pools are unions: explicit list ∪ every enemy / boss listing the
  chapter (`enemiesInChapter`, `bossesInChapter(chapter, kind)`).

---

## 6. Floors (`src/sim/floor`; API + integration checklist: docs/floorgen.md)

Module done and tested (side track, merged after Phase 2); floor runs use it since Phase 3A (§6b).
- `generateFloor(seed, floorIndex 1..13, track 'main'|'alt', opts?) → FloorLayout` — pure, deterministic, ≈ 0.03 ms.
  Randomness only from `floorRng(seed, floor, track)` forks `plan, layout, curse, hints, route, templates`; every roll
  is always made, so an option (`curses`, `cursePool`, `forceCurse`, `allowAltNext`) only changes its own field.
  `FLOORGEN_VERSION` (1) is stored in the layout; a test pins a fingerprint of 650 layouts.
- Map: 11×11 cells, start in the middle, breadth-first growth that only fills a cell touching exactly one room →
  always a tree (no loops, no 2×2 blobs). Rooms = 8 + ⌊(floor − 1)·10/12⌋ + 0..1 (≥ special rooms + 6), single
  size (13×7). Failed attempts retry; every 400 failures add a room, then drop optional rooms, so it always finishes.
- Special rooms on dead ends (one regular door): boss at the farthest (≥ 3 rooms from the start, ≥ 4 with 13+ rooms),
  treasure every floor (locked from floor 3), shop (not floors 12-13), miniboss 35 %, challenge 30 % from floor 2,
  cursed 25 %.
- **Secret room**: an empty cell touching ≥ 2 rooms (3+ whenever possible), never the boss room; a bombable wall to
  EVERY neighbour (special rooms too). **Deep secret room**: touches exactly one normal room and nothing special.
  Hint walls (cracked tile, drips) on 40 % of secret walls (25 % deep secret), per side.
- **Broker's Nook**: a free cell next to the boss room is reserved (`layout.nook`, touching nothing else, template
  pre-picked); `openNook(layout)` adds the room after the boss — the roll (items cost max health, likelier with no
  damage taken) is the caller's.
- Hidden-route grate (`hiddenRoute`): main track, floors < 12, only with `opts.allowAltNext` (chance 0.4) — secret room
  55 %, boss room 45 %. Final-boss flags: floor 12 main `thunderhead`, 12 alt `nestmother`, 13 `undertow`. Curses:
  chance min(0.5, 0.04 + 0.035·(floor − 1)), one per floor.
- `FloorRoom`: cell, `type`, door masks (bits N 1, E 2, S 4, W 8; `doors` ⊇ `secretDoors` ⊇ `hints`; `lockedDoors`
  marked on both sides), `locked`, `secret`, `dist` (regular doors from the start), `templateId` + `flip`,
  `hiddenRoute`, `finalBoss`. The layout is plain JSON (≈ 3-5 KB): run saves store it WHOLE (template picks depend on
  the whole template set, so regenerating after content changes could differ).
- `pickTemplates(layout, templates, chapterId, rng)`: weight by closeness to a target difficulty (1.0 on floor 1 →
  3.0 on floor 13, + up to 0.35 toward the boss), ×3 for chapter-specific templates, ×0.15 if already used on the
  floor; candidates sorted by id; random mirroring.
- Minimap model (`minimap.ts`): per room Unknown / Mapped (outline only, map items) / Seen / Visited; `enterRoom`,
  `discoverRoom`, `revealMap('layout'|'icons'|'secrets'|'full')`, `setLostMap`; special icons once Seen; a secret
  room is never revealed through its hidden wall; the Lost Map curse only hides the drawing.
- Tests: tests/floorgen.test.ts (every rule over 5000 seeds × 13 floors × 2 tracks: reachability, secrets only by
  bombing, boss on the farthest dead end, special rooms, symmetric doors, locks, flags; determinism; template
  validation and picking; speed), tests/floorminimap.test.ts.

## 6b. Runs (`src/sim/run`)

`sim.run` (a `Run`, null in the yard / custom rooms) owns everything about a real run as plain JSON (`RunData`, in
`run/types.ts`): seed, character, floor, track, chapter, the whole `FloorLayout`, the `MinimapState`, one `RoomState`
per room, the current room + the side the player came in through, the damage-this-floor flag, time, stats, the
curse mode, the meta snapshot (`locked` item ids, `unlocked` ids), the items `seen` this run, and `won` / `ending`.
The Sim steps it at the end of every tick (`run.update(input)`).
- **Run options** (`RunOptions`): `floor` (1-13), `track`, `curse`, `lockedItems`, and `unlocked` — the meta
  snapshot M3 feeds: item ids (items flagged `unlock` only roll when listed) and route flags (`'ending1'` opens the
  alt route into chapter 6; `'ending1'` + `'ending2'` open the whirlpool to floor 13). `locked` = every
  `unlock`-flagged item not unlocked ∪ `lockedItems` (`lockedItemIds`, `run/pools.ts`).
- **Floor start** (`startFloor`): `chapterFor(floor, track)` (floors 1-12 → chapters by `ChapterDef.floors` + `track`;
  13 borrows the Eye of the Storm) → `generateFloor(seed, floor, track, { curses, cursePool: chapter.curses, forceCurse,
  allowAltNext: altRouteAllowed(floor, track, unlocked) })` → `pickTemplates` (chapter id, `templateRng`) →
  `rollFloorContents` → `createMinimap`.
- **Contents are pre-rolled** from `floorRng(seed, floor, track).fork('contents')` — one fork per room (`r<index>`,
  the nook reserve `nook`, floor-wide extras `extras`), so adding a roll to one room type never shifts another —
  (`run/contents.ts`): enemy ids per e / E marker (forced champion ids for E; challenge rooms get
  `RUN_TUNING.challengeWaves` = 3 waves), pickup names per 'p', satchel / lockbox per 'c', pedestal items per 'i'
  (pools by room type: treasure; secret → treasure; deepSecret → secret → treasure, quality ≥ 3 — or, half the time,
  a lockbox + 5-8 rich pickups (`bonus`); cursed → its pool → treasure, 45 % a lockbox instead (`alts`); challenge →
  its pool → treasure; nook → broker, quality ≥ 2, the first two markers only, a choice), shop stock per 'S' (≤ 5
  slots: 2-3 items at `itemPrice` + pickups for sale at `GOODS_PRICE`), the boss (§6c `bossFor`: a final by the
  layout's key, else a seeded pick of the chapter pool) and its HP, the boss reward (boss pool), a Gumball Gambler in
  12 % of normal rooms and Old Pell (15 % of floors, one normal room, his trader-pool item), and the hidden-route
  grate (`layout.hiddenRoute`). Items never repeat within a floor and never offer anything SEEN earlier in the run
  (`data.seen`: shown on a pedestal / in a shop / by a trader at a room's first visit, or taken); pools fall back to
  repeats rather than leaving a pedestal empty; locked items never roll (`rollItem`, quality weights 1/1/1/0.7/0.35).
  So a seed replays exactly for the same route; which items a later floor offers depends on what was seen before.
  Only drops (lootRng) and in-room randomness (combatRng: champion rolls, AI, the maze, boss patterns) depend on play.
- **Room entry** (`enterCurrent`, the ONE code path for doors, the trapdoor, the grate, the whirlpool, debug teleports
  and restores): chapter + curse onto the World, `loadRoom(templateGrid(tpl, flip))` (which also resets
  `world.boss` / `world.props`), the saved grid (`encodeGrid`: tiles / hits / debris as 3 × 91 chars) if the room was
  visited, the player at the door front of the entry side (centre for a floor start), familiars rebuilt canonically
  (`respawnFamiliars`, quiet), 'roomEnter' (first, so presentation resets before the room's own spawn events), a
  secret room opens all its walls, pickups / pedestals / props from the pre-rolls on the first visit (else what was
  left: `SavedPickup` / `SavedPedestal` incl. keys, goods, group, prop, broken), the room's fixtures (§6d: wall NPC,
  plate, grate, exits; the NPC's greeting on the first visit), the trapdoor, the next wave if not cleared (fixed
  spawns; boss / miniboss rooms: the BossDef fight at the 'B' marker — §6c; the Rain Barrel Arena waits for its
  plate), door slots, the minimap (`enterRoom`), `world.safeT` = 0.5 s, a 0.35 s door cooldown, and on a new floor the
  'floorStart' trigger + event. Rooms without anything to fight are cleared on entry.
- **Doors** (`world.doors`, `sim/doors.ts`: 4 `DoorSlot { kind, state, to, hint, deep, anim }`): kind = the
  neighbour's special type else this room's (boss / treasure / shop / challenge / cursed / miniboss / nook / normal;
  `Secret` = a blasted hole); state HIDDEN (secret wall not opened — `hint` from `FloorRoom.hints` or the
  `seeSecrets` flag), LOCKED (`lockedDoors`, treasure from floor 3; the shop is never locked), OPEN (barred while
  `arena.active` or `arena.locked`). Walking into an open doorway (stick > 0.3 toward the wall, feet within 10 px of
  the door centre, touching the wall) = `goThroughDoor(side)`: a locked door takes a key and opens for good on both
  sides (`RoomState.opened` bits, 'doorUnlock'); an open one transitions. An explosion reaching a wall slot
  (`World.onSecretWallBombed`) opens a hidden wall on both sides ('secretFound', `discoverRoom`). Thorn Room doors
  (kind cursed) cost ½ heart per pass (i-frames reset, god mode exempt).
- **Transition**: destination (Curse of the Maze: 20 % of regular doors lead to a random visited room, combatRng) →
  toll → save the room being left (grid, pickups, pedestals) → `data.current` = destination → **checkpoint** →
  `enterCurrent()`.
- **Clears**: the wave dying out (`arena.active` false) → the next challenge wave (after `challengeGap` = 1 s, doors
  still locked), or the room is cleared (the arena already dropped the 'roomClear' reward, charged actives, fired
  triggers): challenge rewards appear; minibosses leave the 'minibossReward' table + a heart; boss rooms get the
  trapdoor (centre, 'trapdoor' a = 0, 'stairs'), the reward pedestal nearby, a heart, the grate if the route is
  here, and maybe the Broker's Nook (`floorRng(...).fork('nook')` < `nookChance()` = 25 %, + 35 % after a floor without
  damage → `openNook`, 'secretFound' b = 2); a final boss gives its ending (§6d).
- **Trapdoor**: usable 0.8 s after it appears and only once the player has stepped off it; stepping on → 'trapdoor'
  a = 1 (id 'trapdoor' / 'grate' / 'whirlpool' / 'debug', x,y = where she fell), the next floor on `trackAfter(floor,
  track)` (the same track, except the alt track rejoins the main one at chapter 6 without Ending 1).
- **Curses** (`layout.curse` → `world.curse`): darkness (render: light pools, `darkVision` ignores it), lostMap
  (`map.lostMap`), maze (above), blind (render: '?' on pedestals / item pickups), unknown (render: hidden hearts),
  deluge (movement accel × 0.35 / decel × 0.2 unless flying, rain). `RunOptions.curse`: undefined rolled, null none, an
  id forced on every floor; debug `run.setCurse(c)`.
- **Seeds as players see them** (Phase 4B): `RunOptions.seedInfo` → `RunData.seedInfo` (`RunSeedInfo { code, kind: 'random' |
  'custom' | 'daily', date?, scored? }`, optional — absent on debug runs and older saves). `code` is the 8-character code
  (`meta/seedCode.ts`) and the sim seed is its hash (`Sim.newRun(code)` → `seedToU32(code)`), so a code always replays the
  same floors; it rides in the snapshot, so Continue, the pause menu and the game-over screen show it. `kind` / `scored` tell
  the meta tracker what counts (§7a). Runs without it show their numeric seed as `#1A2B3C4D`.
- **Snapshots** (`RUN_SNAPSHOT_VERSION` 2): every room entry stores a checkpoint — `JSON.stringify({ v, run: RunData,
  world: WorldSnap, player: PlayerSnap })` (`run/snapshot.ts`: health incl. bonus hearts, inventory + charges, luck
  bonus, temporary effects by value, trigger cooldowns by list position, the per-player timers that carry across
  rooms, the run's transformations and announced synergies (`sets`, `synergiesSeen`, optional), rng states, counters
  (incl. `donated`, `slotPlays`, `bossKills`), seen enemies, enemy serial, god mode). The run save (§7) stores exactly this.
  `Sim.snapshot()` returns a fresh parse of it (JSON-safe, a few KB); `Sim.fromSnapshot(snap)` restores world + player
  and runs the same `enterCurrent()`, so play continues exactly as it did after the snapshot (same room, same future
  rolls and floors; a boss fight replays identically; tests step both side by side). Progress inside the current
  room is not part of it (resuming = walking into that room again).
- Debug / tools: `run.goThroughDoor(side)`, `teleport(room)` (walks in through its first door), `skipFloor()` (on a
  final floor: floor 13 when the whirlpool is open, else the ending), `revealMap()`, `setCurse(c)`, `trackAfter`,
  `nookChance()`, `seen(id)`, `unlocked(id)`, `summary()` (`SimSummary.run`: + ending, plate, grate, exits, boss).
  Tuning: `RUN_TUNING` (sim/tuning.ts).

## 6c. Bosses (`src/sim/bosses`, content in `src/content/bosses`)

A boss is an ordinary pooled Enemy (hits, statuses, knockback, collisions, rendering all reuse the enemy code) whose
`boss` (`BossState`, `state.ts`) replaces the movement / attack step of the enemy update (`updateBoss`, `brain.ts`).
- **Compile** (`compile.ts`, cached per def): one synthetic EnemyDef per phase (id = the boss id; baseline movement,
  the phase's enemy-library attacks + its `summon` as a spawnMinion attack, speed × speedMul, contact, mass, resist,
  goo, big) and the phase's patterns with resolved params (`[default, min, max]` like the enemy behaviours), minion
  defs, shot style; the thresholds. Defaults: speed 30, mass 6 / miniboss 3 / final 9, resist 0.5 / 0.65 / 0.4
  (bosses resist statuses: shorter, and below 0.75 freeze only slows).
- **Fight** (`world.boss`, a `BossFight`): `spawnBoss(w, def, x, y, { hp, intro })` fills it (id, name, flavour
  `title`, `chapter` name, kind 0 boss / 1 miniboss / 2 final, group = the first part's uid, max / current HP, phase
  marks, intro timer, ending) and emits 'bossIntro'. `updateBossFight` (start of every enemy update) sums the HP of
  every living part of the group, advances the phase (monotonic: phase i begins when HP / max ≤ `at_i`) and ends the
  fight when no part is left (`done`, `bossKills`++).
- **Brain** per part and tick: the spawn poof, then the intro (idle while the card is up, 1.6 s / miniboss 1.2 s) →
  a phase change when the fight's phase moved on (`startPhase`: the phase's EnemyDef / cfg / speed, fresh attack
  timers, re-init movement, `pace`, 1.1 s invulnerable roar — 'bossPhase', hits 'tink' ('bossBlock') — then its
  `enter` pattern) → otherwise the running pattern, or the baseline (the phase's movement + attacks) for a rest of
  `rest` s ÷ pace, then the next pattern (in order, or a seeded weighted pick that never repeats the last one).
  Fear makes a boss back off (no new patterns); dazes are ignored. `bossDamage` stops any single blow just past the
  next threshold, so every phase change is seen.
- **Patterns** (`patterns.ts`, `BOSS_PATTERN_KINDS`), each a small state machine on the BossState scratch slots that
  starts with a telegraph ('bossTell', flash + squash, a pose) — timers ÷ pace, shot speeds × √pace: `charge` (aim
  line, dash, bonk: shake, ring, debris), `jumpSlam` (crouch, leap to a marked spot, slam: shockwave rings + ring),
  `ring` (repeats, spin, alt, aim), `spiral` (arms, rate, turn, reverse), `wave` (walls of shots with a gap),
  `aimedBurst` (fans, lead), `summon` (adds, capped), `beamSweep` (a telegraph line, then a beam sweeping an arc —
  `BossBeam`s, rocks are cover, width / 2 + 0.6 × her radius), `burrow` (dig, tunnel, rumble mound, erupt),
  `teleport` (fade, marked spot, reappear + ring / burst), `debrisRain` (slam, marked drops: rocks or lightning),
  `split` (parts sharing the fight's HP, smaller and faster — `spawnPart`), `shields` (orbiting tethered orbs,
  default 'bubble-ward'), `hazard` (lobbed globs leaving puddles), `hook` (named per-boss code). Everything goes
  through the enemy shot / lob / wave / creep pools (caps and the charm rules apply). Nothing allocates per tick.
- **Hooks** (`hooks.ts`): `registerBossHook(name, { tick?, phase?, pattern? })`; a def's `hook` gets `tick` and
  `phase(ctx, i)` (phase 0 when the intro ends), 'hook' patterns call `pattern(ctx)` until it returns true. The
  context gives the World, the Enemy, its BossState and a small API (shoot, ring, drop, summon, random).
- **Death sequence**: the last part's killing blow (`bossLethal`) sets `dying` (untouchable, harmless, still alive
  for the arena) and emits 'bossDying' (the scene's slow motion + flash); the brain kills its adds, fizzles hostile
  shots / creep / shockwaves, emits a 'bossBoom' every 0.15 s for 2.4 s, then 'bossDefeated' and the real kill
  (drops — 'bossSpill' —, 'enemyKilled'), the fight ends and the room clears as usual. Other parts of a split boss
  just die. Debug kills (`killEnemies`, `clearRoom`) skip the sequence.
- **Selection** (`select.ts`): `bossPool(chapter, kind)` = `bossesInChapter` (explicit list ∪ bosses listing the
  chapter); a chapter with none borrows every boss of the kind; `pickBoss(seed, floor, track, chapter, kind, avoid)`
  = a weighted pick on `floorRng(...).fork(kind)`, avoiding the previous floor's boss of the same chapter;
  `finalBossDef(key)`; `bossHpFor(def, floor)` = hp × (1 + 0.14 × floors past its home chapter). Only when no BossDef
  of a kind exists at all does a room fall back to the Phase 3A placeholder (a big sturdy chapter enemy).
- Content (`src/content/bosses`): Gutterways — Sodden Snarl (boss; charge + debris, stepped rings, muck puddles;
  splits in two at half), Brimwell (boss; jump-slams, stepped spirals, rain walls; overflowing: water jet sweep,
  double slams, ceiling debris, a spiral), Pipewhip (miniboss; burrow, aimed spit, pipe-hopping teleport; thrashing:
  rats, double dives, a spiral); finals (placeholder-but-playable, replaced later — keep ids and keys): Old
  Thunderhead (thunderhead, ending 1), The Nestmother (nestmother, ending 2), The Undertow (undertow, ending 3). Boss
  minions in `content/enemies/boss-minions.ts` (weight 0): Bubble Ward, Nest Drone. Tuning: `BOSS_TUNING`.

## 6d. Special rooms, economy, routes, endings (`sim/run/special.ts`, `sim/shopProps.ts`, `sim/roomProps.ts`)

- **Placement** (`special.ts`, deterministic from the mirrored template and its markers): a SOLID prop (jar, gambler,
  trader) goes on plain floor away from the door fronts and the markers, only where the room stays connected without
  that cell (`solidPropCell`: preferred corners first, BFS check); FLAT floor objects (grate, whirlpool, skylight) on
  any plain non-marker floor (`floorCell`). Wall NPCs perch on the top wall's ledge (`world.props.npc`, `npcX`).
- **Keepsake Room**: a treasure-pool pedestal (seen items leave the pools, §6b).
- **Magpie's Stall**: Magpie on the wall (greets on the first visit, flaps at a sale, shakes her head at an empty
  purse), ≤ 5 slots: 2-3 items (10 / 12 / 15 / 20 / 25 coins by quality, trinkets 10, consumables 5 + quality) and
  pickups for sale (heart 3, key / bomb / Tin heart 5, spark 6, double bomb / Ember heart 7); buying = walking onto a
  slot with enough coins; tags drawn in the pixel font (red when unaffordable); `haggler` −25 %; the DONATION JAR
  (leaning on it drops a coin every 0.28 s; `counters.donated` — at 5 / 15 / 30 / 50 / 75 / 99 coins luck +0.5
  ('donate' b = 1); counted for unlocks later).
- **Gumball Gambler** (12 % of normal rooms): 1 coin per spin (0.9 s), a seeded outcome on the loot stream (nothing
  46 %, 2-3 coins, a heart, a bomb, a key, a spark, a gold coin, rarely a trinket); a blast breaks it open for 3-6
  coins (`world.onExplosion`).
- **Old Pell** (15 % of floors, one normal room): a snail trader offering one trader-pool item for 3 keys (haggler 2).
- **Hidey-Hole / Forgotten Pocket**: secret-pool loot; the Pocket holds a quality 3+ item or a big pile of loot.
- **Rain Barrel Arena**: calm on entry with a pressure plate in the middle; stepping on it ('plate') locks the doors
  (`arena.locked`) and starts 3 pre-rolled waves 1 s apart ('npcSay' WAVE N OF 3); the reward appears after the last.
- **Thorn Room**: its 'i' holds a curse-pool item or a lockbox; the doors bite (§6b).
- **Broker's Nook**: after a boss (25 % + 35 % without damage), a door on the boss room's reserved cell; the Moth
  Broker on the wall; two broker-pool deals (quality ≥ 2) priced 1 heart container (2 for quality 4) — 3 Tin hearts
  per container when she has none; taking one makes the other vanish (a choice group).
- **Hidden routes**: `altRouteAllowed(floor, track, unlocked)` = main track, floor < 12, and floors 10-11 (whose next
  floor is chapter 6) only with 'ending1'. The generator's `hiddenRoute` room holds a cracked drain grate (drip hint;
  in the boss room only after the boss); a blast opens it ('grate' a = 1); stepping in drops to floor + 1 on the ALT
  track ('grate' a = 2, iris). Trapdoors keep the track (`trackAfter`).
- **Endings**: a final boss (floor 12 main Old Thunderhead → 1, 12 alt The Nestmother → 2, 13 The Undertow → 3) ends
  the run: `data.won` = 1, `data.ending`, 'runEnd' (a 1, b = ending). With 'ending1' + 'ending2' unlocked, beating a
  floor-12 final instead raises a WHIRLPOOL (→ floor 13, The Undertow) and a SKYLIGHT (→ that final's ending);
  `RoomState.exits` keeps them. The run scene then shows the ending screen (Phase 4B: a painted vignette + the epilogue per ending, §7b).

## 7. Saving & PWA (`src/meta`, `src/pwa`; integration guide: docs/saving.md)

Wired in Phase 4A. `meta/save.ts` `GameSave` (built once in main.ts, `app.save`; `installGameSave` makes the module-level
`saveRunNow()` reach it) owns the storage (`createStorage()`), the `MetaStore`, the `RunSaveStore` (version =
`RUN_SNAPSHOT_VERSION`, migrations `RUN_SNAPSHOT_MIGRATIONS` — none yet), the `AchievementEngine` and the `MetaTracker` (§7a):
- **Meta** saves itself: `save.endTick()` once per loop tick (also while portrait-paused) = counter achievements, then
  `meta.endTick()` (urgent changes at the end of the tick, frequent ones every 5 s). `saveRunNow()` flushes it too.
- **Settings** persist: the runtime `SettingsStore` starts from `toRuntimeSettings(meta.settings)` and every change goes back
  through `meta.updateSettings(fromRuntimeSettings(s))` (a no-op when nothing changed). Phase 4B: `leftHanded` and `showFps`
  joined the runtime `Settings` and the adapters (they were in `MetaSettings` already).
- **Export / Import** (Phase 4B, Settings → SAVE DATA, §7b): `save.exportCode()` = `exportCode(meta, { run: runs.peek() })`
  (progress + the saved run, to move devices mid-run); `save.checkImport(text)` validates (nothing changes);
  `save.applyImport(result)` (after the player confirmed) replaces the meta state, restores the code's run (a code without
  one keeps the local run), rebuilds the achievement engine's pending lists, re-applies earned rewards quietly and flushes;
  the caller re-applies the imported settings. Import is offered from the title only (a live run would overwrite the run
  it brings).
- **The run save** = `Sim.snapshot()` (the room-entry checkpoint, §6b): written when a run starts / is continued, after every
  room entry (door, trapdoor, grate, whirlpool — the run scene sees 'roomEnter'), on pause, when the page is hidden
  (visibilitychange / pagehide / blur) and before leaving a run for the title (`nav.title`). `save.host.savableRun()` (the
  run scene's `savableSim()`) decides what may be written: a floor run in progress — never the yard, never a dead or won
  run. Death clears the save the moment the player dies (closing the app can't dodge it); a win clears it at 'runEnd'. A
  New Run over a saved run abandons it (`abandonSavedRun`: a 'quit', the win streak ends).
- **Continue** (title, shown when `runs.hasRun()`): `save.loadRun()` → `new RunScene(app, 'run', snapshot)` → `Sim.fromSnapshot`
  (the same room, re-entered exactly). A damaged latest save continues from the previous room's copy (toast "RUN RESTORED"),
  a damaged / unknown-version one is dropped with a toast, a newer version's is left alone (toast). Restore errors are caught.
- **Notices**: `save.notice` from the meta load status — restored from the backup, damaged, a newer version's save (the slot
  is read-only), no persistent storage: the passing ones (restored, damaged) as a toast at boot, the lasting ones (newer
  version, no storage) as a line on the title.
- `localStorage` keys: `stormdrain.meta`, `stormdrain.run`. Envelope `{ v: number, data, sum }` (`saveCodec.ts`):
  `sum` = FNV-1a 32 over `'<v>:' + JSON.stringify(data)`, checked by re-serialising the parsed data.
- `storage.ts`: `createStorage()` (localStorage, in-memory fallback; nothing throws) and one `SaveSlot` per key. A write
  first copies the previous good save to `<key>.bak` (identical saves are skipped; out of space → drop `.corrupt` /
  `.bak`, retry once). A damaged main save loads from `.bak` and is repaired, the damaged text kept as `<key>.corrupt`.
  A save from a NEWER version makes the slot read-only (status `future`): an old cached build never overwrites newer
  progress. `requestPersistentStorage()` asks the browser not to evict (best effort).
- Migrations (`migrations.ts`): `MigrationSet`s `META_MIGRATIONS` (`META_VERSION` 1; v0 = the Phase 1 prototype layout)
  and `RUN_MIGRATIONS` (`RUN_VERSION` 1, the store's default — the game's run slot uses `RUN_SNAPSHOT_VERSION` 2 with
  `RUN_SNAPSHOT_MIGRATIONS`, meta/save.ts); the loader upgrades step by step; unknown fields are never thrown away
  (unknown top-level keys → `MetaState.extra`, unknown nested keys stay on their objects) and are written back.
- `metaState.ts` `MetaStore`: settings, unlock sets (saved as sorted arrays), achievements + open-ended counters,
  collection, bestiary, lifetime stats, daily results (one per UTC date, newest 400). Important changes (settings,
  unlocks, achievements, run start/end, import) save at the end of the tick — call `meta.endTick()` once per loop
  tick; frequent ones (kills, counts, play time) at most every 5 s; a failed write retries after 10 s. `flush()`,
  `subscribe()`; `toRuntimeSettings` / `fromRuntimeSettings` adapt to `meta/settings.ts` structurally.
- `runSave.ts` `RunSaveStore` (`stormdrain.run`): save / load / clear / hasRun of any plain-JSON snapshot ≤ 1 M chars
  (NaN, Infinity, cycles, Map / Set / class instances are rejected with the offending path). The snapshot is
  `Sim.snapshot()` (`RunSnapshot`, §6b: the whole `FloorLayout` included; ≈ 20 KB, < 0.5 ms per save on desktop).
- Export / Import (`exportCode.ts`): `SD1:` + base64url(UTF-8 of the same checksummed envelope) with body
  `{ app, at, meta: { v, data }, run?: { v, data } }`; import checks prefix, encoding, checksum and version, migrates,
  and returns a plain-language error (changing any character is rejected); a run that can't be upgraded is dropped.
- PWA: `public/manifest.webmanifest` + icons (`npm run icons` → scripts/gen-icons.mjs; opaque; maskable safe zone and
  art checked by tests/pwa-icons.test.ts); `index.html` links them with root paths that Vite rewrites to `./`.
  `scripts/sw-plugin.mjs` (Vite plugin, `closeBundle`) writes `dist/sw.js` from the pure `src/pwa/precache.ts` +
  `swSource.ts`: every dist file with relative URLs, version = content hash, cache `stormdrain:<scope>:<version>`.
  The worker precaches with `cache: 'reload'`, serves navigations from the cached `index.html`, is cache-first
  otherwise, and ignores `Vary` on lookups. `src/pwa/register.ts` `registerServiceWorker()` (production + secure
  origins only; main.ts calls it after boot, plus `requestPersistentStorage()`) applies updates quietly on the next
  launch, never reloads the page (a toast says "GAME UPDATED · RESTART TO PLAY THE NEW VERSION"). It assumes a single JS
  bundle (code splitting would need old chunks kept). e2e/pwa.spec.ts checks the links, the manifest's icons,
  `dist/sw.js` and the registration.

## 7a. Meta progress & achievements (`meta/tracker.ts`, `meta/achievements.ts`, `meta/unlocks.ts`)

- **MetaTracker** (`save.tracker`): the run scene calls `startRun(sim, daily?)` (a new run: `recordRunStart`) or
  `resumeRun(sim)` (Continue: not a new run), `afterStep()` after every Sim step and `playTime(dt)` each tick the run is on
  screen; `exit` detaches. From the tick's GameEvents: bestiary ('enemySeen', 'enemyKilled' — bosses once per FIGHT, from
  `world.counters.bossKills` + `world.boss.id/kind`, never per split part), collection ('item' fresh → collected; every id
  added to `run.data.seen` → seen, except under the Curse of the Blind), lifetime stats (runs, wins, deaths, kills, boss kills,
  items, floors cleared, play time, best floor, streaks, per-character runs / wins, the daily result), and counters (chests,
  keys, coins collected / spent, items bought, broker deals, actives / consumables / tonics / stickers used, bombs, secrets,
  deep secrets, donations, slot plays, trades, ember novas, alt routes, cursed rooms, challenge rooms, minibosses,
  transformations, synergies, no-damage / damage-taken floors) and records (`maxItemsHeld`, `maxCoinsHeld`, `maxFamiliars`,
  polled each tick). A floor is finished when she drops through its exit ('trapdoor' a = 1) or wins on it; it is clean when
  `world.counters.hurts` didn't change since it began. Death / 'runEnd' end the run (`recordRunEnd`; a win also unlocks
  `endings: ending<n>` whatever the achievement content says). Nothing is tracked in the yard or after the run ended.
- **Seeds** (Phase 4B, `RunData.seedInfo`, §6b): a scored DAILY run claims the day when it starts (`recordDaily` with
  `done: false` — one scored attempt per UTC date; a second start that day runs unscored), updates the entry on every floor
  (an abandoned attempt keeps how far it got; Continue picks the attempt up again with its kills) and finishes it at death /
  victory (`meta.updateDaily`). A PRACTICE run (`isPracticeSeed`: a typed seed, a retry of the same seed, an unscored daily
  replay) doesn't report run events to the achievements and doesn't unlock endings; lifetime stats, counters (and the
  counter achievements they reach), the collection and the bestiary still count. `tracker.scoredDaily`, `featsCount`.
- **AchievementEngine** (`save.achievements`): pending achievements split into counter watches (checked by
  `checkCounters()` — the tracker's `endTick` only when something changed) and event lists (`event(kind, id, value)`,
  filters `id` / `value` / `atLeast`). `grant(def)`: `meta.unlockAchievement`, then its rewards into the meta unlock sets —
  `unlocks` entries (item → items, character → characters, route → routes, ending → endings, challenge → challenges, other
  kinds get their own set) and every item / character whose `unlock` names it — and an `EarnedAchievement` (name, desc,
  reward lines) joins `earned`; main.ts drains it into toasts (+ the 'achievement' sfx). `syncRewards()` at boot re-applies
  rewards of earned achievements (content added later), then `checkCounters()`.
- **Unlocks** (`meta/unlocks.ts`): an item / character with `unlock` is unlocked when its id is in the unlock set OR its
  achievement is earned. `runUnlocks(meta)` = unlocked `unlock`-flagged items + endings + routes: the snapshot a NEW run takes
  (`RunOptions.unlocked` — RunScene.makeSim / restartRun); a continued run keeps the one it started with.
- Content: `src/content/achievements/core.ts` (15: first kill, first chest, first boss, 10 items held, 50 coins, 3
  familiars, a clean floor, chapter 3, 5 secrets, a transformation, 10 deaths, Endings 1-3, a win with Wren). Six starter
  items are locked behind them (Party Popper, Ice-Cube Tray, Paper Valentine, Geode, Wick Wisp, Rooftop Rod).

## 7b. Scenes & UI
- `ui/scene.ts` is a stack: the top scene gets updates and keys and owns the hit-testable buttons; `overlay` scenes
  (pause, settings, map, debug, the modal blocker, game over, the ending) draw over the scene below. Scenes never import
  each other: navigation goes through `App.nav` (built in `main.ts`: `title, newRun, continueRun, characters(seed),
  startRun(start), daily, seedEntry, collection, bestiary, stats, achievements, settings, pause, resume, back, map, yard,
  gameOver(info), victory(info), debug`). Optional scene hooks: `describe()` (what it shows, for `__SD.screen()`),
  `toastsAtTop` (toasts slide in from the top while it is on top — screens with buttons along the bottom).
- **Menu kit** (Phase 4B, `ui/widgets.ts`): canvas-drawn `UiButton`s (`kind` primary / secondary / hud / tile; `icon`;
  `nav` false for big invisible areas; `adjust(dir)` for sliders) >= `BTN_H` = 27 game px tall — >= 44 pt even in Safari's
  short landscape view (≈ 1.67 CSS px per game px). Every UI button activates on pointer-up inside itself (touch, mouse)
  or by keyboard. `MenuNav`: keyboard focus per scene — arrows move to the nearest focusable button in that direction,
  Tab cycles, Enter / Space activate, a focused slider takes left / right; the focus ring (gold corner brackets) shows only
  while the keyboard is the last device. `Scroller`: drag / flick / wheel scrolling of a draggable area button (momentum,
  soft bounce, scroll bar). `pageBackdrop()` (the title's drain, darkened) + `drawPageHeader`, `wrapText` (cached).
  `ui/page.ts` `PageScene`: a full-screen page pushed over the title — BACK (`<page>.back`, Esc / Backspace), the header,
  MenuNav; `ui/gridPage.ts` `GridPage`: a scrolling cell grid + a detail panel (tap a cell; arrows move the selection).
- The title (`ui/title.ts`): the play column inside the drain arch — CONTINUE (primary, only with a saved run) / NEW RUN /
  DAILY RUN (a tick once today's daily is claimed) / ENTER SEED; wall tiles COLLECTION, BESTIARY (left), ACHIEVEMENTS, STATS
  (right); SETTINGS in the top-right corner; the lasting save notice on the bottom line. Keys: arrows + Enter, C / N / D / E
  / O / B / A / T / S. `focus()` re-lays it out (Continue appears after an import, the daily tick after a daily).
- Character select (`ui/characterSelect.ts`, scene 'chars', `nav.characters(seed)`): New Run (seed null = a random code
  rolled at START), Daily Run and Enter Seed all come here. A strip of slots for every `CharacterDef` (registry order; paged
  with `<` `>` when more than 8), locked ones as dark silhouettes with a padlock; the picked one big (3× portrait, glow,
  name) with its description, `mechanicDesc`, six stat bars, starting hearts / pickups / items — or, locked, '???' and the
  unlock hint (its achievement's description; '???' for a hidden one). START (disabled while locked) → `nav.startRun({
  character, seed })`; the header says which seed (random / DAILY date · code, scored or practice / SEED code, practice);
  "STARTING ABANDONS YOUR SAVED RUN" when there is one. The last pick is remembered for the session (`lastCharacter()`).
- Seeds (`meta/seedCode.ts`): every run has an 8-character code shown as `ABCD 1234` (`RunSeedInfo`, §6b). Enter Seed is a
  DOM modal (below): letters / digits, spaces and dashes ignored, live validation ("TOO SHORT: 5 OF 8"), Enter / NEXT →
  character select. Daily (`nav.daily()`): the code from the UTC date (`dailySeedCode`); scored when the day has no result
  yet, else a practice replay (§7a).
- **DOM modal layer** (`ui/domModal.ts` `DomModal`, `app.modal`; flows in `ui/modals.ts`): the only DOM UI — Enter Seed,
  Export save (the `SD1:` code in a read-only textarea, SELECT ALL, COPY via `navigator.clipboard` with a select +
  `execCommand('copy')` fallback) and Import save (paste → CHECK CODE → the plain-language error, or a summary + REPLACE /
  BACK; `GameSave.checkImport` / `applyImport`, §7). A fixed full-viewport layer (`data-sd-modal`) above the canvas holds a
  pixel-styled panel placed inside the game image; text selection / typing only inside it (inputs 16 px+ so iOS doesn't
  zoom; focused synchronously inside the tap so the iPhone keyboard comes up); Escape / a tap on the backdrop cancels.
  While open, main.ts pushes `ModalScene` (scene 'modal': dims, no buttons, swallows keys); engine/input.ts ignores keys
  aimed at the modal and lets its gestures through.
- Pause (`ui/pause.ts`): left — PAUSED (the secret 5-tap `pause.title`), the character, floor + chapter, the seed (DAILY /
  PRACTICE tag), the curse, the run time; RESUME / SETTINGS / QUIT TO TITLE (`pause.resume` / `pause.settings` /
  `pause.quit`; Esc / P resume, S settings, Q quit). Right — the six stats with icons (`ui/statRows.ts`; green above the
  character's base, red below), every held passive as a grid (×N for copies; scrolls), the active with its charge, trinkets,
  the consumable ("POCKET"), transformations; one tap area `pause.items` — tap anything for its name, kind, quality and
  description underneath.
- Settings (`ui/settingsPanel.ts`, overlay 'settings', from the title or the pause menu): MASTER / MUSIC / EFFECTS / SHAKE
  sliders (tap the track to jump, drag to slide; volumes are heard live and committed on release — a quick tap is caught by
  the release), SHOW FPS, AIM 4-WAY / 360°, LEFT-HANDED, BUTTON SIZE 75-150 % (5 % steps), EXPORT / IMPORT SAVE (import
  only from the title: it replaces the saved run). Ids `settings.<master|music|sfx|shake|fps|aim|lefty|buttons|export|
  import|back>`. Everything persists through the meta save.
- Collection (`ui/collection.ts`): every item — '?' never seen, a dark silhouette seen, full colour collected, a padlock
  locked — sorted by kind, quality, name; the detail shows name, kind, quality, description, counts, or the unlock hint.
  Bestiary (`ui/bestiary.ts`): tabs FOES / BOSSES; '?' never met, dimmed met, full colour + kill count defeated; the detail
  animates the sprite with met / defeated counts, where it lives and its blurb. Stats (`ui/statsPage.ts`): two scrolling
  columns (runs, combat, routes & rooms; finds, the daily run with the last five days, per-character runs / wins).
  Achievements (`ui/achievementsPage.ts`): earned (gold cup, date, "UNLOCKED: …") / locked (grey cup + padlock, "REWARD:
  …", `rewardLines`) / hidden ('???' until earned), with a progress bar.
- Toasts (`render/toasts.ts` `ToastLayer`, `app.toasts`): achievements (trophy, gold) and notices (drop, blue) slide up over the
  bottom wall one at a time (3.2 s), drawn by main.ts over every scene (from the top edge while a `toastsAtTop` scene is on
  top); never a button, never over the room's interior. Settings → SHOW FPS draws a small readout bottom-left (main.ts).
- The run scene (`ui/run.ts`, `RunScene(app, 'run' | 'yard', snapshot?, start?)`): `nav.startRun(start)` = a real floor run
  with that character and seed code (`Sim.newRun(start.simSeed ?? code, { seedInfo, unlocked }, character)`), `nav.newRun()` =
  the same with a random code and the last character, `nav.continueRun()` = the saved one, `nav.yard()` = the training
  yard (debug menu). In a run: walking through a door
  freezes stepping for 0.25 s while the previous frame's room image (the back buffer's room rect, copied every run frame) slides out and the new room slides in, clipped to
  the room; the trapdoor closes an iris on the old image (0.45 s) and opens it on the new floor (0.5 s); the floor card
  ('CHAPTER N · NAME', floor, curse; Phase 4B: the band opens from its centre line, the title / floor slide in, and twelve
  floor marks paired by chapter show the depth — past gold, here lit, violet on the hidden route) shows 2.8 s. Death
  (after 1.8 s of the death animation) pushes the game-over screen (`ui/gameOver.ts`, overlay 'over': what took her — the
  enemy / boss with its sprite from `World.killer`, or spikes / a brazier / her own bomb —, floor, chapter, time, character,
  seed, the items carried; RETRY SEED (`over.retry`: the same code as a practice run; a daily replays unscored) / NEW RUN
  (character select) / TITLE). A final boss dims the room for 1.4 s, then the ending screen (`ui/ending.ts`, overlay
  'ending'): a painted vignette per ending (1 CLEAR SKIES: rooftops at sunrise; 2 THE QUIET HIVE: the paper hive asleep in
  amber light; 3 WHAT THE RAIN KEPT: lost things rising from the calmed whirlpool), four lines of epilogue typed out (a tap
  shows them all — `ending.skip`), what the win unlocked for the first time ('ending1' / 'ending2' / 'ending3' route lines,
  the whirlpool hint, or "PRACTICE RUN · … NOT RECORDED"), the run in one line, NEW RUN / TITLE (`ending.newRun` /
  `ending.title`). `presentation().ending` stays 'death' / 'win'. Bosses (Phase 3B): the intro card ('bossIntro': portrait, CHAPTER /
  MINIBOSS / FINAL BOSS, the name, the flavour line) over the room, the HP bar in the top band in place of the room
  label, 1.5 s of half-speed slow motion when a boss starts dying ('bossDying'; presentation only: every other tick is
  skipped and drawn at alpha 1), the boss's own theme (`BossDef.music`, finals' tracks, the miniboss theme). Special
  rooms name themselves in the room label ("MAGPIE'S STALL · FLOOR 2", "RAIN BARREL ARENA · STEP ON THE PLATE"), NPC
  lines ('npcSay') and jar / gambler / trader / grate notices show in the top band, and the iris closes on wherever she
  fell (the 'trapdoor' event's x,y: trapdoor, grate, whirlpool). Music: chapter loop, floor sting, boss intro + boss theme,
  miniboss / shop / secret themes, quality-4 item fanfare, game over / victory jingles; the pause overlay muffles.
  Phase 4A (`render/featBanner.ts`): a 'transform' shows the big TRANSFORMATION! banner (set name, its line, sparkles) over
  the top of the room for 3.2 s with the item fanfare (the 'transformation' sfx via eventSounds, a light pillar + flash in
  WorldFx); a first 'synergy' shows the SYNERGY: NAME pill in the top band (over the top wall during a boss fight) in place of
  the room label. Saving / tracking: see §7, §7a.
- The big map (`ui/mapOverlay.ts`, scene 'map', `nav.map()`): tap the minimap or Tab; an overlay, so the run is paused
  underneath; any tap / Tab / Esc / M closes it.
- Debug perf overlay: three-finger tap on touch screens; on desktop from the debug menu (or Backquote outside a run).
- Hidden debug menu (`debug/debugMenu.ts`, scene 'debug', an overlay pushed by `App.nav.debug()`): Backquote on
  desktop, or tap the PAUSED title 5 times (each within 1.5 s; an invisible press button `pause.title`) on touch.
  Tabs ITEMS (every item, a scrollable two-column list: drag / flick / wheel / arrows; tap = pedestal next to Wren,
  or give directly with the mode toggle), FOES (spawn any enemy, optional forced champion) and CHEATS (god mode, full
  heal, +10 coins / bombs / keys, clear room, start wave, endless waves, perf overlay, +5 random items, drop all
  items, charge active). Keyboard: 1/2/3 or Tab tabs, arrows + Enter, M mode, Esc / ` close. Every action lives in
  the DOM-free `debug/actions.ts` (`DebugActions`), shared with `window.__SD.debug` and the headless tests. The
  CHEATS grid is 4 × 5 (24 px buttons); Phase 3A added skip floor, reveal map, go to boss, next curse, training yard
  and new run (`debug.cheat.12`-`17`); Phase 3B added BOSS: <name> and FIGHT BOSS (`debug.cheat.18`-`19`).

## 8. Rendering & audio
- Sprites are code: `{ w, h, palette: { [ch]: color }, frames: string[][] }`, rendered once into cached canvases.
  White hit-flash and tinted variants cached lazily. Animations: idle/walk, hurt, death.
- Layers: pre-rendered room background → shadows → pickups/props → enemies → familiars → player (costume layers
  behind / in front) → swipes → projectiles → beams (`lighter`) → enemy shots → charge meter → particles → chain
  arcs → full-screen flash → lighting/darkness → HUD → touch controls → UI overlays.
- Attack visuals (`render/attackRenderer.ts`): shot sprites and glows cached per (ShotStyle, shape, size bucket,
  rotation frame) — no string keys per frame; beams drawn straight from the sim's trace arrays, clipped to the room
  (never over the HUD margins): a segment of even width is ONE stroked path per pass, a tapering / flaring one ONE
  filled outline (left edge, round tip, right edge, round tail) — never a call per trace step; with more than 12
  lances or 2000 lance points on screen each lance drops to lite passes (one glow, the core, one strand) and the
  cores / strands dim with the crowd (lance: layered
  additive glows dimmed when many overlap, a white-hot core, 2-3 jagged animated lightning strands, muzzle and wall
  flares; lasers: thin zaps); swipes as a sweeping crescent band; familiars; costume layers; the charge meter.
  `render/attackFx.ts` (owned by WorldFx): lance charge sparks, the blinding blue-white flash + heavy shake + recoil
  kick on release, sparks along the beam and at hits / the wall, shot trails, split shards, bounce sparks, chain
  arcs, keeper sparkles, familiar poofs, costume sparks. The run scene's flash uses `fx.flashColor / flashMax`.
- Particles are presentation-only, pooled, capped. Screen shake/hit flash scale with Settings.
- Floor-run rendering (Phase 3A): `render/chapterArt.ts` recolours the chapter's tileset patterns and the shared rock /
  pit / corner maps with `ChapterDef.palette` into new SpriteDefs (cached per chapter); `RoomBackground.get(room,
  world.chapter)` rebuilds on grid / seed / chapter changes and adds the chapter's decals, wall trims and wall
  streaks. `render/doors.ts` draws `world.doors` with the 24×16 door sprites per kind (`content/sprites/doors.ts`:
  frames 0 open, 1-5 bars, 6 padlocked leaf; rotated per wall; unlock = the leaf fades, a blasted hole fades in; hinted
  hidden walls show a faint crack). The trapdoor (3 frames + a glow), price tags under priced pedestals, the '?' icon
  under the Curse of the Blind. `render/lighting.ts` (Curse of Darkness): one room-sized offscreen canvas filled dark,
  pre-rendered radial light sprites punched out (destination-out) at the player (r 54), fires, pedestals and the
  trapdoor, drawn over the world — a handful of drawImage calls. `render/minimap.ts`: the compact HUD map (6 × 5 px
  cells, centred on the current room, special rooms as dots) and the big map (15 × 11 cells, 5 × 5 icons from
  `content/sprites/mapIcons.ts`, door connectors), each cached in a canvas keyed by the model's version (no strings
  per frame); the Lost Map shows '?'. `render/transitions.ts`: the iris (a 64 × 64 hole mask scaled nearest-neighbour
  + four rects) and the floor card. WorldFx adds chapter ambience (drips, spores, embers, snow, motes, wind), rain for
  the Deluge, drips from hinted walls, rubble for blasted walls, key sparkles, trapdoor dust. The HUD hides hearts
  under the Curse of the Unknown; a 7 × 7 curse icon sits left of the minimap.
- Bosses & special rooms (Phase 3B): the world renderer clips everything it draws to the room's outer rect (a big boss
  near a wall never spills over the HUD). `EnemyRenderer` draws a boss with its pattern's pose (`BossState.anim`, with
  fallbacks), the phase's colour wash (`PhaseSpec.tint`, ramping in), a white flash + shudder on phase changes, the
  teleport fade, a shudder and white blinking while dying, the charge telegraph (marching dashes to the wall), landing
  / emerging markers, enemy beams (`drawBeams`: a flickering line, then glow + core + a white centre; lightning gets a
  jagged strand), falling debris (a rock over a double marker ring) and lightning strikes (a bolt + flash in the last
  instant). Boss sprites anchor in the lower body; their shadow sits under the sprite. `render/bossHud.ts`: the HP bar
  (name, phase notches, a pale drain trail, red / orange / violet by kind, slides in, blinks while dying) and the intro
  card. `WorldRenderer`: Magpie / the Moth Broker on the top wall (idle / pleased / head shake), the pressure plate,
  the grate (cracked / open), the whirlpool (grows, spins), the skylight (a cached shaft of sun), the donation jar
  (fills up with the thresholds), the Gumball Gambler (spins, wrecked), Old Pell with his offer floating over him,
  shop goods on a cushion, and price tags for coins / heart containers / Tin hearts / keys (red when unaffordable).
  Art: `content/sprites/bosses.ts` and `specialRooms.ts`, built with the pixel painter `content/sprites/paint.ts`
  (shapes, lines, textures, an automatic 1 px outline → row strings). WorldFx adds roars, slams, splits, chain
  explosions, the big defeat burst, lightning flashes, grate drips / swirl, jar and gambler sparkles, moth dust.
- The room background is pre-rendered and rebuilt only on `RoomGrid.version` changes; per-cell variation uses a
  positional hash so breaking one crate never reshuffles the rest. Fires are drawn live (flame height from hp).
- HUD (`render/hud.ts`), never over the room interior: hearts top-left (6 per row, wraps to a 2nd row), coin/bomb/key
  counters below (hop + flash when they rise), a segmented charge bar beside the active button (one segment per
  room; a continuous bar for timed items), the active/consumable buttons show the held items' icons, trinket icons
  beside the consumable button, and the pickup banner in the top band. Short notices ("NO BOMBS") replace the room
  label in the top band.
- Enemies (`render/enemyRenderer.ts`): floor layer (creep, shockwave rings, lob landing markers, burrow mounds, blink
  destinations), shadows, two depth passes around the player (walkers above her, then walkers below + flyers), shots
  last (outline + bright core + additive glow; allied ones pink). Per enemy: spawn fade/rise, idle/move/windup/air
  frames, telegraph blink + squash, hit flash + jolt, frozen tint, status wash + 5 px status icons, champion silhouette
  outline (`getSilhouette`) + glow, phantom fade, split copies drawn smaller. Doors (`render/doors.ts`) are drawn on the
  four wall centres; bars slide down while `arena.doors` > 0. Death bursts use the def's `goo` colours; big kills get a
  1-2 tick hit-stop in the run scene (presentation only: the scene skips sim steps unless an input edge is pending).
  No damage numbers.
- Audio: procedural SFX recipes by name with voice limits; enemy/status/door sounds in `audio/sfxEnemies.ts` (names
  prefixed `foe_`, `eshot_`, `gate_`, `room_`, `st_`); step-sequencer music with lookahead scheduling,
  a unique loop per chapter (+ boss variants), crossfades. Recipes are `{ minGap, length, gain, play(voice) }`
  built from the helpers in `audio/synth.ts` (leaf module); core sounds live in `audio/sfx.ts`, item/pickup/bomb/prop
  sounds in `audio/sfxGameplay.ts` (incl. the yard's `yard_bell`, `pedestal_roll` and the trigger notice `surge`),
  attack sounds (lance_charge / lance_ready / lance_fire / crackle / laser_zap /
  swipe / blade_* / shot_boom / chain_zap …) in `audio/sfxAttack.ts`; `audio/eventSounds.ts` maps GameEvents to
  sounds (a sim `'sfx'` event plays any `SoundName` by its `id`). `AudioOut.play(name, pan?, volume?, param?)`:
  `param` reaches the recipe as `voice.param` (the lance charge hum rises with it).
- SFX library + music (side track, merged after Phase 2; guide: docs/audio.md). `sfx.ts` has `registerSfx(recipes)`;
  `audio/sfxLibrary.ts` (~60 recipes: coin variants, doors, enemy / boss, fanfares, trapdoor, shop / slots, menus,
  player, curse…) self-registers when engine.ts imports it. Built-in names win a clash (`SHADOWED_SFX` must stay
  empty; a test checks). `SoundName` = built-in `SfxName` + `LibrarySfxName`; `Recipe` / `Voice` live in
  `audio/synth.ts` and a recipe may set `maxVoices` (per-sound voice limit under the global 20).
- Music: `AudioOut.music` is a `MusicControl` (`audio/music/director.ts` `MusicDirector`, on WebAudio AND NullAudio —
  before unlock it records the wanted track): `play(id, { fade })` crossfades, `stop`, `stinger(id, { then | stopMusic
  })` (ducks the music, or hands off on the exact sample), `duck`, `pause` / `resume` (on a bar line), `muffle`. A
  25 ms timer schedules 120 ms ahead from absolute step times (no drift); steps later than 50 ms are skipped; it stops
  while the page is hidden. The `MusicTrack` data format lives in `audio/music/types.ts` (not sim/types.ts); tracks in
  `content/music/*.ts` through `audio/music/registry.ts`; ids in `audio/music/ids.ts` — `CHAPTER_MUSIC[chapterId]`
  (= `ch_<chapterId>`, all 12 chapters), `BOSS_MUSIC` / `bossMusicFor`, `FINAL_MUSIC`, `MUSIC` roles (title, shop,
  secret, miniboss, jingles, stingers). `ChapterDef.music` / `BossDef.music` hold track ids (tests/music.test.ts
  checks them). Wired (docs/audio.md "Suggested wiring"; Phase 3A + 4A): title theme, chapter loops (crossfade), floor sting
  into the next chapter's loop, the boss-intro sting into the boss / final / miniboss theme (`bossTrack`: `BossDef.music`, else
  the miniboss theme, else the chapter's boss theme), back to the chapter loop when the room clears / on leaving shop and
  secret themes, quality-4 item + transformation fanfare, game-over / victory jingles, pause muffle (ui/run.ts, ui/title.ts,
  ui/pause.ts); volumes from the persisted settings.

## 9. Testing hooks
- `window.__SD` (all builds): read-only accessors for tests (scene name, run state summary, HUD rects, button rects,
  fps, `sim` handle) and `__SD.debug` actions (god mode, spawn, skip floor) used by E2E and the debug menu.
  Current shape (`src/debug/sdHooks.ts`): `scene`, `stack`, `fps`, `perf` (smoothed `updateMs` / `renderMs` of the loop,
  `droppedSteps`), `ticks`, `view` (game image rect in CSS px +
  `scale` = CSS px per game px), `safe`, `portrait`, `buttons()` / `button(id)` (game rect + `css` rect with centre
  `cx, cy` for taps), `sim`, `run()` (SimSummary: player, health string, inventory, stats, pickups, pedestals,
  counters…), `hud()` (HUD element rects in game px), `counts`,
  `debug.{overlay, hurt, kill, give(itemId), spawn(pickupName), roomClear, wave(count?), spawnEnemy(id, champion?),
  killEnemies, god(on), aim360, newRun, title, pause, spawnItem(id) (pedestal next to the player), giveRandom(n),
  items(), enemies(), heal, add(coins?, bombs?, keys?), clearRoom, resetItems, autoWaves(on), menu(open?)}` (the
  debug menu's actions, `debug/actions.ts`; Phase 3A: `yard()`, `door(side)`, `teleport(room?)` (default: the boss room),
  `skipFloor()`, `revealMap()`, `curse(c | null)`, `map()`, `runAt(floor, track?, curse?, seed?, unlocked?)`; Phase 3B:
  `bosses()`, `boss(id?)` — a boss fight in the current room), `presentation()` (the run scene's slide / iris / card /
  ending + `endingId` / `bossCard` / `slowmo`); `hud()` includes `bossBar` during a fight; `run()` has `boss`
  (id, hp, maxHp, phase, phases, dying, kind — null without a fight) and pedestals carry price / hearts / keys (after
  the haggler discount), goods, prop ('jar' | 'slots' | 'trader'), group; `counts` also has `enemies` / `enemyShots` / `beams`; `run()`
  includes `enemies` (id, x, y, hp, champion, status, burrowed), `enemyShots`, `creep`, `arena { active, wave, doors }`,
  `attack { primary, riders, mods, charge, beams, swipes, familiars }`, `run` (RunSummary: floor, track, chapter, room,
  roomType, cleared, curse, rooms, visited, doors[{ side, kind, state, to }], trapdoor, won, time, stats — null in the
  yard); `pedestals[]` carry `bell` / `rotate`.
  Button ids are `<scene>.<name>` (e.g. `title.newRun`, `run.pause`, `pause.resume`). The training yard adds
  `run.fight` (the bell under the consumable button; hidden during a wave) — keyboard: F; `run.map` is the minimap
  (tap = the big map, whose full-screen `map.close` closes it); a finished run shows `over.retry` / `over.newRun` /
  `over.title` (game over) or `ending.skip` / `ending.newRun` / `ending.title` (the endings); the
  pause overlay has the invisible `pause.title` (5 taps = debug menu); the debug menu's buttons are `debug.list`,
  `debug.tab.<items|foes|cheats>`, `debug.mode`, `debug.close`, `debug.cheat.<0-19>` (18 picks a boss, 19 fights it here).
- Phase 4A: `__SD.meta()` (achievements, unlock sets, stats, counters, collection / bestiary sizes, `hasRun`, `runSaves`,
  `lastRunError`, the meta load status, `runUnlocks`), `__SD.toast()` (the toast on screen + how many wait),
  `__SD.save.now()` / `__SD.save.achievement(id)`; the title's buttons are `title.continue` (only with a saved run),
  `title.newRun`, `title.settings`.
- Phase 4B: `__SD.screen()` = `{ name, info }` — the top scene's `describe()` (title: continue / dailyDone / focus; chars:
  characters, selected, canStart, seed; pause: character, info lines, seed, tag, curse, stats, items, slots, selected,
  `itemCells` (game-px centres to tap); settings: every value + importEnabled; collection / bestiary / stats / achievements /
  over / ending: their counts and selection); `__SD.modal()` = `{ open, kind, value, note, error }` (the DOM modal);
  `__SD.debug.demoCharacters()` (8 recoloured, locked placeholder characters so the character select pages) and
  `__SD.save.demoProgress()` (sample collection / bestiary / stats / achievements) — debug / screenshot fixtures in
  `debug/demo.ts`, never used by the game. More button ids: `title.<continue|newRun|daily|seed|collection|bestiary|
  achievements|stats|settings>`, `chars.<back|start|prev|next|slot.<id>>`, `pause.<resume|settings|quit|items|title>`,
  `settings.*` (§7b), `<page>.back`, `collection.grid`, `bestiary.grid` / `bestiary.tab.<foes|bosses>`, `stats.list`,
  `achievements.list`. The DOM modal's buttons carry `data-action` (`cancel`, `start`, `select`, `copy`, `done`, `check`,
  `back`, `replace`).
- E2E: the Phase 2 specs start in the training yard (`__SD.debug.yard()` after New Run → START); `e2e/floors.spec.ts` covers
  runs, `e2e/save.spec.ts` the run save across a reload + Continue, `e2e/pwa.spec.ts` the manifest / icons / service worker,
  `e2e/menus.spec.ts` (Phase 4B) every title item by real touch taps + back, typed seed entry → a seeded run, settings
  across a reload, the pause menu's stats / items, the daily attempt, export → import, retry-seed and keyboard navigation.
- Headless: `tests/helpers/sim.ts` builds a `Sim` with a seed + character and steps it with scripted input.
