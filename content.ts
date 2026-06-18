// ISOLATED world script.
// inject.js から流れてくる動画情報を受け取り、動画にDLボタン＋画質メニューを重ねる。
// GIFメディアは MP4 -> 実GIF へ変換して保存する。

(function () {
  "use strict";

  // ---------- 設定 ----------
  const DEFAULTS: XvdlSettings = {
    gifDefault: true, // GIFメディアのワンクリック既定をGIFにする
    fps: 15,
    maxWidth: 480,
    maxSeconds: 0, // 0 = 全長
    filename: "{user}_{id}"
  };
  let settings: XvdlSettings = Object.assign({}, DEFAULTS);
  try {
    chrome.storage.sync.get(DEFAULTS, (s) => {
      if (s) settings = Object.assign({}, DEFAULTS, s);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const k in changes) {
        (settings as Record<string, unknown>)[k] = changes[k].newValue;
      }
    });
  } catch (e) {
    /* storage 不可でもデフォルトで動く */
  }

  // ---------- データ受信 ----------
  // tweetId -> MediaInfo
  const mediaMap = new Map<string, MediaInfo>();

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as Partial<MediaMessage> | null;
    if (!d || d.__xvdl !== true || d.kind !== "media" || !d.tweetId) return;
    const variants = d.variants || [];
    const prev = mediaMap.get(d.tweetId);
    // 変種が多い方を採用（後続レスポンスが空でも上書きしない）
    if (!prev || variants.length >= prev.variants.length) {
      mediaMap.set(d.tweetId, {
        mtype: d.mtype || "video",
        variants,
        hls: !!d.hls
      });
    }
  });

  // ---------- メッセージ ----------
  function send<T>(msg: XvdlMessage): Promise<T> {
    return new Promise<T>((resolve) => {
      chrome.runtime.sendMessage(msg, (resp: T) => resolve(resp));
    });
  }

  // ---------- DOM ヘルパ ----------
  function getTweetId(el: Element): string | null {
    const article = el.closest("article");
    const scope: ParentNode = article || document;
    const links = scope.querySelectorAll('a[href*="/status/"]');
    for (const a of Array.from(links)) {
      const m = (a.getAttribute("href") || "").match(/\/status\/(\d+)/);
      if (m) return m[1];
    }
    const um = location.pathname.match(/\/status\/(\d+)/);
    return um ? um[1] : null;
  }

  function getScreenName(el: Element): string {
    const article = el.closest("article");
    const scope: ParentNode = article || document;
    const a = scope.querySelector('a[href*="/status/"]');
    if (a) {
      const m = (a.getAttribute("href") || "").match(/^\/([^/]+)\/status\//);
      if (m) return m[1];
    }
    return "x";
  }

  interface ResolvedMedia {
    tweetId: string | null;
    user: string;
    info: MediaInfo | null;
  }
  function getMedia(video: Element): ResolvedMedia {
    const tweetId = getTweetId(video);
    return {
      tweetId,
      user: getScreenName(video),
      info: tweetId ? mediaMap.get(tweetId) || null : null
    };
  }

  function makeName(user: string, tweetId: string | null, ext: string): string {
    const tmpl = settings.filename || "{user}_{id}";
    const now = new Date();
    const date =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    let name = tmpl
      .replace(/\{user\}/g, user || "x")
      .replace(/\{id\}/g, tweetId || String(Date.now()))
      .replace(/\{date\}/g, date);
    name = name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
    if (!name) name = "x_" + (tweetId || Date.now());
    return name + "." + ext;
  }

  // ---------- トースト ----------
  let toastBox: HTMLElement | null = null;
  function ensureToastBox(): HTMLElement {
    if (toastBox && document.body.contains(toastBox)) return toastBox;
    toastBox = document.createElement("div");
    toastBox.className = "xvdl-toasts";
    document.body.appendChild(toastBox);
    return toastBox;
  }
  function toast(text: string, isError?: boolean): HTMLElement {
    const box = ensureToastBox();
    const t = document.createElement("div");
    t.className = "xvdl-toast" + (isError ? " err" : "");
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add("hide");
      setTimeout(() => t.remove(), 300);
    }, 2600);
    return t;
  }

  interface ProgressToast {
    update(txt: string): void;
    done(txt: string, isError?: boolean): void;
  }
  function progressToast(text: string): ProgressToast {
    const box = ensureToastBox();
    const t = document.createElement("div");
    t.className = "xvdl-toast progress";
    t.textContent = text;
    box.appendChild(t);
    return {
      update(txt: string): void {
        t.textContent = txt;
      },
      done(txt: string, isError?: boolean): void {
        t.textContent = txt;
        t.className = "xvdl-toast" + (isError ? " err" : "");
        setTimeout(() => {
          t.classList.add("hide");
          setTimeout(() => t.remove(), 300);
        }, 2200);
      }
    };
  }

  // ---------- 保存処理 ----------
  function saveMp4(user: string, tweetId: string | null, variant: Variant): void {
    if (!variant || !variant.url) return;
    void send<DownloadResponse>({
      action: "download",
      url: variant.url,
      filename: makeName(user, tweetId, "mp4")
    });
    toast("ダウンロードを開始しました");
  }

  function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function seek(video: HTMLVideoElement, t: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      const onSeeked = (): void => {
        if (done) return;
        done = true;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = t;
      // 念のためのタイムアウト
      setTimeout(onSeeked, 1500);
    });
  }

  async function convertToGif(
    mp4Url: string,
    opts: XvdlSettings,
    onProgress?: (ratio: number) => void
  ): Promise<Blob> {
    const resp = await send<FetchBytesResponse>({
      action: "fetchBytes",
      url: mp4Url
    });
    if (!resp || !resp.ok || !resp.b64) {
      throw new Error(resp && resp.error ? resp.error : "fetch failed");
    }
    const blob = new Blob([base64ToUint8(resp.b64)], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = url;
      await new Promise<void>((res, rej) => {
        video.addEventListener("loadedmetadata", () => res(), { once: true });
        video.addEventListener("error", () =>
          rej(new Error("動画の読み込みに失敗"))
        );
        setTimeout(() => rej(new Error("動画読み込みタイムアウト")), 15000);
      });

      const sw = video.videoWidth || 480;
      const sh = video.videoHeight || 270;
      const maxW = opts.maxWidth > 0 ? opts.maxWidth : sw;
      const scale = sw > maxW ? maxW / sw : 1;
      const ow = Math.max(2, Math.round((sw * scale) / 2) * 2);
      const oh = Math.max(2, Math.round((sh * scale) / 2) * 2);

      const fps = opts.fps > 0 ? opts.fps : 15;
      const dur =
        opts.maxSeconds > 0
          ? Math.min(video.duration || 0, opts.maxSeconds)
          : video.duration || 0;
      const frameCount = Math.max(1, Math.min(900, Math.floor(dur * fps)));
      const delay = Math.round(1000 / fps);

      const canvas = document.createElement("canvas");
      canvas.width = ow;
      canvas.height = oh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("canvas 2D context を取得できません");

      const g = window.gifenc;
      if (!g || !g.GIFEncoder) throw new Error("gifencが読み込まれていません");
      const enc = g.GIFEncoder();

      for (let i = 0; i < frameCount; i++) {
        await seek(video, (i + 0.5) / fps);
        ctx.drawImage(video, 0, 0, ow, oh);
        const data = ctx.getImageData(0, 0, ow, oh).data;
        const palette = g.quantize(data, 256);
        const index = g.applyPalette(data, palette);
        enc.writeFrame(index, ow, oh, { palette, delay });
        if (onProgress) onProgress((i + 1) / frameCount);
      }
      enc.finish();
      return new Blob([enc.bytes()], { type: "image/gif" });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  let gifBusy = false;
  async function saveGif(
    user: string,
    tweetId: string | null,
    info: MediaInfo
  ): Promise<void> {
    if (gifBusy) {
      toast("別のGIFを変換中です。お待ちください", true);
      return;
    }
    const variant = info.variants[0];
    if (!variant) {
      toast("変換元のMP4が見つかりません", true);
      return;
    }
    gifBusy = true;
    const p = progressToast("GIFを生成中… 0%");
    try {
      const blob = await convertToGif(variant.url, settings, (r) => {
        p.update("GIFを生成中… " + Math.round(r * 100) + "%");
      });
      p.update("保存中…");
      downloadBlob(blob, makeName(user, tweetId, "gif"));
      p.done("GIFを保存しました（" + (blob.size / 1048576).toFixed(1) + "MB）");
    } catch (e) {
      console.error("[XVDL] gif error", e);
      const msg = e instanceof Error ? e.message : String(e);
      p.done("GIF変換に失敗しました: " + msg, true);
    } finally {
      gifBusy = false;
    }
  }

  // ---------- メニュー / ボタン ----------
  function closeAllMenus(): void {
    document
      .querySelectorAll(".xvdl-menu.open")
      .forEach((m) => m.classList.remove("open"));
  }
  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || !target.closest(".xvdl-wrap")) closeAllMenus();
    },
    true
  );

  function menuItem(
    label: string,
    disabled: boolean,
    onClick?: () => void
  ): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "xvdl-item" + (disabled ? " disabled" : "");
    b.textContent = label;
    if (!disabled && onClick) {
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        closeAllMenus();
        onClick();
      });
    }
    return b;
  }

  function fillMenu(video: HTMLVideoElement, menu: HTMLElement): void {
    const m = getMedia(video);
    menu.innerHTML = "";
    if (!m.info) {
      menu.appendChild(menuItem("URL取得待ち（再生/再読込してください）", true));
      return;
    }
    const info = m.info;
    if (info.mtype === "animated_gif" && info.variants.length) {
      menu.appendChild(
        menuItem("🎞 GIF として保存", false, () => {
          void saveGif(m.user, m.tweetId, info);
        })
      );
    }
    info.variants.forEach((v, i) => {
      const label =
        v.w && v.h ? "⬇ MP4  " + v.w + "×" + v.h : "⬇ MP4  #" + (i + 1);
      menu.appendChild(
        menuItem(label, false, () => saveMp4(m.user, m.tweetId, v))
      );
    });
    if (!info.variants.length) {
      menu.appendChild(
        menuItem(
          info.hls ? "HLS形式のみのため保存できません" : "保存可能な動画なし",
          true
        )
      );
    }
  }

  function defaultAction(video: HTMLVideoElement): void {
    const m = getMedia(video);
    if (!m.info) {
      toast("まだ動画URLを取得できていません。再生/再読込してください", true);
      return;
    }
    const info = m.info;
    if (
      info.mtype === "animated_gif" &&
      settings.gifDefault &&
      info.variants.length
    ) {
      void saveGif(m.user, m.tweetId, info);
    } else if (info.variants.length) {
      saveMp4(m.user, m.tweetId, info.variants[0]);
    } else {
      toast("保存可能な動画がありません（HLSのみ）", true);
    }
  }

  function buildUI(video: HTMLVideoElement): void {
    const container =
      (video.closest('[data-testid="videoComponent"]') as HTMLElement | null) ||
      (video.closest('[data-testid="videoPlayer"]') as HTMLElement | null) ||
      (video.parentElement as HTMLElement | null);
    if (!container) return;
    if (container.querySelector(":scope > .xvdl-wrap")) return;

    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    const wrap = document.createElement("div");
    wrap.className = "xvdl-wrap";

    const main = document.createElement("button");
    main.className = "xvdl-btn xvdl-main";
    main.textContent = "⬇";
    main.title = "ワンクリックで保存（GIFは自動でGIF化）";
    main.addEventListener(
      "click",
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        closeAllMenus();
        defaultAction(video);
      },
      true
    );

    const caret = document.createElement("button");
    caret.className = "xvdl-btn xvdl-caret";
    caret.textContent = "▾";
    caret.title = "画質・形式を選ぶ";

    const menu = document.createElement("div");
    menu.className = "xvdl-menu";

    caret.addEventListener(
      "click",
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const willOpen = !menu.classList.contains("open");
        closeAllMenus();
        if (willOpen) {
          fillMenu(video, menu);
          menu.classList.add("open");
        }
      },
      true
    );

    wrap.appendChild(main);
    wrap.appendChild(caret);
    wrap.appendChild(menu);
    container.appendChild(wrap);
  }

  function scan(): void {
    document.querySelectorAll("video").forEach((v) => buildUI(v));
  }

  const obs = new MutationObserver(() => scan());

  function start(): void {
    obs.observe(document.documentElement, { childList: true, subtree: true });
    scan();
    setInterval(scan, 2000);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
