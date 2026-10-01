// Generates simple PNG app icons (matching public/favicon.svg) without dependencies.
// Usage: node scripts/gen-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function render(size, maskable) {
  const s = size / 512;
  const bg = hex('#f4a261'), face = hex('#fff8ef'), eye = hex('#3d3a4b'), mouth = hex('#e76f51');
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const R = 112 * s;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      let col = null;
      // rounded rect background (full square when maskable)
      const cx = Math.min(Math.max(px, R), size - R), cy = Math.min(Math.max(py, R), size - R);
      if (maskable || (px - cx) ** 2 + (py - cy) ** 2 <= R * R) col = bg;
      const scale = maskable ? 0.8 : 1;
      const ux = (px - size / 2) / (s * scale) + 256, uy = (py - size / 2) / (s * scale) + 256;
      const inC = (x0, y0, r) => (ux - x0) ** 2 + (uy - y0) ** 2 <= r * r;
      if (inC(256, 270, 170)) col = face;
      if (inC(196, 230, 22) || inC(316, 230, 22)) col = eye;
      if (((ux - 256) / 52) ** 2 + ((uy - 330) / 40) ** 2 <= 1) col = mouth;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (col) { raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', render(192, false));
writeFileSync('public/icon-512.png', render(512, false));
writeFileSync('public/icon-maskable-512.png', render(512, true));
writeFileSync('public/apple-touch-icon.png', render(180, true));
console.log('icons written');
