# Special synergies — content guide

The player-facing list is [SYNERGIES.md](../SYNERGIES.md) (every synergy, its requirements by item name and what
it does). This page is for whoever adds or tunes one.

## Where things live

| What | Where |
|---|---|
| Synergy data (`export default SynergyDef[]`, auto-discovered) | `src/content/synergies/*.ts` — `storm.ts` (the Storm Lance), `carriers.ts` (lasers, blades, swings, orbits), `elements.ts` (frost / fire / blasts / helpers), `sets.ts` (set tags meeting), `trinkets.ts`, `actives.ts`, `oddities.ts` |
| The `syn.*` hooks | `src/content/hooks/synergies.ts` |
| Data builders (`when`, `hook`, `mod`, `stat`, `familiar`, `DEBUT`) | `src/content/hooks/synergiesKit.ts` (the synergies folder may only hold `SynergyDef[]` modules) |
| Tests | `tests/content-synergies.test.ts` (catalogue, activation, effects + style, docs), `tests/content-synergies-hooks.test.ts` (each hook + end-to-end flourishes), `tests/content-synergies-stress.test.ts` (5 s at 2 stacks per synergy, and all at once) |

## Adding one

```ts
{
  id: 'frost-nova',
  name: 'Frost Nova',
  requires: ['ice-cube-tray', 'party-popper'],          // 2-3 items, or items + { tag, count }
  effects: [
    mod('freeze'),                                       // persistent while it holds (source = the synergy id)
    when('kill', hook('syn.ring', { needs: 'freeze', n: 10, style: 'ice', look: 'frost' })),
  ],
  style: { color: '#bff0ff', shape: 'shard', trail: 'ice', glow: 2 },
  hook: DEBUT,                                           // the first-activation ring (every synergy uses it)
}
```

House rules (the tests enforce them):
- **Original, unique name** (also unique against items, enemies, bosses, sets, familiars), pixel-font characters only,
  and `SYNERGY: NAME` must fit the pill (≤ 220 px).
- **Requirements:** 2-3 of them; real, obtainable items (in a pool; never consumables); at most one trinket (a second
  needs Hand-Me-Down Pockets); tag counts that enough distinct passives / trinkets can meet; no two synergies with the
  same requirement set. Tag counts count DISTINCT items and include items named elsewhere in the list.
- **A look of its own:** a `style.color` no other synergy uses, and a distinct colour / shape / trail / tether
  signature. Colour alone is not enough: add a shape, trail, glow, tether or a hook.
- **Timed boosts from triggers** (`stat` / `mod` / … inside a `when`) need a `duration` (≤ 10 s) and the trigger a
  `cooldown` — frequent triggers (kills, volleys, room clears in an absurd arena) would otherwise pile up temps and
  recompute every tick (Wind-Up Army once did: 395 temps in 8 s).
- **Hook params** are checked: sounds must exist, `look` is a nova flavour (`shock`, `ember`, `frost`, `spore`,
  `charm`, `ink`, `gold`, `water`) or `#rrggbb`, styles are `ENEMY_SHOT_STYLES`, statuses `STATUS_KINDS`.
- **List it in SYNERGIES.md** (a `| **Name** | requirements by item name | what it does |` row).

## How the hooks behave

- They run from the synergy's triggers only (`fire` = each player volley — the Storm Lance fires once per
  release; `kill` at the fallen foe; `hurt`, `use`, `bomb`, `pickup`, `roomClear`, `floorStart`). Nothing runs per
  tick, and the sim is untouched: hooks work through the World's pools and `Hittable.hurt / applyStatus`.
- `needs: '<status>'` on a kill hook looks the fallen foe up (it is still in the pool, flagged dead, at the trigger
  position) and runs only if it had that status. Training dummies clear their statuses when they pop, so `needs`
  hooks never fire on dummies.
- Damage is `dmg` × the player's damage stat (the flourish keeps up with the build), credited to the player
  (`SRC_BOMB`), so hook kills fire kill triggers again — nesting stops at 3 (`MAX_TRIGGER_DEPTH`), and every
  nesting level has its own scratch (a bolt that kills can't scramble the list its hook is walking).
- Guardrails: chain arcs share the pipeline's 32-per-tick budget; allied shots stop 80 slots short of the enemy-shot
  cap and once the pool holds 200 shots; puddles merge into allied puddles already there (≤ 48, the oldest recycled);
  blasts go through the attack pipeline's explosion queue (merged, ≤ 6 per tick, never hurt the player).
- Allied puddles restyled by a hook (`ember` oil, `muck` bog, `dust`, `ice`) are drawn in that style with a pink rim
  (friendly) and give off a wisp of their element; plain water puddles stay the friendly pink.

## Engine touch points added for synergies (generic)

- `StyleOverride.tether` / `ShotStyle.tether`: a crackling line from each thrown projectile back to its thrower
  (render/attackRenderer.ts `drawTethers`, ≤ 24 a frame; split children and orbit blades excluded).
- 'nova' event flavours (render/worldFx.ts `novaColors`): named palettes and any `#rrggbb` colour.
- Allied elemental creep look (render/enemyRenderer.ts `puddleSprite(style, r, friendly)`) + its particles (worldFx).
