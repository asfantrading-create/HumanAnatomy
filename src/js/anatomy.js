// Procedural 3D model of the whole human body.
// Units are metres; +Y up, +Z anterior (front), +X is the body's LEFT side.
import * as THREE from 'three';
import * as S from './sdf.js';
import { tube, ellipsoid, spindle, longBone, merge, dome, wrinkle, V } from './geo.js';

export const SYSTEMS = [
  { id: 'skin', ar: 'الجلد', en: 'Integumentary', color: '#e8b796', opacity: 0.22 },
  { id: 'skeletal', ar: 'الجهاز الهيكلي', en: 'Skeletal', color: '#efe6d2', opacity: 1 },
  { id: 'muscular', ar: 'الجهاز العضلي', en: 'Muscular', color: '#b8403e', opacity: 1 },
  { id: 'nervous', ar: 'الجهاز العصبي', en: 'Nervous', color: '#f2d24b', opacity: 1 },
  { id: 'circulatory', ar: 'الجهاز الدوري', en: 'Circulatory', color: '#d62828', opacity: 1 },
  { id: 'respiratory', ar: 'الجهاز التنفسي', en: 'Respiratory', color: '#e79aa0', opacity: 1 },
  { id: 'digestive', ar: 'الجهاز الهضمي', en: 'Digestive', color: '#d98c6c', opacity: 1 },
  { id: 'urinary', ar: 'الجهاز البولي', en: 'Urinary', color: '#9b3b32', opacity: 1 },
  { id: 'endocrine', ar: 'الغدد الصماء', en: 'Endocrine', color: '#d68c45', opacity: 1 },
  { id: 'sensory', ar: 'أعضاء الحس', en: 'Sensory organs', color: '#8fb8de', opacity: 1 }
];

let _fiberTex = null;
// Procedural striated-muscle texture (fine fibres running along the muscle length).
function fiberTexture() {
  if (_fiberTex || typeof document === 'undefined') return _fiberTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 2) {
    const v = 90 + Math.floor(Math.random() * 90);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, 1 + (Math.random() < 0.3 ? 1 : 0), 64);
  }
  _fiberTex = new THREE.CanvasTexture(c);
  _fiberTex.wrapS = _fiberTex.wrapT = THREE.RepeatWrapping;
  _fiberTex.repeat.set(3, 1);
  return _fiberTex;
}

const C = {
  bone: 0xefe6d2, cartilage: 0xa9c7d8, disc: 0x9fb8c9, muscle: 0xb33a3a, tendon: 0xe6dccb,
  nerve: 0xf2d24b, artery: 0xd62828, vein: 0x2f5bd3, brain: 0xeaaeaa, heart: 0xa4161a,
  lung: 0xe79aa0, trachea: 0xd9b8b0, liver: 0x7a2a1f, stomach: 0xe0967a, small: 0xe7a58f,
  large: 0xc98a6b, kidney: 0x8f2d2a, bladder: 0xd9b27c, gland: 0xd68c45, spleen: 0x6d2e46,
  pancreas: 0xe8c07d, gall: 0x4f7a28, skin: 0xe8b796, teeth: 0xfaf6ea, tongue: 0xd96b73,
  diaphragm: 0xa8423c, ear: 0xe6cfa7
};

// ---------------------------------------------------------------------------
// Spine geometry: vertebral body centre depth (z) as a function of height (y)
const SPINE = [
  [0.93, -0.075], [0.99, -0.047], [1.05, -0.040], [1.10, -0.050], [1.16, -0.066],
  [1.25, -0.080], [1.33, -0.076], [1.40, -0.060], [1.45, -0.046], [1.50, -0.036], [1.57, -0.034]
];
export function spineZ(y) {
  if (y <= SPINE[0][0]) return SPINE[0][1];
  for (let i = 1; i < SPINE.length; i++) {
    if (y <= SPINE[i][0]) {
      const [y0, z0] = SPINE[i - 1], [y1, z1] = SPINE[i];
      const t = (y - y0) / (y1 - y0);
      const u = t * t * (3 - 2 * t);
      return z0 + (z1 - z0) * u;
    }
  }
  return SPINE[SPINE.length - 1][1];
}

const VERTEBRAE = [];
for (let i = 0; i < 7; i++) VERTEBRAE.push({ id: `C${i + 1}`, type: 'C', n: i + 1, y: 1.555 - i * 0.02 });
for (let i = 0; i < 12; i++) VERTEBRAE.push({ id: `T${i + 1}`, type: 'T', n: i + 1, y: 1.412 - i * 0.0255 });
for (let i = 0; i < 5; i++) VERTEBRAE.push({ id: `L${i + 1}`, type: 'L', n: i + 1, y: 1.1 - i * 0.029 });
const vy = (id) => VERTEBRAE.find((v) => v.id === id).y;

// ---------------------------------------------------------------------------
export async function buildAnatomy(onProgress = () => {}) {
  const root = new THREE.Group();
  root.name = 'body';
  const parts = [];
  const groups = {};
  for (const s of SYSTEMS) {
    const g = new THREE.Group();
    g.name = s.id;
    groups[s.id] = g;
    root.add(g);
  }

  const fiber = system => (system === 'muscular' ? fiberTexture() : null);
  function material(system, color, extra = {}) {
    const organ = ['digestive', 'respiratory', 'urinary', 'circulatory', 'endocrine', 'nervous'].includes(system);
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: system === 'skeletal' ? 0.72 : system === 'skin' ? 0.6 : 0.45,
      metalness: 0,
      clearcoat: organ ? 0.45 : system === 'muscular' ? 0.2 : 0,
      clearcoatRoughness: 0.35,
      sheen: system === 'muscular' ? 0.4 : 0,
      sheenColor: new THREE.Color(0xff9a9a),
      bumpMap: fiber(system),
      bumpScale: 1.2,
      side: THREE.FrontSide,
      ...extra
    });
  }

  function add(system, id, ar, en, desc, geo, color, extra) {
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mat = material(system, color, extra);
    if (geo.attributes.color) mat.vertexColors = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = id;
    mesh.castShadow = false;
    const part = { id, ar, en, desc, system, mesh, baseColor: new THREE.Color(color) };
    mesh.userData.part = part;
    part.center = geo.boundingSphere.center.clone();
    part.radius = geo.boundingSphere.radius;
    groups[system].add(mesh);
    parts.push(part);
    return part;
  }

  // Bilateral structure: fn(s) returns geometry for side s (+1 left, -1 right).
  function pair(system, id, ar, en, desc, fn, color, opts = {}) {
    for (const s of [-1, 1]) {
      const left = s > 0;
      const sideAr = opts.fem ? (left ? 'اليسرى' : 'اليمنى') : left ? 'الأيسر' : 'الأيمن';
      add(system, `${id}_${left ? 'L' : 'R'}`, `${ar} ${sideAr}`, `${en} (${left ? 'Left' : 'Right'})`, desc, fn(s), color, opts.extra);
    }
  }

  const P = (s, x, y, z) => [s * x, y, z];

  const steps = [
    ['الجلد', () => buildSkin(add)],
    ['الهيكل العظمي', () => buildSkeleton(add, pair, P)],
    ['العضلات', () => buildMuscles(add, pair, P)],
    ['الجهاز العصبي', () => buildNervous(add, pair, P)],
    ['القلب والأوعية', () => buildCirculatory(add, pair, P)],
    ['الجهاز التنفسي', () => buildRespiratory(add, pair, P)],
    ['الجهاز الهضمي', () => buildDigestive(add, pair, P)],
    ['الجهاز البولي', () => buildUrinary(add, pair, P)],
    ['الغدد الصماء', () => buildEndocrine(add, pair, P)],
    ['أعضاء الحس', () => buildSensory(add, pair, P)]
  ];
  for (let i = 0; i < steps.length; i++) {
    onProgress(i / steps.length, steps[i][0]);
    await new Promise((r) => setTimeout(r, 0));
    steps[i][1]();
  }
  onProgress(1, '');

  return { root, parts, groups };
}

// ---------------------------------------------------------------------------
// SKIN
function buildSkin(add) {
  const side = (s) => {
    const x = (v) => v * s;
    const arm = S.union(0.03,
      S.ellipsoid([x(0.185), 1.405, -0.005], [0.056, 0.07, 0.056]),
      S.cone([x(0.18), 1.42, -0.01], [x(0.235), 1.12, -0.005], 0.05, 0.039),
      S.cone([x(0.235), 1.12, -0.003], [x(0.277), 0.872, 0.018], 0.041, 0.026)
    );
    const hand = S.union(0.012,
      S.ellipsoid([x(0.284), 0.818, 0.022], [0.04, 0.05, 0.016]),
      S.cone([x(0.284 - 0.028), 0.785, 0.022], [x(0.258), 0.712, 0.026], 0.0085, 0.007),
      S.cone([x(0.284 - 0.009), 0.78, 0.022], [x(0.276), 0.692, 0.028], 0.009, 0.0075),
      S.cone([x(0.284 + 0.009), 0.78, 0.022], [x(0.294), 0.688, 0.028], 0.0092, 0.0078),
      S.cone([x(0.284 + 0.027), 0.782, 0.022], [x(0.313), 0.7, 0.027], 0.0088, 0.0074),
      S.cone([x(0.312), 0.835, 0.03], [x(0.338), 0.772, 0.045], 0.012, 0.008)
    );
    const leg = S.union(0.04,
      S.ellipsoid([x(0.075), 0.885, -0.055], [0.08, 0.085, 0.075]),
      S.cone([x(0.095), 0.93, 0.0], [x(0.097), 0.52, 0.0], 0.085, 0.05),
      S.cone([x(0.097), 0.5, -0.005], [x(0.09), 0.1, -0.012], 0.049, 0.029),
      S.ellipsoid([x(0.097), 0.38, -0.028], [0.045, 0.09, 0.045]),
      S.ellipsoid([x(0.1), 0.045, -0.04], [0.03, 0.04, 0.035])
    );
    const foot = S.union(0.02,
      S.ellipsoid([x(0.097), 0.035, 0.055], [0.043, 0.035, 0.122]),
      S.cone([x(0.09), 0.09, -0.012], [x(0.095), 0.04, 0.02], 0.03, 0.035)
    );
    return S.union(0.03, S.union(0.02, arm, hand), S.union(0.03, leg, foot));
  };
  const torso = S.union(0.05,
    S.ellipsoid([0, 1.655, 0.0], [0.08, 0.105, 0.102]),
    S.ellipsoid([0, 1.578, 0.032], [0.058, 0.05, 0.068]),
    S.cone([0, 1.56, -0.01], [0, 1.42, -0.006], 0.053, 0.06),
    S.cone([-0.17, 1.43, -0.012], [0.17, 1.43, -0.012], 0.052),
    S.ellipsoid([0, 1.3, 0.0], [0.158, 0.155, 0.112]),
    S.ellipsoid([0.08, 1.315, 0.065], [0.07, 0.05, 0.05]),
    S.ellipsoid([-0.08, 1.315, 0.065], [0.07, 0.05, 0.05]),
    S.ellipsoid([0, 1.1, 0.008], [0.138, 0.15, 0.108]),
    S.ellipsoid([0, 0.94, -0.005], [0.162, 0.1, 0.112])
  );
  const face = S.union(0.01,
    S.ellipsoid([0, 1.625, 0.1], [0.012, 0.024, 0.02], [0.35, 0, 0]),
    S.ellipsoid([0.082, 1.64, -0.005], [0.01, 0.028, 0.018]),
    S.ellipsoid([-0.082, 1.64, -0.005], [0.01, 0.028, 0.018])
  );
  const body = S.union(0.012, S.union(0.035, torso, side(1), side(-1)), face);
  const geo = S.sdfGeometry(body, [-0.36, -0.005, -0.17], [0.36, 1.765, 0.19], 0.0085);
  add('skin', 'skin', 'الجلد (سطح الجسم)', 'Skin', 'الجلد هو أكبر عضو في جسم الإنسان، يغطي مساحة نحو 2 متر مربع ويزن قرابة 4 كغ. يتكون من ثلاث طبقات: البشرة والأدمة وتحت الجلد. يحمي الجسم من الجراثيم والأشعة فوق البنفسجية، وينظم الحرارة عبر التعرق، ويحتوي على مستقبلات اللمس والألم والحرارة، ويصنع فيتامين د.', geo, C.skin, { roughness: 0.65 });
}

