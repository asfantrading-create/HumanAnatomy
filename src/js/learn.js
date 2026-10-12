// Learning centre: lessons by level, teacher lesson files, exams with
// certificates, progress dashboard, favourites, notes and saved views.
import { CONCEPT_QUESTIONS } from './questions.js';
import { progress } from './progress.js';

let A = null; // app API injected by app.js
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = () => A.lang();
const tr = (o) => (o ? (L() === 'ar' ? o.ar : o.en) : '');
const BAD_Q = /branch|tributary|set of|part of|segment|division|region|zone|digital|phalan|lumbrical|interosse|perforating|wall of|cavity of|cusp|leaflet/i;

let tab = 'lessons';
let levelFilter = 'all';
let exam = null;
let editor = null;

export function initLearning(api) {
  A = api;
  $('#btn-learn').addEventListener('click', () => (isOpen() ? close() : open()));
  $('#learn-close').addEventListener('click', close);
  document.querySelectorAll('[data-ltab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.ltab; render(); }));
  $('#lesson-file').addEventListener('change', onLessonFile);
}

const isOpen = () => !$('#learn-panel').classList.contains('hidden');
export function open(t) {
  if (t) tab = t;
  A.openSide('#learn-panel');
  $('#btn-learn').classList.add('active');
  render();
}
function close() {
  if (exam) endExam(true);
  $('#learn-panel').classList.add('hidden');
  $('#btn-learn').classList.remove('active');
}
export function refresh() { if (isOpen()) render(); }

function render() {
  document.querySelectorAll('[data-ltab]').forEach((b) => b.classList.toggle('active', b.dataset.ltab === tab));
  const body = $('#learn-body');
  if (exam) { renderExam(body); return; }
  if (editor) { renderEditor(body); return; }
  ({ lessons: renderLessons, exam: renderExamSetup, progress: renderProgress, favs: renderFavs })[tab](body);
}

// ---------------------------------------------------------------------------
// Lessons
function renderLessons(body) {
  const t = A.t;
  const tours = A.TOURS.filter((x) => levelFilter === 'all' || x.level === levelFilter || (x.level || 'school') === levelFilter);
  body.innerHTML = `
    <div class="seg">${['all', 'school', 'uni'].map((l) => `<button data-lvl="${l}" class="${l === levelFilter ? 'active' : ''}">${t('lvl_' + l)}</button>`).join('')}</div>
    <div class="lesson-list">${tours.map((x) => `
      <button class="tour-item" data-tour="${x.id}">
        <span><b>${esc(tr(x))}</b><small class="muted">${t('lvl_' + (x.level || 'school'))} · ${x.steps.length} ${t('steps')}</small></span>
        <span class="done">${progress.data.lessons[x.id] ? '✓' : ''}</span>
      </button>`).join('')}</div>
    <h3 class="sub-h">👩‍🏫 ${t('teacherTitle')}</h3>
    <p class="muted">${t('teacherHint')}</p>
    <div class="row-wrap">
      <button id="lesson-new">➕ ${t('lessonNew')}</button>
      <button id="lesson-open">📂 ${t('lessonOpen')}</button>
      <button id="present-btn">🖥 ${t('present')}</button>
    </div>`;
  body.querySelectorAll('[data-lvl]').forEach((b) => b.addEventListener('click', () => { levelFilter = b.dataset.lvl; render(); }));
  body.querySelectorAll('[data-tour]').forEach((b) => b.addEventListener('click', () => {
    const tour = A.TOURS.find((x) => x.id === b.dataset.tour);
    close();
    A.playTour(tour);
  }));
  $('#lesson-new').addEventListener('click', () => { editor = { title: '', author: progress.data.student || '', steps: [] }; render(); });
  $('#lesson-open').addEventListener('click', () => $('#lesson-file').click());
  $('#present-btn').addEventListener('click', () => A.togglePresentation(true));
}

async function onLessonFile(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'HA3D' || !Array.isArray(data.steps)) throw new Error('format');
    const tour = {
      id: 'file-' + (data.title || f.name), ar: data.title || f.name, en: data.title || f.name, level: data.level || 'school', custom: true,
      steps: data.steps.map((s) => ({ ar: s.text, en: s.text, view: s.view }))
    };
    close();
    A.playTour(tour);
  } catch {
    alert(A.t('lessonBadFile'));
  }
}

