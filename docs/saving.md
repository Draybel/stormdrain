# Saving, export codes & PWA — integration guide

Everything here is implemented and unit-tested as standalone modules; `main.ts`, the scenes and
`src/meta/save.ts` (owned by the main track) only need to call them. Nothing in `src/sim` is
involved: the sim hands the run scene a plain JSON snapshot and the meta layer stores it.

**Status — wired in Phase 4A** (ARCHITECTURE §7, §7a). `src/meta/save.ts` `GameSave` is the one place that
does what sections 1-4 below describe: it builds the storage, `MetaStore`, `RunSaveStore` (version =
`RUN_SNAPSHOT_VERSION` from `src/sim/run/types.ts`, migrations `RUN_SNAPSHOT_MIGRATIONS`), the
`AchievementEngine` and the `MetaTracker` (which makes every "what the game reports" call in section 3 from
the run's GameEvents). main.ts installs it (`installGameSave`), persists settings through it, calls
`save.endTick()` every loop tick, shows its notices as toasts, registers the service worker and asks for
persistent storage. The run scene is its save host (`savableSim()`), saves at run start / every room entry,
clears the save on death / victory; the title's Continue calls `nav.continueRun()` (`save.loadRun()` →
`Sim.fromSnapshot`).

**Phase 4B** added the UI for the rest: Settings → EXPORT SAVE / IMPORT SAVE (DOM modals, `src/ui/modals.ts`, through
`GameSave.exportCode()` / `checkImport()` / `applyImport()` — section 5 below), the "can't keep saves" line on the Settings
page, and the daily run (title → DAILY RUN: the date's seed code; the tracker claims the day's one scored attempt when it
starts — `recordDaily(..., done: false)` — and finishes it with `updateDaily`; ARCHITECTURE §7a).

**Phase 3-4 verification** (checked in real WebKit: background mid-room → reload → Continue, damaged / newer / v0 saves):
a meta save that starts fresh after damage (`corrupt`) or loads from an older version is written back at the end of the
first tick, so the "damaged" toast never repeats and the old text becomes the `.bak`; a run save whose every copy is
damaged (`runs.hasRun()` false while `runs.slot.exists()`) is dropped at boot by `GameSave.dropDamagedRun()` — its text
kept as `stormdrain.run.corrupt` — and main.ts toasts "SAVED RUN LOST" instead of silently losing Continue.

**Polish batch 3 (mobile UX, saving and PWA)** — no progress may be lost:
- **Room-clear checkpoints.** The run save is no longer only the room-entry checkpoint: when a room becomes CLEARED
  (`Run.onWaveCleared`, after the boss reward / challenge reward / trapdoor / nook) the run saves that room
  (`saveRoom`) and checkpoints again, keeping `entrySide`; the run scene writes it at once on the 'roomClear' event.
  Pause, background (visibilitychange / pagehide / blur) and quit-to-title call `saveRunNow()` with `refresh`:
  in a SETTLED cleared room (no wave running or due, no boss dying, no teleport pending) the checkpoint is re-taken
  first (`Sim.refreshCheckpoint()`), so items picked up, bought or opened after the clear survive. A restore walks
  her in through the door she came by, into the room as it stood. Mid-fight nothing changes: Continue replays the
  room entry (no mid-fight save-scumming). A checkpoint inside the start room never seals its hidden-route grate
  (only leaving the room does).
- **Crash guard.** `Loop` passes an exception from `update` / `render` to its `error` hook instead of freezing;
  main.ts marks the run scene `crashed` (its `savableSim()` is null from then on, so the stored save stays the last
  good checkpoint), closes a DOM modal, returns to the title and toasts "SOMETHING WENT WRONG · YOUR RUN WAS SAVED AT
  THE LAST ROOM". Three crashes within 5 s stop the loop with a plain page.
- **Safari tabs** (`src/pwa/platform.ts` `isIosSafariTab`: iOS / iPadOS WebKit, touch, `navigator.standalone ===
  false`, no standalone display mode): the title's bottom line says "ADD TO HOME SCREEN TO KEEP YOUR SAVES · SHARE >
  ADD TO HOME SCREEN" and, once there is progress, EXPORT SAVE sits in its bottom-left corner. Settings' status line
  says "SAVED IN SAFARI · MAY BE CLEARED" unless `requestPersistentStorage()` was granted ("· PROTECTED"). The
  home-screen app's first launch (no meta save at all) offers IMPORT SAVE there instead, once (remembered as the meta
  unlock `hints:importPrompt`).
