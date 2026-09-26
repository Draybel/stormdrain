# Floor generation — API & integration notes

Pure, deterministic, headless module (`src/sim/floor/`, no DOM/canvas/audio) that turns
`(seed, floorIndex, track)` into a floor map, picks a room layout for every room, and tracks what
the minimap knows. Rendering, doors, transitions and spawning are the main track's job; this file
says how to wire them up.

```
src/sim/floor/
  types.ts      RoomType, RoomTemplate, FloorLayout, FloorRoom, NookReserve, FloorCurse, door bits
  generate.ts   generateFloor, openNook, roomAt / neighborRoom / regularDoorCount / layoutBounds, constants
  templates.ts  validateTemplate(s), pickTemplates, templateGrid / templateChar (mirroring), targetDifficulty
  minimap.ts    minimap knowledge model (MapVis, createMinimap, enterRoom, discoverRoom, revealMap, ...)
  library.ts    ROOM_TEMPLATES — every src/content/rooms/*.ts, auto-discovered (import.meta.glob)
  ascii.ts      floorToAscii — debug text map
  index.ts      barrel: import everything from 'src/sim/floor'
src/content/rooms/generic.ts   25 layouts for every chapter (chapters ['*']) covering all 11 room types
tests/floorgen.test.ts         5000 seeds × 13 floors × 2 tracks invariants, determinism, templates, picking
tests/floorminimap.test.ts     minimap reveal rules
```

## Quick start

```ts
import { ROOM_TEMPLATES, generateFloor, pickTemplates, templateRng, templateGrid, createMinimap } from '../sim/floor';

const layout = generateFloor(run.seed, floor, track, { allowAltNext, curses: true });
pickTemplates(layout, ROOM_TEMPLATES, chapter.id, templateRng(run.seed, floor, track));
const map = createMinimap(layout);              // start room visited, Lost Map curse picked up from layout.curse

const room = layout.rooms[layout.start];
const tpl = templateById.get(room.templateId!)!;  // build the id → template map once (content registry)
parseRoomLayout(templateGrid(tpl, room.flip), world.room); // existing sim/room.ts parser
```

## `generateFloor(seed, floorIndex, track, opts?) → FloorLayout`

- `seed`: run seed (u32 number). `floorIndex`: 1..13 (throws `RangeError` otherwise). `track`: `'main' | 'alt'`
  (floor 13, The Undertow, accepts either).
- Randomness comes only from `floorRng(seed, floorIndex, track)` (engine/rng.ts) and labelled forks of it:
  `plan` (room count + optional rooms), `layout` (growth attempts), `curse`, `hints`, `route`, and `templates`
  (for `pickTemplates`, via `templateRng`). Forks never shift each other, so e.g. `curses: false` or
  `allowAltNext` change only their own field — the map stays identical.
- Speed: ≈ 0.03 ms per floor (a few growth attempts; typed scratch buffers, objects built once).

Options (`FloorGenOptions`):

| option | default | effect |
|---|---|---|
| `curses` | `true` | roll a floor curse (chance `curseChance(floor)`: ≈4 % on floor 1 rising to ≈46 % on 13) |
| `cursePool` | all six | curses that may be rolled (e.g. restrict by meta unlocks) |
| `forceCurse` | — | debug override; wins over `curses` (`null` = none) |
| `allowAltNext` | `false` | allow a hidden-route grate to the ALT track for the next floor |
| `hiddenRouteChance` | `0.4` | chance of that grate when allowed |

The grate is only placed on the **main** track before the final floor (`floorIndex < 12`); boss trapdoors keep the
track, so on the alt track there is nothing to route to. Callers decide unlock rules (e.g. the alt route into
chapter 6 only after Ending 1 → pass `allowAltNext: false` on floor 10 until then).

### The layout

`FloorLayout` is plain JSON (arrays and numbers only):

