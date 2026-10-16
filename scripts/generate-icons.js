import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const toCrc = Buffer.concat([typeBuf, data]);
  chunk.writeUInt32BE(crc32(toCrc), 8 + len);
  return chunk;
}

export function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6: RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT: Scanlines with filter byte 0
  const scanlineWidth = width * 4;
  const uncompressed = Buffer.alloc(height * (1 + scanlineWidth));
  for (let y = 0; y < height; y++) {
    const uncompressedOffset = y * (1 + scanlineWidth);
    uncompressed[uncompressedOffset] = 0; // Filter None
    const rgbaOffset = y * scanlineWidth;
    rgbaBuffer.copy(uncompressed, uncompressedOffset + 1, rgbaOffset, rgbaOffset + scanlineWidth);
  }

  const compressed = zlib.deflateSync(uncompressed, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function sdRoundRect(px, py, rx, ry, rw, rh, radius) {
  const dx = Math.abs(px - (rx + rw / 2)) - (rw / 2 - radius);
  const dy = Math.abs(py - (ry + rh / 2)) - (rh / 2 - radius);
  const outsideDist = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const insideDist = Math.min(Math.max(dx, dy), 0);
  return outsideDist + insideDist - radius;
}

// Distance to segment (capsule)
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.hypot(dx, dy) - r;
}

// Helper to alpha-blend colors [r, g, b, a] over [dr, dg, db, da]
function blend(dst, src) {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0.0001) return [0, 0, 0, 0];
  const outR = Math.round((src[0] * sa + dst[0] * da * (1 - sa)) / outA);
  const outG = Math.round((src[1] * sa + dst[1] * da * (1 - sa)) / outA);
  const outB = Math.round((src[2] * sa + dst[2] * da * (1 - sa)) / outA);
  return [outR, outG, outB, Math.round(outA * 255)];
}

