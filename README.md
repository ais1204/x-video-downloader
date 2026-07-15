# X Video Downloader

**日本語** | [English](#english)

X(旧Twitter)・Pixivのブラウザ版で、投稿の動画・GIF・画像をワンクリック保存する Chrome 拡張機能（Manifest V3）。

## 機能

### X (旧Twitter)

- **ワンクリック保存** … 動画左上の `⬇` ボタンで最高画質MP4を即保存
- **本物のGIFで保存** … X の「GIF」は実体がMP4。これをブラウザ内で `.gif` に変換して保存（進捗%表示つき）
- **画質セレクタ** … `▾` ボタンで、取得できた全解像度のMP4／GIFを選択
- **広告(プロモ)動画にも対応** … `/status/` リンクが無い広告ツイートでも、メディアIDでの照合により保存可能
- **画像の原寸保存** … 投稿画像に `⬇` ボタンを重ね、`name=orig` の原寸URLで保存

### Pixiv

- **原寸画像の保存** … 作品ページ・サムネイルに `⬇` ボタンを重ね、`ajax/illust/<id>/pages` API から取得した正確な原寸URLで保存
- **R-18マスクサムネにも対応** … サムネがR-18マスク画像でも、作品リンクからIDを解決して保存可能
- **モバイル(touch)版レイアウトにも対応** … 本体画像がプレースホルダーのままでも、表示順とAPIのページ数を突き合わせて保存
- **R-18を別フォルダに振り分け** … `xRestrict`（全年齢/R-18/R-18G）を判定し、設定で別サブフォルダに自動保存

### 共通

- **保存先サブフォルダの指定** … ダウンロードフォルダ配下に、フォルダ選択ダイアログ無しでサブフォルダを指定可能（例 `x` や `media/x`）
- **トースト通知** … 保存開始・変換進捗・エラーを画面右下に表示
- **設定ページ** … GIFのfps・最大幅・最大秒数、GIF既定ON/OFF、ファイル名テンプレート、保存先サブフォルダ、Pixiv R-18振り分け

## インストール（使うだけの人向け）

ビルドは不要です。

1. [**Releases**](../../releases/latest) から `x-video-downloader.zip` をダウンロード
2. zip を解凍
3. Chrome（Edge等のChromium系）で `chrome://extensions` を開く
4. 右上の「**デベロッパー モード**」をオン
5. 「**パッケージ化されていない拡張機能を読み込む**」→ 解凍したフォルダを選択

> 開発者として中身を改造したい人は、下の「開発（ビルド）」を参照してください。

## しくみ

### X (旧Twitter)

X は動画URLをDOMに直接出さない（HLSや可変ビットレート配信のため）ので、
ページが呼び出す GraphQL API のレスポンスを横取りして、ツイートIDごとに
全MP4変種（解像度別）とメディア種別を取得します。広告ツイートなど `/status/`
リンクが無くツイートIDで照合できない場合は、mp4/サムネURLに共通する
メディアIDでフォールバック照合します。

GIF変換は「MP4本体をフレーム単位で `<canvas>` に描画 → `gifenc` で `.gif` 化」します。
twimgはCORSで content script から直接取得できないため、MP4本体の取得は
host_permissions を持つ service worker 側で行い、base64で content へ渡します
（blob URL経由なので canvas が汚染されず画素を読み出せる）。

画像は表示中のサムネURLから `?format=…&name=orig` の原寸URLを組み立てて保存します。

### Pixiv

`i.pximg.net` は Referer 必須のため、`declarativeNetRequest`（`rules.json`）で
`i.pximg.net` へのリクエストに `Referer: https://www.pixiv.net/` を自動付与します。
画像取得自体は host_permissions を持つ service worker 側で行い（CORS回避・Referer確実適用）、
base64にして content へ渡し、データURLとして保存します。

原寸URL・年齢制限（`xRestrict`）は、いずれも同一オリジンの `ajax/illust/<id>` 系
APIから取得します（表示URLの拡張子は当てにしない）。

### 保存先サブフォルダ

`chrome.downloads.download()` の `filename` にサブパス（例 `x/foo.mp4`）を渡すと、
Chrome がダウンロードフォルダ配下にサブフォルダを自動作成して保存します。
**ダウンロードフォルダの外への保存は Chrome の仕様上できません**（ダイアログ無しでは不可能）。

### ファイル構成（TypeScript）

ソースは TypeScript (`*.ts`)。`tsc` で同名の `*.js` に**同じ場所へ**コンパイルされ、
manifest はその `*.js` を読み込みます（`*.js` はビルド成果物で `.gitignore` 済み）。

- `inject.ts` … ページ本体(MAIN world, X用)で `fetch`/`XHR` をフックし全変種・メディアIDを抽出
- `content.ts` … X用。DLボタン/画質メニュー、GIF変換、画像原寸保存、トースト、保存処理
- `pixiv.ts` … Pixiv用。原寸URL/年齢制限の取得、DLボタン付与、保存処理
- `background.ts` … `chrome.downloads` 保存／MP4・Pixiv画像バイト取得（CORS回避）
- `options.ts` … 設定ページのロジック
- `types.d.ts` … 全 `.ts` 共有の型（メッセージ・設定・gifenc など、ambient宣言）
- `vendor/gifenc.js` … MP4→GIF変換に使うGIFエンコーダ（MIT, mattdesl/gifenc を同梱。型は `types.d.ts`）
- `rules.json` … `declarativeNetRequest` ルール（i.pximg.net への Referer 付与）
- `options.html` / `styles.css` … 設定ページのUI / 見た目
- `icons/`, `scripts/gen-icons.mjs` … 拡張機能アイコン（生成スクリプト同梱）
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

## インストール（未署名 / 開発者モード）

1. **先に `npm install && npm run build` を実行**（`*.js` を生成）
2. Chrome（またはEdge等のChromium系）で `chrome://extensions` を開く
3. 右上の「**デベロッパー モード**」をオン
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
5. この `x-video-downloader` フォルダを選択
6. x.com を開き、動画にカーソルを合わせると左上に `⬇` `▾` ボタンが出ます

設定は `chrome://extensions` の本拡張「詳細」→「拡張機能のオプション」、または
ツールバーのアイコンをクリックして開けます。

> URLがまだ取れていない場合は、動画を一度再生するかページを再読み込みしてください。

## 使い方

### X (旧Twitter)

- `⬇`（動画, クリック） … 既定の保存。GIFツイートは `.gif`、通常動画は最高画質MP4
- `▾`（動画, クリック） … 解像度・形式（GIF / 各MP4）を選んで保存
- `⬇`（画像, クリック） … 原寸大で保存

### Pixiv

- 作品ページ・サムネイルの `⬇` … 原寸大で保存（サムネは表紙ページ）

### 設定

- **保存先サブフォルダ** … ダウンロードフォルダ配下のサブフォルダ名（空で直下）
- **R-18を別フォルダに分ける**（Pixiv） … ON にすると全年齢/R-18で保存先を自動振り分け

## 制限事項

- HLS(m3u8)のみで配信される一部動画は単一ファイルで保存できません（MP4変種がある動画・GIFは保存可）。
- GIF変換は端末内処理のため、長尺・高fps・大サイズだと時間とファイル容量が増えます（設定で調整可）。
- Pixivの「うごくイラスト」（ugoira）は非対応です（原寸がzip形式のため）。
- ダウンロードフォルダの**外**への保存はできません（Chromeの仕様上の制約）。
- X・Pixiv の DOM 構造や API 仕様変更で動かなくなる可能性があります。
- 取得したメディアには著作権があります。**ご自身が権利を持つ、または保存が許可されたメディア**を、
  個人的な利用（バックアップ・オフライン視聴・教育/研究目的での参照など）の範囲でご利用ください。
  第三者の著作物を権利者の許可なく保存・再配布しないでください。

## アイコンについて

`icons/` に同梱の PNG（16/32/48/128px）を使用しています。差し替えたい場合は同じ
ファイル名で置き換えるか、`node scripts/gen-icons.mjs` を編集して再生成してください。

---

# English

[日本語](#x-video-downloader) | **English**

A Chrome extension (Manifest V3) that saves videos, GIFs, and images from posts with one click on the desktop browser versions of X (formerly Twitter) and Pixiv.

## Features

### X (formerly Twitter)

- **One-click save** … Hit the `⬇` button in the top-left of a video to instantly save the highest-quality MP4
- **Save as a real GIF** … X's "GIF" is actually an MP4. This converts it to an actual `.gif` in the browser and saves it (with a progress % indicator)
- **Quality selector** … The `▾` button lets you pick from every resolution MP4 / GIF that was captured
- **Works on promoted/ad videos** … Falls back to matching by media ID when a promoted tweet has no `/status/` link to match on
- **Save images at full resolution** … A `⬇` button is overlaid on post images and saves them using the `name=orig` full-resolution URL

### Pixiv

- **Save images at full resolution** … A `⬇` button is overlaid on artwork pages and thumbnails, using the exact original URL fetched from the `ajax/illust/<id>/pages` API
- **Works on masked R-18 thumbnails** … Even when the thumbnail shows an R-18 mask image, the artwork ID is resolved from the surrounding link
- **Works on the mobile (touch) layout** … Even when the main image element is a placeholder, it matches candidates by display order against the API's page count
- **Separate R-18 into its own folder** … Detects `xRestrict` (all-ages / R-18 / R-18G) and can auto-route saves into a separate subfolder

### Common

- **Configurable save subfolder** … Specify a subfolder under the Downloads folder, with no folder-picker dialog (e.g. `x` or `media/x`)
- **Toast notifications** … Save start, conversion progress, and errors are shown in the bottom-right of the screen
- **Options page** … GIF fps / max width / max duration, GIF-by-default ON/OFF, filename template, save subfolder, Pixiv R-18 routing

## Install (for users who just want to use it)

No build required.

1. Download `x-video-downloader.zip` from [**Releases**](../../releases/latest)
2. Unzip it
3. Open `chrome://extensions` in Chrome (or a Chromium-based browser like Edge)
4. Turn on "**Developer mode**" in the top-right
5. Click "**Load unpacked**" → select the unzipped folder

> If you're a developer who wants to modify the internals, see "Development (build)" below.

## How it works

### X (formerly Twitter)

X doesn't expose video URLs directly in the DOM (because of HLS / variable-bitrate delivery), so the extension intercepts the responses of the GraphQL API the page calls, and obtains every MP4 variant (per resolution) and the media type for each tweet ID. For promoted tweets that have no `/status/` link to resolve a tweet ID from, it falls back to matching by a media ID shared between the MP4 and thumbnail URLs.

GIF conversion works by "drawing the MP4 frame-by-frame onto a `<canvas>` → encoding it to `.gif` with `gifenc`". Because twimg can't be fetched directly from a content script due to CORS, the MP4 itself is fetched on the service worker side (which holds `host_permissions`) and passed to the content as base64 (via a blob URL, so the canvas isn't tainted and pixels can be read).

Images are saved by rewriting the currently-displayed thumbnail URL into its `?format=…&name=orig` full-resolution form.

### Pixiv

`i.pximg.net` requires a `Referer` header, so a `declarativeNetRequest` rule (`rules.json`) automatically sets `Referer: https://www.pixiv.net/` on requests to `i.pximg.net`. The image fetch itself happens on the service worker side (which holds `host_permissions`, avoiding CORS and guaranteeing the Referer is applied), is base64-encoded, passed to the content script, and saved as a data URL.

Both the original-resolution URL and the age rating (`xRestrict`) are fetched from the same-origin `ajax/illust/<id>` API family (the displayed URL's extension is never trusted).

### Save subfolder

Passing a subpath (e.g. `x/foo.mp4`) in the `filename` argument to `chrome.downloads.download()` makes Chrome auto-create a subfolder under the Downloads folder. **Saving outside the Downloads folder is not possible** — Chrome disallows it without a picker dialog.

### File layout (TypeScript)

The source is TypeScript (`*.ts`). It's compiled by `tsc` into `*.js` of the same name **in the same place**, and the manifest loads those `*.js` files (the `*.js` are build artifacts and are `.gitignore`d).

- `inject.ts` … Hooks `fetch`/`XHR` in the page's MAIN world (X) and extracts all variants and media IDs
- `content.ts` … For X. DL button / quality menu, GIF conversion, full-resolution image saving, toasts, save handling
- `pixiv.ts` … For Pixiv. Fetches original-resolution URLs / age rating, attaches DL buttons, handles saving
- `background.ts` … `chrome.downloads` saving / fetching MP4 and Pixiv image bytes (CORS bypass)
- `options.ts` … Options page logic
- `types.d.ts` … Types shared by all `.ts` (messages, settings, gifenc, etc., ambient declarations)
- `vendor/gifenc.js` … The GIF encoder used for MP4→GIF conversion (MIT, mattdesl/gifenc, bundled. Types are in `types.d.ts`)
- `rules.json` … `declarativeNetRequest` rule (applies Referer to i.pximg.net)
- `options.html` / `styles.css` … Options page UI / styling
- `icons/`, `scripts/gen-icons.mjs` … Extension icons (generator script included)
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

## Install (unsigned / developer mode)

1. **Run `npm install && npm run build` first** (to generate the `*.js`)
2. Open `chrome://extensions` in Chrome (or a Chromium-based browser like Edge)
3. Turn on "**Developer mode**" in the top-right
4. Click "**Load unpacked**"
5. Select this `x-video-downloader` folder
6. Open x.com and hover over a video — the `⬇` `▾` buttons appear in the top-left

Settings can be opened from the extension's "Details" → "Extension options" in `chrome://extensions`, or by clicking the toolbar icon.

> If the URL hasn't been captured yet, play the video once or reload the page.

## Usage

### X (formerly Twitter)

- `⬇` (video, click) … Default save. GIF tweets save as `.gif`, regular videos as the highest-quality MP4
- `▾` (video, click) … Pick a resolution / format (GIF / each MP4) and save
- `⬇` (image, click) … Save at full resolution

### Pixiv

- `⬇` on an artwork page or thumbnail … Save at full resolution (thumbnails save the cover page)

### Settings

- **Save subfolder** … Subfolder name under the Downloads folder (empty = save directly in Downloads)
- **Separate R-18 into its own folder** (Pixiv) … When enabled, auto-routes all-ages vs. R-18 saves into different subfolders

## Limitations

- Some videos delivered only via HLS (m3u8) can't be saved as a single file (videos with MP4 variants, and GIFs, can be saved).
- GIF conversion is done on-device, so long / high-fps / large videos take more time and produce larger files (adjustable in settings).
- Pixiv "ugoira" (animated illustrations) are not supported (the original file is a zip archive).
- Saving **outside** the Downloads folder is not possible (a Chrome platform constraint).
- Changes to X's or Pixiv's DOM structure or API spec may break it.
- Downloaded media is copyrighted. Only save media **you own, or have permission from the rights holder to save**, for personal purposes (backup, offline viewing, educational/research reference). Do not save or redistribute third-party copyrighted works without permission.

## About the icon

Bundled PNGs (16/32/48/128px) live in `icons/`. To replace them, either overwrite the same filenames or edit and re-run `node scripts/gen-icons.mjs`.
