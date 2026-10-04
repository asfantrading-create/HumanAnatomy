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
  const brow = box('eyebrow'), mand = box('mandible'), thyroid = box('thyroid cartilage');
  // nose tip = most anterior skin point of the face
  const sp = by.get('skin').mesh.geometry.attributes.position;
  const nose = new THREE.Vector3(0, 0, -1);
  if (brow && mand) {
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i);
      if (y > mand.max.y - 0.02 && y < brow.min.y && Math.abs(sp.getX(i)) < 0.02 && sp.getZ(i) > nose.z) nose.set(sp.getX(i), y, sp.getZ(i));
    }
  }
  return {
    brow, mand, thyroid, nose,
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
      + 0.11 * bump(L.hipY + 0.01, 0.09, y);
    if (y < L.hipY) s += 0.055 * smooth(L.kneeY, L.hipY, y) * (1 - bump(L.hipY + 0.01, 0.09, y));
    // slimmer neck and slightly narrower jaw
    s -= 0.09 * bump(L.shoulderY + 0.08, 0.035, y) * (1 - smooth(0.05, 0.08, ax));
    s -= 0.05 * bump(L.shoulderY + 0.15, 0.035, y) * (1 - smooth(0.06, 0.09, ax));
    // ---- face: softer brow, smaller nose, narrower jaw and chin, flatter Adam's apple
    if (L.brow && L.mand && y > L.mand.min.y - 0.03) {
      const front = smooth(L.brow.min.z - 0.05, L.brow.min.z, v.z);
      v.z -= 0.005 * bump((L.brow.min.y + L.brow.max.y) / 2 + 0.006, 0.012, y) * (1 - smooth(0.04, 0.07, ax)) * front;
      const dn = v.distanceTo(L.nose);
      if (dn < 0.035) {
        const k = 0.16 * (1 - smooth(0.012, 0.035, dn));
        const base = new THREE.Vector3(L.nose.x, L.nose.y + 0.004, L.nose.z - 0.022);
        v.sub(base).multiplyScalar(1 - k).add(base);
      }
      const jaw = bump(L.mand.min.y + 0.012, 0.03, y) * (1 - smooth(L.mand.max.z - 0.02, L.mand.max.z + 0.02, v.z) * 0.3);
      s -= 0.1 * jaw;
      v.z -= 0.006 * bump(L.mand.min.y + 0.01, 0.02, y) * front * (1 - smooth(0.02, 0.04, ax));
    }
    if (L.thyroid) {
      const t = L.thyroid;
      v.z -= 0.007 * bump((t.min.y + t.max.y) / 2, 0.018, y) * (1 - smooth(0.012, 0.03, ax)) * smooth(t.max.z - 0.02, t.max.z + 0.01, v.z);
    }
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
    return { s, cx, cy, z: frontZ(cx, cy), rx: 0.085, ry: 0.078, h: 0.082 };
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
  // ---- long hair: a shell that follows the real scalp, then falls over the back ----
  {
    const hb = parts.find((p) => p.en.toLowerCase() === 'hair of head')?.mesh.geometry.boundingBox;
    const c = new THREE.Vector3(0, (L.brow ? L.brow.max.y : 1.62) + 0.02, -0.02);
    // radial profile of the head: max skin radius per (azimuth, polar) bin
    const NA = 72, NT = 40, prof = new Float32Array(NA * NT);
    for (let i = 0; i < skinPos.count; i++) {
      const dx = skinPos.getX(i) - c.x, dy = skinPos.getY(i) - c.y, dz = skinPos.getZ(i) - c.z;
      if (skinPos.getY(i) < (hb ? hb.min.y : 1.5) - 0.02) continue;
      const r = Math.hypot(dx, dy, dz);
      if (r > 0.16) continue;
      const tb = Math.min(NT - 1, Math.floor((Math.acos(dy / r) / Math.PI) * NT));
      const ab = Math.min(NA - 1, Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * NA));
      prof[tb * NA + ab] = Math.max(prof[tb * NA + ab], r);
    }
    for (let pass = 0; pass < 4; pass++) for (let tb = 0; tb < NT; tb++) for (let ab = 0; ab < NA; ab++) {
      if (prof[tb * NA + ab]) continue;
      let sum = 0, n = 0;
      for (const [dt, da] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const t2 = tb + dt, a2 = (ab + da + NA) % NA;
        if (t2 >= 0 && t2 < NT && prof[t2 * NA + a2]) { sum += prof[t2 * NA + a2]; n++; }
      }
      if (n) prof[tb * NA + ab] = sum / n;
    }
    const radius = (az, t) => {
      const fa = ((az + Math.PI) / (2 * Math.PI)) * NA - 0.5, ft = (t / Math.PI) * NT - 0.5;
      const a0 = Math.floor(fa), t0 = Math.max(0, Math.min(NT - 2, Math.floor(ft)));
      const wa = fa - a0, wt = Math.max(0, Math.min(1, ft - t0));
      const g = (ta, aa) => prof[ta * NA + ((aa % NA) + NA) % NA] || 0.09;
      return (g(t0, a0) * (1 - wa) + g(t0, a0 + 1) * wa) * (1 - wt) + (g(t0 + 1, a0) * (1 - wa) + g(t0 + 1, a0 + 1) * wa) * wt;
    };
    const NU = 120, NV = 90, pos = [], col = [], idx = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      for (let i = 0; i <= NU; i++) {
        const az = -Math.PI + (i / NU) * Math.PI * 2;        // 0 = face, ±π = back of the head
        const back = Math.abs(az) / Math.PI;                 // 0 front .. 1 back
        const tEnd = 0.95 + 0.95 * smooth(0.1, 0.42, back);   // hairline: forehead -> below the ears
        const drop = 0.34 * smooth(0.28, 0.9, back) + 0.07 * smooth(0.18, 0.3, back);
        let x, y, z;
        if (v <= 0.6) {
          const t = (v / 0.6) * tEnd;
          const edge = smooth(tEnd * 0.82, tEnd, t);          // hug the skin at the hairline
          const r = radius(az, t) + 0.009 * (1 - edge) + 0.0015 + 0.006 * Math.sin(Math.min(t, 1.2)) * (1 - edge);
          x = c.x + r * Math.sin(t) * Math.sin(az);
          y = c.y + r * Math.cos(t);
          z = c.z + r * Math.sin(t) * Math.cos(az);
        } else {
          const sd = (v - 0.6) / 0.4;
          const r = radius(az, tEnd) + 0.009 + 0.025 * sd * smooth(0.3, 0.7, back);
          x = c.x + r * Math.sin(tEnd) * Math.sin(az) * (1 - 0.15 * sd * sd);
          y = c.y + r * Math.cos(tEnd) - drop * sd;
          z = c.z + r * Math.sin(tEnd) * Math.cos(az) - (0.035 + 0.025 * sd) * sd * smooth(0.3, 1, back);
        }
        pos.push(x, y, z);
        // strand-like shading: fine stripes along the hair direction, lighter on top
        const strand = 0.72 + 0.16 * Math.sin(i * 2.9 + Math.sin(j * 0.13) * 2) * Math.sin(i * 1.13) + 0.12 * (1 - v);
        col.push(strand, strand * 0.97, strand * 0.94);
      }
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a0 = j * (NU + 1) + i, a1 = a0 + 1, a2 = a0 + NU + 1, a3 = a2 + 1;
      idx.push(a0, a2, a1, a1, a2, a3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    added.push({ id: 'F_HAIR', system: 'skin', en: 'Hair of head', ar: 'شعر الرأس',
      descEn: 'Scalp hair grows from about 100,000 follicles and protects the scalp from sunlight and heat loss. (Illustrative long hair for the female model.)',
      descAr: 'ينمو شعر الرأس من نحو مئة ألف جريب شعري، ويحمي فروة الرأس من أشعة الشمس وفقدان الحرارة. (شعر طويل توضيحي لنموذج المرأة).',
      geo: g, color: 0x4a2c1a, sexOnly: 'f', generated: true, vertexColors: true });
  }

  // ---- female skin surface (computed once, in male coordinates) ----
  const femaleSkin = shapeSkin(skinPart, L, breasts, { pubisY, perineumY, zf });
  {
    // areola and nipple colouring on the female skin (vertex colours; male skin stays uniform)
    const n = femaleSkin.length / 3, col = new Float32Array(n * 3).fill(1);
    for (const B of breasts) {
      let apex = -1, best = -1;
      for (let i = 0; i < n; i++) {
        const x = femaleSkin[i * 3], y = femaleSkin[i * 3 + 1], z = femaleSkin[i * 3 + 2];
        if (Math.abs(x - B.cx) < 0.05 && Math.abs(y - B.cy) < 0.07 && z > best) { best = z; apex = i; }
      }
      if (apex < 0) continue;
      const ax = femaleSkin[apex * 3], ay = femaleSkin[apex * 3 + 1] - 0.004, az = femaleSkin[apex * 3 + 2];
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(femaleSkin[i * 3] - ax, femaleSkin[i * 3 + 1] - ay, femaleSkin[i * 3 + 2] - az);
        if (d > 0.024) continue;
        const k = 1 - smooth(0.015, 0.022, d);
        col[i * 3] = 1 - 0.2 * k; col[i * 3 + 1] = 1 - 0.36 * k; col[i * 3 + 2] = 1 - 0.38 * k;
        if (d < 0.005) femaleSkin[i * 3 + 2] += 0.0035 * (1 - d / 0.005); // nipple
      }
    }
    const geo = skinPart.mesh.geometry;
    skinPart.maleColor = new Float32Array(n * 3).fill(1);
    skinPart.femaleColor = col;
    geo.setAttribute('color', new THREE.BufferAttribute(skinPart.maleColor.slice(), 3));
    skinPart.mesh.material.vertexColors = true;
    skinPart.mesh.material.needsUpdate = true;
  }

  // ---- compute male/female vertex sets for every part ----
  for (const p of parts) {
    const g = p.mesh.geometry;
    const pos = g.attributes.position;
    p.malePos = pos.array.slice();
    const f = new Float32Array(pos.array.length);
    const isSkin = p === skinPart;
    const isBrow = p.en.toLowerCase() === 'eyebrow';
    const bb = g.boundingBox;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (isSkin) v.set(femaleSkin[i * 3], femaleSkin[i * 3 + 1], femaleSkin[i * 3 + 2]);
      if (isBrow) {
        // thinner, slightly arched eyebrows
        const cy = (bb.min.y + bb.max.y) / 2;
        v.y = cy + (v.y - cy) * 0.5 + 0.004 * smooth(0.02, 0.05, Math.abs(v.x)) - 0.003 * smooth(0.045, 0.06, Math.abs(v.x));
        v.z -= 0.001;
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
    const mat = makeMaterial(a.system, a.color);
    if (a.vertexColors) { mat.vertexColors = true; mat.roughness = 0.55; }
    const mesh = new THREE.Mesh(a.geo, mat);
    out.push({ ...a, mesh, descEn: a.descEn, descAr: a.descAr });
  }
  return out;
}

