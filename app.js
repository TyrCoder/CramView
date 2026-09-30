/* Cramview — vanilla JS, no dependencies.
   Sections: helpers · storage · settings · router · views · play (quiz/exam) · flashcards · backup · boot */
'use strict';

/* =====================================================================
   HELPERS
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const now = () => new Date().toISOString();
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmtDate = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const fmtClock = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/* ---------- Icons (inline SVG, Lucide-style strokes) ---------- */
const ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  rotate: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
  'thumbs-up': '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
};
const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const LIFE_TITLE = `Life system <span class="hm">${icon('heart', 'fill')}${icon('heart', 'fill')}${icon('heart', 'fill')}</span>`;

/* ---------- Motion helpers ---------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Count numbers up from 0 (stat tiles, score). */
function animateCounts(root = document) {
  if (reduced) return;
  $$('.stat b, .big-score', root).forEach((el) => {
    const m = el.textContent.match(/^(\d+)(.*)$/);
    if (!m || +m[1] === 0) return;
    const end = +m[1], suffix = m[2], t0 = performance.now(), dur = 900;
    el.textContent = `0${suffix}`;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = `${Math.round(end * (1 - (1 - p) ** 3))}${suffix}`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function confetti() {
  if (reduced) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#f2d14b', '#e86a4a', '#ede6d6', '#e9b93a', '#f5a08a', '#9bd18a'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--x:${(Math.random() - .5) * 180}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * .4}s;animation-duration:${1.7 + Math.random() * 1.3}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3600);
}
/** Little fragments flying off a heart that was just lost. */
function heartBurst(heart) {
  if (reduced) return;
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('i');
    const a = (Math.PI * 2 * i) / 8 + Math.random() * .5, d = 24 + Math.random() * 18;
    p.className = 'hp';
    p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    heart.appendChild(p);
  }
  setTimeout(() => heart.querySelectorAll('.hp').forEach((x) => x.remove()), 800);
}
/** Touch/click ripple on buttons, options and tappable cards. */
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.btn, .option, .fab, .card.tap');
  if (!t || t.disabled || reduced) return;
  const r = t.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const el = document.createElement('span');
  el.className = 'ripple';
  el.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  t.appendChild(el);
  setTimeout(() => el.remove(), 700);
});

function toast(msg) {
  const err = /fail|could not|couldn|not |isn’t|over |invalid|enter |please|offline|expired|must |no text|different/i.test(msg);
  const ok = !err && /saved|added|deleted|synced|signed|import|complete|ready|downloaded|reset|cleared|removed|sample/i.test(msg);
  const el = document.createElement('div');
  el.className = `toast ${err ? 'err' : ok ? '' : 'info'}`;
  el.innerHTML = icon(err ? 'alert' : ok ? 'check-circle' : 'info');
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2400);
  setTimeout(() => el.remove(), 2750);
}

const TYPE_LABEL = { mc: 'Multiple choice', tf: 'True / False', id: 'Identification', enum: 'Enumeration' };
const TYPE_SHORT = { mc: 'MC', tf: 'T/F', id: 'ID', enum: 'EN' };
const ALL_TYPES = ['mc', 'tf', 'id', 'enum'];
const MAX_LIVES = 3;

/* =====================================================================
   STORAGE — IndexedDB (falls back to localStorage if IndexedDB is blocked)
   Everything is kept in memory in `data` and written through on every change.
   ===================================================================== */
const STORES = ['reviewers', 'questions', 'flashcards', 'attempts'];
const ALL_STORES = [...STORES, 'tombstones', 'files'];
const data = { reviewers: [], questions: [], flashcards: [], attempts: [] };
let tombs = [];          // deletions not yet synced: { id: 'store:id', store, rid, updatedAt }
let known = new Set();   // 'store:id' keys present at the last write (used to spot bulk deletions)
let idb = null;
let useLocalStorage = false;
const keyOf = (store, id) => `${store}:${id}`;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cramview', 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      ALL_STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const idbAll = (store) => new Promise((resolve, reject) => {
  const r = idb.transaction(store).objectStore(store).getAll();
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
function idbTx(fn) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(ALL_STORES, 'readwrite');
    fn(tx);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function loadAll() {
  try {
    // If IndexedDB never answers (some private/locked-down browsers), don't hang on the loading screen
    idb = await Promise.race([openDB(), new Promise((_, rej) => setTimeout(() => rej(new Error('IndexedDB timed out')), 5000))]);
    for (const s of STORES) data[s] = await idbAll(s);
    tombs = await idbAll('tombstones');
  } catch (err) {
    console.warn('IndexedDB unavailable, using localStorage', err);
    useLocalStorage = true;
    try {
      const saved = JSON.parse(localStorage.getItem('cramview-data') || '{}');
      STORES.forEach((s) => (data[s] = Array.isArray(saved[s]) ? saved[s] : []));
      tombs = Array.isArray(saved.tombstones) ? saved.tombstones : [];
    } catch { /* start empty */ }
  }
  // Records saved before sync existed have no edit time — give them one from their creation date
  let stamped = false;
  STORES.forEach((s) => data[s].forEach((o) => {
    if (o.updatedAt) return;
    const c = o.created ?? o.date;
    o.updatedAt = (typeof c === 'number' ? c : Date.parse(c)) || Date.now();
    stamped = true;
  }));
  known = new Set(STORES.flatMap((s) => data[s].map((o) => keyOf(s, o.id))));
  if (stamped) persistAll();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
function writeFailed(err) {
  console.error(err);
  toast('Could not save. Storage may be full or blocked.');
}
function persistLS() {
  try { localStorage.setItem('cramview-data', JSON.stringify({ ...data, tombstones: tombs })); } catch (e) { writeFailed(e); }
}
/** Write one record locally without touching its edit time (also used for records pulled from the cloud). */
function putLocal(store, obj) {
  const i = data[store].findIndex((x) => x.id === obj.id);
  if (i >= 0) data[store][i] = obj; else data[store].push(obj);
  known.add(keyOf(store, obj.id));
  if (useLocalStorage) return persistLS();
  idbTx((tx) => tx.objectStore(store).put(obj)).catch(writeFailed);
}
/** Remove one record locally without leaving a tombstone (used when the cloud says it was deleted). */
function removeLocal(store, id) {
  data[store] = data[store].filter((x) => x.id !== id);
  known.delete(keyOf(store, id));
  if (useLocalStorage) return persistLS();
  idbTx((tx) => tx.objectStore(store).delete(id)).catch(writeFailed);
}
function dropTomb(key) {
  if (!tombs.some((t) => t.id === key)) return;
  tombs = tombs.filter((t) => t.id !== key);
  if (useLocalStorage) return persistLS();
  idbTx((tx) => tx.objectStore('tombstones').delete(key)).catch(writeFailed);
}
/** Insert or update one record (the user changed it, so it will sync). */
function save(store, obj) {
  obj.updatedAt = Date.now();
  dropTomb(keyOf(store, obj.id));
  putLocal(store, obj);
  scheduleSync();
}
/** Delete one record. */
function del(store, id) {
  const t = { id: keyOf(store, id), store, rid: id, updatedAt: Date.now() };
  data[store] = data[store].filter((x) => x.id !== id);
  known.delete(t.id);
  tombs = tombs.filter((x) => x.id !== t.id).concat(t);
  if (useLocalStorage) persistLS();
  else idbTx((tx) => { tx.objectStore(store).delete(id); tx.objectStore('tombstones').put(t); }).catch(writeFailed);
  scheduleSync();
}
/** Rewrite the whole database from memory (used for bulk changes). Anything that disappeared becomes a tombstone. */
function persistAll() {
  const current = new Set(STORES.flatMap((s) => data[s].map((o) => keyOf(s, o.id))));
  const t0 = Date.now();
  known.forEach((k) => {
    if (current.has(k) || tombs.some((t) => t.id === k)) return;
    const i = k.indexOf(':');
    tombs.push({ id: k, store: k.slice(0, i), rid: k.slice(i + 1), updatedAt: t0 });
  });
  tombs = tombs.filter((t) => !current.has(t.id));
  known = current;
  scheduleSync();
  if (useLocalStorage) return persistLS();
  return idbTx((tx) => {
    STORES.forEach((s) => {
      const os = tx.objectStore(s);
      os.clear();
      data[s].forEach((o) => os.put(o));
    });
    const ts = tx.objectStore('tombstones');
    ts.clear();
    tombs.forEach((t) => ts.put(t));
  }).catch(writeFailed);
}

/* Data accessors */
const getReviewer = (id) => data.reviewers.find((r) => r.id === id);
const qsOf = (rid) => data.questions.filter((q) => q.reviewerId === rid).sort((a, b) => a.created - b.created);
const cardsOf = (rid) => data.flashcards.filter((c) => c.reviewerId === rid).sort((a, b) => a.created - b.created);
const attemptsOf = (rid) => data.attempts.filter((a) => a.reviewerId === rid).sort((a, b) => b.date.localeCompare(a.date));

function deleteReviewer(id) {
  data.reviewers = data.reviewers.filter((r) => r.id !== id);
  data.questions = data.questions.filter((q) => q.reviewerId !== id);
  data.flashcards = data.flashcards.filter((c) => c.reviewerId !== id);
  data.attempts = data.attempts.filter((a) => a.reviewerId !== id);
  deleteFilesOf(id);
  persistAll();
}

/* =====================================================================
   SETTINGS (remembered toggles) — per-device convenience only
   ===================================================================== */
const DEFAULT_SETTINGS = {
  quiz: { shuffleQ: true, shuffleC: true, lives: true, source: 'auto', types: ALL_TYPES, count: 10 },
  exam: { count: 10, minutes: 10, shuffle: true, lives: true, source: 'auto', types: ALL_TYPES },
  study: { shuffle: false, onlyLearning: false },
};
let settings = structuredClone(DEFAULT_SETTINGS);
try {
  const s = JSON.parse(localStorage.getItem('cramview-settings') || '{}');
  for (const k of Object.keys(settings)) Object.assign(settings[k], s[k] || {});
  if (!s.aiMigrated) { settings.quiz.source = 'auto'; settings.exam.source = 'auto'; }
} catch { /* defaults */ }
settings.aiMigrated = true;
const saveSettings = () => { try { localStorage.setItem('cramview-settings', JSON.stringify(settings)); } catch { /* ignore */ } };

/* =====================================================================
   QUESTION LOGIC
   ===================================================================== */
const normText = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
function checkIdentification(q, typed) {
  const t = normText(typed);
  if (!t) return false;
  return String(q.answer).split('|').map(normText).filter(Boolean).includes(t);
}
const enumNorm = (s) => normText(s).replace(/^(the|a|an)\s+/, '');
const enumItems = (q) => (Array.isArray(q.answer) ? q.answer : String(q.answer).split(/\n|;|\|/)).map((x) => String(x).trim()).filter(Boolean);
/** Enumeration: every required item must appear (any order, case/spacing ignored). */
function checkEnumeration(q, typed) {
  const parts = String(typed).split(/\n|;|,/).map(enumNorm).filter(Boolean);
  const got = new Set(parts.concat(parts.flatMap((p) => p.split(/\s+and\s+/))));
  const want = enumItems(q).map(enumNorm);
  return want.length > 0 && want.every((w) => got.has(w));
}
function correctText(q) {
  if (q.type === 'mc') return q.choices[q.answer];
  if (q.type === 'tf') return q.answer ? 'True' : 'False';
  if (q.type === 'enum') return enumItems(q).join(', ');
  return String(q.answer).split('|').map((s) => s.trim()).filter(Boolean).join('  /  ');
}

/* =====================================================================
   ROUTER + RENDER
   ===================================================================== */
const app = $('#app');
let session = null; // active quiz/exam
let study = null;   // active flashcard study state
let lastSetup = null;

const go = (path) => { location.hash = '#' + path; };
function render(html) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
  $$('main.container > *:not(.stagger-group), main.container > .stagger-group > *')
    .forEach((el, i) => el.style.setProperty('--i', Math.min(i, 14)));
  animateCounts(app);
}
function topbar(title, backTo, extra = '') {
  return `<header class="topbar">
    ${backTo ? `<button class="btn ghost icon" data-act="nav" data-to="${backTo}" aria-label="Back">${icon('arrow-left')}</button>` : ''}
    <h1>${title}</h1>${extra}
  </header>`;
}

function route() {
  stopTimer();
  const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  const [a, id, sub] = parts;
  if (!(a === 'r' && sub === 'play') && session) session = null;
  if (!(a === 'r' && sub === 'study')) study = null;

  if (!a) return viewHome();
  if (a === 'data') return viewData();
  if (a === 'r') {
    const r = getReviewer(id);
    if (!r) return go('/');
    if (!sub) return viewOverview(r);
    if (sub === 'questions') return viewQuestions(r);
    if (sub === 'cards') return viewCards(r);
    if (sub === 'study') return viewStudy(r);
    if (sub === 'quiz') return viewQuizSetup(r);
    if (sub === 'exam') return viewExamSetup(r);
    if (sub === 'history') return viewHistory(r);
    if (sub === 'play') {
      if (!session) return go(`/r/${id}`);
      return renderPlay();
    }
  }
  go('/');
}

/* =====================================================================
   MODALS
   ===================================================================== */
function openModal(html) {
  $('#modal-root').innerHTML = '';
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
  $('#modal-root').appendChild(back);
  return back.firstElementChild;
}
function closeModal() {
  const backs = [...$('#modal-root').children];
  backs.forEach((b) => b.classList.add('closing'));
  if (backs.length) setTimeout(() => backs.forEach((b) => b.remove()), 240);
}
const modalEl = () => $('#modal-root .modal');