| field | meaning |
|---|---|
| `version` | `FLOORGEN_VERSION` (1) — bump when generation changes on purpose (a pinned fingerprint test enforces it) |
| `seed, floorIndex, track, chapter` | inputs; `chapter` = 1..6 (two floors each), 7 for floor 13 |
| `width, height` | 11 × 11 grid; `cells[gy*11+gx]` = room index or −1 |
| `rooms` | `FloorRoom[]`; index 0 is the start room at (5,5); then growth order; then the secret and deep secret rooms |
| `start, boss, secret, deepSecret` | room indices |
| `bossDist` | door distance start → boss (= the farthest room) |
| `nook` | `{ gx, gy, side, templateId, flip, room }` reserved free cell for the Broker's Nook (see below) |
| `curse` | `'darkness' \| 'lostMap' \| 'maze' \| 'blind' \| 'unknown' \| 'deluge' \| null` |
| `finalBoss` | `'thunderhead'` (12 main), `'nestmother'` (12 alt), `'undertow'` (13), else `null` |
| `hiddenRoute` | room index holding the cracked grate, or −1 |
| `attempts` | growth attempts used (diagnostics) |

`FloorRoom`:

| field | meaning |
|---|---|
| `index, gx, gy, type` | `type` ∈ start, normal, treasure, shop, boss, miniboss, secret, deepSecret, challenge, cursed, nook |
| `doors` | 4-bit mask of every connection: `DOOR_N=1, DOOR_E=2, DOOR_S=4, DOOR_W=8` (side index 0..3 = N,E,S,W; `DIR_DX/DIR_DY/DIR_OPPOSITE`) |
| `secretDoors` | subset of `doors` that are hidden bombable walls (always both sides of a wall touching a secret room) |
| `hints` | subset of `secretDoors` showing a subtle hint (cracked tile, drips) on THIS room's side |
| `lockedDoors` | subset of `doors` needing a key (both sides of the treasure door from floor 3) |
| `locked` | entering this room needs a key (treasure rooms from floor 3 = chapter 2) |
| `secret` | secret or deep secret room (hidden on the map until discovered) |
| `dist` | steps from the start through regular doors; secret rooms: nearest neighbour + 1 |
| `templateId, flip` | set by `pickTemplates`; `flip` bit 1 mirrors left/right, bit 2 top/bottom |
| `hiddenRoute` | the cracked drain grate is in this room |
| `finalBoss` | on the boss room of a final floor |

### Rules the generator guarantees (tests check all of them over 130 000 floors)

- **Growth**: start in the middle; BFS queue; each empty neighbour is filled with a 50 % give-up chance and only if it
  touches exactly one room — so the map is a tree (no loops, no 2×2 blobs) and every two adjacent rooms share a door.
  Room count (start + normal + dead-end specials) = `baseRoomCount(floor)` (8 on floor 1 … 18 on floor 13) + 0..1,
  at least specials + 6. Average ≈ 8.9 rooms on floor 1, ≈ 18.5 on floor 13 (+ secret + deep secret).
- **Boss**: at a dead end at the maximum distance from the start (the farthest room of the floor), distance ≥ 3
  (≥ 4 on floors with 13+ rooms).
- **Dead-end specials** (exactly one regular door): boss, treasure (every floor), shop (every floor except 12/13),
  miniboss (35 %), challenge arena (30 %, floor ≥ 2), cursed room (25 %). Remaining dead ends stay normal rooms.
  A secret room may add a *hidden* second entrance to a special room (bomb in from the Hidey-Hole).
- **Secret room**: empty cell touching ≥ 2 rooms — 3+ whenever such a cell exists — never the boss room, never next to
  the nook cell. Every neighbour gets a bombable wall (`secretDoors`) to it.
- **Deep secret room**: empty cell touching exactly one room, which is a normal room; not next to the secret room or
  the nook cell. One bombable wall.
