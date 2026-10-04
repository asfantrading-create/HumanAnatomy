import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { loadModel, SYSTEMS } from './model.js';
import { STRINGS, GROUPS } from './i18n.js';
import { TOURS } from './tours.js';
import { licensing } from './license.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
};

// ---------------------------------------------------------------------------
// Language
let lang = store.get('lang', 'ar');
const t = (key, vars = {}) => String(STRINGS[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const pname = (p) => (lang === 'ar' ? p.ar : p.en);
const altName = (p) => (lang === 'ar' ? p.en : p.ar);
const pdesc = (p) => (lang === 'ar' ? p.descAr || p.descEn : p.descEn || p.descAr) || '';
const sysName = (id) => { const s = SYSTEMS.find((x) => x.id === id); return lang === 'ar' ? s.ar : s.en; };
const groupName = (g) => (GROUPS[g] ? GROUPS[g][lang === 'ar' ? 0 : 1] : t('group_other'));

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('appTitle');
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('#toolbar button, .info-actions button').forEach((b) => { const s = b.querySelector('[data-i18n]'); if (s) b.title = s.textContent; });
  $('#btn-shot').title = t('shot'); $('#btn-help').title = t('help');
  $('#btn-about').title = t('aboutTitle'); $('#btn-license').title = t('license');
  $('#help-table').innerHTML = STRINGS[lang].help.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  $('#about-text').textContent = lang === 'ar'
    ? 'برنامج تعليمي تفاعلي لاستكشاف تشريح جسم الإنسان بالأبعاد الثلاثية، مبني على نماذج تشريحية حقيقية مأخوذة من بيانات طبية.'
    : 'An interactive educational application for exploring human anatomy in 3D, built on real anatomical models derived from medical imaging data.';
  if (state.parts.length) {
    buildSystemsUI();
    buildTree();
    if (state.selected) showInfo(state.selected);
    if (state.quiz) renderQuiz();
    if (state.tour) renderTour();
    renderTourList();
    labelsDirty = true;
  }
  updateLicenseUI();
}

// ---------------------------------------------------------------------------
// Renderer / scene
const container = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.005, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.03;
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

const floor = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(76,201,240,0.28)');
  grd.addColorStop(0.5, 'rgba(76,201,240,0.07)');
  grd.addColorStop(1, 'rgba(76,201,240,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.002;
  return m;
})();
scene.add(floor);
const grid = new THREE.PolarGridHelper(0.8, 8, 5, 64, 0x2b4a6b, 0x1a2c44);
grid.position.y = -0.001;
scene.add(grid);

// ---------------------------------------------------------------------------
// State
const state = {
  parts: [], byId: new Map(), systems: {}, selected: null, hovered: null,
  xray: false, labels: false, explode: 0, undo: [], quiz: null, tour: null,
  heartbeat: false, breathing: false
};
for (const s of SYSTEMS) state.systems[s.id] = { ...s, visible: true, opacity: s.opacity };
const XRAY = { skin: 0.08, muscular: 0.15, skeletal: 0.5 };
const BODY_CENTER = new THREE.Vector3(0, 1.0, 0);

function effectiveOpacity(part) {
  const sys = state.systems[part.system];
  let op = sys.opacity * (part.alpha ?? 1);
  if (state.xray && XRAY[part.system] !== undefined) op = Math.min(op, XRAY[part.system]);
  // during a lesson everything except the structures being explained is ghosted
  const qz = state.quiz;
  if (qz && qz.target && qz.target !== part && (qz.mode === 'name' || qz.revealed)) op = Math.min(op, part.system === 'skin' ? 0.04 : 0.1);
  if (state.tour && state.tour.highlight.size && !state.tour.highlight.has(part)) op = Math.min(op, part.system === 'skin' ? 0.05 : 0.12);
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
  const q = state.quiz;
  if (q && q.target === part && (q.mode === 'name' || q.revealed)) { emissive = 0x19ff7a; intensity = 1.1; m.opacity = 1; m.transparent = false; m.depthWrite = true; part.mesh.visible = true; }
  else if (state.selected === part || (state.tour && state.tour.highlight.has(part))) { emissive = 0x2a9df4; intensity = 0.45; }
  else if (state.hovered === part) { emissive = 0x5a6b85; intensity = 0.35; }
  m.emissive.setHex(emissive);
  m.emissiveIntensity = intensity;
  // the quiz target is drawn on top of everything so it is never hidden
  const onTop = !!(q && q.target === part && intensity > 1);
  if (m.depthTest === onTop) { m.depthTest = !onTop; m.needsUpdate = true; }
  if (onTop) part.mesh.renderOrder = 30;
}
const applyAll = () => { state.parts.forEach(applyPart); refreshTree(); labelsDirty = true; };

