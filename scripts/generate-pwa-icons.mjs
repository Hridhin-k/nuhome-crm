import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function fill(rgba, i, r, g, b, a = 255) {
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.08);
  const inner = size - pad * 2;
  const radius = Math.round(inner * 0.22);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      fill(rgba, i, 0, 0, 0);
    }
  }

  function inRoundedRect(x, y, x0, y0, w, h, r) {
    const px = Math.max(x0 + r, Math.min(x, x0 + w - r));
    const py = Math.max(y0 + r, Math.min(y, y0 + h - r));
    if (x >= x0 + r && x < x0 + w - r) return y >= y0 && y < y0 + h;
    if (y >= y0 + r && y < y0 + h - r) return x >= x0 && x < x0 + w;
    const dx = x - px;
    const dy = y - py;
    return dx * dx + dy * dy <= r * r;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRoundedRect(x, y, pad, pad, inner, inner, radius)) {
        fill(rgba, (y * size + x) * 4, 27, 27, 27);
      }
    }
  }

  const glyph = [
    "10001",
    "11001",
    "10101",
    "10011",
    "10001",
  ];
  const cell = Math.floor(inner / 7);
  const gw = 5 * cell;
  const gh = 5 * cell;
  const gx = Math.floor((size - gw) / 2);
  const gy = Math.floor((size - gh) / 2);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] !== "1") continue;
      for (let yy = 0; yy < cell; yy++) {
        for (let xx = 0; xx < cell; xx++) {
          const x = gx + col * cell + xx;
          const y = gy + row * cell + yy;
          fill(rgba, (y * size + x) * 4, 255, 255, 255);
        }
      }
    }
  }

  return encodePng(size, size, rgba);
}

writeFileSync(join(outDir, "icon-192.png"), drawIcon(192, { maskable: false }));
writeFileSync(join(outDir, "icon-512.png"), drawIcon(512, { maskable: false }));
writeFileSync(join(outDir, "icon-maskable-512.png"), drawIcon(512, { maskable: true }));
writeFileSync(join(outDir, "apple-touch-icon.png"), drawIcon(180, { maskable: false }));
console.log("Wrote PWA icons to public/icons");
