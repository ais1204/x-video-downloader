// 設定ページ。chrome.storage.sync に保存/読込する。

(function () {
  "use strict";

  const DEFAULTS: XvdlSettings = {
    gifDefault: true,
    fps: 15,
    maxWidth: 480,
    maxSeconds: 0,
    filename: "{user}_{id}"
  };

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
    });
  }

  function save(): void {
    const data: XvdlSettings = {
      gifDefault: byId<HTMLInputElement>("gifDefault").checked,
      fps: clampInt(byId<HTMLInputElement>("fps").value, 1, 50, 15),
      maxWidth: clampInt(byId<HTMLInputElement>("maxWidth").value, 0, 1920, 480),
      maxSeconds: clampInt(byId<HTMLInputElement>("maxSeconds").value, 0, 60, 0),
      filename: (byId<HTMLInputElement>("filename").value || "{user}_{id}").trim()
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
