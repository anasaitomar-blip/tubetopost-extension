// make-icons.js — Génère les PNG d'icône sans dépendance (zlib natif).
// Carré violet arrondi + triangle "play" blanc. node make-icons.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const PRIMARY = [109, 94, 252];
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Anti-alias par sur-échantillonnage 4x.
function render(size) {
  const SS = 4, S = size * SS;
  const buf = Buffer.alloc(size * size * 4);
  const radius = S * 0.22;
  // Triangle play (coords en espace S).
  const cx = S * 0.40, tw = S * 0.26, th = S * 0.30, midY = S * 0.5;
  const tx1 = cx, tx2 = cx + tw;
  const ty1 = midY - th / 2, ty2 = midY + th / 2;

  const inRounded = (x, y) => {
    const rx = Math.min(x, S - x), ry = Math.min(y, S - y);
    if (rx >= radius || ry >= radius) return x >= 0 && x < S && y >= 0 && y < S;
    const dx = radius - rx, dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };
  const inTriangle = (x, y) => {
    if (x < tx1 || x > tx2) return false;
    const t = (x - tx1) / (tx2 - tx1);     // 0..1
    const half = (1 - t) * (th / 2);
    return y >= midY - half && y <= midY + half;
  };

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let aSq = 0, rAcc = 0, gAcc = 0, bAcc = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const X = px * SS + sx + 0.5, Y = py * SS + sy + 0.5;
          if (!inRounded(X, Y)) continue;
          aSq++;
          const col = inTriangle(X, Y) ? WHITE : PRIMARY;
          rAcc += col[0]; gAcc += col[1]; bAcc += col[2];
        }
      }
      const total = SS * SS;
      const i = (py * size + px) * 4;
      if (aSq === 0) { buf[i + 3] = 0; continue; }
      buf[i] = Math.round(rAcc / aSq);
      buf[i + 1] = Math.round(gAcc / aSq);
      buf[i + 2] = Math.round(bAcc / aSq);
      buf[i + 3] = Math.round((aSq / total) * 255);
    }
  }
  return buf;
}

const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(size, render(size));
  fs.writeFileSync(path.join(dir, `icon${size}.png`), png);
  console.log(`icon${size}.png ${png.length}b`);
}
console.log('done');
