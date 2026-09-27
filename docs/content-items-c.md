# Item-C content: actives, trinkets, consumables (Mystery Tonics + stickers)

This is the integration guide for the item-C content pack. Totals with the starter kit: 28 actives,
34 trinkets, 23 consumables.

| File | What |
|---|---|
| `src/content/items/actives.ts` | 26 actives: charge bars of 1-6 rooms or 8-30 s (timed) |
| `src/content/items/trinkets.ts` | 32 trinkets: small stats, player flags, trigger chances (luck helps) |
| `src/content/items/consumables-tonics.ts` | 10 Mystery Tonic bottles (`TONIC_BOTTLES`, default export) + 10 effects (`TONICS`) |
| `src/content/items/consumables-stickers.ts` | 11 stickers (single-use cards) |
| `src/content/familiars/toySoldiers.ts` | the Tin Soldier familiar (Tin Soldier Tin active) |
| `src/content/hooks/itemsC.ts` | the `itemsC.*` hooks, plus the `ITEMS_C_TOOLS` service slot |
| `src/content/sprites/itemsC*.ts` | icons (14×14), the Tin Soldier, costumes (Storm Kite, Stormglass cloud, Bomb Parasol, snowfall) |
| `src/sim/tonics.ts` | tonic run state, drinking, run-specific names, the hook services, `FLOOR_LINKS` |
| `tests/content-items-c*.test.ts` | defs, every active used in a room, every trinket, tonics, stickers, HUD banner |

## Small edits outside the pack

- `src/sim/types.ts`: `PLAYER_FLAGS` gained `confused` (movement mirrored) and `readLabels` (tonic labels
  readable); `ItemDef.consumable?: ConsumableKind` (`'tonic' | 'sticker'`); `TonicDef`.
- `src/sim/effects.ts` `useConsumable`: after the bottle's own `use`, `drinkTonic(w, def)` returns the effect
  list the bottle's colour holds this run (null for anything else) and it is executed too.
- `src/sim/player.ts` `movePlayer`: `if (p.flags.confused)` the move input is mirrored (Dizzy Tonic).
- `src/render/hud.ts`: the banner resolves names through `itemName` / `itemDesc` (unidentified tonics read
  `??? CRIMSON TONIC`), also shows on consumable use (`activeUse`, a = 1 — a drunk tonic reveals itself),
  and an unidentified tonic in the consumable button gets a gold `?` badge.

## Mystery Tonics (`src/sim/tonics.ts`)

- Ten bottle items (`tonic-crimson`, `-amber`, `-lemon`, `-moss`, `-teal`, `-cobalt`, `-violet`, `-rose`, `-murk`,
  `-pearl`; three glass shapes, ten liquid colours) and ten effects: Mending (heal 2 hearts), Warm Milk (full
  heal), Fizzbang (+3 bombs), Zippy (speed + shot speed, room), Grit (damage ×1.4, room), Sour (−½ heart, never
  the last one), Dizzy (`confused` 6 s), Clover (+1 luck for keeps), Tin (+1 Tin heart), Storm in a Bottle
  (lightning on every foe).
- **Run state** `w.tonics: TonicState` = `{ v: 1, map: { bottleId: tonicId }, known: bottleId[] }` — plain JSON.
  It is declared on `World` by module augmentation in `sim/tonics.ts` (no edit to `world.ts`).
  - **Run setup: call `initTonics(world, runSeed)`** so the deal depends on the seed alone. Without it the sim
    deals on first need (a drink, a Cracked Monocle pickup) from `lootRng.fork('tonics')` — still seeded.
  - **Saving:** `snapshotTonics(w)` (a copy, or `null` before the deal) → store it in the run save;
    `restoreTonics(w, data)` on load (repairs damaged maps into a bijection, returns false for garbage).
  - Render / UI must only use the non-creating queries: `itemName(w, id)`, `itemDesc(w, id)`,
    `isIdentified`, `isUnidentifiedTonic`, `tonicOf`. `tonicState(w)` creates the state — sim only.
- Use `itemName` / `itemDesc` anywhere an item is named during a run (pause menu item list, shop labels…):
  they return the plain name for everything but unidentified tonics.

## Hooks and services

Content hooks may not import sim modules, so `sim/tonics.ts` installs `ITEMS_C_TOOLS.t` (spawnBomb, pedestal
reroll, pickup copy, charge, refund, status/hurt with the right sources, free-floor search, floor links) when it
loads — it is imported by `sim/effects.ts`, the only place hooks run from.

Hooks (`content/hooks/itemsC.ts`): `itemsC.fx` (sound / nova / blink / splash / say flourish), `blast`,
`lightning`, `statusAll` (every foe or within `radius`), `gust` (push, or `pull: 1`), `shield` (i-frames),
`bombRain`, `reroll`, `copyPickup`, `buyHeal`, `wish`, `luck`, `teleport`, `revealMap`, `rain`, `charge`,
`sour`, `glug`, `readLabels`. A use with nothing to do (no pedestal to reroll, no pickup to copy, no coins, no
floor) says NOPE (`denied`, id `nothing`) and refunds: an active gets its charge back, a sticker goes back in
the slot.

## Floor wiring (`FLOOR_LINKS` in `sim/tonics.ts`)

Set these when floors are wired (both return true when something happened):
- `FLOOR_LINKS.revealMap = (w, level) => …` — Treasure Map Sticker (`level` = `'full'`; the minimap model's
  `revealMap(level)` levels).
- `FLOOR_LINKS.teleport = (w, to) => …` — Hopscotch Chalk (`'random'`: a random room) and the Keepsake
  Sticker (`'treasure'`). Queue the room change for the end of the tick; don't load a room mid-update.

Until then the map / Keepsake stickers refund themselves and Hopscotch Chalk blinks to open floor in the room.

## Sets

No `set` fields were assigned (the set files belong to other packs and `validateContent` rejects unknown
sets). Items carry DESIGN.md set tags instead (stormcaller, mothkin, clockwork, sporeling, waxen, toybox,
ossuary, tidewalker, glimmer) so set owners can pick members: e.g. stormcaller — Storm Kite, Stormglass,
Static Balloon, Weather Vane, Rumble Drum, Static Sock; clockwork — Frozen Pocketwatch, Crank Radio, Spare
Battery, Wind-Up Key, Spark Sticker; toybox — Tin Soldier Tin, Jack-in-the-Box, Friendship Bracelet,
Hopscotch Chalk, Roller Skate, Rubber Duck, Tin Soldier's Medal, Knucklebone, Rusty Thimble.
