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

| Module | What it gives you |
|---|---|
| `src/meta/storage.ts` | `createStorage()` (localStorage, or an in-memory fallback with `persistent = false`), `MemoryStorage` (tests), `SaveSlot` (envelope + checksum + migrations + `.bak`), `requestPersistentStorage()` |
| `src/meta/saveCodec.ts` | `{ v, data, sum }` envelope, FNV-1a checksum, base64url/UTF-8, `checkJsonSafe()` |
| `src/meta/migrations.ts` | `migrate()`, `META_VERSION` / `META_MIGRATIONS`, `RUN_VERSION` / `RUN_MIGRATIONS` |
| `src/meta/metaState.ts` | `MetaState` schema v1 + defaults, `normalizeMeta` / `serializeMeta`, **`MetaStore`**, settings adapters, `utcDateKey()` |
| `src/meta/runSave.ts` | **`RunSaveStore`**: `save / load / clear / hasRun / peek / restore` on `stormdrain.run` |
| `src/meta/exportCode.ts` | `exportCode()` / `importCode()` (`SD1:` codes), `IMPORT_MESSAGES`, `summarizeMeta()` |
| `src/pwa/register.ts` | `registerServiceWorker()` (production only, quiet updates) |
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
registerServiceWorker({ onUpdate: () => { /* optional: title shows "Updated — restart to play the new version" */ } });
void requestPersistentStorage();                 // best effort
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
- on **pause** and on **background** (`visibilitychange` hidden / `pagehide` / `blur`) — already wired;
- before navigating from the run to the title.

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
  never reloads the page, and checks for updates when the app returns to the foreground (≥ 1 h
  apart). The next launch runs the new version.
- Icons: edit the maps in `scripts/gen-icons.mjs`, run `npm run icons`, commit the PNGs. A test
  fails if the committed PNGs don't match the art (stale icons).
- Dev server: no service worker (registration is production-only), so HMR is unaffected.