// ---------------------------------------------------------------------------
// SKELETON
function buildSkeleton(add, pair, P) {
  // Skull (cranium + facial bones)
  const skullSide = (s) => S.union(0.008,
    S.cone([s * 0.046, 1.617, 0.062], [s * 0.067, 1.619, 0.008], 0.0065, 0.005),
    S.ellipsoid([s * 0.044, 1.618, 0.064], [0.014, 0.012, 0.009]),
    S.cone([s * 0.052, 1.632, 0.068], [s * 0.05, 1.655, 0.07], 0.005),
    S.ellipsoid([s * 0.056, 1.612, -0.036], [0.01, 0.018, 0.013]),
    S.cone([s * 0.03, 1.592, 0.075], [s * 0.035, 1.622, 0.062], 0.009)
  );
  const skullSDF = S.subtract(0.004,
    S.union(0.012,
      S.ellipsoid([0, 1.668, -0.014], [0.07, 0.08, 0.087]),
      S.ellipsoid([0, 1.6, 0.048], [0.036, 0.03, 0.038]),
      S.ellipsoid([0, 1.664, 0.064], [0.058, 0.013, 0.02]),
      S.ellipsoid([0, 1.585, 0.071], [0.03, 0.012, 0.015]),
      S.cone([0, 1.645, 0.084], [0, 1.628, 0.093], 0.006, 0.005),
      skullSide(1), skullSide(-1)
    ),
    S.ellipsoid([0.031, 1.636, 0.088], [0.019, 0.017, 0.024]),
    S.ellipsoid([-0.031, 1.636, 0.088], [0.019, 0.017, 0.024]),
    S.ellipsoid([0, 1.607, 0.094], [0.01, 0.015, 0.022]),
    S.ellipsoid([0, 1.582, -0.02], [0.028, 0.02, 0.042]),
    S.ellipsoid([0.058, 1.622, -0.005], [0.01, 0.01, 0.012]),
    S.ellipsoid([-0.058, 1.622, -0.005], [0.01, 0.01, 0.012])
  );
  add('skeletal', 'skull', 'الجمجمة', 'Skull (Cranium)', 'تتكون الجمجمة من 22 عظمة (8 عظام قحفية و14 عظمة وجهية) ملتحمة معاً بدروز ثابتة عدا الفك السفلي. تحمي الدماغ وأعضاء الحس كالعينين والأذنين، وتشكل هيكل الوجه وتحمل الأسنان العلوية.', S.sdfGeometry(skullSDF, [-0.085, 1.56, -0.11], [0.085, 1.755, 0.11], 0.0032, { ao: 0.02 }), C.bone);

  // Mandible: a U-shaped plate (body) with two vertical rami ending in the condyles.
  const mandParts = [];
  for (let i = 0; i <= 32; i++) {
    const u = (i / 32) * 2 - 1;
    const x = 0.049 * Math.sin(u * 1.35) / Math.sin(1.35);
    const z = 0.078 - 0.07 * (1 - Math.cos(u * 1.35)) / (1 - Math.cos(1.35));
    const top = 1.573, bottom = 1.549 + 0.004 * Math.abs(u);
    mandParts.push(S.cone([x, top, z], [x, bottom, z + 0.003], 0.0048, 0.006));
  }
  for (const s of [-1, 1]) {
    mandParts.push(S.cone([s * 0.05, 1.553, 0.006], [s * 0.057, 1.622, -0.008], 0.0075, 0.005));
    mandParts.push(S.ellipsoid([s * 0.058, 1.626, -0.008], [0.008, 0.004, 0.005]));
    mandParts.push(S.cone([s * 0.051, 1.575, 0.01], [s * 0.05, 1.608, 0.012], 0.005, 0.003));
  }
  mandParts.push(S.ellipsoid([0, 1.551, 0.079], [0.013, 0.008, 0.006]));
  add('skeletal', 'mandible', 'الفك السفلي', 'Mandible', 'الفك السفلي هو العظم الوحيد المتحرك في الجمجمة وأقوى عظام الوجه. يتصل بالعظم الصدغي عبر المفصل الصدغي الفكي، ويحمل الأسنان السفلية، ويشارك في المضغ والكلام.', S.sdfGeometry(S.union(0.008, ...mandParts), [-0.07, 1.54, -0.02], [0.07, 1.635, 0.09], 0.0028, { ao: 0.012 }), C.bone);

  // Vertebral column
  for (const v of VERTEBRAE) {
    const z = spineZ(v.y);
    const rb = v.type === 'C' ? 0.011 : v.type === 'T' ? 0.013 + v.n * 0.0006 : 0.02 + v.n * 0.0006;
    const h = v.type === 'C' ? 0.012 : v.type === 'T' ? 0.017 : 0.022;
    const geos = [];
    const body = new THREE.CylinderGeometry(rb, rb * 1.05, h, 18);
    body.scale(1, 1, 0.8);
    body.translate(0, v.y, z);
    geos.push(body);
    const arch = new THREE.TorusGeometry(rb * 0.75, rb * 0.22, 8, 18);
    arch.rotateX(Math.PI / 2);
    arch.translate(0, v.y, z - rb * 1.35);
    geos.push(arch);
    const spLen = v.type === 'C' ? 0.02 : v.type === 'T' ? 0.032 : 0.03;
    const spDrop = v.type === 'T' ? 0.022 : v.type === 'C' ? 0.006 : 0.004;
    geos.push(tube([[0, v.y, z - rb * 2], [0, v.y - spDrop, z - rb * 2 - spLen]], v.type === 'L' ? 0.005 : 0.0035, { segments: 4, radial: 8, flat: v.type === 'L' ? 1.6 : 1 }));
    const tw = v.type === 'C' ? 0.022 : v.type === 'T' ? 0.028 : 0.038;
    for (const s of [-1, 1]) geos.push(tube([[s * rb * 0.6, v.y, z - rb * 1.3], [s * tw, v.y + 0.002, z - rb * 1.6]], 0.0035, { segments: 4, radial: 8 }));
    const names = { C: 'العنقية', T: 'الصدرية', L: 'القطنية' };
    const namesEn = { C: 'Cervical', T: 'Thoracic', L: 'Lumbar' };
    const special = v.id === 'C1' ? ' (الفهقة)' : v.id === 'C2' ? ' (المحور)' : '';
    const descs = {
      C: 'الفقرات العنقية سبع فقرات صغيرة تدعم الرأس وتمنح الرقبة مدى حركة واسعاً. تحتوي نتوءاتها المستعرضة على ثقوب يمر عبرها الشريان الفقري. الفقرة الأولى (الفهقة) تحمل الجمجمة، والثانية (المحور) تسمح بدوران الرأس.',
      T: 'الفقرات الصدرية اثنتا عشرة فقرة تتمفصل مع الأضلاع لتشكل القفص الصدري الخلفي. نتوءاتها الشوكية طويلة ومائلة للأسفل مما يحد من حركتها ويزيد ثباتها.',
      L: 'الفقرات القطنية خمس فقرات هي الأكبر حجماً في العمود الفقري لأنها تتحمل معظم وزن الجسم العلوي. تسمح بحركات الانحناء والتمدد، وهي موضع شائع لآلام الظهر والانزلاق الغضروفي.'
    };
    add('skeletal', `vert_${v.id}`, `الفقرة ${names[v.type]} ${v.n}${special}`, `${namesEn[v.type]} vertebra ${v.id}`, descs[v.type], merge(geos), C.bone);
  }
  // Intervertebral discs
  const discs = [];
  for (let i = 1; i < VERTEBRAE.length; i++) {
    const a = VERTEBRAE[i - 1], b = VERTEBRAE[i];
    const y = (a.y + b.y) / 2;
    const rb = b.type === 'C' ? 0.01 : b.type === 'T' ? 0.013 + b.n * 0.0006 : 0.019 + b.n * 0.0006;
    const d = new THREE.CylinderGeometry(rb, rb, Math.max(0.003, (a.y - b.y) * 0.25), 16);
    d.scale(1, 1, 0.8);
    d.translate(0, y, spineZ(y));
    discs.push(d);
  }
  add('skeletal', 'discs', 'الأقراص بين الفقرات', 'Intervertebral discs', 'أقراص غضروفية ليفية بين أجسام الفقرات، لكل منها نواة لبية هلامية وحلقة ليفية خارجية. تعمل كوسائد لامتصاص الصدمات وتسمح بمرونة العمود الفقري. انفتاق النواة يسبب ما يعرف بالانزلاق الغضروفي.', merge(discs), C.disc);

  // Sacrum & coccyx are part of the pelvis mesh below; ribs
  const ribW = [0.06, 0.082, 0.098, 0.11, 0.118, 0.124, 0.128, 0.128, 0.126, 0.122, 0.112, 0.1];
  const sternY = [1.388, 1.352, 1.322, 1.292, 1.262, 1.234, 1.212];
  pair('skeletal', 'ribs', 'الأضلاع', 'Ribs', 'يوجد 12 زوجاً من الأضلاع: سبعة أزواج حقيقية تتصل مباشرة بعظم القص، وثلاثة أزواج كاذبة تتصل بغضاريف الأضلاع التي فوقها، وزوجان عائمان لا يتصلان من الأمام. تحمي القلب والرئتين وتشارك في حركة التنفس.', (s) => {
    const geos = [];
    for (let i = 1; i <= 12; i++) {
      const y0 = vy(`T${i}`);
      const zv = spineZ(y0);
      const w = ribW[i - 1];
      const d = 0.06 + Math.min(i, 7) * 0.005;
      const zc = zv + d - 0.012;
      const drop = 0.02 + 0.008 * i;
      const thEnd = i <= 7 ? 2.62 : i <= 10 ? 2.45 : i === 11 ? 1.95 : 1.6;
      const pts = [[s * 0.012, y0, zv - 0.006]];
      for (let k = 0; k <= 10; k++) {
        const th = 0.32 + (thEnd - 0.32) * (k / 10);
        const f = th / Math.PI;
        pts.push([s * w * Math.sin(th), y0 + 0.004 - drop * Math.pow(f, 1.4), zc - d * Math.cos(th) * (th < 1.2 ? 1.05 : 1)]);
      }
      geos.push(tube(pts, (t) => (i === 1 ? 0.007 : 0.0055) * (t < 0.1 ? 0.8 : 1), { segments: 60, flat: 0.5, radial: 10 }));
    }
    return merge(geos);
  }, C.bone, { fem: false });
  pair('skeletal', 'costal', 'الغضاريف الضلعية', 'Costal cartilages', 'غضاريف زجاجية تصل النهايات الأمامية للأضلاع بعظم القص، وتمنح القفص الصدري المرونة اللازمة للتنفس.', (s) => {
    const geos = [];
    for (let i = 1; i <= 10; i++) {
      const y0 = vy(`T${i}`);
      const zv = spineZ(y0);
      const w = ribW[i - 1];
      const d = 0.06 + Math.min(i, 7) * 0.005;
      const zc = zv + d - 0.012;
      const drop = 0.02 + 0.008 * i;
      const thEnd = i <= 7 ? 2.62 : 2.45;
      const f = thEnd / Math.PI;
      const a = [s * w * Math.sin(thEnd), y0 + 0.004 - drop * Math.pow(f, 1.4), zc - d * Math.cos(thEnd)];
      const b = i <= 7 ? [s * 0.014, sternY[i - 1], 0.092 + (1.39 - sternY[i - 1]) * 0.08] : [s * (0.02 + (i - 7) * 0.02), 1.2 - (i - 7) * 0.02, 0.095 - (i - 7) * 0.008];
      const mid = [(a[0] + b[0]) / 2 + s * 0.006, (a[1] + b[1]) / 2 - 0.004, Math.max(a[2], b[2]) + 0.004];
      geos.push(tube([a, mid, b], 0.0045, { segments: 16, flat: 0.6, radial: 8 }));
    }
    return merge(geos);
  }, C.cartilage, { fem: false });

  add('skeletal', 'sternum', 'عظم القص', 'Sternum', 'عظم مسطح في منتصف الصدر يتكون من ثلاثة أجزاء: القبضة والجسم والناتئ الخنجري. تتصل به الترقوتان وغضاريف الأضلاع الحقيقية، ويحمي القلب والأوعية الكبيرة.', merge([
    ellipsoid([0, 1.378, 0.088], [0.026, 0.022, 0.007]),
    ellipsoid([0, 1.285, 0.097], [0.017, 0.075, 0.007], [-0.12, 0, 0]),
    ellipsoid([0, 1.198, 0.103], [0.008, 0.016, 0.004], [-0.3, 0, 0])
  ]), C.bone);

  // Shoulder girdle
  pair('skeletal', 'clavicle', 'عظم الترقوة', 'Clavicle', 'عظم طويل على شكل حرف S يصل عظم القص بلوح الكتف، ويعمل كدعامة تبقي الكتف بعيداً عن الصدر. وهو من أكثر العظام تعرضاً للكسر عند السقوط على اليد الممدودة.', (s) =>
    tube([P(s, 0.018, 1.405, 0.08), P(s, 0.07, 1.415, 0.068), P(s, 0.12, 1.432, 0.03), P(s, 0.162, 1.442, -0.012)], (t) => 0.0065 * (1 + 0.3 * Math.pow(Math.abs(t - 0.5) * 2, 2)), { segments: 30 }), C.bone);

  pair('skeletal', 'scapula', 'لوح الكتف', 'Scapula', 'عظم مثلثي مسطح في أعلى الظهر، يتمفصل مع عظم العضد في الحفرة الحقانية ومع الترقوة في الناتئ الأخرمي. ترتبط به 17 عضلة تتحكم في حركة الكتف والذراع.', (s) => {
    const sh = new THREE.Shape();
    sh.moveTo(0.058, 1.425);
    sh.lineTo(0.15, 1.418);
    sh.quadraticCurveTo(0.158, 1.39, 0.145, 1.37);
    sh.lineTo(0.085, 1.255);
    sh.quadraticCurveTo(0.07, 1.25, 0.066, 1.27);
    sh.lineTo(0.058, 1.425);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 });
    // wrap around the ribcage: rotate about the vertical axis through the medial border
    g.translate(-0.06, 0, 0);
    g.rotateY(-0.5);
    g.translate(0.06, 0, -0.098);
    const spine = tube([[0.064, 1.395, -0.1], [0.12, 1.418, -0.085], [0.168, 1.445, -0.03]], (t) => 0.0045 + 0.004 * t, { segments: 16 });
    const glen = ellipsoid([0.158, 1.405, -0.03], [0.008, 0.017, 0.012]);
    const cor = tube([[0.14, 1.415, -0.03], [0.145, 1.43, 0.0], [0.15, 1.42, 0.02]], 0.004, { segments: 10 });
    const geo = merge([g, spine, glen, cor]);
    if (s < 0) mirrorGeometry(geo);
    return geo;
  }, C.bone, { fem: false });

  // Arm
  pair('skeletal', 'humerus', 'عظم العضد', 'Humerus', 'أطول عظام الطرف العلوي، يمتد من الكتف إلى المرفق. يتمفصل رأسه الكروي مع لوح الكتف، ونهايته السفلية مع الكعبرة والزند. يمر العصب الكعبري في أخدود حول جسمه.', (s) =>
    merge([
      longBone(P(s, 0.172, 1.4, -0.018), P(s, 0.23, 1.125, -0.008), 0.0095, { headA: 0.021, flatB: [0.024, 0.011, 0.014] }),
      ellipsoid(P(s, 0.185, 1.395, -0.01), [0.014, 0.016, 0.014])
    ]), C.bone);
  pair('skeletal', 'radius', 'عظم الكعبرة', 'Radius', 'العظم الوحشي في الساعد (جهة الإبهام)، يدور حول الزند مما يسمح بقلب اليد (الكب والبسط). كسر نهايته السفلية (كسر كوليس) من أشهر الكسور.', (s) =>
    longBone(P(s, 0.243, 1.112, 0.006), P(s, 0.29, 0.866, 0.022), 0.0065, { headA: 0.01, flatB: [0.016, 0.009, 0.011], taper: 1.2 }), C.bone);
  pair('skeletal', 'ulna', 'عظم الزند', 'Ulna', 'العظم الإنسي في الساعد (جهة الخنصر)، ينتهي من الأعلى بالناتئ المرفقي الذي يشكل بروز المرفق. يشكل مع العضد مفصلاً رزياً يسمح بثني المرفق ومده.', (s) =>
    merge([
      longBone(P(s, 0.222, 1.118, -0.02), P(s, 0.266, 0.866, 0.012), 0.0065, { headA: 0.011, headB: 0.008, taper: 0.7 }),
      ellipsoid(P(s, 0.22, 1.132, -0.028), [0.01, 0.014, 0.01])
    ]), C.bone);
  pair('skeletal', 'hand', 'عظام اليد', 'Hand bones', 'تضم اليد 27 عظمة: 8 عظام رسغية صغيرة، و5 عظام مشطية، و14 سلامية (اثنتان للإبهام وثلاث لكل إصبع آخر). يسمح هذا التركيب الدقيق بحركات القبض والإمساك الدقيقة.', (s) => buildHand(s), C.bone, { fem: false });

  // Pelvis (hip bones + sacrum + coccyx)
  const pelvisSide = (s) => S.union(0.012,
    S.ellipsoid([s * 0.085, 0.995, -0.01], [0.068, 0.055, 0.011], [0, s > 0 ? -0.94 : -2.2, s * -0.25]),
    S.ellipsoid([s * 0.095, 0.9, 0.0], [0.026, 0.026, 0.026]),
    S.cone([s * 0.085, 0.96, -0.012], [s * 0.095, 0.905, 0.0], 0.019),
    S.cone([s * 0.09, 0.905, 0.018], [s * 0.012, 0.878, 0.06], 0.0095, 0.009),
    S.cone([s * 0.012, 0.866, 0.056], [s * 0.058, 0.838, 0.002], 0.0075),
    S.cone([s * 0.09, 0.892, -0.012], [s * 0.066, 0.836, -0.02], 0.013),
    S.ellipsoid([s * 0.064, 0.836, -0.014], [0.015, 0.012, 0.015]),
    S.cone([s * 0.035, 0.985, -0.07], [s * 0.062, 0.99, -0.045], 0.016)
  );
  const pelvisSDF = S.subtract(0.004,
    S.union(0.01,
      pelvisSide(1), pelvisSide(-1),
      S.ellipsoid([0, 0.955, -0.078], [0.045, 0.058, 0.018], [-0.55, 0, 0]),
      S.cone([0, 0.905, -0.1], [0, 0.875, -0.088], 0.007, 0.004)
    ),
    S.sphere([0.108, 0.9, 0.006], 0.021),
    S.sphere([-0.108, 0.9, 0.006], 0.021)
  );
  add('skeletal', 'pelvis', 'الحوض (عظما الورك والعجز)', 'Pelvis', 'حلقة عظمية قوية تتكون من عظمي الورك (الحرقفة والإسك والعانة) والعجز والعصعص. تنقل وزن الجسم من العمود الفقري إلى الطرفين السفليين، وتحمي أعضاء الحوض كالمثانة والأمعاء والأعضاء التناسلية.', S.sdfGeometry(pelvisSDF, [-0.175, 0.815, -0.12], [0.175, 1.065, 0.085], 0.0036, { ao: 0.025 }), C.bone);

  // Leg
  pair('skeletal', 'femur', 'عظم الفخذ', 'Femur', 'أطول وأقوى عظمة في جسم الإنسان (نحو ربع طول الجسم). يتمفصل رأسه مع الحُق في الحوض ليشكل مفصل الورك، ونهايته السفلية مع الظنبوب والرضفة لتشكيل مفصل الركبة. يتحمل ضغطاً يعادل عدة أضعاف وزن الجسم أثناء الجري.', (s) => merge([
    ellipsoid(P(s, 0.1, 0.9, 0.006), [0.02, 0.02, 0.02]),
    tube([P(s, 0.1, 0.9, 0.006), P(s, 0.138, 0.878, 0.0)], 0.011, { segments: 6 }),
    ellipsoid(P(s, 0.146, 0.884, -0.006), [0.016, 0.02, 0.016]),
    tube([P(s, 0.14, 0.875, 0.0), P(s, 0.12, 0.7, 0.008), P(s, 0.1, 0.53, 0.0)], (t) => 0.0125 - 0.002 * Math.sin(Math.PI * t), { segments: 24 }),
    ellipsoid(P(s, 0.082, 0.505, -0.004), [0.017, 0.02, 0.026]),
    ellipsoid(P(s, 0.118, 0.505, -0.004), [0.017, 0.02, 0.026])
  ]), C.bone);
  pair('skeletal', 'patella', 'الرضفة (صابونة الركبة)', 'Patella', 'أكبر عظمة سمسمانية في الجسم، تقع داخل وتر العضلة رباعية الرؤوس أمام مفصل الركبة. تحمي المفصل وتزيد من كفاءة الرافعة لعضلات الفخذ عند مد الساق.', (s) =>
    ellipsoid(P(s, 0.1, 0.51, 0.036), [0.019, 0.022, 0.008]), C.bone, { fem: true });
  pair('skeletal', 'tibia', 'عظم الظنبوب (القصبة)', 'Tibia', 'العظم الأكبر والإنسي في الساق، يحمل معظم وزن الجسم. حافته الأمامية تقع تحت الجلد مباشرة (عظم القصبة)، وينتهي من الأسفل بالكعب الإنسي.', (s) => merge([
    ellipsoid(P(s, 0.1, 0.476, 0.0), [0.037, 0.012, 0.028]),
    tube([P(s, 0.1, 0.47, 0.004), P(s, 0.095, 0.3, 0.008), P(s, 0.091, 0.095, 0.0)], (t) => 0.0125 - 0.003 * Math.sin(Math.PI * t), { segments: 24 }),
    ellipsoid(P(s, 0.09, 0.083, 0.0), [0.02, 0.013, 0.019]),
    ellipsoid(P(s, 0.074, 0.072, 0.002), [0.008, 0.014, 0.009])
  ]), C.bone);
  pair('skeletal', 'fibula', 'عظم الشظية', 'Fibula', 'عظم رفيع يقع وحشي الظنبوب، لا يحمل وزناً يُذكر لكنه نقطة ارتكاز لعضلات مهمة، وينتهي من الأسفل بالكعب الوحشي الذي يثبت مفصل الكاحل.', (s) =>
    merge([
      longBone(P(s, 0.132, 0.455, -0.012), P(s, 0.124, 0.075, -0.01), 0.0055, { headA: 0.0095, headB: 0.006 }),
      ellipsoid(P(s, 0.125, 0.064, -0.01), [0.008, 0.015, 0.009])
    ]), C.bone);
  pair('skeletal', 'foot', 'عظام القدم', 'Foot bones', 'تحتوي القدم على 26 عظمة: 7 عظام رصغية (منها العقب والكاحل)، و5 عظام مشطية، و14 سلامية. تشكل أقواساً طولية ومستعرضة تمتص الصدمات وتوزع وزن الجسم أثناء الوقوف والمشي.', (s) => buildFoot(s), C.bone, { fem: false });
}