function confirmBox({ title, message, okText = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const m = openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(message)}</p>
      <div class="row" style="margin-top:18px">
        <button class="btn grow" data-x="no">Cancel</button>
        <button class="btn grow ${danger ? 'danger solid' : 'primary'}" data-x="yes">${esc(okText)}</button>
      </div>`);
    m.addEventListener('click', (e) => {
      const x = e.target.closest('[data-x]');
      if (!x) return;
      closeModal();
      resolve(x.dataset.x === 'yes');
    });
  });
}

/* =====================================================================
   VIEW: HOME
   ===================================================================== */
function reviewerCard(r) {
  const nq = qsOf(r.id).length;
  const nc = cardsOf(r.id).length;
  const at = attemptsOf(r.id);
  return `<article class="card tap" data-act="nav" data-to="/r/${r.id}">
    <div class="row between">
      <div class="grow">
        <div class="card-title ellip">${esc(r.title)}</div>
        <div class="muted small ellip">${esc(r.subject || 'No subject')}</div>
      </div>
      <span class="muted chev" aria-hidden="true">${icon('chevron-right')}</span>
    </div>
    <div class="row wrap" style="margin-top:10px;gap:6px">
      <span class="badge primary">${plural(nq, 'question')}</span>
      <span class="badge">${plural(nc, 'card')}</span>
      ${at.length ? `<span class="badge good">Best ${Math.max(...at.map((a) => a.percent))}%</span>` : ''}
    </div>
  </article>`;
}
function homeList(query) {
  const q = normText(query || '');
  const list = data.reviewers
    .filter((r) => !q || normText(`${r.title} ${r.subject} ${r.notes}`).includes(q))
    .sort((a, b) => b.updated.localeCompare(a.updated));
  if (!data.reviewers.length) {
    return `<div class="empty"><span class="empty-ic">${icon('book')}</span>
      <h2>No reviewers yet</h2>
      <p style="margin:6px 0 18px">Create a reviewer for a subject, add questions, then quiz yourself.</p>
      <div class="stack"><button class="btn primary block" data-act="new-reviewer">${icon('plus')}Create your first reviewer</button>
      <button class="btn block" data-act="load-sample">Try a sample reviewer</button></div></div>`;
  }
  if (!list.length) return `<div class="empty"><span class="empty-ic">${icon('search')}</span>Nothing matches “${esc(query)}”.</div>`;
  return list.map(reviewerCard).join('');
}
function viewHome() {
  render(`${topbar(`<span class="brand">${icon('book')}Cramview</span>`, '', `<button class="btn ghost icon" data-act="nav" data-to="/data" aria-label="Sync and backup">${icon('cloud')}</button>`)}
    <main class="container stack">
      ${data.reviewers.length ? `<div class="search-wrap">${icon('search')}<input type="search" id="search" placeholder="Search reviewers…" autocomplete="off"></div>` : ''}
      <div id="home-list" class="stack stagger-group">${homeList('')}</div>
    </main>
    ${data.reviewers.length ? `<button class="fab" data-act="new-reviewer">${icon('plus')}New</button>` : ''}`);
}

/* =====================================================================
   VIEW: OVERVIEW
   ===================================================================== */
function attemptRow(a) {
  const modeBadge = `<span class="badge ${a.mode === 'exam' ? 'warn' : 'primary'}">${a.mode === 'exam' ? 'Exam' : 'Quiz'}</span>`;
  const status = a.status === 'Game Over' ? `<span class="badge bad">Game Over</span>`
    : `<span class="badge good">Completed${a.timeUp ? ' · time up' : ''}</span>`;
  return `<div class="card">
    <div class="row between wrap">
      <div class="row" style="gap:6px">${modeBadge}${status}</div>
      <b>${a.correct}/${a.total} · ${a.percent}%</b>
    </div>
    <div class="row between small muted" style="margin-top:6px">
      <span>${esc(fmtDate(a.date))}</span>
      <span>${a.livesOn ? `<span class="inline-ic">${a.livesLeft} ${icon('heart', 'fill heart-ic')} left</span>` : 'Lives off'}</span>
    </div>
  </div>`;
}
function viewOverview(r) {
  const qs = qsOf(r.id);
  const count = (t) => qs.filter((q) => q.type === t).length;
  const cards = cardsOf(r.id);
  const know = cards.filter((c) => c.status === 'know').length;
  const learning = cards.filter((c) => c.status === 'learning').length;
  const unmarked = cards.length - know - learning;
  const at = attemptsOf(r.id);
  const pcts = at.map((a) => a.percent);
  const best = pcts.length ? Math.max(...pcts) + '%' : '–';
  const last = pcts.length ? pcts[0] + '%' : '–';
  const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) + '%' : '–';

  render(`${topbar(esc(r.title), '/', `<button class="btn ghost icon" data-act="edit-reviewer" data-id="${r.id}" aria-label="Edit reviewer">${icon('edit')}</button>`)}
  <main class="container">
    <div class="card stack">
      <div>
        <h2>${esc(r.title)}</h2>
        ${r.subject ? `<span class="badge primary" style="margin-top:6px">${esc(r.subject)}</span>` : ''}
      </div>
      <div class="section-title" style="margin:6px 0 0">Notes &amp; lessons</div>
      ${r.notes ? `<div class="notes">${esc(r.notes)}</div>` : `<p class="muted">No notes yet. Tap the edit button to add your lessons.</p>`}
    </div>

    <div class="row between">
      <div class="section-title">Files</div>
      <button class="btn sm" data-act="add-files" style="margin:14px 0 10px">${icon('plus')}Add files</button>
    </div>
    <input type="file" id="file-input" multiple class="hidden">
    <div id="files-list" class="stack stagger-group"></div>

    <div class="section-title">Start</div>
    <div class="btn-grid">
      <button class="btn big primary" data-act="start-setup" data-mode="quiz"><span class="big-ic">${icon('target')}</span>Quiz Mode</button>
      <button class="btn big primary" data-act="start-setup" data-mode="exam"><span class="big-ic">${icon('timer')}</span>Exam Mode</button>
      <button class="btn big" data-act="open-cards"><span class="big-ic">${icon('layers')}</span>Flashcards</button>
      <button class="btn big" data-act="nav" data-to="/r/${r.id}/questions"><span class="big-ic">${icon('file-text')}</span>Edit Questions</button>
    </div>
    <button class="btn block" style="margin-top:10px" data-act="nav" data-to="/r/${r.id}/cards">${icon('edit')}Edit Flashcards</button>
    <button class="btn block" style="margin-top:10px" data-act="gen-open" data-rid="${r.id}" data-mode="questions">${icon('sparkles')}Auto-generate from notes &amp; files</button>

    <div class="section-title">Questions</div>
    <div class="stats">
      <div class="stat"><b>${qs.length}</b><span>Total</span></div>
      <div class="stat"><b>${count('mc')}</b><span>Multiple choice</span></div>
      <div class="stat"><b>${count('tf')}</b><span>True / False</span></div>
      <div class="stat"><b>${count('id')}</b><span>Identification</span></div>
      <div class="stat"><b>${count('enum')}</b><span>Enumeration</span></div>
      <div class="stat"><b>${cards.length}</b><span>Flashcards</span></div>
    </div>

    <div class="section-title">Scores</div>
    <div class="stats">
      <div class="stat"><b>${at.length}</b><span>Attempts</span></div>
      <div class="stat"><b>${best}</b><span>Best</span></div>
      <div class="stat"><b>${last}</b><span>Last</span></div>
      <div class="stat"><b>${avg}</b><span>Average</span></div>
    </div>

    <div class="section-title">Flashcard progress</div>
    <div class="card stack">
      ${cards.length ? `
        <div class="bar"><i class="k" style="width:${(know / cards.length) * 100}%"></i><i class="l" style="width:${(learning / cards.length) * 100}%"></i></div>
        <div class="row wrap small">
          <span class="badge good">${icon('check')}Know it: ${know}</span>
          <span class="badge warn">${icon('rotate')}Still learning: ${learning}</span>
          <span class="badge">Not marked: ${unmarked}</span>
        </div>` : `<p class="muted">No flashcards yet.</p>`}
    </div>

    <div class="row between">
      <div class="section-title">History</div>
      ${at.length > 3 ? `<button class="btn ghost sm" data-act="nav" data-to="/r/${r.id}/history" style="margin-top:14px">See all (${at.length})</button>` : ''}
    </div>
    <div class="stack">
      ${at.length ? at.slice(0, 3).map(attemptRow).join('') : `<div class="card muted center">No attempts yet. Take a quiz or exam!</div>`}
    </div>
  </main>`);
  renderFiles(r.id);
}

function viewHistory(r) {
  const at = attemptsOf(r.id);
  render(`${topbar(`History · ${esc(r.title)}`, `/r/${r.id}`)}
    <main class="container stack">
      ${at.length ? at.map(attemptRow).join('') : `<div class="empty"><span class="empty-ic">${icon('clock')}</span>No attempts yet.</div>`}
      ${at.length ? `<button class="btn danger block" data-act="clear-history" data-id="${r.id}">Clear history</button>` : ''}
    </main>`);
}

/* =====================================================================
   REVIEWER FORM
   ===================================================================== */
let rfFiles = []; // files picked in the reviewer form, stored when you tap Save
function reviewerForm(r) {
  rfFiles = [];
  openModal(`<h2>${r ? 'Edit reviewer' : 'New reviewer'}</h2>
    <label class="field"><span class="label">Title</span><input type="text" id="f-title" maxlength="120" value="${esc(r?.title || '')}" placeholder="e.g. Chapter 3 — Cell Biology"></label>
    <label class="field"><span class="label">Subject</span><input type="text" id="f-subject" maxlength="80" value="${esc(r?.subject || '')}" placeholder="e.g. Biology"></label>
    <div class="section-title" style="margin:18px 4px 8px">Files</div>
    <div id="rf-files" class="stack"></div>
    <button type="button" class="btn block" style="margin-top:10px" data-act="rf-pick">${icon('plus')}Add files (PDF, PowerPoint, Word…)</button>
    <input type="file" id="rf-input" multiple class="hidden">
    <div class="card" style="padding:4px 16px;margin-top:12px">${toggleRow('rf-scan', 'Scan files for lessons &amp; notes', 'Text from PDF, Word, PowerPoint and text files is added to the notes', true)}
      ${toggleRow('rf-ai', `${icon('sparkles')}Clean up with AI`, aiMethod() ? 'Keeps only the lessons: removes the subject name, headers, page numbers and cover pages' : 'Add your Groq key in Sync &amp; backup (or sign in) to turn this on', !!aiMethod()).replace('<input type="checkbox"', aiMethod() ? '<input type="checkbox"' : '<input type="checkbox" disabled')}</div>
    <label class="field" style="margin-top:14px"><span class="label">Notes / lessons</span><textarea id="f-notes" style="min-height:200px" placeholder="Type or paste your lessons here. Text found in your files is added after it.">${esc(r?.notes || '')}</textarea></label>
    <div class="row" style="margin-top:18px">
      <button class="btn grow" data-act="close-modal">Cancel</button>
      <button class="btn primary grow" data-act="save-reviewer" data-id="${r?.id || ''}">Save</button>
    </div>
    ${r ? `<button class="btn danger block" style="margin-top:10px" data-act="delete-reviewer" data-id="${r.id}">Delete this reviewer</button>` : ''}`);
  renderRfFiles();
  setTimeout(() => $('#f-title')?.focus(), 50);
}
function renderRfFiles() {
  const box = $('#rf-files');
  if (!box) return;
  box.innerHTML = rfFiles.map((f, i) => `<div class="card" style="padding:10px 12px"><div class="list-item">
      ${fileIcon(f.name)}
      <div class="grow"><div class="ellip" style="font-weight:650">${esc(f.name)}</div>
        <div class="small muted">${fmtSize(f.size)}${SCAN_RE.test(f.name) ? '' : ' · can’t be scanned'}</div></div>
      <button type="button" class="btn sm ghost icon" data-act="rf-remove" data-i="${i}" aria-label="Remove file">${icon('x')}</button>
    </div></div>`).join('');
}

/* =====================================================================
   VIEW: QUESTIONS (list + form)
   ===================================================================== */
function viewQuestions(r) {
  const qs = qsOf(r.id);
  render(`${topbar('Questions', `/r/${r.id}`, `<span class="badge">${qs.length}</span>`)}
    <main class="container stack">
      <button class="btn block" data-act="gen-open" data-rid="${r.id}" data-mode="questions">${icon('sparkles')}Auto-generate questions</button>
      ${qs.length ? qs.map((q, i) => `<div class="card">
        <div class="row between">
          <span class="badge primary">${i + 1} · ${TYPE_LABEL[q.type]}</span>
          <div class="row" style="gap:6px">
            <button class="btn sm" data-act="edit-question" data-id="${q.id}">Edit</button>
            <button class="btn sm danger" data-act="delete-question" data-id="${q.id}">Delete</button>
          </div>
        </div>
        <div class="clamp2" style="margin-top:10px;font-weight:650;white-space:pre-wrap">${esc(q.text)}</div>
        <div class="small muted ellip" style="margin-top:4px">Answer: ${esc(correctText(q))}</div>
      </div>`).join('') : `<div class="empty"><span class="empty-ic">${icon('file-text')}</span><h2>No questions yet</h2><p>Tap the button below to add your first one.</p></div>`}
    </main>
    <button class="fab" data-act="new-question" data-rid="${r.id}">${icon('plus')}Question</button>`);
}

let qForm = null; // { rid, id, type }
function questionForm(rid, q) {
  qForm = { rid, id: q?.id || null, type: q?.type || 'mc' };
  const ch = q?.type === 'mc' ? q.choices : ['', '', '', ''];
  const correct = q?.type === 'mc' ? q.answer : 0;
  const tf = q?.type === 'tf' ? q.answer : true;
  openModal(`<h2>${q ? 'Edit question' : 'New question'}</h2>
    <div class="seg" id="q-seg">
      ${ALL_TYPES.map((t) => `<button type="button" data-act="q-type" data-t="${t}" class="${qForm.type === t ? 'on' : ''}">${TYPE_SHORT[t]}</button>`).join('')}
    </div>
    <p class="small muted center" id="q-type-label" style="margin:6px 0 12px">${TYPE_LABEL[qForm.type]}</p>
    <label class="field"><span class="label">Question</span><textarea id="q-text" style="min-height:90px" placeholder="Type the question…">${esc(q?.text || '')}</textarea></label>

    <div id="sec-mc" class="field ${qForm.type === 'mc' ? '' : 'hidden'}">
      <span class="label" style="display:block;font-weight:650;font-size:.9rem;margin-bottom:6px">Choices — select the correct one</span>
      ${ch.map((c, i) => `<div class="choice-row">
        <input type="radio" name="q-correct" value="${i}" ${i === correct ? 'checked' : ''} aria-label="Correct choice ${i + 1}">
        <input type="text" class="q-choice" value="${esc(c)}" placeholder="Choice ${'ABCD'[i]}">
      </div>`).join('')}
    </div>

    <div id="sec-tf" class="field ${qForm.type === 'tf' ? '' : 'hidden'}">
      <span class="label" style="display:block;font-weight:650;font-size:.9rem;margin-bottom:6px">Correct answer</span>
      <div class="seg" id="tf-seg">
        <button type="button" data-act="tf-pick" data-v="true" class="${tf ? 'on' : ''}">True</button>
        <button type="button" data-act="tf-pick" data-v="false" class="${tf ? '' : 'on'}">False</button>
      </div>
    </div>

    <label id="sec-id" class="field ${qForm.type === 'id' ? '' : 'hidden'}">
      <span class="label">Correct answer</span>
      <input type="text" id="q-ans" autocomplete="off" value="${q?.type === 'id' ? esc(q.answer) : ''}" placeholder="e.g. Mitochondria">
      <span class="small muted">Capitalization and extra spaces are ignored. Accept several answers by separating them with <b>|</b> (e.g. <i>USA | United States</i>).</span>
    </label>

    <label id="sec-enum" class="field ${qForm.type === 'enum' ? '' : 'hidden'}">
      <span class="label">Correct items (one per line)</span>
      <textarea id="q-enum" style="min-height:110px" placeholder="Red&#10;Blue&#10;Yellow">${q?.type === 'enum' ? esc(enumItems(q).join('\n')) : ''}</textarea>
      <span class="small muted">The student must list every item, in any order. Capitalization and extra spaces are ignored.</span>
    </label>

    <div class="row" style="margin-top:18px">
      <button class="btn grow" data-act="close-modal">Cancel</button>
      <button class="btn primary grow" data-act="save-question" data-more="0">Save</button>
    </div>
    ${q ? '' : `<button class="btn block" style="margin-top:10px" data-act="save-question" data-more="1">Save &amp; add another</button>`}`);
}
function saveQuestion(more) {
  const m = modalEl();
  const text = $('#q-text', m).value.trim();
  if (!text) return toast('Please type the question.');
  const prev = qForm.id ? data.questions.find((x) => x.id === qForm.id) : null;
  const q = { id: qForm.id || uid(), reviewerId: qForm.rid, type: qForm.type, text, created: prev?.created || Date.now() };
  if (q.type === 'mc') {
    q.choices = $$('.q-choice', m).map((i) => i.value.trim());
    if (q.choices.some((c) => !c)) return toast('Please fill in all 4 choices.');
    if (new Set(q.choices.map(normText)).size < 4) return toast('Choices must be different from each other.');
    q.answer = Number($('input[name="q-correct"]:checked', m).value);
  } else if (q.type === 'tf') {
    q.answer = $('#tf-seg .on', m).dataset.v === 'true';
  } else if (q.type === 'enum') {
    q.answer = $('#q-enum', m).value.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
    if (q.answer.length < 2) return toast('Please list at least 2 items, one per line.');
  } else {
    q.answer = $('#q-ans', m).value.trim();
    if (!q.answer) return toast('Please type the correct answer.');
  }
  save('questions', q);
  touchReviewer(qForm.rid);
  toast('Question saved');
  if (more) return questionForm(qForm.rid, null), route();
  closeModal();
  route();
}
function touchReviewer(id) {
  const r = getReviewer(id);
  if (r) { r.updated = now(); save('reviewers', r); }
}

/* =====================================================================
   SETUP SCREENS (Quiz / Exam)
   ===================================================================== */
function toggleRow(id, title, sub, on) {
  return `<label class="toggle"><span class="t-text"><b>${title}</b><span class="small muted">${sub}</span></span>
    <span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></span></label>`;
}
const SRC_LABEL = [['ai', 'AI'], ['generated', 'Offline'], ['saved', 'Saved'], ['mixed', 'Mixed']];
const SRC_HINT = {
  ai: 'The AI writes a fresh set from your notes and files every time. Needs internet, and your Groq key or an account (Sync & backup).',
  generated: 'Simple offline rules, no AI: a fresh random set from your notes and files. Works without internet.',
  saved: 'Only the questions you wrote or saved in this reviewer.',
  mixed: 'Some of your saved questions plus fresh AI-written ones (offline rules if AI is unavailable).',
};
function questionSourceCard(src, types, count, max) {
  return `<div class="section-title">Questions</div>
    <div class="card stack">
      <div class="seg" id="o-src">${SRC_LABEL.map(([v, l]) => `<button type="button" data-act="src-pick" data-v="${v}" class="${v === src ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="small muted" id="o-src-hint">${SRC_HINT[src]}</p>
      <div>
        <span style="display:block;font-weight:650;font-size:.9rem;margin-bottom:8px">Question types <span class="muted" style="font-weight:500">(pick one or more)</span></span>
        <div class="row wrap" id="o-types" style="gap:8px">${ALL_TYPES.map((t) => `<button type="button" class="chip ${types.includes(t) ? 'on' : ''}" data-act="type-pick" data-t="${t}">${icon('check')}${TYPE_LABEL[t]}</button>`).join('')}</div>
      </div>
      <label class="field"><span class="label">Number of questions (1–${max})</span>
        <input type="number" id="o-count" inputmode="numeric" min="1" max="${max}" value="${count}"></label>
    </div>`;
}
function defaultSource(r, s, saved) {
  if (s.source && s.source !== 'auto') return s.source;
  if (aiMethod()) return 'ai';
  return (r.notes || '').length > 40 || !saved ? 'generated' : 'saved';
}
function viewQuizSetup(r) {
  const saved = qsOf(r.id).length;
  const s = settings.quiz;
  render(`${topbar('Quiz Mode', `/r/${r.id}`)}
    <main class="container stack">
      <div class="card"><div class="card-title">${esc(r.title)}</div><div class="muted small">${plural(saved, 'saved question')} · answers are shown right after each question</div></div>
      ${questionSourceCard(defaultSource(r, s, saved), s.types, clamp(s.count || 10, 1, 100), 100)}
      <div class="card">
        ${toggleRow('o-shufq', 'Shuffle questions', 'Random order each time', s.shuffleQ)}
        ${toggleRow('o-shufc', 'Shuffle choices', 'Mixes up multiple-choice options', s.shuffleC)}
        ${toggleRow('o-lives', LIFE_TITLE, 'Lose a heart on each wrong answer. Lose all 3 and it is Game Over.', s.lives)}
      </div>
      <button class="btn primary block big" data-act="begin" data-mode="quiz" data-id="${r.id}">Start Quiz</button>
    </main>`);
}
function viewExamSetup(r) {
  const saved = qsOf(r.id).length;
  const s = settings.exam;
  render(`${topbar('Exam Mode', `/r/${r.id}`)}
    <main class="container stack">
      <div class="card"><div class="card-title">${esc(r.title)}</div><div class="muted small">${plural(saved, 'saved question')} · correct answers are revealed only at the end</div></div>
      ${questionSourceCard(defaultSource(r, s, saved), s.types, clamp(s.count || 10, 1, 60), 60)}
      <div class="card">
        <label class="field"><span class="label">Time limit (minutes)</span>
          <input type="number" id="o-min" inputmode="numeric" min="1" max="300" value="${s.minutes}"></label>
      </div>
      <div class="card">
        ${toggleRow('o-shuf', 'Shuffle questions &amp; choices', 'Turn off to take the first questions in order', s.shuffle)}
        ${toggleRow('o-lives', LIFE_TITLE, 'Lose a heart on each wrong answer. Lose all 3 and the exam ends.', s.lives)}
      </div>
      <button class="btn primary block big" data-act="begin" data-mode="exam" data-id="${r.id}">Start Exam</button>
    </main>`);
}

/** Files whose lessons are already in the notes (so they shouldn't be read a second time). */
const covered = (r, name) => (r.scanned || []).includes(name) || (r.notes || '').includes(`— ${name} —`);
/** All readable text for a reviewer: its notes plus attached PDF/.docx/.pptx/.txt/.md files not already scanned into the notes. */
async function sourceTextOf(r) {
  const parts = [r.notes || ''];
  for (const f of (await filesOf(r.id)).filter((x) => SCAN_RE.test(x.name) && !covered(r, x.name))) {
    try { parts.push(tidyLessonText(await extractText(f), { title: r.title, subject: r.subject, file: f.name })); } catch { /* skip unreadable file */ }
  }
  return parts.join('\n');
}
/** Build the question list for a quiz/exam: saved, freshly generated, or a mix. */
async function buildQuestionPool(setup) {
  const rid = setup.reviewerId;
  const r = getReviewer(rid);
  const count = setup.count;
  const saved = (setup.source === 'generated' || setup.source === 'ai') ? [] : qsOf(rid).filter((q) => setup.types.includes(q.type));
  let made = [];
  if (setup.source !== 'saved') {
    made = (await madeQuestions(await sourceTextOf(r), setup)).map((it) => ({
      id: uid(), reviewerId: rid, type: it.type, text: it.text, answer: it.answer,
      ...(it.type === 'mc' ? { choices: it.choices } : {}), ...(it.explanation ? { explanation: it.explanation } : {}),
    }));
  }
  let pool;
  if (setup.source === 'mixed') {
    const fromSaved = shuffle(saved).slice(0, Math.ceil(count / 2));
    pool = shuffle([...fromSaved, ...made.slice(0, count - fromSaved.length)]);
  } else {
    pool = setup.source === 'saved' ? saved : made;
  }
  if (!pool.length) {
    throw new Error(setup.source === 'saved'
      ? 'No saved questions of those types. Add some, or switch to AI or Offline.'
      : 'Couldn’t find enough facts in your notes for those types. Try more types, or add notes or files.');
  }
  return pool.slice(0, count);
}
async function startFromSetup(setup) {
  const pool = await buildQuestionPool(setup);
  startSession(setup, pool);
  if (pool.length < setup.count && setup.source !== 'saved') toast(`Only found ${plural(pool.length, 'question')} in your notes.`);
}

/* =====================================================================
   PLAY: QUIZ + EXAM
   ===================================================================== */
let timerId = null;
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

function startSession(setup, pool) {
  lastSetup = setup;
  let list = pool || qsOf(setup.reviewerId);
  if (setup.shuffleQ) list = shuffle(list);
  if (setup.count) list = list.slice(0, setup.count);
  const items = list.map((q) => {
    let choices = null;
    if (q.type === 'mc') {
      choices = q.choices.map((text, i) => ({ text, correct: i === q.answer }));
      if (setup.shuffleC) choices = shuffle(choices);
    } else if (q.type === 'tf') {
      choices = [{ text: 'True', correct: q.answer === true }, { text: 'False', correct: q.answer === false }];
    }
    return { q, choices, answered: false, user: null, correct: false };
  });
  session = {
    setup, reviewerId: setup.reviewerId, mode: setup.mode, items, index: 0,
    lives: MAX_LIVES, livesOn: setup.lives, correct: 0, answeredCount: 0,
    finished: false, endReason: null,
    endAt: setup.mode === 'exam' ? Date.now() + setup.minutes * 60000 : null,
  };
}

function renderPlay() {
  stopTimer();
  const s = session;
  if (s.finished) return renderResults();
  const exam = s.mode === 'exam';
  render(`<header class="topbar">
      <button class="btn ghost icon" data-act="quit" aria-label="Quit">${icon('x')}</button>
      ${s.livesOn
        ? `<div class="hearts" id="hearts" aria-label="${s.lives} lives left">${Array.from({ length: MAX_LIVES }, (_, i) => `<span class="heart ${i >= s.lives ? 'lost' : ''}" data-h="${i}">${icon('heart', 'fill')}</span>`).join('')}</div>`
        : `<span class="badge">Lives off</span>`}
      <div class="grow center small muted" id="pcount"></div>
      ${exam ? `<div class="timer" id="timer">${fmtClock(s.endAt - Date.now())}</div>` : ''}
    </header>
    <main class="container stack">
      <div class="progress-line"><i id="pbar"></i></div>
      <div id="play-body"></div>
    </main>`);
  if (exam) {
    timerId = setInterval(tick, 250);
    tick();
  }
  renderQuestion();
}
function tick() {
  const s = session;
  if (!s || s.finished) return stopTimer();
  const left = s.endAt - Date.now();
  const el = $('#timer');
  if (el) {
    el.textContent = fmtClock(left);
    el.classList.toggle('low', left <= 60000);
  }
  if (left <= 0) finishSession('timeup');
}

function renderQuestion() {
  const s = session;
  if (!s || s.finished) return;
  const it = s.items[s.index];
  const q = it.q;
  const quiz = s.mode === 'quiz';
  const enter = s.shown !== s.index;
  s.shown = s.index;
  $('#pcount').textContent = `Question ${s.index + 1} of ${s.items.length}`;
  $('#pbar').style.width = `${(s.index / s.items.length) * 100}%`;

  let inner;
  if (it.choices) {
    inner = `<div class="options">${it.choices.map((c, i) => {
      let cls = '';
      if (it.answered) {
        if (quiz) cls = c.correct ? 'correct' : (i === it.user ? 'wrong' : '');
        else cls = i === it.user ? 'selected' : '';
      }
      return `<button class="option ${cls}" style="--i:${i}" data-act="pick" data-i="${i}" ${it.answered ? 'disabled' : ''}>
        <span class="letter">${q.type === 'tf' ? icon(i ? 'x' : 'check') : 'ABCD'[i]}</span><span class="txt">${esc(c.text)}</span></button>`;
    }).join('')}</div>`;
  } else if (q.type === 'enum') {
    inner = `<div style="margin-top:16px">
      <p class="small muted" style="margin-bottom:8px">${enumItems(q).length} items, in any order. Put each on a new line or separate them with commas.</p>
      <textarea id="id-input" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" style="min-height:120px"
        placeholder="Type your answers…" ${it.answered ? 'disabled' : ''}>${it.answered ? esc(it.user) : ''}</textarea>
      ${it.answered ? '' : `<button class="btn primary block" style="margin-top:10px" data-act="submit-id">${quiz ? 'Check answer' : 'Submit answer'}</button>`}
    </div>`;
  } else {
    inner = `<div style="margin-top:16px">
      <input type="text" id="id-input" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
        placeholder="Type your answer…" value="${it.answered ? esc(it.user) : ''}" ${it.answered ? 'disabled' : ''}>
      ${it.answered ? '' : `<button class="btn primary block" style="margin-top:10px" data-act="submit-id">${quiz ? 'Check answer' : 'Submit answer'}</button>`}
    </div>`;
  }

  let feedback = '';
  if (it.answered && quiz) {
    feedback = `<div class="feedback ${it.correct ? 'good' : 'bad'}">
      <div class="fb-title">${it.correct ? `${icon('check-circle')}Correct!` : `${icon('x-circle')}Wrong`}</div>
      ${it.correct ? '' : `<div class="ans">Correct answer: ${esc(correctText(q))}</div>`}
      ${q.explanation ? `<div class="why">${esc(q.explanation)}</div>` : ''}
    </div>`;
  }
  const last = s.index + 1 >= s.items.length;
  const dead = s.livesOn && s.lives <= 0;
  const next = it.answered && quiz
    ? `<button class="btn primary block big" data-act="next">${dead ? 'Continue' : last ? 'See results' : 'Next question'}${icon('arrow-right')}</button>` : '';

  $('#play-body').innerHTML = `<div class="stack">
    <div class="card q-card ${enter ? 'q-enter' : ''} ${it.answered && quiz && !it.correct ? 'shake' : ''}">
      <span class="badge">${TYPE_LABEL[q.type]}</span>
      <div class="q-text" style="margin-top:10px">${esc(q.text)}</div>
      ${inner}
    </div>${feedback}${next}</div>`;
  if (!it.answered && !it.choices) $('#id-input')?.focus();
}

function submitAnswer(value) {
  const s = session;
  if (!s || s.finished) return;
  const it = s.items[s.index];
  if (it.answered) return;
  it.answered = true;
  it.user = value;
  it.correct = it.choices ? it.choices[value].correct : it.q.type === 'enum' ? checkEnumeration(it.q, value) : checkIdentification(it.q, value);
  s.answeredCount++;
  if (it.correct) {
    s.correct++;
  } else {
    if (navigator.vibrate) navigator.vibrate(120);
    if (s.livesOn) {
      s.lives--;
      const h = $(`#hearts [data-h="${s.lives}"]`);
      if (h) { h.classList.add('lost', 'lose-anim'); heartBurst(h); }
    }
  }
  renderQuestion();
  if (s.mode === 'exam') {
    // No answer reveal in exams — move on after a short beat (lets the heart animation play)
    setTimeout(() => { if (session === s && !s.finished) advance(); }, it.correct ? 450 : 850);
  }
}
function advance() {
  const s = session;
  if (!s || s.finished) return;
  if (s.livesOn && s.lives <= 0) return finishSession('over');
  if (s.index + 1 >= s.items.length) return finishSession('done');
  s.index++;
  renderQuestion();
  window.scrollTo(0, 0);
}

function finishSession(reason) {
  const s = session;
  if (!s || s.finished) return;
  stopTimer();
  s.finished = true;
  s.endReason = reason;
  const total = s.items.length;
  save('attempts', {
    id: uid(), reviewerId: s.reviewerId, mode: s.mode, date: now(),
    correct: s.correct, total, answered: s.answeredCount,
    percent: Math.round((s.correct / total) * 100),
    livesOn: s.livesOn, livesLeft: s.livesOn ? s.lives : null,
    status: reason === 'over' ? 'Game Over' : 'Completed',
    timeUp: reason === 'timeup',
  });
  renderResults();
}

function renderResults() {
  const s = session;
  const r = getReviewer(s.reviewerId);
  const total = s.items.length;
  const pct = Math.round((s.correct / total) * 100);
  const over = s.endReason === 'over';
  const heroIc = over ? 'skull' : pct >= 90 ? 'trophy' : pct >= 70 ? 'award' : pct >= 50 ? 'thumbs-up' : 'zap';
  const title = over ? 'Game Over' : s.endReason === 'timeup' ? "Time's up!" : 'Completed!';
  const livesLine = !s.livesOn ? 'Life system was off'
    : over ? `You lost all 3 ${icon('heart', 'fill heart-ic')}` : `Finished with ${s.lives} ${icon('heart', 'fill heart-ic')} left`;

  const review = s.items.map((it, i) => {
    const q = it.q;
    const yours = !it.answered ? null : it.choices ? it.choices[it.user].text : it.user;
    return `<div class="card review-item ${it.correct ? 'ok' : 'no'}">
      <div class="row between"><span class="badge">${i + 1} · ${TYPE_LABEL[q.type]}</span>
        <span class="badge ${it.correct ? 'good' : 'bad'}">${it.correct ? 'Correct' : it.answered ? 'Wrong' : 'Not answered'}</span></div>
      <div style="margin-top:8px;font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere">${esc(q.text)}</div>
      <div class="small" style="margin-top:6px;overflow-wrap:anywhere">Your answer: <b>${yours === null ? '—' : esc(yours) || '(blank)'}</b></div>
      ${it.correct ? '' : `<div class="small" style="overflow-wrap:anywhere">Correct answer: <b>${esc(correctText(q))}</b></div>`}
      ${q.explanation ? `<div class="small muted" style="margin-top:4px;overflow-wrap:anywhere">${esc(q.explanation)}</div>` : ''}
    </div>`;
  }).join('');

  render(`${topbar(s.mode === 'exam' ? 'Exam results' : 'Quiz results', '')}
    <main class="container stack">
      <div class="card result-hero ${over ? 'over' : ''}">
        <span class="hero-ic">${icon(heroIc)}</span>
        <h2 style="margin-top:8px">${title}</h2>
        <div class="big-score">${s.correct} / ${total}</div>
        <div class="muted" style="font-size:1.1rem;font-weight:700">${pct}%</div>
        <p style="margin-top:12px;font-weight:650">${livesLine}</p>
        <p class="muted small">${over ? 'Score so far · ' : ''}Answered ${s.answeredCount} of ${total} questions</p>
        ${r ? `<p class="muted small">${esc(r.title)}</p>` : ''}
      </div>
      <div class="btn-grid">
        <button class="btn primary big" data-act="retry">${s.setup.source === 'saved' ? 'Retry' : 'New random set'}</button>
        <button class="btn big" data-act="nav" data-to="/r/${s.reviewerId}">Go back</button>
      </div>
      <div class="section-title">Review</div>
      <div class="stack">${review}</div>
    </main>`);
  if (!over && pct >= 70) confetti();
}

/* =====================================================================
   FLASHCARDS — manage
   ===================================================================== */
const STATUS_BADGE = {
  know: '<span class="badge good">Know it</span>',
  learning: '<span class="badge warn">Still learning</span>',
  new: '<span class="badge">New</span>',
};
function viewCards(r) {
  const cards = cardsOf(r.id);
  const nq = qsOf(r.id).length;
  render(`${topbar('Flashcards', `/r/${r.id}`, `<span class="badge">${cards.length}</span>`)}
    <main class="container stack">
      <div class="btn-grid">
        <button class="btn primary" data-act="nav" data-to="/r/${r.id}/study" ${cards.length ? '' : 'disabled'}>${icon('layers')}Study</button>
        <button class="btn" data-act="generate-cards" data-id="${r.id}" ${nq ? '' : 'disabled'}>${icon('sparkles')}From questions</button>
      </div>
      <button class="btn block" data-act="gen-open" data-rid="${r.id}" data-mode="cards">${icon('sparkles')}Generate from notes &amp; files</button>
      ${cards.length ? `<button class="btn danger block sm" data-act="reset-progress" data-id="${r.id}">Reset “Know it” progress</button>` : ''}
      ${cards.length ? cards.map((c) => `<div class="card">
        <div class="row between">
          <div class="row" style="gap:6px">${STATUS_BADGE[c.status || 'new']}${c.questionId ? '<span class="badge">auto</span>' : ''}</div>
          <div class="row" style="gap:6px">
            <button class="btn sm" data-act="edit-card" data-id="${c.id}">Edit</button>
            <button class="btn sm danger" data-act="delete-card" data-id="${c.id}">Delete</button>
          </div>
        </div>
        <div class="clamp2" style="margin-top:10px;font-weight:650;white-space:pre-wrap">${esc(c.front)}</div>
        <div class="clamp2 small muted" style="white-space:pre-wrap">${esc(c.back)}</div>
      </div>`).join('') : `<div class="empty"><span class="empty-ic">${icon('layers')}</span><h2>No flashcards yet</h2>
        <p>${nq ? 'Tap “From questions” to auto-make a deck, or add your own.' : 'Add your own cards with the button below.'}</p></div>`}
    </main>
    <button class="fab" data-act="new-card" data-rid="${r.id}">${icon('plus')}Card</button>`);
}
function cardForm(rid, c) {
  openModal(`<h2>${c ? 'Edit flashcard' : 'New flashcard'}</h2>
    <label class="field"><span class="label">Front (question / term)</span><textarea id="c-front" style="min-height:90px">${esc(c?.front || '')}</textarea></label>
    <label class="field"><span class="label">Back (answer / definition)</span><textarea id="c-back" style="min-height:90px">${esc(c?.back || '')}</textarea></label>
    <div class="row" style="margin-top:18px">
      <button class="btn grow" data-act="close-modal">Cancel</button>
      <button class="btn primary grow" data-act="save-card" data-rid="${rid}" data-id="${c?.id || ''}" data-more="0">Save</button>
    </div>
    ${c ? '' : `<button class="btn block" style="margin-top:10px" data-act="save-card" data-rid="${rid}" data-id="" data-more="1">Save &amp; add another</button>`}`);
  setTimeout(() => $('#c-front')?.focus(), 50);
}
function generateCards(rid) {
  const have = new Set(cardsOf(rid).map((c) => c.questionId).filter(Boolean));
  let added = 0;
  qsOf(rid).forEach((q, i) => {
    if (have.has(q.id)) return;
    save('flashcards', { id: uid(), reviewerId: rid, front: q.text, back: correctText(q), status: 'new', questionId: q.id, created: Date.now() + i });
    added++;
  });
  toast(added ? `Added ${plural(added, 'flashcard')}` : 'All questions already have flashcards.');
  route();
}

/* =====================================================================
   FLASHCARDS — study
   ===================================================================== */
function buildDeck(rid) {
  let cards = cardsOf(rid);
  if (study?.onlyLearning) cards = cards.filter((c) => c.status !== 'know');
  if (study?.shuffle) cards = shuffle(cards);
  return cards.map((c) => c.id);
}
function viewStudy(r) {
  study = { rid: r.id, shuffle: settings.study.shuffle, onlyLearning: settings.study.onlyLearning, deck: [], i: 0, flipped: false, swipedAt: 0 };
  if (!cardsOf(r.id).length) { toast('Add some flashcards first.'); return go(`/r/${r.id}/cards`); }
  study.deck = buildDeck(r.id);
  renderStudy();
}
function renderStudy() {
  const st = study;
  const r = getReviewer(st.rid);
  const head = topbar(`${esc(r.title)}`, `/r/${r.id}`);
  const opts = `<div class="row wrap" style="gap:8px">
      <button class="btn sm ${st.shuffle ? 'primary' : ''}" data-act="study-opt" data-o="shuffle">${icon('shuffle')}Shuffle ${st.shuffle ? 'on' : 'off'}</button>
      <button class="btn sm ${st.onlyLearning ? 'primary' : ''}" data-act="study-opt" data-o="onlyLearning">${icon('rotate')}Still learning only</button>
    </div>`;

  if (!st.deck.length) {
    return render(`${head}<main class="container stack">${opts}
      <div class="empty"><span class="empty-ic">${icon('award')}</span><h2>Nothing left to study</h2><p>You marked every card “Know it”. Turn off “Still learning only” to see them all.</p></div></main>`);
  }
  if (st.i >= st.deck.length) {
    const ids = new Set(st.deck);
    const cs = data.flashcards.filter((c) => ids.has(c.id));
    const know = cs.filter((c) => c.status === 'know').length;
    return render(`${head}<main class="container stack">
      <div class="card result-hero"><span class="hero-ic">${icon('award')}</span><h2 style="margin-top:8px">Deck finished!</h2>
        <p style="margin-top:10px"><span class="badge good">Know it: ${know}</span> <span class="badge warn">Still learning: ${cs.length - know}</span></p></div>
      <div class="btn-grid">
        <button class="btn primary big" data-act="study-restart">Restart deck</button>
        <button class="btn big" data-act="nav" data-to="/r/${r.id}">Go back</button>
      </div>${opts}</main>`);
  }
  const c = data.flashcards.find((x) => x.id === st.deck[st.i]);
  st.flipped = false;
  render(`${head}<main class="container stack">
    ${opts}
    <div class="row between small muted"><b id="st-count" style="color:var(--text)">Card ${st.i + 1} of ${st.deck.length}</b><span>Tap card to flip · swipe left or right</span></div>
    <div class="progress-line"><i id="st-bar" style="width:${(st.i / st.deck.length) * 100}%"></i></div>
    <div class="fc-wrap" id="fc-wrap">
      <div class="fc" id="fc" data-act="flip" tabindex="0" role="button" aria-label="Flashcard. Activate to flip.">
        <div class="fc-face front"><span class="fc-side">Front</span><span class="fc-status" id="fc-st1"></span><div class="fc-text" id="fc-front"></div></div>
        <div class="fc-face back"><span class="fc-side">Back</span><span class="fc-status" id="fc-st2"></span><div class="fc-text" id="fc-back"></div></div>
      </div>
    </div>
    <div class="btn-grid">
      <button class="btn warn-btn big" data-act="mark" data-s="learning">${icon('rotate')}Still learning</button>
      <button class="btn good big" data-act="mark" data-s="know">${icon('check')}Know it</button>
    </div>
    <div class="row">
      <button class="btn grow" data-act="card-prev" ${st.i === 0 ? 'disabled' : ''} id="st-prev">${icon('arrow-left')}Previous</button>
      <button class="btn grow" data-act="card-next" id="st-next">Next${icon('arrow-right')}</button>
    </div>
  </main>`);
  fillCard(c);
  bindSwipe();
}
function fillCard(c) {
  $('#fc-front').textContent = c.front;
  $('#fc-back').textContent = c.back;
  const badge = c.status === 'know' ? STATUS_BADGE.know : c.status === 'learning' ? STATUS_BADGE.learning : '';
  $('#fc-st1').innerHTML = badge;
  $('#fc-st2').innerHTML = badge;
}
function flipCard() {
  const fc = $('#fc');
  if (!fc) return;
  study.flipped = !study.flipped;
  fc.classList.toggle('flipped', study.flipped);
}
function gotoCard(i, dir) {
  const st = study;
  if (i < 0) return;
  if (i >= st.deck.length) { st.i = st.deck.length; return renderStudy(); }
  st.i = i;
  const c = data.flashcards.find((x) => x.id === st.deck[i]);
  const fc = $('#fc');
  const update = () => {
    fillCard(c);
    $('#st-count').textContent = `Card ${i + 1} of ${st.deck.length}`;
    $('#st-bar').style.width = `${(i / st.deck.length) * 100}%`;
    $('#st-prev').disabled = i === 0;
    const wrap = $('#fc-wrap');
    wrap.classList.remove('slide-left', 'slide-right');
    void wrap.offsetWidth;
    wrap.classList.add(dir < 0 ? 'slide-right' : 'slide-left');
  };
  if (st.flipped) {
    // flip back first so the next answer is never visible mid-animation
    st.flipped = false;
    fc.classList.remove('flipped');
    setTimeout(() => { if (study === st) update(); }, 280);
  } else {
    update();
  }
}
function bindSwipe() {
  const wrap = $('#fc-wrap');
  let x0 = 0, y0 = 0;
  wrap.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      study.swipedAt = Date.now();
      if (dx < 0) gotoCard(study.i + 1, 1); else if (study.i > 0) gotoCard(study.i - 1, -1);
    }
  }, { passive: true });
}

