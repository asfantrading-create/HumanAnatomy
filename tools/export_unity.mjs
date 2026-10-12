// Exports the anatomical model for the Unity application.
//
//   node tools/export_unity.mjs <model-dir> <out-dir>
//
// <model-dir> holds anatomy.bin + anatomy-parts.json produced by
// tools/convert_bp3d.py (use a higher triangle budget for Unity, e.g. 4000000).
// The script runs the same JavaScript pipeline as the desktop application
// (supplements, female body, groups, colours) and writes:
//   <out-dir>/anatomy.idx   manifest (parts, names, descriptions, systems, voice map)
//   <out-dir>/anatomy.dat   quantised male/female vertices, indices and vertex colours
//   <out-dir>/learning.dat  interface strings, lessons and the question bank
// All three are AES-256-CBC encrypted (key shared with AssetCrypto.cs) so the
// commercial data is not readable from the installed program folder.
// Coordinates are converted to Unity's left-handed frame (z flipped, body faces -Z).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const [modelDir, outDir] = process.argv.slice(2);
if (!modelDir || !outDir) { console.error('usage: node tools/export_unity.mjs <model-dir> <out-dir>'); process.exit(1); }

// fetch() polyfill for the browser modules: serves files from disk
globalThis.fetch = async (url) => {
  const name = String(url).replace(/^assets\//, '');
  const file = fs.existsSync(path.join(modelDir, name)) ? path.join(modelDir, name) : path.join(root, 'src', 'assets', name);
  const buf = fs.readFileSync(file);
  return new Response(buf, { headers: { 'content-length': String(buf.length) } });
};

const THREE = await import('three');
const { loadModel, SYSTEMS, makeMaterial } = await import(path.join(root, 'src/js/model.js'));
const { prepareFemale, isMaleOnly } = await import(path.join(root, 'src/js/female.js'));

const i18n = JSON.parse(fs.readFileSync(path.join(root, 'src/assets/names-i18n.json'), 'utf8'));
const voice = JSON.parse(fs.readFileSync(path.join(root, 'src/assets/voice.json'), 'utf8'));
const { parts } = await loadModel({ base: 'assets', i18n });
console.log('parts', parts.length);

// same grouping as the desktop app (src/js/app.js)
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
  if (c.y > 1.51) return 'head';
  if (Math.abs(c.x) > 0.17 && c.y > 0.63) return 'upper limb';
  if (c.y > 1.44) return Math.abs(c.x) > 0.11 ? 'upper limb' : 'neck';
  if (c.y < 0.9) return 'lower limb';
  if (c.y > 1.2) return 'thorax';
  if (c.y > 1.01) return 'abdomen';
  return 'pelvis';
}
function vesselType(en, system) {
  if (system !== 'circulatory') return 0;
  const n = en.toLowerCase();
  if (/wall of|cavity of|atri|ventric|papillary|chordae|valve|cusp|leaflet|septum|fibrous skeleton/.test(n)) return 2;
  if (/vein|venous|vena|sinus/.test(n)) return -1;
  if (/arter|aorta|trunk|arch/.test(n)) return 1;
  return 0;
}
const LOBE_COLORS = { 'frontal lobe': 0xf2a3a3, 'parietal lobe': 0x9fc2ef, 'temporal lobe': 0xa9dc96, 'occipital lobe': 0xf3d38f,
  'limbic lobe': 0xd2a8f0, insula: 0xf0b8dc, cerebellum: 0xd98c8c, brainstem: 0xe0a07a, diencephalon: 0xe7c3a0 };

for (const p of parts) {
  p.maleOnly = isMaleOnly(p);
  p.group = groupOf(p);
  if (/^hair of head$/i.test(p.en)) p.alpha = 4;
  if (p.system === 'nervous' && LOBE_COLORS[p.group] && !/nerve|artery|vein/.test(p.en.toLowerCase())) p.mesh.material.color.setHex(LOBE_COLORS[p.group]);
}
// heart / sinoatrial node positions for the flow animation (male coordinates)
const centerOf = (list) => list.reduce((s, p) => s.add(p.center), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, list.length));
const heartPivot = centerOf(parts.filter((p) => p.group === 'heart' && p.system === 'circulatory'));
const ra = parts.find((p) => /^wall of right atrium$/i.test(p.en));
const sa = ra ? (() => { const b = ra.mesh.geometry.boundingBox; return new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - 0.008, (b.min.z + b.max.z) / 2); })() : heartPivot;

// female body (same algorithm as the desktop app)
const extra = prepareFemale(parts, makeMaterial);
for (const p of extra) {
  const g = p.mesh.geometry;
  p.center = g.boundingSphere.center.clone();
  p.grp = /BREAST/.test(p.id) ? '' : 'pelvis';
  p.alpha = p.id === 'F_HAIR' ? 4 : 1;
  p.group = groupOf(p);
  parts.push(p);
}
console.log('with female parts', parts.length);