function mirrorGeometry(geo) {
  geo.scale(-1, 1, 1);
  const idx = geo.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
  } else {
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      for (const attr of [p, n]) {
        if (!attr) continue;
        const x = attr.getX(i + 1), y = attr.getY(i + 1), z = attr.getZ(i + 1);
        attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
        attr.setXYZ(i + 2, x, y, z);
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function chain(start, dir, lengths, r, geos) {
  let a = V(start).clone();
  const d = V(dir).clone().normalize();
  for (let i = 0; i < lengths.length; i++) {
    const b = a.clone().addScaledVector(d, lengths[i]);
    const rr = r * (1 - i * 0.12);
    geos.push(longBone(a.toArray(), b.toArray(), rr, { headA: rr * 1.35, headB: rr * 1.25 }));
    a = b.clone().addScaledVector(d, 0.0025);
    d.y -= 0.05; d.normalize();
  }
}

function buildHand(s) {
  const geos = [];
  const rows = [0.856, 0.838];
  for (const y of rows) for (let k = 0; k < 4; k++) geos.push(ellipsoid([s * (0.268 + k * 0.009), y, 0.022], [0.0055, 0.0065, 0.006], null, [12, 8]));
  const base = [0.263, 0.276, 0.289, 0.301];
  const tip = [0.258, 0.274, 0.29, 0.306];
  const phal = [[0.024, 0.016, 0.013], [0.028, 0.018, 0.014], [0.03, 0.019, 0.015], [0.027, 0.017, 0.014]];
  for (let f = 0; f < 4; f++) {
    const a = [s * base[f], 0.827, 0.022];
    const b = [s * tip[f], 0.772 - (f === 2 ? 0.004 : 0), 0.024];
    geos.push(longBone(a, b, 0.0038, { headA: 0.0048, headB: 0.0052 }));
    const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    chain([b[0] + (dir[0] * 0.08), b[1] - 0.004, b[2]], dir, phal[f], 0.0036, geos);
  }
  // thumb
  const ta = [s * 0.303, 0.838, 0.028], tb = [s * 0.322, 0.806, 0.038];
  geos.push(longBone(ta, tb, 0.0042, { headA: 0.0052, headB: 0.0055 }));
  chain([s * 0.325, 0.8, 0.04], [s * 0.4, -1, 0.3], [0.024, 0.019], 0.0042, geos);
  return merge(geos);
}

function buildFoot(s) {
  const geos = [];
  const P = (x, y, z) => [s * x, y, z];
  geos.push(ellipsoid(P(0.096, 0.058, 0.002), [0.018, 0.013, 0.022]));
  geos.push(ellipsoid(P(0.1, 0.03, -0.035), [0.018, 0.02, 0.034], [0.35, 0, 0]));
  geos.push(ellipsoid(P(0.085, 0.043, 0.03), [0.016, 0.01, 0.01]));
  geos.push(ellipsoid(P(0.119, 0.03, 0.035), [0.012, 0.012, 0.014]));
  for (const x of [0.07, 0.085, 0.1]) geos.push(ellipsoid(P(x, 0.037, 0.052), [0.007, 0.01, 0.01], null, [12, 8]));
  const baseX = [0.07, 0.086, 0.1, 0.113, 0.125], headX = [0.064, 0.083, 0.1, 0.116, 0.132];
  const toeL = [[0.025, 0.02], [0.018, 0.011, 0.009], [0.016, 0.01, 0.008], [0.014, 0.009, 0.007], [0.012, 0.008, 0.006]];
  for (let i = 0; i < 5; i++) {
    const a = P(baseX[i], 0.034, 0.063 - i * 0.004), b = P(headX[i], 0.016, 0.132 - i * 0.008);
    const r = i === 0 ? 0.0065 : 0.0042;
    geos.push(longBone(a, b, r, { headA: r * 1.3, headB: r * 1.35 }));
    chain([b[0], b[1], b[2] + 0.004], [s * (i === 0 ? -0.05 : 0.05), -0.15, 1], toeL[i], i === 0 ? 0.0058 : 0.0034, geos);
  }
  return merge(geos);
}

// ---------------------------------------------------------------------------
// MUSCLES
function buildMuscles(add, pair, P) {
  const m = (id, ar, en, desc, fn, opts = {}) => pair('muscular', id, ar, en, desc, fn, opts.color || C.muscle, { fem: true, ...opts });
  m('temporalis', 'العضلة الصدغية', 'Temporalis', 'عضلة مروحية الشكل على جانب الرأس، تمتد من الحفرة الصدغية إلى الفك السفلي. ترفع الفك وتسحبه للخلف أثناء المضغ.', (s) =>
    ellipsoid(P(s, 0.066, 1.67, -0.005), [0.009, 0.04, 0.045], [0, 0, s * 0.12]));
  m('masseter', 'العضلة الماضغة', 'Masseter', 'من أقوى عضلات الجسم نسبة إلى حجمها، تمتد من القوس الوجني إلى زاوية الفك السفلي، وتغلق الفم بقوة أثناء المضغ.', (s) =>
    spindle(P(s, 0.058, 1.622, 0.02), P(s, 0.055, 1.558, 0.022), 0.017, { flat: 0.45, toward: [s, 0, 0.2] }));
  m('scm', 'العضلة القصية الترقوية الخشائية', 'Sternocleidomastoid', 'عضلة بارزة على جانبي الرقبة تمتد من الناتئ الخشائي خلف الأذن إلى القص والترقوة. تدير الرأس للجهة المقابلة وتثني الرقبة.', (s) =>
    spindle(P(s, 0.058, 1.61, -0.03), P(s, 0.02, 1.412, 0.078), 0.014, { flat: 0.6, toward: [s, 0, 0.5] }));
  m('trapezius', 'العضلة شبه المنحرفة', 'Trapezius', 'عضلة كبيرة معينية الشكل في أعلى الظهر والرقبة، تمتد من قاعدة الجمجمة والفقرات الصدرية إلى الترقوة ولوح الكتف. ترفع الكتفين وتسحبهما للخلف وتثبت لوح الكتف.', (s) => merge([
    spindle(P(s, 0.012, 1.6, -0.07), P(s, 0.165, 1.44, -0.03), 0.028, { flat: 0.35, toward: [0, 0.4, -1] }),
    spindle(P(s, 0.008, 1.36, -0.115), P(s, 0.15, 1.42, -0.07), 0.042, { flat: 0.22, toward: [0, 0, -1] }),
    spindle(P(s, 0.008, 1.15, -0.1), P(s, 0.1, 1.37, -0.108), 0.036, { flat: 0.22, toward: [0, 0, -1] })
  ]));
  m('deltoid', 'العضلة الدالية', 'Deltoid', 'عضلة مثلثية تغطي مفصل الكتف وتعطيه شكله المستدير. ترفع الذراع جانبياً (التبعيد) وتشارك في تحريكه للأمام والخلف. تستخدم كثيراً لإعطاء الحقن العضلية.', (s) =>
    spindle(P(s, 0.16, 1.458, -0.004), P(s, 0.214, 1.29, 0.0), 0.037, { flat: 0.62, toward: [s, 0.2, 0], bulge: 0.32, width: 1.15 }));
  m('pectoralis', 'العضلة الصدرية الكبرى', 'Pectoralis major', 'عضلة مروحية كبيرة تغطي أعلى الصدر، تمتد من القص والترقوة إلى عظم العضد. تقرب الذراع من الجسم وتدوره للداخل وتدفعه للأمام، كما في تمرين الضغط.', (s) =>
    spindle(P(s, 0.018, 1.3, 0.102), P(s, 0.172, 1.378, 0.03), 0.055, { flat: 0.28, toward: [s * 0.2, 0, 1], bulge: 0.4, width: 1.15 }));
  m('latissimus', 'العضلة الظهرية العريضة', 'Latissimus dorsi', 'أعرض عضلة في الجسم، تغطي الجزء السفلي والجانبي من الظهر وتمتد إلى عظم العضد. تسحب الذراع للأسفل والخلف كما في السباحة والتسلق.', (s) =>
    spindle(P(s, 0.03, 1.07, -0.098), P(s, 0.17, 1.35, -0.03), 0.066, { flat: 0.22, toward: [s * 0.4, 0, -1], bulge: 0.35 }));
  m('serratus', 'العضلة المنشارية الأمامية', 'Serratus anterior', 'عضلة على جانب القفص الصدري بأصابع تشبه أسنان المنشار، تثبت لوح الكتف على القفص الصدري وتدفعه للأمام. شللها يسبب بروز لوح الكتف (الكتف المجنح).', (s) =>
    spindle(P(s, 0.115, 1.19, 0.06), P(s, 0.13, 1.34, -0.05), 0.03, { flat: 0.3, toward: [s, 0, 0] }));
  m('rectus_abd', 'العضلة المستقيمة البطنية', 'Rectus abdominis', 'عضلة طولية على جانبي خط منتصف البطن تمتد من العانة إلى القفص الصدري، تقطعها أوتار مستعرضة تعطي شكل "العضلات السداسية". تثني الجذع وتضغط على أحشاء البطن.', (s) =>
    spindle(P(s, 0.03, 1.215, 0.105), P(s, 0.016, 0.875, 0.088), 0.03, { flat: 0.32, toward: [0, 0, 1], tendon: 0.4 }));
  m('oblique', 'العضلة المائلة الخارجية', 'External oblique', 'أكبر عضلات جدار البطن الجانبي وأكثرها سطحية، أليافها مائلة للأسفل والأمام. تدير الجذع وتثنيه جانبياً وتدعم أحشاء البطن.', (s) =>
    spindle(P(s, 0.128, 1.22, 0.04), P(s, 0.075, 0.96, 0.1), 0.05, { flat: 0.24, toward: [s, 0, 0.8] }));
  m('biceps', 'العضلة ذات الرأسين العضدية', 'Biceps brachii', 'عضلة في مقدمة العضد لها رأسان يبدآن من لوح الكتف وتنتهي بوتر في الكعبرة. تثني المرفق وتقلب الساعد بحيث يتجه الكف للأعلى.', (s) =>
    spindle(P(s, 0.19, 1.37, 0.03), P(s, 0.238, 1.1, 0.028), 0.024, { bulge: 0.58, toward: [0, 0, 1], flat: 0.85 }));
  m('triceps', 'العضلة ثلاثية الرؤوس العضدية', 'Triceps brachii', 'العضلة الوحيدة في مؤخرة العضد، لها ثلاثة رؤوس وتنتهي في الناتئ المرفقي للزند. تمد المرفق وتشكل نحو ثلثي حجم عضلات العضد.', (s) =>
    spindle(P(s, 0.18, 1.4, -0.038), P(s, 0.224, 1.13, -0.036), 0.029, { bulge: 0.42, toward: [0, 0, -1], flat: 0.85 }));
  m('forearm_flex', 'عضلات الساعد القابضة', 'Forearm flexors', 'مجموعة عضلات في الجهة الأمامية للساعد تنشأ من اللقيمة الإنسية للعضد، تثني الرسغ والأصابع وتمنح اليد قوة القبض.', (s) =>
    spindle(P(s, 0.222, 1.13, 0.012), P(s, 0.268, 0.89, 0.03), 0.022, { bulge: 0.28, flat: 0.72, toward: [0, 0, 1] }));
  m('forearm_ext', 'عضلات الساعد الباسطة', 'Forearm extensors', 'مجموعة عضلات في الجهة الخلفية للساعد تنشأ من اللقيمة الوحشية للعضد، تمد الرسغ والأصابع. التهاب أوتارها يعرف بمرفق لاعب التنس.', (s) =>
    spindle(P(s, 0.245, 1.13, -0.012), P(s, 0.284, 0.89, 0.004), 0.02, { bulge: 0.3, flat: 0.75, toward: [0, 0, -1] }));
  m('brachioradialis', 'العضلة العضدية الكعبرية', 'Brachioradialis', 'عضلة على الحافة الوحشية للساعد تمتد من العضد إلى نهاية الكعبرة، تثني المرفق خاصة عندما يكون الساعد في وضع متوسط كحمل كوب.', (s) =>
    spindle(P(s, 0.238, 1.18, 0.012), P(s, 0.29, 0.885, 0.028), 0.016, { bulge: 0.3, toward: [s, 0, 0.3], flat: 0.8 }));
  m('glute_max', 'العضلة الألوية الكبرى', 'Gluteus maximus', 'أكبر عضلة في جسم الإنسان، تشكل معظم كتلة الأرداف. تمد مفصل الورك وتدور الفخذ للخارج، وهي أساسية للنهوض من الجلوس وصعود الدرج والجري.', (s) =>
    spindle(P(s, 0.025, 0.995, -0.1), P(s, 0.142, 0.822, -0.045), 0.074, { flat: 0.42, toward: [s * 0.35, 0, -1], width: 1.1 }));
  m('glute_med', 'العضلة الألوية الوسطى', 'Gluteus medius', 'عضلة مروحية على السطح الخارجي للحرقفة، تبعد الفخذ وتحافظ على استواء الحوض أثناء المشي على قدم واحدة.', (s) =>
    spindle(P(s, 0.12, 1.0, -0.035), P(s, 0.155, 0.885, -0.012), 0.04, { flat: 0.45, toward: [s, 0, -0.3] }));
  m('rectus_fem', 'العضلة المستقيمة الفخذية', 'Rectus femoris', 'إحدى رؤوس العضلة رباعية الرؤوس في مقدمة الفخذ، وهي الوحيدة بينها التي تعبر مفصلي الورك والركبة، فتثني الورك وتمد الركبة، كما في ركل الكرة.', (s) =>
    spindle(P(s, 0.11, 0.935, 0.058), P(s, 0.1, 0.535, 0.05), 0.034, { bulge: 0.45, flat: 0.85 }));
  m('vastus_lat', 'العضلة المتسعة الوحشية', 'Vastus lateralis', 'أكبر رؤوس العضلة رباعية الرؤوس، تقع على الجانب الخارجي للفخذ وتمد مفصل الركبة.', (s) =>
    spindle(P(s, 0.148, 0.86, 0.004), P(s, 0.124, 0.535, 0.03), 0.04, { flat: 0.7, toward: [s, 0, 0.3], bulge: 0.45 }));
  m('vastus_med', 'العضلة المتسعة الإنسية', 'Vastus medialis', 'رأس من رؤوس العضلة رباعية الرؤوس على الجانب الداخلي للفخذ، تشكل بروزاً على شكل قطرة فوق الركبة وتثبت الرضفة.', (s) =>
    spindle(P(s, 0.075, 0.74, 0.03), P(s, 0.085, 0.535, 0.042), 0.032, { bulge: 0.7, flat: 0.8, toward: [-s, 0, 0.6] }));
  m('sartorius', 'العضلة الخياطية', 'Sartorius', 'أطول عضلة في جسم الإنسان، شريطية تعبر الفخذ قطرياً من الحرقفة إلى الجهة الإنسية للركبة. تثني الورك والركبة وتدور الفخذ للخارج، كما في جلسة الخياط.', (s) =>
    tube([P(s, 0.125, 0.975, 0.062), P(s, 0.095, 0.85, 0.08), P(s, 0.055, 0.66, 0.042), P(s, 0.065, 0.48, 0.0)], 0.008, { segments: 40, flat: 0.5 }));
  m('adductors', 'العضلات المقربة للفخذ', 'Adductors', 'مجموعة عضلات في الجهة الإنسية للفخذ (المقربة الطويلة والقصيرة والكبيرة والرشيقة)، تقرب الفخذين من بعضهما وتثبت الحوض أثناء المشي.', (s) =>
    spindle(P(s, 0.028, 0.87, 0.02), P(s, 0.078, 0.58, 0.0), 0.04, { bulge: 0.35, flat: 0.75, toward: [-s, 0, 0] }));
  m('hamstrings', 'عضلات الفخذ الخلفية', 'Hamstrings', 'ثلاث عضلات في مؤخرة الفخذ (ذات الرأسين الفخذية، والنصف وترية، والنصف غشائية) تمد الورك وتثني الركبة. شائعة الإصابة بالتمزق لدى الرياضيين.', (s) =>
    spindle(P(s, 0.075, 0.845, -0.052), P(s, 0.1, 0.52, -0.045), 0.043, { bulge: 0.45, flat: 0.85, toward: [0, 0, -1] }));
  m('gastrocnemius', 'عضلة الساق التوأمية (بطة الساق)', 'Gastrocnemius', 'عضلة ذات رأسين تشكل بروز بطة الساق، تنتهي بوتر العرقوب (أخيل) في عظم العقب. تثني القدم نحو الأسفل وتسمح بالوقوف على رؤوس الأصابع والقفز.', (s) =>
    spindle(P(s, 0.098, 0.49, -0.03), P(s, 0.093, 0.2, -0.042), 0.042, { bulge: 0.3, flat: 0.75, toward: [0, 0, -1], width: 1.2 }));
  m('soleus', 'العضلة النعلية', 'Soleus', 'عضلة عريضة مسطحة تحت التوأمية، تعمل معها على ثني القدم للأسفل وتساعد على ضخ الدم الوريدي من الساقين نحو القلب، لذلك تسمى أحياناً "القلب الثاني".', (s) =>
    spindle(P(s, 0.1, 0.42, -0.018), P(s, 0.092, 0.13, -0.035), 0.036, { bulge: 0.45, flat: 0.6, toward: [0, 0, -1], width: 1.2 }));
  m('achilles', 'وتر العرقوب (أخيل)', 'Achilles tendon', 'أقوى وأغلظ وتر في الجسم، يربط عضلات بطة الساق بعظم العقب، ويتحمل قوى تصل إلى عشرة أضعاف وزن الجسم أثناء الجري.', (s) =>
    tube([P(s, 0.093, 0.23, -0.045), P(s, 0.095, 0.12, -0.05), P(s, 0.1, 0.045, -0.058)], (t) => 0.007 - 0.002 * t, { segments: 16, flat: 0.55 }), { color: C.tendon, fem: false });
  m('tibialis_ant', 'العضلة الظنبوبية الأمامية', 'Tibialis anterior', 'عضلة في مقدمة الساق بجانب عظم القصبة، ترفع القدم للأعلى وتقلبها للداخل. ضعفها يسبب ما يعرف بسقوط القدم.', (s) =>
    spindle(P(s, 0.118, 0.47, 0.024), P(s, 0.088, 0.1, 0.05), 0.02, { bulge: 0.3, flat: 0.8 }));
}

// ---------------------------------------------------------------------------
// NERVOUS SYSTEM
function buildNervous(add, pair, P) {
  pair('nervous', 'cerebrum', 'نصف الكرة المخية', 'Cerebral hemisphere', 'المخ هو الجزء الأكبر من الدماغ، وينقسم إلى نصفين يتصلان بالجسم الثفني. قشرته المتعرجة (التلافيف والأخاديد) مسؤولة عن التفكير والذاكرة واللغة والحركة الإرادية والإحساس. النصف الأيسر يتحكم غالباً في الجهة اليمنى من الجسم والعكس.', (s) => {
    const g = new THREE.SphereGeometry(1, 96, 72);
    g.scale(0.0335, 0.056, 0.08);
    g.translate(s * 0.0345, 1.676, -0.013);
    return wrinkle(g, 0.0032, 170, s > 0 ? 1.3 : 2.1);
  }, C.brain);
  add('nervous', 'cerebellum', 'المخيخ', 'Cerebellum', 'يقع أسفل مؤخرة المخ، ويحتوي على أكثر من نصف خلايا الدماغ العصبية رغم صغر حجمه. ينسق الحركات ويحافظ على التوازن ووضعية الجسم، ويشارك في تعلم المهارات الحركية.', (() => {
    const g = new THREE.SphereGeometry(1, 64, 48);
    g.scale(0.05, 0.024, 0.032);
    g.translate(0, 1.622, -0.066);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 - 0.035 * Math.abs(Math.sin((y - 1.6) * 900));
      p.setX(i, p.getX(i) * k);
      p.setZ(i, -0.066 + (p.getZ(i) + 0.066) * k);
    }
    g.computeVertexNormals();
    return g;
  })(), 0xd98c8c);
  add('nervous', 'brainstem', 'جذع الدماغ', 'Brainstem', 'يصل الدماغ بالحبل الشوكي ويتكون من الدماغ المتوسط والجسر والنخاع المستطيل. يتحكم في الوظائف الحيوية التلقائية كالتنفس وضربات القلب وضغط الدم والبلع، ومنه تخرج معظم الأعصاب القحفية.', tube([[0, 1.655, -0.01], [0, 1.625, -0.025], [0, 1.595, -0.038], [0, 1.57, -0.052]], (t) => 0.012 - 0.004 * t, { segments: 20 }), 0xe0a07a);
  add('nervous', 'spinal_cord', 'الحبل الشوكي', 'Spinal cord', 'حزمة من الأنسجة العصبية بطول نحو 45 سم تمتد داخل القناة الفقرية من جذع الدماغ حتى الفقرة القطنية الأولى، ثم تتفرع إلى ما يسمى ذيل الفرس. تنقل الإشارات بين الدماغ والجسم وتتحكم في الأفعال المنعكسة. يخرج منها 31 زوجاً من الأعصاب الشوكية.', (() => {
    const pts = [];
    for (let y = 1.572; y >= 0.94; y -= 0.02) pts.push([0, y, spineZ(y) - (y > 1.44 ? 0.017 : y > 1.13 ? 0.022 : 0.028)]);
    return tube(pts, (t) => (t < 0.72 ? 0.0055 : 0.0055 - (t - 0.72) * 0.012), { segments: 120, radial: 10 });
  })(), C.nerve);
  pair('nervous', 'optic', 'العصب البصري', 'Optic nerve', 'العصب القحفي الثاني، ينقل الإشارات البصرية من شبكية العين إلى الدماغ. يتقاطع نصف أليافه عند التصالب البصري، لذا تصل صورة كل نصف من المجال البصري إلى نصف الدماغ المقابل.', (s) =>
    tube([P(s, 0.031, 1.636, 0.058), P(s, 0.02, 1.632, 0.035), P(s, 0.006, 1.628, 0.018)], 0.0022, { segments: 12 }), C.nerve);
  pair('nervous', 'brachial', 'الضفيرة العضدية وأعصاب الذراع', 'Brachial plexus & arm nerves', 'شبكة من الأعصاب تنشأ من الأعصاب الشوكية (ع5 - ص1) وتتفرع إلى أعصاب الطرف العلوي: العصب المتوسط (الذي ينضغط في متلازمة النفق الرسغي)، والعصب الزندي (المسؤول عن "عظمة المرح" في المرفق)، والعصب الكعبري. تتحكم في حركة الذراع واليد وإحساسهما.', (s) => {
    const trunk = [P(s, 0.012, 1.47, -0.04), P(s, 0.06, 1.43, -0.02), P(s, 0.12, 1.41, -0.01), P(s, 0.17, 1.37, 0.0)];
    return merge([
      tube(trunk, 0.0035, { segments: 24 }),
      tube([P(s, 0.012, 1.44, -0.045), P(s, 0.07, 1.415, -0.018), P(s, 0.12, 1.405, -0.01)], 0.0028, { segments: 20 }),
      tube([P(s, 0.17, 1.37, 0.0), P(s, 0.205, 1.25, 0.022), P(s, 0.232, 1.12, 0.028), P(s, 0.262, 0.98, 0.03), P(s, 0.28, 0.87, 0.03), P(s, 0.284, 0.8, 0.03)], 0.0022, { segments: 50 }),
      tube([P(s, 0.17, 1.37, 0.0), P(s, 0.195, 1.25, -0.005), P(s, 0.214, 1.13, -0.028), P(s, 0.24, 0.98, 0.0), P(s, 0.262, 0.87, 0.02), P(s, 0.265, 0.8, 0.025)], 0.002, { segments: 50 }),
      tube([P(s, 0.17, 1.37, 0.0), P(s, 0.19, 1.3, -0.03), P(s, 0.225, 1.2, -0.032), P(s, 0.248, 1.12, 0.005), P(s, 0.275, 0.98, 0.012), P(s, 0.295, 0.87, 0.02)], 0.002, { segments: 50 })
    ]);
  }, C.nerve);
  pair('nervous', 'sciatic', 'العصب الوركي وفروعه', 'Sciatic nerve', 'أطول وأغلظ عصب في الجسم (بسماكة الإصبع تقريباً)، ينشأ من الضفيرة العجزية ويمر خلف مفصل الورك إلى مؤخرة الفخذ، ثم ينقسم فوق الركبة إلى العصب الظنبوبي والعصب الشظوي المشترك. التهابه أو انضغاطه يسبب ألم عرق النسا.', (s) => merge([
    tube([P(s, 0.03, 0.96, -0.075), P(s, 0.07, 0.9, -0.075), P(s, 0.1, 0.84, -0.07), P(s, 0.105, 0.7, -0.045), P(s, 0.1, 0.55, -0.045)], 0.004, { segments: 40 }),
    tube([P(s, 0.1, 0.55, -0.045), P(s, 0.096, 0.45, -0.04), P(s, 0.094, 0.3, -0.033), P(s, 0.088, 0.12, -0.03), P(s, 0.085, 0.05, -0.01), P(s, 0.08, 0.025, 0.05)], 0.0028, { segments: 40 }),
    tube([P(s, 0.1, 0.55, -0.045), P(s, 0.128, 0.49, -0.03), P(s, 0.135, 0.44, 0.0), P(s, 0.118, 0.3, 0.022), P(s, 0.1, 0.1, 0.035), P(s, 0.1, 0.04, 0.09)], 0.0022, { segments: 40 })
  ]), C.nerve);
  pair('nervous', 'femoral_n', 'العصب الفخذي', 'Femoral nerve', 'أكبر فروع الضفيرة القطنية، يمر تحت الرباط الإربي إلى مقدمة الفخذ، ويغذي العضلة رباعية الرؤوس المسؤولة عن مد الركبة، وينقل الإحساس من مقدمة الفخذ والجهة الإنسية للساق.', (s) =>
    tube([P(s, 0.02, 1.07, -0.04), P(s, 0.05, 1.0, -0.02), P(s, 0.08, 0.93, 0.03), P(s, 0.092, 0.88, 0.06), P(s, 0.09, 0.78, 0.05)], 0.0028, { segments: 30 }), C.nerve);
  pair('nervous', 'vagus', 'العصب المبهم', 'Vagus nerve', 'العصب القحفي العاشر، وأطول الأعصاب القحفية. ينزل من جذع الدماغ عبر الرقبة والصدر حتى البطن، ويحمل الإشارات اللاودية التي تبطئ القلب وتنشط الهضم، وينقل الإحساس من الأحشاء.', (s) =>
    tube([P(s, 0.012, 1.6, -0.04), P(s, 0.03, 1.55, -0.01), P(s, 0.032, 1.45, 0.012), P(s, 0.022, 1.36, 0.0), P(s, 0.018, 1.25, -0.035), P(s, 0.012, 1.17, -0.012), P(s, 0.02, 1.14, 0.01)], 0.0018, { segments: 50 }), C.nerve);
  pair('nervous', 'intercostal', 'الأعصاب الوربية', 'Intercostal nerves', 'الفروع الأمامية للأعصاب الشوكية الصدرية، تسير في الحافة السفلية لكل ضلع مع الشريان والوريد الوربي، وتغذي عضلات جدار الصدر والبطن والجلد المغطي لها.', (s) => {
    const geos = [];
    for (let i = 2; i <= 11; i++) {
      const y0 = vy(`T${i}`) - 0.008, zv = spineZ(y0);
      const w = [0.06, 0.082, 0.098, 0.11, 0.118, 0.124, 0.128, 0.128, 0.126, 0.122, 0.112, 0.1][i - 1] - 0.006;
      const d = 0.06 + Math.min(i, 7) * 0.005 - 0.006, zc = zv + d - 0.006, drop = 0.02 + 0.008 * i;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const th = 0.3 + 2.1 * (k / 8);
        pts.push([s * w * Math.sin(th), y0 - drop * Math.pow(th / Math.PI, 1.4), zc - d * Math.cos(th)]);
      }
      geos.push(tube(pts, 0.0011, { segments: 30, radial: 6 }));
    }
    return merge(geos);
  }, C.nerve, { fem: true });
}

