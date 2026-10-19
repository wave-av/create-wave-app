// Generates the template's placeholder brand mark: a 1024x1024 PNG master
// (wave blue field, dark base, white signal disc) and build/icon.icns.
// Zero deps; run once per template change, not at scaffold time.
const { execFileSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const OUT = process.argv[2] || path.join(__dirname, "..", "templates", "electron", "files", "build");
const N = 1024;

function png(width, height, px) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    px(Buffer.from(raw.buffer, raw.byteOffset + y * (width * 3 + 1) + 1, width * 3), y);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crcTable = png.crc || (png.crc = (() => {
      const t = new Int32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
      return t;
    })());
    let crc = -1;
    for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    const sum = Buffer.alloc(4); sum.writeInt32BE(crc ^ -1);
    return Buffer.concat([len, body, sum]);
  };
  const head = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([head, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const BLUE = [43, 107, 255]; const DARK = [11, 15, 26]; const WHITE = [245, 247, 255];
const buf = png(N, N, (row, y) => {
  for (let x = 0; x < N; x++) {
    const dx = x - N / 2, dy = y - N * 0.42, r = N * 0.21;
    let [rr, gg, bb] = y < N * 0.66 ? BLUE : DARK;
    if (dx * dx + dy * dy < r * r) [rr, gg, bb] = WHITE;
    row[x * 3] = rr; row[x * 3 + 1] = gg; row[x * 3 + 2] = bb;
  }
});

mkdirSync(OUT, { recursive: true });
const master = path.join(OUT, "icon.png");
writeFileSync(master, buf);
const set = path.join(tmpdir(), "wave-electron-icon.iconset");
execFileSync("rm", ["-rf", set]); mkdirSync(set);
for (const [name, size] of [["16", 16], ["32", 32], ["128", 128], ["256", 256], ["512", 512]]) {
  execFileSync("sips", ["-z", size, size, master, "--out", path.join(set, `icon_${name}x${name}.png`)], { stdio: "pipe" });
  execFileSync("sips", ["-z", size * 2, size * 2, master, "--out", path.join(set, `icon_${name}x${name}@2x.png`)], { stdio: "pipe" });
}
execFileSync("iconutil", ["-c", "icns", set, "-o", path.join(OUT, "icon.icns")], { stdio: "pipe" });
execFileSync("rm", ["-rf", set]);
console.log("wrote", master, "and icon.icns");