- **Hints**: each secret wall has a 40 % chance (deep secret: 25 %) of a hint bit on the visible side.
- **Nook reserve**: a free cell next to the boss room touching no other room; nothing is ever placed there.
- **Hidden route** (when allowed): 55 % in the secret room, 45 % in the boss room.
- Any failure → new attempt (typically 2–5; the plan relaxes every 400 failures so it always terminates).

## Templates

Content: `src/content/rooms/<anything>.ts` → `export default RoomTemplate[]`. `ROOM_TEMPLATES` (library.ts) collects
them all (sorted by file path). Ids must be globally unique. Chapter-specific rooms: `chapters: ['gutterways', ...]`
with the chapter ids from `content/chapters`; `['*']` fits every chapter.

```ts
{ id: 'gutter.normal.drainpipes', chapters: ['gutterways'], type: 'normal', difficulty: 2, grid: [ /* 7 × 13 */ ] }
```

Legend (ARCHITECTURE §5): `.` floor `#` rock `$` tinted rock `M` metal `O` pit `^` spikes `f` fire `x` crate `u` urn
`e` enemy `E` elite `c` chest `p` pickup `i` item pedestal `S` shop slot `B` boss.

`validateTemplate(t)` returns a list of problems (empty = OK). It enforces:
- id `[a-z0-9_.-]`, known type, difficulty 1–3, chapters non-empty and `'*'` only on its own, weight > 0;
- 7 rows × 13 legal characters;
- **door fronts** — the tile just inside each door, `(6,0) (12,3) (6,6) (0,3)` — are plain floor `.`, and no enemy
  spawn stands next to a door front. Because the fronts are symmetric, **any template fits any door mask and any
  mirroring**;
- every walkable tile (floor, markers, spikes, fire) is reachable from every other on foot (rocks, tinted rocks, metal,
  pits, crates and urns block — no flying, no bombing);
- the four doors are linked by a hazard-free path (you can always walk through a room unharmed);
- markers per type: normal ≥ 1 enemy; treasure ≥ 1 `i`; shop 2–6 `S`; boss/miniboss exactly one `B`; secret some
  `i/c/p`; deep secret some `i/c`; challenge ≥ 2 spawns + an `i/c` reward; cursed an `i/c` reward; nook 2–4 `i`;
  start/treasure/shop/secret/deep secret/nook have no enemies; `S` only in shops, `B` only in boss rooms, `i` never in
  normal/start/boss/shop rooms;
- the centre tile (6,3) is walkable in start, boss, miniboss and challenge rooms (player spawn, trapdoor, reward);
- at most 10 enemy spawns.

`validateTemplates(list)` also reports duplicate ids. A test runs it over `ROOM_TEMPLATES` — a broken template in any
content file fails CI with a readable message.

### `pickTemplates(layout, templates, chapterId, rng)`

Writes `templateId` + `flip` into every room (and `layout.nook`), returns the layout. Candidates: same type, chapter
fits (`'*'` or `chapterId`), sorted by id (file order never matters). Weight = `weight ?? 1` × difficulty fit ×
3 if made for this chapter × 0.15 if already used on this floor. Difficulty fit is a bell curve around
`targetDifficulty(floor, dist, bossDist)` = 1.0 on floor 1 … 3.0 on floor 13, + up to 0.35 on the way to the boss.
No template for a type → `templateId = null` (the generic set covers every type, so this only matters if a caller
passes a filtered list). Use `templateRng(seed, floor, track)` so picks are deterministic and independent of the map.

`templateGrid(t, flip)` returns the mirrored rows for `parseRoomLayout`; `templateChar(t, flip, col, row)` reads one
cell without allocating.

## Integration checklist (main track)

1. **Types**: `RoomTemplate`/`RoomType` live in `src/sim/floor/types.ts`; `src/sim/types.ts` should re-export them
   (ARCHITECTURE §5 points there). `src/content/registry.ts` can use `ROOM_TEMPLATES` (or glob the folder itself) and
   run `validateTemplates` in its duplicate-id test.