// ---------------------------------------------------------------------------
// CIRCULATORY SYSTEM
function buildCirculatory(add, pair, P) {
  const heart = merge([
    ellipsoid([0.016, 1.262, 0.044], [0.043, 0.058, 0.038], [0.35, 0.3, 0.75]),
    ellipsoid([-0.018, 1.298, 0.036], [0.025, 0.025, 0.024]),
    ellipsoid([0.024, 1.305, 0.012], [0.024, 0.02, 0.022]),
    ellipsoid([0.042, 1.298, 0.05], [0.012, 0.008, 0.012]),
    ellipsoid([-0.03, 1.31, 0.055], [0.01, 0.008, 0.012])
  ]);
  add('circulatory', 'heart', 'القلب', 'Heart', 'عضلة مجوفة بحجم قبضة اليد تقريباً، تقع في المنصف بين الرئتين مائلة إلى اليسار. تتكون من أربع حجرات: أذينان وبطينان. ينبض نحو 100 ألف مرة يومياً ويضخ قرابة 7000 لتر من الدم. الجانب الأيمن يضخ الدم إلى الرئتين، والأيسر يضخه إلى بقية الجسم.', heart, C.heart);

  const aortaPts = [[0.004, 1.3, 0.048], [0.0, 1.345, 0.045], [0.008, 1.37, 0.025], [0.02, 1.365, -0.01], [0.024, 1.34, -0.04], [0.022, 1.28, -0.052]];
  for (let y = 1.24; y >= 0.99; y -= 0.03) aortaPts.push([0.02 - (1.24 - y) * 0.06, y, spineZ(y) + 0.033]);
  aortaPts.push([0.0, 0.975, spineZ(0.975) + 0.035]);
  add('circulatory', 'aorta', 'الشريان الأبهر (الأورطي)', 'Aorta', 'أكبر شريان في الجسم، يخرج من البطين الأيسر صاعداً ثم ينحني (قوس الأبهر) ويهبط أمام العمود الفقري عبر الصدر والبطن، حتى ينقسم عند الفقرة القطنية الرابعة إلى الشريانين الحرقفيين. يبلغ قطره نحو 2.5 سم.', tube(aortaPts, (t) => 0.0115 - 0.004 * t, { segments: 120 }), C.artery);
  add('circulatory', 'pulm_trunk', 'الجذع الرئوي والشرايين الرئوية', 'Pulmonary arteries', 'تنقل الدم غير المؤكسج من البطين الأيمن إلى الرئتين. وهي الشرايين الوحيدة في الجسم (بعد الولادة) التي تحمل دماً فقيراً بالأكسجين.', merge([
    tube([[-0.005, 1.29, 0.07], [0.008, 1.325, 0.06], [0.015, 1.34, 0.04]], 0.01, { segments: 12 }),
    tube([[0.015, 1.34, 0.04], [0.04, 1.335, 0.015], [0.07, 1.32, -0.005]], 0.0065, { segments: 12 }),
    tube([[0.015, 1.34, 0.04], [-0.01, 1.338, 0.012], [-0.04, 1.33, 0.0], [-0.07, 1.315, -0.005]], 0.0065, { segments: 12 })
  ]), 0x3b5bdb);
  add('circulatory', 'svc', 'الوريد الأجوف العلوي', 'Superior vena cava', 'وريد كبير يجمع الدم غير المؤكسج من الرأس والرقبة والطرفين العلويين والصدر، ويصبه في الأذين الأيمن للقلب.', tube([[-0.028, 1.4, 0.03], [-0.028, 1.35, 0.035], [-0.022, 1.31, 0.038]], 0.0085, { segments: 12 }), C.vein);
  const ivcPts = [];
  for (let y = 1.25; y >= 0.965; y -= 0.03) ivcPts.push([-0.022 + (1.25 - y) * 0.02, y, spineZ(y) + 0.03]);
  ivcPts.unshift([-0.02, 1.28, 0.03]);
  add('circulatory', 'ivc', 'الوريد الأجوف السفلي', 'Inferior vena cava', 'أكبر وريد في الجسم، يصعد على يمين الأبهر حاملاً الدم غير المؤكسج من الطرفين السفليين والبطن والحوض إلى الأذين الأيمن للقلب.', tube(ivcPts, 0.011, { segments: 60 }), C.vein);

  pair('circulatory', 'carotid', 'الشريان السباتي', 'Common carotid artery', 'الشريان الرئيسي الذي يغذي الرأس والعنق، يصعد على جانبي القصبة الهوائية وينقسم عند مستوى الحنجرة إلى السباتي الظاهر (للوجه) والباطن (للدماغ). يمكن جس نبضه على جانب الرقبة.', (s) => merge([
    tube([P(s, 0.008, 1.368, 0.028), P(s, 0.022, 1.42, 0.022), P(s, 0.027, 1.5, 0.02), P(s, 0.03, 1.55, 0.015)], 0.0045, { segments: 30 }),
    tube([P(s, 0.03, 1.55, 0.015), P(s, 0.035, 1.6, 0.0), P(s, 0.022, 1.64, -0.01)], 0.0032, { segments: 16 }),
    tube([P(s, 0.03, 1.55, 0.015), P(s, 0.045, 1.58, 0.035), P(s, 0.05, 1.62, 0.04)], 0.0028, { segments: 16 })
  ]), C.artery);
  pair('circulatory', 'jugular', 'الوريد الوداجي الباطن', 'Internal jugular vein', 'الوريد الرئيسي الذي يصرّف الدم من الدماغ والوجه والرقبة، ينزل بجانب الشريان السباتي ويتحد مع الوريد تحت الترقوة ليشكل الوريد العضدي الرأسي.', (s) =>
    tube([P(s, 0.045, 1.61, -0.02), P(s, 0.042, 1.53, 0.012), P(s, 0.038, 1.45, 0.02), P(s, 0.03, 1.405, 0.03), ...(s > 0 ? [[0.0, 1.408, 0.034], [-0.026, 1.402, 0.031]] : [[-0.028, 1.4, 0.03]])], 0.005, { segments: 30 }), C.vein);
  pair('circulatory', 'arm_art', 'شرايين الطرف العلوي', 'Arm arteries', 'يبدأ من الشريان تحت الترقوة، ثم يصبح الشريان الإبطي ثم العضدي الذي يقاس عليه ضغط الدم، وينقسم عند المرفق إلى الشريانين الكعبري (حيث يُجس النبض عند الرسغ) والزندي، اللذين يتحدان في راحة اليد مشكلين الأقواس الراحية.', (s) => merge([
    tube([s > 0 ? [0.012, 1.368, 0.02] : [-0.005, 1.372, 0.03], P(s, 0.04, 1.4, 0.022), P(s, 0.08, 1.415, 0.015), P(s, 0.13, 1.4, 0.0), P(s, 0.175, 1.36, 0.008), P(s, 0.21, 1.24, 0.024), P(s, 0.232, 1.13, 0.03)], 0.0038, { segments: 60 }),
    tube([P(s, 0.232, 1.13, 0.03), P(s, 0.255, 1.0, 0.035), P(s, 0.288, 0.87, 0.032), P(s, 0.29, 0.82, 0.03)], 0.0026, { segments: 30 }),
    tube([P(s, 0.232, 1.13, 0.03), P(s, 0.24, 1.0, 0.024), P(s, 0.262, 0.87, 0.026), P(s, 0.27, 0.82, 0.03)], 0.0026, { segments: 30 }),
    tube([P(s, 0.27, 0.82, 0.03), P(s, 0.28, 0.808, 0.034), P(s, 0.29, 0.82, 0.03)], 0.0018, { segments: 12 })
  ]), C.artery);
  pair('circulatory', 'leg_art', 'شرايين الطرف السفلي', 'Leg arteries', 'يتفرع الشريان الحرقفي المشترك إلى الحرقفي الباطن (للحوض) والظاهر الذي يصبح الشريان الفخذي في أعلى الفخذ، ثم الشريان المأبضي خلف الركبة، ثم ينقسم إلى الظنبوبي الأمامي والخلفي والشظوي لتغذية الساق والقدم.', (s) => merge([
    tube([[0.0, 0.975, spineZ(0.975) + 0.035], P(s, 0.035, 0.945, -0.005), P(s, 0.065, 0.91, 0.03), P(s, 0.088, 0.87, 0.055), P(s, 0.085, 0.75, 0.04), P(s, 0.075, 0.64, 0.0), P(s, 0.092, 0.54, -0.045), P(s, 0.1, 0.46, -0.035)], 0.0055, { segments: 80 }),
    tube([P(s, 0.1, 0.46, -0.035), P(s, 0.115, 0.44, 0.0), P(s, 0.108, 0.25, 0.018), P(s, 0.098, 0.09, 0.03), P(s, 0.1, 0.05, 0.08)], 0.003, { segments: 40 }),
    tube([P(s, 0.1, 0.46, -0.035), P(s, 0.094, 0.3, -0.03), P(s, 0.08, 0.1, -0.022), P(s, 0.078, 0.04, 0.0)], 0.0032, { segments: 40 })
  ]), C.artery);
  pair('circulatory', 'leg_vein', 'أوردة الطرف السفلي', 'Leg veins', 'تشمل الأوردة العميقة (الفخذي والمأبضي) المرافقة للشرايين، والوريد الصافن الكبير السطحي، وهو أطول وريد في الجسم يمتد من القدم حتى أعلى الفخذ ويستخدم في جراحات تحويل مسار الشريان التاجي. تحتوي على صمامات تمنع رجوع الدم، وضعفها يسبب الدوالي.', (s) => merge([
    tube([[-0.012, 0.965, spineZ(0.965) + 0.028], P(s, 0.03, 0.935, -0.01), P(s, 0.058, 0.905, 0.025), P(s, 0.078, 0.87, 0.05), P(s, 0.075, 0.75, 0.035), P(s, 0.066, 0.64, -0.005), P(s, 0.085, 0.54, -0.05), P(s, 0.092, 0.46, -0.04)], 0.0065, { segments: 80 }),
    tube([P(s, 0.078, 0.87, 0.05), P(s, 0.06, 0.75, 0.05), P(s, 0.05, 0.6, 0.03), P(s, 0.06, 0.48, -0.005), P(s, 0.066, 0.3, 0.0), P(s, 0.072, 0.1, 0.015), P(s, 0.068, 0.07, 0.03), P(s, 0.085, 0.05, 0.08)], 0.0028, { segments: 90 })
  ]), C.vein);
  pair('circulatory', 'renal_art', 'الشريان والوريد الكلويان', 'Renal vessels', 'يتفرع الشريانان الكلويان من الأبهر البطني ليحملا نحو 20% من ناتج القلب إلى الكليتين لتنقيته، بينما تعيد الأوردة الكلوية الدم المنقى إلى الوريد الأجوف السفلي.', (s) => merge([
    tube([[0.012, 1.075, spineZ(1.075) + 0.034], P(s, 0.03, 1.07, -0.035), P(s, 0.042, 1.065, -0.045)], 0.003, { segments: 12 }),
    tube([[-0.018, 1.06, spineZ(1.06) + 0.03], P(s, 0.03, 1.058, -0.03), P(s, 0.042, 1.055, -0.042)], 0.0035, { segments: 12 })
  ]), C.artery);
}

