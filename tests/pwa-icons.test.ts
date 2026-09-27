import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32 as zlibCrc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ICONS, composeIcon, crc32, encodePng, scaleIcon } from '../scripts/gen-icons.mjs';

const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');

interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
  chunks: string[];
  /** Unfiltered scanlines, `channels` bytes per pixel. */
  pixels: Uint8Array;
  channels: number;
}

/** Independent strict PNG reader (8-bit RGB/RGBA, non-interlaced) for verifying the encoder. */
function decodePng(bytes: Uint8Array): DecodedPng {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect(Array.from(bytes.subarray(0, 8))).toEqual(sig);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: string[] = [];
  const idat: Uint8Array[] = [];
  let ihdr: DataView | null = null;
  let o = 8;
  while (o < bytes.length) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    const data = bytes.subarray(o + 8, o + 8 + len);
    const crc = view.getUint32(o + 8 + len);
    expect(crc, `${type} CRC`).toBe(zlibCrc32(bytes.subarray(o + 4, o + 8 + len)));
    chunks.push(type);
    if (type === 'IHDR') ihdr = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  expect(o).toBe(bytes.length);
  expect(chunks[0]).toBe('IHDR');
  expect(chunks[chunks.length - 1]).toBe('IEND');
  expect(ihdr).not.toBeNull();
  const width = ihdr!.getUint32(0);
  const height = ihdr!.getUint32(4);
  const bitDepth = ihdr!.getUint8(8);
  const colorType = ihdr!.getUint8(9);
  const interlace = ihdr!.getUint8(12);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  expect(channels).toBeGreaterThan(0);
  const raw = new Uint8Array(inflateSync(Buffer.concat(idat)));
  const stride = width * channels;
  expect(raw.length).toBe((stride + 1) * height);
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    expect(f).toBeLessThanOrEqual(4);
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]!;
      const a = i >= channels ? px[y * stride + i - channels]! : 0;
      const b = y > 0 ? px[(y - 1) * stride + i]! : 0;
      const c = y > 0 && i >= channels ? px[(y - 1) * stride + i - channels]! : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = (x + pred) & 0xff;
    }
  }
  return { width, height, bitDepth, colorType, interlace, chunks, pixels: px, channels };
}

function rgbaToRgb(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i]!;
    out[j + 1] = rgba[i + 1]!;
    out[j + 2] = rgba[i + 2]!;
  }
  return out;
}

describe('PNG encoder', () => {
  it('crc32 matches zlib', () => {
    const data = new TextEncoder().encode('IEND and some more bytes 0123456789');
    expect(crc32(data)).toBe(zlibCrc32(data));
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('writes a valid signature, IHDR, IDAT and IEND with the right size (RGBA)', () => {
    const w = 7;
    const h = 5;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37) & 0xff;
    const png = decodePng(encodePng(w, h, rgba));
    expect(png).toMatchObject({ width: 7, height: 5, bitDepth: 8, colorType: 6, interlace: 0, channels: 4 });
    expect(png.chunks).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(Array.from(png.pixels)).toEqual(Array.from(rgba));
  });

  it('writes opaque RGB when alpha is off', () => {
    const rgba = new Uint8Array([10, 20, 30, 0, 40, 50, 60, 128, 70, 80, 90, 255, 1, 2, 3, 4]);
    const png = decodePng(encodePng(2, 2, rgba, { alpha: false }));
    expect(png).toMatchObject({ width: 2, height: 2, colorType: 2, channels: 3 });
    expect(Array.from(png.pixels)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 1, 2, 3]);
  });

  it('rejects bad sizes', () => {
    expect(() => encodePng(0, 1, new Uint8Array(0))).toThrow(RangeError);
    expect(() => encodePng(2, 2, new Uint8Array(3))).toThrow(RangeError);
  });
});

