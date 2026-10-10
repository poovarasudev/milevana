#!/usr/bin/env node
// REL-13 interim artwork (VD-12): a lettered "M" tile in the app's primary
// colour, generated deterministically — no editor or network needed. Run:
//   node scripts/gen-interim-icon.mjs
// Regenerates icon.png, the adaptive-icon foreground/background/monochrome
// images and the favicon in assets/images/. These are placeholders for the
// closed test; final artwork is an owner task before production.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PRIMARY = [0x4c, 0x7b, 0xd9]; // src/ui/theme.ts light.primary
const WHITE = [0xff, 0xff, 0xff];
const OUT = join('assets', 'images');

// --- minimal PNG encoder (RGBA, filter type 0) -------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- "M" glyph coverage ------------------------------------------------------
// Strokes: two vertical bars and two diagonals meeting ~65% down the letter
// box. Coverage is supersampled 2x2 per pixel for smooth edges.

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Coverage (0..1) of the letter "M" at point (px,py) inside box box. */
function mCoverage(px, py, { x, y, w, h }) {
  const sw = w * 0.17; // stroke half-width
  const x1 = x;
  const x2 = x + w;
  const yTop = y;
  const yBot = y + h;
  const cx = x + w / 2;
  const cy = y + h * 0.66;
  const tests = [
    Math.abs(px - x1), // left bar
    Math.abs(px - x2), // right bar
    distToSegment(px, py, x1, yTop, cx, cy), // left diagonal
    distToSegment(px, py, x2, yTop, cx, cy), // right diagonal
  ];
  const inside = Math.min(...tests) <= sw && py >= yTop - sw && py <= yBot + sw;
  return inside ? 1 : 0;
}

function coverageSampled(px, py, box) {
  let c = 0;
  for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    c += mCoverage(px + ox, py + oy, box);
  }
  return c / 4;
}

/** Render an image: flat background colour + white "M". */
function render(size, { bg, letterScale }) {
  const img = Buffer.alloc(size * size * 4);
  const boxSize = size * letterScale;
  const box = { x: (size - boxSize) / 2, y: (size - boxSize) / 2, w: boxSize, h: boxSize };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cov = coverageSampled(x, y, box);
      const i = (y * size + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        img[i + ch] = Math.round(bg[ch] * (1 - cov) + WHITE[ch] * cov);
      }
      img[i + 3] = Math.round((bg[3] ?? 255) * (1 - cov) + 255 * cov);
    }
  }
  return img;
}

const targets = [
  // Launcher icon: full-bleed tile, letter ~52% of the canvas.
  { file: 'icon.png', size: 1024, bg: [...PRIMARY, 255], letterScale: 0.52 },
  // Adaptive foreground: transparent, letter inside the 66% safe zone.
  { file: 'android-icon-foreground.png', size: 1024, bg: [0, 0, 0, 0], letterScale: 0.40 },
  // Adaptive background: solid brand colour.
  { file: 'android-icon-background.png', size: 432, bg: [...PRIMARY, 255], letterScale: 0 },
  // Monochrome: white glyph on transparent for themed icons.
  { file: 'android-icon-monochrome.png', size: 432, bg: [0, 0, 0, 0], letterScale: 0.50 },
  // Favicon: small tile.
  { file: 'favicon.png', size: 48, bg: [...PRIMARY, 255], letterScale: 0.52 },
];

for (const t of targets) {
  const img = t.letterScale
    ? render(t.size, { bg: t.bg, letterScale: t.letterScale })
    : (() => {
        const img = Buffer.alloc(t.size * t.size * 4);
        for (let i = 0; i < img.length; i += 4) {
          img[i] = t.bg[0]; img[i + 1] = t.bg[1]; img[i + 2] = t.bg[2]; img[i + 3] = 255;
        }
        return img;
      })();
  writeFileSync(join(OUT, t.file), encodePng(t.size, t.size, img));
  console.log(`wrote ${OUT}/${t.file} (${t.size}x${t.size})`);
}
console.log('Interim icon set regenerated — final artwork is an owner task before production (VD-12).');