// ---------------------------------------------------------------------------
// Cross-section clipping planes
const clip = {
  x: { plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), on: false, flip: false, scale: 0.01 },
  y: { plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.2), on: false, flip: false, scale: 0.01 },
  z: { plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), on: false, flip: false, scale: 0.01 }
};
let activePlanes = [];
function updateClipping() {
  activePlanes = [];
  for (const [axis, c] of Object.entries(clip)) {
    const row = $(`.clip-row[data-axis="${axis}"]`);
    const v = row.querySelector('input[type=range]').value * c.scale;
    const n = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0).multiplyScalar(c.flip ? 1 : -1);
    c.plane.normal.copy(n);
    c.plane.constant = c.flip ? -v : v;
    if (c.on) activePlanes.push(c.plane);
  }
  for (const p of state.parts) {
    if (p.system === 'skin' && activePlanes.length === 0) { p.mesh.material.clippingPlanes = null; continue; }
    p.mesh.material.clippingPlanes = activePlanes.length ? activePlanes : null;
  }
  for (const m of pickMats.values()) m.clippingPlanes = activePlanes.length ? activePlanes : null;
  $('#btn-section').classList.toggle('active', activePlanes.length > 0 || !$('#section-panel').classList.contains('hidden'));
  labelsDirty = true;
}
$$('.clip-row').forEach((row) => {
  const c = clip[row.dataset.axis];
  row.querySelector('input[type=checkbox]').addEventListener('change', (e) => { c.on = e.target.checked; updateClipping(); });
  row.querySelector('input[type=range]').addEventListener('input', () => {
    if (!c.on) { c.on = true; row.querySelector('input[type=checkbox]').checked = true; }
    updateClipping();
  });
  row.querySelector('button').addEventListener('click', () => { c.flip = !c.flip; updateClipping(); });
});

// ---------------------------------------------------------------------------
// Loading
async function init() {
  let i18n = {};
  try { i18n = await (await fetch('assets/names-i18n.json')).json(); } catch { /* names fall back to English */ }
  const { root, parts } = await loadModel({
    i18n,
    onProgress: (f) => { $('#loading-bar').style.width = `${Math.round(f * 100)}%`; }
  });
  scene.add(root);
  state.parts = parts;
  for (const p of parts) {
    p.hidden = false;
    p.group = groupOf(p);
    state.byId.set(p.id, p);
    p.explodeDir = new THREE.Vector3().subVectors(p.center, BODY_CENTER);
    p.explodeDir.y *= 0.6;
    p.searchText = normalize(`${p.ar} ${p.en}`);
  }
  const LOBE_COLORS = { 'frontal lobe': 0xf2a3a3, 'parietal lobe': 0x9fc2ef, 'temporal lobe': 0xa9dc96, 'occipital lobe': 0xf3d38f,
    'limbic lobe': 0xd2a8f0, insula: 0xf0b8dc, cerebellum: 0xd98c8c, brainstem: 0xe0a07a, diencephalon: 0xe7c3a0 };
  for (const p of parts) {
    if (p.system === 'nervous' && LOBE_COLORS[p.group] && !/nerve|artery|vein/.test(p.en.toLowerCase())) {
      p.mesh.material.color.setHex(LOBE_COLORS[p.group]);
      p.baseColor = p.mesh.material.color.clone();
    }
  }
  setupAnimationSets();
  applyLanguage();
  applyAll();
  setView('front', false);
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 600);
  licensing.init(onLicenseChange);
}

const ORGAN_GROUPS = new Set(['frontal lobe', 'parietal lobe', 'temporal lobe', 'occipital lobe', 'limbic lobe', 'insula', 'cerebellum',
  'brainstem', 'diencephalon', 'heart', 'liver', 'skull', 'vertebral column', 'rib cage', 'small intestine', 'large intestine',
  'stomach', 'pancreas', 'larynx', 'mouth', 'nose', 'eye', 'lung']);
function groupOf(p) {
  const en = p.en.toLowerCase();
  if (p.system === 'lymphatic' && /lymph|duct/.test(en)) return 'lymph';
  if (/tooth/.test(en)) return 'teeth';
  if (p.system === 'respiratory' && /bronch|lung/.test(en)) return 'lung';
  if (p.grp && ORGAN_GROUPS.has(p.grp)) return p.grp;
  if (p.system === 'nervous' && /gyrus|lobe|brain|cerebr|thalam|nucleus|ventricle|callosum|fornix|capsule|pons|medulla|midbrain|colliculus|hypothal|pituitar/.test(en)) return 'brain';
  if (/heart|atri|ventric|valve|cusp|leaflet|papillary|coronary|cardiac/.test(en) && p.system === 'circulatory') return 'heart';
  const c = p.center;
  if (c.y > 1.43) return 'head';
  if (Math.abs(c.x) > 0.17 && c.y > 0.55) return 'upper limb';
  if (c.y > 1.36) return Math.abs(c.x) > 0.11 ? 'upper limb' : 'neck';
  if (c.y < 0.82) return 'lower limb';
  if (c.y > 1.12) return 'thorax';
  if (c.y > 0.93) return 'abdomen';
  return 'pelvis';
}