- **Updates in one tap.** `registerServiceWorker({ onUpdate })` sets `app.pwa.updateReady`: mid-run a toast
  "UPDATE READY · RELOAD FROM THE TITLE"; on the title the line "NEW VERSION READY · TAP RELOAD" and a RELOAD button
  that calls `saveRunNow()` and then `location.reload()` (the run stays for Continue). Nothing reloads mid-run.
- **Several tabs.** Every meta write first merges what another tab saved meanwhile (`MetaStore` → `mergeMeta`, a
  three-way merge against the state this tab last read / wrote), and the window 'storage' event on `stormdrain.meta`
  merges another tab's save into memory at once (`GameSave.syncMetaFromStorage`). See section 8.
- **The import modal on an iPhone**: no auto-focus (the keyboard would hide its buttons), its buttons above the field,
  a PASTE button (`navigator.clipboard.readText()` inside the tap, then the code is checked at once; refused → paste by
  hand), a backdrop tap with text in the field only dismisses the keyboard, the panel follows the visual viewport and
  portrait.

| Module | What it gives you |
|---|---|
| `src/meta/storage.ts` | `createStorage()` (localStorage, or an in-memory fallback with `persistent = false`), `MemoryStorage` (tests), `SaveSlot` (envelope + checksum + migrations + `.bak`), `requestPersistentStorage()` |
| `src/meta/saveCodec.ts` | `{ v, data, sum }` envelope, FNV-1a checksum, base64url/UTF-8, `checkJsonSafe()` |
| `src/meta/migrations.ts` | `migrate()`, `META_VERSION` / `META_MIGRATIONS`, `RUN_VERSION` / `RUN_MIGRATIONS` |
| `src/meta/metaState.ts` | `MetaState` schema v1 + defaults, `normalizeMeta` / `serializeMeta`, **`MetaStore`**, settings adapters, `utcDateKey()` |
| `src/meta/runSave.ts` | **`RunSaveStore`**: `save / load / clear / hasRun / peek / restore` on `stormdrain.run` |
| `src/meta/exportCode.ts` | `exportCode()` / `importCode()` (`SD1:` codes), `IMPORT_MESSAGES`, `summarizeMeta()` |
| `src/pwa/register.ts` | `registerServiceWorker()` (production only, quiet updates) |
| `src/pwa/platform.ts` | `isIosSafariTab()` / `isStandalone()` / `platformInfo()` over a stubbable env, `readPlatform()`, `PwaState` (`app.pwa`) |
| `scripts/sw-plugin.mjs` | Vite plugin: writes `dist/sw.js` after every production build (already in `vite.config.ts`) |
| `scripts/gen-icons.mjs` | `npm run icons`: regenerates `public/icons/*.png` from the pixel-art map |

## 1. Boot (`main.ts`)

```ts
import { createStorage, requestPersistentStorage } from './meta/storage';
import { MetaStore, toRuntimeSettings, fromRuntimeSettings } from './meta/metaState';
import { RunSaveStore } from './meta/runSave';
import { registerServiceWorker } from './pwa/register';

const storage = createStorage();                 // never throws; memory fallback in private/blocked mode
const meta = new MetaStore({ storage });         // loads + migrates stormdrain.meta (never throws)
const runs = new RunSaveStore({ storage });      // stormdrain.run

// Settings: MetaState owns the persisted values; the existing SettingsStore stays the runtime bus.
const settings = new SettingsStore({ ...defaultSettings(), ...toRuntimeSettings(meta.settings) });
settings.subscribe((s) => meta.updateSettings(fromRuntimeSettings(s)));   // no-op when unchanged
// showFps / leftHanded exist only in MetaSettings: read meta.settings / meta.updateSettings({...}).

// After boot (never blocks startup; no-op in dev and on http://LAN-IP):
registerServiceWorker({ onUpdate });             // polish batch 3: app.pwa.updateReady → the title's RELOAD
void requestPersistentStorage().then((ok) => (pwa.persisted = ok));   // best effort; Settings shows it in a Safari tab
```

Show a one-time notice from `meta.loaded.status` (and `meta.loaded.error`):

| status | meaning | suggested text |
|---|---|---|
| `ok` / `empty` | normal | — |
| `restored` | main save damaged, previous save (`.bak`) loaded | "Your save was damaged; restored the previous copy." |
| `corrupt` | both unreadable; defaults in use; damaged text kept under `stormdrain.meta.corrupt` | "Save data was damaged and could not be restored." |
| `future` | written by a newer build (e.g. an old cached version is running) | "This save is from a newer version. Progress will not be saved until the game updates." (the store is read-only, nothing is overwritten) |

