/**
 * Status-effect modifiers (§4.4) on top of the status API (Hittable.applyStatus, stacking rules in
 * sim/enemies/status.ts). Stacks raise duration and strength; crowd control (freeze, charm, fear) is a
 * chance per hit that grows with stacks and luck. Chain lightning re-applies these (`status: true`).
 */

import { SRC_PLAYER } from '../../hittable';
import type { StatusKind } from '../../types';
import type { ModifierDef, ModStack } from '../state';

function statusMod(
  id: StatusKind & ModifierDef['id'],
  color: string,
  trail: ModifierDef['trail'],
  order: number,
  prepare: (st: ModStack, luck: number) => void,
): ModifierDef {
  return {
    id,
    color,
    trail,
    order,
    status: true,
    prepare(st, prof) {
      prepare(st, prof.luck);
    },
    hit(s, t, st, w) {
      // v0 duration, v1 power (× shot damage for DOTs, absolute otherwise), v2 chance.
      if (st.v2 < 1 && w.combatRng.next() >= st.v2) return;
      const power = st.v3 > 0 ? Math.max(1, s.damage * st.v1) : st.v1;
      t.applyStatus(id, st.v0, power, SRC_PLAYER);
    },
  };
}

const extra = (st: ModStack): number => st.stacks - 1;

export const STATUS_MODIFIERS: readonly ModifierDef[] = [
  statusMod('poison', '#7ee06a', 'bubbles', 60, (st) => {
    st.v0 = 2.5 + st.stacks + (st.params.duration ?? 0);
    st.v1 = 0.35 * (1 + 0.4 * extra(st));
    st.v2 = 1;
    st.v3 = 1; // power scales with the shot's damage
  }),
  statusMod('burn', '#ff8a30', 'embers', 61, (st) => {
    st.v0 = 2 + 0.75 * st.stacks + (st.params.duration ?? 0);
    st.v1 = 0.3 * (1 + 0.4 * extra(st));
    st.v2 = 1;
    st.v3 = 1;
  }),
  statusMod('freeze', '#bff0ff', 'ice', 62, (st, luck) => {
    st.v0 = 1.2 + 0.4 * st.stacks;
    st.v1 = 0;
    st.v2 = Math.min(1, 0.22 + 0.13 * extra(st) + 0.02 * luck);
    st.v3 = 0;
  }),
  statusMod('slow', '#9aa0c8', 'dust', 63, (st) => {
    st.v0 = 1.5 + 0.5 * st.stacks;
    st.v1 = Math.min(0.8, 0.35 + 0.1 * st.stacks);
    st.v2 = 1;
    st.v3 = 0;
  }),
  statusMod('charm', '#ff8ad0', 'wisps', 64, (st, luck) => {
    st.v0 = 3 + st.stacks;
    st.v1 = 0;
    st.v2 = Math.min(1, 0.14 + 0.08 * extra(st) + 0.02 * luck);
    st.v3 = 0;
  }),
  statusMod('fear', '#9a6ad8', 'wisps', 65, (st, luck) => {
    st.v0 = 2 + 0.8 * st.stacks;
    st.v1 = 0;
    st.v2 = Math.min(1, 0.18 + 0.1 * extra(st) + 0.02 * luck);
    st.v3 = 0;
  }),
];
