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
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

const TYPE_LABEL = { mc: 'Multiple choice', tf: 'True / False', id: 'Identification' };
const TYPE_SHORT = { mc: 'MC', tf: 'T/F', id: 'ID' };
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
  toast('⚠️ Could not save. Storage may be full or blocked.');
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
  quiz: { shuffleQ: true, shuffleC: true, lives: true },
  exam: { count: 10, minutes: 10, shuffle: true, lives: true },
  study: { shuffle: false, onlyLearning: false },
};
let settings = structuredClone(DEFAULT_SETTINGS);
try {
  const s = JSON.parse(localStorage.getItem('cramview-settings') || '{}');
  for (const k of Object.keys(settings)) Object.assign(settings[k], s[k] || {});
} catch { /* defaults */ }
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
function correctText(q) {
  if (q.type === 'mc') return q.choices[q.answer];
  if (q.type === 'tf') return q.answer ? 'True' : 'False';
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
}
function topbar(title, backTo, extra = '') {
  return `<header class="topbar">
    ${backTo ? `<button class="btn ghost icon" data-act="nav" data-to="${backTo}" aria-label="Back">←</button>` : ''}
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
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
  $('#modal-root').appendChild(back);
  return back.firstElementChild;
}
function closeModal() { $('#modal-root').innerHTML = ''; }
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
      <span class="muted" aria-hidden="true">›</span>
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
    return `<div class="empty"><span class="emoji">📚</span>
      <h2>No reviewers yet</h2>
      <p style="margin:6px 0 18px">Create a reviewer for a subject, add questions, then quiz yourself.</p>
      <div class="stack"><button class="btn primary block" data-act="new-reviewer">+ Create your first reviewer</button>
      <button class="btn block" data-act="load-sample">Try a sample reviewer</button></div></div>`;
  }
  if (!list.length) return `<div class="empty"><span class="emoji">🔍</span>Nothing matches “${esc(query)}”.</div>`;
  return list.map(reviewerCard).join('');
}
function viewHome() {
  render(`${topbar('📚 Cramview', '', `<button class="btn ghost icon" data-act="nav" data-to="/data" aria-label="Sync and backup">☁️</button>`)}
    <main class="container stack">
      ${data.reviewers.length ? `<input type="search" id="search" placeholder="Search reviewers…" autocomplete="off">` : ''}
      <div id="home-list" class="stack">${homeList('')}</div>
    </main>
    ${data.reviewers.length ? `<button class="fab" data-act="new-reviewer">+ New</button>` : ''}`);
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
      <span>${a.livesOn ? `${a.livesLeft} ❤️ left` : 'Lives off'}</span>
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

  render(`${topbar(esc(r.title), '/', `<button class="btn ghost icon" data-act="edit-reviewer" data-id="${r.id}" aria-label="Edit reviewer">✏️</button>`)}
  <main class="container">
    <div class="card stack">
      <div>
        <h2>${esc(r.title)}</h2>
        ${r.subject ? `<span class="badge primary" style="margin-top:6px">${esc(r.subject)}</span>` : ''}
      </div>
      <div class="section-title" style="margin:0">Notes &amp; lessons</div>
      ${r.notes ? `<div class="notes">${esc(r.notes)}</div>` : `<p class="muted">No notes yet. Tap ✏️ to add your lessons.</p>`}
    </div>

    <div class="row between">
      <div class="section-title">Files</div>
      <button class="btn sm" data-act="add-files" style="margin-top:14px">+ Add files</button>
    </div>
    <input type="file" id="file-input" multiple class="hidden">
    <div id="files-list" class="stack"></div>

    <div class="section-title">Start</div>
    <div class="btn-grid">
      <button class="btn big primary" data-act="start-setup" data-mode="quiz"><span class="emoji">🎯</span>Quiz Mode</button>
      <button class="btn big primary" data-act="start-setup" data-mode="exam"><span class="emoji">⏱️</span>Exam Mode</button>
      <button class="btn big" data-act="open-cards"><span class="emoji">🃏</span>Flashcards</button>
      <button class="btn big" data-act="nav" data-to="/r/${r.id}/questions"><span class="emoji">📝</span>Edit Questions</button>
    </div>
    <button class="btn block" style="margin-top:10px" data-act="nav" data-to="/r/${r.id}/cards">✏️ Edit Flashcards</button>

    <div class="section-title">Questions</div>
    <div class="stats">
      <div class="stat"><b>${qs.length}</b><span>Total</span></div>
      <div class="stat"><b>${count('mc')}</b><span>Multiple choice</span></div>
      <div class="stat"><b>${count('tf')}</b><span>True / False</span></div>
      <div class="stat"><b>${count('id')}</b><span>Identification</span></div>
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
          <span class="badge good">✓ Know it: ${know}</span>
          <span class="badge warn">↻ Still learning: ${learning}</span>
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
      ${at.length ? at.map(attemptRow).join('') : `<div class="empty"><span class="emoji">🕓</span>No attempts yet.</div>`}
      ${at.length ? `<button class="btn danger block" data-act="clear-history" data-id="${r.id}">Clear history</button>` : ''}
    </main>`);
}

/* =====================================================================
   REVIEWER FORM
   ===================================================================== */
function reviewerForm(r) {
  openModal(`<h2>${r ? 'Edit reviewer' : 'New reviewer'}</h2>
    <label class="field"><span class="label">Title</span><input type="text" id="f-title" maxlength="120" value="${esc(r?.title || '')}" placeholder="e.g. Chapter 3 — Cell Biology"></label>
    <label class="field"><span class="label">Subject</span><input type="text" id="f-subject" maxlength="80" value="${esc(r?.subject || '')}" placeholder="e.g. Biology"></label>
    <label class="field"><span class="label">Notes / lessons</span><textarea id="f-notes" style="min-height:200px" placeholder="Paste or type your lessons here…">${esc(r?.notes || '')}</textarea></label>
    <div class="row" style="margin-top:18px">
      <button class="btn grow" data-act="close-modal">Cancel</button>
      <button class="btn primary grow" data-act="save-reviewer" data-id="${r?.id || ''}">Save</button>
    </div>
    ${r ? `<button class="btn danger block" style="margin-top:10px" data-act="delete-reviewer" data-id="${r.id}">Delete this reviewer</button>` : ''}`);
  setTimeout(() => $('#f-title')?.focus(), 50);
}

/* =====================================================================
   VIEW: QUESTIONS (list + form)
   ===================================================================== */
function viewQuestions(r) {
  const qs = qsOf(r.id);
  render(`${topbar('Questions', `/r/${r.id}`, `<span class="badge">${qs.length}</span>`)}
    <main class="container stack">
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
      </div>`).join('') : `<div class="empty"><span class="emoji">📝</span><h2>No questions yet</h2><p>Tap the button below to add your first one.</p></div>`}
    </main>
    <button class="fab" data-act="new-question" data-rid="${r.id}">+ Question</button>`);
}

