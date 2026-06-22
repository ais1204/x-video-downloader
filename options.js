"use strict";
// 設定ページ。chrome.storage.sync に保存/読込する。
(function () {
    "use strict";
    const DEFAULTS = {
        gifDefault: true,
        fps: 15,
        maxWidth: 480,
        maxSeconds: 0,
        filename: "{user}_{id}"
    };
    function byId(id) {
        return document.getElementById(id);
    }
    function clampInt(val, min, max, def) {
        let n = parseInt(val, 10);
        if (isNaN(n))
            n = def;
        return Math.max(min, Math.min(max, n));
    }
    function load() {
        chrome.storage.sync.get(DEFAULTS, (s) => {
            const v = Object.assign({}, DEFAULTS, s);
            byId("gifDefault").checked = !!v.gifDefault;
            byId("fps").value = String(v.fps);
            byId("maxWidth").value = String(v.maxWidth);
            byId("maxSeconds").value = String(v.maxSeconds);
            byId("filename").value = v.filename;
        });
    }
    function save() {
        const data = {
            gifDefault: byId("gifDefault").checked,
            fps: clampInt(byId("fps").value, 1, 50, 15),
            maxWidth: clampInt(byId("maxWidth").value, 0, 1920, 480),
            maxSeconds: clampInt(byId("maxSeconds").value, 0, 60, 0),
            filename: (byId("filename").value || "{user}_{id}").trim()
        };
        chrome.storage.sync.set(data, () => {
            const st = byId("status");
            st.textContent = "保存しました ✓";
            setTimeout(() => {
                st.textContent = "";
            }, 1800);
        });
    }
    byId("save").addEventListener("click", save);
    load();
})();
