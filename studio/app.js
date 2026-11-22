'use strict';
/* Studio: calendario di studio personale.
   Tutti i dati restano su questo dispositivo (localStorage). Nessun server, nessun account. */

// ========== Utilità ==========
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_B = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const GG = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // ordine dei giorni da lunedì (valori di getDay)

const fmtLong = s => { const d = parseD(s); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
const fmtShort = s => { const d = parseD(s); return `${d.getDate()} ${MESI_B[d.getMonth()]}`; };
const fmtMin = m => {
  m = Math.round(m || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const fmtH = m => { const h = m / 60; return (h >= 10 ? Math.round(h).toString() : h.toFixed(1)).replace('.', ','); };
const relDays = n => n === 0 ? 'oggi' : n === 1 ? 'domani' : n === -1 ? 'ieri' : n > 0 ? `tra ${n} giorni` : `${-n} giorni fa`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function icon(name, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ========== Dati ==========
const KEY = 'studio.data.v1';
const TKEY = 'studio.timer.v1';

const TYPES = {
  studio: { label: 'Studio', icon: 'book-open', check: true },
  ripasso: { label: 'Ripasso', icon: 'repeat', check: true },
  lezione: { label: 'Lezione', icon: 'graduation-cap', check: false },
  esame: { label: 'Esame', icon: 'flag', check: false },
  altro: { label: 'Altro', icon: 'pin', check: true },
};
const TYPE_ORDER = ['esame', 'lezione', 'studio', 'ripasso', 'altro'];
const COLOR_NAMES = ['Eosina', 'Ematossilina', 'Verde malachite', 'Giallo picrico', 'Blu di metilene', 'Safranina', 'Giemsa', 'Verde Janus'];
const STATUS = { todo: 'Da studiare', done: 'Studiato', review: 'Ripassato' };

function defaults() {
  return {
    v: 1, subjects: [], events: [], notes: [], log: [],
    settings: { theme: 'auto', goal: 120, focus: 25, short: 5, long: 15, longEvery: 4, sound: true, hideInstall: false },
  };
}
function migrate(d) {
  const out = Object.assign(defaults(), d || {});
  out.settings = Object.assign(defaults().settings, (d && d.settings) || {});
  for (const k of ['subjects', 'events', 'notes', 'log']) if (!Array.isArray(out[k])) out[k] = [];
  out.subjects.forEach(s => { if (!Array.isArray(s.topics)) s.topics = []; if (typeof s.color !== 'number') s.color = 1; });
  out.events.forEach(e => { if (!Array.isArray(e.topicIds)) e.topicIds = []; });
  delete out.app; delete out.exportedAt;
  return out;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* dati illeggibili: si riparte */ }
  return defaults();
}
let S = load();
let persistAsked = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('La memoria del telefono è piena. Esporta un backup dalle impostazioni.'); }
  if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
}

// ========== Selettori ==========
const subj = id => S.subjects.find(s => s.id === id);
const subjVar = id => { const s = subj(id); return s ? `var(--c${s.color})` : 'var(--ink-3)'; };
const subjName = id => (subj(id) || {}).name || '';
const evById = id => S.events.find(e => e.id === id);
const byTime = (a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
const eventsOn = d => S.events.filter(e => e.date === d).sort(byTime);
const minutesOn = d => S.log.reduce((t, l) => l.date === d ? t + l.minutes : t, 0);
const minutesMap = () => { const m = {}; S.log.forEach(l => { m[l.date] = (m[l.date] || 0) + l.minutes; }); return m; };
function nextExam(sid) {
  const t = today();
  return S.events.filter(e => e.type === 'esame' && e.date >= t && (!sid || e.subjectId === sid))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))[0];
}
function topicNames(e) {
  const s = subj(e.subjectId);
  if (!s || !e.topicIds.length) return '';
  const names = e.topicIds.map(id => (s.topics.find(t => t.id === id) || {}).title).filter(Boolean);
  if (names.length > 3) return `${names.slice(0, 2).join(', ')} e altri ${names.length - 2}`;
  return names.join(', ');
}
function evTitle(e) {
  return e.title || topicNames(e) || subjName(e.subjectId) || TYPES[e.type].label;
}
function evMeta(e, opts = {}) {
  const t1 = evTitle(e);
  const parts = [];
  if (t1 !== TYPES[e.type].label) parts.push(TYPES[e.type].label);
  const sn = subjName(e.subjectId);
  if (sn && sn !== t1) parts.push(sn);
  if (e.type !== 'esame' && e.dur) parts.push(fmtMin(e.dur));
  if (e.place) parts.push(e.place);
  if (opts.rel) parts.push(relDays(diffDays(today(), e.date)));
  return parts.join(', ');
}
function subjProgress(s) {
  if (!s.topics.length) return 0;
  return s.topics.filter(t => t.status !== 'todo').length / s.topics.length;
}
function subjMinutes(sid, from) {
  return S.log.reduce((t, l) => (l.subjectId === sid && (!from || l.date >= from)) ? t + l.minutes : t, 0);
}

// ========== Stato interfaccia ==========
const UI = { tab: 'cal', month: today().slice(0, 7), sel: today(), subjectId: null, noteQ: '', noteF: 'all', range: 7, bar: null, day: today() };

// ========== Toast ==========
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { action.run(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 5000 : 2800);
}

// ========== Fogli (pannelli dal basso) ==========
let sheetEl = null, backEl = null, ctx = null;
function openSheet(c) {
  closeSheet(true);
  ctx = c; ctx.state = ctx.state || {};
  backEl = document.createElement('div'); backEl.className = 'backdrop';
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet' + (c.tall ? ' tall' : '');
  sheetEl.setAttribute('role', 'dialog'); sheetEl.setAttribute('aria-modal', 'true');
  document.body.append(backEl, sheetEl);
  paintSheet();
  backEl.addEventListener('click', dismissSheet);
  sheetEl.addEventListener('click', onSheetClick);
  sheetEl.addEventListener('input', onSheetInput);
  sheetEl.addEventListener('change', onSheetInput);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => { backEl && backEl.classList.add('open'); sheetEl && sheetEl.classList.add('open'); }));
}
function paintSheet() {
  if (!sheetEl || !ctx) return;
  const top = sheetEl.scrollTop;
  sheetEl.innerHTML = ctx.render(ctx.state);
  const h = $('h2', sheetEl); if (h) { h.id = 'sheet-title'; sheetEl.setAttribute('aria-labelledby', 'sheet-title'); }
  sheetEl.scrollTop = top;
}
function onSheetClick(e) {
  const t = e.target.closest('[data-sact]');
  if (!t) return;
  e.preventDefault();
  const a = t.dataset.sact;
  if (a === 'close') { dismissSheet(); return; }
  if (a === 'chip') { // scelta singola: data-k, data-v
    let v = t.dataset.v; if (t.dataset.num !== undefined) v = Number(v);
    if (v === 'null') v = null;
    ctx.state[t.dataset.k] = v; ctx.onChange && ctx.onChange(t.dataset.k, v); paintSheet(); return;
  }
  if (a === 'multi') { // scelta multipla
    const k = t.dataset.k; let v = t.dataset.v; if (t.dataset.num !== undefined) v = Number(v);
    const arr = ctx.state[k] || (ctx.state[k] = []);
    const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v);
    paintSheet(); return;
  }
  if (a === 'toggle') { ctx.state[t.dataset.k] = !ctx.state[t.dataset.k]; paintSheet(); return; }
  ctx.onAct && ctx.onAct(a, t, e);
}
function onSheetInput(e) {
  const k = e.target.dataset.k;
  if (!k || !ctx) return;
  let v = e.target.value;
  if (e.target.type === 'number') v = v === '' ? '' : Number(v);
  ctx.state[k] = v;
  if (e.type === 'change' && e.target.dataset.repaint !== undefined) paintSheet();
  ctx.onInput && ctx.onInput(k, v, e);
}
function dismissSheet() {
  if (ctx && ctx.onDismiss && ctx.onDismiss(ctx.state) === false) return;
  closeSheet();
}
function closeSheet(immediate) {
  const s = sheetEl, b = backEl;
  sheetEl = backEl = null; ctx = null;
  document.body.style.overflow = '';
  if (!s) return;
  if (immediate) { s.remove(); b.remove(); return; }
  s.classList.remove('open'); b.classList.remove('open');
  setTimeout(() => { s.remove(); b.remove(); }, 320);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetEl) dismissSheet(); });

function sheetHead(title, right = '') {
  return `<div class="sheet-head"><h2>${esc(title)}</h2>${right || `<button class="ib" data-sact="close" aria-label="Chiudi">${icon('x')}</button>`}</div>`;
}
function chips(k, options, cur, extra = '') {
  return `<div class="chips ${extra}">` + options.map(o => {
    const v = o.v === null ? 'null' : o.v;
    const on = o.v === cur;
    return `<button class="chip" data-sact="chip" data-k="${k}" data-v="${esc(v)}" ${typeof o.v === 'number' ? 'data-num' : ''} aria-pressed="${on}">${o.c ? `<span class="dot" style="--c:${o.c}"></span>` : ''}${esc(o.l)}</button>`;
  }).join('') + `</div>`;
}
function confirmSheet({ title, text, ok = 'Conferma', danger = false, options }) {
  return new Promise(res => {
    const opts = options || [{ l: ok, v: true, danger }];
    openSheet({
      render: () => `${sheetHead(title)}<p class="muted" style="margin:4px 0 0">${esc(text)}</p>
        <div class="form-actions">${opts.map((o, i) => `<button class="btn ${o.danger ? 'danger' : i ? 'ghost' : ''} wide" data-sact="pick" data-i="${i}">${esc(o.l)}</button>`).join('')}
        <button class="btn ghost wide" data-sact="close">Annulla</button></div>`,
      onAct: (a, t) => { if (a === 'pick') { const v = opts[+t.dataset.i].v; closeSheet(); res(v); } },
      onDismiss: () => { res(null); },
    });
  });
}

// ========== Tema ==========
const mqDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && mqDark.matches);
  $$('meta[name="theme-color"]').forEach(m => m.remove());
  const m = document.createElement('meta'); m.name = 'theme-color'; m.content = dark ? '#0F1420' : '#F2F4F7';
  document.head.append(m);
}
mqDark.addEventListener && mqDark.addEventListener('change', applyTheme);