let qForm = null; // { rid, id, type }
function questionForm(rid, q) {
  qForm = { rid, id: q?.id || null, type: q?.type || 'mc' };
  const ch = q?.type === 'mc' ? q.choices : ['', '', '', ''];
  const correct = q?.type === 'mc' ? q.answer : 0;
  const tf = q?.type === 'tf' ? q.answer : true;
  openModal(`<h2>${q ? 'Edit question' : 'New question'}</h2>
    <div class="seg" id="q-seg">
      ${['mc', 'tf', 'id'].map((t) => `<button type="button" data-act="q-type" data-t="${t}" class="${qForm.type === t ? 'on' : ''}">${TYPE_SHORT[t]}</button>`).join('')}
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
  } else {
    q.answer = $('#q-ans', m).value.trim();
    if (!q.answer) return toast('Please type the correct answer.');
  }
  save('questions', q);
  touchReviewer(qForm.rid);
  toast('Question saved ✓');
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
function viewQuizSetup(r) {
  const total = qsOf(r.id).length;
  if (!total) { toast('Add some questions first.'); return go(`/r/${r.id}/questions`); }
  const s = settings.quiz;
  render(`${topbar('Quiz Mode', `/r/${r.id}`)}
    <main class="container stack">
      <div class="card"><div class="card-title">${esc(r.title)}</div><div class="muted small">${plural(total, 'question')} · answers are shown right after each question</div></div>
      <div class="card">
        ${toggleRow('o-shufq', 'Shuffle questions', 'Random order each time', s.shuffleQ)}
        ${toggleRow('o-shufc', 'Shuffle choices', 'Mixes up multiple-choice options', s.shuffleC)}
        ${toggleRow('o-lives', 'Life system ❤️❤️❤️', 'Lose a heart on each wrong answer. Lose all 3 and it is Game Over.', s.lives)}
      </div>
      <button class="btn primary block big" data-act="begin" data-mode="quiz" data-id="${r.id}">Start Quiz</button>
    </main>`);
}
function viewExamSetup(r) {
  const total = qsOf(r.id).length;
  if (!total) { toast('Add some questions first.'); return go(`/r/${r.id}/questions`); }
  const s = settings.exam;
  const n = clamp(s.count, 1, total);
  render(`${topbar('Exam Mode', `/r/${r.id}`)}
    <main class="container stack">
      <div class="card"><div class="card-title">${esc(r.title)}</div><div class="muted small">${plural(total, 'question')} available · correct answers are revealed only at the end</div></div>
      <div class="card">
        <label class="field"><span class="label">Number of questions (1–${total})</span>
          <input type="number" id="o-count" inputmode="numeric" min="1" max="${total}" value="${n}"></label>
        <label class="field"><span class="label">Time limit (minutes)</span>
          <input type="number" id="o-min" inputmode="numeric" min="1" max="300" value="${s.minutes}"></label>
      </div>
      <div class="card">
        ${toggleRow('o-shuf', 'Shuffle questions &amp; choices', 'Turn off to take the first questions in order', s.shuffle)}
        ${toggleRow('o-lives', 'Life system ❤️❤️❤️', 'Lose a heart on each wrong answer. Lose all 3 and the exam ends.', s.lives)}
      </div>
      <button class="btn primary block big" data-act="begin" data-mode="exam" data-id="${r.id}">Start Exam</button>
    </main>`);
}

/* =====================================================================
   PLAY: QUIZ + EXAM
   ===================================================================== */
let timerId = null;
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

function startSession(setup) {
  lastSetup = setup;
  let list = qsOf(setup.reviewerId);
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
      <button class="btn ghost icon" data-act="quit" aria-label="Quit">✕</button>
      ${s.livesOn
        ? `<div class="hearts" id="hearts" aria-label="${s.lives} lives left">${Array.from({ length: MAX_LIVES }, (_, i) => `<span class="heart ${i >= s.lives ? 'lost' : ''}" data-h="${i}">❤️</span>`).join('')}</div>`
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
      return `<button class="option ${cls}" data-act="pick" data-i="${i}" ${it.answered ? 'disabled' : ''}>
        <span class="letter">${q.type === 'tf' ? (i ? '✗' : '✓') : 'ABCD'[i]}</span><span class="txt">${esc(c.text)}</span></button>`;
    }).join('')}</div>`;
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
      ${it.correct ? '✅ Correct!' : '❌ Wrong'}
      ${it.correct ? '' : `<div class="ans">Correct answer: ${esc(correctText(q))}</div>`}
    </div>`;
  }
  const last = s.index + 1 >= s.items.length;
  const dead = s.livesOn && s.lives <= 0;
  const next = it.answered && quiz
    ? `<button class="btn primary block big" data-act="next">${dead ? 'Continue' : last ? 'See results' : 'Next question →'}</button>` : '';

  $('#play-body').innerHTML = `<div class="stack">
    <div class="card q-card ${it.answered && quiz && !it.correct ? 'shake' : ''}">
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
  it.correct = it.choices ? it.choices[value].correct : checkIdentification(it.q, value);
  s.answeredCount++;
  if (it.correct) {
    s.correct++;
  } else {
    if (navigator.vibrate) navigator.vibrate(120);
    if (s.livesOn) {
      s.lives--;
      const h = $(`#hearts [data-h="${s.lives}"]`);
      if (h) { h.classList.add('lost', 'lose-anim'); }
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
  const emoji = over ? '💀' : pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪';
  const title = over ? 'Game Over' : s.endReason === 'timeup' ? "Time's up!" : 'Completed!';
  const livesLine = !s.livesOn ? 'Life system was off'
    : over ? 'You lost all 3 ❤️' : `Finished with ${s.lives} ❤️ left`;

  const review = s.items.map((it, i) => {
    const q = it.q;
    const yours = !it.answered ? null : it.choices ? it.choices[it.user].text : it.user;
    return `<div class="card review-item ${it.correct ? 'ok' : 'no'}">
      <div class="row between"><span class="badge">${i + 1} · ${TYPE_LABEL[q.type]}</span>
        <span class="badge ${it.correct ? 'good' : 'bad'}">${it.correct ? 'Correct' : it.answered ? 'Wrong' : 'Not answered'}</span></div>
      <div style="margin-top:8px;font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere">${esc(q.text)}</div>
      <div class="small" style="margin-top:6px;overflow-wrap:anywhere">Your answer: <b>${yours === null ? '—' : esc(yours) || '(blank)'}</b></div>
      ${it.correct ? '' : `<div class="small" style="overflow-wrap:anywhere">Correct answer: <b>${esc(correctText(q))}</b></div>`}
    </div>`;
  }).join('');

  render(`${topbar(s.mode === 'exam' ? 'Exam results' : 'Quiz results', '')}
    <main class="container stack">
      <div class="card result-hero ${over ? 'over' : ''}">
        <span class="emoji">${emoji}</span>
        <h2 style="margin-top:8px">${title}</h2>
        <div class="big-score">${s.correct} / ${total}</div>
        <div class="muted" style="font-size:1.1rem;font-weight:700">${pct}%</div>
        <p style="margin-top:12px;font-weight:650">${livesLine}</p>
        <p class="muted small">${over ? 'Score so far · ' : ''}Answered ${s.answeredCount} of ${total} questions</p>
        ${r ? `<p class="muted small">${esc(r.title)}</p>` : ''}
      </div>
      <div class="btn-grid">
        <button class="btn primary big" data-act="retry">Retry</button>
        <button class="btn big" data-act="nav" data-to="/r/${s.reviewerId}">Go back</button>
      </div>
      <div class="section-title">Review</div>
      <div class="stack">${review}</div>
    </main>`);
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
        <button class="btn primary" data-act="nav" data-to="/r/${r.id}/study" ${cards.length ? '' : 'disabled'}>🃏 Study</button>
        <button class="btn" data-act="generate-cards" data-id="${r.id}" ${nq ? '' : 'disabled'}>✨ From questions</button>
      </div>
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
      </div>`).join('') : `<div class="empty"><span class="emoji">🃏</span><h2>No flashcards yet</h2>
        <p>${nq ? 'Tap “From questions” to auto-make a deck, or add your own.' : 'Add your own cards with the button below.'}</p></div>`}
    </main>
    <button class="fab" data-act="new-card" data-rid="${r.id}">+ Card</button>`);
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
  toast(added ? `Added ${plural(added, 'flashcard')} ✓` : 'All questions already have flashcards.');
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
  const head = topbar(`🃏 ${esc(r.title)}`, `/r/${r.id}`);
  const opts = `<div class="row wrap" style="gap:8px">
      <button class="btn sm ${st.shuffle ? 'primary' : ''}" data-act="study-opt" data-o="shuffle">🔀 Shuffle ${st.shuffle ? 'on' : 'off'}</button>
      <button class="btn sm ${st.onlyLearning ? 'primary' : ''}" data-act="study-opt" data-o="onlyLearning">↻ Still learning only</button>
    </div>`;

  if (!st.deck.length) {
    return render(`${head}<main class="container stack">${opts}
      <div class="empty"><span class="emoji">🎉</span><h2>Nothing left to study</h2><p>You marked every card “Know it”. Turn off “Still learning only” to see them all.</p></div></main>`);
  }
  if (st.i >= st.deck.length) {
    const ids = new Set(st.deck);
    const cs = data.flashcards.filter((c) => ids.has(c.id));
    const know = cs.filter((c) => c.status === 'know').length;
    return render(`${head}<main class="container stack">
      <div class="card result-hero"><span class="emoji">🎉</span><h2 style="margin-top:8px">Deck finished!</h2>
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
    <div class="row between small muted"><b id="st-count" style="color:var(--text)">Card ${st.i + 1} of ${st.deck.length}</b><span>Tap card to flip · swipe ← →</span></div>
    <div class="progress-line"><i id="st-bar" style="width:${(st.i / st.deck.length) * 100}%"></i></div>
    <div class="fc-wrap" id="fc-wrap">
      <div class="fc" id="fc" data-act="flip" tabindex="0" role="button" aria-label="Flashcard. Activate to flip.">
        <div class="fc-face front"><span class="fc-side">Front</span><span class="fc-status" id="fc-st1"></span><div class="fc-text" id="fc-front"></div></div>
        <div class="fc-face back"><span class="fc-side">Back</span><span class="fc-status" id="fc-st2"></span><div class="fc-text" id="fc-back"></div></div>
      </div>
    </div>
    <div class="btn-grid">
      <button class="btn warn big" style="border-color:var(--warn);color:var(--warn)" data-act="mark" data-s="learning">↻ Still learning</button>
      <button class="btn good big" data-act="mark" data-s="know">✓ Know it</button>
    </div>
    <div class="row">
      <button class="btn grow" data-act="card-prev" ${st.i === 0 ? 'disabled' : ''} id="st-prev">← Previous</button>
      <button class="btn grow" data-act="card-next" id="st-next">Next →</button>
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
    fc.classList.remove('slide-left', 'slide-right');
    void fc.offsetWidth;
    fc.classList.add(dir < 0 ? 'slide-right' : 'slide-left');
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
function viewData() {
  render(`${topbar('Sync & backup', '/')}
    <main class="container stack">
      ${syncCard()}
      <div class="card stack">
        <div class="card-title">Backup file</div>
        <p class="muted small">Without cloud sync, your data is saved only on this device. Export a file, send it to another device (AirDrop, email, Files), then import it there.</p>
        <button class="btn primary block" data-act="export">⬇️ Export all data</button>
        <button class="btn block" data-act="import">⬆️ Import from file</button>
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
    try { await navigator.share({ files: [file], title: 'Cramview backup' }); return toast('Backup ready ✓'); }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup downloaded ✓');
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
    toast('Import complete ✓');
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
  return { pdf: '📕', ppt: '📙', pptx: '📙', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', txt: '📄', md: '📄' }[ext] || (/^(png|jpe?g|gif|webp|heic)$/.test(ext) ? '🖼️' : '📎');
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
    const canExtract = /^(docx|pptx|txt|md)$/.test(ext);
    return `<div class="card">
      <div class="list-item">
        <span style="font-size:1.8rem" aria-hidden="true">${fileIcon(f.name)}</span>
        <div class="grow"><div class="ellip" style="font-weight:650">${esc(f.name)}</div><div class="small muted">${fmtSize(f.size)}</div></div>
      </div>
      <div class="row wrap" style="margin-top:10px;gap:8px">
        ${canOpen ? `<a class="btn sm" href="${url}" target="_blank" rel="noopener">Open</a>` : ''}
        <a class="btn sm" href="${url}" download="${esc(f.name)}">Download</a>
        ${canExtract ? `<button class="btn sm" data-act="file-extract" data-id="${f.id}">Text → notes</button>` : ''}
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
  if (added) toast(`Added ${plural(added, 'file')} ✓`);
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
/** Paragraph text from Word/PowerPoint XML (paragraph tag: 'p', text run tag: 't'). */
function xmlParagraphs(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.getElementsByTagNameNS('*', 'p')].map((p) => {
    let s = '';
    p.querySelectorAll('*').forEach((el) => {
      if (el.localName === 't') s += el.textContent;
      else if (el.localName === 'tab') s += '\t';
      else if (el.localName === 'br') s += '\n';
    });
    return s.trim();
  }).filter(Boolean);
}
async function extractText(rec) {
  const ext = rec.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'md') return (await rec.blob.text()).trim();
  const zip = await openZip(rec.blob);
  if (ext === 'docx') {
    if (!zip.names.includes('word/document.xml')) throw new Error('No text found in this document.');
    return xmlParagraphs(await zip.text('word/document.xml')).join('\n\n');
  }
  if (ext === 'pptx') {
    const slides = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/(\d+)\.xml$/)[1], 10) - parseInt(b.match(/(\d+)\.xml$/)[1], 10));
    const parts = [];
    for (let i = 0; i < slides.length; i++) {
      const lines = xmlParagraphs(await zip.text(slides[i]));
      if (lines.length) parts.push(`Slide ${i + 1}\n${lines.join('\n')}`);
    }
    return parts.join('\n\n');
  }
  throw new Error('Text extraction works for .docx, .pptx, .txt and .md files.');
}
async function extractToNotes(fileId) {
  const rec = await getFile(fileId);
  if (!rec) return;
  let text;
  try { text = await extractText(rec); } catch (e) { return toast(e.message || 'Could not read that file.'); }
  if (!text) return toast('No text found in that file. (Scanned or image-only files can’t be read.)');
  const preview = text.length > 400 ? `${text.slice(0, 400)}…` : text;
  const m = openModal(`<h2>Add text to notes?</h2>
    <p class="muted small">Found ${text.length.toLocaleString()} characters in “${esc(rec.name)}”. It will be added to the end of this reviewer’s notes.</p>
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
    const r = getReviewer(rec.reviewerId);
    if (!r) return;
    r.notes = `${r.notes ? `${r.notes}\n\n` : ''}— ${rec.name} —\n${text}`;
    r.updated = now();
    save('reviewers', r);
    toast('Added to notes ✓');
    route();
  });
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
  toast('Sample reviewer added ✓');
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
  'save-reviewer': (el) => {
    const title = $('#f-title').value.trim();
    if (!title) return toast('Please enter a title.');
    const old = el.dataset.id ? getReviewer(el.dataset.id) : null;
    const r = { id: old?.id || uid(), title, subject: $('#f-subject').value.trim(), notes: $('#f-notes').value.trim(), created: old?.created || now(), updated: now() };
    save('reviewers', r);
    closeModal();
    toast('Saved ✓');
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
    ['mc', 'tf', 'id'].forEach((t) => $(`#sec-${t}`).classList.toggle('hidden', t !== qForm.type));
  },
  'tf-pick': (el) => $$('#tf-seg button').forEach((b) => b.classList.toggle('on', b === el)),
  'save-question': (el) => saveQuestion(el.dataset.more === '1'),

  /* setup + play */
  'start-setup': (el) => go(`/r/${location.hash.split('/')[2]}/${el.dataset.mode}`),
  'open-cards': () => {
    const rid = location.hash.split('/')[2];
    go(`/r/${rid}/${cardsOf(rid).length ? 'study' : 'cards'}`);
  },
  begin: (el) => {
    const rid = el.dataset.id;
    const total = qsOf(rid).length;
    let setup;
    if (el.dataset.mode === 'quiz') {
      settings.quiz = { shuffleQ: $('#o-shufq').checked, shuffleC: $('#o-shufc').checked, lives: $('#o-lives').checked };
      setup = { mode: 'quiz', reviewerId: rid, ...settings.quiz };
    } else {
      const count = clamp(parseInt($('#o-count').value, 10) || 1, 1, total);
      const minutes = clamp(parseInt($('#o-min').value, 10) || 1, 1, 300);
      settings.exam = { count, minutes, shuffle: $('#o-shuf').checked, lives: $('#o-lives').checked };
      setup = { mode: 'exam', reviewerId: rid, count, minutes, shuffleQ: settings.exam.shuffle, shuffleC: settings.exam.shuffle, lives: settings.exam.lives };
    }
    saveSettings();
    startSession(setup);
    go(`/r/${rid}/play`);
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
  retry: () => { startSession(lastSetup); renderPlay(); },

  /* flashcards */
  'generate-cards': (el) => generateCards(el.dataset.id),
  'new-card': (el) => cardForm(el.dataset.rid, null),
  'edit-card': (el) => cardForm(null, data.flashcards.find((c) => c.id === el.dataset.id)),
  'save-card': (el) => {
    const front = $('#c-front').value.trim();
    const back = $('#c-back').value.trim();
    if (!front || !back) return toast('Please fill in both sides.');
    const old = el.dataset.id ? data.flashcards.find((c) => c.id === el.dataset.id) : null;
    save('flashcards', { id: old?.id || uid(), reviewerId: old?.reviewerId || el.dataset.rid, front, back, status: old?.status || 'new', questionId: old?.questionId, created: old?.created || Date.now() });
    toast('Card saved ✓');
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
  if (e.key === 'Enter' && e.target.id === 'id-input') { e.preventDefault(); return ACTIONS['submit-id'](); }
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
    if (manual) toast('Synced ✓');
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
  if (sync.error) return `⚠️ ${esc(sync.error)}`;
  return syncMeta.last ? `Last synced ${esc(fmtDate(new Date(syncMeta.last).toISOString()))}` : 'Not synced yet';
}
function updateSyncUI() {
  const el = $('#sync-status');
  if (el) el.innerHTML = syncStatusText();
}
function syncCard() {
  if (!syncConfigured) {
    return `<div class="card stack"><div class="card-title">☁️ Cloud sync</div>
      <p class="muted small">Cloud sync isn’t set up yet. Add your Supabase project URL and anon key to <b>config.js</b> (see README), then reload.</p></div>`;
  }
  if (auth) {
    return `<div class="card stack"><div class="card-title">☁️ Cloud sync</div>
      <p class="small">Signed in as <b>${esc(auth.user.email)}</b></p>
      <p class="muted small" id="sync-status">${syncStatusText()}</p>
      <div class="btn-grid"><button class="btn primary" data-act="sync-now">Sync now</button>
      <button class="btn" data-act="sign-out">Sign out</button></div>
      <p class="muted small">Changes sync automatically when you’re online. Sign out keeps the data on this device.</p></div>`;
  }
  return `<div class="card stack"><div class="card-title">☁️ Cloud sync</div>
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
    toast('Signed in ✓');
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
