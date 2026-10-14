/* ============ settings-ui.js — pantalla de Ajustes (PC y móvil) ============
 * Se abre por encima de lo que haya (menú o pausa) y al cerrar vuelve ahí.
 * Pestañas: Sonido · Gráficos · Controles · Cuenta · Acerca de.
 * 單機中文版：「Cuenta」分頁改成存檔管理（匯出／匯入／刪除），拿掉語言切換。
 * Los ajustes son de este dispositivo (G.Settings / G.Audio en el navegador).
 */
G.SettingsUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERSION = '1.2 · 2026-10-09';
  const REPO = 'https://github.com/JPTER78/pokesurvivor';
  let tab = 'sound';

  function init() {
    // 下載進度：設定開著、停在存檔分頁時，只更新那一列（不重畫整頁，捲動位置才不會跳掉）
    if (G.Offline) G.Offline.on(() => {
      const row = isOpen() && tab === 'acc' && $('set-offline-row');
      if (!row) return;
      const tmp = document.createElement('div'); tmp.innerHTML = offlineSection();
      const nr = tmp.querySelector('#set-offline-row');
      if (nr) { row.replaceWith(nr); wireOffline(); }
    });
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => { b.onclick = () => { tab = b.dataset.t; render(); }; });
    $('set-close').onclick = close;
    $('btn-settings').innerHTML = G.Icons.html('gear', 20);
    $('btn-settings').onclick = () => open();
    $('btn-pause-settings').onclick = () => open('sound');
    // Pantalla completa (si el navegador la permite; en iPhone, cómo conseguirla).
    if (canFull() || iosTip()) {
      $('btn-full').classList.remove('hidden');
      $('btn-full').innerHTML = G.Icons.html('full', 20);
      $('btn-full').onclick = toggleFull;
    }
  }

  function open(t) {
    if (t) tab = t;
    $('scr-settings').classList.remove('hidden');
    render();
  }
  function close() { $('scr-settings').classList.add('hidden'); }
  const isOpen = () => !$('scr-settings').classList.contains('hidden');

  // ---------------- pantalla completa ----------------
  function canFull() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  // iPhone: Safari no deja poner una web a pantalla completa (por eso a veces
  // no salía la opción). Sí se puede abriéndola desde la pantalla de inicio.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  function iosTip() { return IOS && !canFull() && !standalone(); }
  const IOS_TIP = 'En iPhone, Safari no deja poner las webs a pantalla completa. Pulsa Compartir y luego "Añadir a pantalla de inicio": abriendo el juego desde ese icono se juega a pantalla completa.';
  function toggleFull() {
    if (!canFull()) { if (iosTip()) G.UI.toast(IOS_TIP, 9000); return; }
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      // En móvil, además se intenta fijar la pantalla en horizontal.
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ } }).catch(() => {});
    }
    setTimeout(() => { if (isOpen()) render(); }, 300);
  }

  // ---------------- piezas ----------------
  function section(title, sub) { return `<h3 class="set-h">${esc(title)}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}`; }
  function toggle(key, label, desc) {
    const on = !!G.Settings.get(key);
    return `<div class="set-row"><div class="grow"><b>${esc(label)}</b><small>${esc(desc)}</small></div>
      <button class="btn small switch ${on ? 'gold' : ''}" data-k="${key}">${on ? 'Sí' : 'No'}</button></div>`;
  }
  function choice(key, opts) {
    const cur = G.Settings.get(key);
    return `<div class="chips set-chips">${opts.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  }

  function render() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const box = $('set-body');
    box.scrollTop = 0;
    if (tab === 'sound') {
      box.innerHTML = section('Sonido') + '<div id="set-sound" class="sound-inline"></div>';
      G.UI.soundControls($('set-sound'));
    } else if (tab === 'gfx') {
      const auto = ['baja', 'media', 'alta'][G.Settings.autoLevel];
      box.innerHTML = section('Calidad', 'Cuántos efectos y partículas se dibujan. <b>Auto</b> la baja sola si el juego va a tirones (ahora: ' + auto + ').')
        + choice('quality', [['auto', 'Auto'], ['high', 'Alta'], ['mid', 'Media'], ['low', 'Baja']])
        + section('Pantalla')
        + toggle('dmgNumbers', 'Números de daño', 'Los números que salen al golpear y al recibir daño.')
        + toggle('calm', 'Menos sacudidas y destellos', 'La cámara tiembla menos y los fogonazos son suaves.')
        + toggle('fps', 'Mostrar FPS', 'Fotogramas por segundo, en la esquina de abajo.')
        + (canFull() ? `<div class="set-row"><div class="grow"><b>Pantalla completa</b><small>Sin barras del navegador.</small></div>
             <button class="btn small" id="set-full">${isFull() ? 'Salir' : 'Activar'}</button></div>`
           : iosTip() ? `<div class="set-row"><div class="grow"><b>Pantalla completa</b><small>${esc(IOS_TIP)}</small></div></div>` : '');
    } else if (tab === 'ctl') {
      box.innerHTML = section('En móvil o tablet')
        + `<p class="sub">Pon el dedo en cualquier parte y arrastra para moverte: el joystick aparece donde tocas. Toca un ataque de abajo para cambiarlo y el botón de arriba a la derecha para pausar. Se juega en horizontal.</p>`
        + `<div class="set-row"><div class="grow"><b>Tamaño del joystick</b><small>Cuánto hay que arrastrar el dedo.</small></div></div>`
        + choice('stick', [[0.8, 'Pequeño'], [1, 'Normal'], [1.25, 'Grande']])
        + section('En PC')
        + `<div class="keys">
             <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o flechas</div><span>moverse</span>
             <div><kbd>1</kbd>–<kbd>4</kbd> o clic en el icono</div><span>elegir ataque</span>
             <div><kbd>Q</kbd> / <kbd>E</kbd></div><span>ataque anterior / siguiente</span>
             <div><kbd>Esc</kbd> o <kbd>P</kbd></div><span>pausa</span>
             <div><kbd>1</kbd>–<kbd>3</kbd></div><span>elegir carta al subir de nivel</span>
           </div>`;
    } else if (tab === 'acc') {
      renderAccount(box);
    } else {
      box.innerHTML = `<div class="about-logo">PokéSurvivor</div><p class="sub center">單機中文版 · 改編自原作版本 ${esc(VERSION)}</p>`
        + `<p class="sub">粉絲製作的<b>免費、非營利</b>同人遊戲：沒有廣告也沒有付費內容。寶可夢與其角色屬於 Nintendo、Creatures 和 GAME FREAK；本作與他們沒有任何關係。</p>`
        + `<p class="sub">這個版本不連網：拿掉了帳號、好友、多人連線和排行榜，存檔只放在你的瀏覽器裡。請自己遊玩就好，不要公開散布或拿來營利。</p>`
        + section('製作名單')
        + `<ul class="credits">
             <li><b>原作：</b>JPTER78《PokéSurvivor · Mundo Misterioso》（程式碼為 MIT 授權）。</li>
             <li><b>角色圖：</b>PMD SpriteCollab 與其繪師（CC BY-NC 4.0，名單見 CREDITS.md）。</li>
             <li><b>寶可夢資料與中文名稱：</b>PokéAPI。</li>
             <li><b>音樂與音效：</b>原作原創，由遊戲本身即時合成。</li>
             <li><b>字型：</b>Pixelify Sans（OFL）、俐方體11號 Cubic 11。</li>
           </ul>`
        + `<div class="row wrap" style="justify-content:center;gap:8px">
             <button class="btn small" data-legal>法律聲明</button>
             <a class="btn small" href="${REPO}" target="_blank" rel="noopener">原作原始碼（GitHub）</a>
           </div>`;
    }
    wire(box);
  }

  /** 「存檔」分頁（單機中文版）：存檔只在這個瀏覽器，可以匯出備份、匯入、重置。 */
  function renderAccount(box) {
    const st = G.DB.save && G.DB.save.stats || {};
    box.innerHTML = section('存檔', '存檔只保存在<b>這個瀏覽器</b>裡。清除瀏覽器資料、換瀏覽器或換手機／電腦，存檔都不會跟著走，記得偶爾匯出備份。')
      + `<div class="set-row"><div class="grow"><b>已收集的寶可夢</b></div><span class="gold">${Object.keys((G.DB.save && G.DB.save.owned) || {}).length}</span></div>`
      + `<div class="set-row"><div class="grow"><b>遊玩局數</b></div><span>${st.runs || 0}</span></div>`
      + `<div class="row wrap" style="gap:8px;margin-top:12px">
           <button class="btn gold" id="set-export">匯出存檔</button>
           <button class="btn" id="set-import">匯入存檔</button>
           <button class="btn danger" id="set-reset">刪除存檔</button>
         </div><p class="note" id="set-msg"></p>
         <input type="file" id="set-file" accept=".json,application/json" class="hidden">`
      + offlineSection();
  }

  function wireOffline() {
    const off = $('set-offline');
    if (off) off.onclick = () => {
      off.disabled = true;
      G.Offline.run().then(ok => {
        if (G.Offline.state.noServer) G.UI.toast('連不上遊戲網址：請確認有網路（用伺服器 App 的話，要先打開它）再試一次。', 5000);
        if (isOpen() && tab === 'acc') render();
      });
    };
  }

  /** 「離線遊玩」狀態（手機用 localhost 開啟時才有意義，見 js/core/offline.js）。 */
  function offlineSection() {
    const O = G.Offline && G.Offline.state;
    if (!O || !O.http) return '';
    let txt, btn = '';
    if (!O.can) txt = '要用 <b>http://localhost:連接埠</b> 開啟才能離線玩（用 IP 位址開啟時不行）。';
    else if (O.running) txt = `下載中… <b class="gold">${O.done} / ${O.total}</b>（可以先玩，不用等）`;
    else if (O.finished) txt = '<b class="gold">已存好</b>：沒有網路也能玩。';
    else {
      txt = O.missing > 0 ? `還有 ${O.missing} 張圖沒存，要連得上遊戲網址才能下載。` : '尚未下載，要連得上遊戲網址才能下載。';
      btn = '<button class="btn small gold" id="set-offline">開始下載</button>';
    }
    return section('離線遊玩') + `<div class="set-row" id="set-offline-row"><div class="grow"><small>${txt}</small></div>${btn}</div>`;
  }


  function downloadSave() {
    const txt = G.DB.exportSave();
    if (!txt) return;
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = `PokeSurvivor存檔-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('set-msg').textContent = '已下載備份檔。';
  }

  function wire(box) {
    box.querySelectorAll('.switch[data-k]').forEach(b => { b.onclick = () => { G.Settings.set(b.dataset.k, !G.Settings.get(b.dataset.k)); render(); }; });
    box.querySelectorAll('.chip[data-k]').forEach(b => {
      b.onclick = () => { const v = b.dataset.v; G.Settings.set(b.dataset.k, isNaN(+v) ? v : +v); render(); };
    });
    const full = $('set-full'); if (full) full.onclick = toggleFull;
    const ex = $('set-export'); if (ex) ex.onclick = downloadSave;
    wireOffline();
    const im = $('set-import'), file = $('set-file');
    if (im && file) {
      im.onclick = () => {
        if (G.Game.state !== 'ui') { $('set-msg').textContent = '請先回到主選單再匯入。'; return; }
        file.value = ''; file.click();
      };
      file.onchange = () => {
        const f = file.files && file.files[0];
        if (!f) return;
        f.text().then(txt => {
          if (!confirm('匯入後，目前的存檔會被備份檔取代。確定要匯入嗎？')) return;
          const r = G.DB.importSave(txt);
          if (!r.ok) { $('set-msg').textContent = r.error; return; }
          location.reload();
        });
      };
    }
    const rs = $('set-reset');
    if (rs) rs.onclick = () => {
      if (!confirm('確定要刪除存檔嗎？收集的寶可夢、金幣和強化都會消失，而且無法復原。\n（建議先按「匯出存檔」備份。）')) return;
      if (G.Game.state !== 'ui') G.Game.quit && G.Game.quit();
      G.DB.resetSave();
      location.reload();
    };
  }

  /** Cerrar sesión (si estás en una partida, se abandona). */
  function leave() {
    if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
    if (G.Game.state !== 'ui') G.Game.quit && G.Game.quit();
    G.Audio.music(null);
    G.DB.logout().then(() => G.Flow.toLogin());
  }

  return { init, open, close, get isOpen() { return isOpen(); } };
})();