If `storage.persistent === false` (or `!meta.persistent`), the Settings panel should say that
progress can't be saved on this device/browser mode.

## 2. Every loop tick

Call `meta.endTick()` once at the end of `Loop.update` (after `scenes.update` / the sim step, also
while portrait-paused; it is cheap when nothing changed). It:
1. notifies `meta.subscribe(...)` listeners once with a `MetaChange` summary
   (`settings`, `unlocked: ['characters:pip', ...]`, `achievements: [...]`, `other`);
2. saves: **urgent** changes (settings, unlocks, achievements, run start/end, daily, import, reset)
   at the end of that tick; **soft** changes (kills, collection/bestiary counts, stats, counters,
   play time) at most every 5 s (`softSaveMs`). Failed writes retry after 10 s, never spam storage.

```ts
meta.subscribe((state, change) => {
  for (const id of change.achievements) toasts.achievement(id);  // copy what you keep: `change` is reused
  if (change.settings) { /* re-layout buttons, apply showFps... */ }
});
```

## 3. What the game reports (mutators)

| When | Call |
|---|---|
| run starts | `meta.recordRunStart(characterId)` |
| item shown on a pedestal/shop/banner | `meta.seeItem(itemId)` |
| item picked up | `meta.collectItem(itemId)` (also +1 `stats.itemsCollected`) |
| enemy/boss first on screen | `meta.seeEnemy(id)` |
| enemy/boss dies | `meta.killEnemy(id, isBoss)` (also +1 `kills` / `bossKills`) |
| floor cleared | `meta.addStat('floorsCleared')`; `meta.bump(tookDamage ? 'damageTakenFloors' : 'noDamageFloors')` |
| per-tick play time | `meta.addPlayTime(dt)` (only while a run is actually playing) |
| counters for achievements | `meta.bump('activesUsed' \| 'bombsUsed' \| 'coinsSpent' \| ...)`, any new id works |
| record values | `meta.maxCounter('maxCoinsHeld', coins)`, `meta.maxCounter('maxFamiliars', n)`, `meta.maxStat('bestFloor', floor)` |
| unlocks | `meta.unlock('characters' \| 'items' \| 'routes' \| 'endings' \| 'challenges', id)` → `true` if new |
| achievement earned | `meta.unlockAchievement(id)` → `true` if new (timestamped) |
| run over | `meta.recordRunEnd({ character, outcome: 'win' \| 'death' \| 'quit', floor })` (streaks, per-character wins, best floor) |
| daily run over | `meta.recordDaily(utcDateKey(startMs), { seed, character, won, floor, kills, timeSec, score })` → `false` if that date already has a result |

Queries: `isUnlocked(kind, id)`, `hasAchievement(id)`, `isDiscovered(itemId)`, `counter(id)`,
`hasDaily(utcDateKey(Date.now()))` (disable the Daily button), `state` for UI pages.
`resetProgress()` wipes everything except settings. If code edits `meta.state` directly, call
`meta.markDirty(urgent)`.

Achievement *definitions* (`src/content/achievements/*.ts`) should evaluate against `meta.state`
(stats, counters, bestiary, collection) and call `unlockAchievement` + `unlock(...)` for rewards.

## 4. The run save (`src/meta/save.ts` → `RunSaveStore`)

The main track owns the snapshot type (e.g. `sim.snapshot(): RunSnapshot` / `Sim.fromSnapshot`).
It must be plain JSON: numbers finite, no Map/Set/class instances/typed arrays (convert RNG state
to number arrays, sets to arrays). `save()` checks this and returns `{ ok: false, error: 'unsafe',
path: '$.player.pos[1]', message }` instead of writing a broken save.

```ts
// src/meta/save.ts (suggested)
export function saveRunNow(): void {
  const sim = currentRunSim();              // null on title/menus
  if (sim) {
    const r = runs.save(sim.snapshot());
    if (!r.ok) console.warn('run save failed', r.error, r.path ?? '', r.message);
  }
  meta.flush();                             // meta rides along on every save point
}
```

