/**
 * Character mechanic hooks (CharacterDef.mechanic). The sim implements each mechanic by its id — Wren's keeper
 * marble inside the attack pipeline, the others in src/sim/mechanics.ts (MECH_*) — so these are placeholders
 * that let data validation check every reference; running one as an effect does nothing.
 */

import { registerHook } from '../../sim/hooks';

/** Wren — Lucky Marble: the first shot in each uncleared room is a big piercing keeper marble (×3 damage). */
registerHook('wren.luckyMarble', () => {
  // Implemented by the attack pipeline; nothing to do when executed as an effect.
});

/** Pip — Burrow: the dash ducks underground (untouchable) for a moment, on a cooldown. */
registerHook('pip.burrow', () => {});

/** Marrow — Bone Toss: boomerang carrier innate; no red hearts (everything red becomes Tin). */
registerHook('marrow.boneToss', () => {});

/** Juniper — Firefly Jar: two fireflies; each room cleared frees one more (up to 6); hits scare extras off. */
registerHook('juniper.fireflyJar', () => {});

/** Bolt — Wind-Up: charge rider innate; the active item recharges over time as well as per room. */
registerHook('bolt.windUp', () => {});

/** Sable — Pickpocket: melee carrier + haggler innate; hits may knock coins loose. */
registerHook('sable.pickpocket', () => {});

/** Mosswick — Bog Blood: puddle modifier innate; standing in own puddles soaks up Tin hearts. */
registerHook('mosswick.bogBlood', () => {});

/** Drizzle (secret) — Rainmaker: floats; every hit taken bursts a slowing cloud over the room (innate trigger data). */
registerHook('drizzle.rainmaker', () => {});
