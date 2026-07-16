// ISOLATED world script（www.pixiv.net）。
// Pixivの作品画像に原寸DLボタンを重ねる。
//  - 原寸URLは ajax/illust/<id>/pages API から正確に取得（jpg/png/gifを取り違えない）
//  - i.pximg.net は Referer 必須のため、実際の取得は Referer を付与できる
//    service worker 側（chrome.downloads）で行う（DNRルール rules.json 参照）

(function () {
  "use strict";

  // illustId -> 各ページの原寸URL（pages APIの結果をキャッシュ）
  const pagesCache = new Map<string, string[]>();
  const pending = new Map<string, Promise<string[]>>();
  // illustId -> xRestrict（0=全年齢, 1=R-18, 2=R-18G）
  const ratingCache = new Map<string, number>();

  // ---------- 設定 ----------
  const DEFAULTS: XvdlSettings = {
    gifDefault: true,
    fps: 15,
    maxWidth: 480,
    maxSeconds: 0,
    filename: "{user}_{id}",
    subfolder: "",
    pixivSeparateR18: false,
    pixivFolderAll: "", // 空=サブフォルダ直下（X画像と同じ場所）
    pixivFolderR18: "pixiv-r18"
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

  function send<T>(msg: XvdlMessage): Promise<T> {
    return new Promise<T>((resolve) => {
      chrome.runtime.sendMessage(msg, (resp: T) => resolve(resp));
    });
  }

  // "a/b" 形式のサブフォルダを安全化
  function sanitizeFolder(s: string): string {
    return String(s || "")
      .replace(/\\/g, "/")
      .split("/")
      .map((seg) =>
        seg
          .replace(/[<>:"|?*]+/g, "_")
          .replace(/^\.+$/, "_")
          .trim()
      )
      .filter(Boolean)
      .join("/");
  }
  function joinPath(folder: string, name: string): string {
    const f = sanitizeFolder(folder);
    return f ? f + "/" + name : name;
  }

  // ---------- トースト（content.tsと同じ .xvdl-* クラスを再利用） ----------
  let toastBox: HTMLElement | null = null;
  function ensureToastBox(): HTMLElement {
    if (toastBox && document.body.contains(toastBox)) return toastBox;
    toastBox = document.createElement("div");
    toastBox.className = "xvdl-toasts";
    document.body.appendChild(toastBox);
    return toastBox;
  }
  function toast(text: string, isError?: boolean): void {
    const box = ensureToastBox();
    const t = document.createElement("div");
    t.className = "xvdl-toast" + (isError ? " err" : "");
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add("hide");
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }

  // ---------- 原寸URL取得 ----------
  async function fetchOriginals(illustId: string): Promise<string[]> {
    const cached = pagesCache.get(illustId);
    if (cached) return cached;
    const inflight = pending.get(illustId);
    if (inflight) return inflight;

    const task = (async (): Promise<string[]> => {
      // 同一オリジン（www.pixiv.net）のためCookie付きで叩ける
      const res = await fetch(
        "https://www.pixiv.net/ajax/illust/" + illustId + "/pages?lang=ja",
        { credentials: "include", headers: { accept: "application/json" } }
      );
      if (!res.ok) throw new Error("API " + res.status);
      const json = (await res.json()) as {
        body?: Array<{ urls?: { original?: string } }>;
      };
      const body = json && json.body;
      const urls = Array.isArray(body)
        ? body
            .map((b) => (b && b.urls && b.urls.original) || "")
            .filter((u): u is string => !!u)
        : [];
      pagesCache.set(illustId, urls);
      return urls;
    })();

    pending.set(illustId, task);
    try {
      return await task;
    } finally {
      pending.delete(illustId);
    }
  }

  // 作品のレーティング（xRestrict）を取得。0=全年齢, 1=R-18, 2=R-18G
  async function fetchRating(illustId: string): Promise<number> {
    const cached = ratingCache.get(illustId);
    if (cached !== undefined) return cached;
    try {
      const res = await fetch(
        "https://www.pixiv.net/ajax/illust/" + illustId + "?lang=ja",
        { credentials: "include", headers: { accept: "application/json" } }
      );
      if (!res.ok) throw new Error("API " + res.status);
      const json = (await res.json()) as { body?: { xRestrict?: number } };
      const x = (json && json.body && json.body.xRestrict) || 0;
      ratingCache.set(illustId, x);
      return x;
    } catch (e) {
      // 判別できない場合は安全側（全年齢扱い）にせず、分けない
      ratingCache.set(illustId, 0);
      return 0;
    }
  }

  // 表示画像URLから illustId とページ番号を得る（例 .../123456_p0_master1200.jpg）
  function parseIllust(src: string): { id: string; page: number } | null {
    const m = src.match(/\/(\d+)_p(\d+)/);
    return m ? { id: m[1], page: parseInt(m[2], 10) } : null;
  }

  function extOf(url: string): string {
    const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return m ? m[1].toLowerCase() : "jpg";
  }

  let busy = false;
  async function saveOriginal(info: { id: string; page: number }): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const urls = await fetchOriginals(info.id);
      const url = urls[info.page] || urls[0];
      if (!url) {
        toast("原寸URLを取得できませんでした（うごくイラスト等は非対応）", true);
        return;
      }
      // 保存先サブフォルダ: (共通subfolder)/(R-18分けが有効なら年齢別フォルダ)
      // 年齢別フォルダ名が空欄なら、余計な階層を作らずサブフォルダ直下に保存する。
      let folder = settings.subfolder;
      if (settings.pixivSeparateR18) {
        const x = await fetchRating(info.id);
        const sub = sanitizeFolder(
          x > 0 ? settings.pixivFolderR18 : settings.pixivFolderAll
        );
        folder = sub ? joinPath(settings.subfolder, sub) : settings.subfolder;
      }
      const ext = extOf(url);
      const filename = joinPath(folder, "pixiv_" + info.id + "_p" + info.page + "." + ext);

      // i.pximg.net は Referer 必須。chrome.downloads へ直接URLを渡すと
      // DNRのヘッダ改変が効かず403になるため、host権限を持つ service worker で
      // 取得（DNRがRefererを付与・CORSも回避）→ データURLにして保存する。
      const got = await send<FetchBytesResponse>({ action: "fetchBytes", url });
      if (!got || !got.ok || !got.b64) {
        toast(
          "画像取得に失敗しました" + (got && got.error ? ": " + got.error : ""),
          true
        );
        return;
      }
      const mime =
        ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
      const resp = await send<DownloadResponse>({
        action: "download",
        url: "data:" + mime + ";base64," + got.b64,
        filename
      });
      if (resp && resp.ok === false) {
        toast("保存に失敗しました: " + (resp.error || "unknown"), true);
      } else {
        toast("原寸画像を保存しました");
      }
    } catch (e) {
      toast("保存に失敗しました: " + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      busy = false;
    }
  }

  // ---------- ボタン付与 ----------
  function attachButton(
    container: HTMLElement,
    info: { id: string; page: number }
  ): void {
    if (container.querySelector(":scope > .xvdl-wrap")) return;
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }
    const wrap = document.createElement("div");
    wrap.className = "xvdl-wrap";
    const btn = document.createElement("button");
    btn.className = "xvdl-btn xvdl-main xvdl-solo";
    btn.textContent = "⬇";
    btn.title = "原寸大の画像を保存";
    btn.addEventListener(
      "click",
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void saveOriginal(info);
      },
      true
    );
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }

  // 原寸リンク（i.pximg.net/img-original/…）で包まれている場合、hrefからID/頁を解決。
  // 本体画像のsrcがプレースホルダー(data:等)でもリンクがあれば正確に拾える。
  function infoFromAnchor(
    img: HTMLImageElement
  ): { id: string; page: number } | null {
    const a = img.closest("a");
    if (!a) return null;
    const href = a.getAttribute("href") || "";
    if (href.indexOf("pximg.net") === -1) return null;
    return parseIllust(href);
  }

  // 実画像（作品ページのメイン画像・マンガ各ページ・読込済みサムネ）に付与。
  function buildForImage(img: HTMLImageElement): void {
    const info = parseIllust(img.currentSrc || img.src) || infoFromAnchor(img);
    if (!info) return; // 作品画像以外（アバター等）は対象外
    // 同じ作品リンク内に既にボタンがあれば付けない（buildForThumbとの重複防止）
    const anchor = img.closest('a[href*="/artworks/"]');
    if (anchor && anchor.querySelector(".xvdl-wrap")) return;
    const container = img.parentElement;
    if (container) attachButton(container, info);
  }

  function parseArtworkId(href: string): string | null {
    const m = href.match(/\/artworks\/(\d+)/);
    return m ? m[1] : null;
  }

  // 作品リンクのサムネ。R-18マスク等で実画像URLが出ない場合もリンクからID取得。
  // すでにアンカー内にボタンがあれば（実画像側で付与済み）付けない＝重複防止。
  function buildForThumb(a: HTMLAnchorElement): void {
    const id = parseArtworkId(a.getAttribute("href") || "");
    if (!id) return;
    const img = a.querySelector("img") as HTMLImageElement | null;
    if (!img) return; // 画像サムネのみ対象（テキストリンク除外）
    const isrc = img.currentSrc || img.src || "";
    // ナビ矢印などのSVGアイコン・極小画像には付けない
    if (/\.svg(\?|$)/.test(isrc)) return;
    if (img.clientWidth < 40 || img.clientHeight < 40) return;
    if (a.querySelector(".xvdl-wrap")) return; // 実画像側で付与済み
    attachButton(a, { id, page: 0 }); // サムネは表紙(p0)を保存
  }

  // 作品ページ本体のフォールバック:
  // モバイル(touch)版レイアウト等では本体画像の <img> src がプレースホルダー
  // (data:等)のままで、URLからID/頁を解決できない。その場合はURLの作品IDと
  // 表示順でページ番号を割り当てる。誤付与を避けるため、候補画像の数が
  // APIのページ数と一致した時だけ付与する。
  const pagesFetchTried = new Set<string>();
  function scanArtworkFallback(): void {
    const m = location.pathname.match(/\/artworks\/(\d+)/);
    if (!m) return;
    const id = m[1];
    const known = pagesCache.get(id);
    if (!known) {
      // ページ数が未取得なら非同期で取得し、次回scanで判定（失敗は一度で諦める）
      if (!pagesFetchTried.has(id)) {
        pagesFetchTried.add(id);
        void fetchOriginals(id).catch(() => {});
      }
      return;
    }
    const cands: HTMLImageElement[] = [];
    document.querySelectorAll("img").forEach((el) => {
      const img = el as HTMLImageElement;
      if (img.clientWidth < 150) return; // 本体画像は十分大きい
      if (img.closest('a[href*="/artworks/"]')) return; // 他作品サムネ
      const src = img.currentSrc || img.src || "";
      if (src.indexOf("/user-profile/") !== -1) return; // アバター
      if (parseIllust(src) || infoFromAnchor(img)) return; // 通常経路で処理済み
      cands.push(img);
    });
    if (!cands.length) return;
    if (cands.length !== known.length) return; // 数が合わない場合は誤付与を避けて保留
    cands.forEach((img, idx) => {
      const container = img.parentElement;
      if (container) attachButton(container, { id, page: idx });
    });
  }

  function scan(): void {
    document
      .querySelectorAll('img[src*="i.pximg.net"]')
      .forEach((im) => buildForImage(im as HTMLImageElement));
    document
      .querySelectorAll('a[href*="/artworks/"]')
      .forEach((a) => buildForThumb(a as HTMLAnchorElement));
    scanArtworkFallback();
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
