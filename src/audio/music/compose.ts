/**
 * Small helpers for writing tracks in `src/content/music` (pure string/object utilities).
 * Tests validate the compiled result, so helpers can't produce a track that silently breaks.
 */

import type { Instrument } from './types';

/** Repeats a pattern fragment `n` times. */
export function rep(fragment: string, n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(fragment.trim());
  return out.join(' ');
}

/** Joins fragments (bars) into one pattern with bar lines between them. */
export function bars(...fragments: string[]): string {
  return fragments.map((f) => f.trim()).join(' | ');
}

/** A preset with a few fields replaced (env/filter/vibrato are replaced whole when given). */
export function inst(base: Instrument, over: Partial<Instrument>): Instrument {
  return { ...base, ...over };
}

/**
 * Arpeggiates a chord (space-separated pitch tokens) through an index pattern, one note per
 * `len` steps. `arp('1 3 5 1\'', [0, 1, 2, 3, 2, 1, 0, 1], 2)` → 8 eighth notes.
 */
export function arp(chord: string, order: readonly number[], len = 1): string {
  const tones = chord.trim().split(/\s+/);
  return order
    .map((i) => {
      const t = tones[i % tones.length]!;
      return len === 1 ? t : `${t}:${len}`;
    })
    .join(' ');
}