Call `saveRunNow()`:
- on every **room transition** (after the new room is set up, so Continue resumes in that room);
- on every **room clear** (polish batch 3: the run has just checkpointed the cleared room — 'roomClear');
- on **pause** and on **background** (`visibilitychange` hidden / `pagehide` / `blur`) — already wired, with
  `{ refresh: true }` (the module-level `saveRunNow()` does that): a settled cleared room is checkpointed again first;
- before navigating from the run to the title (also with the refresh).

What a restore gives back: the room as it was at the checkpoint — at its entry (mid-fight: the fight starts over),
or once cleared as it stood at the clear / the last refresh (trapdoor, rewards, pickups, tonics identified) — with the
player walking in through the door she entered by. A scene that crashed never writes again (main.ts crash guard).

On **run end** (win, death, abandon from pause, New Run over an existing save):
`meta.recordRunEnd(...)`, `runs.clear()` (removes the save *and* its backup), `meta.flush()`.

Title screen: show **Continue** when `runs.hasRun()`. On Continue:

```ts
const r = runs.load<RunSnapshot>();
if (r.ok) startRun(Sim.fromSnapshot(r.data));        // r.restored → toast "Resumed from the previous room"
else if (r.reason === 'corrupt') { toast("Couldn't restore the run."); runs.clear(); }
else if (r.reason === 'future') toast('That run was saved by a newer version.'); // leave it alone
```

Snapshot versions: `new RunSaveStore({ storage, version: 2, migrations: { 1: (v1) => v2 } })`.
Bumping `version` without a migration makes older runs load as `corrupt` (then cleared) — acceptable
for an in-progress run; meta progress is never affected. Keep the options in one place so export
import and the store agree (`runs.slot.migrations`).

Size: a snapshot is limited to 1,000,000 characters (`RUN_MAX_CHARS`); WebKit gives an origin
about 5 MB and we keep up to 2 copies of each key.

## 5. Export / import (Settings → Save data)

Codes look like `SD1:eyJ2IjoxLCJzdW0iOi...` (URL-safe base64 of the checksummed JSON envelope
`{ app, at, meta: { v, data }, run?: { v, data } }`). Whitespace/line breaks are ignored on import.

```ts
// Export (DOM modal with a readonly <textarea> + Copy button → navigator.clipboard.writeText)
const code = exportCode(meta.state, { run: runs.peek() });   // include the run so players can switch devices mid-run

// Import
const r = importCode(text, { runMigrations: runs.slot.migrations });
if (!r.ok) showError(r.message);               // plain-language message per error code (IMPORT_MESSAGES)
else {
  const s = summarizeMeta(r.meta);             // "12 achievements, 45 items, 3 wins, 7 h played — replace your progress?"
  // show r.warnings too (e.g. the run was from an incompatible version and was skipped)
  if (await confirm(...)) {
    meta.replaceState(r.meta);
    meta.flush();
    if (r.run) runs.restore(r.run);            // replaces the local run; no run in the code → local run kept
    settings.update(toRuntimeSettings(meta.settings));
  }
}
```

Error codes: `empty`, `prefix`, `version` (newer game), `encoding`, `damaged` (truncated/edited:
checksum), `shape` (not Stormdrain data), `migration`. Tampering with any character is rejected.

**iPhone note for the README:** a home-screen app and Safari tabs have *separate* storage; export
from one and import into the other to move progress.

## 6. Storage layout & format

| key | content |
|---|---|
| `stormdrain.meta` | `{ "v": 1, "sum": "<fnv1a hex>", "data": MetaDataV1 }` |
| `stormdrain.meta.bak` | the previous good meta save (written just before each new save) |
| `stormdrain.meta.corrupt` | the last unreadable primary, kept for manual recovery |
| `stormdrain.run`, `.bak`, `.corrupt` | same for the run in progress |

- The checksum is FNV-1a (32-bit) over `"<v>:" + JSON.stringify(data)`; it detects damage and
  casual edits (it is not security).
- Loads: verify → migrate step by step (`steps[v]: v → v+1`) → normalize (defaults, clamps, junk
  dropped). A damaged primary falls back to `.bak` and is repaired. Newer versions are never
  overwritten.
- **Unknown fields survive**: unknown top-level keys are kept in `MetaState.extra`; unknown keys in
  `settings`, `stats`, collection/bestiary/daily entries ride along on those objects; unknown
  unlock kinds are kept as sets. Everything is written back on the next save.

### Adding a meta field / bumping the version
- Additive field with a default (most changes): add it to the schema + `defaultMeta()` +
  `normalizeMeta()`; **no version bump** needed (old saves get the default).