/* =====================================================================
   BACKUP: export / import
   ===================================================================== */
function aiCard() {
  const m = aiMethod();
  const status = m === 'key' ? 'Using your own Groq key on this device.'
    : m === 'account' ? 'Using your Cramview account (the Supabase function). Add your own key below to use that instead.'
      : `Not set up yet. Add your own Groq key below${syncConfigured ? ', or sign in above and deploy the function (see the README)' : ''}.`;
  return `<div class="card stack"><div class="card-title">${icon('sparkles')}AI questions</div>
    <p class="small ${m ? '' : 'muted'}" id="ai-status">${status}</p>
    <label class="field"><span class="label">Your Groq API key</span>
      <input type="password" id="ai-key" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${aiCfg.key ? 'A key is saved on this device' : 'gsk_...'}"></label>
    <details><summary>Model (optional)</summary>
      <input type="text" id="ai-model" autocomplete="off" autocapitalize="none" spellcheck="false" style="margin-top:8px" value="${esc(aiCfg.model || '')}" placeholder="${AI_DEFAULT_MODEL}">
      <p class="muted small" style="margin-top:6px">If this model isn’t available, the app automatically tries ${AI_BACKUP_MODELS.join(', then ')}.</p></details>
    <div class="btn-grid"><button class="btn primary" data-act="ai-save">Save key</button>
      <button class="btn" data-act="ai-test" ${m ? '' : 'disabled'}>Test AI</button></div>
    ${aiCfg.key ? '<button class="btn danger block sm" data-act="ai-clear">Remove my key</button>' : ''}
    <p class="muted small">Get a free key at console.groq.com/keys. Your key stays on this device only (it isn’t synced or included in backups) and is sent only to Groq.</p></div>`;
}
function viewData() {
  render(`${topbar('Sync & backup', '/')}
    <main class="container stack">
      ${syncCard()}
      ${aiCard()}
      <div class="card stack">
        <div class="card-title">Backup file</div>
        <p class="muted small">Without cloud sync, your data is saved only on this device. Export a file, send it to another device (AirDrop, email, Files), then import it there.</p>
        <button class="btn primary block" data-act="export">${icon('download')}Export all data</button>
        <button class="btn block" data-act="import">${icon('upload')}Import from file</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden">
      </div>
      <div class="card">
        <div class="card-title">On this device</div>
        <p class="muted small" style="margin-top:4px">${plural(data.reviewers.length, 'reviewer')} · ${plural(data.questions.length, 'question')} · ${plural(data.flashcards.length, 'flashcard')} · ${plural(data.attempts.length, 'attempt')}</p>
        <p class="muted small" style="margin-top:8px">Tip: export a backup once in a while, especially before clearing Safari data or removing the app.</p>
      </div>
      <button class="btn danger block" data-act="wipe">Delete all data</button>
      <p class="muted small center">Cramview · works offline</p>
    </main>`);
}
async function exportData() {
  const payload = { app: 'cramview', version: 1, exportedAt: now(), data };
  const json = JSON.stringify(payload, null, 2);
  const name = `cramview-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // On phones, the share sheet is the most reliable way to save a file (esp. iOS home-screen apps)
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Cramview backup' }); return toast('Backup ready'); }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup downloaded');
}
function parseImport(text) {
  const obj = JSON.parse(text);
  const src = obj && obj.data ? obj.data : obj;
  if (!src || !Array.isArray(src.reviewers)) throw new Error('not a backup');
  const out = {};
  STORES.forEach((s) => { out[s] = (Array.isArray(src[s]) ? src[s] : []).filter((x) => x && typeof x.id === 'string'); });
  return out;
}
async function importFile(file) {
  let incoming;
  try { incoming = parseImport(await file.text()); }
  catch { return toast('That file is not a valid Cramview backup.'); }
  STORES.forEach((s) => incoming[s].forEach((o) => { o.updatedAt = Date.now(); }));
  const m = openModal(`<h2>Import backup</h2>
    <p class="muted">Found ${plural(incoming.reviewers.length, 'reviewer')}, ${plural(incoming.questions.length, 'question')}, ${plural(incoming.flashcards.length, 'flashcard')}, ${plural(incoming.attempts.length, 'attempt')}.</p>
    <div class="stack" style="margin-top:16px">
      <button class="btn primary block" data-x="merge">Merge with my current data</button>
      <button class="btn danger block" data-x="replace">Replace everything${auth ? ' (and in the cloud)' : ' on this device'}</button>
      <button class="btn block" data-x="cancel">Cancel</button>
    </div>
    <p class="small muted" style="margin-top:10px">Merge keeps what you have and adds the file's items (same items are overwritten by the file's version).</p>`);
  m.addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]');
    if (!x) return;
    closeModal();
    if (x.dataset.x === 'cancel') return;
    if (x.dataset.x === 'replace') {
      STORES.forEach((s) => (data[s] = incoming[s]));
    } else {
      STORES.forEach((s) => {
        const map = new Map(data[s].map((o) => [o.id, o]));
        incoming[s].forEach((o) => map.set(o.id, o));
        data[s] = [...map.values()];
      });
    }
    persistAll();
    toast('Import complete');
    go('/');
    route();
  });
}

/* =====================================================================
   ATTACHED FILES — PDF, PowerPoint, Word, etc. Stored on this device (IndexedDB) next to each reviewer.
   .docx / .pptx / .txt / .md can also have their text pulled into the reviewer's notes.
   ===================================================================== */
const MAX_FILE_MB = 50;
const fileIcon = (name) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const kind = { pdf: 'pdf', ppt: 'ppt', pptx: 'ppt', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', csv: 'xls' }[ext]
    || (/^(png|jpe?g|gif|webp|heic)$/.test(ext) ? 'img' : '');
  return `<span class="file-ic ${kind}">${icon(kind === 'img' ? 'image' : 'file')}</span>`;
};
const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
let fileUrls = [];

function filesOf(rid) {
  return new Promise((resolve) => {
    if (!idb) return resolve([]);
    const r = idb.transaction('files').objectStore('files').getAll();
    r.onsuccess = () => resolve(r.result.filter((f) => f.reviewerId === rid).sort((a, b) => a.created - b.created));
    r.onerror = () => resolve([]);
  });
}
const getFile = (id) => new Promise((resolve) => {
  if (!idb) return resolve(null);
  const r = idb.transaction('files').objectStore('files').get(id);
  r.onsuccess = () => resolve(r.result || null);
  r.onerror = () => resolve(null);
});
function deleteFilesOf(rid) {
  filesOf(rid).then((fs) => { if (fs.length) idbTx((tx) => fs.forEach((f) => tx.objectStore('files').delete(f.id))).catch(writeFailed); });
}
function clearAllFiles() {
  if (idb) idbTx((tx) => tx.objectStore('files').clear()).catch(writeFailed);
}

/** Fill the file list on the overview page. Links use real blob URLs so Open/Download work on iPhone too. */
async function renderFiles(rid) {
  const box = $('#files-list');
  if (!box) return;
  const fs = await filesOf(rid);
  if (!$('#files-list')) return; // navigated away meanwhile
  fileUrls.forEach((u) => URL.revokeObjectURL(u));
  fileUrls = [];
  if (!fs.length) {
    box.innerHTML = `<div class="card muted center small">No files yet. Attach your slides, PDFs or documents.</div>`;
    return;
  }
  box.innerHTML = fs.map((f) => {
    const url = URL.createObjectURL(f.blob);
    fileUrls.push(url);
    const ext = f.name.split('.').pop().toLowerCase();
    const canOpen = ext === 'pdf' || /^(png|jpe?g|gif|webp|txt)$/.test(ext);
    const canExtract = /^(pdf|docx|pptx|txt|md)$/.test(ext);
    return `<div class="card">
      <div class="list-item">
        ${fileIcon(f.name)}
        <div class="grow"><div class="ellip" style="font-weight:650">${esc(f.name)}</div><div class="small muted">${fmtSize(f.size)}</div></div>
      </div>
      <div class="row wrap" style="margin-top:10px;gap:8px">
        ${canOpen ? `<a class="btn sm" href="${url}" target="_blank" rel="noopener">Open</a>` : ''}
        <a class="btn sm" href="${url}" download="${esc(f.name)}">Download</a>
        ${canExtract ? `<button class="btn sm" data-act="file-extract" data-id="${f.id}">Text to notes</button>` : ''}
        <button class="btn sm danger" data-act="file-delete" data-id="${f.id}">Delete</button>
      </div>
    </div>`;
  }).join('');
}

async function addFiles(fileList, rid) {
  if (!idb) return toast('File storage isn’t available in this browser mode.');
  let added = 0;
  for (const file of fileList) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast(`“${file.name}” is over ${MAX_FILE_MB} MB.`); continue; }
    const rec = { id: uid(), reviewerId: rid, name: file.name, type: file.type, size: file.size, blob: file, created: Date.now() + added };
    try {
      await idbTx((tx) => tx.objectStore('files').put(rec));
      added++;
    } catch (e) { writeFailed(e); break; }
  }
  if (added) toast(`Added ${plural(added, 'file')}`);
  renderFiles(rid);
}

/* Minimal zip reader (docx/pptx are zip files). Uses the browser's built-in DecompressionStream. */
async function openZip(blob) {
  const tailLen = Math.min(blob.size, 65557);
  const tail = new DataView(await blob.slice(blob.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This isn’t a .docx/.pptx file (old .doc/.ppt aren’t supported).');
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOff = tail.getUint32(eocd + 16, true);
  const cd = new DataView(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  const entries = {};
  for (let n = 0, p = 0; n < count && cd.getUint32(p, true) === 0x02014b50; n++) {
    const nlen = cd.getUint16(p + 28, true), elen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
    const name = dec.decode(new Uint8Array(cd.buffer, p + 46, nlen));
    entries[name] = { method: cd.getUint16(p + 10, true), csize: cd.getUint32(p + 20, true), off: cd.getUint32(p + 42, true) };
    p += 46 + nlen + elen + clen;
  }
  return {
    names: Object.keys(entries),
    async text(name) {
      const e = entries[name];
      const lh = new DataView(await blob.slice(e.off, e.off + 30).arrayBuffer());
      const start = e.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      const raw = blob.slice(start, start + e.csize);
      if (e.method === 0) return raw.text();
      if (e.method !== 8) throw new Error('Unsupported compression in this file.');
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t unpack the file. Please update it.');
      return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    },
  };
}
/** Text of one Word/PowerPoint paragraph node (ignores text belonging to paragraphs nested inside it, e.g. text boxes). */
function paraText(p) {
  let out = '';
  p.querySelectorAll('*').forEach((el) => {
    if (!['t', 'tab', 'br'].includes(el.localName)) return;
    let owner = el.parentNode;
    while (owner && owner.localName !== 'p') owner = owner.parentNode;
    if (owner !== p) return;
    out += el.localName === 't' ? el.textContent : el.localName === 'tab' ? '\t' : '\n';
  });
  return out.replace(/[ \t]+/g, ' ').trim();
}
const inFallback = (el) => { for (let n = el.parentNode; n; n = n.parentNode) if (n.localName === 'Fallback') return true; return false; };
/** Word: paragraphs in order; list items get a bullet so lists can be recognised. */
function docxLines(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = [];
  [...doc.getElementsByTagNameNS('*', 'p')].forEach((p) => {
    if (inFallback(p)) return; // text boxes are stored twice; keep one copy
    const t = paraText(p);
    if (!t) return;
    const listed = [...p.children].some((c) => c.localName === 'pPr' && [...c.children].some((x) => x.localName === 'numPr'));
    out.push(listed ? `• ${t}` : t);
  });
  return out;
}
/** PowerPoint: titles stay plain lines, multi-line body text becomes bullets, tables stay plain. */
function pptxLines(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const shapes = [...doc.getElementsByTagNameNS('*', 'sp'), ...doc.getElementsByTagNameNS('*', 'graphicFrame')]
    .sort((x, y) => (x.compareDocumentPosition(y) & 4 ? -1 : 1));
  const out = [];
  shapes.forEach((sh) => {
    const paras = [...sh.getElementsByTagNameNS('*', 'p')].map(paraText).filter((t) => t && !/^\d{1,3}$/.test(t));
    if (!paras.length) return;
    const ph = sh.localName === 'sp' ? sh.getElementsByTagNameNS('*', 'ph')[0] : null;
    const isTitle = ph && /title|ctrTitle|subTitle/i.test(ph.getAttribute('type') || '');
    const bullet = sh.localName === 'sp' && !isTitle && paras.length >= 2;
    paras.forEach((t) => out.push(bullet ? `• ${t}` : t));
  });
  return out;
}
/** Join lines, keeping bullets together and putting a blank line between other paragraphs. */
function joinLines(lines) {
  return lines.reduce((acc, l, i) => (i === 0 ? l : `${acc}${l.startsWith('• ') && lines[i - 1].startsWith('• ') ? '\n' : '\n\n'}${l}`), '');
}
/** Plain text files: handles UTF-8, UTF-16 and old Windows encodings. */
async function readPlainText(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] === 0xFF && buf[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xFE && buf[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

/* PDF reading uses the bundled PDF.js (vendor/pdfjs), loaded only the first time a PDF is scanned. */
const SCAN_RE = /\.(pdf|docx|pptx|txt|md)$/i;
let pdfjsLoading = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsLoading) {
    pdfjsLoading = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'vendor/pdfjs/pdf.min.js';
      el.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; resolve(window.pdfjsLib); };
      el.onerror = () => { pdfjsLoading = null; reject(new Error('Could not load the PDF reader. Check your connection and try again.')); };
      document.head.appendChild(el);
    });
  }
  return pdfjsLoading;
}
/** Turn one page's text pieces into clean lines. */
function pageLines(items) {
  const lines = [];
  let cur = '';
  let lastY = null;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const y = it.transform ? it.transform[5] : 0;
    if (lastY !== null && Math.abs(y - lastY) > (it.height || 10) * 0.6 && cur.trim()) { lines.push(cur); cur = ''; }
    cur += it.str;
    lastY = y;
    if (it.hasEOL) { lines.push(cur); cur = ''; lastY = null; }
  }
  if (cur.trim()) lines.push(cur);
  return lines.map((l) => l.replace(/\s+/g, ' ').trim().replace(/^[\uF000-\uF8FF•●▪◦‣▸►■□]\s*/, '• ')).filter(Boolean);
}
/** Drop page numbers and repeated headers/footers, and re-join sentences that wrapped onto the next line. */
function tidyPdfPages(pages) {
  const counts = new Map();
  pages.forEach((lines) => new Set(lines).forEach((l) => counts.set(l, (counts.get(l) || 0) + 1)));
  const repeated = (l) => pages.length >= 4 && l.length < 90 && counts.get(l) >= Math.max(3, pages.length * 0.6);
  const out = [];
  pages.forEach((lines) => {
    const merged = [];
    lines.filter((l) => !/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l) && !repeated(l)).forEach((l) => {
      const prev = merged[merged.length - 1];
      if (prev !== undefined && prev.length > 35 && /^[a-z(]/.test(l) && !/[.!?:;]$/.test(prev)) {
        merged[merged.length - 1] = /[a-z]-$/.test(prev) ? prev.slice(0, -1) + l : `${prev} ${l}`;
      } else merged.push(l);
    });
    if (merged.length) out.push(merged.join('\n'));
  });
  return out.join('\n\n');
}
async function extractPdfText(blob) {
  const lib = await loadPdfJs();
  let pdf;
  try {
    pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  } catch (e) {
    throw new Error(e && e.name === 'PasswordException' ? 'This PDF is password protected.' : 'This PDF could not be opened.');
  }
  const pages = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) pages.push(pageLines((await (await pdf.getPage(p)).getTextContent()).items));
  } finally { pdf.destroy(); }
  return tidyPdfPages(pages);
}
/* ---------- Turning files into lesson notes ---------- */
/** Offline cleanup: drop lines that are just the reviewer title, subject or file name, plus bare labels like "Lesson 1 of 5". */
function tidyLessonText(text, meta = {}) {
  const metas = [meta.title, meta.subject, String(meta.file || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')]
    .map((m) => normKey(m || '')).filter((m) => m.length >= 4);
  return String(text).split('\n').filter((line) => {
    const l = normKey(line);
    if (!l) return true;
    if (/^(reviewer|review|lesson \d+( of \d+)?|module \d+)$/.test(l)) return false;
    return !metas.some((m) => l === m || (l.includes(m) && l.length <= m.length * 1.5) || (m.includes(l) && l.length >= 6 && l.length >= m.length * 0.8));
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Cut long text into pieces (on paragraph/line boundaries) that fit one AI request. */
function splitChunks(text, max) {
  const blocks = [];
  String(text).split(/\n\s*\n/).forEach((para) => {
    if (para.length <= max) { blocks.push(para); return; }
    let cur = '';
    para.split('\n').forEach((line) => {
      if (cur && cur.length + line.length + 1 > max) { blocks.push(cur); cur = ''; }
      cur += (cur ? '\n' : '') + line.slice(0, max);
    });
    if (cur) blocks.push(cur);
  });
  const out = [];
  let cur = '';
  blocks.forEach((b) => {
    if (cur && cur.length + b.length + 2 > max) { out.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + b;
  });
  if (cur.trim()) out.push(cur);
  return out;
}
const AI_NOTES_CHUNK = 6000;
const AI_NOTES_MAX_PARTS = 25;
/** Have the AI keep only the lessons. Returns { text, aiParts, total }. Throws if the very first part fails (caller falls back). */
async function aiLessons(text, meta, onProgress) {
  const chunks = splitChunks(text, AI_NOTES_CHUNK);
  const used = chunks.slice(0, AI_NOTES_MAX_PARTS);
  const out = [];
  let aiParts = 0;
  let fallbacks = 0;
  for (let i = 0; i < used.length; i++) {
    if (onProgress) onProgress(i + 1, used.length, '');
    try {
      const res = await aiRetry(
        () => callAi({ mode: 'notes', text: used[i], title: meta.title, subject: meta.subject, part: i + 1, parts: used.length }),
        (s) => onProgress && onProgress(i + 1, used.length, `waiting ${s}s for the AI limit`),
      );
      aiParts++;
      if (res.notes) out.push(res.notes); // an empty reply means this part had no lessons (cover page, contents...)
    } catch (e) {
      if (!aiParts && i === 0) throw e;
      fallbacks++;
      out.push(tidyLessonText(used[i], meta)); // keep going: use the tidied original for this part
    }
  }
  chunks.slice(AI_NOTES_MAX_PARTS).forEach((c) => out.push(tidyLessonText(c, meta)));
  return { text: out.filter(Boolean).join('\n\n'), aiParts, total: used.length, fallbacks };
}
/** Read the text of several File objects into lesson notes. Options: { title, subject, ai }. Returns { text, aiUsed, names }. */
async function scanFilesToNotes(files, onProgress, { title = '', subject = '', ai = false } = {}) {
  const scannable = files.filter((f) => SCAN_RE.test(f.name));
  const skipped = files.filter((f) => !SCAN_RE.test(f.name)).map((f) => f.name);
  const parts = [];
  const names = [];
  const failed = [];
  let aiUsed = false;
  let aiProblem = '';
  for (let i = 0; i < scannable.length; i++) {
    const f = scannable[i];
    if (onProgress) onProgress(i + 1, scannable.length, '');
    let raw;
    try { raw = await extractText({ name: f.name, blob: f }); } catch (e) { failed.push(`${f.name} (${e.message.replace(/\.$/, '')})`); continue; }
    let text = tidyLessonText(raw, { title, subject, file: f.name });
    if (!text) { failed.push(f.name); continue; }
    if (ai && aiMethod()) {
      try {
        const r = await aiLessons(text, { title, subject }, (p, n, d) => onProgress && onProgress(i + 1, scannable.length, `AI part ${p} of ${n}${d ? `, ${d}` : ''}`));
        if (r.text) {
          text = r.text;
          aiUsed = true;
          if (r.fallbacks) aiProblem = `${plural(r.fallbacks, 'part')} of ${f.name} could not be cleaned by the AI and kept as the tidied original.`;
        } else aiProblem = `The AI found no lessons in ${f.name}. Kept the tidied original text instead.`;
      } catch (e) { aiProblem = `${e.message} Kept the tidied original text instead.`; }
    }
    parts.push(text);
    names.push(f.name);
  }
  if (aiProblem) toast(aiProblem);
  if (failed.length || skipped.length) {
    toast(`Couldn’t read text from ${failed.concat(skipped).join(', ')}. Scanned pictures can’t be read, and old .doc/.ppt files need to be saved as .docx/.pptx first.`);
  }
  return { text: parts.join('\n\n'), aiUsed, names };
}

async function extractText(rec) {
  const ext = rec.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'md') return (await readPlainText(rec.blob)).trim();
  if (ext === 'pdf') return extractPdfText(rec.blob);
  if (ext === 'doc' || ext === 'ppt') throw new Error('Old .doc/.ppt files can’t be read. Open it in Word/PowerPoint and save it as .docx/.pptx.');
  const zip = await openZip(rec.blob);
  if (ext === 'docx') {
    if (!zip.names.includes('word/document.xml')) throw new Error('No text found in this document.');
    return joinLines(docxLines(await zip.text('word/document.xml')));
  }
  if (ext === 'pptx') {
    const slides = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((x, y) => parseInt(x.match(/(\d+)\.xml$/)[1], 10) - parseInt(y.match(/(\d+)\.xml$/)[1], 10));
    const parts = [];
    for (let i = 0; i < slides.length; i++) {
      const lines = pptxLines(await zip.text(slides[i]));
      if (lines.length) parts.push(`Slide ${i + 1}\n${lines.join('\n')}`);
    }
    return parts.join('\n\n');
  }
  throw new Error('Text extraction works for .pdf, .docx, .pptx, .txt and .md files.');
}
async function extractToNotes(fileId) {
  const rec = await getFile(fileId);
  if (!rec) return;
  const r = getReviewer(rec.reviewerId);
  const meta = { title: r?.title || '', subject: r?.subject || '', file: rec.name };
  openModal(`<h2>Reading the file…</h2>
    <p class="muted small" id="xn-status">${aiMethod() ? 'The AI is picking out the lessons. This can take a minute for long files.' : 'Reading the file…'}</p>`);
  let text;
  let ai = false;
  try {
    text = tidyLessonText(await extractText(rec), meta);
    if (text && aiMethod()) {
      try {
        const res = await aiLessons(text, meta, (p, n, d) => { const el = $('#xn-status'); if (el) el.textContent = `AI is reading part ${p} of ${n}${d ? ` (${d})` : ''}…`; });
        if (res.text) { text = res.text; ai = true; }
      } catch (e) { toast(`${e.message} Used the tidied original text instead.`); }
    }
  } catch (e) { closeModal(); return toast(e.message || 'Could not read that file.'); }
  if (!text) { closeModal(); return toast('No text found in that file. (Scanned or image-only files can’t be read.)'); }
  const preview = text.length > 400 ? `${text.slice(0, 400)}…` : text;
  const m = openModal(`<h2>Add lessons to notes?</h2>
    <p class="muted small">${ai ? 'The AI kept only the lessons. ' : ''}Found ${text.length.toLocaleString()} characters in “${esc(rec.name)}”. They will be added to the end of this reviewer’s notes.</p>
    <div class="card notes small" style="margin-top:12px;max-height:40dvh;overflow:auto">${esc(preview)}</div>
    <div class="row" style="margin-top:18px">
      <button class="btn grow" data-x="no">Cancel</button>
      <button class="btn primary grow" data-x="yes">Add to notes</button>
    </div>`);
  m.addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]');
    if (!x) return;
    closeModal();
    if (x.dataset.x !== 'yes') return;
    const rv = getReviewer(rec.reviewerId);
    if (!rv) return;
    rv.notes = `${rv.notes ? `${rv.notes}\n\n` : ''}${text}`;
    rv.scanned = [...new Set([...(rv.scanned || []), rec.name])];
    rv.updated = now();
    save('reviewers', rv);
    toast('Added to notes');
    route();
  });
}

/* =====================================================================
   AI — writes questions and flashcards from your material.
   Two ways in, tried in this order:
     1) your own Groq API key, saved on this device only (the app calls Groq directly);
     2) your signed-in Cramview account, through the Supabase function "generate-quiz" (the key stays on the server).
   If neither is set up, or the AI fails, the offline generator below is used instead.
   ===================================================================== */
const AI_DEFAULT_MODEL = 'qwen/qwen3.8-27b';
let aiCfg = {}; // { key, model } — never synced or exported
try { aiCfg = JSON.parse(localStorage.getItem('cramview-ai') || '{}') || {}; } catch { aiCfg = {}; }
const saveAiCfg = () => {
  try { if (Object.keys(aiCfg).length) localStorage.setItem('cramview-ai', JSON.stringify(aiCfg)); else localStorage.removeItem('cramview-ai'); } catch { /* ignore */ }
};
/** 'key' (your own key), 'account' (Supabase function) or null (not set up). */
const aiMethod = () => (aiCfg.key ? 'key' : (syncConfigured && auth ? 'account' : null));

const AI_SYSTEM_Q = `You are an experienced teacher writing practice questions for a student. Use ONLY the study material you are given. Reply with a single JSON object.