// ---------------------------------------------------------------------------
const chunks = [];
let offset = 0;
const push = (typed) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const at = offset;
  const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  chunks.push(Buffer.from(b));
  offset += b.length;
  return at;
};
// positions -> unity frame (z flipped) and quantised to uint16 inside the bounding box
function quantise(arr) {
  const n = arr.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const u = new Float32Array(arr.length);
  for (let i = 0; i < n; i++) {
    u[i * 3] = arr[i * 3]; u[i * 3 + 1] = arr[i * 3 + 1]; u[i * 3 + 2] = -arr[i * 3 + 2];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], u[i * 3 + k]); hi[k] = Math.max(hi[k], u[i * 3 + k]); }
  }
  const q = new Uint16Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const k = i % 3, span = Math.max(hi[k] - lo[k], 1e-6);
    q[i] = Math.round(((u[i] - lo[k]) / span) * 65535);
  }
  return { q, min: lo.map((v) => +v.toFixed(6)), max: hi.map((v) => +v.toFixed(6)) };
}
const toBytes = (c) => { const b = new Uint8Array(c.length); for (let i = 0; i < c.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(c[i] * 255))); return b; };
const sameArray = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-7) return false; return true; };

const outParts = [];
for (const p of parts) {
  const g = p.mesh.geometry;
  if (!p.mesh.isMesh) { console.warn('skipping non-mesh', p.id); continue; }
  const malePos = p.malePos || g.attributes.position.array;
  const femalePos = p.femalePos;
  const nv = malePos.length / 3;
  const idxSrc = g.index ? g.index.array : Uint32Array.from({ length: nv }, (_, i) => i);
  const wide = nv > 65535;
  const idx = wide ? new Uint32Array(idxSrc.length) : new Uint16Array(idxSrc.length);
  for (let i = 0; i < idxSrc.length; i += 3) { idx[i] = idxSrc[i]; idx[i + 1] = idxSrc[i + 2]; idx[i + 2] = idxSrc[i + 1]; } // winding for the flipped axis
  const m = quantise(malePos);
  const rec = {
    id: p.id, en: p.en, ar: p.ar, descEn: p.descEn || '', descAr: p.descAr || '',
    system: p.system, group: p.group, color: '#' + p.mesh.material.color.getHexString(),
    alpha: p.alpha ?? 1, vessel: vesselType(p.en, p.system),
    sex: p.sexOnly === 'f' ? 'f' : p.maleOnly ? 'm' : '',
    anim: p.group === 'lung' ? 'lung' : /^diaphragm$/i.test(p.en) ? 'diaphragm' : (p.group === 'heart' && p.system === 'circulatory') ? 'heart' : '',
    nv, ni: idx.length, wide,
    pos: push(m.q), min: m.min, max: m.max,
    idx: push(idx), fpos: -1, fmin: null, fmax: null, col: -1, fcol: -1
  };
  if (femalePos && !sameArray(femalePos, malePos)) {
    const f = quantise(femalePos);
    rec.fpos = push(f.q); rec.fmin = f.min; rec.fmax = f.max;
  }
  const maleCol = p.maleColor || g.attributes.color?.array;
  if (maleCol && !p.femaleColor) rec.col = push(toBytes(maleCol));
  if (p.femaleColor) { rec.col = push(toBytes(p.maleColor)); rec.fcol = push(toBytes(p.femaleColor)); }
  outParts.push(rec);
}

// ---------------------------------------------------------------------------
const KEY = crypto.createHash('sha256').update('ASFAN|HumanAnatomy3D|unity-assets|v1').digest();
function encrypt(buf) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([Buffer.from('HA3E'), iv, c.update(buf), c.final()]);
}
const write = (name, data) => fs.writeFileSync(path.join(outDir, name), encrypt(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8')));

fs.mkdirSync(outDir, { recursive: true });
for (const old of ['anatomy.bin', 'anatomy.json', 'anatomy.bin.meta', 'anatomy.json.meta']) fs.rmSync(path.join(outDir, old), { force: true });
write('anatomy.dat', Buffer.concat(chunks));
const flip = (v) => [+v.x.toFixed(5), +v.y.toFixed(5), +(-v.z).toFixed(5)];
write('anatomy.idx', JSON.stringify({
  version: 1,
  source: 'BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution 4.0 International',
  systems: SYSTEMS.map((s) => ({ id: s.id, ar: s.ar, en: s.en, color: s.color, opacity: s.opacity })),
  heart: flip(heartPivot), sa: flip(sa),
  voiceKeys: Object.keys(voice), voiceIds: Object.values(voice),
  parts: outParts
}));

// learning data: interface strings, guided lessons (regexes as source/flags) and concept questions
const { STRINGS } = await import(path.join(root, 'src/js/i18n.js'));
const { TOURS } = await import(path.join(root, 'src/js/tours.js'));
const { CONCEPT_QUESTIONS } = await import(path.join(root, 'src/js/questions.js'));
write('learning.dat', JSON.stringify({
  strings: STRINGS,
  tours: TOURS.map((t) => ({
    id: t.id, level: t.level || 'school', sex: t.sex || '', ar: t.ar, en: t.en, systems: t.systems || [],
    steps: t.steps.map((s) => ({ ar: s.ar, en: s.en, group: s.group || '', match: s.match ? s.match.source : '', flags: s.match ? s.match.flags : '' }))
  })),
  questions: CONCEPT_QUESTIONS
}));
const tris = outParts.reduce((s, p) => s + p.ni / 3, 0);
console.log(`wrote ${outParts.length} parts, ${Math.round(tris)} triangles, ${(offset / 1e6).toFixed(1)} MB`);