// ---------------------------------------------------------------------------
// Camera
let camAnim = null;
function animateCamera(toPos, toTarget, ms = 650) {
  camAnim = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget, t0: performance.now(), ms };
}
const VIEWS = { front: [0, 0.2, 1], back: [0, 0.2, -1], left: [1, 0.15, 0], right: [-1, 0.15, 0], top: [0, 1, 0.02] };
function setView(name, animate = true) {
  const target = new THREE.Vector3(0, 0.84, 0);
  const pos = new THREE.Vector3(...VIEWS[name]).normalize().multiplyScalar(name === 'top' ? 2.3 : 3.2).add(target);
  if (animate) animateCamera(pos, target);
  else { camera.position.copy(pos); controls.target.copy(target); controls.update(); }
}
function focusParts(list, minDist = 0.12) {
  if (!list.length) return;
  const box = new THREE.Box3();
  for (const p of list) box.union(p.mesh.geometry.boundingBox.clone().translate(p.mesh.position));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = Math.max(minDist, sphere.radius * 2.8);
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  animateCamera(sphere.center.clone().addScaledVector(dir, dist), sphere.center.clone());
}
const focusPart = (p) => focusParts([p]);

// ---------------------------------------------------------------------------
// Systems panel
function buildSystemsUI() {
  const wrap = $('#systems');
  wrap.innerHTML = '';
  for (const s of SYSTEMS) {
    const st = state.systems[s.id];
    const count = state.parts.filter((p) => p.system === s.id).length;
    const row = document.createElement('div');
    row.className = 'system';
    row.innerHTML = `<input type="checkbox" ${st.visible ? 'checked' : ''}>
      <span class="dot" style="background:${s.color}"></span>
      <span class="name">${sysName(s.id)} <span class="muted">${count}</span></span>
      <input type="range" min="0" max="100" value="${Math.round(st.opacity * 100)}">`;
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
    if (!st.ui) continue;
    st.ui.cb.checked = st.visible;
    st.ui.range.value = Math.round(st.opacity * 100);
  }
}
const PRESETS = {
  all: () => SYSTEMS.forEach((s) => Object.assign(state.systems[s.id], { visible: true, opacity: s.opacity })),
  organs: () => SYSTEMS.forEach((s) => Object.assign(state.systems[s.id], {
    visible: s.id !== 'muscular', opacity: s.id === 'skin' ? 0.1 : s.id === 'skeletal' ? 0.3 : 1
  })),
  skeleton: () => SYSTEMS.forEach((s) => Object.assign(state.systems[s.id], {
    visible: ['skeletal', 'skin'].includes(s.id), opacity: s.id === 'skin' ? 0.1 : 1
  }))
};
function showOnlySystems(ids) {
  for (const s of SYSTEMS) Object.assign(state.systems[s.id], { visible: ids.includes(s.id) || s.id === 'skin', opacity: s.id === 'skin' ? 0.08 : 1 });
  syncSystemsUI();
}

// ---------------------------------------------------------------------------
// Structures tree (lazy: item rows are only created when a group is opened)
const treeItems = new Map();
function buildTree() {
  const tree = $('#tree');
  tree.innerHTML = '';
  treeItems.clear();
  const coll = new Intl.Collator(lang);
  for (const s of SYSTEMS) {
    const list = state.parts.filter((p) => p.system === s.id);
    if (!list.length) continue;
    const d = document.createElement('details');
    d.dataset.sys = s.id;
    d.innerHTML = `<summary><span style="color:${s.color}">●</span> ${sysName(s.id)} <span class="muted">(${list.length})</span></summary>`;
    const byGroup = new Map();
    for (const p of list) { if (!byGroup.has(p.group)) byGroup.set(p.group, []); byGroup.get(p.group).push(p); }
    const groups = [...byGroup.keys()].sort((a, b) => coll.compare(groupName(a), groupName(b)));
    for (const g of groups) {
      const items = byGroup.get(g).sort((a, b) => coll.compare(pname(a), pname(b)));
      const gd = document.createElement('details');
      gd.className = 'sub';
      gd.dataset.group = g;
      gd.innerHTML = `<summary>${groupName(g)} <span class="muted">(${items.length})</span>
        <button class="eye grp" title="">👁</button></summary>`;
      gd.querySelector('.grp').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const anyVisible = items.some((p) => !p.hidden);
        state.undo.push(items.map((p) => [p, p.hidden]));
        items.forEach((p) => (p.hidden = anyVisible));
        applyAll();
      });
      gd.addEventListener('toggle', () => {
        if (!gd.open || gd.dataset.filled) return;
        gd.dataset.filled = '1';
        const frag = document.createDocumentFragment();
        for (const p of items) {
          const it = document.createElement('div');
          it.className = 'item';
          it.innerHTML = `<button class="eye">👁</button><span title="${altName(p)}">${pname(p)}</span>`;
          it.querySelector('.eye').addEventListener('click', (e) => { e.stopPropagation(); setHidden(p, !p.hidden); });
          it.addEventListener('click', () => { select(p); focusPart(p); });
          treeItems.set(p, it);
          frag.appendChild(it);
        }
        gd.appendChild(frag);
        refreshTree();
      });
      d.appendChild(gd);
    }
    tree.appendChild(d);
  }
  $('#part-count').textContent = t('partsCount', { n: state.parts.length });
  refreshTree();
}
function refreshTree() {
  for (const [p, it] of treeItems) {
    it.classList.toggle('selected', state.selected === p);
    it.classList.toggle('off', p.hidden);
    it.querySelector('.eye').textContent = p.hidden ? '◌' : '👁';
  }
}
function revealInTree(p) {
  const d = $(`#tree details[data-sys="${p.system}"]`);
  if (!d) return;
  d.open = true;
  const gd = [...d.querySelectorAll('details.sub')].find((x) => x.dataset.group === p.group);
  if (!gd) return;
  if (!gd.open) { gd.open = true; gd.dispatchEvent(new Event('toggle')); }
  const it = treeItems.get(p);
  if (it) it.scrollIntoView({ block: 'nearest' });
}