- Renames/reshapes: bump `META_VERSION`, add `META_MIGRATIONS.steps[old] = (d) => ({ ...d, ... })`
  (keep unknown fields: spread the input), add a fixture test in `tests/save-meta.test.ts`.
- `v0` is the Phase-1 prototype layout (flat `Settings` fields + flat id lists); it exists so the
  migration path is exercised from day one.

## 7. PWA

- `public/manifest.webmanifest`: standalone (`display_override: ["fullscreen", "standalone"]`),
  landscape, relative `start_url`/`scope` (`./`), icons 192/512/maskable-512 + 180.
- `index.html` links the manifest, favicons and `apple-touch-icon` with absolute public paths;
  Vite rewrites them to `./...` for `base: './'`.
- `npm run build` → `dist/sw.js` (generated by `scripts/sw-plugin.mjs` in `closeBundle`, after all
  files incl. `public/` are written). Its precache list = every file in `dist/` except `sw.js`,
  source maps and dot-files, as **relative** URLs (works under `https://<user>.github.io/<repo>/`);
  its version = hash of all their contents, so *any* change ships an update.
- Worker behaviour: install precaches with `cache: 'reload'`; activate deletes older caches of the
  same scope and claims the page (first visit is offline-ready); navigations get the cached
  `index.html`; other same-origin GETs are cache-first (runtime-fetched files are cached too, until
  the next version). Cache lookups use `ignoreVary` — without it the `crossorigin` module script
  (sent with an `Origin` header) misses entries stored with `Vary: Origin` and the game fails to
  boot offline (verified in headless Chromium against `vite preview`). Keep the app a single bundle
  (no lazy chunks): after an update the old page keeps running on already-loaded code until the
  next launch.
- Updates are quiet: `registerServiceWorker()` sends `SKIP_WAITING` to a freshly installed version,
  never reloads the page by itself, and checks for updates when the app returns to the foreground (≥ 1 h
  apart). The next launch runs the new version — or, polish batch 3, the title's RELOAD button (shown once
  `onUpdate` fired: a new version activated behind an older one) saves and reloads into it right away. On an iPhone
  "restart" would mean force-quitting the home-screen app, which players don't know to do.
- Icons: edit the maps in `scripts/gen-icons.mjs`, run `npm run icons`, commit the PNGs. A test
  fails if the committed PNGs don't match the art (stale icons).
- Dev server: no service worker (registration is production-only), so HMR is unaffected.

## 8. Several tabs / windows (polish batch 3)

Each tab has its own `MetaStore` in memory and used to write its whole state: tab B, loaded earlier, saved its play
time 5 s after tab A earned an achievement and wiped it. Now:
- **Merge on write.** Before each meta write, `MetaStore` reads the stored text (`SaveSlot.readExternal()`: only when it
  differs from what this tab last loaded / wrote — the common case costs one `getItem` and a string compare) and merges
  it with `mergeMeta(base, mine, theirs)`, `base` being what this tab last read / wrote:
  unlocks and achievements = storage's + this tab's additions (an achievement earned in both keeps the earlier date);
  counts (collection / bestiary entries, runs, kills, play time, per-character counts, achievement counters) = storage's
  + this tab's increase since `base` (both tabs' play time adds up, nothing goes down); records (best floor, best win
  streak, `max*` counters) = the higher, when this tab raised its own; the win streak and unknown fields = this tab's
  if it changed them, else storage's; settings per setting = this tab's if it changed it since `base` (the newer
  change), else storage's; daily results by date (the one this tab changed, else storage's; both → the finished /
  higher-scoring one). The stored text becomes the next `.bak` (`SaveSlot.adopt`).
- **'storage' events.** main.ts listens for `storage` on `stormdrain.meta` and calls `GameSave.syncMetaFromStorage()`:
  the other tab's progress is merged into memory at once, listeners get `change.external` (main.ts re-applies merged
  settings; the achievement engine rebuilds its pending lists, so nothing is earned twice). A `storage` event on the
  run key during a live run toasts "THE GAME IS OPEN IN ANOTHER TAB" once (the run save itself is not merged: the last
  tab to save its run wins).
- **Resets and imports replace.** `resetProgress()` / `replaceState()` (debug reset, import) mark the next write as a
  replacement: it is never merged, and a stale tab's next write only adds what IT did since (three-way), so it can't
  bring the old progress back. A newer version's save written by another tab turns this tab's slot read-only, as at load.
