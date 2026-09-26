/** Types for scripts/gen-icons.mjs (used by tests/pwa-icons.test.ts). */

export interface IconSpec {
  file: string;
  /** Art resolution (the icon is composed on a grid×grid pixel canvas). */
  grid: number;
  /** Nearest-neighbour scale factor. */
  scale: number;
  /** Final size in px after a centre crop (default grid × scale). */
  crop?: number;
  /** Vertical position of the face centre (fraction of the grid). */
  headY?: number;
}

export declare const ICONS: readonly IconSpec[];

export declare function crc32(bytes: Uint8Array, start?: number, end?: number): number;

export declare function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
  opts?: { alpha?: boolean },
): Uint8Array;

export declare function composeIcon(size: number, opts?: { headX?: number; headY?: number }): Uint8Array;

export declare function scaleIcon(px: Uint8Array, size: number, scale: number, crop?: number): Uint8Array;

export declare function renderIcon(spec: IconSpec): { size: number; png: Uint8Array };

export declare function main(argv?: string[]): void;
