# Decisions Log

Choices made without asking (the owner is away during the build). Newest at the bottom of each section.

## Project
- **Name: STORMDRAIN.** Original setting: a kid in a yellow raincoat descends into storm drains during an endless storm.
- **Toolchain:** Vite 8, TypeScript 7 (native compiler), Vitest 5, Playwright 1.63 — latest at build time. No runtime deps.
- **Base path `./`** instead of `/<repo>/` so GitHub Pages works whatever the repository is named.
- **Git identity:** repo-local `user.name`/`user.email` set to the owner so commits are attributed correctly.

## Display & controls
- **Internal resolution 384×192 (2:1).** iPhone 15 landscape safe area is ≈734×372 pt (Dynamic Island and home
  indicator insets), aspect ≈1.97, so 2:1 fills it with minimal letterbox at ≈1.9× scale. Nearest-neighbor
  scaling on a DPR-sized canvas (not CSS `image-rendering`) for consistent crisp pixels in WebKit.
- **Whole canvas lives inside the safe area**, so the HUD can never be clipped by the Dynamic Island.
- **Menus are drawn in the canvas** (consistent pixel look) using our own hit-tested widgets on pointer-up;
  only text entry (seed, save import/export) uses a DOM modal because iOS needs a real input for the keyboard.
- **Single-size rooms (13×7 tiles)** — no large/L-shaped rooms; keeps generation, camera and templates simple.
- **Display scale:** a whole-number device-pixel scale is used when it costs ≤ 10 % of the image size, otherwise a fractional nearest-neighbour scale (iPhone 15 safe area → ≈5.73 device px per game px, filling it).
- **Move stick:** floating, 24 px radius, 14 % deadzone, full output at 85 % of the radius (so top speed doesn't need the thumb pinned on the rim), origin follows the thumb past the rim (never "runs out"), 7° axis magnet so straight walking is easy.
- **Shoot stick:** commits after 3 px of travel; 4-way snap with ~11° hysteresis so diagonals don't flicker; keeps its last direction while held near the centre. A tap shorter than one tick still fires once.
- **Touch HUD layout:** pause top-right, placeholder minimap left of it, active + bomb stacked down the right edge, consumable on the left margin; base size 24 game px (≈46 pt), scaled by Settings (75–150 %).
- **Perf overlay on phones:** three-finger tap (no Backquote key on iOS).
- **Portrait pauses the run:** rotating to portrait shows the rotate card and opens the pause overlay, so returning to landscape never drops you straight into action. While portrait, pointer-downs and menu keys are ignored (the hidden pause menu must not be pressable through the card).
- **Stick hints:** faint MOVE/SHOOT rings at the resting spots on touch devices until the sticks are first used; keyboard players get a one-line hint instead.

## Architecture
- **Simulation is headless** (`src/sim` has no DOM), so the stress test and the play-bot run in Vitest at full speed.
- **Beams are traced by a virtual projectile** running the same motion modifiers as real projectiles — this is what
  makes every modifier work with the Storm Lance/lasers without special cases.
- **Content auto-discovery via `import.meta.glob`** so content can be added in parallel without merge conflicts.
- **RNG:** sfc32 core with splitmix32 seeding; `fork(label)` derives a child from (state, label) without advancing the parent, so adding a fork never shifts existing sequences.
- **Pools are dense arrays** (live items first, free tail = free list); releasing swaps with the last live item, so iterate backwards when releasing inside a loop.
- **Events are consumed per step:** `sim.step()` first discards what the previous step left (already drained); events emitted between ticks (debug hooks) survive into the next drain. The run scene drains after every tick into particles/shake (render) and sounds (audio).
- **Scenes never import each other**; navigation goes through `App.nav` built in `main.ts` (no circular imports).
- **Test room** lives in `src/content/testRoom.ts` (outside `content/rooms/`) with test-only markers `@` (start) and `D` (dummy).
- **`CharacterDef` starts minimal** (id, name, desc, stats, redMax, sprite); `content/characters/wren.ts` already does `export default [WREN]` for the Phase 2 registry.
- **Settings are in-memory in Phase 1**; they will persist inside the Phase 4 `stormdrain.meta` envelope instead of creating a legacy key now.
- **`saveRunNow()`** stub lives in `src/meta/save.ts` and is already called on pause and on background (visibilitychange / pagehide / blur).

## Feel & presentation
- **Movement:** 96 px/s top speed, constant-rate vector approach (1200 px/s² accel → top speed in 0.08 s / 5 ticks, 960 decel → stops in 0.1 s with a ≈4 px slide, 1.75× boost when reversing). Chosen over exponential smoothing for crisp starts and stops. (Verification retune: the first pass reached top speed in 0.064 s, a touch twitchy for analog thumbs; the target window is 0.08–0.12 s to start and ≈0.1 s to stop, enforced by a unit test.)
- **Collision:** circle vs the closest point of each blocking tile — slides smoothly along walls and rounds rock corners. Pits are inset 3.5 px (you can stand on the lip), rocks 1 px.
- **Marbles have height:** they fly at eye height (z = 7), collide at their ground position (the shadow), then drop with gravity after their range and splash. Tile hits use 70 % of the radius so shots graze past rock corners.
- **Fire cadence:** the cooldown carries its fractional remainder (3/s is exactly every 20 ticks) and never banks shots while idle; a press fires on the same tick.
- **Shot juice:** alternating left/right eye offset (±2 px), 25 % of player velocity inherited, 1 px recoil, muzzle sparkle, splash ring + droplets, dummy flash + spring nudge + health bar, pop burst + shake.
- **Splash at the marble's height:** the `splash` event carries the marble's height (`b`), so wall/target splashes burst where the marble visibly was (eye height) with a 1-frame white-hot flash, and droplets rain down to the floor ring.
- **Marble halo:** additive glow (radius 7, red-heavy `255,158,56`, peak 0.8). Weaker/yellower halos added up to grey on the blue stone instead of reading as warm light.
- **Marble colour:** warm candle-gold/amber so it pops against blue-grey stone and stays distinct from Wren's lemon-yellow coat.
- **Training dummies regrow** 2.4 s after popping (the stake stays behind) so the test room never runs out of targets. Phase 1 has no game over: after the death animation a fresh room starts.
- **Render interpolation:** player and marbles are drawn between the last two ticks by the loop's alpha, so 120/144 Hz displays stay smooth with a 60 Hz sim.
- **Font:** original 5 px variable-width pixel font, uppercase only (lowercase input renders as uppercase). `W` uses a pointed bottom (`.#.#.`) — the first design read as `H`. Baked multi-line text is centred per line.
- **Frozen scenes render at alpha 1:** scenes under an overlay (the run under pause) draw their latest tick instead of interpolating, so nothing shimmers on >60 Hz screens while paused.

## Audio
- **Unlock listeners stay installed** (pointerdown, pointerup, touchend, keydown, click) so an iOS "interrupted" context resumes on the next tap; sounds requested within 300 ms of an unlocking gesture are scheduled so the first menu click is audible.
- **Silent switch respected:** `navigator.audioSession` is left at its default, so the iPhone ringer switch mutes the game like other casual games.
- **Voice cap 20, per-sound minimum gaps** (e.g. shoot 30 ms) and ±5–12 % pitch jitter; gentle stereo pan by room x.

## Tooling
- **playwright.config:** `screen` moved under `contextOptions` — it is not a test-fixture option in Playwright 1.63 and broke `tsc` (and therefore `npm run build`).