// ---------------------------------------------------------------------------
// RESPIRATORY SYSTEM
function buildRespiratory(add, pair, P) {
  add('respiratory', 'larynx', 'الحنجرة', 'Larynx', 'عضو غضروفي في مقدمة العنق يصل البلعوم بالقصبة الهوائية، ويحتوي على الحبال الصوتية المسؤولة عن إصدار الصوت. يشكل غضروفها الدرقي "تفاحة آدم"، ويغلق لسان المزمار مدخلها أثناء البلع.', merge([
    ellipsoid([0, 1.478, 0.032], [0.019, 0.022, 0.017]),
    ellipsoid([0, 1.487, 0.046], [0.012, 0.012, 0.006])
  ]), C.cartilage);
  add('respiratory', 'trachea', 'القصبة الهوائية والشعب', 'Trachea & bronchi', 'أنبوب بطول 10-12 سم تدعمه حلقات غضروفية على شكل حرف C، يمتد من الحنجرة إلى الصدر حيث ينقسم إلى الشعبتين الرئيسيتين اليمنى واليسرى. تبطنه أهداب ومخاط يلتقطان الغبار والجراثيم.', merge([
    tube([[0, 1.458, 0.03], [0, 1.4, 0.022], [0, 1.34, 0.01]], (t) => 0.0085 * (1 + 0.1 * Math.max(0, Math.sin(t * 90))), { segments: 90, radial: 14 }),
    tube([[0, 1.34, 0.01], [0.03, 1.315, 0.004], [0.055, 1.29, -0.004], [0.07, 1.26, -0.008]], (t) => 0.006 - 0.002 * t, { segments: 20 }),
    tube([[0, 1.34, 0.01], [-0.03, 1.32, 0.004], [-0.052, 1.3, -0.004], [-0.068, 1.275, -0.01]], (t) => 0.0065 - 0.002 * t, { segments: 20 })
  ]), C.trachea);
  const heartCut = S.ellipsoid([0.016, 1.262, 0.044], [0.05, 0.065, 0.046], [0.35, 0.3, 0.75]);
  pair('respiratory', 'lung', 'الرئة', 'Lung', 'عضوان إسفنجيان في التجويف الصدري يتم فيهما تبادل الغازات عبر نحو 300 مليون حويصلة هوائية تبلغ مساحتها مجتمعة قرابة 70 متراً مربعاً. الرئة اليمنى ثلاثة فصوص، واليسرى فصان فقط لإفساح المجال للقلب (الثلمة القلبية).', (s) => {
    const base = S.ellipsoid([s * 0.068, 1.285, -0.008], [0.058, 0.118, 0.083]);
    const sdf = S.subtract(0.015,
      S.intersect(0.01, base, S.plane([s * 0.012, 0, 0], [-s, 0, 0]), S.plane([0, 1.17, 0], [0.0, -1, 0.15])),
      heartCut,
      S.cone([s * 0.012, 1.4, -0.06], [s * 0.012, 1.15, -0.06], 0.028)
    );
    return S.sdfGeometry(sdf, [s > 0 ? 0.0 : -0.135, 1.16, -0.1], [s > 0 ? 0.135 : 0.0, 1.41, 0.08], 0.0042, { ao: 0.03 });
  }, C.lung, { fem: true });
  add('respiratory', 'diaphragm', 'الحجاب الحاجز', 'Diaphragm', 'العضلة الرئيسية للتنفس، على شكل قبة تفصل التجويف الصدري عن البطني. عند انقباضها تنخفض فيتسع الصدر ويدخل الهواء (الشهيق)، وعند ارتخائها ترتفع ويخرج الهواء (الزفير). الفواق (الحازوقة) ناتج عن تقلصها اللاإرادي.', (() => {
    const g = dome([0, 1.1, -0.01], [0.128, 0.098], 0.078, { theta: Math.PI / 2 });
    return g;
  })(), C.diaphragm, { side: THREE.DoubleSide });
}

