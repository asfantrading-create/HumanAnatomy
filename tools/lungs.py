"""Generate lung lobe surfaces (absent from BodyParts3D) as smooth envelopes
around each lobe's bronchial tree and pulmonary vessels."""
import collections, os
import numpy as np
import trimesh
from scipy.spatial import cKDTree

LOBES = [
    ('LUNG_RU', 'upper lobe of right lung', 'right lung'),
    ('LUNG_RM', 'middle lobe of lung', 'right lung'),
    ('LUNG_RL', 'lower lobe of right lung', 'right lung'),
    ('LUNG_LU', 'upper lobe of left lung', 'left lung'),
    ('LUNG_LL', 'lower lobe of left lung', 'left lung'),
]
NAMES = {'middle lobe of lung': 'middle lobe of right lung'}


def partof(src):
    po = collections.defaultdict(list)
    for l in open(os.path.join(src, 'partof_element_parts.txt'), encoding='utf-8').read().splitlines()[1:]:
        c, n, f = l.split('\t')
        po[n].append(f)
    return po


def make_lungs(src, meshes):
    """meshes: {fid: (verts[m], faces)} in output coordinates. Returns {id: (v, f, en)}."""
    po = partof(src)
    heart_pts = np.vstack([meshes[f][0] for f in po['heart'] if f in meshes])
    h_lo, h_hi = np.percentile(heart_pts, 3, axis=0), np.percentile(heart_pts, 97, axis=0)
    h_c, h_r = (h_lo + h_hi) / 2, (h_hi - h_lo) / 2 * 1.08
    out = {}
    for lung in ('right lung', 'left lung'):
        lobes = [l for l in LOBES if l[2] == lung]
        pts_by_lobe = {lid: np.vstack([meshes[f][0] for f in po[name] if f in meshes]) for lid, name, _ in lobes}
        allpts = np.vstack(list(pts_by_lobe.values()))
        hull = trimesh.convex.convex_hull(allpts)
        m = hull.subdivide_to_size(0.006, max_iter=12)
        m.merge_vertices()
        # inflate slightly so the envelope surrounds the airway tips
        v = m.vertices + m.vertex_normals * 0.012
        # carve the cardiac impression: push vertices out of the heart ellipsoid
        d = (v - h_c) / h_r
        r = np.linalg.norm(d, axis=1)
        inside = r < 1
        v[inside] = h_c + d[inside] / r[inside, None] * h_r
        m = trimesh.Trimesh(v, m.faces, process=True)
        trimesh.smoothing.filter_taubin(m, iterations=25)
        # assign each triangle to the nearest lobe's airway/vessel points
        trees = {lid: cKDTree(p) for lid, p in pts_by_lobe.items()}
        cent = m.triangles_center
        dist = np.stack([trees[lid].query(cent)[0] for lid, _, _ in lobes], axis=1)
        label = dist.argmin(1)
        for k, (lid, name, _) in enumerate(lobes):
            sub = m.submesh([np.where(label == k)[0]], append=True)
            sub.merge_vertices()
            out[lid] = (np.asarray(sub.vertices), np.asarray(sub.faces), NAMES.get(name, name))
    return out
