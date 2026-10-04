// Loads the BodyParts3D-derived meshes (see tools/convert_bp3d.py) into Three.js meshes.
import * as THREE from 'three';

async function fetchBuffer(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got);
    got += value.length;
    onProgress(got / total);
  }
  return out.buffer;
}

/** Returns [{ meta, geometry }] for every part in the manifest. */
export async function loadParts(base, onProgress = () => {}) {
  const manifest = await (await fetch(`${base}/anatomy-parts.json`)).json();
  const buf = await fetchBuffer(`${base}/anatomy.bin`, (f) => onProgress(f * 0.6));
  const out = [];
  const parts = manifest.parts;
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i];
    const q = new Uint16Array(buf, m.pos, m.nv * 3);
    const pos = new Float32Array(m.nv * 3);
    const sx = (m.max[0] - m.min[0]) / 65535, sy = (m.max[1] - m.min[1]) / 65535, sz = (m.max[2] - m.min[2]) / 65535;
    for (let k = 0; k < m.nv; k++) {
      pos[k * 3] = m.min[0] + q[k * 3] * sx;
      pos[k * 3 + 1] = m.min[1] + q[k * 3 + 1] * sy;
      pos[k * 3 + 2] = m.min[2] + q[k * 3 + 2] * sz;
    }
    const index = m.wide ? new Uint32Array(buf, m.idx, m.ni) : new Uint16Array(buf, m.idx, m.ni);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(m.wide ? new Uint32Array(index) : new Uint16Array(index), 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    out.push({ meta: m, geometry: g });
    if (i % 100 === 0) {
      onProgress(0.6 + 0.4 * (i / parts.length));
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return { parts: out, source: manifest.source };
}