2. **Floor start**: `generateFloor` → `pickTemplates` → `createMinimap`. Chapter id for the floor: chapter number
   `layout.chapter` (1..7) + `layout.track` → the matching `ChapterDef`.
3. **Room load**: `parseRoomLayout(templateGrid(tpl, room.flip), grid)`. Markers: `e/E` enemies (chapter pool,
   elites/champions for `E`), `c` chest, `p` random pickup, `i` pedestal (pre-rolled from the floor stream), `S` shop
   slot, `B` boss/miniboss. Normal rooms may have a blocked centre — spawn room-clear rewards on the nearest free tile.
4. **Doors** on the wall centres (N above (6,0), E right of (12,3), S below (6,6), W left of (0,3)) for every bit of
   `room.doors`:
   - bit in `secretDoors` → solid wall (`Tile.SecretWall`-style) until bombed; show a crack/drip if the bit is in
     `hints`. From inside a secret room the walls look like doors (you know they are there).
   - bit in `lockedDoors` → key door (treasure from floor 3).
   - otherwise a normal door, styled by the neighbour's type (`neighborRoom(layout, i, side)`): boss, treasure, shop,
     challenge, cursed (spiky, ½ heart on entry/exit), miniboss, nook.
5. **Transitions**: leaving room `a` through side `d` enters `neighborRoom(layout, a, d)` at the door front of side
   `DIR_OPPOSITE[d]`; call `enterRoom(map, layout, idx)`.
6. **Secret walls**: bombing a secret wall opens it on both sides (keep an "opened" mask per room in the run state)
   and calls `discoverRoom(map, layout, idx)` for the room behind it.
7. **Broker's Nook**: after the boss dies, roll the nook with a floor-stream fork, e.g.
   `floorRng(seed, floor, track).fork('nook').next() < chance(noDamageThisFloor)`; on success
   `const n = openNook(layout)` (adds a `nook` room with a regular door off the boss room, template already chosen)
   and `discoverRoom(map, layout, n)`.
8. **Hidden route**: `room.hiddenRoute` → a cracked, bombable drain grate in that room (boss room: only after the boss
   dies); falling in starts floor+1 with `track = 'alt'`. The drip hint is the renderer's.
9. **Finals**: `layout.finalBoss` picks the final boss for the boss room; floors 12/13 have no shop.
10. **Curses**: `layout.curse` — darkness (light radius), lostMap (the minimap state starts with `lostMap = true`),
    maze (runtime door shuffling), blind (`?` pedestals), unknown (hide hearts), deluge (slippery floor).
11. **Minimap rendering**: for each room, `roomVis(map, i)` (Unknown = skip, Mapped = outline, Seen = dim,
    Visited = filled) and `roomIcon(map, layout, i)`; cache the drawn map by `map.version`; centre with
    `layoutBounds(layout)`. Map items: `revealMap(map, layout, 'layout' | 'icons' | 'secrets' | 'full')`;
    items that lift the Lost Map curse: `setLostMap(map, false)`.
12. **Saving**: the layout and minimap state are plain JSON. Recommended: store the whole `FloorLayout` (≈ 3–5 KB) plus
    the minimap state and per-room runtime state (cleared, opened secret walls, pickups left) in `stormdrain.run`,
    so generator or template-content updates never reshuffle a floor mid-run. Regenerating from
    `(seed, floor, track, opts)` also works while `layout.version === FLOORGEN_VERSION` and the template set is
    unchanged. `loadMinimap(json, layout)` sanitizes saved minimap data.

## Debugging

`floorToAscii(layout)` prints the map (`S` start, `.` normal, `B` boss, `T` treasure, `$` shop, `M` miniboss,
`C` challenge, `X` cursed, `?` secret, `!` deep secret, `n` nook reserve; `- |` doors, `# H` locked doors,
`~ :` secret walls; a lower-case letter or `/` marks the hidden-route grate). Seed 2024, floor 3, main:

```
  .-B n
  |
!~.
  |
  .
  |
  .
  |
  .
  |
T#S-.
: |
?~$
```