// Render icon at requested size using 3x supersampling
export function renderIcon(size) {
  const scale = 3;
  const w = size * scale;
  const h = size * scale;

  // We operate in normalized [0, 100] coordinate space
  // Map pixel (x, y) to (nx, ny)
  const ssRgba = new Uint8ClampedArray(w * h * 4);

  // Equalizer bar definitions: [cx, topY, botY, radius, [r, g, b]]
  const bars = [
    { cx: 27, topY: 34, botY: 50, r: 2.2, color: [56, 189, 248] }, // sky-400
    { cx: 35, topY: 26, botY: 51, r: 2.4, color: [56, 189, 248] },
    { cx: 43, topY: 18, botY: 53, r: 2.7, color: [16, 185, 129] }, // emerald-500
    { cx: 50, topY: 12, botY: 54, r: 3.0, color: [52, 211, 153] }, // emerald-400 peak
    { cx: 57, topY: 18, botY: 53, r: 2.7, color: [16, 185, 129] },
    { cx: 65, topY: 26, botY: 51, r: 2.4, color: [56, 189, 248] },
    { cx: 73, topY: 34, botY: 50, r: 2.2, color: [56, 189, 248] }
  ];

  for (let py = 0; py < h; py++) {
    const ny = (py / (h - 1)) * 100;
    for (let px = 0; px < w; px++) {
      const nx = (px / (w - 1)) * 100;
      let pixel = [0, 0, 0, 0]; // default transparent

      // 1. Background squircle
      const bgDist = sdRoundRect(nx, ny, 2, 2, 96, 96, 22);
      if (bgDist <= 1.0) {
        const t = (nx + ny) / 200;
        // Gradient from dark emerald/navy to dark slate
        const br = Math.round(6 * (1 - t) + 10 * t);
        const bg = Math.round(44 * (1 - t) + 25 * t);
        const bb = Math.round(36 * (1 - t) + 47 * t);
        const alpha = Math.max(0, Math.min(1, -bgDist + 0.5));
        pixel = blend(pixel, [br, bg, bb, Math.round(alpha * 255)]);

        // Subtle border
        if (bgDist >= -2.0 && bgDist <= 0.5) {
          const borderAlpha = Math.max(0, Math.min(0.4, 1 - Math.abs(bgDist + 1.0)));
          pixel = blend(pixel, [16, 185, 129, Math.round(borderAlpha * 255)]);
        }
      }

      // If outside background, skip interior
      if (pixel[3] > 0) {
        // 2. Sound equalizer wave bars
        for (const bar of bars) {
          const dBar = sdCapsule(nx, ny, bar.cx, bar.topY, bar.cx, bar.botY, bar.r);
          if (dBar <= 1.0) {
            const barAlpha = Math.max(0, Math.min(1, -dBar + 0.5));
            pixel = blend(pixel, [...bar.color, Math.round(barAlpha * 255)]);
          }
        }

        // 3. Quran Book pages (Left: emerald, Right: sky blue)
        // Center spine at x = 50. Left page: x in [16, 50], Right page: x in [50, 84]
        // Base curved profile:
        const inLeftPage = (nx >= 15 && nx <= 50.5 && ny >= 58 && ny <= 85);
        const inRightPage = (nx >= 49.5 && nx <= 85 && ny >= 58 && ny <= 85);

        if (inLeftPage) {
          // Left page curve
          // Top edge: curves from ny=60 at x=50 to ny=56 at x=32 to ny=60 at x=16
          const relX = (nx - 16) / 34; // 0 at left edge, 1 at spine
          const topCurve = 60 - 5 * Math.sin(relX * Math.PI);
          const botCurve = 81 - 4 * Math.sin(relX * Math.PI);

          if (ny >= topCurve && ny <= botCurve) {
            // Emerald gradient
            const r = Math.round(5 + 20 * (1 - relX));
            const g = Math.round(150 + 45 * relX);
            const b = Math.round(100 + 30 * relX);
            pixel = blend(pixel, [r, g, b, 255]);

            // Inner page text/accent lines
            for (const lineY of [67, 72, 77]) {
              const curLineY = lineY - 4.5 * Math.sin(relX * Math.PI);
              if (Math.abs(ny - curLineY) < 0.9 && relX > 0.15 && relX < 0.85) {
                pixel = blend(pixel, [167, 243, 208, 180]); // emerald-200 lines
              }
            }
          }
        }

        if (inRightPage) {
          // Right page curve
          const relX = (nx - 50) / 34; // 0 at spine, 1 at right edge
          const topCurve = 60 - 5 * Math.sin((1 - relX) * Math.PI);
          const botCurve = 81 - 4 * Math.sin((1 - relX) * Math.PI);

          if (ny >= topCurve && ny <= botCurve) {
            // Sky blue gradient
            const r = Math.round(14 + 40 * (1 - relX));
            const g = Math.round(130 + 55 * (1 - relX));
            const b = Math.round(230 + 18 * (1 - relX));
            pixel = blend(pixel, [r, g, b, 255]);

            // Inner page text/accent lines
            for (const lineY of [67, 72, 77]) {
              const curLineY = lineY - 4.5 * Math.sin((1 - relX) * Math.PI);
              if (Math.abs(ny - curLineY) < 0.9 && relX > 0.15 && relX < 0.85) {
                pixel = blend(pixel, [186, 230, 253, 180]); // sky-200 lines
              }
            }
          }
        }

        // 4. Central spine line & ribbon
        if (Math.abs(nx - 50) < 1.0 && ny >= 57 && ny <= 84) {
          pixel = blend(pixel, [248, 250, 252, 230]); // slate-50 spine
        }
        // Bookmark ribbon tail
        if (Math.abs(nx - 50) < 1.6 && ny >= 84 && ny <= 89) {
          pixel = blend(pixel, [251, 191, 36, 240]); // amber ribbon
        }
      }

      const idx = (py * w + px) * 4;
      ssRgba[idx] = pixel[0];
      ssRgba[idx + 1] = pixel[1];
      ssRgba[idx + 2] = pixel[2];
      ssRgba[idx + 3] = pixel[3];
    }
  }

  // Downsample from (size * scale) to (size) using box filter
  const outRgba = Buffer.alloc(size * size * 4);
  const scaleSq = scale * scale;

  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
      for (let sy = 0; sy < scale; sy++) {
        const iy = oy * scale + sy;
        for (let sx = 0; sx < scale; sx++) {
          const ix = ox * scale + sx;
          const sIdx = (iy * w + ix) * 4;
          sumR += ssRgba[sIdx];
          sumG += ssRgba[sIdx + 1];
          sumB += ssRgba[sIdx + 2];
          sumA += ssRgba[sIdx + 3];
        }
      }
      const outIdx = (oy * size + ox) * 4;
      outRgba[outIdx] = Math.round(sumR / scaleSq);
      outRgba[outIdx + 1] = Math.round(sumG / scaleSq);
      outRgba[outIdx + 2] = Math.round(sumB / scaleSq);
      outRgba[outIdx + 3] = Math.round(sumA / scaleSq);
    }
  }

  return encodePNG(size, size, outRgba);
}

// Generate all target sizes
const sizes = [16, 32, 48, 128];
const targetDir = path.resolve(__dirname, '../assets/icons');
fs.mkdirSync(targetDir, { recursive: true });

for (const s of sizes) {
  const pngBuffer = renderIcon(s);
  const outPath = path.join(targetDir, `icon-${s}.png`);
  fs.writeFileSync(outPath, pngBuffer);
  console.log(`Generated ${outPath} (${pngBuffer.length} bytes)`);
}
console.log('Icon generation complete!');
