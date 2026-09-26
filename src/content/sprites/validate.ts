/** DOM-free sanity checks for pixel-map sprites (used by unit tests and dev asserts). */

import type { SpriteDef } from '../../sim/types';

const TRANSPARENT = new Set(['.', ' ']);

/** Returns a list of human-readable problems (empty = valid). */
export function validateSpriteDef(def: SpriteDef): string[] {
  const errs: string[] = [];
  if (def.frames.length === 0) errs.push(`${def.id}: no frames`);
  def.frames.forEach((f, fi) => {
    if (f.length !== def.h) errs.push(`${def.id}[${fi}]: ${f.length} rows, expected ${def.h}`);
    f.forEach((row, ri) => {
      if (row.length !== def.w) errs.push(`${def.id}[${fi}] row ${ri}: ${row.length} chars, expected ${def.w}: "${row}"`);
      for (const ch of row) {
        if (!TRANSPARENT.has(ch) && def.palette[ch] === undefined) {
          errs.push(`${def.id}[${fi}] row ${ri}: unknown palette char '${ch}'`);
        }
      }
    });
  });
  if (def.anims) {
    for (const [name, a] of Object.entries(def.anims)) {
      for (const fi of a.frames) {
        if (fi < 0 || fi >= def.frames.length) errs.push(`${def.id}.anims.${name}: bad frame ${fi}`);
      }
    }
  }
  return errs;
}