function setHidden(part, hidden, record = true) {
  if (record) state.undo.push([[part, part.hidden]]);
  part.hidden = hidden;
  if (hidden && state.selected === part) select(null);
  applyAll();
}

// ---------------------------------------------------------------------------
// Selection + info
function select(part) {
  const prev = state.selected;
  state.selected = part;
  if (prev) applyPart(prev);
  if (part) {
    if (part.hidden) part.hidden = false;
    if (!state.systems[part.system].visible) { state.systems[part.system].visible = true; syncSystemsUI(); applyAll(); }
    applyPart(part);
    showInfo(part);
    if (!state.quiz && !state.tour) openSide('#info-panel');
    revealInTree(part);
    if ($('#auto-speak').checked) speak(pname(part));
  } else {
    $('#info-panel').classList.add('hidden');
  }
  refreshTree();
}
function showInfo(part) {
  const sys = state.systems[part.system];
  $('#info-system').textContent = sysName(part.system);
  $('#info-system').style.background = sys.color + '33';
  $('#info-system').style.color = sys.color;
  $('#info-group').textContent = groupName(part.group);
  $('#info-name').textContent = pname(part);
  $('#info-alt').textContent = altName(part);
  $('#info-alt').dir = lang === 'ar' ? 'ltr' : 'rtl';
  $('#info-desc').textContent = pdesc(part);
}
function openSide(sel) {
  for (const s of ['#info-panel', '#quiz-panel', '#tours-panel']) $(s).classList.toggle('hidden', s !== sel);
}
$('#info-close').addEventListener('click', () => select(null));
$('#btn-focus').addEventListener('click', () => state.selected && focusPart(state.selected));
$('#btn-hide').addEventListener('click', () => state.selected && setHidden(state.selected, true));
$('#btn-isolate').addEventListener('click', () => state.selected && isolate(state.selected));
$('#btn-speak').addEventListener('click', () => state.selected && speak(`${pname(state.selected)}. ${pdesc(state.selected)}`));
$('#auto-speak').checked = store.get('autoSpeak', false);
$('#auto-speak').addEventListener('change', (e) => store.set('autoSpeak', e.target.checked));

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
// Speech
function voiceFor(l) {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith(l)) || null;
}
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = voiceFor(lang);
  u.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  if (v) u.voice = v;
  u.rate = lang === 'ar' ? 0.95 : 1;
  const note = $('#voice-note');
  note.textContent = t('voiceMissing');
  note.classList.toggle('hidden', !!v || speechSynthesis.getVoices().length === 0);
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();

// ---------------------------------------------------------------------------
// GPU picking: render object ids into a 1x1 target around the cursor.
const pickTarget = new THREE.WebGLRenderTarget(1, 1);
const pickMats = new Map();
const pickBuf = new Uint8Array(4);
const hiddenDuringPick = [floor, grid];
function idMaterial(p, idx) {
  let mat = pickMats.get(p);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    mat.clippingPlanes = activePlanes.length ? activePlanes : null;
    pickMats.set(p, mat);
  }
  mat.color.setRGB((idx & 255) / 255, ((idx >> 8) & 255) / 255, ((idx >> 16) & 255) / 255, THREE.LinearSRGBColorSpace);
  return mat;
}
function renderIds(target, includeFaint, viewOffset) {
  const ids = [null];
  const swapped = [];
  for (const p of state.parts) {
    const m = p.mesh;
    if (!m.visible) continue;
    if (!includeFaint && effectiveOpacity(p) < 0.45) { m.visible = false; swapped.push([m, null]); continue; }
    ids.push(p);
    swapped.push([m, m.material]);
    m.material = idMaterial(p, ids.length - 1);
  }
  const bg = scene.background, tm = renderer.toneMapping;
  scene.background = new THREE.Color(0, 0, 0);
  hiddenDuringPick.forEach((o) => (o.visible = false));
  renderer.toneMapping = THREE.NoToneMapping;
  if (viewOffset) camera.setViewOffset(...viewOffset);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  if (viewOffset) camera.clearViewOffset();
  renderer.toneMapping = tm;
  scene.background = bg;
  hiddenDuringPick.forEach((o) => (o.visible = true));
  for (const [m, mat] of swapped) { if (mat) m.material = mat; else m.visible = true; }
  return ids;
}
function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = Math.round(clientX - rect.left), y = Math.round(clientY - rect.top);
  const off = [rect.width, rect.height, x, y, 1, 1];
  for (const faint of [false, true]) {
    const ids = renderIds(pickTarget, faint, off);
    renderer.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pickBuf);
    const id = pickBuf[0] + (pickBuf[1] << 8) + (pickBuf[2] << 16);
    if (id && ids[id]) return ids[id];
  }
  return null;
}

