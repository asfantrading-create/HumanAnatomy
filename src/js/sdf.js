// Signed-distance-field helpers and a "surface nets" mesher.
// Used to build smooth organic shapes (skin, skull, pelvis, lungs, liver...).
import * as THREE from 'three';

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function sphere(c, r) {
  return (x, y, z) => len3(x - c[0], y - c[1], z - c[2]) - r;
}

// Ellipsoid, optionally rotated by Euler angles (radians, XYZ order).
export function ellipsoid(c, r, rot) {
  let m = null;
  if (rot) {
    const e = new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m = new THREE.Matrix4().makeRotationFromEuler(e).invert().elements;
  }
  const [rx, ry, rz] = r;
  return (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    if (m) {
      const qx = m[0] * px + m[4] * py + m[8] * pz;
      const qy = m[1] * px + m[5] * py + m[9] * pz;
      const qz = m[2] * px + m[6] * py + m[10] * pz;
      px = qx; py = qy; pz = qz;
    }
    const k0 = len3(px / rx, py / ry, pz / rz);
    const k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
    return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  };
}

// Capsule whose radius varies linearly from ra (at a) to rb (at b).
export function cone(a, b, ra, rb = ra) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const bb = bx * bx + by * by + bz * bz;
  return (x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    const h = clamp((px * bx + py * by + pz * bz) / bb, 0, 1);
    return len3(px - bx * h, py - by * h, pz - bz * h) - (ra + (rb - ra) * h);
  };
}

// Half-space: keeps points where dot(p - c, n) < 0.
export function plane(c, n) {
  const l = len3(n[0], n[1], n[2]);
  const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
  return (x, y, z) => (x - c[0]) * nx + (y - c[1]) * ny + (z - c[2]) * nz;
}

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function union(k, ...fs) {
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) d = k > 0 ? smin(d, fs[i](x, y, z), k) : Math.min(d, fs[i](x, y, z));
    return d;
  };
}

export function subtract(k, base, ...cuts) {
  return (x, y, z) => {
    let d = base(x, y, z);
    for (const c of cuts) d = k > 0 ? -smin(-d, c(x, y, z), k) : Math.max(d, -c(x, y, z));
    return d;
  };
}

export function intersect(k, ...fs) {
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) d = k > 0 ? -smin(-d, -fs[i](x, y, z), k) : Math.max(d, fs[i](x, y, z));
    return d;
  };
}

// Mirror a field across the sagittal (x = 0) plane and union both halves.
export function mirrorX(f, k = 0) {
  const g = (x, y, z) => f(-x, y, z);
  return union(k, f, g);
}

/**
 * Mesh the zero iso-surface of `sdf` inside the box [min, max] with the
 * naive surface-nets algorithm. Returns an indexed BufferGeometry with
 * smooth normals taken from the field gradient.
 */
export function meshSDF(sdf, min, max, step, opts = {}) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const field = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);

  for (let k = 0; k < nz; k++) {
    const z = min[2] + k * step;
    for (let j = 0; j < ny; j++) {
      const y = min[1] + j * step;
      for (let i = 0; i < nx; i++) field[idx(i, j, k)] = sdf(min[0] + i * step, y, z);
    }
  }

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  const cidx = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);

  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = corners[c];
          v[c] = field[idx(i + o[0], j + o[1], k + o[2])];
          if (v[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of edges) {
          const va = v[a], vb = v[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          const oa = corners[a], ob = corners[b];
          sx += oa[0] + (ob[0] - oa[0]) * t;
          sy += oa[1] + (ob[1] - oa[1]) * t;
          sz += oa[2] + (ob[2] - oa[2]) * t;
          n++;
        }
        cellVert[cidx(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
      }
    }
  }

  const index = [];
  const P = (vi) => [pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]];
  const quad = (a, b, c, d, dir) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // orientation from the quad diagonals (robust even for skewed quads)
    const pa = P(a), pb = P(b), pc = P(c), pd = P(d);
    const ux = pc[0] - pa[0], uy = pc[1] - pa[1], uz = pc[2] - pa[2];
    const wx = pd[0] - pb[0], wy = pd[1] - pb[1], wz = pd[2] - pb[2];
    const nxv = uy * wz - uz * wy, nyv = uz * wx - ux * wz, nzv = ux * wy - uy * wx;
    const flip = nxv * dir[0] + nyv * dir[1] + nzv * dir[2] < 0;
    // split along the shorter diagonal for nicer triangles
    const d1 = ux * ux + uy * uy + uz * uz, d2 = wx * wx + wy * wy + wz * wz;
    if (d1 <= d2) {
      if (!flip) index.push(a, b, c, a, c, d); else index.push(a, c, b, a, d, c);
    } else {
      if (!flip) index.push(a, b, d, b, c, d); else index.push(a, d, b, b, d, c);
    }
  };

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const inside = field[idx(i, j, k)] < 0;
        const s = inside ? 1 : -1;
        if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
          if (inside !== (field[idx(i + 1, j, k)] < 0)) {
            quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], [s, 0, 0]);
          }
        }
        if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
          if (inside !== (field[idx(i, j + 1, k)] < 0)) {
            quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], [0, s, 0]);
          }
        }
        if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
          if (inside !== (field[idx(i, j, k + 1)] < 0)) {
            quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], [0, 0, s]);
          }
        }
      }
    }
  }

  const normals = new Float32Array(pos.length);
  const e = step * 0.5;
  for (let q = 0; q < pos.length; q += 3) {
    const x = pos[q], y = pos[q + 1], z = pos[q + 2];
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = len3(gx, gy, gz) || 1;
    normals[q] = gx / l; normals[q + 1] = gy / l; normals[q + 2] = gz / l;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (opts.ao) {
    // Cheap ambient occlusion baked into vertex colours by marching the field along the normal.
    const dist = opts.ao;
    const col = new Float32Array(pos.length);
    for (let q = 0; q < pos.length; q += 3) {
      let occ = 0, w = 1;
      for (let i = 1; i <= 5; i++) {
        const h = (dist * i) / 5;
        const d = sdf(pos[q] + normals[q] * h, pos[q + 1] + normals[q + 1] * h, pos[q + 2] + normals[q + 2] * h);
        occ += (h - d) * w;
        w *= 0.7;
      }
      const ao = Math.pow(clamp(1 - (occ / dist) * 0.9, 0.25, 1), 1.3);
      col[q] = col[q + 1] = col[q + 2] = ao;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  geo.setIndex(index);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// Convenience: mesh an SDF with an automatically padded box.
export function sdfGeometry(sdf, min, max, step = 0.006, opts) {
  const pad = step * 2;
  return meshSDF(sdf, [min[0] - pad, min[1] - pad, min[2] - pad], [max[0] + pad, max[1] + pad, max[2] + pad], step, opts);
}