Output format: {"questions":[ ... ]}. Every question has "type", "text" and a short "explanation" (one sentence saying why the answer is right). The types are:
- "mc": multiple choice. Fields: "choices" (exactly 4 different strings) and "answer" (the index 0-3 of the correct choice).
- "tf": true or false. "text" is a statement. "answer" is true or false.
- "id": identification. "answer" is a short specific term, name or number (1 to 4 words). You may list accepted alternatives separated by " | ".
- "enum": enumeration. "text" asks the student to list ALL N items (put the number N in the question). "answer" is an array of 3 to 8 short strings.

Rules:
- Write natural, self-contained questions that test understanding of the ideas, not trivia about wording or layout.
- Never mention "the text", "the passage", "the material", "the notes", "the document", "the slide" or "the reviewer". Never refer to page numbers.
- Multiple choice: one clearly correct choice and three plausible but clearly wrong choices taken from the same topic. Do not use "all of the above" or "none of the above".
- True or false: make about half of them false by changing one key fact; a false statement must be plainly wrong according to the material.
- Identification: the question must have one unambiguous answer and must not contain the answer.
- Spread the questions across different parts of the material and do not repeat a fact.
- Use the same language as the material. Ignore headers, footers, page numbers and file names.`;
const AI_SYSTEM_C = `You are an experienced teacher making flashcards for a student. Use ONLY the study material you are given. Reply with a single JSON object: {"cards":[{"front":"...","back":"..."}]}.
Each card covers one important idea. "front" is a short term, concept or question. "back" is a clear, concise answer or definition (under 30 words). Cover different parts of the material, never mention "the text" or "the material", do not repeat cards, and use the same language as the material. Ignore headers, footers, page numbers and file names.`;

const aiStr = (v, max = 600) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Keep only well-formed AI questions, in exactly the shape the app stores. */
function aiCleanQuestion(q, allowed) {
  if (!q || typeof q !== 'object') return null;
  const type = aiStr(q.type, 10).toLowerCase();
  if (!allowed.includes(type)) return null;
  const text = aiStr(q.text, 500);
  if (text.length < 8) return null;
  const explanation = aiStr(q.explanation, 240);
  const base = { type, text, ...(explanation ? { explanation } : {}) };
  if (type === 'mc') {
    const choices = Array.isArray(q.choices) ? q.choices.map((c) => aiStr(c, 200)) : [];
    if (choices.length !== 4 || choices.some((c) => !c) || new Set(choices.map(normKey)).size !== 4) return null;
    const idx = Number.isInteger(q.answer) ? q.answer : choices.findIndex((c) => normKey(c) === normKey(aiStr(q.answer)));
    if (!(idx >= 0 && idx < 4)) return null;
    const right = choices[idx];
    const mixed = shuffle(choices);
    return { ...base, choices: mixed, answer: mixed.indexOf(right) };
  }
  if (type === 'tf') {
    const yes = q.answer === true || String(q.answer).toLowerCase() === 'true';
    const no = q.answer === false || String(q.answer).toLowerCase() === 'false';
    return yes || no ? { ...base, answer: yes } : null;
  }
  if (type === 'id') {
    const answer = Array.isArray(q.answer) ? q.answer.map((x) => aiStr(x, 80)).filter(Boolean).join(' | ') : aiStr(q.answer, 120);
    if (!answer || answer.split(' ').length > 8) return null;
    if (normKey(text).includes(normKey(answer)) && answer.length > 3) return null;
    return { ...base, answer };
  }
  const items = (Array.isArray(q.answer) ? q.answer : []).map((x) => aiStr(x, 80)).filter(Boolean);
  const unique = items.filter((x, i) => items.findIndex((y) => normKey(y) === normKey(x)) === i);
  if (unique.length < 3 || unique.length > 10) return null;
  const withCount = /\d|\b(three|four|five|six|seven|eight|nine|ten|all)\b/i.test(text) ? text : `${text} (${unique.length} items)`;
  return { ...base, text: withCount, answer: unique };
}
function aiCleanCard(c) {
  const front = aiStr(c?.front, 300);
  const back = aiStr(c?.back, 500);
  return front.length >= 2 && back ? { front, back } : null;
}
/** Clean the model's JSON into { questions } or { cards }. */
function aiShape(parsed, { mode, count, types }) {
  const seen = new Set();
  const fresh = (k) => { const x = normKey(k); if (seen.has(x)) return false; seen.add(x); return true; };
  if (mode === 'cards') {
    return { cards: (Array.isArray(parsed?.cards) ? parsed.cards : []).map(aiCleanCard).filter((c) => c && fresh(c.front)).slice(0, count) };
  }
  return { questions: (Array.isArray(parsed?.questions) ? parsed.questions : []).map((q) => aiCleanQuestion(q, types)).filter((q) => q && fresh(q.text)).slice(0, count) };
}

async function withTimeout(start, ms = 45000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await start(ctl.signal); } finally { clearTimeout(timer); }
}
const aiNetworkError = (e) => new Error(e.name === 'AbortError' ? 'The AI took too long to answer.' : 'Could not reach the AI. Check your connection.');

const AI_SYSTEM_N = `You turn raw text extracted from a student's file (PDF, slides or document) into clean lesson notes for studying. Reply with the notes only, as plain text. No introduction, no commentary and no markdown symbols (no #, *, ** or backticks).

