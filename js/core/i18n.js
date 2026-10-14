/* ============ i18n.js — 介面語言（單機中文版：固定為台灣繁體中文） ============
 * 遊戲原本是用西班牙文寫的。這裡把畫面上出現的西班牙文，依照
 * js/data/lang-zh.js 與 js/data/lang-zh-names.js 的對照表換成中文，不必改動每個畫面：
 *   - DOM（選單、卡片、提示…）用 MutationObserver 即時翻譯，
 *   - canvas（HUD、提示、數字）包住 fillText/strokeText/measureText，
 *   - confirm()/alert()。
 *
 * 對照表以西班牙原文當鍵，分三層比對：
 *   1. 整句完全相符            'Volver' -> '返回'
 *   2. 有空位 {x} 的句型        '¡Has conseguido a {x} shiny!' -> '你得到了異色的{x}！'
 *                              （空位裡的內容也會翻譯；譯文可用 {x1}、{x2} 調換順序）
 *   3. 長句中的片段，只比對完整單字
 * 另外，寶可夢的名字（addNames）會在任何句子裡被換成中文，但只比對大小寫完全相同的整個字。
 * 玩家自己輸入的文字（暱稱）用 translate="no" 標記，不會被翻譯。
 *
 * 改編自原作的 i18n.js（西班牙文／英文版）。
 */
