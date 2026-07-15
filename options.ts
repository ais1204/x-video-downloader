// 設定ページ。chrome.storage.sync に保存/読込する。

(function () {
  "use strict";

  const DEFAULTS: XvdlSettings = {
    gifDefault: true,
    fps: 15,
    maxWidth: 480,
    maxSeconds: 0,
    filename: "{user}_{id}",
    subfolder: "",
    pixivSeparateR18: false,
    pixivFolderAll: "pixiv",
    pixivFolderR18: "pixiv-r18"
  };

  // サブフォルダ入力の安全化（.. や不正文字を除去、区切りは / に統一）
  function cleanFolder(s: string): string {
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

  function byId<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  function clampInt(val: string, min: number, max: number, def: number): number {
    let n = parseInt(val, 10);
    if (isNaN(n)) n = def;
    return Math.max(min, Math.min(max, n));
  }

  function load(): void {
    chrome.storage.sync.get(DEFAULTS, (s) => {
      const v: XvdlSettings = Object.assign({}, DEFAULTS, s);
      byId<HTMLInputElement>("gifDefault").checked = !!v.gifDefault;
      byId<HTMLInputElement>("fps").value = String(v.fps);
      byId<HTMLInputElement>("maxWidth").value = String(v.maxWidth);
      byId<HTMLInputElement>("maxSeconds").value = String(v.maxSeconds);
      byId<HTMLInputElement>("filename").value = v.filename;
      byId<HTMLInputElement>("subfolder").value = v.subfolder;
      byId<HTMLInputElement>("pixivSeparateR18").checked = !!v.pixivSeparateR18;
      byId<HTMLInputElement>("pixivFolderAll").value = v.pixivFolderAll;
      byId<HTMLInputElement>("pixivFolderR18").value = v.pixivFolderR18;
    });
  }

  function save(): void {
    const data: XvdlSettings = {
      gifDefault: byId<HTMLInputElement>("gifDefault").checked,
      fps: clampInt(byId<HTMLInputElement>("fps").value, 1, 50, 15),
      maxWidth: clampInt(byId<HTMLInputElement>("maxWidth").value, 0, 1920, 480),
      maxSeconds: clampInt(byId<HTMLInputElement>("maxSeconds").value, 0, 60, 0),
      filename: (byId<HTMLInputElement>("filename").value || "{user}_{id}").trim(),
      subfolder: cleanFolder(byId<HTMLInputElement>("subfolder").value),
      pixivSeparateR18: byId<HTMLInputElement>("pixivSeparateR18").checked,
      pixivFolderAll:
        cleanFolder(byId<HTMLInputElement>("pixivFolderAll").value) || "pixiv",
      pixivFolderR18:
        cleanFolder(byId<HTMLInputElement>("pixivFolderR18").value) || "pixiv-r18"
    };
    chrome.storage.sync.set(data, () => {
      const st = byId<HTMLElement>("status");
      st.textContent = "保存しました ✓";
      setTimeout(() => {
        st.textContent = "";
      }, 1800);
    });
  }

  byId<HTMLButtonElement>("save").addEventListener("click", save);
  load();
})();