let hoverPending = null, lastHover = 0;
renderer.domElement.addEventListener('pointermove', (e) => { hoverPending = e; });
renderer.domElement.addEventListener('pointerleave', () => { hoverPending = null; setHover(null); });
function processHover(now) {
  if (!hoverPending || now - lastHover < 60) return;
  lastHover = now;
  const e = hoverPending;
  hoverPending = null;
  if (e.buttons) { setHover(null); return; }
  setHover(pick(e.clientX, e.clientY), e);
}
function setHover(p, e) {
  const tip = $('#tooltip');
  if (state.hovered !== p) {
    const prev = state.hovered;
    state.hovered = p;
    if (prev) applyPart(prev);
    if (p) applyPart(p);
  }
  const hideName = state.quiz && state.quiz.target === p;
  if (p && e && !hideName && !(state.quiz && state.quiz.mode === 'find' && !state.quiz.answered)) {
    tip.innerHTML = `${pname(p)}<div class="alt">${altName(p)}</div>`;
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
    tip.classList.remove('hidden');
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tip.classList.add('hidden');
    renderer.domElement.style.cursor = p ? 'pointer' : '';
  }
}
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || e.button !== 0) return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const p = pick(e.clientX, e.clientY);
  if (state.quiz) { if (state.quiz.mode === 'find' && p) answerFind(p); return; }
  if (p && e.altKey) { setHidden(p, true); return; }
  select(p);
});
renderer.domElement.addEventListener('dblclick', (e) => {
  const p = pick(e.clientX, e.clientY);
  if (p && !state.quiz) { select(p); focusPart(p); }
});

// ---------------------------------------------------------------------------
// Search
function normalize(s) {
  return s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/(^|\s)ال/g, '$1');
}
let searchActive = 0;
const searchInput = $('#search');
const results = $('#search-results');
function runSearch() {
  const q = normalize(searchInput.value.trim());
  if (!q) { results.classList.add('hidden'); return; }
  const terms = q.split(/\s+/);
  const found = state.parts.filter((p) => terms.every((w) => p.searchText.includes(w)))
    .sort((a, b) => pname(a).length - pname(b).length).slice(0, 40);
  results.innerHTML = found.length ? '' : `<div class="result muted">${t('noResults')}</div>`;
  searchActive = 0;
  found.forEach((p, i) => {
    const r = document.createElement('div');
    r.className = 'result' + (i === 0 ? ' active' : '');
    r.innerHTML = `<span>${pname(p)}</span><span class="alt">${altName(p)}</span>`;
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
$('#btn-tours').addEventListener('click', () => ($('#tours-panel').classList.contains('hidden') ? openTours() : closeTours()));
$('#btn-shot').addEventListener('click', screenshot);
$('#btn-help').addEventListener('click', () => openModal('#help'));
$('#btn-about').addEventListener('click', () => openModal('#about'));
$('#btn-license').addEventListener('click', () => openModal('#license'));
$('#btn-section').addEventListener('click', () => { $('#section-panel').classList.toggle('hidden'); updateClipping(); });
$('#btn-heart').addEventListener('click', () => toggleAnim('heartbeat'));
$('#btn-breath').addEventListener('click', () => toggleAnim('breathing'));
$('#btn-lang').addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set('lang', lang); applyLanguage(); });
$('#explode').addEventListener('input', (e) => setExplode(e.target.value / 100));
$$('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m && !m.dataset.locked) m.classList.add('hidden'); });
  m.querySelector('.modal-close')?.addEventListener('click', () => { if (!m.dataset.locked) m.classList.add('hidden'); });
});
const openModal = (sel) => $(sel).classList.remove('hidden');