G.I18n = (() => {
  const lang = 'zh';
  document.documentElement.lang = 'zh-Hant-TW';

  const exact = new Map(), exactLow = new Map();
  let patterns = [], frag = null, fragMap = new Map();
  let names = null, nameMap = new Map();
  const byKey = new Map();   // 有空位的原文 → 譯文（給 f() 用，才能正確調換順序）
  const cache = new Map();
  // 單字邊界只看拉丁字母和數字：中文字緊貼在旁邊時，西文片段和寶可夢名字仍然要能被換掉。
  const L = 'A-Za-z0-9\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F';
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** 把空位填進譯文：{x} 依序填入，{x1}、{x2}… 指定第幾個。 */
  function fill(tpl, vals) {
    let i = 0;
    return tpl.replace(/\{x(\d*)\}/g, (_, n) => { const v = n ? vals[+n - 1] : vals[i++]; return v === undefined ? '' : v; });
  }

  /** 加入翻譯 { '西班牙原文': '中文' }。l 是這份對照表的語言（不是目前語言就略過）。 */
  function add(dict, l = 'en') {
    if (l !== lang) return;
    for (const [es, zh] of Object.entries(dict)) {
      if (!zh || es === zh) continue;
      if (es.includes('{x}')) {
        const parts = es.split('{x}').map(reEsc);
        byKey.set(es, zh);
        patterns.push({ re: new RegExp('^' + parts.join('(.+?)') + '$', 'u'), reI: new RegExp('^' + parts.join('(.+?)') + '$', 'iu'), zh,
                        lit: es.replace(/\{x\}/g, '').length });
      } else {
        exact.set(es, zh);
        exactLow.set(es.toLowerCase(), zh);
        if (es.length >= 4 || /\s/.test(es)) fragMap.set(es.toLowerCase(), zh);
      }
    }
    // 固定文字越多的句型越具體，先比對（例如「¡{x} shiny salvaje apareció!」要比「¡{x} salvaje apareció!」先）。
    patterns.sort((a, b) => b.lit - a.lit);
    // 所有片段合成一個正規表示式（長的優先），只比對完整單字。
    const all = [...fragMap.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|');
    frag = all ? new RegExp(`(?<![${L}])(${all})(?![${L}])`, 'giu') : null;
    cache.clear();
  }

  /** 加入寶可夢名字：整句相符時翻譯；在句子裡只換大小寫完全相同的整個字。 */
  function addNames(dict, l = 'en') {
    if (l !== lang) return;
    for (const [en, zh] of Object.entries(dict)) {
      if (!zh || en === zh) continue;
      nameMap.set(en, zh);
      if (!exact.has(en)) { exact.set(en, zh); exactLow.set(en.toLowerCase(), zh); }
    }
    const all = [...nameMap.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|');
    names = all ? new RegExp(`(?<![${L}])(${all})(?![${L}])`, 'gu') : null;
    cache.clear();
  }

  function keepCase(src, zh) {
    if (src === src.toUpperCase() && /\p{L}/u.test(src)) return zh.toUpperCase();
    return zh;
  }

  /** 把一段文字（不含前後空白）翻成目前的語言。 */
  function t(s) {
    if (!s || typeof s !== 'string') return s;
    if (!/\p{L}/u.test(s)) return s;
    const c = cache.get(s);
    if (c !== undefined) return c;
    const r = core(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
    return r;
  }

  function core(s) {
    // 保留前後的空白（DOM 的文字節點）。
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    // HTML 裡的文字可能跨好幾行：比對時把空白合併。
    const lead = m[1], tail = m[3], body = m[2].replace(/\s+/g, ' ');
    if (!body) return s;
    // 已經是中文、沒有拉丁字母的文字就不用處理。
    if (!/[A-Za-zÀ-ÿ]/.test(body)) return s;
    const upper = body === body.toUpperCase() && /\p{L}/u.test(body);
    let r = exact.get(body);
    if (r === undefined && upper) { const e = exactLow.get(body.toLowerCase()); if (e !== undefined) r = keepCase(body, e); }
    if (r === undefined) {
      for (const p of patterns) {
        const mm = (upper ? p.reI : p.re).exec(body);
        if (!mm) continue;
        r = keepCase(body, fill(p.zh, mm.slice(1).map(g => g === undefined ? '' : core(g))));
        break;
      }
    }
    if (r === undefined && frag) r = body.replace(frag, w => keepCase(w, fragMap.get(w.toLowerCase()) || w));
    if (r === undefined) r = body;
    if (names) r = r.replace(names, w => nameMap.get(w) || w);
    r = r.replace(/(?<![\p{L}\p{N}])Nv\.(?=\s?\d)/gu, 'Lv.');   // 等級縮寫：Nv. 5 → Lv. 5
    return lead + r + tail;
  }

  /** 程式裡用的有空位句子：T('Nivel {x}', 5)。 */
  function f(es, ...vals) {
    const tpl = byKey.get(es);
    return fill(tpl !== undefined ? tpl : t(es), vals.map(v => (typeof v === 'string' ? t(v) : v)));
  }

  // ---------------- DOM ----------------
  const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  const skipEl = el => !!(el && el.closest && el.closest('[translate="no"], script, style, code'));

  function doText(n) {
    const p = n.parentElement;
    if (!p || skipEl(p)) return;
    const v = n.nodeValue;
    if (n.__tr === v) return;
    const r = t(v);
    n.__tr = r;
    if (r !== v) n.nodeValue = r;
  }
  function doEl(el) {
    if (skipEl(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const r = t(v); if (r !== v) el.setAttribute(a, r); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    doEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }

  function startDom() {
    walk(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.title = t(document.title);
  }

  // ---------------- canvas 與瀏覽器的對話框 ----------------
  {
    const P = CanvasRenderingContext2D.prototype;
    for (const k of ['fillText', 'strokeText', 'measureText']) {
      const orig = P[k];
      P[k] = function (s, ...a) { return orig.call(this, typeof s === 'string' ? t(s) : s, ...a); };
    }
    const oc = window.confirm, oa = window.alert;
    window.confirm = s => oc.call(window, t(s));
    window.alert = s => oa.call(window, t(s));
  }

  /** 單機中文版只有一種語言：保留這個函式，讓原本的程式呼叫時不會出錯。 */
  function set() { /* 只有中文 */ }

  return { lang, add, addNames, t, f, set, startDom, walk };
})();
G.T = G.I18n.t;
