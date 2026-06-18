# X Video Downloader

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