describe('app icons', () => {
  const expected: Record<string, number> = {
    'icon-32.png': 32,
    'icon-192.png': 192,
    'icon-512.png': 512,
    'apple-touch-icon-180.png': 180,
    'icon-maskable-512.png': 512,
  };

  it('the generator covers every required icon', () => {
    expect(ICONS.map((i) => i.file).sort()).toEqual(Object.keys(expected).sort());
  });

  it.each(ICONS.map((spec) => [spec.file, spec] as const))(
    '%s is committed, opaque, the right size and matches the art',
    (file, spec) => {
      const path = join(PUBLIC, 'icons', file);
      expect(existsSync(path), `${file} missing: run npm run icons`).toBe(true);
      const png = decodePng(new Uint8Array(readFileSync(path)));
      expect(png.width).toBe(expected[file]);
      expect(png.height).toBe(expected[file]);
      expect(png.colorType).toBe(2); // opaque: iOS home-screen icons must not be transparent
      const size = spec.crop ?? spec.grid * spec.scale;
      const art = scaleIcon(composeIcon(spec.grid, { headY: spec.headY }), spec.grid, spec.scale, size);
      expect(Buffer.compare(Buffer.from(png.pixels), Buffer.from(rgbaToRgb(art))), `${file} is stale: run npm run icons`).toBe(0);
    },
  );

  it('the maskable icon keeps the eyes and the marble inside the 80% safe zone', () => {
    const png = decodePng(new Uint8Array(readFileSync(join(PUBLIC, 'icons', 'icon-maskable-512.png'))));
    const eye = [0xea, 0xf7, 0xff];
    const hot = [0xff, 0xfb, 0xe8];
    let found = 0;
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 3;
        const p = [png.pixels[i], png.pixels[i + 1], png.pixels[i + 2]];
        const isKey = (p[0] === eye[0] && p[1] === eye[1] && p[2] === eye[2]) || (p[0] === hot[0] && p[1] === hot[1] && p[2] === hot[2]);
        if (!isKey) continue;
        found++;
        expect(Math.hypot(x + 0.5 - 256, y + 0.5 - 256)).toBeLessThan(0.4 * 512);
      }
    }
    expect(found).toBeGreaterThan(100);
  });
});

describe('web app manifest', () => {
  const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as {
    name: string;
    short_name: string;
    display: string;
    display_override: string[];
    orientation: string;
    start_url: string;
    scope: string;
    background_color: string;
    theme_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };

  it('describes a standalone landscape app that works from any sub-path', () => {
    expect(manifest.name).toBe('Stormdrain');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe('standalone');
    expect(manifest.display_override).toEqual(['fullscreen', 'standalone']);
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('lists 192, 512 and maskable 512 icons that exist with the declared sizes', () => {
    const has = (sizes: string, purpose: string) => manifest.icons.some((i) => i.sizes === sizes && (i.purpose ?? 'any').split(' ').includes(purpose));
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/'), `${icon.src} must be relative`).toBe(false);
      expect(icon.type).toBe('image/png');
      const png = decodePng(new Uint8Array(readFileSync(join(PUBLIC, icon.src))));
      expect(`${png.width}x${png.height}`).toBe(icon.sizes);
    }
  });
});

describe('index.html', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  it('links the manifest, the icons and the apple-touch-icon', () => {
    const links = [...html.matchAll(/<link\s+([^>]*?)\/?>/g)].map((m) => m[1]!);
    const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
    const byRel = (rel: string) => links.filter((l) => attr(l, 'rel') === rel);
    expect(byRel('manifest')).toHaveLength(1);
    expect(byRel('apple-touch-icon')).toHaveLength(1);
    expect(byRel('icon').length).toBeGreaterThanOrEqual(1);
    for (const l of [...byRel('manifest'), ...byRel('apple-touch-icon'), ...byRel('icon')]) {
      const href = attr(l, 'href')!;
      // Absolute public paths: Vite rewrites them for base './' at build time.
      expect(existsSync(join(PUBLIC, href.replace(/^\.?\//, ''))), href).toBe(true);
    }
    expect(attr(byRel('apple-touch-icon')[0]!, 'sizes')).toBe('180x180');
  });

  it('keeps the iOS full-screen meta tags', () => {
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('viewport-fit=cover');
  });
});