// ========== Render principale ==========
function render() {
  $$('.tabs [data-tab]').forEach(b => { if (b.dataset.tab === UI.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const v = $('#view');
  v.innerHTML = UI.tab === 'cal' ? viewCal()
    : UI.tab === 'sub' ? (UI.subjectId && subj(UI.subjectId) ? viewSubject() : viewSubjects())
    : UI.tab === 'tim' ? viewTimer()
    : UI.tab === 'not' ? viewNotes()
    : viewStats();
  if (UI.tab === 'tim') paintTimer();
}

// ---------- Calendario ----------
function isStandalone() { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

function viewCal() {
  const t = today();
  const [y, m] = UI.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const off = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m, 0).getDate();
  const total = Math.ceil((off + daysIn) / 7) * 7;
  const mins = minutesMap();
  const evMap = {};
  S.events.forEach(e => { (evMap[e.date] || (evMap[e.date] = [])).push(e); });
  const goal = S.settings.goal || 120;

  let cells = '';
  for (let i = 0; i < total; i++) {
    const d = ymd(new Date(y, m - 1, 1 - off + i));
    const dd = parseD(d);
    const evs = evMap[d] || [];
    const mn = mins[d] || 0;
    const fill = clamp(mn / goal, 0, 1);
    const exam = evs.find(e => e.type === 'esame');
    const seen = new Set(); const dots = [];
    evs.filter(e => e.type !== 'esame').sort(byTime).forEach(e => { const k = e.subjectId || '_'; if (!seen.has(k) && dots.length < 3) { seen.add(k); dots.push(subjVar(e.subjectId)); } });
    const cls = ['cell', dd.getMonth() !== m - 1 ? 'out' : '', d === t ? 'today' : '', d === UI.sel ? 'sel' : ''].join(' ');
    const label = `${dd.getDate()} ${MESI[dd.getMonth()]}` + (mn ? `, ${fmtMin(mn)} studiati` : '') + (evs.length ? `, ${evs.length} ${evs.length === 1 ? 'attività' : 'attività'}` : '') + (exam ? ', esame' : '');
    cells += `<button class="${cls}" data-act="day" data-d="${d}" aria-label="${esc(label)}" ${d === UI.sel ? 'aria-pressed="true"' : ''}>
      <span class="well ${fill >= 1 ? 'full' : ''}" style="--fill:${fill.toFixed(3)}"><span class="liquid"></span><span class="num">${dd.getDate()}</span></span>
      <span class="marks">${exam ? `<span style="color:${subjVar(exam.subjectId)}">${icon('flag')}</span>` : ''}${dots.map(c => `<i style="background:${c}"></i>`).join('')}</span>
    </button>`;
  }

  const ex = nextExam();
  let strip = '';
  if (ex) {
    const n = diffDays(t, ex.date);
    const sn = subjName(ex.subjectId) || ex.title || 'esame';
    strip = n === 0
      ? `<button class="exam-strip" data-act="exam-open" data-id="${ex.id}"><span class="days">Oggi</span><span class="txt"><b>Esame di ${esc(sn)}</b>${ex.start ? ` alle ${ex.start}` : ''}. In bocca al lupo.</span>${icon('chevron-right', 'ico faint')}</button>`
      : `<button class="exam-strip" data-act="exam-open" data-id="${ex.id}"><span class="days">${n}</span><span class="txt">${n === 1 ? 'giorno' : 'giorni'} all'esame di <b>${esc(sn)}</b>, ${fmtLong(ex.date)}</span>${icon('chevron-right', 'ico faint')}</button>`;
  }

  const install = (!isStandalone() && isIOS() && !S.settings.hideInstall)
    ? `<div class="install">${icon('smartphone')}<div>Per usarla come un'app: tocca <b>Condividi</b> in Safari, poi <b>Aggiungi alla schermata Home</b>.</div><button class="ib x" data-act="install-hide" aria-label="Nascondi">${icon('x', 'ico ico-s')}</button></div>`
    : '';

  const showToday = UI.month !== t.slice(0, 7) || UI.sel !== t;
  return `
  <header class="top">
    <h1>${cap(MESI[m - 1])} <span class="yr">${y}</span></h1>
    ${showToday ? `<button class="mini-btn" data-act="cal-today">Oggi</button>` : ''}
    <button class="ib" data-act="cal-move" data-n="-1" aria-label="Mese precedente">${icon('chevron-left')}</button>
    <button class="ib" data-act="cal-move" data-n="1" aria-label="Mese successivo">${icon('chevron-right')}</button>
    <button class="ib" data-act="settings" aria-label="Impostazioni">${icon('settings')}</button>
  </header>
  ${install}
  ${strip}
  <div class="weekdays" aria-hidden="true">${GG.map(g => `<span>${g}</span>`).join('')}</div>
  <div class="month" role="group" aria-label="${cap(MESI[m - 1])} ${y}">${cells}</div>
  <div class="cal-legend"><span><i class="lw"></i>tempo studiato rispetto all'obiettivo</span><span><i class="lw f"></i>obiettivo raggiunto</span></div>
  ${viewDay(UI.sel)}`;
}

function viewDay(d) {
  const t = today();
  const evs = eventsOn(d);
  const mn = minutesOn(d);
  const goal = S.settings.goal || 120;
  const planned = evs.filter(e => TYPES[e.type].check && !e.done).reduce((s, e) => s + (e.dur || 0), 0);
  let summary;
  if (d <= t) {
    summary = `<div class="goalbar" aria-hidden="true"><i style="width:${clamp(mn / goal, 0, 1) * 100}%"></i></div>
      <div class="studied"><b>${fmtMin(mn)}</b> di ${fmtMin(goal)} studiati${planned && d === t ? `, ancora ${fmtMin(planned)} in programma` : ''}. <button class="link" style="color:var(--accent);font-weight:500" data-act="log-open">Registra tempo</button></div>`;
  } else {
    summary = `<div class="studied">${planned ? `In programma: <b>${fmtMin(planned)}</b> di studio` : `${relDays(diffDays(t, d)) === 'domani' ? 'Domani' : cap(relDays(diffDays(t, d)))}`}</div>`;
  }

  const rows = evs.map(e => rowEvent(e)).join('');
  const list = rows
    ? `<ul class="list">${rows}</ul>`
    : `<div class="empty"><p>${d < t ? 'Nessuna attività segnata in questo giorno.' : 'Niente in programma. Aggiungi una sessione di studio, una lezione o un esame.'}</p>${d >= t ? `<button class="btn sm" data-act="ev-new" data-date="${d}">${icon('plus', 'ico ico-s')}Aggiungi</button>` : ''}</div>`;

  // arretrati: sessioni passate non completate (solo vista di oggi)
  let backlog = '';
  if (d === t) {
    const from = addDays(t, -30);
    const late = S.events.filter(e => TYPES[e.type].check && !e.done && e.date < t && e.date >= from).sort((a, b) => b.date.localeCompare(a.date));
    if (late.length) {
      backlog = `<section class="backlog"><h3>Rimaste indietro</h3><p class="hint" style="margin:0 0 4px">Sessioni non spuntate negli ultimi 30 giorni.</p><ul class="list">${late.slice(0, 8).map(e => `
        <li class="row">
          <button class="chk" style="--c:${subjVar(e.subjectId)}" data-act="ev-toggle" data-id="${e.id}" aria-pressed="false" aria-label="Segna come fatta">${icon('check')}</button>
          <button class="body" data-act="ev-open" data-id="${e.id}"><span class="t1">${esc(evTitle(e))}</span><span class="t2">${esc(fmtLong(e.date))}</span></button>
          <span class="end"><button class="mini-btn" data-act="ev-move" data-id="${e.id}" data-to="${t}">A oggi</button></span>
        </li>`).join('')}</ul>${late.length > 8 ? `<p class="hint">E altre ${late.length - 8}.</p>` : ''}</section>`;
    }
  }

  const notes = S.notes.filter(n => n.date === d).sort((a, b) => b.updatedAt - a.updatedAt);
  const notesHtml = `<div class="sec-title"><h3>Note del giorno</h3><button class="link" data-act="note-new" data-date="${d}">Scrivi</button></div>
    ${notes.length ? `<ul class="list">${notes.map(rowNote).join('')}</ul>` : `<p class="hint" style="margin:0">Appunti, dubbi da chiedere al prof, cose da ricordare.</p>`}`;

  return `
  <section aria-label="Giorno selezionato">
    <div class="day-head"><h2>${fmtLong(d)}</h2>
      <button class="ib solid" data-act="ev-new" data-date="${d}" aria-label="Aggiungi attività">${icon('plus')}</button></div>
    ${summary}
    ${list}
    ${backlog}
    ${notesHtml}
  </section>`;
}

function rowEvent(e, opts = {}) {
  const c = subjVar(e.subjectId);
  const T = TYPES[e.type];
  const lead = T.check
    ? `<button class="chk" style="--c:${c}" data-act="ev-toggle" data-id="${e.id}" aria-pressed="${!!e.done}" aria-label="${e.done ? 'Segna come da fare' : 'Segna come fatta'}">${icon('check')}</button>`
    : `<span class="tag-ico" style="--c:${c}" title="${T.label}">${icon(T.icon)}</span>`;
  const right = opts.date ? fmtShort(e.date) : (e.start || '');
  return `<li class="row ${e.done ? 'done' : ''}">
    ${lead}
    <button class="body" data-act="ev-open" data-id="${e.id}"><span class="t1">${esc(evTitle(e))}</span><span class="t2">${esc(evMeta(e, { rel: e.type === 'esame' }))}</span></button>
    ${right ? `<span class="time">${right}</span>` : ''}
  </li>`;
}

function rowNote(n) {
  const first = (n.body || '').trim().split('\n')[0];
  const title = n.title || first || 'Nota senza titolo';
  const rest = n.title ? (n.body || '').trim() : (n.body || '').trim().split('\n').slice(1).join(' ');
  const meta = [n.subjectId && subjName(n.subjectId), n.date && fmtShort(n.date)].filter(Boolean).join(', ');
  return `<li class="row note-row">
    ${n.subjectId ? `<span class="dot" style="--c:${subjVar(n.subjectId)}"></span>` : `<span class="dot" style="--c:var(--line)"></span>`}
    <button class="body" data-act="note-open" data-id="${n.id}"><span class="t1">${n.pinned ? icon('pin', 'ico ico-s') + ' ' : ''}${esc(title)}</span>${rest ? `<span class="t2">${esc(rest)}</span>` : ''}${meta ? `<span class="t2 faint" style="font-size:13px">${esc(meta)}</span>` : ''}</button>
  </li>`;
}

// ---------- Editor attività ----------
function openEvent(id, preset = {}) {
  const orig = id ? evById(id) : null;
  if (id && !orig) return;
  const st = orig
    ? JSON.parse(JSON.stringify(orig))
    : {
      type: preset.type || 'studio',
      subjectId: preset.subjectId !== undefined ? preset.subjectId : (S.subjects[0] ? S.subjects[0].id : null),
      title: '', date: preset.date || UI.sel, start: '', dur: preset.type === 'ripasso' ? 30 : 60, place: '', notes: '', topicIds: [], done: false,
      repeat: false, until: addDays(preset.date || UI.sel, 7 * 12),
    };
  if (st.subjectId && !subj(st.subjectId)) st.subjectId = null;

  const placeholders = { studio: 'Cosa studi? Es. capitolo 4, antibiotici', ripasso: 'Es. ripasso mediatori chimici', lezione: 'Es. lezione 8', esame: 'Es. prova intercorso a crocette', altro: 'Es. consegna relazione di laboratorio' };

  openSheet({
    state: st,
    render: st => {
      const s = subj(st.subjectId);
      const subjOpts = S.subjects.map(x => ({ v: x.id, l: x.name, c: `var(--c${x.color})` })).concat([{ v: null, l: 'Nessuna' }]);
      const showTopics = s && s.topics.length && (st.type === 'studio' || st.type === 'ripasso');
      return `${sheetHead(orig ? 'Modifica attività' : 'Nuova attività')}
      <div class="field"><span class="lab">Tipo</span>${chips('type', TYPE_ORDER.map(k => ({ v: k, l: TYPES[k].label })), st.type)}</div>
      <div class="field"><span class="lab">Materia</span>${S.subjects.length ? chips('subjectId', subjOpts, st.subjectId) : `<p class="hint" style="margin:0">Non hai ancora materie. Puoi crearle nella sezione Materie.</p>`}</div>
      ${showTopics ? `<div class="field"><span class="lab">Argomenti</span><div class="chips wrap">${s.topics.map(tp => `<button class="chip" data-sact="multi" data-k="topicIds" data-v="${tp.id}" aria-pressed="${st.topicIds.includes(tp.id)}">${esc(tp.title)}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label for="ev-title">Titolo</label><input id="ev-title" class="inp" data-k="title" value="${esc(st.title)}" placeholder="${esc(placeholders[st.type])}" autocomplete="off"></div>
      <div class="grid2">
        <div class="field"><label for="ev-date">Giorno</label><input id="ev-date" class="inp" type="date" data-k="date" value="${st.date}"></div>
        <div class="field"><label for="ev-start">Ora</label><input id="ev-start" class="inp" type="time" data-k="start" value="${st.start || ''}"></div>
      </div>
      ${st.type !== 'esame' ? `<div class="field"><span class="lab">Durata</span>${chips('dur', [30, 45, 60, 90, 120, 180].map(n => ({ v: n, l: fmtMin(n) })), st.dur)}</div>` : ''}
      ${st.type === 'lezione' || st.type === 'esame' ? `<div class="field"><label for="ev-place">Luogo</label><input id="ev-place" class="inp" data-k="place" value="${esc(st.place)}" placeholder="Es. aula T3, Monte Sant'Angelo"></div>` : ''}
      ${!orig ? `<div class="switch-row"><span>Ripeti ogni settimana</span><button class="switch" role="switch" aria-checked="${!!st.repeat}" data-sact="toggle" data-k="repeat" aria-label="Ripeti ogni settimana"></button></div>
        ${st.repeat ? `<div class="field"><label for="ev-until">Fino al</label><input id="ev-until" class="inp" type="date" data-k="until" value="${st.until}"></div>` : ''}` : ''}
      <div class="field"><label for="ev-notes">Note</label><textarea id="ev-notes" class="inp" data-k="notes" placeholder="Pagine, capitoli, cosa portare">${esc(st.notes)}</textarea></div>
      <div class="form-actions">
        <button class="btn wide" data-sact="save">Salva</button>
        ${orig && TYPES[st.type].check && !orig.done ? `<button class="btn ghost wide" data-sact="timer">${icon('timer', 'ico ico-s')}Studia ora col timer</button>` : ''}
        ${orig ? `<button class="btn danger wide" data-sact="delete">${icon('trash-2', 'ico ico-s')}Elimina</button>` : ''}
      </div>`;
    },
    onChange: (k, v) => {
      if (k === 'subjectId') st.topicIds = [];
      if (k === 'type' && v === 'ripasso' && !orig) st.dur = 30;
    },
    onAct: async a => {
      if (a === 'save') {
        if (!st.date) { toast('Scegli il giorno.'); return; }
        const clean = { type: st.type, subjectId: st.subjectId || null, title: (st.title || '').trim(), date: st.date, start: st.start || '', dur: st.type === 'esame' ? 0 : (Number(st.dur) || 60), place: (st.place || '').trim(), notes: st.notes || '', topicIds: st.topicIds || [] };
        if (orig) {
          Object.assign(orig, clean);
          toast('Attività salvata');
        } else if (st.repeat && st.until && st.until > st.date) {
          const seriesId = uid(); let d = st.date, n = 0;
          while (d <= st.until && n < 40) { S.events.push(Object.assign({ id: uid(), done: false, seriesId }, clean, { date: d })); d = addDays(d, 7); n++; }
          toast(`Aggiunte ${n} attività, una a settimana`);
        } else {
          S.events.push(Object.assign({ id: uid(), done: false }, clean));
          toast('Attività aggiunta');
        }
        save(); closeSheet();
        UI.sel = st.date; UI.month = st.date.slice(0, 7);
        render();
      }
      if (a === 'timer') {
        closeSheet(); linkTimer(orig);
      }
      if (a === 'delete') {
        let mode = true;
        if (orig.seriesId && S.events.filter(e => e.seriesId === orig.seriesId).length > 1) {
          mode = await confirmSheet({ title: 'Eliminare la serie?', text: 'Questa attività si ripete ogni settimana.', options: [{ l: 'Solo questa', v: 'one', danger: true }, { l: 'Questa e le successive', v: 'next', danger: true }] });
        } else {
          mode = await confirmSheet({ title: 'Eliminare l\'attività?', text: `"${evTitle(orig)}" del ${fmtShort(orig.date)} verrà eliminata.`, ok: 'Elimina', danger: true });
          if (mode) mode = 'one';
        }
        if (!mode) return;
        const removed = mode === 'next' ? S.events.filter(e => e.seriesId === orig.seriesId && e.date >= orig.date) : [orig];
        const ids = new Set(removed.map(e => e.id));
        S.events = S.events.filter(e => !ids.has(e.id));
        S.log = S.log.filter(l => !(ids.has(l.eventId) && l.source === 'sessione'));
        save(); closeSheet(); render();
        toast(removed.length > 1 ? `Eliminate ${removed.length} attività` : 'Attività eliminata');
      }
    },
  });
}

function toggleDone(id) {
  const e = evById(id); if (!e) return;
  e.done = !e.done;
  const s = subj(e.subjectId);
  if (e.done) {
    const timerMin = S.log.filter(l => l.eventId === id && l.source === 'timer').reduce((t, l) => t + l.minutes, 0);
    if (!timerMin && e.dur) S.log.push({ id: uid(), date: e.date, subjectId: e.subjectId || null, minutes: e.dur, eventId: id, source: 'sessione' });
    e.marked = [];
    if (s && e.topicIds.length) {
      s.topics.forEach(tp => {
        if (!e.topicIds.includes(tp.id)) return;
        if (e.type === 'ripasso' && tp.status !== 'review') { e.marked.push([tp.id, tp.status]); tp.status = 'review'; tp.doneAt = e.date; }
        else if (e.type !== 'ripasso' && tp.status === 'todo') { e.marked.push([tp.id, tp.status]); tp.status = 'done'; tp.doneAt = e.date; }
      });
    }
  } else {
    S.log = S.log.filter(l => !(l.eventId === id && l.source === 'sessione'));
    if (s && e.marked) e.marked.forEach(([tid, prev]) => { const tp = s.topics.find(x => x.id === tid); if (tp) tp.status = prev; });
    e.marked = [];
  }
  save(); render();
}

// ---------- Tempo registrato a mano ----------
function openLog(d) {
  const st = { date: d, subjectId: S.subjects[0] ? S.subjects[0].id : null, minutes: 30 };
  openSheet({
    state: st,
    render: st => {
      const entries = S.log.filter(l => l.date === st.date);
      const src = { timer: 'timer', sessione: 'sessione spuntata', manuale: 'a mano' };
      return `${sheetHead('Registra tempo di studio')}
      <p class="hint" style="margin:0">Per quando studi senza timer. Il tempo entra nei progressi e riempie il pozzetto del giorno.</p>
      <div class="field"><label for="lg-date">Giorno</label><input id="lg-date" class="inp" type="date" data-k="date" data-repaint value="${st.date}"></div>
      <div class="field"><span class="lab">Materia</span>${chips('subjectId', S.subjects.map(x => ({ v: x.id, l: x.name, c: `var(--c${x.color})` })).concat([{ v: null, l: 'Nessuna' }]), st.subjectId)}</div>
      <div class="field"><span class="lab">Quanto</span>${chips('minutes', [15, 30, 45, 60, 90, 120, 180].map(n => ({ v: n, l: fmtMin(n) })), st.minutes, 'wrap')}</div>
      <div class="form-actions"><button class="btn wide" data-sact="add">Aggiungi ${fmtMin(st.minutes)}</button></div>
      ${entries.length ? `<div class="sec-title"><h3>Già registrato il ${fmtShort(st.date)}</h3></div><ul class="list">${entries.map(l => `
        <li class="row"><span class="dot" style="--c:${subjVar(l.subjectId)}"></span><span class="body"><span class="t1">${fmtMin(l.minutes)}${l.subjectId ? `, ${esc(subjName(l.subjectId))}` : ''}</span><span class="t2">${src[l.source] || ''}</span></span>
        <button class="ib" data-sact="del" data-id="${l.id}" aria-label="Elimina">${icon('trash-2', 'ico ico-s')}</button></li>`).join('')}</ul>` : ''}`;
    },
    onAct: (a, t) => {
      if (a === 'add') {
        if (!st.date) return;
        S.log.push({ id: uid(), date: st.date, subjectId: st.subjectId || null, minutes: st.minutes, eventId: null, source: 'manuale' });
        save(); render(); paintSheet(); toast(`Registrati ${fmtMin(st.minutes)}`);
      }
      if (a === 'del') {
        const l = S.log.find(x => x.id === t.dataset.id);
        S.log = S.log.filter(x => x.id !== t.dataset.id);
        if (l && l.eventId && l.source === 'sessione') { const e = evById(l.eventId); if (e) e.done = false; }
        save(); render(); paintSheet();
      }
    },
  });
}

// ---------- Materie ----------
function viewSubjects() {
  const rows = S.subjects.map(s => {
    const ex = nextExam(s.id);
    const done = s.topics.filter(t => t.status !== 'todo').length;
    const meta = [
      s.topics.length ? `${done} di ${s.topics.length} argomenti` : 'Nessun argomento',
      ex ? `esame ${relDays(diffDays(today(), ex.date))}` : '',
    ].filter(Boolean).join(', ');
    return `<li><button class="row subj-row" style="--c:var(--c${s.color})" data-act="subj-open" data-id="${s.id}">
      <span class="well" style="--fill:${subjProgress(s).toFixed(3)}"><span class="liquid" style="background:color-mix(in srgb, var(--c) 62%, var(--well))"></span></span>
      <span class="body"><span class="t1">${esc(s.name)}</span><span class="t2">${esc(meta)}</span></span>
      ${icon('chevron-right', 'ico faint')}
    </button></li>`;
  }).join('');
  return `<header class="top"><h1>Materie</h1><button class="ib solid" data-act="subj-new" aria-label="Nuova materia">${icon('plus')}</button></header>
  ${rows ? `<p class="hint" style="margin:0 0 4px">Il pozzetto si riempie con gli argomenti studiati.</p><ul class="list">${rows}</ul>`
    : `<div class="empty"><p>Aggiungi le materie che stai preparando. Per ognuna puoi segnare la data d'esame, la lista degli argomenti e farti generare un piano di studio.</p><button class="btn" data-act="subj-new">${icon('plus', 'ico ico-s')}Aggiungi materia</button></div>`}`;
}

function viewSubject() {
  const s = subj(UI.subjectId);
  const t = today();
  const ex = nextExam(s.id);
  const done = s.topics.filter(x => x.status !== 'todo').length;
  const mins = subjMinutes(s.id);
  const upcoming = S.events.filter(e => e.subjectId === s.id && e.date >= t && e.type !== 'esame').sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  const planCount = S.events.filter(e => e.planId && e.subjectId === s.id && !e.done && e.date >= t).length;
  const notes = S.notes.filter(n => n.subjectId === s.id).sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
  const todo = s.topics.filter(x => x.status === 'todo').length;

  const topics = s.topics.map(tp => `
    <li class="row">
      <button class="chk ${tp.status === 'done' ? 'half' : ''}" style="--c:var(--c${s.color})" data-act="topic-cycle" data-sid="${s.id}" data-id="${tp.id}" aria-pressed="${tp.status === 'review'}" aria-label="${STATUS[tp.status]}: tocca per cambiare">${icon('check')}</button>
      <button class="body" data-act="topic-menu" data-sid="${s.id}" data-id="${tp.id}"><span class="t1">${esc(tp.title)}</span><span class="t2">${STATUS[tp.status]}${tp.doneAt && tp.status !== 'todo' ? `, ${fmtShort(tp.doneAt)}` : ''}</span></button>
    </li>`).join('');

  return `
  <header class="top"><button class="ib" data-act="subj-back" aria-label="Torna alle materie">${icon('chevron-left')}</button><span style="flex:1"></span>
    <button class="ib" data-act="subj-edit" data-id="${s.id}" aria-label="Modifica materia">${icon('pencil')}</button></header>
  <section class="subj-hero" style="--c:var(--c${s.color})">
    <h1><span class="dot"></span>${esc(s.name)}</h1>
    ${s.teacher || s.cfu ? `<p class="muted" style="margin:6px 0 0;font-size:15px">${esc([s.teacher, s.cfu ? `${s.cfu} CFU` : ''].filter(Boolean).join(', '))}</p>` : ''}
    <div class="facts">
      ${ex ? `<button class="fact hot" data-act="ev-open" data-id="${ex.id}" style="text-align:left"><b>${diffDays(t, ex.date) === 0 ? 'Oggi' : diffDays(t, ex.date)}</b><span>${diffDays(t, ex.date) === 0 ? 'è il giorno dell\'esame' : `giorni all'esame, ${fmtShort(ex.date)}`}</span></button>` : ''}
      <div class="fact"><b>${done}/${s.topics.length}</b><span>argomenti studiati</span></div>
      <div class="fact"><b>${fmtH(mins)}</b><span>ore di studio</span></div>
    </div>
    <div class="actions">
      ${ex ? '' : `<button class="btn sm" data-act="ev-new" data-type="esame" data-sid="${s.id}">${icon('flag', 'ico ico-s')}Segna la data d'esame</button>`}
      ${ex && todo && diffDays(t, ex.date) >= 1 ? `<button class="btn sm" data-act="plan-open" data-sid="${s.id}">${icon('calendar-range', 'ico ico-s')}Genera piano fino all'esame</button>` : ''}
      <button class="btn sm ghost" data-act="subj-timer" data-sid="${s.id}">${icon('timer', 'ico ico-s')}Timer</button>
      <button class="btn sm ghost" data-act="ev-new" data-type="studio" data-sid="${s.id}" data-date="${t}">${icon('plus', 'ico ico-s')}Sessione</button>
    </div>
  </section>

  <div class="sec-title"><h3>Argomenti</h3><button class="link" data-act="topics-add" data-sid="${s.id}">Aggiungi</button></div>
  ${topics ? `<p class="hint" style="margin:0 0 2px">Tocca il cerchio: vuoto da studiare, metà studiato, pieno ripassato.</p><ul class="list">${topics}</ul>`
    : `<div class="empty"><p>Incolla la lista degli argomenti del programma, uno per riga. Serve per il piano di studio e per segnare i progressi.</p><button class="btn sm" data-act="topics-add" data-sid="${s.id}">${icon('list-checks', 'ico ico-s')}Aggiungi argomenti</button></div>`}

  <div class="sec-title"><h3>In programma</h3>${planCount ? `<button class="link" data-act="plan-clear" data-sid="${s.id}">Elimina piano</button>` : ''}</div>
  ${upcoming.length ? `<ul class="list">${upcoming.slice(0, 8).map(e => rowEvent(e, { date: true })).join('')}</ul>${upcoming.length > 8 ? `<p class="hint">E altre ${upcoming.length - 8} nel calendario.</p>` : ''}` : `<p class="hint" style="margin:0">Nessuna sessione in programma.</p>`}

  <div class="sec-title"><h3>Note della materia</h3><button class="link" data-act="note-new" data-sid="${s.id}">Scrivi</button></div>
  ${notes.length ? `<ul class="list">${notes.map(rowNote).join('')}</ul>` : `<p class="hint" style="margin:0">Riassunti brevi, domande frequenti all'orale, formule.</p>`}`;
}

function nextFreeColor() {
  const used = S.subjects.map(s => s.color);
  for (let i = 1; i < 8; i++) if (!used.includes(i)) return i;
  if (!used.includes(0)) return 0;
  return S.subjects.length % 8;
}

function openSubject(id) {
  const orig = id ? subj(id) : null;
  const st = orig ? { name: orig.name, color: orig.color, cfu: orig.cfu || '', teacher: orig.teacher || '' } : { name: '', color: nextFreeColor(), cfu: '', teacher: '' };
  openSheet({
    state: st,
    render: st => `${sheetHead(orig ? 'Modifica materia' : 'Nuova materia')}
      <div class="field"><label for="sb-name">Nome</label><input id="sb-name" class="inp" data-k="name" value="${esc(st.name)}" placeholder="Es. Farmacologia" autocomplete="off"></div>
      <div class="field"><span class="lab">Colore</span><div class="swatches">${COLOR_NAMES.map((n, i) => `<button class="swatch" style="--c:var(--c${i})" data-sact="chip" data-k="color" data-v="${i}" data-num aria-pressed="${st.color === i}" aria-label="${n}" title="${n}">${icon('check')}</button>`).join('')}</div>
        <p class="hint">${COLOR_NAMES[st.color]}</p></div>
      <div class="grid2">
        <div class="field"><label for="sb-cfu">CFU</label><input id="sb-cfu" class="inp" type="number" inputmode="numeric" min="0" max="30" data-k="cfu" value="${esc(st.cfu)}"></div>
        <div class="field"><label for="sb-teacher">Docente</label><input id="sb-teacher" class="inp" data-k="teacher" value="${esc(st.teacher)}" autocomplete="off"></div>
      </div>
      <div class="form-actions"><button class="btn wide" data-sact="save">Salva</button>
        ${orig ? `<button class="btn danger wide" data-sact="delete">${icon('trash-2', 'ico ico-s')}Elimina materia</button>` : ''}</div>`,
    onAct: async a => {
      if (a === 'save') {
        const name = (st.name || '').trim();
        if (!name) { toast('Scrivi il nome della materia.'); $('#sb-name') && $('#sb-name').focus(); return; }
        if (orig) Object.assign(orig, { name, color: st.color, cfu: st.cfu || '', teacher: (st.teacher || '').trim() });
        else { const s = { id: uid(), name, color: st.color, cfu: st.cfu || '', teacher: (st.teacher || '').trim(), topics: [], createdAt: Date.now() }; S.subjects.push(s); UI.subjectId = s.id; }
        save(); closeSheet(); UI.tab = 'sub'; render();
        toast(orig ? 'Materia salvata' : 'Materia aggiunta');
      }
      if (a === 'delete') {
        const n = S.events.filter(e => e.subjectId === orig.id).length;
        const ok = await confirmSheet({ title: `Eliminare ${orig.name}?`, text: `Verranno eliminati gli argomenti e ${n} attività in calendario. Le note e il tempo già studiato restano, senza materia.`, ok: 'Elimina materia', danger: true });
        if (!ok) return;
        S.subjects = S.subjects.filter(s => s.id !== orig.id);
        S.events = S.events.filter(e => e.subjectId !== orig.id);
        S.notes.forEach(x => { if (x.subjectId === orig.id) x.subjectId = null; });
        S.log.forEach(x => { if (x.subjectId === orig.id) x.subjectId = null; });
        UI.subjectId = null; save(); render(); toast('Materia eliminata');
      }
    },
  });
}

function openTopicsAdd(sid) {
  const s = subj(sid);
  const st = { text: '' };
  openSheet({
    state: st,
    render: st => `${sheetHead('Aggiungi argomenti')}
      <p class="hint" style="margin:0">Uno per riga. Puoi incollare direttamente l'elenco dal programma o dagli appunti: elenchi puntati e numeri vengono tolti.</p>
      <div class="field"><textarea class="inp" style="min-height:220px" data-k="text" placeholder="Infiammazione acuta&#10;Mediatori chimici&#10;Sistema del complemento">${esc(st.text)}</textarea></div>
      <div class="form-actions"><button class="btn wide" data-sact="add">Aggiungi a ${esc(s.name)}</button></div>`,
    onAct: a => {
      if (a !== 'add') return;
      const lines = (st.text || '').split('\n').map(l => l.replace(/^\s*(?:[-•*·–]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      if (!lines.length) { toast('Scrivi almeno un argomento.'); return; }
      lines.forEach(title => s.topics.push({ id: uid(), title, status: 'todo', doneAt: null }));
      save(); closeSheet(); render();
      toast(lines.length === 1 ? 'Argomento aggiunto' : `Aggiunti ${lines.length} argomenti`);
    },
  });
}

function cycleTopic(sid, tid) {
  const s = subj(sid); const tp = s && s.topics.find(x => x.id === tid); if (!tp) return;
  tp.status = tp.status === 'todo' ? 'done' : tp.status === 'done' ? 'review' : 'todo';
  tp.doneAt = tp.status === 'todo' ? null : today();
  save(); render();
}

const REVIEW_STEPS = [1, 3, 7, 14];
function scheduleReviews(s, tp) {
  const ex = nextExam(s.id); const t = today();
  const dates = REVIEW_STEPS.map(n => addDays(t, n)).filter(d => !ex || d < ex.date);
  if (!dates.length) { toast('Non c\'è tempo per ripassi prima dell\'esame.'); return; }
  dates.forEach(d => S.events.push({ id: uid(), type: 'ripasso', subjectId: s.id, title: '', topicIds: [tp.id], date: d, start: '', dur: 30, place: '', notes: '', done: false }));
  save();
  toast(`Ripassi in calendario: ${dates.map(fmtShort).join(', ')}`);
}

function openTopic(sid, tid) {
  const s = subj(sid); const tp = s && s.topics.find(x => x.id === tid); if (!tp) return;
  const st = { title: tp.title, status: tp.status };
  openSheet({
    state: st,
    render: st => `${sheetHead('Argomento')}
      <div class="field"><label for="tp-title">Titolo</label><input id="tp-title" class="inp" data-k="title" value="${esc(st.title)}"></div>
      <div class="field"><span class="lab">Stato</span>${chips('status', Object.keys(STATUS).map(k => ({ v: k, l: STATUS[k] })), st.status)}</div>
      <div class="form-actions">
        <button class="btn wide" data-sact="save">Salva</button>
        <button class="btn ghost wide" data-sact="reviews">${icon('repeat', 'ico ico-s')}Pianifica ripassi tra 1, 3, 7 e 14 giorni</button>
        <button class="btn ghost wide" data-sact="session">${icon('plus', 'ico ico-s')}Crea una sessione su questo argomento</button>
        <button class="btn danger wide" data-sact="delete">${icon('trash-2', 'ico ico-s')}Elimina argomento</button>
      </div>`,
    onAct: async a => {
      if (a === 'save') {
        tp.title = (st.title || '').trim() || tp.title;
        if (tp.status !== st.status) { tp.status = st.status; tp.doneAt = st.status === 'todo' ? null : today(); }
        save(); closeSheet(); render();
      }
      if (a === 'reviews') { closeSheet(); scheduleReviews(s, tp); render(); }
      if (a === 'session') {
        closeSheet();
        openEvent(null, { type: 'studio', subjectId: s.id, date: today() });
        if (ctx) { ctx.state.topicIds = [tp.id]; paintSheet(); }
      }
      if (a === 'delete') {
        const ok = await confirmSheet({ title: 'Eliminare l\'argomento?', text: `"${tp.title}" verrà tolto dalla lista.`, ok: 'Elimina', danger: true });
        if (!ok) return;
        s.topics = s.topics.filter(x => x.id !== tid);
        S.events.forEach(e => { e.topicIds = e.topicIds.filter(x => x !== tid); });
        save(); render();
      }
    },
  });
}

// ---------- Piano di studio automatico ----------
function planCompute(s, st) {
  const ex = nextExam(s.id);
  if (!ex) return { error: 'Segna prima la data d\'esame.' };
  const t = today();
  const start = st.from === 'today' ? t : addDays(t, 1);
  const dates = [];
  for (let d = start; d < ex.date; d = addDays(d, 1)) if (st.days.includes(parseD(d).getDay())) dates.push(d);
  const topics = s.topics.filter(x => x.status === 'todo');
  if (!topics.length) return { error: 'Tutti gli argomenti sono già segnati come studiati. Per ripassarli usa "Pianifica ripassi" su ogni argomento.' };
  if (!dates.length) return { error: 'Prima dell\'esame non ci sono giorni liberi con i giorni della settimana scelti.' };
  const rev = Math.min(st.review, Math.max(0, dates.length - 1));
  const studyDates = dates.slice(0, dates.length - rev);
  const revDates = dates.slice(dates.length - rev);
  const groups = new Map();
  topics.forEach((tp, i) => {
    const d = studyDates[Math.floor(i * studyDates.length / topics.length)];
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(tp.id);
  });
  const sizes = [...groups.values()].map(g => g.length);
  const mn = Math.min(...sizes), mx = Math.max(...sizes);
  return { ex, groups, revDates, per: mn === mx ? `${mn}` : `${mn}-${mx}`, first: [...groups.keys()][0], last: [...groups.keys()].pop() };
}

function openPlan(sid) {
  const s = subj(sid);
  const st = { days: [1, 2, 3, 4, 5, 6], min: 120, from: 'tomorrow', review: 2, start: '' };
  openSheet({
    state: st,
    render: st => {
      const p = planCompute(s, st);
      const old = S.events.filter(e => e.planId && e.subjectId === s.id && !e.done && e.date >= today()).length;
      let preview;
      if (p.error) preview = `<p class="muted" style="margin:0">${esc(p.error)}</p>`;
      else preview = `<p style="margin:0">${p.groups.size} ${p.groups.size === 1 ? 'sessione' : 'sessioni'} da ${fmtMin(st.min)} dal ${fmtShort(p.first)} al ${fmtShort(p.last)}, con ${p.per} ${p.per === '1' ? 'argomento' : 'argomenti'} ciascuna${p.revDates.length ? `, poi ${p.revDates.length} ${p.revDates.length === 1 ? 'giorno' : 'giorni'} di ripasso generale` : ''}. Esame il ${fmtShort(p.ex.date)}.</p>
        ${old ? `<p class="hint">Sostituisce il piano creato prima (${old} sessioni future non ancora fatte).</p>` : ''}`;
      return `${sheetHead('Piano fino all\'esame')}
      <p class="hint" style="margin:0">Distribuisco gli argomenti ancora da studiare di ${esc(s.name)} sui giorni che scegli.</p>
      <div class="field"><span class="lab">Giorni di studio</span><div class="chips">${WEEK.map((d, i) => `<button class="chip" data-sact="multi" data-k="days" data-v="${d}" data-num aria-pressed="${st.days.includes(d)}" aria-label="${GIORNI[d]}">${GG[i]}</button>`).join('')}</div></div>
      <div class="field"><span class="lab">Durata di ogni sessione</span>${chips('min', [60, 90, 120, 180, 240].map(n => ({ v: n, l: fmtMin(n) })), st.min)}</div>
      <div class="grid2">
        <div class="field"><span class="lab">Inizio</span>${chips('from', [{ v: 'today', l: 'Oggi' }, { v: 'tomorrow', l: 'Domani' }], st.from)}</div>
        <div class="field"><label for="pl-start">Ora (facoltativa)</label><input id="pl-start" class="inp" type="time" data-k="start" value="${st.start}"></div>
      </div>
      <div class="field"><span class="lab">Giorni di ripasso generale prima dell'esame</span>${chips('review', [0, 1, 2, 3].map(n => ({ v: n, l: String(n) })), st.review)}</div>
      <div class="field" style="padding:12px 14px;border-radius:12px;background:var(--surface-2)">${preview}</div>
      <div class="form-actions"><button class="btn wide" data-sact="create" ${p.error ? 'disabled' : ''}>Crea il piano</button></div>`;
    },
    onAct: a => {
      if (a !== 'create') return;
      const p = planCompute(s, st); if (p.error) return;
      const t = today();
      S.events = S.events.filter(e => !(e.planId && e.subjectId === s.id && !e.done && e.date >= t));
      const planId = uid();
      p.groups.forEach((ids, d) => S.events.push({ id: uid(), type: 'studio', subjectId: s.id, title: '', topicIds: ids, date: d, start: st.start || '', dur: st.min, place: '', notes: '', done: false, planId }));
      p.revDates.forEach(d => S.events.push({ id: uid(), type: 'ripasso', subjectId: s.id, title: 'Ripasso generale', topicIds: [], date: d, start: st.start || '', dur: st.min, place: '', notes: '', done: false, planId }));
      save(); closeSheet(); render();
      toast(`Piano creato: ${p.groups.size + p.revDates.length} sessioni in calendario`);
    },
  });
}

async function clearPlan(sid) {
  const t = today();
  const evs = S.events.filter(e => e.planId && e.subjectId === sid && !e.done && e.date >= t);
  const ok = await confirmSheet({ title: 'Eliminare il piano?', text: `Tolgo dal calendario le ${evs.length} sessioni future generate in automatico. Quelle già fatte restano.`, ok: 'Elimina piano', danger: true });
  if (!ok) return;
  const ids = new Set(evs.map(e => e.id));
  S.events = S.events.filter(e => !ids.has(e.id));
  save(); render(); toast('Piano eliminato');
}

// ---------- Timer di studio ----------
function modeLen(m) { const st = S.settings; return (m === 'focus' ? st.focus : m === 'short' ? st.short : st.long) * 60; }
function loadTimer() {
  try { const t = JSON.parse(localStorage.getItem(TKEY)); if (t && t.mode) return t; } catch (e) { /* niente */ }
  return { mode: 'focus', running: false, endAt: 0, remaining: modeLen('focus'), total: modeLen('focus'), subjectId: S.subjects[0] ? S.subjects[0].id : null, eventId: null, cycle: 0, day: today() };
}
let T = loadTimer();
function saveTimer() { try { localStorage.setItem(TKEY, JSON.stringify(T)); } catch (e) { /* niente */ } }
const timerLeft = () => T.running ? Math.max(0, Math.round((T.endAt - Date.now()) / 1000)) : T.remaining;
const MODES = { focus: 'Studio', short: 'Pausa breve', long: 'Pausa lunga' };

let wake = null;
async function wakeOn() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { wake && wake.release(); } catch (e) { /* niente */ } wake = null; }

let audioCtx = null;
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; } }
function chime() {
  if (!S.settings.sound || !audioCtx) return;
  const now = audioCtx.currentTime;
  [[880, 0], [1175, .18], [1568, .36]].forEach(([f, d]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, now + d); g.gain.linearRampToValueAtTime(.25, now + d + .02); g.gain.exponentialRampToValueAtTime(.001, now + d + .6);
    o.connect(g).connect(audioCtx.destination); o.start(now + d); o.stop(now + d + .65);
  });
}

function setMode(m) { T.mode = m; T.running = false; T.total = modeLen(m); T.remaining = T.total; wakeOff(); saveTimer(); }
function logFocus(minutes, dateStr) {
  if (minutes < 1) return 0;
  minutes = Math.round(minutes);
  S.log.push({ id: uid(), date: dateStr || today(), subjectId: T.subjectId || null, minutes, eventId: T.eventId || null, source: 'timer' });
  const e = T.eventId && evById(T.eventId);
  if (e && !e.done) {
    const got = S.log.filter(l => l.eventId === e.id && l.source === 'timer').reduce((s, l) => s + l.minutes, 0);
    if (got >= (e.dur || 0)) { e.done = true; toast(`Sessione completata: ${evTitle(e)}`); }
  }
  save();
  return minutes;
}
function timerStart() {
  unlockAudio();
  if (T.remaining <= 0) T.remaining = T.total;
  T.running = true; T.endAt = Date.now() + T.remaining * 1000; T.day = today();
  wakeOn(); saveTimer(); paintTimer();
}
function timerPause() { T.remaining = timerLeft(); T.running = false; wakeOff(); saveTimer(); paintTimer(); }
function timerComplete(late) {
  const wasFocus = T.mode === 'focus';
  if (wasFocus) {
    const m = logFocus(T.total / 60, late ? ymd(new Date(T.endAt)) : today());
    T.cycle = (T.cycle || 0) + 1;
    if (!late) chime();
    toast(`Registrati ${fmtMin(m)} di studio. Adesso pausa.`);
    setMode(T.cycle % (S.settings.longEvery || 4) === 0 ? 'long' : 'short');
  } else {
    if (!late) chime();
    toast('Pausa finita.');
    setMode('focus');
  }
  if (UI.tab === 'tim') render(); else if (UI.tab === 'cal') render();
}
function timerReset() {
  if (T.mode === 'focus') {
    const elapsed = (T.total - timerLeft()) / 60;
    const m = elapsed >= 1 ? logFocus(elapsed) : 0;
    if (m) toast(`Registrati ${fmtMin(m)} di studio`);
  }
  setMode(T.mode); render();
}
function timerSkip() {
  if (T.mode === 'focus') {
    const elapsed = (T.total - timerLeft()) / 60;
    const m = elapsed >= 1 ? logFocus(elapsed) : 0;
    T.cycle = (T.cycle || 0) + 1;
    if (m) toast(`Registrati ${fmtMin(m)} di studio`);
    setMode(T.cycle % (S.settings.longEvery || 4) === 0 ? 'long' : 'short');
  } else setMode('focus');
  render();
}
function linkTimer(e) {
  T.eventId = e ? e.id : null;
  if (e) T.subjectId = e.subjectId || null;
  if (!T.running && T.mode !== 'focus') setMode('focus');
  saveTimer(); UI.tab = 'tim'; render(); scrollTo(0, 0);
}

function viewTimer() {
  const t = today();
  if (T.day !== t && !T.running) { T.cycle = 0; T.day = t; saveTimer(); }
  if (!T.subjChosen && !T.subjectId && S.subjects.length) T.subjectId = S.subjects[0].id;
  if (T.subjectId && !subj(T.subjectId)) T.subjectId = null;
  if (!T.running && T.remaining === T.total && T.total !== modeLen(T.mode)) { T.total = modeLen(T.mode); T.remaining = T.total; }
  const todays = S.events.filter(e => e.date === t && TYPES[e.type].check && !e.done && (!T.subjectId || e.subjectId === T.subjectId));
  const focusToday = S.log.filter(l => l.date === t && l.source === 'timer').reduce((s, l) => s + l.minutes, 0);
  const subjOpts = S.subjects.map(x => ({ v: x.id, l: x.name, c: `var(--c${x.color})` })).concat([{ v: null, l: 'Senza materia' }]);
  const every = S.settings.longEvery || 4;
  const inCycle = (T.cycle || 0) % every;
  return `<header class="top"><h1>Timer</h1><button class="ib" data-act="settings" aria-label="Impostazioni">${icon('settings')}</button></header>
  <div class="timer-wrap">
    <div class="chips" role="group" aria-label="Modalità">${Object.keys(MODES).map(k => `<button class="chip" data-act="t-mode" data-v="${k}" aria-pressed="${T.mode === k}">${MODES[k]}</button>`).join('')}</div>
    <div class="big-well ${T.mode !== 'focus' ? 'brk' : ''}" id="t-well" role="timer" aria-live="off">
      <span class="liquid"></span>
      <span class="mode" id="t-mode">${MODES[T.mode]}</span>
      <span class="digits" id="t-digits">00:00</span>
      <span class="sub">${esc(T.mode === 'focus' ? (subjName(T.subjectId) || 'Senza materia') : 'Alzati, bevi un bicchiere d\'acqua')}</span>
    </div>
    <div class="cycles" aria-label="Sessioni completate nel ciclo: ${inCycle} di ${every}">${Array.from({ length: every }, (_, i) => `<i class="${i < inCycle ? 'on' : ''}"></i>`).join('')}</div>
    <div class="timer-ctrl">
      <button class="round" data-act="t-reset" aria-label="Ferma e azzera">${icon('rotate-ccw')}</button>
      <button class="play" data-act="t-toggle" id="t-play" aria-label="Avvia">${icon('play')}</button>
      <button class="round" data-act="t-skip" aria-label="Salta alla fase successiva">${icon('skip-forward')}</button>
    </div>
    <div class="timer-field"><label>Materia</label><div class="chips">${subjOpts.map(o => `<button class="chip" data-act="t-subj" data-v="${o.v === null ? 'null' : o.v}" aria-pressed="${o.v === (T.subjectId || null)}">${o.c ? `<span class="dot" style="--c:${o.c}"></span>` : ''}${esc(o.l)}</button>`).join('')}</div></div>
    ${todays.length ? `<div class="timer-field"><label for="t-event">Sessione di oggi</label><select class="inp" id="t-event"><option value="">Nessuna</option>${todays.map(e => `<option value="${e.id}" ${e.id === T.eventId ? 'selected' : ''}>${esc(evTitle(e))} (${fmtMin(e.dur)})</option>`).join('')}</select>
      <p class="hint">Quando il tempo col timer arriva alla durata della sessione, la spunto io.</p></div>` : ''}
    <p class="today-focus">Oggi col timer: <b>${fmtMin(focusToday)}</b>. Fasi da ${S.settings.focus} min di studio e ${S.settings.short} di pausa; ogni ${every} una pausa da ${S.settings.long}.</p>
    <p class="hint" style="text-align:center">Tieni l'app aperta: iPhone ferma i timer delle app web in background, ma al ritorno il tempo è calcolato giusto.</p>
  </div>`;
}
function paintTimer() {
  const dg = $('#t-digits'); if (!dg) return;
  const left = timerLeft();
  dg.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
  const w = $('#t-well');
  const frac = T.total ? 1 - left / T.total : 0;
  w.style.setProperty('--fill', clamp(frac, 0, 1).toFixed(4));
  const p = $('#t-play');
  p.innerHTML = icon(T.running ? 'pause' : 'play');
  p.setAttribute('aria-label', T.running ? 'Pausa' : 'Avvia');
  document.title = T.running ? `${dg.textContent} ${MODES[T.mode]}` : 'Studio';
}
setInterval(() => {
  if (!T.running) return;
  if (timerLeft() <= 0) { timerComplete(false); return; }
  if (UI.tab === 'tim' && !document.hidden) paintTimer();
}, 500);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (T.running && timerLeft() <= 0) timerComplete(true);
  if (T.running) wakeOn();
  if (UI.day !== today()) { UI.day = today(); UI.sel = today(); UI.month = today().slice(0, 7); }
  render();
});

// ---------- Note ----------
function viewNotes() {
  return `<header class="top"><h1>Note</h1><button class="ib solid" data-act="note-new" aria-label="Nuova nota">${icon('plus')}</button></header>
  <label class="search">${icon('search', 'ico faint')}<span class="sr">Cerca nelle note</span><input id="note-q" type="search" placeholder="Cerca" value="${esc(UI.noteQ)}" autocomplete="off"></label>
  <div class="chips" role="group" aria-label="Filtro">
    <button class="chip" data-act="note-filter" data-v="all" aria-pressed="${UI.noteF === 'all'}">Tutte</button>
    <button class="chip" data-act="note-filter" data-v="pin" aria-pressed="${UI.noteF === 'pin'}">Fissate</button>
    ${S.subjects.map(s => `<button class="chip" data-act="note-filter" data-v="${s.id}" aria-pressed="${UI.noteF === s.id}"><span class="dot" style="--c:var(--c${s.color})"></span>${esc(s.name)}</button>`).join('')}
  </div>
  <div id="notes-list">${notesList()}</div>`;
}
function notesList() {
  const q = UI.noteQ.trim().toLowerCase();
  let ns = S.notes.slice();
  if (UI.noteF === 'pin') ns = ns.filter(n => n.pinned);
  else if (UI.noteF !== 'all') ns = ns.filter(n => n.subjectId === UI.noteF);
  if (q) ns = ns.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q));
  ns.sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
  if (!ns.length) {
    if (!S.notes.length) return `<div class="empty"><p>Scrivi qui riassunti brevi, domande da fare al prof, collegamenti tra argomenti. Puoi legare ogni nota a una materia o a un giorno.</p><button class="btn" data-act="note-new">${icon('plus', 'ico ico-s')}Scrivi una nota</button></div>`;
    return `<div class="empty"><p>${q ? `Nessuna nota contiene "${esc(UI.noteQ)}".` : 'Nessuna nota con questo filtro.'}</p></div>`;
  }
  return `<ul class="list">${ns.map(rowNote).join('')}</ul>`;
}
document.addEventListener('input', e => {
  if (e.target.id === 'note-q') { UI.noteQ = e.target.value; const l = $('#notes-list'); if (l) l.innerHTML = notesList(); }
});

function openNote(id, preset = {}) {
  const orig = id ? S.notes.find(n => n.id === id) : null;
  const st = orig ? { title: orig.title, body: orig.body, subjectId: orig.subjectId, date: orig.date || '', pinned: !!orig.pinned }
    : { title: '', body: '', subjectId: preset.subjectId || (UI.noteF !== 'all' && UI.noteF !== 'pin' ? UI.noteF : null), date: preset.date || '', pinned: false };
  const persist = () => {
    const title = (st.title || '').trim(), body = (st.body || '').replace(/\s+$/, '');
    if (!title && !body.trim()) { if (orig) S.notes = S.notes.filter(n => n.id !== orig.id); save(); render(); return; }
    const data = { title, body, subjectId: st.subjectId || null, date: st.date || '', pinned: !!st.pinned, updatedAt: Date.now() };
    if (orig) Object.assign(orig, data); else S.notes.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
    save(); render();
  };
  openSheet({
    tall: true, state: st,
    render: st => `<div class="sheet-head"><h2 class="sr">${orig ? 'Modifica nota' : 'Nuova nota'}</h2><span style="flex:1"></span>
        <button class="ib" data-sact="pin" aria-label="${st.pinned ? 'Togli dalle fissate' : 'Fissa in alto'}" aria-pressed="${st.pinned}">${icon(st.pinned ? 'pin-off' : 'pin')}</button>
        ${orig ? `<button class="ib" data-sact="delete" aria-label="Elimina nota">${icon('trash-2')}</button>` : ''}
        <button class="txt-btn" data-sact="close">Fatto</button></div>
      <input class="note-title" data-k="title" value="${esc(st.title)}" placeholder="Titolo" aria-label="Titolo" autocomplete="off">
      <div class="note-meta">
        <select class="inp" style="width:auto;min-height:38px;padding:6px 10px;font-size:15px" data-k="subjectId" aria-label="Materia">
          <option value="">Nessuna materia</option>${S.subjects.map(s => `<option value="${s.id}" ${s.id === st.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <input class="inp" type="date" style="width:auto;min-height:38px;padding:6px 10px;font-size:15px" data-k="date" value="${st.date}" aria-label="Giorno (facoltativo)">
      </div>
      <textarea class="note-body" data-k="body" placeholder="Scrivi qui" aria-label="Testo della nota">${esc(st.body)}</textarea>`,
    onAct: async a => {
      if (a === 'pin') { st.pinned = !st.pinned; const b = sheetEl.querySelector('[data-sact="pin"]'); b.innerHTML = icon(st.pinned ? 'pin-off' : 'pin'); b.setAttribute('aria-pressed', st.pinned); }
      if (a === 'delete') {
        persist(); // salva le modifiche prima di chiedere, così annullando non si perde nulla
        const ok = await confirmSheet({ title: 'Eliminare la nota?', text: 'Non si può recuperare, a meno di un backup.', ok: 'Elimina', danger: true });
        if (ok) { S.notes = S.notes.filter(n => n.id !== orig.id); save(); render(); toast('Nota eliminata'); }
      }
    },
    onDismiss: () => { persist(); },
  });
}

// ---------- Progressi ----------
function streak() {
  const mins = minutesMap();
  let d = today(); if (!mins[d]) d = addDays(d, -1);
  let n = 0; while (mins[d]) { n++; d = addDays(d, -1); }
  return n;
}
function viewStats() {
  const t = today();
  const R = UI.range;
  const from = addDays(t, -(R - 1));
  const prevFrom = addDays(from, -R);
  const inRange = S.log.filter(l => l.date >= from && l.date <= t);
  const total = inRange.reduce((s, l) => s + l.minutes, 0);
  const prev = S.log.filter(l => l.date >= prevFrom && l.date < from).reduce((s, l) => s + l.minutes, 0);
  const st = streak();
  const goal = S.settings.goal || 120;

  if (!S.log.length) {
    return `<header class="top"><h1>Progressi</h1></header>
    <div class="empty"><p>Qui vedrai quanto studi ogni giorno e per quale materia. Si riempie quando usi il timer, spunti una sessione fatta o registri il tempo a mano dal calendario.</p>
    <button class="btn" data-act="tab" data-tab="tim">${icon('timer', 'ico ico-s')}Apri il timer</button></div>`;
  }

  // dati per giorno e materia
  const order = S.subjects.map(s => s.id).concat([null]);
  const days = [];
  for (let i = 0; i < R; i++) {
    const d = addDays(from, i);
    const per = {}; inRange.filter(l => l.date === d).forEach(l => { const k = l.subjectId && subj(l.subjectId) ? l.subjectId : null; per[k] = (per[k] || 0) + l.minutes; });
    days.push({ d, per, tot: Object.values(per).reduce((a, b) => a + b, 0) });
  }
  const max = Math.max(goal, ...days.map(x => x.tot)) * 1.08;
  const sel = UI.bar && days.find(x => x.d === UI.bar) ? UI.bar : null;
  const bars = days.map((x, i) => {
    const segs = order.filter(k => x.per[k]).map(k => `<i style="height:${(x.per[k] / max * 148).toFixed(1)}px;background:${k ? subjVar(k) : 'var(--ink-3)'}"></i>`).join('');
    const dd = parseD(x.d);
    const showLbl = R <= 7 || i % 5 === 0 || i === R - 1;
    const lbl = R <= 7 ? `${GG[(dd.getDay() + 6) % 7]} ${dd.getDate()}` : (showLbl ? dd.getDate() : '');
    return `<button class="bar ${x.d === sel ? 'on' : ''}" data-act="bar" data-d="${x.d}" aria-label="${esc(fmtLong(x.d))}: ${fmtMin(x.tot)}"><span class="stack">${segs}</span><span class="lbl">${lbl}</span></button>`;
  }).join('');
  let detail = `<span class="faint">Tocca una barra per vedere il dettaglio del giorno.</span>`;
  if (sel) {
    const x = days.find(y => y.d === sel);
    const parts = order.filter(k => x.per[k]).map(k => `${k ? esc(subjName(k)) : 'senza materia'} ${fmtMin(x.per[k])}`);
    detail = `<b>${cap(fmtLong(sel))}: ${fmtMin(x.tot)}</b>${parts.length ? `<br>${parts.join(', ')}` : ''}`;
  }
  const present = order.filter(k => inRange.some(l => (l.subjectId && subj(l.subjectId) ? l.subjectId : null) === k));
  const legend = present.length >= 2 ? `<div class="legend">${present.map(k => `<span><i class="dot" style="--c:${k ? subjVar(k) : 'var(--ink-3)'}"></i>${k ? esc(subjName(k)) : 'Senza materia'}</span>`).join('')}</div>` : '';

  const diff = total - prev;
  const cmp = prev || total ? (diff === 0 ? `Come nei ${R} giorni prima.` : `${fmtMin(Math.abs(diff))} ${diff > 0 ? 'in più' : 'in meno'} rispetto ai ${R} giorni prima.`) : '';
  const per = S.subjects.map(s => ({ s, m: inRange.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.minutes, 0) })).sort((a, b) => b.m - a.m);
  const maxS = Math.max(1, ...per.map(x => x.m));
  const exams = S.events.filter(e => e.type === 'esame' && e.date >= t).sort((a, b) => a.date.localeCompare(b.date));

  return `<header class="top"><h1>Progressi</h1></header>
  <div class="chips" role="group" aria-label="Periodo">${[7, 30].map(n => `<button class="chip" data-act="stats-range" data-v="${n}" aria-pressed="${R === n}">Ultimi ${n} giorni</button>`).join('')}</div>
  <div class="headline"><b>${fmtH(total)}</b><span>ore di studio negli ultimi ${R} giorni</span></div>
  <p class="subline">${cmp} ${st ? `Studi da ${st} ${st === 1 ? 'giorno' : 'giorni di fila'}.` : ''}</p>
  <div class="chart ${R > 7 ? 'dense' : ''}" role="group" aria-label="Minuti di studio al giorno">
    <div class="goal" style="bottom:${(22 + goal / max * 148).toFixed(1)}px"><span>obiettivo ${fmtMin(goal)}</span></div>
    ${bars}
  </div>
  ${legend}
  <div class="bar-detail" aria-live="polite">${detail}</div>

  ${per.length ? `<div class="sec-title"><h3>Per materia, ultimi ${R} giorni</h3></div>
  <ul class="list">${per.map(({ s, m }) => `<li class="row" style="--c:var(--c${s.color})"><button class="body" data-act="subj-open" data-id="${s.id}">
    <span class="t1">${esc(s.name)}</span><span class="t2">${fmtMin(m)}${s.topics.length ? `, ${s.topics.filter(x => x.status !== 'todo').length} di ${s.topics.length} argomenti` : ''}</span>
    <span class="hbar" style="width:${Math.max(1, m / maxS * 100)}%"></span></button></li>`).join('')}</ul>` : ''}

  ${exams.length ? `<div class="sec-title"><h3>Prossimi esami</h3></div><ul class="list">${exams.map(e => rowEvent(e, { date: true })).join('')}</ul>` : ''}`;
}

// ---------- Impostazioni e backup ----------
function openSettings() {
  const st = Object.assign({}, S.settings);
  openSheet({
    state: st,
    render: st => `${sheetHead('Impostazioni')}
      <div class="settings-group"><h3>Aspetto</h3>${chips('theme', [{ v: 'auto', l: 'Come il telefono' }, { v: 'light', l: 'Chiaro' }, { v: 'dark', l: 'Scuro' }], st.theme)}</div>
      <div class="settings-group"><h3>Obiettivo di studio al giorno</h3>${chips('goal', [60, 90, 120, 180, 240, 300].map(n => ({ v: n, l: fmtMin(n) })), st.goal)}
        <p class="hint">Quando lo raggiungi, il pozzetto del giorno nel calendario si riempie.</p></div>
      <div class="settings-group"><h3>Timer</h3>
        <span class="lab hint" style="display:block;margin:0 0 4px">Studio</span>${chips('focus', [25, 30, 45, 50, 60].map(n => ({ v: n, l: `${n} min` })), st.focus)}
        <span class="lab hint" style="display:block;margin:10px 0 4px">Pausa breve</span>${chips('short', [5, 10, 15].map(n => ({ v: n, l: `${n} min` })), st.short)}
        <span class="lab hint" style="display:block;margin:10px 0 4px">Pausa lunga</span>${chips('long', [15, 20, 30].map(n => ({ v: n, l: `${n} min` })), st.long)}
        <div class="switch-row"><span>Suono a fine fase</span><button class="switch" role="switch" aria-checked="${!!st.sound}" data-sact="toggle" data-k="sound" aria-label="Suono a fine fase"></button></div>
      </div>
      <div class="settings-group"><h3>I tuoi dati</h3>
        <p class="hint" style="margin:0 0 10px">Tutto è salvato solo su questo iPhone, non su internet. Se elimini l'app dalla schermata Home si cancellano anche i dati: esporta un backup ogni tanto e tienilo in File o iCloud Drive.</p>
        <div class="form-actions" style="margin-top:0">
          <button class="btn ghost wide" data-sact="export">${icon('download', 'ico ico-s')}Esporta backup</button>
          <button class="btn ghost wide" data-sact="import">${icon('upload', 'ico ico-s')}Importa backup</button>
          <input type="file" id="imp" accept=".json,application/json" hidden>
          <button class="btn danger wide" data-sact="wipe">${icon('trash-2', 'ico ico-s')}Elimina tutti i dati</button>
        </div>
        <p class="hint">${S.subjects.length} materie, ${S.events.length} attività, ${S.notes.length} note.</p>
      </div>`,
    onChange: k => {
      S.settings = Object.assign(S.settings, { theme: st.theme, goal: st.goal, focus: st.focus, short: st.short, long: st.long });
      if (k === 'theme') applyTheme();
      if (['focus', 'short', 'long'].includes(k) && !T.running) { T.total = modeLen(T.mode); T.remaining = T.total; saveTimer(); }
      save(); render();
    },
    onAct: async a => {
      if (a === 'toggle') return;
      if (a === 'export') exportData();
      if (a === 'import') {
        const inp = $('#imp', sheetEl);
        inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) importData(f); };
        inp.click();
      }
      if (a === 'wipe') {
        const ok = await confirmSheet({ title: 'Eliminare tutti i dati?', text: 'Materie, calendario, note e progressi verranno cancellati da questo iPhone. Se non hai un backup non si possono recuperare.', ok: 'Elimina tutto', danger: true });
        if (!ok) return;
        S = defaults(); save(); localStorage.removeItem(TKEY); T = loadTimer(); applyTheme(); UI.subjectId = null; render(); toast('Dati eliminati');
      }
    },
    onDismiss: () => { S.settings.sound = !!st.sound; save(); },
  });
}

async function exportData() {
  const data = JSON.stringify(Object.assign({ app: 'studio', exportedAt: new Date().toISOString() }, S));
  const name = `studio-backup-${today()}.json`;
  const blob = new Blob([data], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup Studio' });
      toast('Backup pronto. Salvalo in File.');
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('Backup scaricato');
}
function importData(file) {
  const r = new FileReader();
  r.onload = async () => {
    let d;
    try { d = JSON.parse(r.result); } catch (e) { toast('Il file non è un backup valido.'); return; }
    if (!d || !Array.isArray(d.subjects) || !Array.isArray(d.events)) { toast('Il file non è un backup di questa app.'); return; }
    const when = d.exportedAt ? new Date(d.exportedAt) : null;
    const ok = await confirmSheet({ title: 'Ripristinare il backup?', text: `Il backup${when ? ` del ${when.getDate()} ${MESI[when.getMonth()]} ${when.getFullYear()}` : ''} contiene ${d.subjects.length} materie e ${d.events.length} attività. Sostituisce i dati attuali.`, ok: 'Ripristina' });
    if (!ok) return;
    S = migrate(d); save(); applyTheme(); UI.subjectId = null; render(); toast('Backup ripristinato');
  };
  r.readAsText(file);
}

// ========== Azioni ==========
const ACT = {
  tab: el => {
    const tab = el.dataset.tab;
    if (tab === 'sub' && UI.tab === 'sub') UI.subjectId = null;
    UI.tab = tab; render(); scrollTo(0, 0);
  },
  'cal-move': el => {
    const [y, m] = UI.month.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.n), 1);
    UI.month = ymd(d).slice(0, 7); render();
  },
  'cal-today': () => { UI.sel = today(); UI.month = UI.sel.slice(0, 7); render(); },
  day: el => { UI.sel = el.dataset.d; UI.month = UI.sel.slice(0, 7); render(); },
  'ev-new': el => openEvent(null, { date: el.dataset.date || UI.sel, type: el.dataset.type, subjectId: el.dataset.sid }),
  'ev-open': el => openEvent(el.dataset.id),
  'ev-toggle': el => toggleDone(el.dataset.id),
  'ev-move': el => { const e = evById(el.dataset.id); if (e) { e.date = el.dataset.to; save(); render(); toast('Spostata a oggi'); } },
  'log-open': () => openLog(UI.sel),
  settings: () => openSettings(),
  'install-hide': () => { S.settings.hideInstall = true; save(); render(); },
  'exam-open': el => { const e = evById(el.dataset.id); if (e && e.subjectId && subj(e.subjectId)) { UI.tab = 'sub'; UI.subjectId = e.subjectId; render(); scrollTo(0, 0); } else openEvent(el.dataset.id); },
  'subj-new': () => openSubject(null),
  'subj-open': el => { UI.tab = 'sub'; UI.subjectId = el.dataset.id; render(); scrollTo(0, 0); },
  'subj-back': () => { UI.subjectId = null; render(); },
  'subj-edit': el => openSubject(el.dataset.id),
  'subj-timer': el => { T.subjectId = el.dataset.sid; T.eventId = null; saveTimer(); UI.tab = 'tim'; render(); scrollTo(0, 0); },
  'topic-cycle': el => cycleTopic(el.dataset.sid, el.dataset.id),
  'topic-menu': el => openTopic(el.dataset.sid, el.dataset.id),
  'topics-add': el => openTopicsAdd(el.dataset.sid),
  'plan-open': el => openPlan(el.dataset.sid),
  'plan-clear': el => clearPlan(el.dataset.sid),
  'note-new': el => openNote(null, { date: el.dataset.date, subjectId: el.dataset.sid }),
  'note-open': el => openNote(el.dataset.id),
  'note-filter': el => { UI.noteF = el.dataset.v; render(); },
  't-toggle': () => { T.running ? timerPause() : timerStart(); },
  't-reset': () => timerReset(),
  't-skip': () => timerSkip(),
  't-mode': el => { if (T.running && T.mode === 'focus') timerReset(); setMode(el.dataset.v); render(); },
  't-subj': el => { T.subjectId = el.dataset.v === 'null' ? null : el.dataset.v; T.subjChosen = true; const e = T.eventId && evById(T.eventId); if (e && e.subjectId !== T.subjectId) T.eventId = null; saveTimer(); render(); },
  'stats-range': el => { UI.range = Number(el.dataset.v); UI.bar = null; render(); },
  bar: el => { UI.bar = UI.bar === el.dataset.d ? null : el.dataset.d; render(); },
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.closest('.sheet')) return;
  const fn = ACT[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t, e); }
});
document.addEventListener('change', e => {
  if (e.target.id === 't-event') {
    const ev = evById(e.target.value);
    T.eventId = ev ? ev.id : null;
    if (ev) T.subjectId = ev.subjectId || null;
    saveTimer(); render();
  }
});

// scorrimento orizzontale sul calendario per cambiare mese
let touch0 = null;
document.addEventListener('touchstart', e => {
  touch0 = e.target.closest && e.target.closest('.month') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch0) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ACT['cal-move']({ dataset: { n: dx < 0 ? 1 : -1 } });
}, { passive: true });

// ========== Avvio ==========
$$('svg[data-icon]').forEach(s => { s.innerHTML = ICONS[s.dataset.icon] || ''; s.setAttribute('aria-hidden', 'true'); });
applyTheme();
if (T.running && timerLeft() <= 0) timerComplete(true);
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