// ---------------------------------------------------------------------------
// Lesson editor (teacher mode)
function renderEditor(body) {
  const t = A.t;
  body.innerHTML = `
    <h3 class="sub-h">${t('lessonNew')}</h3>
    <label class="fld">${t('lessonTitle')}<input id="ed-title" value="${esc(editor.title)}"></label>
    <label class="fld">${t('lessonAuthor')}<input id="ed-author" value="${esc(editor.author)}"></label>
    <p class="muted">${t('lessonStepHint')}</p>
    <textarea id="ed-text" class="ed-text" placeholder="${t('lessonStepText')}"></textarea>
    <button id="ed-add" class="accent">📸 ${t('lessonAddStep')}</button>
    <ol class="ed-steps">${editor.steps.map((s, i) => `<li><span>${esc(s.text)}</span><button class="mini" data-del="${i}">✕</button></li>`).join('')}</ol>
    <div class="row-wrap">
      <button id="ed-play" ${editor.steps.length ? '' : 'disabled'}>▶ ${t('lessonPlay')}</button>
      <button id="ed-save" ${editor.steps.length ? '' : 'disabled'}>💾 ${t('lessonSave')}</button>
      <button id="ed-cancel">${t('close')}</button>
    </div>`;
  const sync = () => { editor.title = $('#ed-title').value; editor.author = $('#ed-author').value; };
  $('#ed-add').addEventListener('click', () => {
    sync();
    const text = $('#ed-text').value.trim();
    if (!text) { $('#ed-text').focus(); return; }
    editor.steps.push({ text, view: A.captureView() });
    render();
  });
  body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { sync(); editor.steps.splice(+b.dataset.del, 1); render(); }));
  $('#ed-play').addEventListener('click', () => {
    sync();
    const tour = { id: 'draft', ar: editor.title || '—', en: editor.title || '—', custom: true, steps: editor.steps.map((s) => ({ ar: s.text, en: s.text, view: s.view })) };
    close();
    A.playTour(tour);
  });
  $('#ed-save').addEventListener('click', () => {
    sync();
    const data = { app: 'HA3D', type: 'lesson', version: 1, title: editor.title || 'lesson', author: editor.author, created: new Date().toISOString(), steps: editor.steps };
    download(`${(editor.title || 'lesson').replace(/[\\/:*?"<>|]+/g, '_')}.ha3d.json`, JSON.stringify(data, null, 1), 'application/json');
  });
  $('#ed-cancel').addEventListener('click', () => { editor = null; render(); });
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------------------------------------------------------------------------
// Exam
const EXAM_SYSTEMS = ['skeletal', 'muscular', 'nervous', 'circulatory', 'respiratory', 'digestive', 'urinary', 'endocrine', 'lymphatic', 'reproductive', 'sensory', 'skin'];
let examCfg = { level: 'school', systems: ['skeletal', 'muscular', 'nervous', 'circulatory', 'respiratory', 'digestive'], count: 20, minutes: 0 };

