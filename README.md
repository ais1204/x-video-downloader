# X Video Downloader

**日本語** | [English](#english)

X(旧Twitter)のPCブラウザ版で、ツイートの動画・GIFをワンクリック保存する Chrome 拡張機能（Manifest V3）。

## 機能

- **ワンクリック保存** … 動画左上の `⬇` ボタンで最高画質MP4を即保存
- **本物のGIFで保存** … X の「GIF」は実体がMP4。これをブラウザ内で `.gif` に変換して保存（進捗%表示つき）
- **画質セレクタ** … `▾` ボタンで、取得できた全解像度のMP4／GIFを選択
- **トースト通知** … 保存開始・変換進捗・エラーを画面右下に表示
- **設定ページ** … GIFのfps・最大幅・最大秒数、GIF既定ON/OFF、ファイル名テンプレート

## インストール（使うだけの人向け）

ビルドは不要です。

1. [**Releases**](../../releases/latest) から `x-video-downloader.zip` をダウンロード
2. zip を解凍
3. Chrome（Edge等のChromium系）で `chrome://extensions` を開く
4. 右上の「**デベロッパー モード**」をオン
5. 「**パッケージ化されていない拡張機能を読み込む**」→ 解凍したフォルダを選択

> 開発者として中身を改造したい人は、下の「開発（ビルド）」を参照してください。

## しくみ

X は動画URLをDOMに直接出さない（HLSや可変ビットレート配信のため）ので、
ページが呼び出す GraphQL API のレスポンスを横取りして、ツイートIDごとに
全MP4変種（解像度別）とメディア種別を取得します。

GIF変換は「MP4本体をフレーム単位で `<canvas>` に描画 → `gifenc` で `.gif` 化」します。
twimgはCORSで content script から直接取得できないため、MP4本体の取得は
host_permissions を持つ service worker 側で行い、base64で content へ渡します
（blob URL経由なので canvas が汚染されず画素を読み出せる）。

### ファイル構成（TypeScript）

ソースは TypeScript (`*.ts`)。`tsc` で同名の `*.js` に**同じ場所へ**コンパイルされ、
manifest はその `*.js` を読み込みます（`*.js` はビルド成果物で `.gitignore` 済み）。

- `inject.ts` … ページ本体(MAIN world)で `fetch`/`XHR` をフックし全変種を抽出
- `content.ts` … DLボタン/画質メニュー、GIF変換、トースト、保存処理
- `background.ts` … `chrome.downloads` 保存／GIF用MP4のバイト取得
- `options.ts` … 設定ページのロジック
- `types.d.ts` … 全 `.ts` 共有の型（メッセージ・設定・gifenc など、ambient宣言）
- `vendor/gifenc.js` … MP4→GIF変換に使うGIFエンコーダ（MIT, mattdesl/gifenc を同梱。型は `types.d.ts`）
- `options.html` / `styles.css` … 設定ページのUI / 見た目
- `tsconfig.json` / `package.json` … TypeScript 設定・依存

## 開発（ビルド）

```sh
npm install        # typescript, @types/chrome を導入
npm run build      # *.ts -> *.js にコンパイル（型エラー時は出力しない）
npm run watch      # 変更を監視して自動コンパイル
npm run typecheck  # 出力せず型チェックのみ
```

`strict` 有効・`noEmitOnError` 有効なので、型エラーがあると `.js` は生成されません。

## 配布（他の人に渡す）

**使うだけの人はビルド不要**です。Chrome の実行に必要なのはコンパイル済み `.js` と
静的ファイルだけで、`*.ts` / `node_modules` / `tsconfig.json` は不要です。

```sh
npm run package
```

で `dist/` に次の2つが生成されます:

- `dist/x-video-downloader/` … そのまま「パッケージ化されていない拡張機能を読み込む」で読める展開済みフォルダ
- `dist/x-video-downloader.zip` … 他人に渡す用。受け取った人は**解凍して読み込むだけ**（ビルド不要）

> Chrome ウェブストアで公開する場合も、この zip をそのままアップロードできます
> （アイコン未設定なので、公開時は 128px などの PNG を追加すると良いです）。

## インストール（未署名 / 開発者モード）

1. **先に `npm install && npm run build` を実行**（`*.js` を生成）
2. Chrome（またはEdge等のChromium系）で `chrome://extensions` を開く
3. 右上の「**デベロッパー モード**」をオン
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
5. この `x-video-downloader` フォルダを選択
6. x.com を開き、動画にカーソルを合わせると左上に `⬇` `▾` ボタンが出ます

設定は `chrome://extensions` の本拡張「詳細」→「拡張機能のオプション」から開けます。

> URLがまだ取れていない場合は、動画を一度再生するかページを再読み込みしてください。

## 使い方

- `⬇`（クリック） … 既定の保存。GIFツイートは `.gif`、通常動画は最高画質MP4
- `▾`（クリック） … 解像度・形式（GIF / 各MP4）を選んで保存

## 制限事項

- HLS(m3u8)のみで配信される一部動画は単一ファイルで保存できません（MP4変種がある動画・GIFは保存可）。
- GIF変換は端末内処理のため、長尺・高fps・大サイズだと時間とファイル容量が増えます（設定で調整可）。
- X の DOM 構造や API 仕様変更で動かなくなる可能性があります。
- 取得した動画には著作権があります。**私的利用の範囲**で、権利者の許諾なく再配布しないでください。

## アイコンについて

`manifest.json` ではアイコンを省略しています（Chromeが既定アイコンを使用）。
独自アイコンを付けたい場合は 16/48/128px の PNG を用意し、`manifest.json` に
`"icons": { "16": "...", "48": "...", "128": "..." }` を追加してください。

---

# English

[日本語](#x-video-downloader) | **English**

A Chrome extension (Manifest V3) that saves videos and GIFs from tweets with one click on the desktop browser version of X (formerly Twitter).

## Features

- **One-click save** … Hit the `⬇` button in the top-left of a video to instantly save the highest-quality MP4
- **Save as a real GIF** … X's "GIF" is actually an MP4. This converts it to an actual `.gif` in the browser and saves it (with a progress % indicator)
- **Quality selector** … The `▾` button lets you pick from every resolution MP4 / GIF that was captured
- **Toast notifications** … Save start, conversion progress, and errors are shown in the bottom-right of the screen
- **Options page** … GIF fps / max width / max duration, GIF-by-default ON/OFF, filename template

## Install (for users who just want to use it)

No build required.

1. Download `x-video-downloader.zip` from [**Releases**](../../releases/latest)
2. Unzip it
3. Open `chrome://extensions` in Chrome (or a Chromium-based browser like Edge)
4. Turn on "**Developer mode**" in the top-right
5. Click "**Load unpacked**" → select the unzipped folder

> If you're a developer who wants to modify the internals, see "Development (build)" below.

## How it works

X doesn't expose video URLs directly in the DOM (because of HLS / variable-bitrate delivery), so the extension intercepts the responses of the GraphQL API the page calls, and obtains every MP4 variant (per resolution) and the media type for each tweet ID.

GIF conversion works by "drawing the MP4 frame-by-frame onto a `<canvas>` → encoding it to `.gif` with `gifenc`". Because twimg can't be fetched directly from a content script due to CORS, the MP4 itself is fetched on the service worker side (which holds `host_permissions`) and passed to the content as base64 (via a blob URL, so the canvas isn't tainted and pixels can be read).

### File layout (TypeScript)

The source is TypeScript (`*.ts`). It's compiled by `tsc` into `*.js` of the same name **in the same place**, and the manifest loads those `*.js` files (the `*.js` are build artifacts and are `.gitignore`d).

- `inject.ts` … Hooks `fetch`/`XHR` in the page's MAIN world and extracts all variants
- `content.ts` … DL button / quality menu, GIF conversion, toasts, save handling
- `background.ts` … `chrome.downloads` saving / fetching MP4 bytes for GIFs
- `options.ts` … Options page logic
- `types.d.ts` … Types shared by all `.ts` (messages, settings, gifenc, etc., ambient declarations)
- `vendor/gifenc.js` … The GIF encoder used for MP4→GIF conversion (MIT, mattdesl/gifenc, bundled. Types are in `types.d.ts`)
- `options.html` / `styles.css` … Options page UI / styling
- `tsconfig.json` / `package.json` … TypeScript config / dependencies

## Development (build)

```sh
npm install        # installs typescript, @types/chrome
npm run build      # compiles *.ts -> *.js (won't emit on type errors)
npm run watch      # watches for changes and auto-compiles
npm run typecheck  # type-checks only, no output
```

`strict` and `noEmitOnError` are enabled, so if there are type errors no `.js` is generated.

## Distribution (handing it to others)

**Users who just want to use it don't need to build.** All Chrome needs to run is the compiled `.js` plus the static files — `*.ts` / `node_modules` / `tsconfig.json` are not needed.

```sh
npm run package
```

generates the following two under `dist/`:

- `dist/x-video-downloader/` … An already-expanded folder you can load directly with "Load unpacked"
- `dist/x-video-downloader.zip` … For handing to others. The recipient just **unzips and loads it** (no build required)

> If you publish on the Chrome Web Store, you can upload this zip as-is
> (no icon is set, so it's a good idea to add a 128px or similar PNG when publishing).

## Install (unsigned / developer mode)

1. **Run `npm install && npm run build` first** (to generate the `*.js`)
2. Open `chrome://extensions` in Chrome (or a Chromium-based browser like Edge)
3. Turn on "**Developer mode**" in the top-right
4. Click "**Load unpacked**"
5. Select this `x-video-downloader` folder
6. Open x.com and hover over a video — the `⬇` `▾` buttons appear in the top-left

Settings can be opened from the extension's "Details" → "Extension options" in `chrome://extensions`.

> If the URL hasn't been captured yet, play the video once or reload the page.

## Usage

- `⬇` (click) … Default save. GIF tweets save as `.gif`, regular videos as the highest-quality MP4
- `▾` (click) … Pick a resolution / format (GIF / each MP4) and save

## Limitations

- Some videos delivered only via HLS (m3u8) can't be saved as a single file (videos with MP4 variants, and GIFs, can be saved).
- GIF conversion is done on-device, so long / high-fps / large videos take more time and produce larger files (adjustable in settings).
- Changes to X's DOM structure or API spec may break it.
- Downloaded videos are copyrighted. Use them **within the scope of private use**, and do not redistribute without the rights holder's permission.

## About the icon

`manifest.json` omits the icon (Chrome uses a default icon). If you want your own icon, prepare 16/48/128px PNGs and add `"icons": { "16": "...", "48": "...", "128": "..." }` to `manifest.json`.
