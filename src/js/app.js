import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { buildAnatomy, SYSTEMS } from './anatomy.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------------------------------------------------------------------------
// Renderer / scene
const container = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.08;
controls.maxDistance = 8;
controls.zoomSpeed = 1.2;
controls.screenSpacePanning = true;
controls.autoRotateSpeed = 1.6;

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a1d18, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(1.5, 3, 2.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9ecbff, 1.1);
rim.position.set(-2, 2, -2.5);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe2cf, 0.5);
fill.position.set(-2, 0.5, 2);
scene.add(fill);

// Floor: soft radial disc + grid
const floorTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(76,201,240,0.28)');
  grd.addColorStop(0.5, 'rgba(76,201,240,0.07)');
  grd.addColorStop(1, 'rgba(76,201,240,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
scene.add(floor);
const grid = new THREE.PolarGridHelper(0.8, 8, 5, 64, 0x2b4a6b, 0x1a2c44);
grid.position.y = -0.001;
scene.add(grid);

// ---------------------------------------------------------------------------
// State
const state = {
  parts: [],
  byId: new Map(),
  systems: {},
  selected: null,
  hovered: null,
  xray: false,
  labels: false,
  explode: 0,
  undo: [],
  quiz: null
};
for (const s of SYSTEMS) state.systems[s.id] = { ...s, visible: true, opacity: s.opacity };

const XRAY = { skin: 0.08, muscular: 0.18, skeletal: 0.55 };
const BODY_CENTER = new THREE.Vector3(0, 1.05, 0);

function effectiveOpacity(part) {
  const sys = state.systems[part.system];
  let op = sys.opacity;
  if (state.xray && XRAY[part.system] !== undefined) op = Math.min(op, XRAY[part.system]);
  return op;
}

function applyPart(part) {
  const sys = state.systems[part.system];
  const op = effectiveOpacity(part);
  const m = part.mesh.material;
  part.mesh.visible = sys.visible && !part.hidden && op > 0.01;
  m.opacity = op;
  const transparent = op < 0.999;
  if (m.transparent !== transparent) m.needsUpdate = true;
  m.transparent = transparent;
  m.depthWrite = op > 0.5;
  part.mesh.renderOrder = transparent ? (part.system === 'skin' ? 20 : 10) : 0;

  let emissive = 0x000000, intensity = 0;
  if (state.quiz && state.quiz.target === part) { emissive = 0x16c784; intensity = 0.75; }
  else if (state.selected === part) { emissive = 0x1e90ff; intensity = 0.42; }
  else if (state.hovered === part) { emissive = 0x5a6b85; intensity = 0.35; }
  m.emissive.setHex(emissive);
  m.emissiveIntensity = intensity;
}
const applyAll = () => { state.parts.forEach(applyPart); refreshTree(); };

// ---------------------------------------------------------------------------
// Build model
async function init() {
  const { root, parts } = await buildAnatomy((f, name) => {
    $('#loading-bar').style.width = `${Math.round(f * 100)}%`;
    if (name) $('#loading-text').textContent = `جارٍ بناء: ${name}...`;
  });
  scene.add(root);
  state.parts = parts;
  for (const p of parts) {
    p.hidden = false;
    state.byId.set(p.id, p);
    p.explodeDir = new THREE.Vector3().subVectors(p.center, BODY_CENTER);
    p.explodeDir.y *= 0.6;
  }
  buildSystemsUI();
  buildTree();
  applyAll();
  setView('front', false);
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 600);
}

// ---------------------------------------------------------------------------
// Camera helpers
let camAnim = null;
function animateCamera(toPos, toTarget, ms = 650) {
  camAnim = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget, t0: performance.now(), ms };
}
const VIEWS = {
  front: [0, 0.2, 1], back: [0, 0.2, -1], left: [1, 0.15, 0], right: [-1, 0.15, 0], top: [0, 1, 0.02]
};
function setView(name, animate = true) {
  const d = VIEWS[name];
  const target = new THREE.Vector3(0, 0.86, 0);
  const dist = name === 'top' ? 2.4 : 3.35;
  const pos = new THREE.Vector3(...d).normalize().multiplyScalar(dist).add(target);
  if (animate) animateCamera(pos, target);
  else { camera.position.copy(pos); controls.target.copy(target); controls.update(); }
}
function focusPart(part) {
  const center = part.center.clone().add(part.mesh.position);
  const dist = Math.max(0.18, part.radius * 3.2);
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  animateCamera(center.clone().addScaledVector(dir, dist), center);
}

