/**
 * All room templates, auto-discovered from src/content/rooms/*.ts (each file: export default
 * RoomTemplate[]). Sorted by file path so the order is stable; pickTemplates sorts by id anyway.
 * The content registry (src/content/registry.ts) may re-export this list.
 */

import type { RoomTemplate } from './types';

const modules = import.meta.glob<{ default: readonly RoomTemplate[] }>('../../content/rooms/*.ts', { eager: true });

export const ROOM_TEMPLATES: readonly RoomTemplate[] = Object.keys(modules)
  .sort()
  .flatMap((path) => modules[path]!.default ?? []);
