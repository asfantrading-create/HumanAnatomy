// Assembles the anatomical model: real BodyParts3D meshes plus a few
// simplified supplements for structures the dataset does not contain.
import * as THREE from 'three';
import { loadParts } from './bp3d.js';
import { buildSupplements } from './supplements.js';

export const SYSTEMS = [
  { id: 'skin', ar: 'الجلد', en: 'Skin', color: '#e8b796', opacity: 0.25 },
  { id: 'skeletal', ar: 'الجهاز الهيكلي', en: 'Skeletal system', color: '#efe6d2', opacity: 1 },
  { id: 'muscular', ar: 'الجهاز العضلي', en: 'Muscular system', color: '#c0443f', opacity: 1 },
  { id: 'nervous', ar: 'الجهاز العصبي', en: 'Nervous system', color: '#f2d24b', opacity: 1 },
  { id: 'circulatory', ar: 'الجهاز الدوري', en: 'Cardiovascular system', color: '#d62828', opacity: 1 },
  { id: 'lymphatic', ar: 'الجهاز اللمفاوي', en: 'Lymphatic system', color: '#5ec27a', opacity: 1 },
  { id: 'respiratory', ar: 'الجهاز التنفسي', en: 'Respiratory system', color: '#e79aa0', opacity: 1 },
  { id: 'digestive', ar: 'الجهاز الهضمي', en: 'Digestive system', color: '#d98c6c', opacity: 1 },
  { id: 'urinary', ar: 'الجهاز البولي', en: 'Urinary system', color: '#b5534a', opacity: 1 },
  { id: 'reproductive', ar: 'الجهاز التناسلي', en: 'Reproductive system', color: '#c77dba', opacity: 1 },
  { id: 'endocrine', ar: 'الغدد الصماء', en: 'Endocrine system', color: '#e09a45', opacity: 1 },
  { id: 'sensory', ar: 'أعضاء الحس', en: 'Sense organs', color: '#8fb8de', opacity: 1 }
];

// Colour by structure type (checked in order against the English name).
const COLOR_RULES = [
  [/diaphragm/, 0xa8423c],
  [/hepatovenous segment|lobe of liver|^liver/, 0x7a2a1f],
  [/skin/, 0xe8b796], [/hair|eyebrow/, 0x4a3a2c],
  [/tooth/, 0xfaf6ea], [/gingiva/, 0xd77a7f], [/tongue|lip\b/, 0xd96b73],
  [/cartilage|meniscus|intervertebral dis|symphysis|disk/, 0xa9c7d8],
  [/ligament|tendon|aponeurosis|retinaculum|membrane|fascia|raphe|linea alba|tendinous ring/, 0xe6dccb],
  [/cavity of (left|right) (atrium|ventricle)/, 0x7a1015],
  [/vein|venous|sinus/, 0x2f5bd3], [/arter|aorta|trunk|arch/, 0xd62828],
  [/valve|cusp|leaflet|chordae/, 0xf0d6c8], [/papillary|wall of|heart|atri|ventric/, 0xa4161a],
  [/nerve|ganglion|plexus|chiasm|optic tract|spinal cord|cauda/, 0xf2d24b],
  [/white matter|internal capsule|corpus callosum|fornix/, 0xf1ece4],
  [/gyrus|lobe|cortex|insula|cuneus|precuneus|pole/, 0xeaaeaa],
  [/cerebell|vermis/, 0xd98c8c], [/pons|medulla|midbrain|thalamus|brain|colliculus|peduncle|hypothal/, 0xe0a07a],
  [/bronch/, 0xf3b6bb], [/upper lobe of right/, 0xe8959d], [/middle lobe/, 0xd98a9e], [/lower lobe of right/, 0xe8a4a0], [/upper lobe of left/, 0xe8959d], [/lower lobe of left/, 0xe8a4a0], [/lung/, 0xe79aa0], [/trachea|larynx|arytenoid|cricoid|epiglott|thyroid cartilage/, 0xc9b6ae],
  [/liver|hepat/, 0x7a2a1f], [/gallbladder|bile|cystic|biliary/, 0x4f7a28],
  [/esophagus|pharyn/, 0xd98277], [/stomach/, 0xe0967a], [/duoden|jejun|ileum|small intestine/, 0xe7a58f], [/colon|cecum|rectum|appendix|anal/, 0xc98a6b],
  [/pancrea/, 0xe8c07d], [/spleen/, 0x6d2e46], [/thymus/, 0xe8a0a0],
  [/kidney/, 0x8f2d2a], [/ureter|urethra/, 0xd2a55a], [/bladder/, 0xd9b27c],
  [/adrenal|pituitary|pineal|thyroid gland/, 0xe09a45],
  [/lens|cornea|vitreous|chamber/, 0xbfe3ff], [/eyeball|sclera|eye/, 0xf4f1ea],
  [/prostate|testis|epididym|seminal|penis|deferent/, 0xc77dba],
  [/muscle|head of|belly|part of|-|us\b|is\b|or\b|ii\b/, 0xb33a3a]
];
const SYSTEM_DEFAULT = {
  skin: 0xe8b796, skeletal: 0xefe6d2, muscular: 0xb33a3a, nervous: 0xf2d24b, circulatory: 0xd62828,
  lymphatic: 0x5ec27a, respiratory: 0xe79aa0, digestive: 0xd98c6c, urinary: 0xb5534a,
  reproductive: 0xc77dba, endocrine: 0xe09a45, sensory: 0xd8d0c4, other: 0xcccccc
};

