/* שגרת צמיחה – Hair Regrowth & Scalp Routine Companion (PWA) */
(() => {
'use strict';
const { icon, ART, PRODUCTS, SPECIALS, MILESTONES } = window.HRC;

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => dkey(new Date());
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const specialOf = dow => [0, 3, 5].includes(dow) ? 'oil' : [1, 4].includes(dow) ? 'ketozol' : 'rest';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const product = id => PRODUCTS.find(p => p.id === id);
const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const heDate = (d, o) => d.toLocaleDateString('he-IL', o);

/* ================= state ================= */
const LS = 'hrc.v1';
const defaults = () => ({ v: 1, start: todayKey(), log: {}, settings: { times: { morning: '08:00', lunch: '13:30', evening: '21:00' }, notif: false, sound: true, haptics: true } });
const merge = (d, r) => ({ ...d, ...r, settings: { ...d.settings, ...(r.settings || {}), times: { ...d.settings.times, ...((r.settings || {}).times || {}) } } });
function load() { try { const r = JSON.parse(localStorage.getItem(LS)); if (r && r.log) return merge(defaults(), r); } catch (e) {} return defaults(); }
let S = load();
let mirrorT;
function save() {
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast('שגיאה בשמירת הנתונים', 'gold'); }
  clearTimeout(mirrorT); mirrorT = setTimeout(mirror, 300);
}
if (!localStorage.getItem(LS)) save();

const ui = { view: 'home', cal: (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })(), angle: 'front', pm: null, pop: null };

/* ================= IndexedDB (photos + SW mirror) ================= */
let dbp = null;
const photos = {};
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open('hrc', 1);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos'); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const idbDo = async (store, mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(store, mode); const q = fn(tx.objectStore(store)); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }); };
async function loadPhotos() {
  try {
    const db = await idb();
    await new Promise(res => {
      const st = db.transaction('photos').objectStore('photos'); const c = st.openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { photos[cur.key] = cur.value; cur.continue(); } else res(); };
      c.onerror = () => res();
    });
  } catch (e) {}
}
function mirror() { idbDo('meta', 'readwrite', s => s.put({ times: S.settings.times, notif: S.settings.notif, log: S.log }, 'mirror')).catch(() => {}); }