function renderExamSetup(body) {
  const t = A.t;
  body.innerHTML = `
    <h3 class="sub-h">📝 ${t('examTitle')}</h3>
    <label class="fld">${t('studentName')}<input id="ex-name" value="${esc(progress.data.student)}" placeholder="${t('studentNamePh')}"></label>
    <div class="fld">${t('level')}<div class="seg">${['school', 'uni'].map((l) => `<button data-exl="${l}" class="${examCfg.level === l ? 'active' : ''}">${t('lvl_' + l)}</button>`).join('')}</div></div>
    <div class="fld">${t('examSystems')}<div class="chips-sel">${EXAM_SYSTEMS.map((s) => `<label class="chip-sel"><input type="checkbox" value="${s}" ${examCfg.systems.includes(s) ? 'checked' : ''}> ${A.sysName(s)}</label>`).join('')}</div></div>
    <div class="row2">
      <label class="fld">${t('examCount')}<select id="ex-count">${[10, 20, 30, 50].map((n) => `<option ${examCfg.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fld">${t('examTime')}<select id="ex-time">${[0, 10, 20, 30, 45].map((n) => `<option value="${n}" ${examCfg.minutes === n ? 'selected' : ''}>${n ? n + ' ' + t('minutes') : t('noLimit')}</option>`).join('')}</select></label>
    </div>
    <button id="ex-start" class="accent big">▶ ${t('examStart')}</button>
    <p class="muted">${t('examHint')}</p>`;
  body.querySelectorAll('[data-exl]').forEach((b) => b.addEventListener('click', () => { examCfg.level = b.dataset.exl; render(); }));
  $('#ex-start').addEventListener('click', () => {
    examCfg.systems = [...body.querySelectorAll('.chips-sel input:checked')].map((i) => i.value);
    examCfg.count = +$('#ex-count').value;
    examCfg.minutes = +$('#ex-time').value;
    const name = $('#ex-name').value.trim();
    progress.setStudent(name);
    if (!examCfg.systems.length) return;
    startExam(name);
  });
}

function shuffle(a) { return A.shuffle(a); }

function buildQuestions() {
  const { level, systems, count } = examCfg;
  const parts = A.state.parts.filter((p) => systems.includes(p.system) && p.mesh && !BAD_Q.test(p.en) && p.radius > 0.012
    && (A.state.sex === 'f' ? !p.maleOnly : p.sexOnly !== 'f'));
  const baseNames = new Map();
  const bn = (p) => { if (!baseNames.has(p)) baseNames.set(p, A.baseName(p)); return baseNames.get(p); };
  const out = [];
  // conceptual questions (school level also excludes university ones; university includes both)
  const concept = shuffle(CONCEPT_QUESTIONS.filter((q) => systems.includes(q.sys) && (level === 'uni' || q.level === 'school')));
  const nConcept = Math.min(concept.length, Math.round(count * 0.4));
  for (const q of concept.slice(0, nConcept)) {
    const opts = q.options.map((o, i) => ({ text: tr(o), ok: i === 0 }));
    out.push({ kind: 'concept', sys: q.sys, prompt: tr(q.q), options: shuffle(opts), explain: tr(q.explain) });
  }
  const pick = shuffle(parts.slice());
  const used = new Set();
  const optionsFor = (p) => {
    const correct = bn(p);
    const same = shuffle(parts.filter((x) => x.system === p.system && bn(x) !== correct).map(bn));
    const set = new Set([correct]);
    for (const n of same) { if (set.size >= 4) break; set.add(n); }
    return shuffle([...set].map((n) => ({ text: n, ok: n === correct })));
  };
  for (const p of pick) {
    if (out.length >= count) break;
    if (used.has(bn(p))) continue;
    used.add(bn(p));
    const wantDescribe = out.length % 2 === 0 && A.pdesc(p).length > 40 && !/\(.*(مبسط|simplified).*\)/i.test(A.pdesc(p));
    if (wantDescribe) {
      // hide the structure's own name inside its description
      let d = A.pdesc(p);
      for (const w of bn(p).split(/\s+/).filter((w) => w.length > 3)) d = d.split(w).join('…');
      out.push({ kind: 'describe', sys: p.system, prompt: d, options: optionsFor(p), part: p, explain: `${A.pname(p)}` });
    } else {
      out.push({ kind: 'identify', sys: p.system, prompt: A.t('quizName'), options: optionsFor(p), part: p, explain: A.pname(p) });
    }
  }
  return shuffle(out).slice(0, count);
}

function startExam(name) {
  const qs = buildQuestions();
  if (qs.length < 3) { alert(A.t('needMore')); return; }
  A.showOnlySystems(examCfg.systems);
  A.applyAll();
  exam = { name, qs, i: 0, correct: 0, answers: [], started: Date.now(), deadline: examCfg.minutes ? Date.now() + examCfg.minutes * 60000 : 0, timer: null, bySystem: {} };
  if (exam.deadline) exam.timer = setInterval(tick, 1000);
  showQuestion();
}
function tick() {
  if (!exam || !exam.deadline || exam.result) return;
  const left = Math.max(0, exam.deadline - Date.now());
  const el = $('#ex-timer');
  if (el) el.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  if (!left) finishExam();
}
function showQuestion() {
  const q = exam.qs[exam.i];
  A.setQuizTarget(q.kind === 'identify' ? q.part : null);
  if (q.kind === 'identify') A.focusParts([q.part], 0.35);
  render();
}
function renderExam(body) {
  const t = A.t;
  if (exam.result) { renderResult(body); return; }
  const q = exam.qs[exam.i];
  const ans = exam.answers[exam.i];
  body.innerHTML = `
    <div class="ex-head"><b>${t('question')} ${exam.i + 1} / ${exam.qs.length}</b><span id="ex-timer" class="muted"></span><span class="chip">${A.sysName(q.sys)}</span></div>
    <div class="ex-bar"><i style="width:${(exam.i / exam.qs.length) * 100}%"></i></div>
    <p class="ex-prompt">${q.kind === 'describe' ? `<span class="muted">${t('whichStructure')}</span><br>` : ''}${esc(q.prompt)}</p>
    <div class="ex-options">${q.options.map((o, k) => `<button data-opt="${k}" class="${ans ? (o.ok ? 'correct' : ans.k === k ? 'wrong' : '') : ''}">${esc(o.text)}</button>`).join('')}</div>
    ${ans ? `<p class="ex-explain">${ans.ok ? '✅' : '❌'} ${esc(q.explain)}</p>` : ''}
    <div class="row-between">
      <button id="ex-quit" class="link">${t('examQuit')}</button>
      ${q.kind !== 'concept' ? '<button id="ex-speak">🔊</button>' : ''}
      <button id="ex-next" class="accent" ${ans ? '' : 'disabled'}>${exam.i === exam.qs.length - 1 ? t('finish') : t('next')}</button>
    </div>`;
  tick();
  body.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
    if (exam.answers[exam.i]) return;
    const k = +b.dataset.opt, ok = q.options[k].ok;
    exam.answers[exam.i] = { k, ok };
    const s = (exam.bySystem[q.sys] = exam.bySystem[q.sys] || [0, 0]);
    s[1]++;
    if (ok) { exam.correct++; s[0]++; }
    if (q.part) A.setQuizTarget(q.part, true);
    render();
  }));
  $('#ex-next').addEventListener('click', () => {
    if (exam.i < exam.qs.length - 1) { exam.i++; showQuestion(); } else finishExam();
  });
  $('#ex-quit').addEventListener('click', () => { endExam(true); render(); });
  $('#ex-speak')?.addEventListener('click', () => A.speak(q.prompt));
}
function finishExam() {
  clearInterval(exam.timer);
  A.setQuizTarget(null);
  const total = exam.qs.length;
  const pct = Math.round((exam.correct / total) * 100);
  exam.result = { total, correct: exam.correct, pct, seconds: Math.round((Date.now() - exam.started) / 1000) };
  progress.addExam({ kind: 'exam', level: examCfg.level, name: exam.name, total, correct: exam.correct, bySystem: exam.bySystem });
  render();
}
function endExam() {
  if (!exam) return;
  clearInterval(exam.timer);
  A.setQuizTarget(null);
  exam = null;
}
function renderResult(body) {
  const t = A.t, r = exam.result;
  const passed = r.pct >= 70;
  const wrong = exam.qs.map((q, i) => ({ q, a: exam.answers[i] })).filter((x) => !x.a || !x.a.ok);
  body.innerHTML = `
    <div class="ex-result ${passed ? 'pass' : 'fail'}">
      <div class="ex-score">${r.pct}%</div>
      <div>${r.correct} / ${r.total} · ${passed ? t('examPassed') : t('examFailed')}</div>
    </div>
    <table class="ex-table">${Object.entries(exam.bySystem).map(([s, [c, n]]) => `<tr><td>${A.sysName(s)}</td><td><div class="bar"><i style="width:${(c / n) * 100}%"></i></div></td><td>${c}/${n}</td></tr>`).join('')}</table>
    ${wrong.length ? `<details class="ex-review"><summary>${t('reviewWrong')} (${wrong.length})</summary><ol>${wrong.map(({ q }) => `<li><span class="muted">${esc(q.kind === 'concept' ? q.prompt : q.kind === 'describe' ? q.prompt.slice(0, 90) + '…' : t('quizName'))}</span><br><b>${esc(q.options.find((o) => o.ok).text)}</b></li>`).join('')}</ol></details>` : ''}
    <div class="row-wrap">
      ${passed ? `<button id="ex-cert" class="accent">🎓 ${t('certificate')}</button>` : ''}
      <button id="ex-again">↻ ${t('examAgain')}</button>
      <button id="ex-done">${t('close')}</button>
    </div>`;
  $('#ex-cert')?.addEventListener('click', () => certificate(exam.name, r));
  $('#ex-again').addEventListener('click', () => { const n = exam.name; exam = null; startExam(n); });
  $('#ex-done').addEventListener('click', () => { exam = null; render(); });
}

async function certificate(name, r) {
  const t = A.t, ar = L() === 'ar';
  let logo = '';
  try {
    const blob = await (await fetch('asfan-logo.png')).blob();
    logo = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  } catch { /* logo optional */ }
  const id = Math.random().toString(36).slice(2, 10).toUpperCase();
  const date = new Date().toLocaleDateString(ar ? 'ar-JO' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const systems = examCfg.systems.map((s) => A.sysName(s)).join(ar ? '، ' : ', ');
  const html = `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Certificate</title><style>
    @page { size: A4 landscape; margin: 0; }
    body { margin: 0; font-family: 'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif; color: #0f172a; }
    .c { box-sizing: border-box; width: 297mm; height: 210mm; padding: 14mm; background: linear-gradient(135deg, #f8fbff, #eef6ff); }
    .f { box-sizing: border-box; height: 100%; border: 3px solid #0f9d8a; outline: 1px solid #0f9d8a; outline-offset: -9px; border-radius: 6px; padding: 14mm 18mm; text-align: center; position: relative; }
    .logo { height: 16mm; } h1 { font-size: 30pt; margin: 6mm 0 2mm; color: #0b5f8a; letter-spacing: 1px; }
    .sub { color: #5b6b7f; font-size: 13pt; } .name { font-size: 28pt; font-weight: 700; margin: 8mm 0 3mm; border-bottom: 2px solid #c9d6e6; display: inline-block; padding: 0 12mm 2mm; }
    .txt { font-size: 14pt; line-height: 1.9; } .score { display: inline-block; margin-top: 5mm; padding: 3mm 9mm; border-radius: 30px; background: #0f9d8a; color: #fff; font-size: 16pt; font-weight: 700; }
    .foot { position: absolute; bottom: 10mm; left: 18mm; right: 18mm; display: flex; justify-content: space-between; font-size: 10.5pt; color: #5b6b7f; }
  </style></head><body><div class="c"><div class="f">
    ${logo ? `<img class="logo" src="${logo}">` : '<b>ASFAN</b>'}
    <h1>${t('certTitle')}</h1>
    <div class="sub">${t('appTitle')} – Human Anatomy 3D</div>
    <div class="txt" style="margin-top:8mm">${t('certGiven')}</div>
    <div class="name">${esc(name || t('certStudent'))}</div>
    <div class="txt">${t('certFor', { level: t('lvl_' + examCfg.level), systems: esc(systems) })}</div>
    <div class="score">${r.pct}% · ${r.correct}/${r.total}</div>
    <div class="foot"><span>${t('certDate')}: ${date}</span><span>ASFAN · info@asfanco.com · +962 77 614 0404</span><span>${t('certId')}: ${id}</span></div>
  </div></div></body></html>`;
  A.printPDF(html, `certificate-${(name || 'student').replace(/[\\/:*?"<>|]+/g, '_')}.pdf`);
}

// ---------------------------------------------------------------------------
// Progress dashboard
function renderProgress(body) {
  const t = A.t;
  const parts = A.state.parts;
  const viewed = progress.data.viewed;
  const acc = progress.accuracy();
  const total = parts.length, seen = parts.filter((p) => viewed[p.id]).length;
  const rows = EXAM_SYSTEMS.map((s) => {
    const list = parts.filter((p) => p.system === s);
    if (!list.length) return '';
    const v = list.filter((p) => viewed[p.id]).length;
    const a = acc[s];
    return `<tr><td>${A.sysName(s)}</td>
      <td><div class="bar"><i style="width:${(v / list.length) * 100}%"></i></div><small class="muted">${v}/${list.length}</small></td>
      <td>${a ? `<div class="bar acc"><i style="width:${(a[0] / a[1]) * 100}%"></i></div><small class="muted">${Math.round((a[0] / a[1]) * 100)}%</small>` : '<small class="muted">—</small>'}</td></tr>`;
  }).join('');
  const weak = Object.entries(acc).filter(([, [c, n]]) => n >= 3 && c / n < 0.6).map(([s]) => A.sysName(s));
  const exams = progress.data.exams.slice(0, 8);
  body.innerHTML = `
    <div class="stat-row">
      <div class="stat"><b>${Math.round((seen / Math.max(1, total)) * 100)}%</b><span>${t('explored')}</span></div>
      <div class="stat"><b>${Object.keys(progress.data.lessons).length}</b><span>${t('lessonsDone')}</span></div>
      <div class="stat"><b>${progress.data.exams.length}</b><span>${t('examsTaken')}</span></div>
    </div>
    <table class="ex-table prog"><tr><th></th><th>${t('explored')}</th><th>${t('accuracy')}</th></tr>${rows}</table>
    ${weak.length ? `<p class="weak">💡 ${t('weakAreas')}: <b>${weak.join('، ')}</b></p>` : ''}
    <h3 class="sub-h">${t('recentExams')}</h3>
    ${exams.length ? `<ul class="exam-list">${exams.map((e) => `<li><span>${new Date(e.date).toLocaleDateString()}</span><span>${e.kind === 'exam' ? t('examTitle') : t('quiz')}</span><b>${Math.round((e.correct / Math.max(1, e.total)) * 100)}%</b><small class="muted">${e.correct}/${e.total}</small></li>`).join('')}</ul>` : `<p class="muted">${t('noExams')}</p>`}
    <button id="prog-reset" class="link">${t('resetProgress')}</button>`;
  $('#prog-reset').addEventListener('click', () => { if (confirm(t('resetConfirm'))) { progress.reset(); render(); } });
}

// ---------------------------------------------------------------------------
// Favourites, notes and saved views
function renderFavs(body) {
  const t = A.t;
  const byId = A.state.byId;
  const favs = progress.data.favs.map((id) => byId.get(id)).filter(Boolean);
  const notes = Object.keys(progress.data.notes).map((id) => byId.get(id)).filter(Boolean);
  body.innerHTML = `
    <h3 class="sub-h">📷 ${t('savedViews')}</h3>
    <div class="row-wrap"><input id="view-name" placeholder="${t('viewNamePh')}"><button id="view-save" class="accent">${t('saveView')}</button></div>
    <ul class="fav-list">${progress.data.views.map((v, i) => `<li><button class="linkish" data-view="${i}">${esc(v.name)}</button><button class="mini" data-vdel="${i}">✕</button></li>`).join('') || `<li class="muted">${t('none')}</li>`}</ul>
    <h3 class="sub-h">⭐ ${t('favorites')}</h3>
    <ul class="fav-list">${favs.map((p) => `<li><button class="linkish" data-part="${p.id}">${esc(A.pname(p))}</button></li>`).join('') || `<li class="muted">${t('favHint')}</li>`}</ul>
    <h3 class="sub-h">📝 ${t('myNotes')}</h3>
    <ul class="fav-list notes">${notes.map((p) => `<li><button class="linkish" data-part="${p.id}">${esc(A.pname(p))}</button><small>${esc(progress.note(p.id))}</small></li>`).join('') || `<li class="muted">${t('notesHint')}</li>`}</ul>`;
  $('#view-save').addEventListener('click', () => {
    const name = $('#view-name').value.trim() || `${t('view')} ${progress.data.views.length + 1}`;
    progress.addView({ name, ...A.captureView() });
    render();
  });
  body.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => A.restoreView(progress.data.views[+b.dataset.view])));
  body.querySelectorAll('[data-vdel]').forEach((b) => b.addEventListener('click', () => { progress.removeView(+b.dataset.vdel); render(); }));
  body.querySelectorAll('[data-part]').forEach((b) => b.addEventListener('click', () => {
    const p = byId.get(b.dataset.part);
    A.select(p);
    A.focusParts([p]);
  }));
}