// ---------------------------------------------------------------------------
// Systems panel
function buildSystemsUI() {
  const wrap = $('#systems');
  wrap.innerHTML = '';
  for (const s of SYSTEMS) {
    const st = state.systems[s.id];
    const row = document.createElement('div');
    row.className = 'system';
    row.innerHTML = `
      <input type="checkbox" ${st.visible ? 'checked' : ''} title="إظهار/إخفاء">
      <span class="dot" style="background:${s.color}"></span>
      <span class="name" title="${s.en}">${s.ar}</span>
      <input type="range" min="0" max="100" value="${Math.round(st.opacity * 100)}" title="الشفافية">`;
    const [cb, , name, range] = row.children;
    cb.addEventListener('change', () => { st.visible = cb.checked; applyAll(); });
    range.addEventListener('input', () => { st.opacity = range.value / 100; if (!st.visible && st.opacity > 0) { st.visible = true; cb.checked = true; } applyAll(); });
    name.addEventListener('click', () => { const d = $(`#tree details[data-sys="${s.id}"]`); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    st.ui = { cb, range };
    wrap.appendChild(row);
  }
}
function syncSystemsUI() {
  for (const s of SYSTEMS) {
    const st = state.systems[s.id];
    st.ui.cb.checked = st.visible;
    st.ui.range.value = Math.round(st.opacity * 100);
  }
}

const PRESETS = {
  all: () => SYSTEMS.forEach((s) => Object.assign(state.systems[s.id], { visible: true, opacity: s.opacity })),
  organs: () => SYSTEMS.forEach((s) => Object.assign(state.systems[s.id], {
    visible: !['muscular'].includes(s.id), opacity: s.id === 'skin' ? 0.12 : s.id === 'skeletal' ? 0.35 : 1
  })),
  skeleton: () => SYSTEMS.forEach((s) => Object.assign(state.systems[s.id], {
    visible: ['skeletal', 'skin'].includes(s.id), opacity: s.id === 'skin' ? 0.1 : 1
  }))
};

// ---------------------------------------------------------------------------
// Parts tree
const treeItems = new Map();
function buildTree() {
  const tree = $('#tree');
  tree.innerHTML = '';
  for (const s of SYSTEMS) {
    const list = state.parts.filter((p) => p.system === s.id).sort((a, b) => a.ar.localeCompare(b.ar, 'ar'));
    if (!list.length) continue;
    const d = document.createElement('details');
    d.dataset.sys = s.id;
    d.innerHTML = `<summary><span style="color:${s.color}">●</span> ${s.ar} <span class="muted">(${list.length})</span></summary>`;
    for (const p of list) {
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `<button class="eye" title="إظهار/إخفاء">👁</button><span title="${p.en}">${p.ar}</span>`;
      it.querySelector('.eye').addEventListener('click', (e) => { e.stopPropagation(); setHidden(p, !p.hidden); });
      it.addEventListener('click', () => { select(p); focusPart(p); });
      treeItems.set(p, it);
      d.appendChild(it);
    }
    tree.appendChild(d);
  }
  $('#part-count').textContent = `${state.parts.length} جزءاً`;
}
function refreshTree() {
  for (const [p, it] of treeItems) {
    it.classList.toggle('selected', state.selected === p);
    it.classList.toggle('off', p.hidden);
    it.querySelector('.eye').textContent = p.hidden ? '◌' : '👁';
  }
}

function setHidden(part, hidden, record = true) {
  if (record) state.undo.push([[part, part.hidden]]);
  part.hidden = hidden;
  if (hidden && state.selected === part) select(null);
  applyAll();
}

// ---------------------------------------------------------------------------
// Selection + info panel
function select(part) {
  const prev = state.selected;
  state.selected = part;
  if (prev) applyPart(prev);
  if (part) {
    if (part.hidden) part.hidden = false;
    if (!state.systems[part.system].visible) { state.systems[part.system].visible = true; syncSystemsUI(); }
    applyPart(part);
    const sys = state.systems[part.system];
    $('#info-system').textContent = sys.ar;
    $('#info-system').style.background = sys.color + '33';
    $('#info-system').style.color = sys.color;
    $('#info-name').textContent = part.ar;
    $('#info-en').textContent = part.en;
    $('#info-desc').textContent = part.desc;
    if (!state.quiz) $('#info-panel').classList.remove('hidden');
    const it = treeItems.get(part);
    if (it) { it.parentElement.open = true; it.scrollIntoView({ block: 'nearest' }); }
  } else {
    $('#info-panel').classList.add('hidden');
  }
  refreshTree();
}

$('#info-close').addEventListener('click', () => select(null));
$('#btn-focus').addEventListener('click', () => state.selected && focusPart(state.selected));
$('#btn-hide').addEventListener('click', () => state.selected && setHidden(state.selected, true));
$('#btn-isolate').addEventListener('click', () => state.selected && isolate(state.selected));

function isolate(part) {
  state.undo.push(state.parts.map((p) => [p, p.hidden]));
  for (const p of state.parts) p.hidden = p !== part;
  const st = state.systems[part.system];
  st.visible = true;
  if (st.opacity < 0.6) st.opacity = 1;
  syncSystemsUI();
  applyAll();
  focusPart(part);
}
function showAll() {
  state.undo.push(state.parts.map((p) => [p, p.hidden]));
  state.parts.forEach((p) => (p.hidden = false));
  applyAll();
}
function undo() {
  const last = state.undo.pop();
  if (!last) return;
  for (const [p, h] of last) p.hidden = h;
  applyAll();
}

// ---------------------------------------------------------------------------
// Picking
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const solid = [], faint = [];
  for (const p of state.parts) {
    if (!p.mesh.visible) continue;
    (effectiveOpacity(p) >= 0.45 ? solid : faint).push(p.mesh);
  }
  let hits = raycaster.intersectObjects(solid, false);
  if (!hits.length) hits = raycaster.intersectObjects(faint, false);
  return hits.length ? hits[0].object.userData.part : null;
}

let hoverPending = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  hoverPending = e;
});
renderer.domElement.addEventListener('pointerleave', () => { hoverPending = null; setHover(null); });
function processHover() {
  if (!hoverPending) return;
  const e = hoverPending;
  hoverPending = null;
  if (e.buttons) { setHover(null); return; }
  const p = pick(e.clientX, e.clientY);
  setHover(p, e);
}
function setHover(p, e) {
  const tip = $('#tooltip');
  if (state.hovered !== p) {
    const prev = state.hovered;
    state.hovered = p;
    if (prev) applyPart(prev);
    if (p) applyPart(p);
  }
  if (p && e && !(state.quiz && state.quiz.target === p)) {
    tip.innerHTML = `${p.ar}<div class="en">${p.en}</div>`;
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
    tip.classList.remove('hidden');
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tip.classList.add('hidden');
    renderer.domElement.style.cursor = '';
  }
}

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || e.button !== 0) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  if (moved > 5) return;
  const p = pick(e.clientX, e.clientY);
  if (state.quiz) return;
  if (p && e.altKey) { setHidden(p, true); return; }
  select(p);
});
renderer.domElement.addEventListener('dblclick', (e) => {
  const p = pick(e.clientX, e.clientY);
  if (p) { if (!state.quiz) select(p); focusPart(p); }
});

