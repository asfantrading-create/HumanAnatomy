"""Convert BodyParts3D OBJ elements into one compact binary + JSON manifest.

Usage: python3 tools/convert_bp3d.py <bp3d_dir> <out_dir> [target_total_tris]

Coordinates are converted from millimetres (Z up, -Y anterior) to metres
(Y up, +Z anterior, +X = body's left), meshes are decimated, and vertex
positions are quantised to 16 bits inside each part's bounding box.
"""
import json, os, struct, sys
import numpy as np
import fast_simplification
sys.path.insert(0, os.path.dirname(__file__))
from lungs import make_lungs

SRC = sys.argv[1]
OUT = sys.argv[2]
TARGET = int(sys.argv[3]) if len(sys.argv) > 3 else 1_700_000
OBJ_DIR = os.path.join(SRC, 'isa', 'isa_BP3D_4.0_obj_99')
Y_CENTER = -100.0  # mm, approximate mid-depth of the body


def load_obj(path):
    v, f = [], []
    with open(path) as fh:
        for line in fh:
            if line.startswith('v '):
                v.append(line.split()[1:4])
            elif line.startswith('f '):
                idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    f.append((idx[0], idx[k], idx[k + 1]))
    v = np.asarray(v, dtype=np.float64)
    f = np.asarray(f, dtype=np.int64)
    # mm (x, y, z-up) -> m (x, y-up, z-anterior)
    out = np.empty_like(v)
    out[:, 0] = v[:, 0] / 1000.0
    out[:, 1] = v[:, 2] / 1000.0
    out[:, 2] = -(v[:, 1] - Y_CENTER) / 1000.0
    return out, f


def weld(v, f, tol=1e-6):
    q = np.round(v / tol).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    f2 = inv.reshape(-1)[f]
    keep = (f2[:, 0] != f2[:, 1]) & (f2[:, 1] != f2[:, 2]) & (f2[:, 0] != f2[:, 2])
    return v[first], f2[keep]


# Part-of groupings shown as sub-folders in the app (most specific listed first).
GROUPS = ['frontal lobe', 'parietal lobe', 'temporal lobe', 'occipital lobe', 'limbic lobe', 'insula',
          'cerebellum', 'brainstem', 'diencephalon', 'heart', 'liver', 'skull', 'vertebral column', 'rib cage',
          'small intestine', 'large intestine', 'stomach', 'pancreas', 'larynx', 'mouth', 'nose', 'face',
          'eye', 'orbital part of left eye', 'orbital part of right eye', 'neck', 'thorax', 'abdomen', 'pelvis', 'perineum', 'head']


def partof_groups():
    import collections
    par = collections.defaultdict(set)
    for l in open(os.path.join(SRC, 'partof_inclusion_relation_list.txt'), encoding='utf-8').read().splitlines()[1:]:
        p, pn, c, cn = l.split('\t')
        par[cn].add(pn)
    direct = collections.defaultdict(set)
    for l in open(os.path.join(SRC, 'partof_element_parts.txt'), encoding='utf-8').read().splitlines()[1:]:
        c, n, f = l.split('\t')
        direct[f].add(n)
    out = {}
    for f, names in direct.items():
        seen, stack = set(names), list(names)
        while stack:
            x = stack.pop()
            for p in par.get(x, ()):
                if p not in seen:
                    seen.add(p); stack.append(p)
        def strip(n):
            for side in ('left ', 'right '):
                if n.startswith(side):
                    return n[len(side):]
            return n
        stripped = {strip(n) for n in seen}
        for g in GROUPS:
            if g in stripped:
                out[f] = g.replace('orbital part of left eye', 'eye').replace('orbital part of right eye', 'eye')
                break
    return out


def main():
    index = json.load(open(os.path.join(SRC, 'index.json')))
    groups = partof_groups()
    meshes = {}
    total = 0
    for fid in sorted(index):
        v, f = load_obj(os.path.join(OBJ_DIR, fid + '.obj'))
        v, f = weld(v, f)
        meshes[fid] = (v, f)
        total += len(f)
    for lid, (v, f, en) in make_lungs(SRC, meshes).items():
        meshes[lid] = (v, f)
        index[lid] = {'fma': '', 'name': en, 'system': 'respiratory', 'generated': True}
        total += len(f)
    ratio = min(1.0, TARGET / total)
    print(f'{len(meshes)} meshes, {total} tris, keep ratio {ratio:.3f}')

    os.makedirs(OUT, exist_ok=True)
    blob = bytearray()
    parts = []
    out_tris = 0
    for fid, (v, f) in meshes.items():
        n = len(f)
        target = max(min(n, 400), int(n * ratio))
        if n > 600 and target < n:
            try:
                v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), 1 - target / n)
                if len(f2) >= 40:
                    v, f = v2.astype(np.float64), f2.astype(np.int64)
            except Exception as e:  # keep original geometry if simplification fails
                print('simplify failed', fid, e)
        lo, hi = v.min(0), v.max(0)
        span = np.maximum(hi - lo, 1e-6)
        q = np.round((v - lo) / span * 65535).astype(np.uint16)
        while len(blob) % 4:
            blob.append(0)
        pos_off = len(blob)
        blob += q.tobytes()
        while len(blob) % 4:
            blob.append(0)
        idx_off = len(blob)
        wide = len(v) > 65535
        blob += f.astype(np.uint32 if wide else np.uint16).tobytes()
        meta = index[fid]
        parts.append({
            'id': fid, 'fma': meta['fma'], 'en': meta['name'], 'system': meta['system'],
            'min': [round(x, 5) for x in lo.tolist()], 'max': [round(x, 5) for x in hi.tolist()],
            'gen': bool(meta.get('generated')),
            'grp': groups.get(fid, 'lung' if fid.startswith('LUNG') else ''),
            'pos': pos_off, 'nv': int(len(v)), 'idx': idx_off, 'ni': int(f.size), 'wide': wide
        })
        out_tris += len(f)
    with open(os.path.join(OUT, 'anatomy.bin'), 'wb') as fh:
        fh.write(blob)
    json.dump({
        'source': 'BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution 4.0 International',
        'parts': parts
    }, open(os.path.join(OUT, 'anatomy-parts.json'), 'w'), separators=(',', ':'))
    print(f'wrote {out_tris} tris, {len(blob) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
