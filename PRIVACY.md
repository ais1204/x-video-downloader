# Privacy Policy — X Video Downloader

_Last updated: 2026-06-19_

## English

**X Video Downloader** ("the extension") is a browser extension that lets you
save videos and GIFs from posts you are viewing on x.com / twitter.com.

### What we collect

**Nothing. The extension does not collect, store, transmit, or sell any user
data.** It has no analytics, no tracking, no external servers, and no network
calls to any destination other than X's own media servers (`*.twimg.com`) that
your browser would contact anyway to play the media.

### How it works (and why no data leaves your device)

- To find a post's downloadable MP4, the extension reads the responses of the
  X API calls that the page itself makes (in your browser, in memory only). It
  does **not** modify those requests or responses, and it does **not** send them
  anywhere.
- When you click the download button, the file is fetched from X's media servers
  and saved to your local Downloads folder via the browser's `downloads` API.
- GIF conversion (MP4 → real `.gif`) is performed entirely **on your device**
  using a bundled, local encoder. No upload occurs.
- Your settings (GIF defaults, fps, max width, filename template) are stored
  with `chrome.storage.sync` so Chrome can sync them across your own signed-in
  browsers. These settings contain **no personal information** and are never
  sent to us.

### Permissions

| Permission | Why it is needed |
|---|---|
| `downloads` | To save the video/GIF you choose to your local Downloads folder. |
| `storage` | To remember your own preferences locally. |
| `x.com` / `twitter.com` | To show the download button and read the currently-viewed post's video metadata in memory. |
| `*.twimg.com` | X serves the actual media files from these hosts; required to fetch the file you asked to save. |

### Data sharing

We do not share, sell, or transfer any user data, because we do not collect any.

### Contact

For questions about this policy, contact: `fm9876tm@icloud.com`

---

## 日本語

**X Video Downloader**（本拡張機能）は、x.com / twitter.com で閲覧中の投稿から
動画・GIF を保存するためのブラウザ拡張機能です。

### 収集する情報

**ありません。本拡張機能は、いかなるユーザーデータも収集・保存・送信・販売しません。**
解析（アナリティクス）、トラッキング、外部サーバーは一切なく、メディア再生のために
ブラウザが元々通信する X のメディアサーバー（`*.twimg.com`）以外への通信は行いません。

### しくみ（データが端末外に出ない理由）

- 投稿のダウンロード可能な MP4 を特定するため、ページ自身が呼び出す X API の
  レスポンスを（ブラウザ内・メモリ上でのみ）読み取ります。これらのリクエストや
  レスポンスを**改変することはなく**、**どこにも送信しません**。
- ダウンロードボタンを押すと、ファイルは X のメディアサーバーから取得され、
  ブラウザの `downloads` API でローカルの「ダウンロード」フォルダに保存されます。
- GIF 変換（MP4 →本物の `.gif`）は、同梱のローカルエンコーダを用いて
  **端末内で完結**します。アップロードは発生しません。
- 設定（GIF 既定・fps・最大幅・ファイル名テンプレート）は `chrome.storage.sync`
  に保存され、ご自身のサインイン済みブラウザ間で同期されます。これらの設定に
  **個人情報は含まれず**、開発者へ送信されることはありません。

### データの共有

データを一切収集しないため、共有・販売・第三者提供も行いません。

### 連絡先

本ポリシーに関するお問い合わせ: `fm9876tm@icloud.com`