// ---------------------------------------------------------------------------
// DIGESTIVE SYSTEM
function buildDigestive(add, pair, P) {
  const teeth = [];
  for (const [y, z0] of [[1.583, 0.086], [1.568, 0.08]]) {
    for (let i = 0; i < 16; i++) {
      const u = (i / 15) * 2 - 1;
      const x = 0.027 * u, z = z0 - 0.034 * u * u;
      const w = Math.abs(u) > 0.5 ? 0.0045 : 0.0033;
      teeth.push(ellipsoid([x, y, z], [w, 0.0055, Math.abs(u) > 0.5 ? 0.0045 : 0.0022], [0, Math.atan2(u * 0.068, 1), 0], [10, 8]));
    }
  }
  add('digestive', 'teeth', 'الأسنان', 'Teeth', 'للبالغ 32 سناً دائمة: 8 قواطع لقطع الطعام، و4 أنياب لتمزيقه، و8 ضواحك و12 طاحنة لطحنه. مينا الأسنان هي أصلب مادة في جسم الإنسان.', merge(teeth), C.teeth);
  add('digestive', 'tongue', 'اللسان', 'Tongue', 'عضو عضلي مرن يساعد في المضغ وتشكيل لقمة الطعام والبلع والكلام، ويحمل براعم التذوق التي تميز المذاقات الخمسة: الحلو والمالح والحامض والمر والأومامي.', ellipsoid([0, 1.574, 0.05], [0.021, 0.009, 0.033], [-0.15, 0, 0]), C.tongue);
  pair('digestive', 'parotid', 'الغدة النكفية', 'Parotid gland', 'أكبر الغدد اللعابية، تقع أمام الأذن وخلف الفك السفلي، وتفرز اللعاب المصلي الغني بإنزيم الأميليز الذي يبدأ هضم النشويات. التهابها الفيروسي يعرف بالنكاف (أبو كعب).', (s) =>
    ellipsoid(P(s, 0.058, 1.6, 0.0), [0.01, 0.022, 0.016]), 0xe3b27a, { fem: true });
  const esoPts = [[0, 1.52, 0.0], [0, 1.45, 0.005]];
  for (let y = 1.4; y >= 1.2; y -= 0.05) esoPts.push([0.004 + (1.4 - y) * 0.04, y, spineZ(y) + 0.028]);
  esoPts.push([0.02, 1.165, -0.004]);
  add('digestive', 'esophagus', 'المريء', 'Esophagus', 'أنبوب عضلي بطول 25 سم تقريباً يصل البلعوم بالمعدة، يمر خلف القصبة الهوائية والقلب ويعبر الحجاب الحاجز. يدفع الطعام بحركات تموجية (تمعجية)، وتمنع العاصرة السفلية ارتداد الحمض من المعدة.', tube(esoPts, 0.0065, { segments: 60 }), 0xd98277);
  add('digestive', 'stomach', 'المعدة', 'Stomach', 'كيس عضلي على شكل حرف J في الجزء العلوي الأيسر من البطن، يتسع لنحو 1-1.5 لتر. يخلط الطعام بالعصارة المعدية (حمض الهيدروكلوريك وإنزيم الببسين) ليحوله إلى كيموس. تحميه طبقة مخاطية من تأثير الحمض.', tube([[0.02, 1.165, -0.004], [0.045, 1.175, 0.0], [0.065, 1.155, 0.015], [0.072, 1.115, 0.04], [0.055, 1.075, 0.06], [0.025, 1.065, 0.065], [0.0, 1.075, 0.055], [-0.018, 1.08, 0.045]], (t) => {
    if (t < 0.12) return 0.012 + t * 0.15;
    if (t < 0.7) return 0.03 + 0.006 * Math.sin((t - 0.12) * 5);
    return 0.03 - (t - 0.7) * 0.065;
  }, { segments: 80, radial: 20 }), C.stomach);
  add('digestive', 'duodenum', 'الاثنا عشر', 'Duodenum', 'الجزء الأول من الأمعاء الدقيقة بطول نحو 25 سم، على شكل حرف C يحيط برأس البنكرياس. تصب فيه العصارة الصفراوية من الكبد والعصارة البنكرياسية لإكمال الهضم.', tube([[-0.018, 1.08, 0.045], [-0.035, 1.068, 0.03], [-0.04, 1.04, 0.015], [-0.03, 1.015, 0.02], [0.0, 1.012, 0.025], [0.028, 1.03, 0.03]], 0.0105, { segments: 40 }), C.small);
  add('digestive', 'liver', 'الكبد', 'Liver', 'أكبر غدة في الجسم (نحو 1.5 كغ)، تقع في الجزء العلوي الأيمن من البطن تحت الحجاب الحاجز. يؤدي أكثر من 500 وظيفة، منها إنتاج العصارة الصفراوية، وتخزين الجلايكوجين والفيتامينات، وإزالة السموم، وتصنيع بروتينات الدم وعوامل التخثر. وله قدرة فريدة على التجدد.', S.sdfGeometry(S.subtract(0.02,
    S.union(0.035,
      S.ellipsoid([-0.05, 1.125, 0.005], [0.075, 0.062, 0.072]),
      S.ellipsoid([0.03, 1.145, 0.03], [0.06, 0.028, 0.048], [0, 0, -0.15])
    ),
    S.ellipsoid([0.02, 1.08, 0.05], [0.06, 0.03, 0.05]),
    S.plane([0, 1.183, 0], [0, -1, 0])
  ), [-0.13, 1.05, -0.075], [0.095, 1.19, 0.085], 0.0045, { ao: 0.03 }), C.liver);
  add('digestive', 'gallbladder', 'المرارة', 'Gallbladder', 'كيس صغير على شكل كمثرى تحت الكبد، يخزن العصارة الصفراوية ويركزها ثم يفرزها في الاثني عشر بعد تناول الطعام الدهني. تتكون فيه أحياناً حصوات المرارة.', ellipsoid([-0.045, 1.075, 0.066], [0.011, 0.022, 0.011], [0.6, 0, 0.2]), C.gall);
  add('digestive', 'pancreas', 'البنكرياس', 'Pancreas', 'غدة مزدوجة الوظيفة خلف المعدة: خارجية الإفراز تنتج إنزيمات هاضمة للبروتينات والدهون والنشويات، وداخلية الإفراز (جزر لانغرهانس) تنتج هرموني الإنسولين والجلوكاجون لتنظيم سكر الدم.', tube([[-0.03, 1.035, 0.012], [0.0, 1.048, 0.0], [0.035, 1.058, -0.012], [0.07, 1.075, -0.03], [0.088, 1.09, -0.04]], (t) => 0.013 - 0.006 * t, { segments: 30, flat: 0.6 }), C.pancreas);
  add('digestive', 'spleen', 'الطحال', 'Spleen', 'عضو لمفاوي في الجزء العلوي الأيسر من البطن خلف المعدة، يرشح الدم ويزيل كريات الدم الحمراء الهرمة، ويخزن الصفائح الدموية، ويشارك في المناعة بإنتاج الخلايا اللمفاوية. يمكن العيش بدونه.', ellipsoid([0.098, 1.125, -0.048], [0.02, 0.045, 0.03], [0.2, 0.5, -0.3]), C.spleen);

  // small intestine: a smooth serpentine "base" path with a tight coil wrapped around it
  const base = [];
  const rowsY = [1.022, 0.994, 0.966, 0.938];
  base.push(new THREE.Vector3(0.03, 1.035, 0.03));
  rowsY.forEach((y, r) => {
    const dir = r % 2 === 0 ? -1 : 1;
    for (let k = 0; k <= 20; k++) {
      const x = dir * (0.058 - (k / 20) * 0.116);
      base.push(new THREE.Vector3(x, y + 0.004 * Math.sin(k * 0.9), 0.05 + 0.012 * Math.sin(k * 0.7 + r)));
    }
  });
  base.push(new THREE.Vector3(-0.07, 0.925, 0.045));
  const baseCurve = new THREE.CatmullRomCurve3(base, false, 'centripetal');
  const si = [];
  const N0 = new THREE.Vector3(0, 0, 1);
  const L = baseCurve.getLength();
  const n = 700;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = baseCurve.getPointAt(t);
    const T = baseCurve.getTangentAt(t);
    const B = new THREE.Vector3().crossVectors(T, N0).normalize();
    const N = new THREE.Vector3().crossVectors(B, T).normalize();
    const ang = t * L * 190;
    const rc = 0.0105 * Math.min(1, t * 20, (1 - t) * 20);
    si.push(p.addScaledVector(N, Math.cos(ang) * rc).addScaledVector(B, Math.sin(ang) * rc));
  }
  si.push(new THREE.Vector3(-0.08, 0.922, 0.042));
  add('digestive', 'small_int', 'الأمعاء الدقيقة', 'Small intestine', 'أنبوب ملتف بطول 6-7 أمتار (الاثنا عشر والصائم واللفائفي)، يتم فيه معظم الهضم والامتصاص. تغطي جداره الداخلي ملايين الزغابات التي تزيد مساحة الامتصاص إلى نحو 30 متراً مربعاً.', tube(si, 0.0072, { segments: 1400, radial: 10, tension: 0.5 }), C.small);
  const li = [[-0.083, 0.915, 0.045], [-0.092, 0.96, 0.035], [-0.095, 1.02, 0.03], [-0.09, 1.068, 0.04], [-0.06, 1.058, 0.075], [0.0, 1.05, 0.082], [0.05, 1.058, 0.075], [0.092, 1.09, 0.02], [0.1, 1.04, 0.01], [0.098, 0.97, 0.015], [0.085, 0.925, 0.03], [0.05, 0.9, 0.05], [0.02, 0.905, 0.02], [0.0, 0.89, -0.03], [0.0, 0.86, -0.05], [0.0, 0.83, -0.042]];
  add('digestive', 'large_int', 'الأمعاء الغليظة (القولون)', 'Large intestine (Colon)', 'أنبوب بطول 1.5 متر تقريباً يحيط بالأمعاء الدقيقة كالإطار: الأعور، والقولون الصاعد والمستعرض والنازل والسيني، ثم المستقيم. يمتص الماء والأملاح ويحول الفضلات إلى براز، وتعيش فيه بكتيريا نافعة تنتج فيتامين K.', tube(li, (t) => (0.018 - 0.006 * t) * (1 + 0.1 * Math.sin(t * 140)), { segments: 300, radial: 16 }), C.large);
  add('digestive', 'appendix', 'الزائدة الدودية', 'Appendix', 'أنبوب صغير مسدود الطرف بطول نحو 9 سم يتصل بالأعور. يعتقد أنها تحتوي على نسيج لمفاوي وتحفظ البكتيريا النافعة. التهابها حالة طارئة تستدعي الجراحة غالباً.', tube([[-0.086, 0.905, 0.045], [-0.08, 0.885, 0.055], [-0.065, 0.88, 0.062], [-0.055, 0.888, 0.066]], 0.0035, { segments: 20 }), C.large);
}

