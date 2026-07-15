# Chrome Web Store 申請メモ — X Video Downloader

限定公開（**Unlisted**）でのストア申請用。レビュー担当者向けの欄は英語で記載
（Chrome Web Store のレビューは英語が基本のため、英語の方が誤読が減る）。
ユーザー向けの掲載文は日本語。

---

## 0. 公開範囲（Visibility）

ダッシュボードの **Distribution → Visibility** で **Unlisted（限定公開）** を選択。

- **Unlisted（限定公開）** … リンクを知っている人だけインストール可。検索・カテゴリ非表示。
- Private（非公開）… 指定したテスター/Workspace グループのみ。社内配布向け。
- ⚠️ Unlisted でも**通常と同じ審査**を通過する必要があります（審査が緩くなるわけではない）。

---

## 1. レビュー担当者向け（英語・そのまま貼り付け可）

### Single purpose
This extension has a single purpose: to let the user save the video or GIF from
an X (formerly Twitter) post they are currently viewing, as a local file.

### Permission justifications

**`downloads`**
Used to save the user-selected video/GIF to the local Downloads folder via
`chrome.downloads.download`. This is the core action of the extension.

**`storage`**
Used to persist the user's own preferences (default GIF on/off, GIF fps, max
width, max duration, filename template) via `chrome.storage.sync`. No personal
or browsing data is stored.

**Host permission — `https://x.com/*`, `https://twitter.com/*`**
Required to (a) inject the download button next to videos on the page the user
is viewing, and (b) read, in memory only, the video metadata contained in the X
API responses that the page itself already fetches. The extension does not
modify these requests/responses and does not send them anywhere.

**Host permission — `https://*.twimg.com/*`**
X serves the actual media files (MP4/GIF source) from these hosts. This
permission is required to download the file the user selected, and — for GIF
conversion — to read the MP4 bytes so they can be re-encoded to a real `.gif`
locally in the browser.

### Are you using remote code?
**No.** All code is bundled in the package. The GIF encoder
(`vendor/gifenc.js`, MIT-licensed) is included locally. There is no `eval`, no
remotely hosted script, and no remote configuration.

### Data usage (disclosure tab)
- The extension does **not** collect, transmit, or sell any user data.
- All processing (API-response reading, downloading, GIF conversion) happens
  locally in the user's browser.
- Certify all three statements:
  - I do **not** sell or transfer user data to third parties outside approved use cases.
  - I do **not** use or transfer user data for purposes unrelated to the single purpose.
  - I do **not** use or transfer user data to determine creditworthiness or for lending.
- Privacy policy URL: _(host PRIVACY.md and paste the URL here)_

### How the network interception works (in case the reviewer asks)
The extension installs a content script in the MAIN world that wraps
`window.fetch` and `XMLHttpRequest` **read-only**: it `clone()`s responses of
X's own GraphQL/API calls to extract the list of MP4 variants for a post. It
never alters the request, the response delivered to the page, or any headers,
and it never forwards the data off-device.

### Testing instructions for the reviewer
1. Install the extension.
2. Open `https://x.com` and sign in (a normal account is fine).
3. Open any post that contains a video or a GIF.
4. A `⬇` button appears at the top-left of the video. Click it → the video is
   saved to Downloads. Click the `▾` button to pick a resolution or to save a
   GIF as a real `.gif`.
5. Right-click the extension → Options to see the settings page.

---

## 2. ストア掲載文（日本語・ユーザー向け）

### 名称 (Name)
X Video Downloader

### 概要 / Summary（132 文字以内）
X（旧Twitter）の動画・GIFをワンクリックで保存。GIFは本物の.gifに変換でき、画質も選べます。データ収集なし・完全ローカル動作。

### 説明 (Description)
X（旧Twitter）のPCブラウザ版で、投稿の動画・GIFをワンクリック保存できる拡張機能です。

■ 主な機能
・ワンクリック保存 … 動画左上の「⬇」ボタンで最高画質のMP4を即保存
・本物のGIFで保存 … Xの「GIF」は実体がMP4。ブラウザ内で本物の .gif に変換（進捗％表示つき）
・画質セレクタ … 「▾」ボタンで取得できた全解像度のMP4／GIFを選択
・トースト通知 … 保存開始・変換進捗・エラーを画面右下に表示
・設定ページ … GIFのfps・最大幅・最大秒数、GIF既定ON/OFF、ファイル名テンプレート

■ プライバシー
・データ収集・送信・解析は一切なし。すべての処理は端末内で完結します。
・通信先はメディア再生のためにブラウザが元々アクセスするX（twimg.com）のみ。

■ 利用上の注意
・本拡張機能は、ご自身が権利を持つメディア、または権利者から保存を許可されたメディアを、個人的な利用（バックアップ・オフライン視聴・教育/研究目的での参照など）の範囲で保存するためのツールです。
・第三者の著作物を、権利者の許可なく保存・再配布する用途では使用しないでください。Xの利用規約および各国の著作権法を遵守してご利用ください。
・PCブラウザ版のX/Twitterのレイアウトに対応しています。

### カテゴリ (Category)
Productivity（または Tools / Utilities）

### 言語 (Default language)
日本語

---

## 3. 申請に必要なアセット（チェックリスト）

| 区分 | 項目 | 仕様 | 状態 |
|---|---|---|---|
| 必須 | デベロッパー登録 | $5（1回のみ）・連絡先メール確認 | ⬜ |
| 必須 | 拡張機能 ZIP | MV3・`npm run build` 後に `npm run package` で生成 | ✅ dist/x-video-downloader.zip |
| 必須 | ストアアイコン | 128×128 PNG（ダッシュボードで別途アップロード） | ✅ icons/icon128.png を流用可（要差し替え検討） |
| 必須 | スクリーンショット | 1280×800 または 640×400、1枚以上（最大5枚） | ⚠️ 未作成 |
| 必須 | 概要・説明文 | 上記セクション2 | ✅ 本書 |
| 必須 | プライバシーポリシーURL | PRIVACY.md をホストしたURL | ⚠️ 要ホスト |
| 推奨 | manifest 内アイコン | 16/32/48/128 PNG（`icons` キー） | ✅ 設定済み |
| 推奨 | 小プロモタイル | 440×280 PNG | ⬜ 任意 |

> アイコンは `node scripts/gen-icons.mjs` で再生成可能（X ブルーの角丸＋白いDL矢印の
> プレースホルダー）。デザインを変えたい場合は同スクリプトの色・矢印形状を編集するか、
> `icons/` 内の PNG を手持ちの画像に差し替えてください。

---

## 4. 申請手順（Unlisted）

1. `npm run build` → `npm run package` で `dist/x-video-downloader.zip` を更新。
   （事前に manifest へ `icons` を追加し、`icons/` を package スクリプトの
   `runtimeDirs` に含めること）
2. PRIVACY.md を GitHub Pages 等で公開し、URLを控える。
3. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) に登録（$5）。
4. 「新しいアイテム」→ ZIP をアップロード。
5. **Store listing**：名称・概要・説明・カテゴリ・言語・スクリーンショット・128px アイコンを入力。
6. **Privacy practices**：Single purpose / 各権限の justification（セクション1）/ データ開示 / プライバシーポリシーURL を入力。
7. **Distribution**：Visibility を **Unlisted** に設定。
8. 「審査のために送信」。審査は通常数時間〜数日。

> ⚠️ メディアダウンローダーは審査が厳しめのカテゴリです（特に YouTube からの
> ダウンロードはポリシー違反）。単一目的を明確に保ち、権利者が許可した
> コンテンツの保存用途であることを掲載文・ポリシーで示しておくと安全です。