KEEP the lessons themselves: topics, explanations, definitions, key points, steps, lists, formulas, examples, dates and numbers, exactly as the source states them. Stay faithful and accurate: never add outside information, never guess, never change a fact. Fix broken line breaks and hyphenation and merge fragments into complete sentences.

REMOVE everything that is not lesson content: the reviewer, course or subject title and course code, the school or institution, author, instructor or student names, document dates, labels such as "Reviewer" or "Lesson 1 of 5", cover pages, tables of contents, learning-objective boilerplate, instructions to students, headers, footers, page numbers, watermarks, file names, reference-only links and repeated text. Do not repeat the provided title or subject anywhere in the notes.

FORMAT (plain text): each topic starts on its own short heading line (no bullet). Under it write the content as short lines: a definition as "Term: meaning", a list item as "• item", and an ordinary explanation as a complete sentence. Keep related items together under their heading and leave a blank line between topics. If the text has no lesson content at all, reply with exactly: NO_LESSON_CONTENT`;

/** Qwen can put its reasoning in <think> tags; drop it. */
const aiStripThink = (s) => String(s ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
function aiParseJson(content) {
  const s = aiStripThink(content);
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The AI sent back something unreadable. Try again.');
  try { return JSON.parse(s.slice(a, b + 1)); } catch { throw new Error('The AI sent back something unreadable. Try again.'); }
}
/** Plain-text notes: drop any markdown the model adds and normalise bullets. */
function aiCleanNotes(s) {
  const t = aiStripThink(s)
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return /^NO_LESSON_CONTENT\b/i.test(t) ? '' : t;
}
const aiNotesPrompt = ({ text, title, subject, part, parts }) =>
  `Reviewer title: "${aiStr(title, 120)}"\nSubject: "${aiStr(subject, 80)}"\n${parts > 1 ? `This is part ${part} of ${parts} of the file.\n` : ''}\nRAW TEXT FROM THE FILE:\n"""\n${text}\n"""`;
const aiError = (message, status, retryAfter) => Object.assign(new Error(message), { status, retryAfter });

/** Extra models to try, in order, if the chosen one isn't available on the account (Groq retires models now and then). */
const AI_BACKUP_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
let aiModelInUse = null; // the model that last worked (remembered until the page is reloaded or the Model box changes)
const aiPrimaryModel = () => aiCfg.model || AI_DEFAULT_MODEL;
function aiModelList() {
  const list = [aiPrimaryModel(), ...AI_BACKUP_MODELS.filter((m) => m !== aiPrimaryModel())];
  return aiModelInUse && list.includes(aiModelInUse) ? [aiModelInUse, ...list.filter((m) => m !== aiModelInUse)] : list;
}
/** Does this Groq error mean "that model isn't available to you"? */
const aiModelGone = (status, text) => status === 404 || ([400, 403].includes(status) && !/reasoning|response_format|json/i.test(text) && /model/i.test(text) && /(decommission|not found|does not exist|no longer supported|blocked|do not have access|permission)/i.test(text));
/** Let these models think a little ("low") before answering, which makes questions and cleaned notes more accurate without being slow. Other models get no setting. */
const aiReasoningFor = (model) => (/qwen|gpt-oss/i.test(model) ? 'low' : null);

/** One chat request to one model. Retries without settings the model rejects (reasoning effort, JSON mode). */
async function groqChatWith(model, messages, { json, temperature, maxTokens }) {
  const effort = aiReasoningFor(model);
  const flags = { reasoning: !!effort, json };
  const build = () => JSON.stringify({
    model,
    temperature,
    max_tokens: maxTokens + (effort ? 2000 : 0), // thinking uses some of this
    messages,
    ...(flags.json ? { response_format: { type: 'json_object' } } : {}),
    ...(flags.reasoning ? { reasoning_effort: effort } : {}),
    ...(flags.reasoning && /qwen/i.test(model) ? { reasoning_format: 'hidden' } : {}), // keep the thinking out of the reply
  });
  const post = () => withTimeout((signal) => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal, headers: { Authorization: `Bearer ${aiCfg.key}`, 'Content-Type': 'application/json' }, body: build(),
  }), 60000);
  let res;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await post();
      if (res.status !== 400) break;
      const text = await res.clone().text();
      if (aiModelGone(400, text)) break;
      if (flags.reasoning && /reasoning/i.test(text)) flags.reasoning = false;
      else if (flags.json && /response_format|json/i.test(text)) flags.json = false;
      else break;
    }
  } catch (e) { throw aiNetworkError(e); }
  if (res.status === 401) throw aiError('Groq rejected your API key. Check it in Sync & backup.', 401);
  if (res.status === 429) throw aiError('Groq is busy, or your limit was reached. Try again in a minute.', 429, Number(res.headers.get('retry-after')) || undefined);
  if (!res.ok) {
    let detail = '';
    try { detail = await res.clone().text(); } catch { /* no body */ }
    if (aiModelGone(res.status, detail)) throw Object.assign(aiError(`Groq doesn’t offer “${model}” to your account.`, 404), { modelGone: true });
    let msg = detail;
    try { msg = JSON.parse(detail)?.error?.message || detail; } catch { /* plain text */ }
    throw aiError(`Groq returned an error (${res.status}). ${String(msg).slice(0, 120)}`.trim(), res.status);
  }
  try { return (await res.json())?.choices?.[0]?.message?.content ?? ''; } catch { throw new Error('The AI sent back something unreadable. Try again.'); }
}
/** Chat with the chosen model; if it isn't available, fall back to the backup models. */
async function groqChat(messages, opts) {
  const primary = aiPrimaryModel();
  const tried = [];
  for (const model of aiModelList()) {
    try {
      const out = await groqChatWith(model, messages, opts);
      if (model !== primary && aiModelInUse !== model) toast(`“${primary}” isn’t available, so the AI is using ${model} instead.`);
      aiModelInUse = model;
      return out;
    } catch (e) {
      if (!e.modelGone) throw e;
      tried.push(model);
    }
  }
  throw aiError(`Groq doesn’t offer any of these models to your account: ${tried.join(', ')}. Type a current Groq model name in the Model box (Sync & backup).`, 404);
}
/** Way 1: talk to Groq directly with the key saved on this device. */
const aiAvoid = (avoid) => (Array.isArray(avoid) && avoid.length
  ? `\n\nALREADY WRITTEN. Do not repeat, rephrase or test the same fact as any of these:\n${avoid.slice(-60).map((a) => `- ${aiStr(a, 140)}`).join('\n')}` : '');
async function callGroq(payload) {
  const { mode, text, count, types, avoid } = payload;
  if (mode === 'notes') {
    const content = await groqChat([{ role: 'system', content: AI_SYSTEM_N }, { role: 'user', content: aiNotesPrompt(payload) }], { json: false, temperature: 0.2, maxTokens: 4096 });
    return { notes: aiCleanNotes(content) };
  }
  const user = mode === 'cards'
    ? `Make ${count} flashcards from this study material.\n\nSTUDY MATERIAL:\n"""\n${text}\n"""${aiAvoid(avoid)}`
    : `Write ${count} questions using only these types: ${types.join(', ')}. Mix the types fairly evenly.\n\nSTUDY MATERIAL:\n"""\n${text}\n"""${aiAvoid(avoid)}`;
  const content = await groqChat([{ role: 'system', content: mode === 'cards' ? AI_SYSTEM_C : AI_SYSTEM_Q }, { role: 'user', content: user }], { json: true, temperature: 0.7, maxTokens: 6000 });
  return aiShape(aiParseJson(content), payload);
}
/** Way 2: the Supabase function (the Groq key stays on the server). */
async function callAiFunction(payload) {
  await ensureToken();
  let res;
  try {
    res = await withTimeout((signal) => fetch(`${SB_URL}/functions/v1/generate-quiz`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${auth.access_token}` },
      body: JSON.stringify(payload),
    }), 90000);
  } catch (e) { throw aiNetworkError(e); }
  let j = null;
  try { j = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    throw aiError((j && j.error) || (res.status === 404 ? 'The AI function isn’t deployed yet (see the README).' : `The AI request failed (${res.status}).`), res.status, j && j.retryAfter);
  }
  return j || {};
}
async function callAi(payload) {
  const method = aiMethod();
  if (!method) throw new Error('AI isn’t set up. Add your Groq key or sign in (Sync & backup).');
  if (method === 'key') return callGroq(payload);
  const j = await callAiFunction(payload);
  return payload.mode === 'notes' ? { notes: aiCleanNotes(j.notes || '') } : aiShape(j, payload);
}
/** Free AI plans have per-minute limits. For long jobs (scanning files) wait and try again instead of giving up. */
const AI_RETRY = { tries: 3, maxWaitSec: 60 };
async function aiRetry(fn, onWait) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (e.status !== 429 || i >= AI_RETRY.tries - 1) throw e;
      const wait = Math.min(e.retryAfter || 20, AI_RETRY.maxWaitSec);
      if (onWait) onWait(wait);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}