// ---------------------------------------------------------------------------
// Search
const normalize = (s) => s.toLowerCase()
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ال/g, '');
let searchActive = 0;
const searchInput = $('#search');
const results = $('#search-results');
function runSearch() {
  const q = normalize(searchInput.value.trim());
  if (!q) { results.classList.add('hidden'); return; }
  const terms = q.split(/\s+/);
  const found = state.parts.filter((p) => {
    const hay = normalize(`${p.ar} ${p.en} ${state.systems[p.system].ar}`);
    return terms.every((t) => hay.includes(t));
  }).slice(0, 30);
  results.innerHTML = found.length ? '' : '<div class="result muted">لا توجد نتائج</div>';
  searchActive = 0;
  found.forEach((p, i) => {
    const r = document.createElement('div');
    r.className = 'result' + (i === 0 ? ' active' : '');
    r.innerHTML = `<span>${p.ar}</span><span class="en">${p.en}</span>`;
    r.addEventListener('mousedown', (e) => { e.preventDefault(); choose(p); });
    r.part = p;
    results.appendChild(r);
  });
  results.classList.remove('hidden');
}
function choose(p) {
  results.classList.add('hidden');
  searchInput.blur();
  select(p);
  focusPart(p);
}
searchInput.addEventListener('input', runSearch);
searchInput.addEventListener('focus', runSearch);
searchInput.addEventListener('blur', () => setTimeout(() => results.classList.add('hidden'), 100));
searchInput.addEventListener('keydown', (e) => {
  const rows = [...results.querySelectorAll('.result')].filter((r) => r.part);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!rows.length) return;
    searchActive = (searchActive + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    rows.forEach((r, i) => r.classList.toggle('active', i === searchActive));
    rows[searchActive].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (rows[searchActive]) choose(rows[searchActive].part);
  } else if (e.key === 'Escape') {
    searchInput.value = '';
    searchInput.blur();
  }
});