// ---------------------------------------------------------------------------
// URINARY SYSTEM
function buildUrinary(add, pair, P) {
  pair('urinary', 'kidney', 'الكلية', 'Kidney', 'عضوان على شكل حبة الفاصولياء بحجم قبضة اليد، يقعان خلف البطن على جانبي العمود الفقري (اليمنى أخفض قليلاً بسبب الكبد). تحتوي كل كلية على نحو مليون نفرون، وترشحان قرابة 180 لتراً من الدم يومياً لإنتاج 1-2 لتر من البول، وتنظمان ضغط الدم وتوازن الأملاح وإنتاج كريات الدم الحمراء.', (s) => {
    const y = s > 0 ? 1.07 : 1.058;
    const sdf = S.subtract(0.008, S.ellipsoid([s * 0.062, y, -0.055], [0.022, 0.048, 0.019], [0, s * 0.3, s * 0.18]), S.sphere([s * 0.036, y - 0.004, -0.045], 0.013));
    return S.sdfGeometry(sdf, [s * 0.062 - 0.035, y - 0.06, -0.085], [s * 0.062 + 0.035, y + 0.06, -0.025], 0.0028, { ao: 0.012 });
  }, C.kidney, { fem: true });
  pair('urinary', 'ureter', 'الحالب', 'Ureter', 'أنبوب عضلي رفيع بطول 25-30 سم ينقل البول من حوض الكلية إلى المثانة بحركات تمعجية. قد تنحشر فيه حصوات الكلى مسببة مغصاً كلوياً شديداً.', (s) =>
    tube([P(s, 0.042, (s > 0 ? 1.064 : 1.052), -0.045), P(s, 0.045, 1.0, -0.035), P(s, 0.045, 0.94, -0.02), P(s, 0.04, 0.9, 0.01), P(s, 0.018, 0.88, 0.03)], 0.0024, { segments: 40 }), 0xd2a55a);
  add('urinary', 'bladder', 'المثانة البولية', 'Urinary bladder', 'كيس عضلي مرن في الحوض خلف عظم العانة، يخزن البول حتى 400-600 مل. تسمح عضلتها (النافصة) بالتمدد، ويتحكم في إفراغها منعكس عصبي تحت سيطرة إرادية.', ellipsoid([0, 0.875, 0.045], [0.026, 0.022, 0.024]), C.bladder);
  add('urinary', 'urethra', 'الإحليل', 'Urethra', 'القناة التي تنقل البول من المثانة إلى خارج الجسم، وتحيط بها عاصرة عضلية إرادية تتحكم في التبول.', tube([[0, 0.852, 0.05], [0, 0.835, 0.056], [0, 0.815, 0.06]], 0.0022, { segments: 10 }), 0xd2a55a);
}