/** For long material, send a random stretch of it so each quiz covers different parts. */
function textWindow(text, max) {
  if (text.length <= max) return text;
  let start = Math.floor(Math.random() * (text.length - max));
  const nl = text.lastIndexOf('\n', start);
  if (nl >= 0 && start - nl < 600) start = nl + 1;
  let end = start + max;
  const endNl = text.lastIndexOf('\n', end);
  if (endNl > start + max * 0.6) end = endNl;
  return text.slice(start, end);
}
const aiItem = (q) => ({ ...q, card: { front: q.text, back: correctText(q) + (q.explanation ? `\n\n${q.explanation}` : '') } });
const AI_WINDOW = 6000;
const AI_BATCH = 20; // most items asked for in one request
/** Ask the AI for `count` items in batches. Each later batch is told what is already written so it adds new ones. */
async function aiBatches(text, count, ask, { key, avoid, keep }) {
  const out = [];
  const seen = new Set();
  const maxCalls = Math.ceil(count / AI_BATCH) + 2;
  for (let call = 0; call < maxCalls && out.length < count; call++) {
    let batch;
    try {
      batch = await ask(Math.min(count - out.length, AI_BATCH), textWindow(text, AI_WINDOW), out.map(avoid).slice(-60));
    } catch (e) {
      if (!out.length) throw e;
      break; // keep what we already have
    }
    let added = 0;
    for (const item of batch) {
      const k = normKey(key(item));
      if (!seen.has(k)) { seen.add(k); out.push(keep(item)); added++; }
    }
    if (!added) break; // the material has run out of new things to ask
  }
  return out.slice(0, count);
}
const aiQuestions = (text, { types, count }) => aiBatches(
  text, count,
  async (n, window, avoid) => (await callAi({ mode: 'questions', text: window, count: n, types, avoid })).questions || [],
  { key: (q) => q.text, avoid: (q) => q.text, keep: aiItem },
);
const aiCards = (text, count) => aiBatches(
  text, count,
  async (n, window, avoid) => (await callAi({ mode: 'cards', text: window, count: n, avoid })).cards || [],
  { key: (c) => c.front, avoid: (c) => c.card.front, keep: (c) => ({ card: c }) },
);
/** Questions for a quiz: AI when chosen and available, otherwise (or if it fails) the offline generator. */
async function madeQuestions(text, { source, types, count }) {
  if (source === 'ai' || source === 'mixed') {
    if (!aiMethod()) {
      toast('AI isn’t set up (add your Groq key or sign in). Used the offline generator instead.');
    } else {
      try {
        const items = await aiQuestions(text, { types, count });
        if (items.length) return items;
        toast('The AI gave nothing usable. Used the offline generator instead.');
      } catch (e) { toast(`${e.message} Used the offline generator instead.`); }
    }
  }
  return generateQuestions(text, { types, count });
}

/* =====================================================================
   AUTO-GENERATE — questions and flashcards from notes / attached files.
   Rule-based and offline (no account, no AI). It finds "Term: meaning" lines and full sentences, then
   blanks out a key term (names, numbers, long words) and borrows wrong answers from elsewhere in the text.
   ===================================================================== */
const STOP = new Set(('a an the this that these those it its he she they them his her their we you i our your is are was were be been being am of in on at to for from by with as and or but nor so yet if then than which who whom whose what when where why how not no can could will would shall should may might must do does did has have had into onto over under about after before between during through also each both all any some such other more most many much very just only own same too').split(' '));
const GEN_BLANK = '_____';
const normKey = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pickN = (arr, n) => shuffle(arr).slice(0, n);

