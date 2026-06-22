"use strict";
// Service worker:
//  - ツールバーアイコンのクリックで設定ページを開く
//  - "download"   : MP4をchrome.downloadsで保存（CORS回避・ファイル名指定）
//  - "fetchBytes" : GIF変換用にMP4本体を取得しbase64で返す（content側はCORSで取れないため）
// 拡張機能の主UIはページ内に注入されるため、ツールバーアイコンは設定ページへの導線にする。
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg)
        return;
    if (msg.action === "download" && msg.url) {
        chrome.downloads.download({
            url: msg.url,
            filename: msg.filename || "x_video.mp4",
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("[XVDL] download failed:", chrome.runtime.lastError);
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            }
            else {
                sendResponse({ ok: true, downloadId });
            }
        });
        return true; // 非同期
    }
    if (msg.action === "fetchBytes" && msg.url) {
        fetch(msg.url)
            .then((r) => {
            if (!r.ok)
                throw new Error("HTTP " + r.status);
            return r.arrayBuffer();
        })
            .then((buf) => {
            const bytes = new Uint8Array(buf);
            let bin = "";
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
                bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
            }
            sendResponse({ ok: true, b64: btoa(bin) });
        })
            .catch((e) => {
            console.error("[XVDL] fetchBytes failed:", e);
            sendResponse({
                ok: false,
                error: e instanceof Error ? e.message : String(e)
            });
        });
        return true; // 非同期
    }
});
