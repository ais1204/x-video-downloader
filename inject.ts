// MAIN world script.
// XのGraphQL/APIレスポンスを横取りして、ツイートID -> 動画の全変種(variants) と
// メディア種別(video / animated_gif) を抽出し、content.js(ISOLATED) へ postMessage で渡す。

(function () {
  "use strict";

  interface XhrWithUrl extends XMLHttpRequest {
    __xvdl_url?: string;
  }

  // mp4の全変種を解像度・ビットレート付きで返す（高画質順）。HLSの有無も返す。
  function extract(variants: unknown): { variants: Variant[]; hls: boolean } {
    if (!Array.isArray(variants)) return { variants: [], hls: false };
    const mp4: Variant[] = variants
      .filter((v: any) => v && v.content_type === "video/mp4" && v.url)
      .map((v: any) => {
        const m = (v.url as string).match(/\/(\d+)x(\d+)\//);
        return {
          url: v.url as string,
          bitrate: v.bitrate || 0,
          w: m ? parseInt(m[1], 10) : 0,
          h: m ? parseInt(m[2], 10) : 0
        };
      });
    mp4.sort((a, b) => b.w * b.h - a.w * a.h || b.bitrate - a.bitrate);
    const hls = variants.some(
      (v: any) => v && v.content_type === "application/x-mpegURL"
    );
    return { variants: mp4, hls };
  }

  // twimg のURL（mp4変種・サムネ画像とも）からメディアIDを取り出す。
  // 例: .../amplify_video/1862.../...  .../amplify_video_thumb/1862.../...
  //     .../ext_tw_video(_thumb)/123/... .../tweet_video(_thumb)/F1ab...
  // mp4側とサムネ側で同じIDになるため、tweetId非依存の照合キーになる。
  function extractMediaId(url: unknown): string {
    if (typeof url !== "string") return "";
    const m = url.match(
      /\/(?:amplify_video|ext_tw_video|tweet_video)(?:_thumb)?\/([A-Za-z0-9]+)/
    );
    return m ? m[1] : "";
  }

  function post(
    tweetId: string,
    mtype: string,
    info: { variants: Variant[]; hls: boolean },
    mediaId: string
  ): void {
    if (!tweetId || !info || (!info.variants.length && !info.hls)) return;
    const msg: MediaMessage = {
      __xvdl: true,
      kind: "media",
      tweetId: String(tweetId),
      mtype: mtype || "video",
      variants: info.variants,
      hls: info.hls
    };
    if (mediaId) msg.mediaId = mediaId;
    window.postMessage(msg, "*");
  }

  // JSON を再帰的に走査。tweetの legacy オブジェクト
  // (id_str と extended_entities.media を持つ) を見つけて動画を抽出。
  function walk(node: any, depth: number): void {
    if (!node || typeof node !== "object" || depth > 40) return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walk(node[i], depth + 1);
      return;
    }

    try {
      const id: string | undefined = node.id_str || node.conversation_id_str;
      const ee = node.extended_entities;
      if (id && ee && Array.isArray(ee.media)) {
        for (const m of ee.media) {
          if (m && m.video_info && Array.isArray(m.video_info.variants)) {
            const info = extract(m.video_info.variants);
            const mediaId =
              extractMediaId(m.media_url_https) ||
              extractMediaId(info.variants[0] && info.variants[0].url);
            post(id, m.type, info, mediaId);
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    for (const k in node) {
      if (Object.prototype.hasOwnProperty.call(node, k)) {
        walk(node[k], depth + 1);
      }
    }
  }

  function handle(text: string): void {
    if (!text || text.length > 8000000) return; // 念のため上限
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return;
    }
    walk(json, 0);
  }

  function isInteresting(url: string | null | undefined): boolean {
    return (
      typeof url === "string" &&
      (url.indexOf("graphql") !== -1 ||
        url.indexOf("/i/api/") !== -1 ||
        url.indexOf("/2/timeline") !== -1)
    );
  }

  // ---- fetch フック ----
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (
      ...args: Parameters<typeof fetch>
    ): Promise<Response> {
      const input = args[0];
      let url: string | undefined;
      if (typeof input === "string") url = input;
      else if (input instanceof URL) url = input.href;
      else if (input && typeof (input as Request).url === "string") {
        url = (input as Request).url;
      }

      const p = origFetch.apply(window, args);
      if (isInteresting(url)) {
        p.then((res: Response) => {
          try {
            res
              .clone()
              .text()
              .then(handle)
              .catch(() => {});
          } catch (e) {}
        }).catch(() => {});
      }
      return p;
    };
  }

  // ---- XHR フック（プロトタイプ書き換えのため as any は不可避）----
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    this: XhrWithUrl,
    ...args: any[]
  ): void {
    this.__xvdl_url = args[1];
    (origOpen as any).apply(this, args);
  } as any;

  XMLHttpRequest.prototype.send = function (
    this: XhrWithUrl,
    ...args: any[]
  ): void {
    const self = this;
    this.addEventListener("load", function () {
      try {
        if (isInteresting(self.__xvdl_url)) {
          const t = self.responseText;
          if (typeof t === "string") handle(t);
        }
      } catch (e) {}
    });
    (origSend as any).apply(this, args);
  } as any;
})();