// ---------------------------------------------------------------------------
// Toolbar
$$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$$('[data-preset]').forEach((b) => b.addEventListener('click', () => { PRESETS[b.dataset.preset](); syncSystemsUI(); applyAll(); }));
$('#btn-reset').addEventListener('click', resetAll);
$('#btn-showall').addEventListener('click', showAll);
$('#btn-xray').addEventListener('click', toggleXray);
$('#btn-rotate').addEventListener('click', toggleRotate);
$('#btn-labels').addEventListener('click', toggleLabels);
$('#btn-quiz').addEventListener('click', () => (state.quiz ? endQuiz() : startQuiz()));
$('#btn-shot').addEventListener('click', screenshot);
$('#btn-help').addEventListener('click', () => $('#help').classList.toggle('hidden'));
$('#help-close').addEventListener('click', () => $('#help').classList.add('hidden'));
$('#help').addEventListener('click', (e) => { if (e.target.id === 'help') $('#help').classList.add('hidden'); });
$('#explode').addEventListener('input', (e) => setExplode(e.target.value / 100));

function toggleXray() {
  state.xray = !state.xray;
  $('#btn-xray').classList.toggle('active', state.xray);
  applyAll();
}
function toggleRotate() {
  controls.autoRotate = !controls.autoRotate;
  $('#btn-rotate').classList.toggle('active', controls.autoRotate);
}
function toggleLabels() {
  state.labels = !state.labels;
  $('#btn-labels').classList.toggle('active', state.labels);
  if (!state.labels) $('#labels').innerHTML = '';
  labelsDirty = true;
}
function setExplode(k) {
  state.explode = k;
  for (const p of state.parts) {
    if (p.system === 'skin') { p.mesh.position.set(0, 0, 0); continue; }
    p.mesh.position.copy(p.explodeDir).multiplyScalar(k * 1.4);
  }
  $('#explode').value = Math.round(k * 100);
  labelsDirty = true;
}
function resetAll() {
  if (state.quiz) endQuiz();
  PRESETS.all();
  state.parts.forEach((p) => (p.hidden = false));
  state.xray = false;
  $('#btn-xray').classList.remove('active');
  setExplode(0);
  select(null);
  syncSystemsUI();
  applyAll();
  setView('front');
}
function screenshot() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `anatomy-${ts}.png`;
  a.href = url;
  a.click();
}