/** Male-only structures (hidden for the female body). */
export function isMaleOnly(p) {
  return /penis|testis|testicular|epididym|seminal vesicle|deferent duct|prostate|scrot|spermatic|hair of trunk|hair of head/i.test(p.en);
}

/** Switches every mesh between male and female vertex positions. */
export function applySex(parts, sex) {
  for (const p of parts) {
    if (!p.malePos) continue;
    const g = p.mesh.geometry;
    const attr = g.attributes.position;
    attr.array.set(sex === 'f' ? p.femalePos : p.malePos);
    attr.needsUpdate = true;
    if (p.femaleColor) { g.attributes.color.array.set(sex === 'f' ? p.femaleColor : p.maleColor); g.attributes.color.needsUpdate = true; }
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    p.center.copy(g.boundingSphere.center);
    p.radius = g.boundingSphere.radius;
  }
}

/** Vertex neighbour lists (CSR) of an indexed mesh. */
function neighbours(geo) {
  const n = geo.attributes.position.count, idx = geo.index.array;
  const sets = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map((s) => Int32Array.from(s));
}

/** Laplacian smoothing of the vertices in `mask` (others stay fixed). */
function relax(pos, nb, mask, iters, lambda, mu = 0) {
  const n = pos.length / 3, tmp = new Float32Array(pos.length);
  for (let it = 0; it < iters; it++) {
    for (const f of mu ? [lambda, mu] : [lambda]) {
      tmp.set(pos);
      for (let i = 0; i < n; i++) {
        const w = mask[i];
        if (!w || !nb[i].length) continue;
        let x = 0, y = 0, z = 0;
        for (const j of nb[i]) { x += tmp[j * 3]; y += tmp[j * 3 + 1]; z += tmp[j * 3 + 2]; }
        const k = nb[i].length, ff = f * w;
        pos[i * 3] += (x / k - tmp[i * 3]) * ff;
        pos[i * 3 + 1] += (y / k - tmp[i * 3 + 1]) * ff;
        pos[i * 3 + 2] += (z / k - tmp[i * 3 + 2]) * ff;
      }
    }
  }
}

