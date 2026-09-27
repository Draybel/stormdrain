/**
 * Debug / test fixtures for the menus (window.__SD.debug.demoCharacters / __SD.save.demoProgress): two placeholder
 * characters so the character select (seven real characters) has to page, and a spread of sample progress so the
 * collection / bestiary / stats / achievements pages have something to show. Never used by the game itself.
 */

import { WREN } from '../content/characters/wren';
import { BOSSES, CHARACTERS, ENEMIES, allAchievements, allItems, registerCharacter } from '../content/registry';
import type { GameSave } from '../meta/save';
import { utcDateKey } from '../meta/metaState';
import type { CharacterDef } from '../sim/types';

/** Recoloured Wrens: two extra cards so the strip has to page (more than eight characters). */
const DEMO: readonly { id: string; name: string; coat: string; light: string; unlock: string; desc: string }[] = [
  { id: 'demo-ember', name: 'Ember', coat: '#a0402a', light: '#e07050', unlock: 'hidey-ho', desc: 'A spark that fell down a chimney.' },
  { id: 'demo-quill', name: 'Quill', coat: '#4a4a6a', light: '#8a8ab0', unlock: 'pack-rat', desc: 'A hedgehog postie with a soggy bag.' },
];

export function registerDemoCharacters(): number {
  let n = 0;
  for (const d of DEMO) {
    if (CHARACTERS.has(d.id)) continue;
    const palette: Record<string, string> = { ...WREN.sprite.palette };
    // Wren's coat keys: Y = coat, y = shade, h = highlight (see content/sprites/wren.ts).
    palette.Y = d.light;
    palette.y = d.coat;
    palette.h = d.light;
    const def: CharacterDef = {
      ...WREN,
      id: d.id,
      name: d.name,
      desc: d.desc,
      unlock: d.unlock,
      mechanicDesc: undefined,
      sprite: { ...WREN.sprite, id: `demo.${d.id}`, palette },
      stats: { ...WREN.stats, damage: WREN.stats.damage + (n % 3) * 0.5 - 0.5, moveSpeed: WREN.stats.moveSpeed - 8 + n * 4 },
    };
    registerCharacter(def);
    n++;
  }
  return n;
}

/** Fills the meta save with a believable spread of progress (collection, bestiary, stats, a few achievements). */
export function demoProgress(save: GameSave): void {
  const meta = save.meta;
  const items = allItems();
  items.forEach((d, i) => {
    if (i % 3 === 0) meta.collectItem(d.id);
    if (i % 3 !== 2) meta.seeItem(d.id);
  });
  let i = 0;
  for (const d of ENEMIES.values()) {
    if (i % 4 !== 3) meta.seeEnemy(d.id);
    for (let k = 0; k < (i * 7) % 23; k++) meta.killEnemy(d.id);
    i++;
  }
  i = 0;
  for (const d of BOSSES.values()) {
    if (i % 2 === 0) {
      meta.seeEnemy(d.id);
      meta.killEnemy(d.id, true);
    }
    i++;
  }
  const s = meta.state.stats;
  for (let k = 0; k < 14; k++) meta.recordRunStart('wren');
  meta.recordRunEnd({ character: 'wren', outcome: 'win', floor: 12 });
  for (let k = 0; k < 9; k++) meta.recordRunEnd({ character: 'wren', outcome: 'death', floor: 3 + (k % 6) });
  s.floorsCleared += 47;
  s.playTimeSec += 4 * 3600 + 23 * 60;
  for (const c of ['chestsOpened', 'secretsFound', 'coinsCollected', 'bombsUsed', 'keysUsed']) meta.bump(c, 5 + c.length * 3);
  const today = Date.now();
  for (let d = 1; d <= 3; d++) {
    meta.recordDaily(utcDateKey(today - d * 86_400_000), { seed: 'DEMO', character: 'wren', won: d === 2, floor: 4 + d, kills: 30 + d * 7, timeSec: 900 + d * 60, score: 5000 + d * 900 });
  }
  const ach = allAchievements();
  for (let k = 0; k < ach.length; k += 3) save.achievements.grant(ach[k]!);
  save.achievements.earned.length = 0;
  meta.markDirty(true);
}