function colorFor(en, system) {
  if (system === 'skeletal' && !/cartilage|ligament|disk|disc|membrane|meniscus|symphysis/.test(en)) return 0xefe6d2;
  if (system === 'muscular' && /tendon|aponeurosis|retinaculum|fascia/.test(en)) return 0xe6dccb;
  if (system === 'muscular') return 0xb33a3a;
  for (const [re, c] of COLOR_RULES) if (re.test(en)) return c;
  return SYSTEM_DEFAULT[system] ?? 0xcccccc;
}

let fiberTex = null;
function fiberTexture() {
  if (fiberTex) return fiberTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 70 + Math.floor(Math.random() * 120);
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    g.lineWidth = 1 + Math.random();
    const x = Math.random() * 512, y = Math.random() * 512, l = 20 + Math.random() * 60;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.15, y + l); g.stroke();
  }
  fiberTex = new THREE.CanvasTexture(c);
  fiberTex.wrapS = fiberTex.wrapT = THREE.RepeatWrapping;
  return fiberTex;
}

/** 1 while a cross-section plane is active: back faces are then tinted to show cut surfaces. */
export const SECTION = { value: 0 };
/** Shared uniforms of the blood-flow / conduction animation. */
export const FLOW = { on: { value: 0 }, time: { value: 0 }, heart: { value: new THREE.Vector3(0, 1.3, 0) }, sa: { value: new THREE.Vector3(-0.02, 1.36, 0) } };

/** 1 artery, -1 vein, 2 heart, 0 other. */
function vesselType(en, system) {
  if (system !== 'circulatory' || !en) return 0;
  const n = en.toLowerCase();
  if (/wall of|cavity of|atri|ventric|papillary|chordae|valve|cusp|leaflet|septum|fibrous skeleton/.test(n)) return 2;
  if (/vein|venous|vena|sinus/.test(n)) return -1;
  if (/arter|aorta|trunk|arch/.test(n)) return 1;
  return 0;
}

