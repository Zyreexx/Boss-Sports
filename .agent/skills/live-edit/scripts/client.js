/* live-edit overlay — injected by the local proxy. */
(() => {
  if (window.__liveEditLoaded) return;
  window.__liveEditLoaded = true;

  const TOKEN = window.__LIVE_TOKEN;
  const host = document.createElement('div');
  host.id = '__live-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
    .box{position:fixed;pointer-events:none;border-radius:3px;display:none}
    #hover{outline:1.5px dashed #6366f1;background:rgba(99,102,241,.06)}
    #sel{outline:2px solid #6366f1;background:rgba(99,102,241,.08)}
    #tag{position:fixed;display:none;background:#6366f1;color:#fff;font-size:11px;padding:2px 6px;border-radius:3px;pointer-events:none;white-space:nowrap}
    .bar{position:fixed;pointer-events:auto;display:flex;gap:4px;padding:4px;background:#111827;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
    #tools{display:none}
    button{all:unset;cursor:pointer;color:#e5e7eb;font-size:12px;padding:5px 9px;border-radius:5px;white-space:nowrap}
    button:hover{background:#374151}
    button.primary{background:#6366f1;color:#fff}button.primary:hover{background:#4f46e5}
    button.danger:hover{background:#b91c1c}
    button.on{background:#374151}
    #main{left:50%;bottom:18px;transform:translateX(-50%);align-items:center;padding:5px 6px}
    .sep{width:1px;background:#374151;margin:2px 2px}
    #count{color:#9ca3af;font-size:12px;padding:0 6px}
    #list{position:fixed;left:50%;bottom:62px;transform:translateX(-50%);width:340px;max-height:260px;overflow:auto;background:#111827;color:#d1d5db;border-radius:8px;padding:8px;font-size:12px;display:none;pointer-events:auto;box-shadow:0 6px 24px rgba(0,0,0,.35)}
    #list div{padding:5px 6px;border-bottom:1px solid #1f2937}
    #result{position:fixed;right:16px;bottom:16px;width:380px;max-height:55vh;overflow:auto;background:#111827;color:#d1d5db;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;display:none;pointer-events:auto;box-shadow:0 8px 30px rgba(0,0,0,.4)}
    #result h4{margin:0 0 6px;font-size:12px;color:#fff;display:flex;justify-content:space-between;align-items:center}
    #result .ok{color:#86efac}#result .warn{color:#fcd34d}#result .mut{color:#9ca3af;word-break:break-all}
    #result div.row{padding:4px 0;border-top:1px solid #1f2937}
    #toast{position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:#111827;color:#fff;font-size:12px;padding:8px 12px;border-radius:8px;display:none;max-width:420px}
  </style>
  <div id="hover" class="box"></div><div id="sel" class="box"></div><div id="tag"></div>
  <div id="tools" class="bar"></div>
  <div id="list"></div>
  <div id="result"></div>
  <div id="toast"></div>
  <div id="main" class="bar">
    <button id="toggle" class="on">Live: on</button><span class="sep"></span>
    <button id="undo">Undo</button>
    <button id="cnt"><span id="count">0 changes</span></button><span class="sep"></span>
    <button id="save" class="primary">Save to code</button>
  </div>`;
  const $ = s => root.querySelector(s);
  const hoverBox = $('#hover'), selBox = $('#sel'), tagEl = $('#tag'), tools = $('#tools');

  let on = true, hovered = null, selected = null, editing = null;
  const textChanges = new Map();   // key -> {old,new,selector,html}
  const ops = [];                  // structural changes
  const editedEls = new Set();     // elements whose text baseline resets after a save
  const undoStack = [];
  const ids = new WeakMap(); let nextId = 1;
  const idOf = el => { if (!ids.has(el)) ids.set(el, nextId++); return ids.get(el); };
  const inUI = t => t === host || host.contains(t);

  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 7) {
      if (el.id) { parts.unshift('#' + el.id); break; }
      let s = el.tagName.toLowerCase();
      const cls = [...el.classList].slice(0, 2).join('.');
      if (cls) s += '.' + cls;
      const sib = el.parentElement ? [...el.parentElement.children].filter(c => c.tagName === el.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(el) + 1})`;
      parts.unshift(s); el = el.parentElement;
    }
    return parts.join(' > ');
  }
  const html = el => el.outerHTML.replace(/\s+/g, ' ').slice(0, 1800);
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const label = el => el.tagName.toLowerCase() + ([...el.classList][0] ? '.' + [...el.classList][0] : '');
  const isButton = el => el.matches('button,[role=button],input[type=submit],input[type=button],a.btn,a[class*=button],a[class*=btn]');
  const directTexts = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim()).map(n => n.nodeValue.trim().replace(/\s+/g, ' '));

  function toast(msg, ms = 3500) {
    const t = $('#toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = 'none'), ms);
  }

  // ---- drawing ----
  function place(box, el) {
    if (!el || !el.isConnected) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  function frame() {
    place(hoverBox, on && hovered !== selected ? hovered : null);
    place(selBox, selected);
    if (selected && selected.isConnected) {
      const r = selected.getBoundingClientRect();
      tagEl.textContent = label(selected); tagEl.style.display = 'block';
      tagEl.style.left = Math.max(4, r.left) + 'px'; tagEl.style.top = Math.max(4, r.top - 20) + 'px';
      tools.style.display = 'flex';
      const tw = tools.offsetWidth;
      tools.style.left = Math.min(Math.max(8, r.left), innerWidth - tw - 8) + 'px';
      tools.style.top = (r.bottom + 44 > innerHeight ? Math.max(8, r.top - 56) : r.bottom + 8) + 'px';
    } else { tagEl.style.display = 'none'; tools.style.display = 'none'; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- selection ----
  function select(el) {
    if (editing) commitEdit();
    selected = el; buildTools();
  }
  function buildTools() {
    tools.innerHTML = '';
    if (!selected) return;
    const add = (name, fn, cls = '') => { const b = document.createElement('button'); b.textContent = name; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); fn(); }; tools.appendChild(b); };
    add('Edit text', startEdit);
    add('Parent ↑', () => selected.parentElement && selected.parentElement !== document.documentElement && select(selected.parentElement));
    add('Child ↓', () => selected.firstElementChild && select(selected.firstElementChild));
    add('Duplicate', duplicate);
    if (isButton(selected)) add(isDisabled(selected) ? 'Enable' : 'Disable', toggleDisabled);
    add('Delete', del, 'danger');
  }

  document.addEventListener('mousemove', e => { if (on && !inUI(e.target)) hovered = e.target; }, true);
  document.addEventListener('click', e => {
    if (!on || inUI(e.target)) return;
    if (editing && editing.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (e.target === document.documentElement || e.target === document.body) return select(null);
    select(e.target);
  }, true);
  document.addEventListener('dblclick', e => { if (on && !inUI(e.target)) { e.preventDefault(); select(e.target); startEdit(); } }, true);
  document.addEventListener('submit', e => { if (on) e.preventDefault(); }, true);

  // ---- text editing ----
  function startEdit() {
    const el = selected; if (!el) return;
    const texts = directTexts(el);
    if (!texts.length) return toast('No text here — use Child ↓ to pick the element holding the text.');
    if (!el.__liveOrig) el.__liveOrig = texts;
    editing = el; el.__before = texts;
    el.contentEditable = 'true'; el.focus();
    const rng = document.createRange(); rng.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(rng);
    el.addEventListener('keydown', editKeys); el.addEventListener('paste', pastePlain);
    el.addEventListener('blur', commitEdit, { once: true });
  }
  const editKeys = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editing && editing.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); editing.__cancel = true; editing.blur(); }
    e.stopPropagation();
  };
  const pastePlain = e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); };
  function commitEdit() {
    const el = editing; if (!el) return; editing = null;
    el.removeEventListener('keydown', editKeys); el.removeEventListener('paste', pastePlain);
    el.removeAttribute('contenteditable');
    const orig = el.__liveOrig, before = el.__before, cur = directTexts(el);
    if (el.__cancel) { el.__cancel = false; revertTexts(el, before); return; }
    const key0 = String(idOf(el)), prefix = key0 + ':';
    const prev = [...textChanges].filter(([k]) => k.startsWith(prefix));
    prev.forEach(([k]) => textChanges.delete(k));
    editedEls.add(el);
    const base = { selector: cssPath(el), html: html(el), ctx: context(el, orig.concat(cur)) };
    if (cur.length === orig.length) {
      cur.forEach((t, i) => { if (t !== orig[i]) textChanges.set(prefix + i, { old: orig[i], new: t, ...base }); });
    } else {
      // The browser merged/split text nodes (React splits "… {n} …"). Diff by words.
      const a = orig.join(' ').split(/\s+/), b = cur.join(' ').split(/\s+/);
      let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
      let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
      let lo = p, ao = a.length - s, bo = b.length - s;
      if (lo === ao) { if (lo > 0) lo--; else if (ao < a.length) { ao++; bo++; } }   // pure insertion: add a context word
      const o = a.slice(lo, ao).join(' '), n = b.slice(lo, bo).join(' ');
      if (o && o !== n) textChanges.set(prefix + 'span', { old: o, new: n, ...base });
    }
    undoStack.push(() => {
      revertTexts(el, before);
      [...textChanges.keys()].filter(k => k.startsWith(prefix)).forEach(k => textChanges.delete(k));
      prev.forEach(([k, v]) => textChanges.set(k, v));
    });
    refresh();
  }
  function revertTexts(el, texts) {
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
    if (nodes.length === texts.length) nodes.forEach((n, i) => { n.nodeValue = texts[i]; });
    else if (!el.children.length) el.textContent = texts.join(' ');
  }
  // Texts of the surrounding card, used server-side to find the right place in source.
  function context(el, own) {
    let p = el.parentElement, depth = 0;
    while (p && p !== document.body && depth < 5) {
      const leaves = [...p.querySelectorAll('*')].filter(n => n !== el && directTexts(n).length);
      if (leaves.length >= 2) {
        const out = [];
        for (const n of leaves) for (const t of directTexts(n)) if (t.length > 2 && t.length < 140 && !own.includes(t) && !out.includes(t)) out.push(t);
        return out.slice(0, 10);
      }
      p = p.parentElement; depth++;
    }
    return [];
  }

  // ---- structural ops ----
  const meta = el => ({ tag: el.tagName.toLowerCase(), text: txt(el), selector: cssPath(el), html: html(el), parentText: el.parentElement ? [...el.parentElement.children].slice(0, 6).map(txt) : [] });

  function duplicate() {
    const el = selected; if (!el || !el.parentElement) return;
    const clone = el.cloneNode(true);
    el.after(clone);
    const op = { type: 'duplicate', ...meta(el) }; ops.push(op);
    undoStack.push(() => { clone.remove(); ops.splice(ops.indexOf(op), 1); select(el); });
    select(clone); refresh(); toast('Card duplicated. Edit its text, then Save.');
  }
  function del() {
    const el = selected; if (!el || !el.parentElement) return;
    const parent = el.parentElement, next = el.nextSibling;
    const op = { type: 'delete', ...meta(el) }; ops.push(op);
    el.remove(); select(null);
    undoStack.push(() => { parent.insertBefore(el, next); ops.splice(ops.indexOf(op), 1); select(el); });
    refresh();
  }
  const isDisabled = el => el.disabled === true || el.getAttribute('aria-disabled') === 'true';
  function toggleDisabled() {
    const el = selected; const now = !isDisabled(el);
    const apply = v => { if ('disabled' in el) el.disabled = v; el.setAttribute('aria-disabled', String(v)); el.style.opacity = v ? '.5' : ''; };
    apply(now);
    const op = { type: 'attr', name: 'disabled', value: now, ...meta(el) }; ops.push(op);
    undoStack.push(() => { apply(!now); ops.splice(ops.indexOf(op), 1); buildTools(); });
    buildTools(); refresh();
  }

  // ---- change list / save ----
  function refresh() {
    const n = textChanges.size + ops.length;
    $('#count').textContent = n + (n === 1 ? ' change' : ' changes');
    const list = $('#list');
    list.innerHTML = [...textChanges.values()].map(c => `<div>text: “${esc(c.old)}” → “${esc(c.new)}”</div>`).concat(ops.map(o => `<div>${o.type}: &lt;${o.tag}&gt; ${esc(o.text.slice(0, 40))}${o.type === 'attr' ? ' (' + o.name + '=' + o.value + ')' : ''}</div>`)).join('') || '<div>No pending changes</div>';
    buildTools();
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  async function save() {
    if (editing) commitEdit();
    if (!textChanges.size && !ops.length) return toast('Nothing to save.');
    try {
      const r = await fetch('/__live/save', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-live-token': TOKEN },
        body: JSON.stringify({ edits: [...textChanges.values()], ops, page: location.pathname })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      showResult(d);
      try { sessionStorage.setItem('__liveLast', JSON.stringify({ d, t: Date.now() })); } catch {}
      textChanges.clear(); ops.length = 0; undoStack.length = 0;
      editedEls.forEach(el => { if (el.isConnected) el.__liveOrig = directTexts(el); });
      editedEls.clear();
      refresh();
    } catch (e) { showResult({ error: e.message }); }
  }

  // Persistent panel: survives HMR/full reloads (restored from sessionStorage) until dismissed.
  function showResult(d) {
    const el = $('#result');
    const head = (t) => `<h4><span>${t}</span><button id="rx">✕</button></h4>`;
    let h;
    if (d.error) {
      h = head('Save failed') + `<div class="warn">${esc(d.error)}</div><div class="mut">Is <code>npm run live</code> still running in your terminal?</div>`;
    } else {
      h = head(`${d.applied.length} written to source · ${d.queued.length} queued`);
      h += d.applied.map(a => `<div class="row"><span class="ok">✓</span> ${esc(a.file)}:${a.line}<div class="mut">“${esc(a.old)}” → “${esc(a.new)}”</div></div>`).join('');
      h += d.queued.map(q => `<div class="row"><span class="warn">⚠ ${esc(q.type)}${q.reason ? ' — ' + esc(q.reason) : ''}</span><div class="mut">${q.old != null ? '“' + esc(q.old) + '”' : '&lt;' + esc(q.tag || '') + '&gt; ' + esc((q.text || '').slice(0, 60))}${q.candidates && q.candidates.length ? '<br>candidates: ' + esc(q.candidates.join(', ')) : ''}</div></div>`).join('');
      if (d.queued.length) h += `<div class="row warn">Queued items are NOT in your code yet. In Antigravity say: <b>apply live-edit changes</b> (the agent runs <code>live.mjs wait</code>).</div>`;
      if (!d.applied.length && d.queued.some(q => q.reason === 'notfound')) h += `<div class="row mut">Searched ${d.scanned} files in ${esc(d.root)}. If that's the wrong folder, restart <code>npm run live</code> from your project root. If the text comes from a CMS/database/API, it isn't in the code.</div>`;
    }
    el.innerHTML = h; el.style.display = 'block';
    el.querySelector('#rx').onclick = () => { el.style.display = 'none'; try { sessionStorage.removeItem('__liveLast'); } catch {} };
  }
  try { const s = JSON.parse(sessionStorage.getItem('__liveLast') || 'null'); if (s && Date.now() - s.t < 120000) showResult(s.d); } catch {}

  $('#save').onclick = save;
  $('#undo').onclick = () => { const f = undoStack.pop(); if (f) { f(); refresh(); } };
  $('#cnt').onclick = () => { const l = $('#list'); l.style.display = l.style.display === 'block' ? 'none' : 'block'; };
  $('#toggle').onclick = e => { on = !on; e.target.textContent = 'Live: ' + (on ? 'on' : 'off'); e.target.classList.toggle('on', on); if (!on) { select(null); hovered = null; } };
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !editing) { e.preventDefault(); $('#undo').click(); }
    if (e.key === 'Escape' && !editing) select(null);
  }, true);
  refresh();
})();
