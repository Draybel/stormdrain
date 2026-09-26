/**
 * Character mechanic hooks (CharacterDef.mechanic). The mechanics that live inside the attack
 * pipeline register a placeholder here so data validation can check every reference now;
 * the attack pipeline (Phase 2 part B) reads `character.mechanic` and implements the behaviour.
 */

import { registerHook } from '../../sim/hooks';

/** Wren — Lucky Marble: the first shot in each uncleared room is a big piercing keeper marble (×3 damage). */
registerHook('wren.luckyMarble', () => {
  // Implemented by the attack pipeline (part B); nothing to do when executed as an effect.
});