// ---------------------------------------------------------------------------
// Quiz mode
function quizPool() {
  return state.parts.filter((p) => p.system !== 'skin' && p.mesh.visible && effectiveOpacity(p) >= 0.45);
}
function startQuiz() {
  state.quiz = { score: 0, total: 0, target: null, answered: false };
  select(null);
  $('#quiz-panel').classList.remove('hidden');
  $('#btn-quiz').classList.add('active');
  nextQuestion();
}
function endQuiz() {
  const t = state.quiz && state.quiz.target;
  state.quiz = null;
  if (t) applyPart(t);
  $('#quiz-panel').classList.add('hidden');
  $('#btn-quiz').classList.remove('active');
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Strip the side suffix so "left" and "right" versions don't appear as separate choices.
const baseName = (p) => p.ar.replace(/\s+(الأيسر|الأيمن|اليسرى|اليمنى)$/, '');
function nextQuestion() {
  const q = state.quiz;
  const pool = quizPool();
  if (pool.length < 4) {
    $('#quiz-options').innerHTML = '<p class="muted">أظهر مزيداً من الأجهزة لبدء الاختبار.</p>';
    return;
  }
  const prev = q.target;
  let target;
  do { target = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && target === prev);
  q.target = target;
  q.answered = false;
  if (prev) applyPart(prev);
  applyPart(target);
  focusPart(target);
  const correct = baseName(target);
  const same = shuffle(state.parts.filter((p) => p.system === target.system && baseName(p) !== correct && p.system !== 'skin').map(baseName));
  const other = shuffle(state.parts.filter((p) => p.system !== 'skin' && baseName(p) !== correct).map(baseName));
  const opts = new Set([correct]);
  for (const n of [...same, ...other]) { if (opts.size >= 4) break; opts.add(n); }
  const box = $('#quiz-options');
  box.innerHTML = '';
  $('#quiz-feedback').textContent = '';
  for (const n of shuffle([...opts])) {
    const b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('click', () => {
      if (q.answered) return;
      q.answered = true;
      q.total++;
      const ok = n === correct;
      if (ok) q.score++;
      b.classList.add(ok ? 'correct' : 'wrong');
      [...box.children].forEach((c) => { if (c.textContent === correct) c.classList.add('correct'); });
      $('#quiz-feedback').innerHTML = ok ? '✅ إجابة صحيحة! أحسنت' : `❌ الإجابة الصحيحة: <b>${target.ar}</b>`;
      $('#quiz-score').textContent = `النتيجة: ${q.score} / ${q.total}`;
    });
    box.appendChild(b);
  }
}
$('#quiz-next').addEventListener('click', () => state.quiz && nextQuestion());
$('#quiz-close').addEventListener('click', endQuiz);

// ---------------------------------------------------------------------------
// Labels: an ID-buffer pass finds which parts are actually visible on screen
// and where, so labels only appear on unoccluded structures.
const PICK_W = 320;
const pickTarget = new THREE.WebGLRenderTarget(PICK_W, 200);
const pickMats = new Map();
let labelsDirty = true;
let lastLabelUpdate = 0;
function updateLabels() {
  const aspect = window.innerWidth / window.innerHeight;
  const W = PICK_W, H = Math.max(1, Math.round(PICK_W / aspect));
  if (pickTarget.height !== H) pickTarget.setSize(W, H);
  const swapped = [];
  const ids = [];
  for (const p of state.parts) {
    const m = p.mesh;
    if (!m.visible) continue;
    if (effectiveOpacity(p) < 0.45) { m.visible = false; swapped.push([m, null]); continue; }
    const idx = ids.length + 1;
    ids.push(p);
    let mat = pickMats.get(p);
    if (!mat) { mat = new THREE.MeshBasicMaterial(); pickMats.set(p, mat); }
    mat.color.setRGB((idx & 255) / 255, ((idx >> 8) & 255) / 255, 0, THREE.LinearSRGBColorSpace);
    swapped.push([m, m.material]);
    m.material = mat;
  }
  const bg = scene.background, env = scene.environment, tm = renderer.toneMapping;
  scene.background = new THREE.Color(0, 0, 0);
  floor.visible = grid.visible = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(pickTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.toneMapping = tm;
  scene.background = bg; scene.environment = env;
  floor.visible = grid.visible = true;
  for (const [m, mat] of swapped) { if (mat) m.material = mat; else m.visible = true; }

  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(pickTarget, 0, 0, W, H, buf);
  const acc = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const id = buf[o] + (buf[o + 1] << 8);
      if (!id) continue;
      let a = acc.get(id);
      if (!a) { a = { n: 0, sx: 0, sy: 0, px: [] }; acc.set(id, a); }
      a.n++; a.sx += x; a.sy += y;
      if ((a.n & 7) === 1) a.px.push(x, y);
    }
  }
  const entries = [];
  for (const [id, a] of acc) {
    const p = ids[id - 1];
    if (!p || a.n < 12 || p.system === 'skin') continue;
    // choose the sampled pixel of this part nearest to its centroid (keeps labels on the part)
    const cx = a.sx / a.n, cy = a.sy / a.n;
    let best = [cx, cy], bd = Infinity;
    for (let i = 0; i < a.px.length; i += 2) {
      const d = (a.px[i] - cx) ** 2 + (a.px[i + 1] - cy) ** 2;
      if (d < bd) { bd = d; best = [a.px[i], a.px[i + 1]]; }
    }
    entries.push({ p, n: a.n, x: (best[0] / W) * window.innerWidth, y: (1 - best[1] / H) * window.innerHeight });
  }
  entries.sort((a, b) => b.n - a.n);
  const placed = [];
  const layer = $('#labels');
  layer.innerHTML = '';
  for (const e of entries) {
    const w = e.p.ar.length * 6.5 + 14, h = 18;
    const box = [e.x - w / 2, e.y - h / 2, e.x + w / 2, e.y + h / 2];
    if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placed.push(box);
    const el = document.createElement('div');
    el.className = 'label';
    el.textContent = e.p.ar;
    el.style.left = e.x + 'px';
    el.style.top = e.y + 'px';
    el.style.borderColor = state.systems[e.p.system].color + '88';
    layer.appendChild(el);
    if (placed.length >= 45) break;
  }
}

