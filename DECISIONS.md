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

## Architecture
- **Simulation is headless** (`src/sim` has no DOM), so the stress test and the play-bot run in Vitest at full speed.
- **Beams are traced by a virtual projectile** running the same motion modifiers as real projectiles — this is what
  makes every modifier work with the Storm Lance/lasers without special cases.
- **Content auto-discovery via `import.meta.glob`** so content can be added in parallel without merge conflicts.
