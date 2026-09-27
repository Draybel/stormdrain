/**
 * Achievement icons (AchievementDef.icon): a medallion badge by name (content/sprites/achievementIcons.ts),
 * 'item:<id>' (the item's icon), 'char:<id>' (the character's face) or 'win:<id>' (the face with a little
 * crown). Earned ones are drawn in colour; locked ones as a dark silhouette (characters, items) or a dimmed
 * badge; a hidden one that isn't earned yet shows only the grey trophy.
 */

import { CHARACTERS, findItem } from '../content/registry';
import { ACHIEVEMENT_BADGES, WIN_CROWN } from '../content/sprites/achievementIcons';
import { ICON_TROPHY, ICON_TROPHY_DIM } from '../content/sprites/menuIcons';
import type { AchievementDef, SpriteDef } from '../sim/types';
import { drawSprite, getFrame, getSilhouette } from './sprites';

export interface ResolvedIcon {
  sprite: SpriteDef;
  kind: 'badge' | 'item' | 'face';
  /** Draw the win crown over it ('win:<id>'). */
  crown: boolean;
}

const TROPHY: ResolvedIcon = { sprite: ICON_TROPHY, kind: 'badge', crown: false };
const cache = new Map<string, ResolvedIcon>();

/** What an icon string points at (no icon = the trophy; undefined = not a known badge / item / character). */
export function resolveAchievementIcon(icon: string | undefined): ResolvedIcon | undefined {
  if (!icon) return TROPHY;
  const hit = cache.get(icon);
  if (hit) return hit;
  let out: ResolvedIcon | undefined;
  const colon = icon.indexOf(':');
  if (colon > 0) {
    const kind = icon.slice(0, colon);
    const id = icon.slice(colon + 1);
    if (kind === 'item') {
      const def = findItem(id);
      if (def && typeof def.sprite !== 'string') out = { sprite: def.sprite, kind: 'item', crown: false };
    } else if (kind === 'char' || kind === 'win') {
      const c = CHARACTERS.get(id);
      if (c) out = { sprite: c.sprite, kind: 'face', crown: kind === 'win' };
    }
  } else {
    const b = ACHIEVEMENT_BADGES[icon];
    if (b) out = { sprite: b, kind: 'badge', crown: false };
  }
  if (out) cache.set(icon, out);
  return out;
}

/** Draws an achievement's icon in a 16×16 cell at (x, y). */
export function drawAchievementIcon(ctx: CanvasRenderingContext2D, def: AchievementDef, x: number, y: number, earned: boolean): void {
  const r = def.hidden && !earned ? undefined : resolveAchievementIcon(def.icon);
  if (!r || r.sprite === ICON_TROPHY) {
    drawSprite(ctx, earned ? ICON_TROPHY : ICON_TROPHY_DIM, 0, x, y);
    return;
  }
  const s = r.sprite;
  // Locked: characters and items as dark silhouettes (no spoilers), badges dimmed.
  const img = earned || r.kind === 'badge' ? getFrame(s, 0) : getSilhouette(s, 0, '#2e3650');
  if (!earned && r.kind === 'badge') ctx.globalAlpha = 0.4;
  const dx = Math.round(x + (16 - img.width) / 2);
  const dy = r.kind === 'face' ? Math.round(y + 17 - img.height) : Math.round(y + (16 - img.height) / 2);
  ctx.drawImage(img, dx, dy);
  if (r.crown) {
    if (!earned) ctx.globalAlpha = 0.4;
    drawSprite(ctx, WIN_CROWN, 0, x + 5, y - 3);
  }
  ctx.globalAlpha = 1;
}