/**
 * Female skin: the male external genitalia are collapsed and relaxed into a
 * smooth membrane (mons pubis and labia), breasts are added, and the trunk and
 * limbs are softened (thicker subcutaneous fat hides muscle relief).
 */
function shapeSkin(skinPart, L, breasts, { pubisY, perineumY, zf }) {
  const geo = skinPart.mesh.geometry;
  const pos = geo.attributes.position.array.slice();
  const n = pos.length / 3;
  const nb = neighbours(geo);

  // 1) external genitalia -> membrane
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (Math.abs(x) < 0.05 && y > perineumY - 0.06 && y < pubisY + 0.012 && z > -0.03) {
      g[i] = 1;
      const zt = zf(y) - 6 * x * x;
      if (z > zt) pos[i * 3 + 2] = zt;                      // flatten the penis onto the pubic surface
      if (y < perineumY) {                                  // pull the scrotum up between the thighs
        pos[i * 3 + 1] = perineumY - 0.01 * Math.random();
        pos[i * 3 + 2] = Math.min(pos[i * 3 + 2], 0.0);
      }
    }
  }
  relax(pos, nb, g, 120, 0.6);
  // soft cleft between the labia majora and a gentle mons
  for (let i = 0; i < n; i++) {
    if (!g[i]) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1];
    const lower = 1 - smooth(perineumY + 0.015, pubisY - 0.015, y);
    pos[i * 3 + 2] -= lower * 0.006 * Math.exp(-((x / 0.0035) ** 2));
    pos[i * 3 + 2] += 0.005 * bump(pubisY - 0.006, 0.014, y) * (1 - smooth(0.0, 0.04, Math.abs(x)));
  }

  // 2) breasts: rounded volume with a fuller lower pole
  for (let i = 0; i < n; i++) {
    for (const B of breasts) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (z < B.z - 0.06) continue;
      const dx = (x - B.cx) / B.rx, dyy = y - (B.cy - 0.012);
      const dy = dyy / (dyy < 0 ? B.ry * 0.85 : B.ry * 1.25);
      const rr = dx * dx + dy * dy;
      if (rr >= 1) continue;
      const k = Math.pow(1 - rr, 1.6);
      pos[i * 3 + 2] += B.h * k;
      pos[i * 3] += (x - B.cx) * 0.12 * k;                  // slight outward spread
      pos[i * 3 + 1] -= 0.016 * k;                          // natural ptosis
    }
  }

  // 3) soften muscle relief on trunk and limbs (not on face, hands or feet)
  const soft = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.abs(pos[i * 3]), y = pos[i * 3 + 1];
    const hands = x > 0.19 && y < L.hipY + 0.02;
    if (hands || g[i]) continue;
    soft[i] = smooth(L.kneeY - 0.25, L.kneeY - 0.1, y) * (1 - smooth(L.shoulderY + 0.02, L.shoulderY + 0.06, y));
  }
  relax(pos, nb, soft, 6, 0.5, -0.53);
  // keep the breast shape crisp after softening
  return pos;
}
