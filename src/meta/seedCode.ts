/**
 * Run seeds as players see them (ARCHITECTURE §7b): an 8-character code shown as two groups of four,
 * e.g. `ABCD 1234`. Every run has one — random runs roll a fresh code, the daily run derives it from the
 * UTC date, and Enter Seed accepts any 8 letters / digits. The sim's numeric seed is the hash of the code
 * (`Sim.newRun(code)` → `seedToU32(code)`), so the same code always replays the same run; the code itself
 * rides along in `RunData.seedInfo` so the pause menu, the game-over screen and Continue can show it.
 *
 * Random and daily codes use an alphabet without look-alikes (no I, O, 0, 1) so they are easy to copy by
 * hand; typed codes may use any of A–Z and 0–9. Pure and DOM-free.
 */

import { Rng, hashString } from '../engine/rng';
import type { RunSeedInfo } from '../sim/run/types';

export const SEED_LEN = 8;
/** Characters random / daily codes are made of (no I, O, 0, 1). */
export const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VALID = /^[A-Z0-9]*$/;

/** Uppercases and drops spaces, dashes and underscores (what players type between the groups). */
export function normalizeSeedInput(text: string): string {
  return String(text ?? '')
    .toUpperCase()
    .replace(/[\s\-_]+/g, '');
}

export type SeedCheck = { ok: true; code: string } | { ok: false; error: string };

/** Is `text` a usable seed? Returns the normalized code or a short, player-facing reason. */
export function validateSeed(text: string): SeedCheck {
  const code = normalizeSeedInput(text);
  if (code.length === 0) return { ok: false, error: 'TYPE A SEED: 8 LETTERS OR DIGITS' };
  if (!VALID.test(code)) return { ok: false, error: 'ONLY LETTERS A-Z AND DIGITS 0-9' };
  if (code.length < SEED_LEN) return { ok: false, error: `TOO SHORT: ${code.length} OF ${SEED_LEN} CHARACTERS` };
  if (code.length > SEED_LEN) return { ok: false, error: `TOO LONG: ${code.length} OF ${SEED_LEN} CHARACTERS` };
  return { ok: true, code };
}

/** `ABCD1234` → `ABCD 1234` (anything else is returned as it is). */
export function formatSeed(code: string): string {
  return code.length === SEED_LEN ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/** A fresh random code (`rand` → [0, 1), default Math.random). */
export function randomSeedCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < SEED_LEN; i++) s += SEED_ALPHABET[Math.floor(rand() * SEED_ALPHABET.length) % SEED_ALPHABET.length];
  return s;
}

/** The daily run's code for a UTC date key (`YYYY-MM-DD`): the same for everyone on that day. */
export function dailySeedCode(date: string): string {
  const rng = new Rng(hashString(`stormdrain:daily:${date}`));
  return randomSeedCode(() => rng.next());
}

/** The daily run of a UTC date (`YYYY-MM-DD`): its code, and whether this attempt is the day's scored one. */
export function dailySeedInfo(date: string, alreadyPlayed: boolean): RunSeedInfo {
  return { code: dailySeedCode(date), kind: 'daily', date, scored: !alreadyPlayed };
}

/**
 * A daily picked before UTC midnight but started after it: the new day's daily instead (its own code and scored
 * flag), or null while `seed` is still today's (or isn't a daily). Without it, a character select left open over
 * midnight would score yesterday's daily and then today's too.
 */
export function rolledOverDaily(seed: RunSeedInfo, today: string, played: (date: string) => boolean): RunSeedInfo | null {
  if (seed.kind !== 'daily' || seed.date === today) return null;
  return dailySeedInfo(today, played(today));
}

/** The label for a run without a code (debug runs, pre-4B saves): its numeric seed in hex. */
export function numericSeedLabel(seed: number): string {
  return `#${(seed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}
