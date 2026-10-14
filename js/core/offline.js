/* ============ offline.js — 手機離線遊玩（單機中文版新增） ============
 * 遊戲用網址開啟時（GitHub Pages 的 https 網址，或手機上伺服器 App 的 http://localhost），
 * 第一次開啟會在背景把整個遊戲（程式碼、字型、13,468 張寶可夢圖）存進瀏覽器的快取
 * （Cache Storage，和 sw.js 用同一組快取名稱）。存完之後，沒有網路（或伺服器沒開）時，
 * sw.js 也會從快取把遊戲整個拿出來，所以可以直接從主畫面圖示開啟。
 *
 *   - 只在「安全的網址」（https 或 localhost）才能用：sw.js 需要它。
 *   - 中途關掉也沒關係：下次開啟會從缺的地方繼續（已經存好的圖會跳過）。
 *   - 用電腦直接雙擊 index.html（file://）時不會啟動，也不需要。
 */
G.Offline = (() => {
  const CODE = 'ps-code-v1', ART = 'ps-art-v1';           // 必須和 sw.js 一樣
  const ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];
  const ART_RE = /^assets\/(pokemon|icons|fonts)\//;        // sw.js 當作「圖檔」的路徑
  const http = /^https?:$/.test(location.protocol);
  const can = http && window.isSecureContext && 'caches' in window && 'serviceWorker' in navigator;
  const st = { can, http, total: 0, done: 0, missing: -1, running: false, finished: false, failed: 0 };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(st); } catch (e) { /* 忽略 */ } });

  /** 要存起來的所有檔案。 */
  function files() {
    const code = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'favicon.ico'];
    document.querySelectorAll('script[src]').forEach(s => code.push(s.getAttribute('src')));
    const art = ['assets/fonts/PixelifyPS-400.ttf', 'assets/fonts/PixelifyPS-700.ttf', 'assets/fonts/Cubic_11.woff2',
                 'assets/icons/icon-180.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png'];
    for (const dex of Object.keys(G.SPRITE_META || {})) {
      for (const a of ANIMS) art.push(`assets/pokemon/${dex}/${a}.png`);
      if (G.SPRITE_META[dex].sh) for (const a of ANIMS) art.push(`assets/pokemon/${dex}/s/${a}.png`);
    }
    return { code, art };
  }

  /** 伺服器現在連得到嗎？（加上亂數參數，sw.js 就不會拿快取來回答） */
  async function serverUp() {
    try { const r = await fetch('manifest.webmanifest?probe=' + Date.now(), { cache: 'no-store' }); return r.ok; }
    catch (e) { return false; }
  }

  /** 還缺幾張圖沒存。 */
  async function countMissing() {
    const { art } = files();
    const have = new Set((await (await caches.open(ART)).keys()).map(r => new URL(r.url).pathname));
    const base = new URL('.', location.href).pathname;
    return art.filter(u => !have.has(base + u)).length;
  }

  /** 開始（或繼續）下載。→ 是否全部完成 */
  async function run() {
    if (!can || st.running) return st.finished;
    st.noServer = !(await serverUp());
    if (st.noServer) { emit(); return false; }
    st.running = true; st.failed = 0;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* 不支援就算了 */ }
    const { code, art } = files();
    const all = [...code, ...art];
    st.total = all.length; st.done = 0; emit();
    const cCode = await caches.open(CODE), cArt = await caches.open(ART);
    let next = 0;
    async function worker() {
      while (next < all.length) {
        const url = all[next++];
        const isArt = ART_RE.test(url), c = isArt ? cArt : cCode;
        try {
          // 圖檔已經存過就跳過；程式碼每次都重新存，才會是最新版。
          if (!isArt || !(await c.match(url))) {
            const r = await fetch(url, { cache: 'no-cache' });
            if (r.ok) await c.put(url, r); else st.failed++;
          }
        } catch (e) { st.failed++; }
        st.done++;
        if (st.done % 60 === 0 || st.done === st.total) emit();
      }
    }
    await Promise.all(Array.from({ length: 10 }, worker));
    st.missing = await countMissing();
    st.finished = st.missing === 0 && st.failed === 0;
    st.running = false;
    emit();
    return st.finished;
  }

  /** 遊戲開好之後自動檢查：還沒存完就在背景下載。 */
  async function auto() {
    if (!http) return;
    if (!window.isSecureContext) {
      const port = location.port ? ':' + location.port : '';
      G.UI.toast(`如果伺服器 App 就在這支手機上，請改用 http://localhost${port} 開啟：用 IP 位址開啟時不能離線玩，換 Wi-Fi 後存檔也會看不到。`, 12000);
      return;
    }
    if (!can) return;
    try {
      st.missing = await countMissing();
      if (st.missing === 0) { st.finished = true; emit(); return; }
      const first = st.missing > 13000;
      if (first) G.UI.toast('正在把遊戲存進手機（第一次要幾分鐘，可以邊玩邊等）。存好之後，沒有網路也能玩。', 7000);
      const ok = await run();
      if (ok) G.UI.toast('離線資料存好了！之後沒有網路也能玩，可以把這個網頁「加入主畫面」。', 7000);
    } catch (e) { console.warn('[離線]', e); }
  }

  return { auto, run, get state() { return st; }, on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
})();