export function makeMaterial(system, color, en = '') {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: system === 'skeletal' ? 0.68 : system === 'skin' ? 0.6 : 0.42,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const muscle = system === 'muscular';
  const vessel = vesselType(en, system);
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nuniform float uSection;' + (muscle ? '\nuniform sampler2D fiberMap;' : '')
        + (vessel ? '\nuniform float uFlow; uniform float uTime; uniform vec3 uHeart; uniform vec3 uSA;' : ''))
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${muscle ? 'float fib = texture2D(fiberMap, vec2(vObjPos.x * 18.0 + vObjPos.z * 18.0, vObjPos.y * 5.0)).r;\n        diffuseColor.rgb *= 0.86 + 0.28 * fib;' : ''}
        // inner (back) faces revealed by cross-sections are tinted darker red
        if (!gl_FrontFacing && uSection > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.12, 0.12), 0.35) * 0.65;`);
    shader.uniforms.uSection = SECTION;
    if (vessel) {
      Object.assign(shader.uniforms, { uFlow: FLOW.on, uTime: FLOW.time, uHeart: FLOW.heart, uSA: FLOW.sa });
      const glow = vessel === 2
        // cardiac conduction: a wave spreading from the sinoatrial node once per heartbeat (72 bpm)
        ? `float ph = fract(uTime * 1.2); float r = ph * 0.13;
           float w = exp(-pow((distance(vObjPos, uSA) - r) / 0.01, 2.0)) * (1.0 - ph);
           totalEmissiveRadiance += vec3(1.0, 0.85, 0.2) * w * 1.6;`
        // pulse waves travel away from the heart in arteries and back towards it in veins
        : `float d = distance(vObjPos, uHeart);
           float s = ${vessel > 0 ? 'd * 9.0 - uTime * 2.4' : 'd * 9.0 + uTime * 1.3'};
           float w = pow(0.5 + 0.5 * sin(s * 6.2831), 8.0);
           totalEmissiveRadiance += ${vessel > 0 ? 'vec3(1.0, 0.25, 0.15)' : 'vec3(0.25, 0.45, 1.0)'} * w * 0.9;`;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uFlow > 0.5) { ${glow} }`);
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    if (muscle) shader.uniforms.fiberMap = { value: fiberTexture() };
  };
  mat.customProgramCacheKey = () => (muscle ? 'muscle' : 'organ') + vessel;
  return mat;
}

export async function loadModel({ base = 'assets', i18n = {}, onProgress = () => {} } = {}) {
  const root = new THREE.Group();
  const groups = {};
  for (const s of SYSTEMS) {
    const g = new THREE.Group();
    g.name = s.id;
    groups[s.id] = g;
    root.add(g);
  }
  const parts = [];
  const add = (part) => {
    const g = part.mesh.geometry;
    part.center = g.boundingSphere.center.clone();
    part.radius = g.boundingSphere.radius;
    part.baseColor = part.mesh.material.color.clone();
    part.mesh.userData.part = part;
    part.mesh.name = part.id;
    (groups[part.system] || groups.skin).add(part.mesh);
    parts.push(part);
  };

  const { parts: raw, source } = await loadParts(base, onProgress);
  for (const { meta, geometry } of raw) {
    let system = meta.system === 'other' ? (/xiphoid/.test(meta.en) ? 'skeletal' : /linea alba/.test(meta.en) ? 'muscular' : 'nervous') : meta.system;
    if (/diaphragm/.test(meta.en)) system = 'respiratory';
    if (/hepatovenous segment|caudate lobe of liver/.test(meta.en)) system = 'digestive';
    const tr = i18n[meta.en] || {};
    const mesh = new THREE.Mesh(geometry, makeMaterial(system, colorFor(meta.en, system), meta.en));
    add({
      id: meta.id, fma: meta.fma, system, mesh,
      en: capitalize(meta.en), ar: tr.ar || capitalize(meta.en),
      descAr: tr.dar || '', descEn: tr.den || '',
      alpha: meta.gen ? 0.6 : 1, generated: !!meta.gen, grp: meta.grp || ''
    });
  }
  for (const p of buildSupplements(parts, makeMaterial)) add(p);
  return { root, parts, groups, source };
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
