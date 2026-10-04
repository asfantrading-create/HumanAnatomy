// Female body. BodyParts3D only contains a male body, so the female variant is
// produced by (1) a smooth spatial warp applied to every mesh (narrower shoulders
// and waist, wider pelvis, slightly smaller stature), (2) reshaping the skin
// (breasts, external genital region) and (3) simplified female reproductive
// organs and mammary glands placed from landmarks of the real pelvis.
import * as THREE from 'three';
import { tube, ellipsoid, merge } from './geo.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (c, w, x) => Math.exp(-(((x - c) / w) ** 2));

function landmarks(parts) {
  const by = new Map(parts.map((p) => [p.en.toLowerCase(), p]));
  const box = (n) => by.get(n)?.mesh.geometry.boundingBox.clone();
  const femur = box('left femur'), hip = box('left hip bone'), humerus = box('left humerus');
  const rib12 = box('left twelfth rib') || box('left eleventh rib'), rib4 = box('left fourth rib');
  const bladder = box('urinary bladder'), rectum = box('rectum'), skin = box('skin');
  return {
    hipY: femur.max.y - 0.02,
    crestY: hip.max.y,
    waistY: (hip.max.y + (rib12 ? rib12.min.y : hip.max.y + 0.12)) / 2,
    chestY: rib4 ? (rib4.min.y + rib4.max.y) / 2 : 1.25,
    shoulderY: humerus.max.y,
    kneeY: femur.min.y + 0.04,
    bladder, rectum, skin, hip
  };
}

/** Builds the warp p -> p' for a female shape. */
function makeWarp(L) {
  const S = 0.955; // overall stature
  return (v) => {
    const ax = Math.abs(v.x), sx = Math.sign(v.x) || 1, y = v.y;
    // arms hang beside the trunk: they follow the (narrower) shoulders
    const armW = smooth(0.15, 0.19, ax) * smooth(L.kneeY + 0.15, L.hipY - 0.12, y);
    // width profile of trunk and thighs
    let s = 1
      - 0.05 * bump(L.chestY + 0.04, 0.1, y)
      - 0.13 * bump(L.waistY, 0.075, y)
      + 0.09 * bump(L.hipY + 0.01, 0.09, y);
    if (y < L.hipY) s += 0.055 * smooth(L.kneeY, L.hipY, y) * (1 - bump(L.hipY + 0.01, 0.09, y));
    let x = v.x * (1 + (s - 1) * (1 - armW));
    x -= sx * 0.028 * armW;
    // shoulders slope a little and narrow
    x -= sx * 0.022 * smooth(0.06, 0.16, ax) * smooth(L.chestY, L.shoulderY, y) * (1 - armW);
    // fuller buttocks
    let z = v.z;
    if (z < -0.02) z -= 0.022 * bump(L.hipY - 0.02, 0.07, y) * smooth(0.0, 0.08, ax) * (1 - armW) * smooth(-0.02, -0.08, z);
    v.set(x * S, y * S, z * S);
  };
}

