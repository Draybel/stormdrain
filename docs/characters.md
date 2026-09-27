# Characters, mechanics and achievements

How the eight characters, their mechanics and the achievement / unlock chain fit together (ARCHITECTURE §3 "Character
mechanics", §5, §7a). Everything here is original.

## The roster

| # | Character | Look | Hearts | Starts with | Mechanic | Unlock |
|---|---|---|---|---|---|---|
| 1 | **Wren** | yellow raincoat | 3 red | 1 bomb | LUCKY MARBLE: the first shot in each uncleared room is a big piercing keeper marble (×3) | always |
| 2 | **Pip** | tiny mole, miner's helmet | 4 red | Rusty Trowel, 2 bombs | BURROW: the DASH button / Shift ducks underground for 0.4 s — fast, untouchable, no firing; 1.5 s cooldown | UNDER THE ROOTS: defeat chapter 2's boss |
| 3 | **Marrow** | little skeleton, red scarf | 3 Tin | 1 bomb, 1 key | BONE TOSS: boomerang carrier; no red hearts — red pickups, heals and containers become Tin | SOAKED THROUGH: die 10 times |
| 4 | **Juniper** | moss cloak, firefly jar | 3 red | 1 bomb | FIREFLY JAR: 2 fireflies (orbiting shooters); +1 per room cleared (max 6); a hit scares one off; a new floor settles the jar | LITTLE PARADE: 3 familiars at once |
| 5 | **Bolt** | tin robot, wind-up key | 2 red + 1 Tin | Jar of Lightning, 1 bomb, 1 key | WIND-UP: charge rider (hold to charge every shot); the active winds up over time (a charge / 12 s; timed ×1.5) | WOUND UP: use actives 50 times |
| 6 | **Sable** | masked fox thief | 3 red | 5 coins, 1 bomb, 1 key | PICKPOCKET: melee carrier; hits may knock coins loose (1 per enemy, 3 from big ones); 25 % off prices | DEEP POCKETS: hold 60 coins — or SMASH AND GRAB: blast Magpie's jar / a gambler open |
| 7 | **Mosswick** | swamp sprite, lily-pad hat | 2 red + 1 Tin | 1 bomb | BOG BLOOD: puddle modifier (short range, puddles land close); stand in your puddles to soak up Tin (½ per 2.5 s, up to 3) | CLEAR SKIES: defeat Old Thunderhead |
| 8 | **Drizzle** (secret) | a little raincloud | 2 red + 1 Tin | 1 bomb | RAINMAKER: floats; every hit taken bursts a cloud that soaks and slows every foe in the room | WHAT THE RAIN KEPT (hidden): Ending 3 |

Stats are tuned so each plays differently: Pip slow and sturdy with big shots, Marrow fragile but self-sustaining on Tin,
Juniper weak alone but strong with a full jar, Bolt slow charged shots and an active every fight, Sable fast and close with
a fat purse, Mosswick short-ranged and tanky if she stands her ground, Drizzle a floaty glass cannon that turns hits into
breathing room.

## Adding a character

1. Art: `content/sprites/characters.ts` → `characterSprite({ id, palette, down, blink, hurt, up, side, feet, slump, heap })`
   builds the 14×16 sprite in Wren's 12-frame layout (`WREN_FRAME`). Bodies are 14 rows, feet 2 rows per walk pose, death
   frames 16 rows. 1 px outline (`OUTLINE`), light from the upper left, a distinct palette and silhouette (a test checks).
2. Data: a file in `src/content/characters/` exporting `CharacterDef[]`: stats, hearts (half hearts), `startItems`,
   `startPickups`, `shotColor`, `mechanic` (a hook id), `mechanicDesc` (≤ 3 lines on the character select), `innate`
   (persistent effects it always has), `mechanicParams`, `order`, `unlock` (an achievement id).
3. Mechanic: data-only when possible (`innate` carriers / modifiers / flags / familiars / triggers — Marrow, Drizzle).
   Otherwise add a `MECH_*` id + a `MK_*` kind in `sim/mechanics.ts`, tuning in `MECHANIC_TUNING` (sim/tuning.ts), and wire
   it at the moment it reacts to (`updateMechanic` per tick, `mechanicRoomClear`, `mechanicHurt`, `mechanicFloorStart`,
   `mechanicEnemyHit`, `mechanicFamiliars`). Run state that must survive a run save goes in `MechanicSnap`. Register a
   placeholder hook with the same id in `content/hooks/characters.ts`.
4. Tests: add it to `tests/characters.test.ts` (IDS, the loadout line, a rule test, the god-mode floor switch).

## Achievements

`src/content/achievements/*.ts` (`core.ts`, `heroes.ts`, `milestones.ts`): `{ id, name (≤ 24), desc (≤ 52), condition,
unlocks, icon, reward?, hidden? }`. Conditions: a lifetime counter (`meta/metaState.ts` COUNTER_IDS / stats / keyed counts)
or a run event (`ACHIEVEMENT_EVENTS`: …, `chapterBossKilled`, …) reported by `meta/tracker.ts`. Seeded (practice) runs don't
report run events. Rewards: `unlocks` entries (routes / endings / characters / items), every item or character whose
`unlock` names the achievement, and the `reward` line. Every achievement rewards something, and every icon resolves (a
badge in `content/sprites/achievementIcons.ts`, `item:<id>`, `char:<id>`, `win:<id>`).

Gating items: put `unlock: '<achievement id>'` on the item. Locked items never roll (pedestals, shops, drop tables) until
the achievement is earned; a new run takes the unlock snapshot at its start. Keep the starting pool rich: ≥ 40 treasure,
≥ 20 shop, ≥ 10 boss-pool items unlocked for a brand-new player (tests/achievements-content.test.ts), and the Storm Lance
available from the start.

Routes: Ending 1 ('ending1', CLEAR SKIES) opens the hidden route into chapter 6; Endings 1 + 2 open the whirlpool to floor 13.
