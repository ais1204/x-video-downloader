// 配布用パッケージ作成スクリプト（依存ゼロ・Node標準のみ）。
// Chrome の実行に必要なファイルだけを dist/<name>/ に集め、zip 化する。
// 受け取った人はビルド不要 —— zip を解凍して「パッケージ化されていない拡張機能を読み込む」だけ。

import {
  cpSync,
  rmSync,
  mkdirSync,
  existsSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = "x-video-downloader";
const dist = join(root, "dist");
const pkgDir = join(dist, name);
const zipPath = join(dist, name + ".zip");

// Chrome 実行時に必要なファイル / フォルダのみ（.ts や node_modules は含めない）
const runtimeFiles = [
  "manifest.json",
  "inject.js",
  "content.js",
  "background.js",
  "pixiv.js",
  "options.js",
  "options.html",
  "styles.css",
  "rules.json"
];
const runtimeDirs = ["vendor", "icons"];

// クリーン
rmSync(dist, { recursive: true, force: true });
mkdirSync(pkgDir, { recursive: true });

// コピー（先にビルドが済んでいる前提。なければ中断）
for (const f of runtimeFiles) {
  const src = join(root, f);
  if (!existsSync(src)) {
    console.error(`✗ ${f} が見つかりません。先に "npm run build" を実行してください。`);
    process.exit(1);
  }
  cpSync(src, join(pkgDir, f));
}
for (const d of runtimeDirs) {
  cpSync(join(root, d), join(pkgDir, d), { recursive: true });
}

// zip 化（OS標準ツールを使用）
if (platform() === "win32") {
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${pkgDir}\\*' -DestinationPath '${zipPath}' -Force`
    ],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-r", zipPath, "."], { cwd: pkgDir, stdio: "inherit" });
}

console.log("\n✓ 配布物を作成しました:");
console.log("  - フォルダ: " + pkgDir + "  （このフォルダを読み込んでもOK）");
console.log("  - zip    : " + zipPath + "  （他人にはこれを渡す）");