export function prepareFemale(parts, makeMaterial) {
  const L = landmarks(parts);
  const warp = makeWarp(L);
  const v = new THREE.Vector3();

  // ---- female organs (in un-warped male coordinates, warped afterwards) ----
  const b = L.bladder, r = L.rectum;
  const pelvisCx = 0;
  const uz = (b.min.z + r.max.z) / 2 + 0.004;           // between bladder and rectum
  const uy = b.max.y + 0.012;
  const added = [];
  const add = (id, en, ar, descEn, descAr, geo, color) => {
    added.push({ id, system: 'reproductive', en, ar, descEn, descAr, geo, color, sexOnly: 'f', generated: true });
  };
  // uterus: pear shape, anteverted (fundus tilted forward over the bladder)
  const uterusPts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r0 = t < 0.35 ? 0.008 + 0.014 * (t / 0.35) : 0.022 + 0.008 * Math.sin(((t - 0.35) / 0.65) * Math.PI * 0.5);
    // rounded dome at the fundus
    const dome = t > 0.78 ? Math.sqrt(Math.max(0, 1 - ((t - 0.78) / 0.22) ** 2)) : 1;
    uterusPts.push(new THREE.Vector2(Math.max(0.0005, r0 * dome), t * 0.068));
  }
  const uterus = new THREE.LatheGeometry(uterusPts, 32);
  uterus.scale(0.95, 1, 0.6);
  uterus.rotateX(0.75);
  uterus.translate(pelvisCx, uy - 0.04, uz - 0.012);
  add('F_UTERUS', 'Uterus', 'الرحم', 'Hollow, pear-shaped muscular organ in the pelvis between the bladder and rectum. Its thick muscular wall (myometrium) and lining (endometrium) host the developing fetus during pregnancy; the endometrium is shed each month in menstruation.', 'عضو عضلي أجوف على شكل الكمثرى في الحوض بين المثانة والمستقيم، تحتضن جدرانه العضلية (العضل الرحمي) وبطانته (بطانة الرحم) الجنين أثناء الحمل، وتنسلخ البطانة شهرياً في الدورة الشهرية.', uterus, 0xd98f9a);
  const cervixTop = new THREE.Vector3(pelvisCx, uy - 0.04, uz - 0.012);
  add('F_CERVIX', 'Cervix of uterus', 'عنق الرحم', 'The narrow lower part of the uterus that opens into the vagina. Its glands produce mucus that changes during the cycle, and it dilates during childbirth.', 'الجزء السفلي الضيق من الرحم الذي ينفتح في المهبل، تفرز غدده مخاطاً يتغير خلال الدورة، ويتوسع أثناء الولادة.', ellipsoid([cervixTop.x, cervixTop.y - 0.004, cervixTop.z - 0.004], [0.012, 0.016, 0.011], [0.75, 0, 0]), 0xc77d8a);
  const vag = [[cervixTop.x, cervixTop.y - 0.012, cervixTop.z - 0.006], [0, b.min.y - 0.008, cervixTop.z + 0.008], [0, b.min.y - 0.028, b.min.z + 0.03], [0, b.min.y - 0.04, b.min.z + 0.046]];
  add('F_VAGINA', 'Vagina', 'المهبل', 'Muscular canal about 8 cm long extending from the cervix to the vulva, between the urethra in front and the rectum behind; it serves as the birth canal.', 'قناة عضلية بطول نحو 8 سم تمتد من عنق الرحم إلى الفرج، بين الإحليل أمامها والمستقيم خلفها، وتشكل قناة الولادة.', tube(vag, (t) => 0.011 - 0.002 * t, { segments: 40, flat: 0.45, radial: 16 }), 0xd88b97);
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'left' : 'right';
    const sAr = s > 0 ? 'الأيسر' : 'الأيمن', sArF = s > 0 ? 'اليسرى' : 'اليمنى';
    const ov = new THREE.Vector3(s * 0.058, uy - 0.006, uz - 0.012);
    add(`F_OVARY_${side[0]}`, `Ovary (${side})`, `المبيض ${sAr}`, 'Almond-sized female gonad on the lateral pelvic wall. It contains follicles that release an egg (ovum) each cycle and secretes the hormones estrogen and progesterone.', 'الغدة التناسلية الأنثوية بحجم حبة اللوز على الجدار الجانبي للحوض، تحتوي على الجريبات التي تطلق بويضة في كل دورة، وتفرز هرموني الإستروجين والبروجسترون.', ellipsoid(ov.toArray(), [0.008, 0.017, 0.01], [0.3, 0, s * 0.5]), 0xe6b3c0);
    const corn = new THREE.Vector3(s * 0.024, uy + 0.024, uz + 0.026);
    const tubePts = [corn.toArray(), [s * 0.045, uy + 0.026, uz + 0.012], [s * 0.07, uy + 0.012, uz - 0.004], [s * 0.072, uy - 0.006, uz - 0.022], [s * 0.06, uy - 0.016, uz - 0.022]];
    const fimbriae = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      fimbriae.push(tube([[s * 0.06, uy - 0.016, uz - 0.022], [s * (0.06 + 0.006 * Math.cos(a)), uy - 0.026, uz - 0.022 + 0.006 * Math.sin(a)]], 0.0012, { segments: 4, radial: 5 }));
    }
    add(`F_TUBE_${side[0]}`, `Uterine (fallopian) tube (${side})`, `قناة فالوب ${sArF}`, 'Narrow tube about 10 cm long running from the uterus towards the ovary; its fimbriae catch the released egg, and fertilisation usually occurs in its ampulla.', 'أنبوب دقيق بطول نحو 10 سم يمتد من الرحم نحو المبيض، تلتقط أهدابه البويضة المنطلقة، ويحدث الإخصاب عادة في الجزء المتسع منه (الأمبولة).', merge([tube(tubePts, (t) => 0.0022 + 0.0022 * t, { segments: 40, radial: 10 }), ...fimbriae]), 0xe39aa8);
    add(`F_LIG_${side[0]}`, `Ovarian and round ligaments (${side})`, `الرباطان المبيضي والمدوّر ${sAr}`, 'The ovarian ligament anchors the ovary to the uterus; the round ligament runs from the uterus through the inguinal canal and keeps the uterus tilted forward.', 'يثبت الرباط المبيضي المبيض بالرحم، ويمتد الرباط المدوّر من الرحم عبر القناة الإربية ويحافظ على ميلان الرحم للأمام.',
      merge([tube([ov.toArray(), [s * 0.03, uy + 0.008, uz + 0.008], [s * 0.02, uy + 0.016, uz + 0.016]], 0.0016, { segments: 16, radial: 6 }),
        tube([[s * 0.022, uy + 0.018, uz + 0.026], [s * 0.06, uy + 0.03, b.max.z + 0.01], [s * 0.085, L.hip.max.y - 0.12, b.max.z + 0.035]], 0.0014, { segments: 24, radial: 6 })]), 0xe6dccb);
  }

  // ---- breasts: mammary gland + skin bulge ----
  const skinPart = parts.find((p) => p.system === 'skin' && p.en.toLowerCase() === 'skin');
  const skinPos = skinPart.mesh.geometry.attributes.position;
  const frontZ = (x, y) => {
    let z = -1;
    for (let i = 0; i < skinPos.count; i++) {
      if (Math.abs(skinPos.getX(i) - x) < 0.012 && Math.abs(skinPos.getY(i) - y) < 0.012) z = Math.max(z, skinPos.getZ(i));
    }
    return z;
  };
  const breasts = [-1, 1].map((s) => {
    const cx = s * 0.092, cy = L.chestY - 0.01;
    return { s, cx, cy, z: frontZ(cx, cy), rx: 0.075, ry: 0.068, h: 0.06 };
  });
  for (const B of breasts) {
    const side = B.s > 0 ? 'left' : 'right';
    const lobes = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const d = 0.026 + 0.008 * Math.sin(k * 1.7);
      const p = [B.cx + Math.cos(a) * d, B.cy - 0.012 + Math.sin(a) * d * 0.95, B.z + 0.012];
      lobes.push(ellipsoid(p, [0.011, 0.011, 0.012], [0, 0, a], [10, 8]));
      lobes.push(tube([p, [B.cx + Math.cos(a) * 0.004, B.cy - 0.012 + Math.sin(a) * 0.004, B.z + B.h * 0.85]], 0.0011, { segments: 6, radial: 5 }));
    }
    add(`F_BREAST_${side[0]}`, `Mammary gland (${side})`, `الغدة الثديية ${B.s > 0 ? 'اليسرى' : 'اليمنى'}`, 'Modified sweat gland within the breast made of 15-20 lobes, each draining through a lactiferous duct to the nipple. After childbirth it produces milk under the influence of prolactin and oxytocin.', 'غدة عرقية متحورة داخل الثدي تتكون من 15 إلى 20 فصاً، يصب كل منها عبر قناة لبنية في الحلمة، وتنتج الحليب بعد الولادة بتأثير هرموني البرولاكتين والأوكسيتوسين.', merge(lobes), 0xf0c7a8);
  }

  // ---- external genitalia: remove the male contour from the skin, add a vulva surface ----
  const pubisY = b.min.y + 0.01;            // level of the mons pubis
  const perineumY = b.min.y - 0.075;
  const zf = (y) => 0.072 * smooth(perineumY, pubisY - 0.004, y) * (0.35 + 0.65 * smooth(perineumY, pubisY, y));
  // target surface of the female external genital region (mons pubis, labia majora, cleft)
  const vulvaZ = (x, y) => {
    const lower = 1 - smooth(perineumY + 0.02, pubisY, y);
    let z = zf(y) + 0.004 - 7 * x * x;
    z += lower * (0.008 * Math.exp(-(((Math.abs(x) - 0.012) / 0.008) ** 2)) - 0.01 * Math.exp(-((x / 0.004) ** 2)));
    return z;
  };
  // the male external genitalia are cut out of the skin and replaced by a smooth surface
  const inCore = (x, y, z) => Math.abs(x) < 0.042 && y > perineumY - 0.08 && y < pubisY - 0.004 && z > -0.035;
  {
    const sIdx = skinPart.mesh.geometry.index, keep = [];
    for (let i = 0; i < sIdx.count; i += 3) {
      const a0 = sIdx.getX(i), a1 = sIdx.getX(i + 1), a2 = sIdx.getX(i + 2);
      const cx = (skinPos.getX(a0) + skinPos.getX(a1) + skinPos.getX(a2)) / 3;
      const cy = (skinPos.getY(a0) + skinPos.getY(a1) + skinPos.getY(a2)) / 3;
      const cz = (skinPos.getZ(a0) + skinPos.getZ(a1) + skinPos.getZ(a2)) / 3;
      if (!inCore(cx, cy, cz)) keep.push(a0, a1, a2);
    }
    skinPart.maleIndex = sIdx;
    skinPart.femaleIndex = new THREE.BufferAttribute(new Uint32Array(keep), 1);
  }
  const genitalWeight = (x, y) => (1 - smooth(0.035, 0.06, Math.abs(x))) * smooth(perineumY - 0.06, perineumY - 0.03, y) * (1 - smooth(pubisY, pubisY + 0.025, y));

  {
    const nu = 36, nv = 44, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) {
      const y = perineumY - 0.012 + (pubisY + 0.004 - (perineumY - 0.012)) * (j / nv);
      const half = 0.046 - 0.022 * (1 - smooth(perineumY - 0.012, pubisY - 0.03, y));
      for (let i = 0; i <= nu; i++) {
        const x = -half + 2 * half * (i / nu);
        pos.push(x, y, vulvaZ(x, y) + 0.0008);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a0 = j * (nu + 1) + i, a1 = a0 + 1, a2 = a0 + nu + 1, a3 = a2 + 1;
      idx.push(a0, a1, a2, a1, a3, a2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    added.push({ id: 'F_VULVA', system: 'skin', en: 'Vulva (external female genitalia)', ar: 'الفرج (الأعضاء التناسلية الخارجية الأنثوية)',
      descEn: 'The external female genitalia: the mons pubis, labia majora and minora, clitoris and the vestibule into which the urethra and vagina open. (Simplified surface.)',
      descAr: 'الأعضاء التناسلية الأنثوية الخارجية: جبل العانة، والشفران الكبيران والصغيران، والبظر، والدهليز الذي ينفتح فيه الإحليل والمهبل. (سطح مبسط).',
      geo: g, color: 0xe8b796, sexOnly: 'f', generated: true });
  }

  // ---- compute male/female vertex sets for every part ----
  for (const p of parts) {
    const g = p.mesh.geometry;
    const pos = g.attributes.position;
    p.malePos = pos.array.slice();
    const f = new Float32Array(pos.array.length);
    const isSkin = p === skinPart;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (isSkin) {
        const w = genitalWeight(v.x, v.y);
        if (w > 0 && v.z > -0.035) {
          const zt = vulvaZ(v.x, v.y);
          if (v.z > zt) v.z += (zt - v.z) * w;
        }
        // breasts
        for (const B of breasts) {
          const dx = (v.x - B.cx) / B.rx, dy = (v.y - (B.cy - 0.01)) / B.ry;
          const rr = dx * dx + dy * dy;
          if (rr < 1 && v.z > B.z - 0.05) {
            const k = Math.pow(1 - rr, 1.4);
            v.z += B.h * k;
            v.y -= 0.012 * k; // slight natural ptosis
          }
        }
      }
      warp(v);
      f[i * 3] = v.x; f[i * 3 + 1] = v.y; f[i * 3 + 2] = v.z;
    }
    p.femalePos = f;
  }
  // warp the female organs too (they were built in male coordinates)
  const out = [];
  for (const a of added) {
    const pos = a.geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); warp(v); pos.setXYZ(i, v.x, v.y, v.z); }
    a.geo.computeVertexNormals();
    a.geo.computeBoundingBox();
    a.geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(a.geo, makeMaterial(a.system, a.color));
    out.push({ ...a, mesh, descEn: a.descEn, descAr: a.descAr });
  }
  return out;
}

/** Male-only structures (hidden for the female body). */
export function isMaleOnly(p) {
  return /penis|testis|testicular|epididym|seminal vesicle|deferent duct|prostate|scrot|spermatic|hair of trunk/i.test(p.en);
}

/** Switches every mesh between male and female vertex positions. */
export function applySex(parts, sex) {
  for (const p of parts) {
    if (!p.malePos) continue;
    const g = p.mesh.geometry;
    const attr = g.attributes.position;
    attr.array.set(sex === 'f' ? p.femalePos : p.malePos);
    attr.needsUpdate = true;
    if (p.femaleIndex) g.setIndex(sex === 'f' ? p.femaleIndex : p.maleIndex);
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    p.center.copy(g.boundingSphere.center);
    p.radius = g.boundingSphere.radius;
  }
}