/** Split notes into facts: def {term, def}, sentence {text}, or list {title, items} (a heading followed by short bullets). */
function extractFacts(text) {
  const facts = [];
  const seen = new Set();
  const add = (f, key) => { if (!seen.has(normKey(key))) { seen.add(normKey(key)); facts.push(f); } };
  const BUL = /^([•*\-–]|\d+[.)])\s+/;
  const rows = String(text).split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !/^slide \d+$/i.test(l) && !/^—.*—$/.test(l))
    .map((l) => ({ bullet: BUL.test(l), line: l.replace(BUL, '').replace(/\s+/g, ' ') }));
  const pairOf = (line) => {
    const m = line.match(/^([^:–—=]{2,60}?)\s*(?::|\s[-–—]\s|=)\s*(.{8,})$/);
    return m && m[1].trim().split(' ').length <= 6 && !/[.!?]$/.test(m[1].trim()) ? { term: m[1].trim(), def: m[2].trim() } : null;
  };
  // lists: a heading followed by 3+ short bullets
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i];
    const hw = h.line.split(' ').length;
    if (h.bullet || hw > 9 || !(h.line.endsWith(':') || (hw <= 6 && !/[.!?]$/.test(h.line)))) continue;
    const items = [];
    for (let j = i + 1; j < rows.length && rows[j].bullet; j++) {
      const p = pairOf(rows[j].line);
      const item = p ? p.term : rows[j].line;
      if (item.split(' ').length > 6 || /[.!?]$/.test(item)) { items.length = 0; break; }
      items.push(item);
    }
    if (items.length >= 3 && items.length <= 10) add({ kind: 'list', title: h.line.replace(/:$/, ''), items }, `list:${h.line}`);
  }
  rows.forEach(({ line }) => {
    const p = pairOf(line);
    if (p && p.def.length <= 240) { add({ kind: 'def', term: p.term, def: p.def }, p.term); return; }
    if (line.split(' ').length < 5 && !/[.!?]$/.test(line)) return; // heading
    (line.match(/[^.!?]+[.!?]+(?:["”')\]]+)?|[^.!?]+$/g) || []).forEach((sen) => {
      sen = sen.trim();
      if (sen.split(' ').length >= 5 && sen.length <= 240) add({ kind: 'sentence', text: sen }, sen);
    });
  });
  return facts;
}

/** Possible words/numbers to blank out of a sentence. */
function candidatesOf(sentence) {
  const toks = [...sentence.matchAll(/\S+/g)].map((m) => {
    const raw = m[0];
    const core = raw.replace(/^[("“'\[]+/, '').replace(/[)"”'\].,;:!?]+$/, '');
    return { core, start: m.index + raw.indexOf(core) };
  }).filter((t) => t.core);
  const out = [];
  const capRe = /^[A-Z][A-Za-z'’-]*$/;
  toks.forEach((t) => {
    if (/^\d[\d,.]*%?$/.test(t.core)) out.push({ text: t.core, start: t.start, end: t.start + t.core.length, shape: 'num', score: 3, words: 1 });
  });
  for (let k = 0; k < toks.length;) {
    if (capRe.test(toks[k].core) && !STOP.has(toks[k].core.toLowerCase())) {
      let e = k;
      while (e + 1 < toks.length && capRe.test(toks[e + 1].core) && !STOP.has(toks[e + 1].core.toLowerCase())) e++;
      const end = toks[e].start + toks[e].core.length;
      out.push({ text: sentence.slice(toks[k].start, end), start: toks[k].start, end, shape: 'cap', score: k === 0 ? 2.2 : 3, words: e - k + 1 });
      k = e + 1;
    } else k++;
  }
  toks.forEach((t) => {
    if (/^[a-z][a-z-]{5,}$/.test(t.core) && !STOP.has(t.core)) {
      out.push({ text: t.core, start: t.start, end: t.start + t.core.length, shape: 'word', score: 1 + Math.min(t.core.length, 14) / 20, words: 1 });
    }
  });
  return out.filter((c) => toks.length - c.words >= 4);
}

function buildPool(facts) {
  const pool = { num: [], cap: [], word: [] };
  facts.filter((f) => f.kind === 'sentence').forEach((f) => candidatesOf(f.text).forEach((c) => {
    if (!pool[c.shape].some((x) => normKey(x.text) === normKey(c.text))) pool[c.shape].push(c);
  }));
  return pool;
}
function numberVariants(text) {
  const base = parseFloat(text.replace(/,/g, ''));
  if (Number.isNaN(base)) return [];
  const pct = text.endsWith('%') ? '%' : '';
  const commas = text.includes(',');
  const dec = (text.replace('%', '').split('.')[1] || '').length;
  const year = Number.isInteger(base) && base >= 1000 && base <= 2100 && !commas;
  const deltas = year ? [-50, -25, -10, -5, 5, 10, 25, 50]
    : base >= 20 ? [base * -.5, base * -.25, base * -.1, base * .1, base * .25, base, base * 2]
      : [-3, -2, -1, 1, 2, 3, 5];
  return [...new Set(deltas.map((d) => base + d).filter((v) => v >= 0 && v !== base)
    .map((v) => { const r = dec ? v.toFixed(dec) : String(Math.round(v)); return (commas ? Number(r).toLocaleString('en-US') : r) + pct; }))];
}
/** Wrong answers of the same kind as the real one. */
function distractorsFor(c, sentence, pool, n) {
  const low = sentence.toLowerCase();
  let list = pool[c.shape].filter((x) => normKey(x.text) !== normKey(c.text) && x.words === c.words && !low.includes(x.text.toLowerCase())).map((x) => x.text);
  list = pickN(list, n);
  if (c.shape === 'num' && list.length < n) list = list.concat(pickN(numberVariants(c.text).filter((v) => !list.includes(v)), n - list.length));
  return list;
}
const bestCandidate = (cands) => cands.map((c) => ({ c, s: c.score + Math.random() * .6 })).sort((a, b) => b.s - a.s)[0].c;

function mcFrom(text, answer, wrong, card) {
  const choices = shuffle([answer, ...wrong]);
  return { type: 'mc', text, choices, answer: choices.indexOf(answer), card };
}
const ENUM_ITEM = "[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’-]*){0,2}";
const ENUM_RE = new RegExp(`(?:\\b(?:are|include|includes|including|such as|consist of|consists of|contain|contains|need|needs|require|requires|use|uses|has|have)\\b|[:—])\\s+(${ENUM_ITEM}(?:,\\s+${ENUM_ITEM})+,?\\s+(?:and|or)\\s+${ENUM_ITEM})\\s*[.!?]?$`);
function makeEnum(f) {
  if (f.kind === 'list') {
    const card = { front: `Enumerate: ${f.title}`, back: f.items.join(', ') };
    return { type: 'enum', text: `Enumerate all ${f.items.length} items listed under “${f.title}” (any order).`, answer: f.items, card };
  }
  if (f.kind !== 'sentence') return null;
  const m = f.text.match(ENUM_RE);
  if (!m) return null;
  const items = m[1].split(/,\s*(?:and|or)\s+|\s+(?:and|or)\s+|,\s+/).map((x) => x.trim()).filter(Boolean);
  if (items.length < 3 || items.length > 8) return null;
  const blank = f.text.replace(m[1], GEN_BLANK);
  return { type: 'enum', text: `Name all ${items.length} items that complete this sentence (any order):\n\n${blank}`, answer: items, card: { front: blank, back: items.join(', ') } };
}
function makeItem(f, type, pairs, pool) {
  if (type === 'enum') return makeEnum(f);
  if (f.kind === 'list') return null;
  if (f.kind === 'def') {
    const card = { front: f.term, back: f.def };
    const others = pairs.filter((p) => p !== f && normKey(p.term) !== normKey(f.term));
    if (type === 'id') return { type: 'id', text: `Which term is described below?\n\n${f.def}`, answer: f.term, card };
    if (type === 'mc') {
      const wrong = pickN(others.map((p) => p.term), 3);
      return wrong.length < 3 ? null : mcFrom(`Which term matches this description?\n\n${f.def}`, f.term, wrong, card);
    }
    if (Math.random() < .5 || !others.length) return { type: 'tf', text: `${f.term}: ${f.def}`, answer: true, card };
    return { type: 'tf', text: `${f.term}: ${others[Math.floor(Math.random() * others.length)].def}`, answer: false, card };
  }
  const cands = candidatesOf(f.text);
  if (!cands.length) return null;
  const c = bestCandidate(cands);
  const blank = f.text.slice(0, c.start) + GEN_BLANK + f.text.slice(c.end);
  const card = { front: blank, back: c.text };
  if (type === 'id') return { type: 'id', text: blank, answer: c.text, card };
  if (type === 'mc') {
    const wrong = distractorsFor(c, f.text, pool, 3);
    return wrong.length < 3 ? null : mcFrom(blank, c.text, wrong, card);
  }
  if (Math.random() < .5) return { type: 'tf', text: f.text, answer: true, card };
  const d = distractorsFor(c, f.text, pool, 1)[0];
  if (!d) return { type: 'tf', text: f.text, answer: true, card };
  return { type: 'tf', text: f.text.slice(0, c.start) + d + f.text.slice(c.end), answer: false, card };
}
function makeCard(f) {
  if (f.kind === 'list') return { front: `Enumerate: ${f.title}`, back: f.items.join(', ') };
  if (f.kind === 'def') return { front: f.term, back: f.def };
  const cands = candidatesOf(f.text);
  if (!cands.length) return null;
  const c = bestCandidate(cands);
  return { front: f.text.slice(0, c.start) + GEN_BLANK + f.text.slice(c.end), back: c.text };
}

/** opts: { types: ['mc','tf','id'], count }  ->  array of question items (each with .card) */
function generateQuestions(text, { types, count }) {
  const facts = extractFacts(text);
  const pairs = facts.filter((f) => f.kind === 'def');
  const pool = buildPool(facts);
  const items = [];
  const seen = new Set();
  let turn = 0;
  for (let pass = 0; pass < 2 && items.length < count; pass++) {
    for (const f of shuffle(facts)) {
      if (items.length >= count) break;
      for (let k = 0; k < types.length; k++) {
        const it = makeItem(f, types[(turn + k) % types.length], pairs, pool);
        if (it && !seen.has(normKey(it.text))) { seen.add(normKey(it.text)); items.push(it); break; }
      }
      turn++;
    }
  }
  return items;
}
function generateCardItems(text, count) {
  const out = [];
  const seen = new Set();
  for (const f of shuffle(extractFacts(text))) {
    if (out.length >= count) break;
    const card = makeCard(f);
    if (card && !seen.has(normKey(card.front))) { seen.add(normKey(card.front)); out.push({ card }); }
  }
  return out;
}

/* ---------- UI ---------- */
let gen = null; // { rid, mode: 'questions' | 'cards', files, items, keepCards }
async function openGenerator(rid, mode) {
  const r0 = getReviewer(rid);
  const files = (await filesOf(rid)).filter((f) => SCAN_RE.test(f.name) && !covered(r0, f.name));
  gen = { rid, mode, files, items: [], keepCards: true };
  renderGenSetup();
}
function renderGenSetup() {
  const r = getReviewer(gen.rid);
  const hasNotes = !!(r.notes || '').trim();
  const q = gen.mode === 'questions';
  const none = !hasNotes && !gen.files.length;
  openModal(`<h2>${q ? 'Auto-generate questions' : 'Generate flashcards'}</h2>
    <p class="muted small">Builds practice from your notes and files. Turn on AI for natural questions, or use the offline rules (they work best with full sentences or “Term: meaning” lines). You can review everything before adding it.</p>
    <div class="card" style="padding:4px 16px;margin-top:12px">${toggleRow('g-ai', `${icon('sparkles')}Use AI`, aiMethod() ? 'Better questions. Needs internet; falls back to offline if it fails.' : 'Add your Groq key in Sync &amp; backup (or sign in) to turn this on.', !!aiMethod()).replace('<input type="checkbox"', aiMethod() ? '<input type="checkbox"' : '<input type="checkbox" disabled')}</div>
    <div class="section-title" style="margin-top:16px">Use text from</div>
    <div class="card" style="padding:4px 16px">
      ${toggleRow('g-notes', 'Reviewer notes', hasNotes ? `${(r.notes || '').length.toLocaleString()} characters` : 'No notes yet', hasNotes).replace('<input type="checkbox"', hasNotes ? '<input type="checkbox"' : '<input type="checkbox" disabled')}
      ${gen.files.map((f, i) => toggleRow(`g-file-${i}`, esc(f.name), fmtSize(f.size), true)).join('')}
    </div>
    ${q ? `<div class="section-title">Question types</div>
    <div class="card" style="padding:4px 16px">
      ${toggleRow('g-t-mc', 'Multiple choice', 'Fill in the blank with 4 choices', true)}
      ${toggleRow('g-t-tf', 'True or false', 'Real statements and altered ones', true)}
      ${toggleRow('g-t-id', 'Identification', 'Type the missing word or term', true)}
      ${toggleRow('g-t-enum', 'Enumeration', 'Name every item in a list (needs lists in your notes)', true)}
    </div>` : ''}
    <label class="field" style="margin-top:16px"><span class="label">How many ${q ? 'questions' : 'cards'}? (1–60)</span>
      <input type="number" id="g-n" inputmode="numeric" min="1" max="60" value="${q ? 10 : 20}"></label>
    ${q ? `<div class="card" style="padding:4px 16px;margin-top:14px">${toggleRow('g-cards', 'Also create flashcards', 'One card for each question you keep', true)}</div>` : ''}
    <div class="row" style="margin-top:18px">
      <button class="btn grow" data-act="close-modal">Cancel</button>
      <button class="btn primary grow" data-act="gen-run" ${none ? 'disabled' : ''}>${icon('sparkles')}Generate</button>
    </div>
    ${none ? '<p class="small muted center" style="margin-top:10px">Add notes or attach a PDF, .docx, .pptx, .txt or .md file first.</p>' : ''}`);
}
async function genRun() {
  const r = getReviewer(gen.rid);
  const m = modalEl();
  const n = clamp(parseInt($('#g-n', m).value, 10) || 10, 1, 60);
  const parts = [];
  if ($('#g-notes', m)?.checked && (r.notes || '').trim()) parts.push(r.notes);
  for (let i = 0; i < gen.files.length; i++) {
    if (!$(`#g-file-${i}`, m)?.checked) continue;
    try { parts.push(tidyLessonText(await extractText(gen.files[i]), { title: r.title, subject: r.subject, file: gen.files[i].name })); } catch (e) { toast(`Skipped “${gen.files[i].name}”: ${e.message}`); }
  }
  gen.text = parts.join('\n');
  if (gen.mode === 'questions') {
    gen.types = ALL_TYPES.filter((t) => $(`#g-t-${t}`, m)?.checked);
    if (!gen.types.length) return toast('Please pick at least one question type.');
    gen.keepCards = !!$('#g-cards', m)?.checked;
  }
  gen.count = n;
  gen.useAi = !!$('#g-ai', m)?.checked && !!aiMethod();
  await genRegenerate();
}
async function genRegenerate(btn) {
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `${icon('sparkles')}Working…`; }
  let items = null;
  if (gen.useAi) {
    try {
      items = gen.mode === 'questions' ? await aiQuestions(gen.text, { types: gen.types, count: gen.count }) : await aiCards(gen.text, gen.count);
      if (!items.length) { items = null; toast('The AI gave nothing usable. Used the offline generator instead.'); }
    } catch (e) { toast(`${e.message} Used the offline generator instead.`); }
  }
  gen.ai = !!items;
  if (items && items.length < gen.count) toast(`The AI wrote ${items.length} of ${gen.count}. Tap Redo for more, or add more notes.`);
  gen.items = items || (gen.mode === 'questions' ? generateQuestions(gen.text, { types: gen.types, count: gen.count }) : generateCardItems(gen.text, gen.count));
  if (btn) { btn.disabled = false; btn.innerHTML = label; }
  renderGenPreview();
}
function genItemHtml(it, i) {
  const q = gen.mode === 'questions';
  const body = !q ? `<div style="font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere">${esc(it.card.front)}</div>
      <div class="small muted" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(it.card.back)}</div>`
    : `<div style="font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere">${esc(it.text)}</div>
      ${it.type === 'mc' ? `<div class="small" style="margin-top:4px">${it.choices.map((c, k) => `<div class="${k === it.answer ? '' : 'muted'}" style="${k === it.answer ? 'font-weight:700' : ''}">${'ABCD'[k]}. ${esc(c)}</div>`).join('')}</div>`
        : `<div class="small muted" style="margin-top:4px">Answer: <b>${esc(it.type === 'tf' ? (it.answer ? 'True' : 'False') : Array.isArray(it.answer) ? it.answer.join(', ') : it.answer)}</b></div>`}
      ${it.explanation ? `<div class="small muted" style="margin-top:4px">${esc(it.explanation)}</div>` : ''}`;
  return `<label class="card" style="display:flex;gap:12px;align-items:flex-start;padding:14px;cursor:pointer">
    <input type="checkbox" class="gen-pick" data-i="${i}" checked style="width:22px;height:22px;margin-top:2px;accent-color:var(--primary);flex:none">
    <div class="grow">${q ? `<span class="badge primary" style="margin-bottom:6px">${TYPE_LABEL[it.type]}</span>` : ''}${body}</div></label>`;
}
function renderGenPreview() {
  const q = gen.mode === 'questions';
  if (!gen.items.length) {
    openModal(`<h2>Nothing to generate yet</h2>
      <p class="muted">Couldn’t find enough facts in that text. Try writing notes as full sentences (at least 5 words) or as “Term: meaning” lines, or turn on more sources.</p>
      <div class="row" style="margin-top:18px"><button class="btn grow" data-act="gen-back">Back</button><button class="btn grow" data-act="close-modal">Close</button></div>`);
    return;
  }
  openModal(`<h2>${q ? 'Review questions' : 'Review flashcards'}</h2>
    <p class="muted small">${gen.ai ? 'Written by AI. ' : ''}Untick anything you don’t want. Answers are chosen automatically, so give them a quick look.</p>
    <div class="stack" style="margin-top:12px;max-height:52dvh;overflow-y:auto;padding:2px">${gen.items.map(genItemHtml).join('')}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn grow" data-act="gen-back">Back</button>
      <button class="btn grow" data-act="gen-again">${icon('shuffle')}Redo</button>
    </div>
    <button class="btn primary block" style="margin-top:10px" data-act="gen-add" id="gen-add">${icon('plus')}Add ${gen.items.length}</button>`);
}
function updateGenCount() {
  const n = $$('.gen-pick:checked').length;
  const b = $('#gen-add');
  if (!b) return;
  b.innerHTML = `${icon('plus')}Add ${n}`;
  b.disabled = n === 0;
}
function genAdd() {
  const picked = $$('.gen-pick:checked').map((el) => gen.items[+el.dataset.i]);
  if (!picked.length) return;
  const rid = gen.rid;
  const haveQ = new Set(qsOf(rid).map((x) => normKey(x.text)));
  const haveC = new Set(cardsOf(rid).map((x) => normKey(x.front)));
  let nq = 0, nc = 0;
  const t = Date.now();
  picked.forEach((it, i) => {
    if (gen.mode === 'questions' && !haveQ.has(normKey(it.text))) {
      const q = { id: uid(), reviewerId: rid, type: it.type, text: it.text, answer: it.answer, created: t + i };
      if (it.type === 'mc') q.choices = it.choices;
      if (it.explanation) q.explanation = it.explanation;
      save('questions', q);
      haveQ.add(normKey(it.text));
      nq++;
    }
    if ((gen.mode === 'cards' || gen.keepCards) && !haveC.has(normKey(it.card.front))) {
      save('flashcards', { id: uid(), reviewerId: rid, front: it.card.front, back: it.card.back, status: 'new', created: t + i });
      haveC.add(normKey(it.card.front));
      nc++;
    }
  });
  touchReviewer(rid);
  closeModal();
  const bits = [];
  if (nq) bits.push(plural(nq, 'question'));
  if (nc) bits.push(plural(nc, 'flashcard'));
  toast(bits.length ? `Added ${bits.join(' and ')}` : 'Everything was already in this reviewer.');
  route();
}

/* =====================================================================
   SAMPLE DATA
   ===================================================================== */
function loadSample() {
  const rid = uid();
  const t = Date.now();
  save('reviewers', {
    id: rid, title: 'Sample: Solar System', subject: 'Science', created: now(), updated: now(),
    notes: 'The Solar System has eight planets orbiting the Sun.\n\n• Mercury is the closest planet to the Sun.\n• Venus is the hottest planet.\n• Earth is the only planet known to support life.\n• Mars is called the Red Planet.\n• Jupiter is the largest planet.\n• Saturn is famous for its rings.\n• Uranus rotates on its side.\n• Neptune is the farthest planet from the Sun.',
  });
  const Q = [
    { type: 'mc', text: 'Which planet is the largest?', choices: ['Earth', 'Jupiter', 'Saturn', 'Mars'], answer: 1 },
    { type: 'mc', text: 'Which planet is known as the Red Planet?', choices: ['Venus', 'Mercury', 'Mars', 'Neptune'], answer: 2 },
    { type: 'mc', text: 'Which planet is closest to the Sun?', choices: ['Mercury', 'Venus', 'Earth', 'Mars'], answer: 0 },
    { type: 'tf', text: 'Venus is the hottest planet in the Solar System.', answer: true },
    { type: 'tf', text: 'Saturn is the farthest planet from the Sun.', answer: false },
    { type: 'id', text: 'What is the only planet known to support life?', answer: 'Earth' },
    { type: 'id', text: 'Which planet rotates on its side?', answer: 'Uranus' },
  ];
  Q.forEach((q, i) => save('questions', { id: uid(), reviewerId: rid, created: t + i, ...q }));
  generateCards(rid);
  toast('Sample reviewer added');
  route();
}

/* =====================================================================
   EVENTS — one delegated click handler
   ===================================================================== */
const ACTIONS = {
  nav: (el) => go(el.dataset.to),
  'close-modal': () => closeModal(),

  /* reviewers */
  'new-reviewer': () => reviewerForm(null),
  'edit-reviewer': (el) => reviewerForm(getReviewer(el.dataset.id)),
  'rf-pick': () => $('#rf-input').click(),
  'rf-remove': (el) => { rfFiles.splice(Number(el.dataset.i), 1); renderRfFiles(); },
  'save-reviewer': async (el) => {
    const title = $('#f-title').value.trim();
    if (!title) return toast('Please enter a title.');
    const old = el.dataset.id ? getReviewer(el.dataset.id) : null;
    const typed = $('#f-notes').value.trim();
    const scan = !!$('#rf-scan')?.checked;
    const useAi = scan && !!$('#rf-ai')?.checked;
    const files = rfFiles.slice();
    const r = {
      id: old?.id || uid(), title, subject: $('#f-subject').value.trim(), notes: typed,
      created: old?.created || now(), updated: now(), ...(old?.scanned ? { scanned: old.scanned } : {}),
    };
    const label = el.innerHTML;
    el.disabled = true;
    let scanned = '';
    try {
      save('reviewers', r);
      if (files.length) {
        el.innerHTML = `${icon('file')}Saving files…`;
        await addFiles(files, r.id);
        if (scan) {
          const found = await scanFilesToNotes(
            files,
            (i, n, d) => { el.innerHTML = `${icon('sparkles')}Scanning ${i} of ${n}${d ? ` · ${d}` : ''}…`; },
            { title, subject: r.subject, ai: useAi },
          );
          if (found.text) {
            r.notes = `${typed ? `${typed}\n\n` : ''}${found.text}`;
            r.scanned = [...new Set([...(old?.scanned || []), ...found.names])];
            r.updated = now();
            save('reviewers', r);
            scanned = found.aiUsed ? 'ai' : 'plain';
          }
        }
      }
    } catch (e) {
      toast(e.message || 'Could not save.');
      el.disabled = false;
      el.innerHTML = label;
      return;
    }
    closeModal();
    toast(scanned === 'ai' ? 'Saved. AI wrote the lessons from your files' : scanned ? 'Saved. Lessons added from your files' : 'Saved');
    if (old) route(); else go(`/r/${r.id}`);
  },
  'delete-reviewer': async (el) => {
    const r = getReviewer(el.dataset.id);
    if (!await confirmBox({ title: `Delete “${r.title}”?`, message: 'This also deletes its questions, flashcards and history. This cannot be undone.' })) return;
    deleteReviewer(r.id);
    toast('Reviewer deleted');
    go('/');
    route();
  },
  'load-sample': () => loadSample(),
  'clear-history': async (el) => {
    if (!await confirmBox({ title: 'Clear history?', message: 'All saved quiz and exam results for this reviewer will be removed.', okText: 'Clear' })) return;
    data.attempts = data.attempts.filter((a) => a.reviewerId !== el.dataset.id);
    persistAll();
    go(`/r/${el.dataset.id}`);
  },

  /* questions */
  'new-question': (el) => questionForm(el.dataset.rid, null),
  'edit-question': (el) => { const q = data.questions.find((x) => x.id === el.dataset.id); questionForm(q.reviewerId, q); },
  'delete-question': async (el) => {
    if (!await confirmBox({ title: 'Delete this question?', message: 'Flashcards made from it will stay.' })) return;
    del('questions', el.dataset.id);
    route();
  },
  'q-type': (el) => {
    qForm.type = el.dataset.t;
    $$('#q-seg button').forEach((b) => b.classList.toggle('on', b === el));
    $('#q-type-label').textContent = TYPE_LABEL[qForm.type];
    ALL_TYPES.forEach((t) => $(`#sec-${t}`).classList.toggle('hidden', t !== qForm.type));
  },
  'tf-pick': (el) => $$('#tf-seg button').forEach((b) => b.classList.toggle('on', b === el)),
  'save-question': (el) => saveQuestion(el.dataset.more === '1'),

  /* setup + play */
  'start-setup': (el) => go(`/r/${location.hash.split('/')[2]}/${el.dataset.mode}`),
  'open-cards': () => {
    const rid = location.hash.split('/')[2];
    go(`/r/${rid}/${cardsOf(rid).length ? 'study' : 'cards'}`);
  },
  'src-pick': (el) => {
    $$('#o-src button').forEach((b) => b.classList.toggle('on', b === el));
    $('#o-src-hint').textContent = SRC_HINT[el.dataset.v];
    $('#o-src').dataset.picked = '1';
  },
  'type-pick': (el) => {
    if (el.classList.contains('on') && $$('#o-types .chip.on').length === 1) return toast('Keep at least one question type.');
    el.classList.toggle('on');
  },
  begin: async (el) => {
    const rid = el.dataset.id;
    const source = $('#o-src .on').dataset.v;
    const picked = !!$('#o-src').dataset.picked;
    const types = $$('#o-types .chip.on').map((b) => b.dataset.t);
    const count = clamp(parseInt($('#o-count').value, 10) || 1, 1, el.dataset.mode === 'quiz' ? 100 : 60);
    let setup;
    if (el.dataset.mode === 'quiz') {
      settings.quiz = { shuffleQ: $('#o-shufq').checked, shuffleC: $('#o-shufc').checked, lives: $('#o-lives').checked, source: picked ? source : 'auto', types, count };
      setup = { mode: 'quiz', reviewerId: rid, ...settings.quiz, source };
    } else {
      const minutes = clamp(parseInt($('#o-min').value, 10) || 1, 1, 300);
      settings.exam = { count, minutes, shuffle: $('#o-shuf').checked, lives: $('#o-lives').checked, source: picked ? source : 'auto', types };
      setup = { mode: 'exam', reviewerId: rid, count, minutes, source, types, shuffleQ: settings.exam.shuffle, shuffleC: settings.exam.shuffle, lives: settings.exam.lives };
    }
    saveSettings();
    const label = el.innerHTML;
    el.disabled = true;
    el.innerHTML = `${icon('sparkles')}Preparing your ${el.dataset.mode}…`;
    try {
      await startFromSetup(setup);
      go(`/r/${rid}/play`);
    } catch (e) {
      toast(e.message || 'Could not start.');
    } finally {
      el.disabled = false;
      el.innerHTML = label;
    }
  },
  pick: (el) => submitAnswer(Number(el.dataset.i)),
  'submit-id': () => {
    const v = $('#id-input').value;
    if (!v.trim()) { $('#id-input').classList.add('shake'); setTimeout(() => $('#id-input')?.classList.remove('shake'), 400); return; }
    submitAnswer(v);
  },
  next: () => advance(),
  quit: async () => {
    const s = session;
    if (!await confirmBox({ title: 'Quit now?', message: 'Your progress in this attempt will not be saved.', okText: 'Quit' })) return;
    if (session !== s) return;
    const rid = s.reviewerId;
    session = null;
    stopTimer();
    go(`/r/${rid}`);
  },
  retry: async () => {
    try { await startFromSetup(lastSetup); renderPlay(); } catch (e) { toast(e.message || 'Could not start.'); }
  },

  /* flashcards */
  'generate-cards': (el) => generateCards(el.dataset.id),
  'gen-open': (el) => openGenerator(el.dataset.rid, el.dataset.mode),
  'gen-run': (el) => {
    const label = el.innerHTML;
    el.disabled = true;
    el.innerHTML = `${icon('sparkles')}Working…`;
    genRun().finally(() => { el.disabled = false; el.innerHTML = label; });
  },
  'gen-again': (el) => genRegenerate(el),
  'gen-back': () => renderGenSetup(),
  'gen-add': () => genAdd(),
  'new-card': (el) => cardForm(el.dataset.rid, null),
  'edit-card': (el) => cardForm(null, data.flashcards.find((c) => c.id === el.dataset.id)),
  'save-card': (el) => {
    const front = $('#c-front').value.trim();
    const back = $('#c-back').value.trim();
    if (!front || !back) return toast('Please fill in both sides.');
    const old = el.dataset.id ? data.flashcards.find((c) => c.id === el.dataset.id) : null;
    save('flashcards', { id: old?.id || uid(), reviewerId: old?.reviewerId || el.dataset.rid, front, back, status: old?.status || 'new', questionId: old?.questionId, created: old?.created || Date.now() });
    toast('Card saved');
    if (el.dataset.more === '1') { cardForm(el.dataset.rid, null); route(); return; }
    closeModal();
    route();
  },
  'delete-card': async (el) => {
    if (!await confirmBox({ title: 'Delete this flashcard?', message: 'This cannot be undone.' })) return;
    del('flashcards', el.dataset.id);
    route();
  },
  'reset-progress': (el) => {
    cardsOf(el.dataset.id).forEach((c) => save('flashcards', { ...c, status: 'new' }));
    toast('Progress reset');
    route();
  },
  flip: () => { if (Date.now() - study.swipedAt > 400) flipCard(); },
  'card-next': () => gotoCard(study.i + 1, 1),
  'card-prev': () => gotoCard(study.i - 1, -1),
  mark: (el) => {
    const c = data.flashcards.find((x) => x.id === study.deck[study.i]);
    if (!c) return;
    save('flashcards', { ...c, status: el.dataset.s });
    gotoCard(study.i + 1, 1);
  },
  'study-opt': (el) => {
    const o = el.dataset.o;
    study[o] = !study[o];
    settings.study[o] = study[o];
    saveSettings();
    study.deck = buildDeck(study.rid);
    study.i = 0;
    renderStudy();
  },
  'study-restart': () => { study.deck = buildDeck(study.rid); study.i = 0; renderStudy(); },

  /* files */
  'add-files': () => $('#file-input').click(),
  'file-extract': (el) => extractToNotes(el.dataset.id),
  'file-delete': async (el) => {
    const f = await getFile(el.dataset.id);
    if (!f || !await confirmBox({ title: `Delete “${f.name}”?`, message: 'The file will be removed from this device.' })) return;
    idbTx((tx) => tx.objectStore('files').delete(f.id)).then(() => renderFiles(f.reviewerId)).catch(writeFailed);
  },

  /* AI */
  'ai-save': () => {
    const key = $('#ai-key').value.trim();
    const model = $('#ai-model').value.trim();
    if (!key && !aiCfg.key) return toast('Please paste your Groq key first.');
    if (key) aiCfg.key = key;
    if (model) aiCfg.model = model; else delete aiCfg.model;
    aiModelInUse = null;
    saveAiCfg();
    toast(key && !key.startsWith('gsk_') ? 'Key saved, but Groq keys usually start with gsk_' : 'Saved. AI is ready');
    viewData();
  },
  'ai-clear': () => { delete aiCfg.key; saveAiCfg(); toast('Key removed'); viewData(); },
  'ai-test': async (el) => {
    const label = el.innerHTML;
    el.disabled = true;
    el.innerHTML = `${icon('sparkles')}Testing…`;
    try {
      await callAi({ mode: 'cards', count: 1, text: 'The mitochondria is the organelle that produces most of a cell’s energy in the form of ATP.' });
      toast('AI is working');
    } catch (e) { toast(e.message); }
    el.disabled = false;
    el.innerHTML = label;
  },

  /* account + sync */
  'sign-in': () => doAuth(false),
  'sign-up': () => doAuth(true),
  'sign-out': () => { clearSession(); clearTimeout(sync.timer); toast('Signed out'); viewData(); },
  'sync-now': () => runSync(true),

  /* backup */
  export: () => exportData(),
  import: () => $('#import-file').click(),
  wipe: async () => {
    if (!await confirmBox({ title: 'Delete ALL data?', message: `Every reviewer, question, flashcard, attached file and result on this device will be erased${auth ? ', and deleted from your cloud account and other devices too' : ''}. Export a backup first if unsure.`, okText: 'Delete everything' })) return;
    STORES.forEach((s) => (data[s] = []));
    persistAll();
    clearAllFiles();
    toast('All data deleted');
    go('/');
    route();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') $('#home-list').innerHTML = homeList(e.target.value);
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'rf-input' && e.target.files.length) {
    rfFiles.push(...e.target.files);
    renderRfFiles();
    e.target.value = '';
  }
  if (e.target.classList?.contains('gen-pick')) updateGenCount();
  if (e.target.id === 'file-input' && e.target.files.length) {
    addFiles([...e.target.files], location.hash.split('/')[2]);
    e.target.value = '';
  }
  if (e.target.id === 'import-file' && e.target.files[0]) {
    importFile(e.target.files[0]);
    e.target.value = '';
  }
});
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === 'Escape') return closeModal();
  if (e.key === 'Enter' && e.target.id === 'a-pass') { e.preventDefault(); return ACTIONS['sign-in'](); }
  if (e.key === 'Enter' && e.target.id === 'id-input' && e.target.tagName === 'INPUT') { e.preventDefault(); return ACTIONS['submit-id'](); }
  if (study && !typing && !$('#modal-root .modal') && study.i < study.deck.length) {
    if (e.key === 'ArrowRight') gotoCard(study.i + 1, 1);
    else if (e.key === 'ArrowLeft' && study.i > 0) gotoCard(study.i - 1, -1);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
  }
});
window.addEventListener('hashchange', () => { closeModal(); route(); });

