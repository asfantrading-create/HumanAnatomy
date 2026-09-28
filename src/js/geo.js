// Parametric geometry helpers used to sculpt anatomical structures.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from '../vendor/BufferGeometryUtils.js';

export const V = (p) => (p instanceof THREE.Vector3 ? p : new THREE.Vector3(p[0], p[1], p[2]));

/**
 * A tube along a smooth Catmull-Rom curve whose radius varies along its length.
 * radius: number or function(t) -> number. Ends are closed with caps.
 * flat: squash factor applied along the frame binormal (1 = round).
 */
export function tube(points, radius, opts = {}) {
  const { segments = Math.max(16, points.length * 10), radial = 14, flat = 1, caps = true, tension = 0.5 } = opts;
  const curve = points.length === 2
    ? new THREE.LineCurve3(V(points[0]), V(points[1]))
    : new THREE.CatmullRomCurve3(points.map(V), false, 'catmullrom', tension);
  const rf = typeof radius === 'function' ? radius : () => radius;
  const frames = computeFrames(curve, segments);
  const pos = [], nor = [], uv = [], index = [];
  const P = new THREE.Vector3(), n = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = Math.max(rf(t), 0.0005);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      n.set(0, 0, 0).addScaledVector(N, c).addScaledVector(B, s * flat);
      pos.push(P.x + (N.x * c + B.x * s * flat) * r, P.y + (N.y * c + B.y * s * flat) * r, P.z + (N.z * c + B.z * s * flat) * r);
      n.set(0, 0, 0).addScaledVector(N, c * flat).addScaledVector(B, s).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (caps) {
    for (const end of [0, 1]) {
      curve.getPointAt(end, P);
      const T = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1);
      const ci = pos.length / 3;
      pos.push(P.x, P.y, P.z);
      nor.push(T.x, T.y, T.z);
      uv.push(0.5, end);
      const ring = end ? segments * (radial + 1) : 0;
      for (let j = 0; j < radial; j++) {
        if (end) index.push(ci, ring + j, ring + j + 1);
        else index.push(ci, ring + j + 1, ring + j);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

// Rotation-minimising frames (more stable than Frenet frames for anatomy tubes).
function computeFrames(curve, segments) {
  const tangents = [], normals = [], binormals = [];
  for (let i = 0; i <= segments; i++) tangents.push(curve.getTangentAt(i / segments).normalize());
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let n = new THREE.Vector3().crossVectors(t0, ref).normalize();
  for (let i = 0; i <= segments; i++) {
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
      const l = axis.length();
      if (l > 1e-6) {
        axis.divideScalar(l);
        const ang = Math.acos(THREE.MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
        n = n.clone().applyAxisAngle(axis, ang);
      } else n = n.clone();
    }
    normals.push(n);
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], n).normalize());
  }
  return { tangents, normals, binormals };
}

/** Ellipsoid centred at c with radii r, optional Euler rotation (radians). */
export function ellipsoid(c, r, rot, detail = [32, 24]) {
  const g = new THREE.SphereGeometry(1, detail[0], detail[1]);
  g.scale(r[0], r[1], r[2]);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0)));
  g.translate(c[0], c[1], c[2]);
  return g;
}

/**
 * Muscle belly: a spindle between a and b (fusiform profile) that can be
 * flattened against the body surface. `toward` is a direction hint for the
 * thin axis (e.g. the outward skin normal).
 */
export function spindle(a, b, r, opts = {}) {
  const { flat = 1, toward = [0, 0, 1], tendon = 0.12, bulge = 0.5, width = 1 } = opts;
  const A = V(a), B = V(b);
  const dir = new THREE.Vector3().subVectors(B, A);
  const L = dir.length();
  dir.normalize();
  const pts = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // skewed sine profile: peak position controlled by `bulge`
    const u = t < bulge ? (t / bulge) * 0.5 : 0.5 + ((t - bulge) / (1 - bulge)) * 0.5;
    const prof = Math.pow(Math.sin(Math.PI * u), 0.75);
    pts.push(new THREE.Vector2(Math.max(r * (tendon + (1 - tendon) * prof), r * 0.04), t * L));
  }
  const g = new THREE.LatheGeometry(pts, 20);
  g.scale(width, 1, flat);
  // Build basis: Y along the muscle, Z toward the hint.
  const z = V(toward).clone().normalize();
  z.addScaledVector(dir, -z.dot(dir));
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(dir, z).normalize();
  const m = new THREE.Matrix4().makeBasis(x, dir, z).setPosition(A);
  g.applyMatrix4(m);
  g.computeVertexNormals();
  return g;
}

/** Straight bone shaft with rounded knobs (epiphyses) at both ends. */
export function longBone(a, b, r, opts = {}) {
  const { headA = r * 1.8, headB = r * 1.8, taper = 0.85, flatA, flatB } = opts;
  const parts = [tube([a, b], (t) => r * (1 - 0.22 * Math.sin(Math.PI * t)) * (1 - (1 - taper) * t), { segments: 20, radial: 14 })];
  parts.push(ellipsoid(a, flatA || [headA, headA, headA], null, [20, 14]));
  parts.push(ellipsoid(b, flatB || [headB, headB, headB], null, [20, 14]));
  return merge(parts);
}

export function merge(geos) {
  const keepColor = geos.every((g) => g.attributes.color);
  const keepUv = geos.every((g) => g.attributes.uv);
  const list = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) if (key !== 'position' && key !== 'normal' && !(keepColor && key === 'color') && !(keepUv && key === 'uv')) n.deleteAttribute(key);
    return n;
  });
  return mergeGeometries(list, false);
}

/** Spherical dome (e.g. the diaphragm). */
export function dome(c, r, height, opts = {}) {
  const g = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, opts.theta || Math.PI / 2.2);
  g.scale(r[0], height, r[1]);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** Displace a geometry's vertices along its normals with a procedural pattern. */
export function wrinkle(geo, amp, freq, seed = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = freq;
    const d = Math.sin(x * f + seed) * Math.sin(y * f * 1.3 + seed * 2) * Math.cos(z * f * 0.9)
      + 0.6 * Math.sin((x + z) * f * 2.1 + seed) * Math.cos((y - x) * f * 1.7)
      + 0.3 * Math.sin((y + z) * f * 3.3);
    const k = Math.abs(d) * amp;
    p.setXYZ(i, x - n.getX(i) * k, y - n.getY(i) * k, z - n.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export { mergeVertices };
