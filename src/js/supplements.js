// Simplified structures that BodyParts3D does not contain (thyroid gland,
// parathyroids, lymph nodes, lymphatic ducts). They are positioned from
// landmarks on the real meshes so they sit in the right place.
import * as THREE from 'three';
import { tube, ellipsoid, merge } from './geo.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildSupplements(parts, makeMaterial) {
  const byName = new Map(parts.map((p) => [p.en.toLowerCase(), p]));
  const find = (n) => byName.get(n);
  const points = (n, filter = () => true) => {
    const p = find(n);
    if (!p) return [];
    const a = p.mesh.geometry.attributes.position, out = [];
    for (let i = 0; i < a.count; i++) {
      const v = new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i));
      if (filter(v)) out.push(v);
    }
    return out;
  };
  const box = (n) => find(n)?.mesh.geometry.boundingBox;
  const out = [];
  const add = (id, system, en, ar, descEn, descAr, geo, color) => {
    if (!geo) return;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    out.push({ id, system, en, ar, descEn, descAr, mesh: new THREE.Mesh(geo, makeMaterial(system, color)), generated: true });
  };

  // ---- Thyroid & parathyroid glands -------------------------------------
  const tc = box('thyroid cartilage'), tr = box('trachea');
  if (tc && tr) {
    const cx = (tr.min.x + tr.max.x) / 2;
    const front = tr.max.z;
    const top = tc.min.y - 0.004;
    const lobes = [-1, 1].map((s) => ellipsoid([cx + s * 0.018, top - 0.02, front - 0.006], [0.0105, 0.023, 0.009], [0, 0, -s * 0.18]));
    const isthmus = ellipsoid([cx, top - 0.03, front + 0.002], [0.012, 0.006, 0.004]);
    add('SUP_THYROID', 'endocrine', 'Thyroid gland', 'الغدة الدرقية',
      'Butterfly-shaped gland in front of the trachea below the larynx. It secretes thyroxine (T4) and triiodothyronine (T3), which regulate metabolism, growth and body temperature, and calcitonin, which lowers blood calcium.',
      'غدة على شكل فراشة أمام القصبة الهوائية أسفل الحنجرة، تفرز هرموني الثيروكسين وثلاثي يود الثيرونين اللذين ينظمان الأيض والنمو وحرارة الجسم، والكالسيتونين الذي يخفض كالسيوم الدم.',
      merge([...lobes, isthmus]), 0xd9773a);
    const para = [];
    for (const s of [-1, 1]) for (const dy of [-0.008, -0.032]) para.push(ellipsoid([cx + s * 0.02, top + dy, front - 0.016], [0.003, 0.004, 0.0025]));
    add('SUP_PARATHYROID', 'endocrine', 'Parathyroid glands', 'الغدد جارات الدرقية',
      'Four small glands on the back of the thyroid. Their parathyroid hormone raises blood calcium by acting on bone, kidney and (via vitamin D) the gut.',
      'أربع غدد صغيرة خلف الغدة الدرقية، يرفع هرمونها (الباراثورمون) مستوى الكالسيوم في الدم عبر تأثيره على العظام والكلى والأمعاء.',
      merge(para), 0xc9a24a);
  }

  // ---- Lymph nodes ------------------------------------------------------
  const nodeCluster = (pts, n, seed, rMin = 0.003, rMax = 0.006, spread = 0.009) => {
    if (pts.length < 3) return null;
    const r = rng(seed), geos = [];
    for (let i = 0; i < n; i++) {
      const p = pts[Math.floor(r() * pts.length)];
      const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(spread * (0.6 + r() * 0.6));
      const rad = rMin + r() * (rMax - rMin);
      geos.push(ellipsoid([p.x + d.x, p.y + d.y, p.z + d.z], [rad, rad * (1.2 + r() * 0.5), rad * 0.85], [r(), r(), r()], [12, 8]));
    }
    return merge(geos);
  };
  const LN = 0x6fcf86;
  const groups = [
    ['cervical', 'internal jugular vein', 9, 0, 1, 'Cervical lymph nodes', 'العقد اللمفاوية العنقية',
      'Chains of nodes along the internal jugular vein that filter lymph from the head and neck; they enlarge in throat and dental infections.',
      'سلاسل من العقد على طول الوريد الوداجي الباطن، ترشّح اللمف القادم من الرأس والعنق، وتتضخم عند التهابات الحلق والأسنان.'],
    ['axillary', 'axillary vein', 10, 0, 1, 'Axillary lymph nodes', 'العقد اللمفاوية الإبطية',
      'Nodes in the armpit draining the upper limb and most of the breast; important in the staging of breast cancer.',
      'عقد في الإبط تصرّف اللمف من الطرف العلوي ومعظم الثدي، ولها أهمية كبيرة في تحديد مرحلة سرطان الثدي.'],
    ['cubital', 'median cubital vein', 3, 0, 1, 'Cubital lymph nodes', 'العقد اللمفاوية المرفقية',
      'Small nodes above the elbow that filter lymph from the hand and medial forearm.',
      'عقد صغيرة فوق المرفق ترشّح اللمف القادم من اليد والجهة الإنسية للساعد.'],
    ['inguinal', 'femoral vein', 8, 0.75, 1, 'Inguinal lymph nodes', 'العقد اللمفاوية الأربية',
      'Nodes in the groin receiving lymph from the lower limb, perineum and lower abdominal wall.',
      'عقد في أصل الفخذ تستقبل اللمف من الطرف السفلي والعجان وأسفل جدار البطن.'],
    ['popliteal', 'popliteal vein', 4, 0, 1, 'Popliteal lymph nodes', 'العقد اللمفاوية المأبضية',
      'Nodes in the fat behind the knee draining the leg and foot.',
      'عقد في النسيج الدهني خلف الركبة تصرّف اللمف من الساق والقدم.']
  ];
  let seed = 11;
  for (const [key, vein, n, from, to, en, ar, dEn, dAr] of groups) {
    for (const side of ['left', 'right']) {
      const name = `${side} ${vein}`;
      const b = box(name);
      if (!b) continue;
      const y0 = b.min.y + (b.max.y - b.min.y) * from, y1 = b.min.y + (b.max.y - b.min.y) * to;
      const pts = points(name, (v) => v.y >= y0 && v.y <= y1);
      const sideAr = ar.endsWith('ية') ? (side === 'left' ? 'اليسرى' : 'اليمنى') : side === 'left' ? 'اليسرى' : 'اليمنى';
      add(`SUP_LN_${key}_${side[0]}`, 'lymphatic', `${en} (${side})`, `${ar} ${sideAr}`, dEn, dAr, nodeCluster(pts, n, seed++), LN);
    }
  }
  const mid = [
    ['para-aortic', 'abdominal aorta', 12, 'Para-aortic lymph nodes', 'العقد اللمفاوية جانب الأبهر',
      'Nodes around the abdominal aorta that drain the kidneys, adrenal glands, gonads and posterior abdominal wall.',
      'عقد حول الأبهر البطني تصرّف اللمف من الكليتين والغدتين الكظريتين والغدد التناسلية وجدار البطن الخلفي.'],
    ['mesenteric', 'superior mesenteric vein', 12, 'Mesenteric lymph nodes', 'العقد اللمفاوية المساريقية',
      'Hundreds of nodes in the mesentery that filter lymph (chyle) rich in absorbed fats from the intestine.',
      'مئات العقد في المساريقا ترشّح اللمف الحليبي (الكيلوس) الغني بالدهون الممتصة من الأمعاء.'],
    ['tracheobronchial', 'trachea', 9, 'Mediastinal (tracheobronchial) lymph nodes', 'العقد اللمفاوية المنصفية (الرغامية القصبية)',
      'Nodes around the trachea and main bronchi that drain the lungs; they are often examined in lung cancer staging.',
      'عقد حول القصبة الهوائية والقصبتين الرئيسيتين تصرّف اللمف من الرئتين، وتُفحص كثيراً عند تحديد مرحلة سرطان الرئة.']
  ];
  for (const [key, ref, n, en, ar, dEn, dAr] of mid) {
    const b = box(ref);
    if (!b) continue;
    const y0 = key === 'tracheobronchial' ? b.min.y : b.min.y, y1 = key === 'tracheobronchial' ? b.min.y + (b.max.y - b.min.y) * 0.45 : b.max.y;
    add(`SUP_LN_${key}`, 'lymphatic', en, ar, dEn, dAr, nodeCluster(points(ref, (v) => v.y >= y0 && v.y <= y1), n, seed++, 0.003, 0.006, 0.012), LN);
  }

  // ---- Thoracic duct & right lymphatic duct ----------------------------
  const aorta = box('abdominal aorta'), lij = box('left internal jugular vein'), lsv = box('left subclavian vein');
  const esoph = box('esophagus');
  if (aorta && lij && lsv && esoph) {
    const start = new THREE.Vector3((aorta.min.x + aorta.max.x) / 2 - 0.008, aorta.max.y - 0.03, aorta.min.z - 0.004);
    const pts = [start];
    const yTop = lij.min.y + 0.01;
    for (let k = 1; k <= 6; k++) {
      const t = k / 7;
      const y = start.y + (yTop - start.y) * t;
      const eso = points('esophagus', (v) => Math.abs(v.y - y) < 0.01);
      let x = 0, z = 0;
      if (eso.length) { for (const v of eso) { x += v.x; z = Math.min(z, v.z); } x /= eso.length; }
      pts.push(new THREE.Vector3(x + (t > 0.6 ? 0.012 : -0.004), y, (eso.length ? z : start.z) - 0.006));
    }
    const angle = points('left internal jugular vein', (v) => v.y < lij.min.y + 0.012);
    const a = angle.reduce((m, v) => m.add(v), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, angle.length));
    pts.push(new THREE.Vector3(a.x - 0.004, a.y + 0.02, a.z - 0.008), a);
    const duct = merge([
      tube(pts.map((v) => v.toArray()), 0.0022, { segments: 120, radial: 8 }),
      ellipsoid(start.toArray(), [0.006, 0.014, 0.005])
    ]);
    add('SUP_THORACIC_DUCT', 'lymphatic', 'Thoracic duct and cisterna chyli', 'القناة الصدرية والصهريج الكيلوسي',
      'The largest lymphatic vessel. It begins at the cisterna chyli in the abdomen, ascends through the thorax and empties into the left venous angle, returning about three-quarters of the body\'s lymph to the blood.',
      'أكبر وعاء لمفاوي في الجسم، يبدأ من الصهريج الكيلوسي في البطن ويصعد عبر الصدر ليصب في الزاوية الوريدية اليسرى، معيداً نحو ثلاثة أرباع لمف الجسم إلى الدم.',
      duct, 0x9ee6b0);
  }
  return out;
}