function toggleXray() { state.xray = !state.xray; $('#btn-xray').classList.toggle('active', state.xray); applyAll(); }
function toggleRotate() { controls.autoRotate = !controls.autoRotate; $('#btn-rotate').classList.toggle('active', controls.autoRotate); }
function toggleLabels() {
  state.labels = !state.labels;
  $('#btn-labels').classList.toggle('active', state.labels);
  if (!state.labels) $('#labels').innerHTML = '';
  labelsDirty = true;
}
function setExplode(k) {
  state.explode = k;
  $('#explode').value = Math.round(k * 100);
  labelsDirty = true;
}
function resetAll() {
  if (state.quiz) endQuiz();
  if (state.tour) closeTours();
  PRESETS.all();
  state.parts.forEach((p) => (p.hidden = false));
  state.xray = false;
  $('#btn-xray').classList.remove('active');
  for (const c of Object.values(clip)) c.on = false;
  $$('.clip-row input[type=checkbox]').forEach((c) => (c.checked = false));
  updateClipping();
  setExplode(0);
  select(null);
  syncSystemsUI();
  applyAll();
  setView('front');
}
function screenshot() {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.download = `anatomy-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
}

// ---------------------------------------------------------------------------
// Heartbeat & breathing animation (applied as transforms about a pivot)
const anim = { heart: [], heartPivot: new THREE.Vector3(), lung: [], lungPivot: new THREE.Vector3(), diaphragm: [] };
function setupAnimationSets() {
  anim.heart = state.parts.filter((p) => p.group === 'heart' && p.system === 'circulatory');
  anim.lung = state.parts.filter((p) => p.group === 'lung');
  anim.diaphragm = state.parts.filter((p) => /^diaphragm$/i.test(p.en));
  const c = (list) => list.reduce((s, p) => s.add(p.center), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, list.length));
  anim.heartPivot = c(anim.heart);
  anim.lungPivot = c(anim.lung);
  anim.lungPivot.y += 0.06; // lungs expand mostly downward
}
function toggleAnim(which) {
  state[which] = !state[which];
  $(which === 'heartbeat' ? '#btn-heart' : '#btn-breath').classList.toggle('active', state[which]);
}
const tmpS = new THREE.Vector3();
function updateTransforms(time) {
  const beat = state.heartbeat ? heartCurve((time / 1000) * (72 / 60)) : 0;
  const breath = state.breathing ? (1 - Math.cos((time / 1000) * Math.PI * 2 * (14 / 60))) / 2 : 0;
  for (const p of state.parts) {
    let s = 1, sy = 1, dy = 0, pivot = null;
    if (beat && anim.heartSet?.has(p)) { s = 1 - 0.06 * beat; sy = s; pivot = anim.heartPivot; }
    else if (breath && anim.lungSet?.has(p)) { s = 1 + 0.05 * breath; sy = 1 + 0.08 * breath; pivot = anim.lungPivot; }
    else if (breath && anim.diaSet?.has(p)) { dy = -0.018 * breath; }
    const m = p.mesh;
    tmpS.copy(p.explodeDir).multiplyScalar(state.explode * 1.4);
    if (p.system === 'skin') tmpS.set(0, 0, 0);
    m.scale.set(s, sy, s);
    if (pivot) tmpS.add(new THREE.Vector3(pivot.x * (1 - s), pivot.y * (1 - sy), pivot.z * (1 - s)));
    tmpS.y += dy;
    m.position.copy(tmpS);
  }
}
function heartCurve(phase) {
  const f = phase % 1;
  // atrial kick then ventricular systole
  return Math.max(0, Math.sin(Math.min(1, f / 0.35) * Math.PI)) * (f < 0.35 ? 1 : 0) * 0.9 + (f < 0.12 ? 0.25 * Math.sin((f / 0.12) * Math.PI) : 0);
}

// ---------------------------------------------------------------------------
// Quiz
function quizPool() {
  return state.parts.filter((p) => p.system !== 'skin' && p.mesh.visible && effectiveOpacity(p) >= 0.45 && p.radius > 0.02
    && !/branch|tributary|set of|part of|segment|division|region|zone/i.test(p.en));
}
function startQuiz() {
  if (state.tour) closeTours();
  state.quiz = { mode: state.quiz?.mode || 'name', score: 0, total: 0, target: null, answered: false };
  select(null);
  openSide('#quiz-panel');
  $('#btn-quiz').classList.add('active');
  nextQuestion();
}
function endQuiz() {
  const t0 = state.quiz && state.quiz.target;
  state.quiz = null;
  if (t0) applyAll();
  $('#quiz-panel').classList.add('hidden');
  $('#btn-quiz').classList.remove('active');
}
$$('[data-qmode]').forEach((b) => b.addEventListener('click', () => { if (!state.quiz) return; state.quiz.mode = b.dataset.qmode; nextQuestion(); }));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const baseName = (p) => pname(p).replace(/\s+(الأيسر|الأيمن|اليسرى|اليمنى)$/, '').replace(/^(left|right) /i, '').replace(/ \((left|right)\)$/i, '');
function nextQuestion() {
  const q = state.quiz;
  const prev = q.target;
  q.target = null; // clear first so the ghosting of the previous question does not shrink the pool
  const pool = quizPool();
  if (pool.length < 4) { renderQuiz(true); return; }
  let target;
  do { target = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && target === prev);
  q.target = target;
  q.answered = false;
  q.revealed = false;
  q.feedback = '';
  applyAll();
  if (q.mode === 'name') focusParts([target], 0.35);
  const correct = baseName(target);
  const same = shuffle(state.parts.filter((p) => p.system === target.system && p.group === target.group && baseName(p) !== correct).map(baseName));
  const other = shuffle(state.parts.filter((p) => p.system === target.system && baseName(p) !== correct).map(baseName));
  const opts = new Set([correct]);
  for (const n of [...same, ...other]) { if (opts.size >= 4) break; opts.add(n); }
  q.options = shuffle([...opts]);
  q.correct = correct;
  renderQuiz();
}
function renderQuiz(empty = false) {
  const q = state.quiz;
  $$('[data-qmode]').forEach((b) => b.classList.toggle('active', b.dataset.qmode === q.mode));
  $('#quiz-score').textContent = t('score', { s: q.score, t: q.total });
  const box = $('#quiz-options');
  box.innerHTML = '';
  if (empty || !q.target) { $('#quiz-prompt').textContent = t('needMore'); return; }
  $('#quiz-feedback').innerHTML = q.feedback || '';
  if (q.mode === 'find') {
    $('#quiz-prompt').innerHTML = t('quizFind', { name: `<b>${pname(q.target)}</b>` });
    return;
  }
  $('#quiz-prompt').textContent = t('quizName');
  for (const n of q.options) {
    const b = document.createElement('button');
    b.textContent = n;
    if (q.answered && n === q.correct) b.classList.add('correct');
    if (q.answered && n === q.picked && n !== q.correct) b.classList.add('wrong');
    b.addEventListener('click', () => {
      if (q.answered) return;
      q.answered = true;
      q.total++;
      q.picked = n;
      const ok = n === q.correct;
      if (ok) q.score++;
      q.feedback = ok ? t('correct') : t('wrong', { name: `<b>${pname(q.target)}</b>` });
      renderQuiz();
    });
    box.appendChild(b);
  }
}
function answerFind(p) {
  const q = state.quiz;
  if (q.answered || !q.target) return;
  q.answered = true;
  q.total++;
  const ok = p === q.target || baseName(p) === baseName(q.target);
  if (ok) q.score++;
  q.revealed = true;
  applyAll();
  if (!ok) focusParts([q.target], 0.35);
  q.feedback = ok ? t('correct') : t('wrongFind', { got: `<b>${pname(p)}</b>` });
  renderQuiz();
}
$('#quiz-next').addEventListener('click', () => state.quiz && nextQuestion());
$('#quiz-close').addEventListener('click', endQuiz);

// ---------------------------------------------------------------------------
// Lessons (guided tours)
function openTours() {
  if (state.quiz) endQuiz();
  openSide('#tours-panel');
  $('#btn-tours').classList.add('active');
  renderTourList();
}
function closeTours() {
  if (state.tour) { state.tour = null; applyAll(); }
  $('#tours-panel').classList.add('hidden');
  $('#tour-run').classList.add('hidden');
  $('#tour-list').classList.remove('hidden');
  $('#btn-tours').classList.remove('active');
}
function renderTourList() {
  const list = $('#tour-list');
  list.innerHTML = '';
  for (const tour of TOURS) {
    const b = document.createElement('button');
    b.className = 'tour-item';
    b.innerHTML = `<b>${lang === 'ar' ? tour.ar : tour.en}</b><span class="muted">${tour.steps.length}</span>`;
    b.addEventListener('click', () => startTour(tour));
    list.appendChild(b);
  }
}
function startTour(tour) {
  select(null);
  state.parts.forEach((p) => (p.hidden = false));
  showOnlySystems(tour.systems);
  applyAll();
  state.tour = { tour, i: 0, highlight: new Set() };
  $('#tour-list').classList.add('hidden');
  $('#tour-run').classList.remove('hidden');
  gotoStep(0);
}
function gotoStep(i) {
  const st = state.tour;
  st.i = Math.max(0, Math.min(st.tour.steps.length - 1, i));
  const step = st.tour.steps[st.i];
  const matches = state.parts.filter((p) => (step.group ? p.group === step.group : step.match.test(p.en)));
  st.highlight = new Set(matches);
  matches.forEach((p) => { p.hidden = false; if (!state.systems[p.system].visible) state.systems[p.system].visible = true; });
  syncSystemsUI();
  applyAll();
  const vis = matches.filter((p) => state.systems[p.system].visible);
  focusParts(vis.length ? vis : matches);
  renderTour();
}
function renderTour() {
  const st = state.tour;
  const step = st.tour.steps[st.i];
  $('#tour-title').textContent = lang === 'ar' ? st.tour.ar : st.tour.en;
  $('#tour-step').textContent = t('step', { i: st.i + 1, n: st.tour.steps.length });
  $('#tour-text').textContent = lang === 'ar' ? step.ar : step.en;
  $('#tour-next').textContent = st.i === st.tour.steps.length - 1 ? t('finish') : t('next');
}
$('#tour-prev').addEventListener('click', () => state.tour && gotoStep(state.tour.i - 1));
$('#tour-next').addEventListener('click', () => {
  if (!state.tour) return;
  if (state.tour.i === state.tour.tour.steps.length - 1) { closeTours(); openTours(); } else gotoStep(state.tour.i + 1);
});
$('#tour-speak').addEventListener('click', () => state.tour && speak($('#tour-text').textContent));
$('#tours-close').addEventListener('click', closeTours);

// ---------------------------------------------------------------------------
// On-screen labels from an id-buffer pass (only unoccluded structures get labels)
const LABEL_W = 320;
const labelTarget = new THREE.WebGLRenderTarget(LABEL_W, 200);
let labelsDirty = true, lastLabelUpdate = 0;
function updateLabels() {
  const W = LABEL_W, H = Math.max(1, Math.round(LABEL_W / (window.innerWidth / window.innerHeight)));
  if (labelTarget.height !== H) labelTarget.setSize(W, H);
  const ids = renderIds(labelTarget, false, null);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(labelTarget, 0, 0, W, H, buf);
  const acc = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    const id = buf[o] + (buf[o + 1] << 8) + (buf[o + 2] << 16);
    if (!id) continue;
    let a = acc.get(id);
    if (!a) { a = { n: 0, sx: 0, sy: 0, px: [] }; acc.set(id, a); }
    a.n++; a.sx += x; a.sy += y;
    if ((a.n & 7) === 1) a.px.push(x, y);
  }
  const entries = [];
  for (const [id, a] of acc) {
    const p = ids[id];
    if (!p || a.n < 14 || p.system === 'skin') continue;
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
    const text = pname(e.p);
    const w = text.length * 6.3 + 14, h = 18;
    const box = [e.x - w / 2, e.y - h / 2, e.x + w / 2, e.y + h / 2];
    if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placed.push(box);
    const el = document.createElement('div');
    el.className = 'label';
    el.textContent = text;
    el.style.left = e.x + 'px';
    el.style.top = e.y + 'px';
    el.style.borderColor = state.systems[e.p.system].color + '88';
    layer.appendChild(el);
    if (placed.length >= 40) break;
  }
}

// ---------------------------------------------------------------------------
// Licensing UI
let licState = null;
function onLicenseChange(s) {
  licState = s;
  updateLicenseUI();
  const locked = s && s.enabled && !s.allowed;
  const m = $('#license');
  if (locked) { m.dataset.locked = '1'; m.classList.remove('hidden'); } else { delete m.dataset.locked; }
  $('#license-close').classList.toggle('hidden', !!locked);
}
function updateLicenseUI() {
  const s = licState;
  const btn = $('#btn-license');
  if (!s || !s.enabled) { btn.classList.add('hidden'); return; }
  btn.classList.remove('hidden');
  const st = $('#lic-status');
  if (s.active) st.textContent = t('licActive');
  else if (s.allowed) st.textContent = t('licTrial', { d: s.trialDaysLeft });
  else st.textContent = t('licExpired');
  $('#lic-deactivate').classList.toggle('hidden', !s.active);
}
$('#lic-activate').addEventListener('click', async () => {
  const keyVal = $('#lic-key').value.trim();
  if (!keyVal) return;
  $('#lic-msg').textContent = t('licChecking');
  const r = await licensing.activate(keyVal);
  $('#lic-msg').textContent = r.ok ? '' : `${t('licInvalid')} ${r.error || ''}`;
});
$('#lic-buy').addEventListener('click', () => licensing.openStore());
$('#lic-deactivate').addEventListener('click', () => licensing.deactivate());

// ---------------------------------------------------------------------------
// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.target === searchInput || e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if ($('#license').dataset.locked) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); searchInput.focus(); searchInput.select(); return; }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '5') setView(['front', 'back', 'left', 'right', 'top'][+k - 1]);
  else if (k === 'r') resetAll();
  else if (k === 'a') showAll();
  else if (k === 'x') toggleXray();
  else if (k === 'l') toggleLabels();
  else if (k === 'c') $('#btn-section').click();
  else if (k === 'b') toggleAnim('heartbeat');
  else if (k === 'n') toggleAnim('breathing');
  else if (k === 'q') (state.quiz ? endQuiz() : startQuiz());
  else if (k === 't') $('#btn-tours').click();
  else if (k === 'p') screenshot();
  else if (k === 'h' || k === '?') $('#help').classList.toggle('hidden');
  else if (k === ' ') { e.preventDefault(); toggleRotate(); }
  else if (k === 'escape') { $$('.modal:not([data-locked])').forEach((m) => m.classList.add('hidden')); if (state.quiz) endQuiz(); else if (state.tour) closeTours(); else select(null); }
  else if ((k === 'delete' || k === 'backspace') && state.selected) setHidden(state.selected, true);
  else if (k === 'i' && state.selected) isolate(state.selected);
  else if (k === 'f' && state.selected) focusPart(state.selected);
  else if (k === 's' && state.selected) speak(pname(state.selected));
});

// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelsDirty = true;
});
controls.addEventListener('change', () => { labelsDirty = true; });

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function loop(now) {
  requestAnimationFrame(loop);
  if (camAnim) {
    const x = Math.min(1, (now - camAnim.t0) / camAnim.ms);
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, ease(x));
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, ease(x));
    if (x >= 1) camAnim = null;
    labelsDirty = true;
  }
  controls.update();
  if (state.parts.length) {
    if (!anim.heartSet) { anim.heartSet = new Set(anim.heart); anim.lungSet = new Set(anim.lung); anim.diaSet = new Set(anim.diaphragm); }
    updateTransforms(now);
    if (state.heartbeat || state.breathing) labelsDirty = true;
  }
  processHover(now);
  renderer.render(scene, camera);
  if (state.labels && labelsDirty && now - lastLabelUpdate > 150 && state.parts.length) {
    labelsDirty = false;
    lastLabelUpdate = now;
    updateLabels();
  }
}

applyLanguage();
requestAnimationFrame(loop);
init().catch((err) => {
  console.error(err);
  $('#loading-text').textContent = t('loadError') + err.message;
});

window.__anatomy = { state, select, focusPart, setView, setExplode, toggleXray, toggleLabels, startQuiz, startTour: (i) => { openTours(); startTour(TOURS[i]); }, toggleAnim, camera, controls, clip, updateClipping, setLang: (l) => { lang = l; applyLanguage(); } };