/* ================= audio / haptics ================= */
let AC;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, t0, dur, type = 'sine', g = .16) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime + t0;
  o.type = type; o.frequency.value = f;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + .012); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  check() { tone(659, 0, .16); tone(988, .07, .3, 'sine', .14); },
  uncheck() { tone(311, 0, .14, 'triangle', .09); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .09, .5, 'sine', .13)); },
  mark() { tone(784, 0, .14, 'sine', .14); tone(1047, .12, .22, 'sine', .14); },
  end() { for (let i = 0; i < 3; i++) { tone(880, i * .35, .16, 'square', .07); tone(1175, i * .35 + .16, .16, 'square', .07); } }
};
const play = n => { if (S.settings.sound && SFX[n]) SFX[n](); };
const buzz = p => { if (S.settings.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
document.addEventListener('pointerdown', e => { if (e.target.closest('button,.item,.step,.cell,.pcard,.wd,.slot,.set-row[data-act]')) buzz(8); }, { passive: true });

/* ================= toast / dialog / confetti ================= */
function toast(msg, kind = '', ms = 3200) {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
}
function confirmDlg({ title, text, ok = 'אישור', danger = false }) {
  return new Promise(res => {
    const b = document.createElement('div'); b.className = 'dlg-b';
    b.innerHTML = `<div class="dlg" role="alertdialog"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn" data-r="0">ביטול</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div>`;
    b.addEventListener('click', e => { const r = e.target.closest('[data-r]'); if (r || e.target === b) { b.remove(); res(r && r.dataset.r === '1'); } });
    $('#app').appendChild(b);
  });
}
function confetti() {
  const cv = $('#fx'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = cv.offsetWidth * dpr; cv.height = cv.offsetHeight * dpr;
  const cols = ['#10B981', '#34D399', '#F59E0B', '#FBBF24', '#E8EEF7'];
  const ps = Array.from({ length: 90 }, () => ({ x: cv.width / 2 + (Math.random() - .5) * 120 * dpr, y: cv.height * .42, vx: (Math.random() - .5) * 15 * dpr, vy: (-Math.random() * 14 - 5) * dpr, s: (Math.random() * 6 + 4) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }));
  let f = 0;
  (function step() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .5 * dpr; p.vx *= .99; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - f / 110); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++f < 110) requestAnimationFrame(step); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ================= domain logic ================= */
function dayInfo(key) {
  const type = specialOf(parseKey(key).getDay()), L = S.log[key] || {}, sp = SPECIALS[type], steps = L.steps || {};
  let done = [L.morning, L.lunch, L.evening].filter(Boolean).length, total = 3;
  const specialDone = sp.steps ? sp.steps.every(s => steps[s.id]) : true;
  if (sp.steps) { total++; if (specialDone) done++; }
  return { key, type, sp, L, steps, done, total, full: done === total, specialDone };
}
function status(key) {
  const t = todayKey();
  if (key < S.start) return 'pre';
  const i = dayInfo(key);
  if (i.full) return 'full';
  if (key > t) return 'future';
  if (i.done > 0) return 'partial';
  return key === t ? 'pending' : 'missed';
}
function streak() {
  let d = new Date(), n = 0;
  if (!dayInfo(dkey(d)).full) d = addDays(d, -1);
  while (n < 5000 && dkey(d) >= S.start && dayInfo(dkey(d)).full) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak() {
  let best = 0, cur = 0;
  for (let d = parseKey(S.start), end = parseKey(todayKey()), i = 0; d <= end && i < 4000; d = addDays(d, 1), i++) {
    if (dayInfo(dkey(d)).full) { cur++; best = Math.max(best, cur); } else cur = 0;
  }
  return best;
}
function monthStats(y, m) {
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0), t = todayKey();
  let done = 0, total = 0, full = 0, days = 0;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const k = dkey(d); if (k < S.start) continue; if (k > t) break;
    const i = dayInfo(k);
    if (k === t && !i.full) continue;      // today only counts once completed
    days++; done += i.done; total += i.total; if (i.full) full++;
  }
  return { pct: total ? Math.round(done / total * 100) : null, full, days };
}
const dayNumber = () => Math.max(1, diffDays(S.start, todayKey()) + 1);
const monthNumber = () => Math.floor(Math.max(0, diffDays(S.start, todayKey())) / 30.4375) + 1;

function toggleTask(key, id) {
  const wasFull = dayInfo(key).full;
  const L = S.log[key] = S.log[key] || {};
  let on;
  if (['morning', 'lunch', 'evening'].includes(id)) { on = !L[id]; if (on) L[id] = Date.now(); else delete L[id]; }
  else if (id === 'special') {
    const sp = dayInfo(key).sp; L.steps = L.steps || {};
    on = !dayInfo(key).specialDone;
    sp.steps.forEach(s => { if (on) L.steps[s.id] = true; else delete L.steps[s.id]; });
  }
  after(key, id, on, wasFull);
}
function setStep(key, sid, val, quiet) {
  const wasFull = dayInfo(key).full;
  const L = S.log[key] = S.log[key] || {}; L.steps = L.steps || {};
  const on = val === undefined ? !L.steps[sid] : val;
  if (on) L.steps[sid] = true; else delete L.steps[sid];
  after(key, sid, on, wasFull, quiet);
}
function after(key, id, on, wasFull, quiet) {
  save();
  ui.pop = { key, id };
  const nowFull = dayInfo(key).full;
  if (!quiet) {
    if (on) { buzz(on && nowFull && !wasFull ? [30, 40, 30, 40, 80] : 18); }
    if (nowFull && !wasFull) { play('win'); confetti(); toast(key === todayKey() ? '🎉 יום מלא! כל הכבוד על ההתמדה' : '✓ היום הושלם', 'ok'); }
    else play(on ? 'check' : 'uncheck');
  }
  refresh();
}

/* ================= icons / renderers ================= */
const glyph = type => `<span class="glyph ${type}">${type === 'oil' ? icon('drop') : type === 'ketozol' ? icon('bubbles') : icon('moon')}</span>`;
const TIMES = { morning: ['בוקר', 'sun'], lunch: ['צהריים', 'lunch'], evening: ['ערב', 'moon'] };
const DAILY = {
  morning: { title: 'קצף מינוקסידיל 5%', sub: 'חצי פקק · קרקפת נקייה ויבשה', p: 'minox' },
  lunch: { title: 'כמוסת דקל ננסי 320mg', sub: 'עם ארוחה · מעכב DHT טבעי', p: 'saw' },
  evening: { title: 'קצף מינוקסידיל 5%', sub: 'חצי פקק · קרקפת נקייה ויבשה', p: 'minox' }
};
const popCls = (key, id) => ui.pop && ui.pop.key === key && ui.pop.id === id ? ' pop' : '';

function itemHTML(key, id, d, ro) {
  const done = !!(S.log[key] || {})[id];
  return `<div class="item${done ? ' done' : ''}${popCls(key, id)}" role="checkbox" aria-checked="${done}" tabindex="0" ${ro ? '' : `data-act="toggle" data-date="${key}" data-id="${id}"`}>
    <span class="chk">${CHECK}</span>
    <div class="txt"><b>${d.title}</b><span>${d.sub}</span></div>
    <button class="info" data-act="product" data-p="${d.p}" aria-label="מידע">${icon('info')}</button></div>`;
}
function checklistHTML(key, o = {}) {
  const info = dayInfo(key), t = S.settings.times, h = new Date().getHours();
  const nowSlot = key === todayKey() ? (h < 11 ? 'morning' : h < 16 ? 'lunch' : 'evening') : null;
  const sp = info.sp, special = info.type !== 'rest';
  const hintTxt = special ? `<div class="hint">${icon('alert')}<span>${info.type === 'oil' ? 'יום שמן: מינוקסידיל רק אחרי חפיפה כפולה וייבוש מלא – לעולם לא על שמן.' : 'יום קטוקונזול: מינוקסידיל רק אחרי שטיפה וייבוש מלא של הקרקפת.'}</span></div>` : '';
  let html = '';
  for (const slot of ['morning', 'lunch', 'evening']) {
    const [lab, ic] = TIMES[slot], gdone = !!(S.log[key] || {})[slot];
    html += `<div class="group${nowSlot === slot && !gdone ? ' now' : ''}"><div class="group-h"><span class="gi">${icon(ic)}</span><h2>${lab}</h2><span class="time">${t[slot]}</span></div>
      ${itemHTML(key, slot, DAILY[slot])}${slot !== 'lunch' ? hintTxt : ''}</div>`;
  }
  html += `<div class="group"><div class="group-h"><span class="gi">${icon('star')}</span><h2>טיפול יומי מיוחד</h2><span class="chip ${info.type === 'oil' ? 'gold' : info.type === 'ketozol' ? 'sky' : 'em'}">${sp.label}</span></div>`;
  if (!sp.steps) {
    html += `<div class="special rest done"><div class="rest-body"><span class="ico">${icon('sleep')}</span><div class="txt"><b>${sp.title}</b><span>${sp.sub}. מינוקסידיל ודקל ננסי ממשיכים כרגיל.</span></div></div></div>`;
  } else {
    const ro = o.ro;
    html += `<div class="special ${info.type}${info.specialDone ? ' done' : ''}">
      <div class="item${info.specialDone ? ' done' : ''}${popCls(key, 'special')}" role="checkbox" aria-checked="${info.specialDone}" tabindex="0" data-act="toggle" data-date="${key}" data-id="special">
        <span class="chk">${CHECK}</span><div class="txt"><b>${sp.title}</b><span>${sp.sub}</span></div>
        <button class="info" data-act="product" data-p="${sp.product}" aria-label="מידע">${icon('info')}</button></div>
      <div class="steps">${sp.steps.map((s, i) => `<div class="step${info.steps[s.id] ? ' done' : ''}${popCls(key, s.id)}" role="checkbox" aria-checked="${!!info.steps[s.id]}" tabindex="0" data-act="step" data-date="${key}" data-id="${s.id}">
          <span class="chk">${CHECK}</span><div class="txt"><b>${s.t}</b><span>${s.d}</span></div>
          ${s.timer ? `<button class="timer-btn" data-act="timer" data-date="${key}" data-id="${s.id}">${icon('timer')}${Math.round(s.timer.sec / 60 * 10) / 10 >= 1 ? Math.round(s.timer.sec / 60) + ' דק׳' : ''}</button>` : ''}</div>`).join('')}</div></div>`;
  }
  html += '</div>';
  ui.pop = null;
  return html;
}

/* ---------- Home ---------- */
function viewHome() {
  const now = new Date(), key = dkey(now), info = dayInfo(key), h = now.getHours();
  const greet = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  const st = streak(), pct = info.done / info.total, C = 2 * Math.PI * 27;
  const T = timer && !timer.finished && (timer.running || timer.remaining < timer.cfg.sec) ? `<div class="note ok" data-act="reopen-timer" style="margin-top:14px;cursor:pointer">${icon('timer')}<span>טיימר פעיל: ${esc(timer.cfg.title)} · <b data-live-timer>${fmt(timerRemaining())}</b> – לחץ לצפייה</span></div>` : '';
  return `<section class="enter">
    <div class="hero"><div class="top"><div><h1>${greet} 🌿</h1><div class="date">${heDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="muted" style="font-size:13px;margin-top:2px">יום ${dayNumber()} בתהליך · חודש ${monthNumber()}</div></div>
      <div class="ring${info.full ? ' full' : ''}"><svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" cx="32" cy="32" r="27" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><span>${info.done}/${info.total}</span></div></div>
      <div class="streak"><div class="flame"><svg viewBox="0 0 24 24" fill="#F59E0B" stroke="#FBBF24" stroke-width="1.2" stroke-linejoin="round"><path d="M12 2.5c.5 3-1.5 4.5-3 6.5-1.500 2-2.500 3.500-2.500 6a5.500 5.500 0 0 0 11 0c0-2-.8-3.300-1.800-4.500-.3 1.200-.9 2-1.700 2.500.5-3-.2-7-2-10.500z"/></svg></div>
      <div><span><b>${st}</b>${st === 1 ? 'יום התמדה ברצף' : 'ימי התמדה ברצף'}</span><div class="muted" style="font-size:12.5px">${st === 0 ? 'התחל רצף חדש היום' : info.full ? 'היום הושלם – מדהים!' : 'השלם את כל המשימות כדי להמשיך את הרצף'}</div></div></div></div>
    ${T}
    ${checklistHTML(key)}
    <div class="disc sel">המידע באפליקציה הוא ליווי אישי לשגרה ואינו מהווה ייעוץ רפואי. לשאלות על תופעות לוואי או שינוי בטיפול – התייעץ עם רופא.</div></section>`;
}

/* ---------- Calendar ---------- */
function viewCal() {
  const now = new Date(), t = todayKey(), { y, m } = ui.cal;
  const first = new Date(y, m, 1), nd = new Date(y, m + 1, 0).getDate();
  const ms = monthStats(y, m), best = bestStreak();
  const wkStart = addDays(now, -now.getDay());
  let wk = '', wkFull = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(wkStart, i), k = dkey(d), s = status(k), type = specialOf(i);
    if (s === 'full') wkFull++;
    wk += `<button class="wd ${s}${k === t ? ' today' : ''}" data-act="day" data-date="${k}"><small>${DAYS_SHORT[i]}</small><span class="dot">${s === 'full' ? icon('check').replace('<svg', '<svg width="16" height="16" style="stroke:#032a1e;fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"') : d.getDate()}</span>${glyph(type)}</button>`;
  }
  let cells = DAYS_SHORT.map(d => `<div class="dn">${d}</div>`).join('') + '<div class="cell blank"></div>'.repeat(first.getDay());
  for (let d = 1; d <= nd; d++) {
    const k = dkey(new Date(y, m, d)), s = status(k), type = specialOf(new Date(y, m, d).getDay());
    cells += `<button class="cell ${s === 'pending' ? 'future' : s}${k === t ? ' today' : ''}" data-act="day" data-date="${k}" aria-label="${d}">${d}${s === 'pre' ? '' : glyph(type)}</button>`;
  }
  const pctTxt = ms.pct === null ? '—' : ms.pct + '%';
  const plan = [0, 1, 2, 3, 4, 5, 6].map(i => { const ty = specialOf(i), sp = SPECIALS[ty]; return `<div class="p${i === now.getDay() ? ' today' : ''}"><b>${DAYS[i]}</b>${glyph(ty)}<span>${ty === 'oil' ? 'שמן רוזמרין + עיסוי + חפיפה כפולה' : ty === 'ketozol' ? 'חפיפת קטוקונזול 2% (3–5 דק׳)' : 'מנוחה – בלי טיפול מיוחד'}</span></div>`; }).join('');
  return `<section class="enter">
    <h1>לוח שנה ומעקב</h1><div class="muted" style="margin-top:4px;font-size:14px">הצלחות, החמצות והטיפולים הקרובים</div>
    <div class="card" style="margin-top:16px"><div class="big-pct"><div class="num">${pctTxt}</div><div class="grow"><b style="font-size:16px">${ms.pct === null ? 'עדיין אין נתונים' : 'התמדה ' + (y === now.getFullYear() && m === now.getMonth() ? 'החודש' : 'ב' + heDate(first, { month: 'long' }))}</b>
      <div class="muted" style="font-size:13px">${ms.days ? `${ms.full} ימים מלאים מתוך ${ms.days}` : 'המעקב מתחיל מיום ' + heDate(parseKey(S.start), { day: 'numeric', month: 'long' })}</div></div></div>
      <div class="bar"><i style="width:${ms.pct || 0}%"></i></div></div>
    <div class="sec-title"><h2>השבוע</h2><span class="chip em">${wkFull}/7 ימים מלאים</span></div>
    <div class="week">${wk}</div>
    <div class="sec-title"><h2>חודשי</h2></div>
    <div class="card"><div class="cal-head"><button class="iconbtn" data-act="cal-next" aria-label="חודש קודם">${icon('chevR')}</button><h2>${heDate(first, { month: 'long', year: 'numeric' })}</h2><button class="iconbtn" data-act="cal-prev" aria-label="חודש הבא">${icon('chevL')}</button></div>
      <div class="cal">${cells}</div>
      <div class="legend"><span><i style="background:var(--em)"></i>יום מלא</span><span><i style="background:rgba(245,158,11,.5)"></i>חלקי</span><span><i style="background:rgba(248,113,113,.4)"></i>הוחמץ</span><span><i style="border:1px dashed var(--dim)"></i>בקרוב</span></div>
      <div class="legend" style="margin-top:8px"><span class="glyph oil" style="display:inline-flex;gap:5px;align-items:center">${icon('drop')} שמן</span><span class="glyph ketozol" style="display:inline-flex;gap:5px;align-items:center">${icon('bubbles')} קטוקונזול</span><span class="glyph rest" style="display:inline-flex;gap:5px;align-items:center">${icon('moon')} מנוחה</span></div></div>
    <div class="stat-grid"><div class="stat"><b class="gold">${streak()}</b><span>רצף נוכחי</span></div><div class="stat"><b class="em">${best}</b><span>שיא רצף</span></div><div class="stat"><b>${dayNumber()}</b><span>ימים בתהליך</span></div></div>
    <div class="sec-title"><h2>תוכנית שבועית קבועה</h2></div><div class="plan">${plan}</div></section>`;
}

/* ---------- Knowledge base ---------- */
function viewGuide() {
  const cards = PRODUCTS.map(p => `<button class="pcard" style="--c:${p.color}" data-act="product" data-p="${p.id}"><span class="num">0${p.n}</span><div class="art" style="color:${p.color}">${ART[p.art]}</div><h3>${p.name}</h3><p>${p.brand}</p><span class="tag">${p.freq}</span></button>`).join('');
  return `<section class="enter"><h1>מדריך התכשירים</h1><div class="muted" style="margin-top:4px;font-size:14px">מה כל תכשיר עושה, איך משתמשים ומה אסור לעשות</div>
    <div class="note danger" style="margin-top:16px">${icon('ban')}<span><b>כלל הברזל:</b> לעולם לא מינוקסידיל מעל שמן. והמסרק החשמלי – רחוק ממים, ויציאת ה-Type-C תמיד יבשה.</span></div>
    <div class="pgrid" style="margin-top:14px">${cards}</div>
    <div class="sec-title"><h2>סדר הפעולות ביום שמן</h2></div>
    <div class="card"><ol class="steps-l" style="--c:var(--gold)"><li>שמן רוזמרין על שיער יבש</li><li>עיסוי 10 דקות במסרק (מצב 2/3)</li><li>הרחקת המסרק ממים ← חפיפה ראשונה (שבירת שמן)</li><li>חפיפה שנייה – השרייה 1–2 דקות</li><li>ייבוש מלא ← רק אז קצף מינוקסידיל</li></ol></div></section>`;
}
function openProduct(id) {
  const p = product(id); if (!p) return;
  const html = `<div class="sh-hero"><div class="art" style="color:${p.color}">${ART[p.art]}</div><div class="grow"><h2 style="font-size:21px;line-height:1.25">${p.name}</h2><div class="muted" style="font-size:13.5px;margin-top:2px">${p.brand}</div><span class="chip" style="margin-top:7px;background:color-mix(in srgb,${p.color} 16%,transparent);color:${p.color}">${p.freq}</span></div></div>
    <div class="sh-sec"><h3><i>?</i>מה זה עושה ולמה זה עובד</h3>${p.why.map(t => `<p>${t}</p>`).join('')}</div>
    <div class="sh-sec"><h3><i>${icon('check').replace('<svg', '<svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:3"')}</i>מינון ושלבי עבודה</h3><div class="dose">${icon('drop').replace('<svg', '<svg width="22" height="22" style="stroke:var(--em2);fill:none;stroke-width:1.8;flex:none"')}<span><b>מינון:</b> ${p.dose}</span></div><ol class="steps-l" style="--c:${p.color}">${p.steps.map(s => `<li>${s}</li>`).join('')}</ol></div>
    <div class="sh-sec rules"><h3><i>!</i>כללי ברזל ואזהרות קריטיות</h3><ul class="rules-l">${p.rules.map(([k, t]) => `<li class="${k === 'gold' ? 'gold' : ''}">${icon(k === 'gold' ? 'alert' : 'ban')}<span>${t}</span></li>`).join('')}</ul></div>
    <div class="disc">מידע כללי בלבד ואינו מהווה ייעוץ רפואי. התייעץ עם רופא לפני שינוי בטיפול.</div>`;
  openSheet(html, { color: p.color });
}

/* ---------- Photos ---------- */
const ANGLES = [['front', 'קדמת הראש', 'Hairline'], ['temples', 'מפרצים', 'Temples'], ['crown', 'קודקוד', 'Crown']];
const pkey = (m, a) => `${m}_${a}`;
const mLabel = m => m === 0 ? 'יום 1' : 'חודש ' + m;
function curPM() { return ui.pm === null ? Math.min(12, monthNumber() - 1) : ui.pm; }
function viewPhotos() {
  const mn = monthNumber();
  const tl = MILESTONES.map(ms => { const st = mn >= ms.from && mn <= ms.to ? 'now' : mn > ms.to ? 'past' : ''; return `<div class="tl-i ${st}"><div class="rail"><span class="node">${st === 'past' ? icon('check').replace('<svg', '<svg width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:3;stroke-linecap:round"') : ms.from === ms.to ? ms.from : ms.from + '–' + ms.to}</span><span class="ln"></span></div>
    <div class="body"><h3>${ms.range}: ${ms.title}${st === 'now' ? '<span class="chip em">אתה כאן</span>' : `<span class="chip gold">${ms.badge}</span>`}</h3><p>${ms.text}</p></div></div>`; }).join('');
  return `<section class="enter"><h1>יומן תמונות ותוצאות</h1><div class="muted" style="margin-top:4px;font-size:14px">צלם פעם בחודש באותה תאורה, זווית ומרחק</div>
    <div class="seg" style="margin-top:16px" id="angSeg">${ANGLES.map(([k, he, en]) => `<button class="${ui.angle === k ? 'on' : ''}" data-act="angle" data-a="${k}">${he}<small>${en}</small></button>`).join('')}</div>
    <div id="cmpBox"></div>
    <div class="card slider-wrap"><div class="lab"><b id="pmLab"></b><span class="muted" style="font-size:12.5px">השווה ליום 1</span></div>
      <input type="range" id="pmRange" min="0" max="12" step="1" value="${curPM()}" aria-label="בחירת חודש"><div class="ticks" id="ticks"></div></div>
    <div class="sec-title"><h2 id="slotsTitle"></h2><span class="chip">שמור במכשיר בלבד</span></div>
    <div class="slots" id="slots"></div>
    <div class="sec-title"><h2>ציר זמן – למה לצפות</h2><span class="chip em">חודש ${mn}</span></div>
    <div class="tl">${tl}</div></section>`;
}
function paintPhotos() {
  if (ui.view !== 'photos' || !$('#cmpBox')) return;
  const a = ui.angle, m = curPM(), A = ANGLES.find(x => x[0] === a);
  const p0 = photos[pkey(0, a)], pm = photos[pkey(m, a)];
  const ph = txt => `<div class="ph">${icon('camera')}<span>${txt}</span></div>`;
  let box;
  if (m === 0) box = `<div class="cmp${p0 ? '' : ' empty'}" style="--pos:50%">${p0 ? `<img src="${p0.data}" alt="יום 1">` : ph('עדיין אין תמונת יום 1.<br>הוסף למטה את תמונת הבסיס שלך')}<span class="lbl r">יום 1</span></div>`;
  else if (p0 && pm) box = `<div class="cmp" id="cmp" style="--pos:50%"><img src="${pm.data}" alt="${mLabel(m)}"><img class="top-img" src="${p0.data}" alt="יום 1"><div class="handle"></div><span class="lbl r">יום 1</span><span class="lbl l">${mLabel(m)}</span></div>`;
  else box = `<div class="cmp${p0 ? '' : ' empty'}">${p0 ? `<img src="${p0.data}" alt="יום 1" style="opacity:.35">` : ''}${ph(pm ? 'חסרה תמונת יום 1 להשוואה' : `אין תמונה של ${A[1]} ל${mLabel(m)}.<br>הוסף למטה כדי להשוות`)}</div>`;
  $('#cmpBox').innerHTML = box;
  $('#pmLab').textContent = m === 0 ? 'יום 1 – תמונת בסיס' : `${mLabel(m)} מול יום 1`;
  $('#ticks').innerHTML = Array.from({ length: 13 }, (_, i) => `<i class="${photos[pkey(i, a)] ? 'has' : ''}"></i>`).join('');
  $('#slotsTitle').textContent = `תמונות · ${mLabel(m)}`;
  $('#slots').innerHTML = ANGLES.map(([k, he]) => { const ph = photos[pkey(m, k)];
    return `<div class="slot${ph ? ' has' : ''}" data-act="slot" data-a="${k}" role="button" tabindex="0">${ph ? `<img src="${ph.data}" alt="${he}"><span class="cap">${he}</span><button class="del" data-act="delphoto" data-a="${k}" aria-label="מחק">${icon('x')}</button>` : `${icon('camera')}<span>${he}</span>`}</div>`; }).join('');
  bindCompare();
}
function bindCompare() {
  const c = $('#cmp'); if (!c) return;
  const set = x => { const r = c.getBoundingClientRect(); const pct = Math.max(0, Math.min(100, (x - r.left) / r.width * 100)); c.style.setProperty('--pos', pct + '%'); };
  let drag = false;
  c.addEventListener('pointerdown', e => { drag = true; c.setPointerCapture(e.pointerId); set(e.clientX); });
  c.addEventListener('pointermove', e => { if (drag) set(e.clientX); });
  ['pointerup', 'pointercancel'].forEach(ev => c.addEventListener(ev, () => drag = false));
}
function pickPhoto(angle) {
  const m = curPM();
  openSheet(`<div class="timer" style="padding-bottom:6px"><h2>${ANGLES.find(a => a[0] === angle)[1]} · ${mLabel(m)}</h2><p class="muted" style="font-size:14px;margin:6px 0 16px">צלם באור יום, בלי פלאש, שיער יבש ובאותה זווית כמו בפעם הקודמת.</p>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%"><button class="btn primary block" data-act="shoot" data-a="${angle}" data-cap="1">${icon('camera')}צלם עכשיו</button><button class="btn block" data-act="shoot" data-a="${angle}">${icon('upload')}בחר מהגלריה</button></div></div>`);
}
function shoot(angle, cap) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (cap) inp.setAttribute('capture', 'environment');
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const data = await resizeImage(f), m = curPM(), k = pkey(m, angle), val = { data, ts: Date.now() };
      await idbDo('photos', 'readwrite', s => s.put(val, k)); photos[k] = val;
      dismissSheet(); play('check'); toast('התמונה נשמרה ✓', 'ok'); paintPhotos();
    } catch (e) { toast('לא ניתן לשמור את התמונה', 'gold'); }
  };
  inp.click();
}
function resizeImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const W = 810, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const sc = Math.max(W / img.width, H / img.height), w = img.width * sc, h = img.height * sc;
      cv.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

