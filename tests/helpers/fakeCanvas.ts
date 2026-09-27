/**
 * A stand-in `document` with canvases whose 2D contexts accept every call and do nothing (image data is real), so
 * render caches can be exercised in node. `installFakeCanvas()` returns the counters; `vi.unstubAllGlobals()` undoes it.
 */

import { vi } from 'vitest';

export interface CanvasCounters {
  /** Canvases created. */
  canvases: number;
  /** putImageData calls. */
  puts: number;
  /** fillRect calls. */
  fills: number;
}

function fakeContext(c: CanvasCounters): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {};
  const target = {
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {
      c.puts++;
    },
    fillRect: () => {
      c.fills++;
    },
    measureText: () => ({ width: 0 }),
  } as Record<string | symbol, unknown>;
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in state) return state[k];
      return () => undefined;
    },
    set(_t, k, v) {
      state[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function installFakeCanvas(): CanvasCounters {
  const counters: CanvasCounters = { canvases: 0, puts: 0, fills: 0 };
  const doc = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`fake document: no <${tag}>`);
      counters.canvases++;
      const ctx = fakeContext(counters);
      return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    },
  };
  vi.stubGlobal('document', doc);
  return counters;
}