// ---------------------------------------------------------------------------
// ENDOCRINE
function buildEndocrine(add, pair, P) {
  add('endocrine', 'thyroid', 'الغدة الدرقية', 'Thyroid gland', 'غدة على شكل فراشة في مقدمة العنق تحت الحنجرة، تفرز هرمونات الثيروكسين (T4) وثلاثي يود الثيرونين (T3) التي تنظم معدل الأيض والنمو ودرجة حرارة الجسم، وتحتاج إلى اليود لإنتاجها. كما تفرز الكالسيتونين المنظم للكالسيوم.', merge([
    ellipsoid([0.016, 1.448, 0.036], [0.009, 0.021, 0.009], [0, 0, -0.2]),
    ellipsoid([-0.016, 1.448, 0.036], [0.009, 0.021, 0.009], [0, 0, 0.2]),
    ellipsoid([0, 1.442, 0.042], [0.012, 0.005, 0.004])
  ]), C.gland);
  add('endocrine', 'pituitary', 'الغدة النخامية', 'Pituitary gland', 'غدة بحجم حبة البازلاء في قاعدة الدماغ داخل السرج التركي، تسمى "الغدة الرئيسية" لأنها تتحكم في معظم الغدد الأخرى. تفرز هرمون النمو والبرولاكتين والهرمونات المنبهة للدرقية والكظرية والغدد التناسلية.', ellipsoid([0, 1.628, 0.008], [0.005, 0.004, 0.005]), 0xe06c3c);
  add('endocrine', 'pineal', 'الغدة الصنوبرية', 'Pineal gland', 'غدة صغيرة جداً على شكل كوز الصنوبر في وسط الدماغ، تفرز هرمون الميلاتونين الذي ينظم دورة النوم واليقظة حسب الضوء والظلام.', ellipsoid([0, 1.662, -0.03], [0.003, 0.003, 0.005]), 0xe06c3c);
  add('endocrine', 'thymus', 'الغدة الزعترية (التوتة)', 'Thymus', 'غدة في المنصف الأمامي خلف القص، تكون كبيرة في الطفولة وتضمر بعد البلوغ. فيها تنضج الخلايا اللمفاوية التائية (T) المسؤولة عن المناعة الخلوية.', merge([
    ellipsoid([0.01, 1.37, 0.068], [0.012, 0.03, 0.01]),
    ellipsoid([-0.01, 1.37, 0.068], [0.012, 0.028, 0.01])
  ]), 0xe8a0a0);
  pair('endocrine', 'adrenal', 'الغدة الكظرية', 'Adrenal gland', 'غدتان مثلثيتان تعلوان الكليتين. تفرز القشرة الكورتيزول (هرمون التوتر) والألدوستيرون (لتنظيم الأملاح وضغط الدم)، ويفرز اللب الأدرينالين والنورأدرينالين المسؤولين عن استجابة "الكر أو الفر".', (s) =>
    ellipsoid(P(s, 0.056, (s > 0 ? 1.122 : 1.11), -0.052), [0.015, 0.011, 0.007], [0, s * 0.3, s * -0.4]), C.gland, { fem: true });
}

// ---------------------------------------------------------------------------
// SENSORY
function buildSensory(add, pair, P) {
  pair('sensory', 'eye', 'العين', 'Eye', 'كرة قطرها نحو 2.4 سم، يمر الضوء عبر القرنية والحدقة والعدسة ليتركز على الشبكية التي تحتوي على نحو 120 مليون خلية عصوية (للرؤية في الضوء الخافت) و6 ملايين خلية مخروطية (لرؤية الألوان). تحركها ست عضلات خارجية.', (s) => {
    const g = new THREE.SphereGeometry(0.012, 32, 24);
    g.rotateX(Math.PI / 2);
    const colors = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i) / 0.012;
      if (z > 0.93) colors.push(0.05, 0.05, 0.06);
      else if (z > 0.78) colors.push(0.25, 0.45, 0.35);
      else colors.push(0.96, 0.95, 0.92);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.translate(s * 0.031, 1.636, 0.07);
    return g;
  }, 0xffffff, { fem: true, extra: { vertexColors: true } });
  pair('sensory', 'inner_ear', 'الأذن الداخلية (القوقعة)', 'Inner ear (Cochlea)', 'تقع داخل العظم الصدغي، وتضم القوقعة الحلزونية التي تحول الاهتزازات الصوتية إلى إشارات عصبية عبر خلايا شعرية دقيقة، والجهاز الدهليزي (القنوات الهلالية) المسؤول عن التوازن.', (s) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 5;
      const r = 0.007 * (1 - i / 48);
      pts.push(P(s, 0.056 + 0.003 * (i / 40), 1.63 + r * Math.sin(a), -0.01 + r * Math.cos(a)));
    }
    const canals = [];
    for (let k = 0; k < 3; k++) {
      const c = new THREE.TorusGeometry(0.0045, 0.0009, 6, 24);
      if (k === 1) c.rotateY(Math.PI / 2);
      if (k === 2) c.rotateX(Math.PI / 2);
      c.translate(s * 0.062, 1.633, -0.022);
      canals.push(c);
    }
    return merge([tube(pts, (t) => 0.0019 - 0.001 * t, { segments: 120, radial: 8 }), ...canals]);
  }, C.ear, { fem: true });
  pair('sensory', 'ear', 'صيوان الأذن', 'Auricle', 'الجزء الخارجي من الأذن، يتكون من غضروف مرن مغطى بالجلد، ويعمل على تجميع الموجات الصوتية وتوجيهها عبر القناة السمعية إلى طبلة الأذن.', (s) => {
    const g = new THREE.TorusGeometry(0.018, 0.004, 10, 32, Math.PI * 1.7);
    g.scale(0.7, 1.2, 1);
    g.rotateZ(-Math.PI * 0.35);
    g.rotateY(s * Math.PI / 2);
    g.translate(s * 0.086, 1.64, -0.008);
    return merge([g, ellipsoid(P(s, 0.084, 1.632, -0.002), [0.004, 0.01, 0.008])]);
  }, 0xe0a88a);
}
