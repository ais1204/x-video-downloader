// アイコン生成スクリプト（依存ゼロ・Node標準のみ）。
// 16/32/48/128 の PNG を icons/ に出力する。デザインは X ブルーの角丸正方形に
// 白いダウンロード矢印。あくまで実用プレースホルダー —— 後から差し替え可。
//
//   node scripts/gen-icons.mjs
//
// PNG は手書きエンコード（zlib のみ使用）。RGBA / 8bit / color type 6。

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "icons");
mkdirSync(outDir, { recursive: true });

const SIZES = [16, 32, 48, 128];
const SS = 4; // スーパーサンプリング倍率（アンチエイリアス用）

// ---- 色 ----
const lerp = (a, b, t) => a + (b - a) * t;
function bgColor(y) {
  // 上 #1D9BF0 → 下 #0C7ABF の縦グラデーション
  return [
    Math.round(lerp(0x1d, 0x0c, y)),
    Math.round(lerp(0x9b, 0x7a, y)),
    Math.round(lerp(0xf0, 0xbf, y))
  ];
}
const WHITE = [255, 255, 255];

// 角丸正方形の内側か（normalized 0..1）
function insideRoundedRect(x, y, rr) {
  const corners = [
    [rr, rr],
    [1 - rr, rr],
    [rr, 1 - rr],
    [1 - rr, 1 - rr]
  ];
  if (x < rr && y < rr) return dist2(x, y, corners[0]) <= rr * rr;
  if (x > 1 - rr && y < rr) return dist2(x, y, corners[1]) <= rr * rr;
  if (x < rr && y > 1 - rr) return dist2(x, y, corners[2]) <= rr * rr;
  if (x > 1 - rr && y > 1 - rr) return dist2(x, y, corners[3]) <= rr * rr;
  return true;
}
const dist2 = (x, y, c) => (x - c[0]) ** 2 + (y - c[1]) ** 2;

// ダウンロード矢印の内側か（normalized）
function insideArrow(x, y) {
  const dx = Math.abs(x - 0.5);
  // 縦の軸
  if (dx <= 0.075 && y >= 0.26 && y <= 0.56) return true;
  // 下向き三角（矢じり）
  if (y >= 0.5 && y <= 0.72) {
    const half = 0.2 * ((0.72 - y) / (0.72 - 0.5));
    if (dx <= half) return true;
  }
  // 受け皿（トレイ）
  if (y >= 0.78 && y <= 0.85 && dx <= 0.26) return true;
  return false;
}

// 1ピクセルの色（スーパーサンプリングで平均）
function pixel(px, py, size) {
  let r = 0,
    g = 0,
    b = 0,
    a = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const x = (px + (sx + 0.5) / SS) / size;
      const y = (py + (sy + 0.5) / SS) / size;
      if (!insideRoundedRect(x, y, 0.22)) {
        // 透明
      } else if (insideArrow(x, y)) {
        r += WHITE[0];
        g += WHITE[1];
        b += WHITE[2];
        a += 255;
      } else {
        const c = bgColor(y);
        r += c[0];
        g += c[1];
        b += c[2];
        a += 255;
      }
    }
  }
  const n = SS * SS;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)];
}

// ---- PNG エンコード ----
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
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePng(size) {
  // raw 画像データ（各行先頭にフィルタバイト0）
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of SIZES) {
  const png = encodePng(size);
  writeFileSync(join(outDir, `icon${size}.png`), png);
  console.log(`✓ icons/icon${size}.png (${png.length} bytes)`);
}
console.log("\n完成。manifest の icons / action.default_icon から参照されます。");
