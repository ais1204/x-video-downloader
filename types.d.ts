// 共有型（ambient）: import/export を持たないためグローバルに公開され、
// すべての .ts ファイルからインポート無しで参照できる。

/** 動画の1変種（解像度・ビットレート付き） */
interface Variant {
  url: string;
  bitrate: number;
  w: number;
  h: number;
}

/** ツイートに紐づくメディア情報（content側で保持） */
interface MediaInfo {
  mtype: string; // "video" | "animated_gif" など
  variants: Variant[];
  hls: boolean;
}

/** inject.js(MAIN) -> content.js(ISOLATED) の postMessage ペイロード */
interface MediaMessage {
  __xvdl: true;
  kind: "media";
  tweetId: string;
  /** mp4/サムネ両URLに共通で埋まるメディアID。tweetIdが取れない広告等の照合に使う */
  mediaId?: string;
  mtype: string;
  variants: Variant[];
  hls: boolean;
}

/** ユーザー設定（chrome.storage.sync）。
 *  chrome.storage.get の引数（インデックスシグネチャ）に渡すため interface ではなく type で定義。 */
type XvdlSettings = {
  gifDefault: boolean;
  fps: number;
  maxWidth: number;
  maxSeconds: number;
  filename: string;
  /** ダウンロードフォルダ配下の保存先サブフォルダ（空=直下）。全保存に適用 */
  subfolder: string;
  /** PixivをR-18と全年齢で別サブフォルダに分けて保存する */
  pixivSeparateR18: boolean;
  /** Pixiv全年齢の保存先サブフォルダ名 */
  pixivFolderAll: string;
  /** PixivR-18/R-18Gの保存先サブフォルダ名 */
  pixivFolderR18: string;
};

/** content -> background のメッセージ */
interface DownloadMessage {
  action: "download";
  url: string;
  filename: string;
}
interface FetchBytesMessage {
  action: "fetchBytes";
  url: string;
}
type XvdlMessage = DownloadMessage | FetchBytesMessage;

/** background -> content の応答 */
interface DownloadResponse {
  ok: boolean;
  downloadId?: number;
  error?: string;
}
interface FetchBytesResponse {
  ok: boolean;
  b64?: string;
  error?: string;
}

// ---- vendor/gifenc.js の型 ----
type GifPalette = number[][];

interface GifEncoderInstance {
  writeFrame(
    index: Uint8Array,
    width: number,
    height: number,
    opts: { palette: GifPalette; delay: number }
  ): void;
  finish(): void;
  bytes(): Uint8Array<ArrayBuffer>;
}

interface GifencModule {
  GIFEncoder(): GifEncoderInstance;
  quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): GifPalette;
  applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette
  ): Uint8Array;
}

// gifenc は content script として読み込まれ window.gifenc に公開される
interface Window {
  gifenc?: GifencModule;
}
