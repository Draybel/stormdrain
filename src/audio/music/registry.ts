/**
 * Music track registry: auto-discovers `src/content/music/*.ts` (each `export default MusicTrack[]`),
 * throws on duplicate ids, and compiles tracks lazily (cached) the first time they are played.
 */

import { compileTrack, type CompiledTrack } from './parse';
import type { MusicTrack } from './types';

const modules = import.meta.glob<{ default?: readonly MusicTrack[] }>('../../content/music/*.ts', { eager: true });

function build(): Map<string, MusicTrack> {
  const map = new Map<string, MusicTrack>();
  for (const [path, mod] of Object.entries(modules)) {
    const list = mod.default;
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      if (map.has(t.id)) throw new Error(`duplicate music track id "${t.id}" (${path})`);
      map.set(t.id, t);
    }
  }
  return map;
}

const TRACKS: ReadonlyMap<string, MusicTrack> = build();
const compiled = new Map<string, CompiledTrack | null>();

export function getTrack(id: string): MusicTrack | undefined {
  return TRACKS.get(id);
}

export function allTracks(): MusicTrack[] {
  return [...TRACKS.values()];
}

export function hasTrack(id: string): boolean {
  return TRACKS.has(id);
}

/** Compiled (cached) track, or null for an unknown id / a track that fails to compile (logged once). */
export function getCompiledTrack(id: string): CompiledTrack | null {
  const hit = compiled.get(id);
  if (hit !== undefined) return hit;
  const t = TRACKS.get(id);
  let c: CompiledTrack | null = null;
  if (t) {
    try {
      c = compileTrack(t);
    } catch (e) {
      console.error(`music: track "${id}" failed to compile: ${(e as Error).message}`);
    }
  }
  compiled.set(id, c);
  return c;
}