// ---------------------------------------------------------------------------
// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.target === searchInput) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); searchInput.focus(); searchInput.select(); return; }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '5') setView(['front', 'back', 'left', 'right', 'top'][+k - 1]);
  else if (k === 'r') resetAll();
  else if (k === 'a') showAll();
  else if (k === 'x') toggleXray();
  else if (k === 'l') toggleLabels();
  else if (k === 'q') (state.quiz ? endQuiz() : startQuiz());
  else if (k === 'p') screenshot();
  else if (k === 'h' || k === '?') $('#help').classList.toggle('hidden');
  else if (k === ' ') { e.preventDefault(); toggleRotate(); }
  else if (k === 'escape') { $('#help').classList.add('hidden'); if (state.quiz) endQuiz(); else select(null); }
  else if ((k === 'delete' || k === 'backspace') && state.selected) setHidden(state.selected, true);
  else if (k === 'i' && state.selected) isolate(state.selected);
  else if (k === 'f' && state.selected) focusPart(state.selected);
});

// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelsDirty = true;
});
controls.addEventListener('change', () => { labelsDirty = true; });

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function loop(now) {
  requestAnimationFrame(loop);
  if (camAnim) {
    const t = Math.min(1, (now - camAnim.t0) / camAnim.ms);
    const k = ease(t);
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
    if (t >= 1) camAnim = null;
    labelsDirty = true;
  }
  controls.update();
  processHover();
  renderer.render(scene, camera);
  if (state.labels && labelsDirty && now - lastLabelUpdate > 120 && state.parts.length) {
    labelsDirty = false;
    lastLabelUpdate = now;
    updateLabels();
  }
}
requestAnimationFrame(loop);

init().catch((err) => {
  console.error(err);
  $('#loading-text').textContent = 'حدث خطأ أثناء تحميل النموذج: ' + err.message;
});

// Exposed for automated checks / debugging from DevTools.
window.__anatomy = { state, select, focusPart, setView, setExplode, toggleXray, toggleLabels, startQuiz, camera, controls };