/* =====================================================================
   CLOUD SYNC — Supabase (plain fetch, no SDK, works alongside the offline cache)
   Local IndexedDB stays the source the app reads from. Sync = pull newer rows, then push local changes.
   Conflicts: the most recently edited copy of a record wins. Needs supabase/schema.sql and config.js.
   ===================================================================== */
const CFG = window.CRAMVIEW_CONFIG || {};
const SB_URL = String(CFG.supabaseUrl || '').replace(/\/$/, '');
const syncConfigured = /^https:\/\//.test(SB_URL) && !!CFG.supabaseAnonKey;
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let auth = lsGet('cramview-session');   // { access_token, refresh_token, expires_at, user: { id, email } }
let syncMeta = lsGet('cramview-sync') || { pull: null, push: 0, user: null, last: null };
const saveMeta = () => lsSet('cramview-sync', syncMeta);
const sync = { running: false, again: false, timer: null, error: '' };
const pulledAt = new Map(); // 'store:id' -> edit time of the copy we just received, so we don't send it straight back

/** Call the Supabase REST API. */
async function sb(path, { method = 'GET', body, headers = {}, authed = true } = {}) {
  const h = { apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json', ...headers };
  if (authed) { await ensureToken(); h.Authorization = `Bearer ${auth.access_token}`; }
  const res = await fetch(SB_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let msg = '';
    try { const j = await res.json(); msg = j.msg || j.message || j.error_description || j.error || ''; } catch { /* no body */ }
    const err = new Error(msg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}
function setSession(j) {
  auth = {
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user: { id: j.user.id, email: j.user.email },
  };
  lsSet('cramview-session', auth);
}
function clearSession() { auth = null; lsSet('cramview-session', null); }
async function ensureToken() {
  if (!auth) throw new Error('Not signed in.');
  if (auth.expires_at * 1000 - Date.now() > 60000) return;
  try {
    setSession(await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: auth.refresh_token }, authed: false }));
  } catch (e) {
    if (e.status >= 400 && e.status < 500) { clearSession(); throw new Error('Session expired. Please sign in again.'); }
    throw e;
  }
}

async function signIn(email, password) {
  setSession(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, authed: false }));
}
/** Returns 'confirm' when Supabase wants the email confirmed before the first sign-in. */
async function signUp(email, password) {
  const j = await sb('/auth/v1/signup', { method: 'POST', body: { email, password }, authed: false });
  if (j && j.access_token) { setSession(j); return 'ok'; }
  return 'confirm';
}
/** After signing in: stop one person's data from silently landing in another account. */
async function afterLogin() {
  const hasLocal = STORES.some((s) => data[s].length);
  if (syncMeta.user && syncMeta.user !== auth.user.id && hasLocal) {
    const ok = await confirmBox({
      title: 'Different account',
      message: 'This device has data from another account. Add it to this account too? Cancel signs you out and keeps it separate.',
      okText: 'Add it', danger: false,
    });
    if (!ok) { clearSession(); return false; }
  }
  if (syncMeta.user !== auth.user.id) syncMeta = { pull: null, push: 0, user: auth.user.id, last: null };
  saveMeta();
  return true;
}

/** Apply one row from the cloud. Returns true if local data changed. */
function applyRemote(row) {
  if (!STORES.includes(row.store)) return false;
  const key = keyOf(row.store, row.id);
  const local = data[row.store].find((x) => x.id === row.id);
  const ts = Date.parse(row.updated_at);
  if (row.deleted) {
    if (!local || (local.updatedAt || 0) > ts) return false; // edited here after it was deleted elsewhere: keep it
    removeLocal(row.store, row.id);
    return true;
  }
  if (!row.data) return false;
  if (local && (local.updatedAt || 0) >= ts) return false;
  const tomb = tombs.find((t) => t.id === key);
  if (tomb && tomb.updatedAt >= ts) return false;           // deleted here after the cloud copy was edited
  dropTomb(key);
  putLocal(row.store, { ...row.data, updatedAt: ts });
  pulledAt.set(key, ts);
  return true;
}
async function pullRemote() {
  const PAGE = 1000;
  let changed = false;
  let newest = syncMeta.pull;
  const since = syncMeta.pull ? `&synced_at=gt.${encodeURIComponent(syncMeta.pull)}` : '';
  for (let offset = 0; ; offset += PAGE) {
    const rows = await sb(`/rest/v1/records?select=store,id,data,deleted,updated_at,synced_at&order=synced_at.asc,store.asc,id.asc&limit=${PAGE}&offset=${offset}${since}`);
    for (const row of rows || []) {
      if (applyRemote(row)) changed = true;
      if (!newest || row.synced_at > newest) newest = row.synced_at;
    }
    if (!rows || rows.length < PAGE) break;
  }
  syncMeta.pull = newest;
  saveMeta();
  return changed;
}
async function pushLocal() {
  const started = Date.now();
  const uid = auth.user.id;
  const rows = [];
  STORES.forEach((s) => data[s].forEach((o) => {
    if ((o.updatedAt || 0) >= syncMeta.push && pulledAt.get(keyOf(s, o.id)) !== o.updatedAt) rows.push({ user_id: uid, store: s, id: o.id, data: o, deleted: false, updated_at: new Date(o.updatedAt).toISOString() });
  }));
  const sentTombs = tombs.slice();
  sentTombs.forEach((t) => rows.push({ user_id: uid, store: t.store, id: t.rid, data: null, deleted: true, updated_at: new Date(t.updatedAt).toISOString() }));
  for (let i = 0; i < rows.length; i += 200) {
    await sb('/rest/v1/records?on_conflict=user_id,store,id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: rows.slice(i, i + 200),
    });
  }
  if (sentTombs.length) {
    const sent = new Set(sentTombs.map((t) => `${t.id}@${t.updatedAt}`));
    const gone = tombs.filter((t) => sent.has(`${t.id}@${t.updatedAt}`));
    tombs = tombs.filter((t) => !sent.has(`${t.id}@${t.updatedAt}`));
    if (useLocalStorage) persistLS();
    else idbTx((tx) => gone.forEach((t) => tx.objectStore('tombstones').delete(t.id))).catch(writeFailed);
  }
  pulledAt.clear();
  syncMeta.push = started;
  saveMeta();
}

async function runSync(manual) {
  if (!syncConfigured || !auth) return;
  if (sync.running) { sync.again = true; return; }
  if (!navigator.onLine) { if (manual) toast('You are offline.'); return; }
  sync.running = true;
  sync.error = '';
  updateSyncUI();
  let changed = false;
  try {
    changed = await pullRemote();
    await pushLocal();
    syncMeta.last = Date.now();
    saveMeta();
    if (manual) toast('Synced');
  } catch (e) {
    sync.error = e.message || 'Sync failed';
    if (manual) toast(`Sync failed: ${sync.error}`);
  }
  sync.running = false;
  updateSyncUI();
  if (changed) refreshAfterSync();
  if (sync.again) { sync.again = false; scheduleSync(500); }
}
function scheduleSync(delay = 2500) {
  if (!syncConfigured || !auth) return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(() => runSync(false), delay);
}
/** Redraw after new data arrived, unless that would interrupt the user. */
function refreshAfterSync() {
  if (session || study || $('#modal-root .modal') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  route();
}
function syncStatusText() {
  if (sync.running) return 'Syncing…';
  if (sync.error) return `${icon('alert')} ${esc(sync.error)}`;
  return syncMeta.last ? `Last synced ${esc(fmtDate(new Date(syncMeta.last).toISOString()))}` : 'Not synced yet';
}
function updateSyncUI() {
  const el = $('#sync-status');
  if (el) el.innerHTML = syncStatusText();
}
function syncCard() {
  if (!syncConfigured) {
    return `<div class="card stack"><div class="card-title">${icon('cloud')}Cloud sync</div>
      <p class="muted small">Cloud sync isn’t set up yet. Add your Supabase project URL and anon key to <b>config.js</b> (see README), then reload.</p></div>`;
  }
  if (auth) {
    return `<div class="card stack"><div class="card-title">${icon('cloud')}Cloud sync</div>
      <p class="small">Signed in as <b>${esc(auth.user.email)}</b></p>
      <p class="muted small" id="sync-status">${syncStatusText()}</p>
      <div class="btn-grid"><button class="btn primary" data-act="sync-now">Sync now</button>
      <button class="btn" data-act="sign-out">Sign out</button></div>
      <p class="muted small">Changes sync automatically when you’re online. Sign out keeps the data on this device.</p></div>`;
  }
  return `<div class="card stack"><div class="card-title">${icon('cloud')}Cloud sync</div>
    <p class="muted small">Sign in to keep your reviewers in sync between your PC and iPhone. The app still works offline.</p>
    <label class="field"><span class="label">Email</span><input type="email" id="a-email" autocomplete="email" autocapitalize="none" inputmode="email"></label>
    <label class="field"><span class="label">Password (6+ characters)</span><input type="password" id="a-pass" autocomplete="current-password"></label>
    <div class="btn-grid"><button class="btn primary" data-act="sign-in">Sign in</button>
    <button class="btn" data-act="sign-up">Create account</button></div></div>`;
}

async function doAuth(create) {
  const email = $('#a-email').value.trim();
  const password = $('#a-pass').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email.');
  if (password.length < 6) return toast('Password must be at least 6 characters.');
  const buttons = $$('[data-act="sign-in"], [data-act="sign-up"]');
  buttons.forEach((b) => (b.disabled = true));
  try {
    if (create) {
      if (await signUp(email, password) === 'confirm') {
        buttons.forEach((b) => (b.disabled = false));
        return toast('Check your email to confirm, then sign in.');
      }
    } else {
      await signIn(email, password);
    }
    if (!await afterLogin()) return viewData();
    toast('Signed in');
    viewData();
    runSync(true);
  } catch (e) {
    buttons.forEach((b) => (b.disabled = false));
    toast(e.message || 'Could not sign in.');
  }
}

/* =====================================================================
   BOOT + SERVICE WORKER
   ===================================================================== */
function showUpdateBanner(reg) {
  if (!navigator.serviceWorker.controller || $('.update-banner')) return;
  const b = document.createElement('div');
  b.className = 'update-banner';
  b.innerHTML = 'A new version is ready <button>Update</button>';
  b.querySelector('button').onclick = () => reg.waiting && reg.waiting.postMessage('SKIP_WAITING');
  document.body.prepend(b);
}
function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('service-worker.js').then((reg) => {
    if (reg.waiting) showUpdateBanner(reg);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed') showUpdateBanner(reg); });
    });
  }).catch((e) => console.warn('Service worker failed', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

(async function init() {
  await loadAll();
  route();
  registerSW();
  runSync(false);
  window.addEventListener('online', () => runSync(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(false); });
  setInterval(() => { if (document.visibilityState === 'visible') runSync(false); }, 120000);
})();