/* ---------- Settings ---------- */
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const sw = (on, act) => `<span class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" tabindex="0"></span>`;
function viewSettings() {
  const s = S.settings, t = s.times;
  const notifSupported = 'Notification' in window, perm = notifSupported ? Notification.permission : 'denied';
  return `<section class="enter"><h1>תזכורות והגדרות</h1>
    <div class="set-title">שעות התראה</div>
    <div class="set-group">${[['morning', 'בוקר', 'sun', 'מינוקסידיל'], ['lunch', 'צהריים', 'lunch', 'דקל ננסי'], ['evening', 'ערב', 'moon', 'מינוקסידיל']].map(([k, l, ic, d]) => `<div class="set-row"><span class="ic">${icon(ic)}</span><div class="txt grow"><b>${l}</b><span>${d}</span></div><input type="time" value="${t[k]}" data-time="${k}" aria-label="שעת ${l}"></div>`).join('')}</div>
    <div class="set-title">התראות</div>
    <div class="set-group"><div class="set-row" data-act="tg-notif"><span class="ic">${icon('bell')}</span><div class="txt grow"><b>התראות תזכורת</b><span>${!notifSupported ? 'הדפדפן אינו תומך בהתראות' : perm === 'denied' ? 'ההרשאה חסומה – יש לאפשר בהגדרות הדפדפן' : s.notif ? 'פעיל' : 'כבוי'}</span></div>${sw(s.notif && perm === 'granted', 'tg-notif')}</div>
      <div class="set-row" data-act="test-notif"><span class="ic">${icon('spark')}</span><div class="txt grow"><b>שלח התראת בדיקה</b><span>לוודא שההתראות מגיעות למכשיר</span></div>${icon('chevL').replace('<svg', '<svg width="18" height="18" style="stroke:var(--dim);fill:none;stroke-width:2"')}</div></div>
    <div class="note warn" style="margin-top:10px">${icon('info')}<span>התראות מתקבלות בצורה אמינה כשהאפליקציה מותקנת במסך הבית ופתוחה ברקע. ללא שרת Push, מועד ההתראה כשהאפליקציה סגורה לגמרי תלוי במערכת ההפעלה.</span></div>
    <div class="set-title">חוויית שימוש</div>
    <div class="set-group"><div class="set-row" data-act="tg-sound"><span class="ic">${icon('vol')}</span><div class="txt grow"><b>צלילי משוב</b></div>${sw(s.sound, 'tg-sound')}</div>
      <div class="set-row" data-act="tg-haptics"><span class="ic">${icon('vib')}</span><div class="txt grow"><b>רטט במגע</b></div>${sw(s.haptics, 'tg-haptics')}</div>
      <div class="set-row"><span class="ic">${icon('calpick')}</span><div class="txt grow"><b>יום 1 בתהליך</b><span>מועד תחילת המעקב</span></div><input type="date" value="${S.start}" max="${todayKey()}" data-start aria-label="יום התחלה"></div></div>
    <div class="set-title">התקנה</div>
    <div class="set-group"><div class="set-row" data-act="install"><span class="ic">${icon('phone')}</span><div class="txt grow"><b>${isStandalone() ? 'האפליקציה מותקנת ✓' : 'התקן למסך הבית'}</b><span>${isStandalone() ? 'פועלת במצב מסך מלא ובלי אינטרנט' : 'עבודה בלי אינטרנט וחוויית אפליקציה מלאה'}</span></div></div></div>
    <div class="set-title">נתונים וגיבוי</div>
    <div class="set-group"><div class="set-row" data-act="export"><span class="ic">${icon('download')}</span><div class="txt grow"><b>ייצוא גיבוי (JSON)</b><span>כולל מעקב יומי והתמונות</span></div></div>
      <div class="set-row" data-act="import"><span class="ic">${icon('upload')}</span><div class="txt grow"><b>שחזור מגיבוי</b><span>טעינת קובץ JSON שיוצא קודם</span></div></div>
      <div class="set-row" data-act="clear-cache"><span class="ic">${icon('reset')}</span><div class="txt grow"><b>ניקוי מטמון האפליקציה</b><span>טעינת גרסה עדכנית – הנתונים נשמרים</span></div></div>
      <div class="set-row" data-act="wipe"><span class="ic" style="color:var(--rose);background:rgba(248,113,113,.1)">${icon('trash')}</span><div class="txt grow"><b style="color:var(--rose)">מחיקת כל הנתונים</b><span>מעקב, הגדרות ותמונות – לא ניתן לשחזר</span></div></div></div>
    <div class="ver">שגרת צמיחה · גרסה 1.0 · הנתונים נשמרים במכשיר בלבד</div></section>`;
}
async function enableNotif() {
  if (!('Notification' in window)) { toast('הדפדפן אינו תומך בהתראות', 'gold'); return false; }
  let p = Notification.permission;
  if (p === 'default') p = await Notification.requestPermission();
  if (p !== 'granted') { toast('ההרשאה לא אושרה. אפשר לאשר בהגדרות הדפדפן', 'gold'); return false; }
  try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.register('hrc-reminders', { minInterval: 15 * 60 * 1000 }); } catch (e) {}
  return true;
}
async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', lang: 'he', dir: 'rtl', vibrate: [60, 40, 60], data: { url: './index.html' } };
  try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, opts); return true; }
  catch (e) { try { new Notification(title, opts); return true; } catch (e2) { return false; } }
}
const REM = { morning: ['בוקר טוב ☀️', 'זמן לקצף המינוקסידיל – על קרקפת נקייה ויבשה.'], lunch: ['צהריים 🌿', 'כמוסת דקל ננסי 320mg – עם ארוחה.'], evening: ['ערב טוב 🌙', 'קצף מינוקסידיל ערב – קרקפת נקייה ויבשה, בלי שמן.'] };
function checkReminders() {
  if (!S.settings.notif) return;
  const now = new Date(), key = dkey(now), L = S.log[key] || {};
  let fired; try { fired = JSON.parse(localStorage.getItem('hrc.fired') || '{}'); } catch (e) { fired = {}; }
  Object.keys(fired).forEach(k => { if (!k.startsWith(key)) delete fired[k]; });
  for (const slot of ['morning', 'lunch', 'evening']) {
    const [h, m] = S.settings.times[slot].split(':').map(Number), diff = now.getHours() * 60 + now.getMinutes() - (h * 60 + m), fk = `${key}-${slot}`;
    if (diff >= 0 && diff <= 90 && !L[slot] && !fired[fk]) {
      fired[fk] = 1; const [t, b] = REM[slot];
      notify(t, b, 'hrc-' + fk);
      if (document.visibilityState === 'visible') { toast(`${t} ${b}`, 'gold', 6000); play('mark'); }
    }
  }
  localStorage.setItem('hrc.fired', JSON.stringify(fired));
}
function exportData() {
  const data = { app: 'hair-routine', version: 1, exportedAt: new Date().toISOString(), state: S, photos };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `hair-routine-backup-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('הגיבוי הורד למכשיר ✓', 'ok');
}
function importData() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (d.app !== 'hair-routine' || !d.state || !d.state.log) throw 0;
      if (!await confirmDlg({ title: 'שחזור מגיבוי', text: 'הנתונים הנוכחיים יוחלפו בנתוני הגיבוי. להמשיך?', ok: 'שחזר' })) return;
      S = merge(defaults(), d.state); save();
      await idbDo('photos', 'readwrite', s => s.clear()); Object.keys(photos).forEach(k => delete photos[k]);
      for (const [k, v] of Object.entries(d.photos || {})) { await idbDo('photos', 'readwrite', s => s.put(v, k)); photos[k] = v; }
      toast('הנתונים שוחזרו ✓', 'ok'); render();
    } catch (e) { toast('קובץ הגיבוי אינו תקין', 'gold'); }
  };
  inp.click();
}

/* ================= bottom sheet ================= */
let sheet = null;
function openSheet(html, { color, refresh: rf, onClose } = {}) {
  closeSheet(true);
  const root = $('#sheetRoot'), bd = document.createElement('div'), sh = document.createElement('div');
  bd.className = 'backdrop'; sh.className = 'sheet'; sh.style.setProperty('--c', color || 'var(--em)'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = `<div class="grab"><i></i></div><div class="sheet-body">${html}</div>`;
  root.append(bd, sh);
  sheet = { sh, bd, rf, onClose };
  requestAnimationFrame(() => requestAnimationFrame(() => { sh.classList.add('in'); bd.classList.add('in'); }));
  bd.addEventListener('click', dismissSheet);
  if (!(history.state && history.state.sheet)) history.pushState({ sheet: 1 }, '');
  const g = $('.grab', sh); let y0 = 0, dy = 0, on = false;
  g.addEventListener('pointerdown', e => { on = true; y0 = e.clientY; dy = 0; sh.classList.add('drag'); g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointermove', e => { if (!on) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (!on) return; on = false; sh.classList.remove('drag'); sh.style.transform = ''; if (dy > 110) dismissSheet(); };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
}
function closeSheet(instant) {
  if (!sheet) return; const { sh, bd, onClose } = sheet; sheet = null;
  if (instant) { sh.remove(); bd.remove(); } else { sh.classList.remove('in'); bd.classList.remove('in'); setTimeout(() => { sh.remove(); bd.remove(); }, 420); }
  onClose && onClose();
}
function dismissSheet() { if (!sheet) return; if (history.state && history.state.sheet) history.back(); else closeSheet(); }
addEventListener('popstate', () => closeSheet());
function sheetBody() { return sheet && $('.sheet-body', sheet.sh); }

/* ---------- day sheet ---------- */
function dayHTML(key) {
  const d = parseKey(key), t = todayKey(), info = dayInfo(key), s = status(key);
  const chip = { full: ['em', 'יום מלא ✓'], partial: ['gold', 'בוצע חלקית'], missed: ['', 'לא בוצע'], pending: ['gold', 'היום'], future: ['', 'מתוכנן'], pre: ['', 'לפני תחילת המעקב'] }[s];
  let body;
  if (key > t) body = `<div class="note ok">${icon('calpick')}<span>טיפול מתוכנן ליום זה: <b>${info.sp.title}</b>. מינוקסידיל בבוקר ובערב, דקל ננסי בצהריים.</span></div>
    ${info.sp.steps ? `<button class="btn block" style="margin-top:12px" data-act="product" data-p="${info.sp.product}">${icon('info')}למדריך הטיפול</button>` : ''}`;
  else body = (key < S.start ? `<div class="note warn" style="margin-bottom:10px">${icon('info')}<span>היום הזה לפני תחילת המעקב ולכן לא נספר בהתמדה.</span></div>` : '') + checklistHTML(key, {});
  return `<div class="row between" style="margin-bottom:4px"><div><h2 style="font-size:21px">${heDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><div class="muted" style="font-size:13.5px">${info.sp.label}${key === t ? ' · היום' : ''}</div></div><span class="chip ${chip[0]}">${chip[1]}</span></div>
    ${body}`;
}
function openDay(key) { openSheet(dayHTML(key), { refresh: () => dayHTML(key) }); }

/* ---------- timer ---------- */
let timer = null, tickId = null, wake = null;
const fmt = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const timerRemaining = () => timer ? (timer.running ? Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000)) : timer.remaining) : 0;
function timerHTML() {
  const T = timer, c = T.cfg, C = 2 * Math.PI * 104;
  return `<div class="timer ${T.finished ? 'fin' : ''}" style="--c:${c.color}"><h2>${esc(c.title)}</h2><div class="muted" style="font-size:14px;margin-top:4px">${esc(c.hint)}</div>
    <div class="dial"><svg viewBox="0 0 236 236"><circle class="bg" cx="118" cy="118" r="104"/><circle class="fg" id="tmFg" cx="118" cy="118" r="104" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - timerRemaining() / c.sec)}"/></svg>
    <div class="clock"><b id="tmClock">${fmt(timerRemaining())}</b><span id="tmSub">${T.finished ? 'הסתיים' : T.running ? 'בתהליך' : 'מוכן להתחלה'}</span></div></div>
    ${c.warn ? `<div class="note danger" style="width:100%;text-align:start">${icon('ban')}<span>${esc(c.warn)}</span></div>` : ''}
    <div class="ctrls"><button class="btn" data-act="tm-reset">${icon('reset')}איפוס</button><button class="btn ${T.running ? '' : 'primary'}" data-act="tm-toggle" id="tmBtn">${T.running ? icon('pause') + 'השהה' : icon('play') + (T.finished ? 'שוב' : timerRemaining() < c.sec ? 'המשך' : 'התחל')}</button></div>
    <button class="btn block sm" style="margin-top:10px;background:transparent" data-act="tm-done">${icon('check')}סמן כבוצע וסגור</button></div>`;
}
function openTimer(key, id) {
  const sp = dayInfo(key).sp, st = sp.steps.find(s => s.id === id), cfg = st.timer;
  if (!timer || timer.key !== key || timer.id !== id || timer.finished) timer = { key, id, cfg, running: false, remaining: cfg.sec, endAt: 0, fired: {}, finished: false };
  openSheet(timerHTML(), { color: cfg.color });
  if (!timer.running && timer.remaining === cfg.sec && !timer.finished) timerStart();
}
async function timerStart() {
  const T = timer; if (!T) return;
  audio(); // unlock audio on gesture
  if (T.finished || T.remaining <= 0) { T.remaining = T.cfg.sec; T.finished = false; T.fired = {}; }
  T.running = true; T.endAt = Date.now() + T.remaining * 1000;
  clearInterval(tickId); tickId = setInterval(tick, 250);
  try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {}
  paintTimer(); buzz(15);
}
function timerPause() { if (!timer || !timer.running) return; timer.remaining = timerRemaining(); timer.running = false; clearInterval(tickId); releaseWake(); paintTimer(); }
function timerReset() { if (!timer) return; clearInterval(tickId); releaseWake(); timer.running = false; timer.finished = false; timer.remaining = timer.cfg.sec; timer.fired = {}; paintTimer(); }
function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
function tick() {
  const T = timer; if (!T || !T.running) return;
  const rem = timerRemaining(), el = T.cfg.sec - rem;
  (T.cfg.marks || []).forEach((m, i) => { if (el >= m.at && !T.fired[i]) { T.fired[i] = 1; play('mark'); buzz([60, 40, 60]); toast(m.msg, 'gold', 5000); } });
  paintTimer();
  if (rem <= 0) {
    T.running = false; T.finished = true; T.remaining = 0; clearInterval(tickId); releaseWake();
    play('end'); buzz([200, 100, 200, 100, 400]); toast(T.cfg.end, 'ok', 7000);
    if (document.visibilityState !== 'visible') notify('הטיימר הסתיים ⏱', T.cfg.end, 'hrc-timer');
    setStep(T.key, T.id, true, true); paintTimer();
  }
}
function paintTimer() {
  if (!timer) return;
  const C = 2 * Math.PI * 104, r = timerRemaining();
  const clock = $('#tmClock');
  if (clock && sheet) {
    clock.textContent = fmt(r); $('#tmFg').setAttribute('stroke-dashoffset', C * (1 - r / timer.cfg.sec));
    $('#tmSub').textContent = timer.finished ? 'הסתיים' : timer.running ? 'בתהליך' : 'מוכן להתחלה';
    $('.timer', sheet.sh).classList.toggle('fin', timer.finished);
    const b = $('#tmBtn'); const want = timer.running ? 'pause' : 'play';
    if (b.dataset.s !== want + timer.finished) { b.dataset.s = want + timer.finished; b.className = 'btn ' + (timer.running ? '' : 'primary'); b.innerHTML = timer.running ? icon('pause') + 'השהה' : icon('play') + (timer.finished ? 'שוב' : r < timer.cfg.sec ? 'המשך' : 'התחל'); }
  }
  $$('[data-live-timer]').forEach(e => e.textContent = fmt(r));
}

/* ================= router / render ================= */
const NAV = [['home', 'בית', 'home'], ['cal', 'לוח', 'cal'], ['guide', 'מדריך', 'book'], ['photos', 'תמונות', 'camera'], ['settings', 'הגדרות', 'cog']];
const VIEWS = { home: viewHome, cal: viewCal, guide: viewGuide, photos: viewPhotos, settings: viewSettings };
let renderedDay = todayKey();
function renderNav() { $('#nav').innerHTML = NAV.map(([k, l, ic]) => `<button class="${ui.view === k ? 'on' : ''}" data-act="nav" data-v="${k}" aria-label="${l}" ${ui.view === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></button>`).join(''); }
function render(keepScroll) {
  const v = $('#view'), top = v.scrollTop;
  v.innerHTML = VIEWS[ui.view]();
  v.scrollTop = keepScroll ? top : 0;
  renderedDay = todayKey();
  if (ui.view === 'photos') paintPhotos();
  renderNav();
}
function refresh() {
  render(true);
  $$('#view .enter').forEach(e => e.classList.remove('enter'));
  if (sheet && sheet.rf) { const b = sheetBody(); if (b) { const st = b.scrollTop; b.innerHTML = sheet.rf(); b.scrollTop = st; } }
}
function go(v) { if (ui.view === v) { $('#view').scrollTo({ top: 0 }); return; } ui.view = v; render(); try { history.replaceState(null, '', '#' + v); } catch (e) {} }

/* ================= events ================= */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, d = el.dataset;
  switch (a) {
    case 'nav': go(d.v); break;
    case 'toggle': toggleTask(d.date, d.id); break;
    case 'step': setStep(d.date, d.id); break;
    case 'product': openProduct(d.p); break;
    case 'timer': openTimer(d.date, d.id); break;
    case 'reopen-timer': if (timer) { openSheet(timerHTML(), { color: timer.cfg.color }); } break;
    case 'tm-toggle': timer && (timer.running ? timerPause() : timerStart()); break;
    case 'tm-reset': timerReset(); break;
    case 'tm-done': if (timer) { clearInterval(tickId); releaseWake(); const T = timer; timer = null; setStep(T.key, T.id, true); } dismissSheet(); break;
    case 'day': openDay(d.date); break;
    case 'cal-prev': ui.cal.m++; if (ui.cal.m > 11) { ui.cal.m = 0; ui.cal.y++; } render(true); break;
    case 'cal-next': ui.cal.m--; if (ui.cal.m < 0) { ui.cal.m = 11; ui.cal.y--; } render(true); break;
    case 'angle': ui.angle = d.a; $$('#angSeg button').forEach(b => b.classList.toggle('on', b.dataset.a === d.a)); paintPhotos(); break;
    case 'slot': pickPhoto(d.a); break;
    case 'delphoto': {
      e.stopPropagation();
      if (await confirmDlg({ title: 'מחיקת תמונה', text: 'למחוק את התמונה הזו?', ok: 'מחק', danger: true })) { const k = pkey(curPM(), d.a); await idbDo('photos', 'readwrite', s => s.delete(k)); delete photos[k]; paintPhotos(); }
      break;
    }
    case 'shoot': shoot(d.a, d.cap); break;
    case 'tg-notif':
      if (S.settings.notif) { S.settings.notif = false; save(); render(true); toast('התראות כובו'); }
      else if (await enableNotif()) { S.settings.notif = true; save(); render(true); toast('התראות הופעלו ✓', 'ok'); notify('שגרת צמיחה 🌿', 'ההתראות פעילות. נזכיר לך בשעות שבחרת.', 'hrc-welcome'); }
      break;
    case 'test-notif':
      if (!('Notification' in window)) { toast('הדפדפן אינו תומך בהתראות', 'gold'); break; }
      if (Notification.permission !== 'granted') { if (!await enableNotif()) break; S.settings.notif = true; save(); render(true); }
      if (await notify('בדיקת התראה 🌿', 'ככה תיראה התזכורת שלך.', 'hrc-test')) toast('נשלחה התראת בדיקה', 'ok'); else toast('לא ניתן לשלוח התראה', 'gold');
      break;
    case 'tg-sound': S.settings.sound = !S.settings.sound; save(); render(true); if (S.settings.sound) play('check'); break;
    case 'tg-haptics': S.settings.haptics = !S.settings.haptics; save(); render(true); buzz(30); break;
    case 'install':
      if (isStandalone()) break;
      if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; }
      else openSheet(`<h2 style="font-size:20px;margin-bottom:10px">התקנה למסך הבית</h2><ol class="steps-l"><li><b>iPhone (Safari):</b> לחץ על כפתור השיתוף ← "הוסף למסך הבית".</li><li><b>Android (Chrome):</b> תפריט ⋮ ← "התקן אפליקציה" / "הוסף למסך הבית".</li></ol>`);
      break;
    case 'export': exportData(); break;
    case 'import': importData(); break;
    case 'clear-cache':
      if (await confirmDlg({ title: 'ניקוי מטמון', text: 'מטמון האפליקציה יימחק והאפליקציה תיטען מחדש. הנתונים והתמונות שלך נשמרים.', ok: 'נקה וטען מחדש' })) {
        try { (await caches.keys()).forEach(k => caches.delete(k)); const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch (err) {}
        toast('המטמון נוקה ✓', 'ok'); setTimeout(() => location.reload(), 700);
      }
      break;
    case 'wipe':
      if (await confirmDlg({ title: 'מחיקת כל הנתונים', text: 'כל המעקב, ההגדרות והתמונות יימחקו לצמיתות. מומלץ לייצא גיבוי קודם.', ok: 'מחק הכל', danger: true })) {
        localStorage.clear(); try { await idbDo('photos', 'readwrite', s => s.clear()); await idbDo('meta', 'readwrite', s => s.clear()); } catch (err) {}
        location.reload();
      }
      break;
  }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=checkbox],[role=switch],[role=button]')) { e.preventDefault(); e.target.click(); } if (e.key === 'Escape') dismissSheet(); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.time) { S.settings.times[t.dataset.time] = t.value || S.settings.times[t.dataset.time]; save(); toast('שעת ההתראה עודכנה ✓', 'ok', 1800); }
  if ('start' in t.dataset && t.value) { S.start = t.value; save(); toast('יום 1 עודכן ✓', 'ok', 1800); }
});
document.addEventListener('input', e => { if (e.target.id === 'pmRange') { ui.pm = +e.target.value; paintPhotos(); buzz(4); } });
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
addEventListener('appinstalled', () => { toast('האפליקציה הותקנה ✓', 'ok'); if (ui.view === 'settings') render(true); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (renderedDay !== todayKey()) { ui.cal = { y: new Date().getFullYear(), m: new Date().getMonth() }; render(); }
  checkReminders(); if (timer && timer.running) tick();
});

/* ================= boot ================= */
(async function boot() {
  const q = new URLSearchParams(location.search), h = location.hash.slice(1), want = q.get('view') || h;
  if (VIEWS[want]) ui.view = want;
  await loadPhotos();
  render();
  mirror();
  setInterval(checkReminders, 30000); setTimeout(checkReminders, 1500);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
})();
