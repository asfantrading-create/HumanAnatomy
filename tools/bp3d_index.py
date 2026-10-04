"""Index BodyParts3D 'is-a' elements: most specific concept per mesh file,
its ancestor chain, and a body-system classification."""
import collections, json, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/user/bp3d'

def load():
    el = collections.defaultdict(set); cnt = collections.Counter(); cname = {}
    for l in open(os.path.join(SRC, 'isa_element_parts.txt'), encoding='utf-8').read().splitlines()[1:]:
        c, n, f = l.split('\t'); el[f].add(c); cnt[c] += 1; cname[c] = n
    par = collections.defaultdict(set)
    for l in open(os.path.join(SRC, 'isa_inclusion_relation_list.txt'), encoding='utf-8').read().splitlines()[1:]:
        p, pn, c, cn = l.split('\t'); par[c].add(p); cname[p] = pn; cname[c] = cn
    return el, cnt, cname, par

def ancestors(c, par):
    seen, stack = set(), [c]
    while stack:
        x = stack.pop()
        for p in par.get(x, ()):
            if p not in seen: seen.add(p); stack.append(p)
    return seen

# (system, keywords that must appear in the name of the concept or an ancestor)
GENERIC = {'anatomical compartment space', 'anatomical conduit space', 'body of organ', 'cavernous organ',
           'decussation', 'parenchyma', 'process of organ', 'organ', 'organ component'}

RULES = [
    ('skin', ['skin', 'eyebrow']),
    ('sensory', ['eyeball', 'lens', 'retina', 'cornea', 'eyelid', 'lacrimal', 'ear ', 'auricle', 'ossicle', 'tympanic', 'extra-ocular', 'extraocular', 'orbital fat', 'vitreous', 'iris', 'nose']),
    ('reproductive', ['testis', 'penis', 'prostate', 'seminal', 'scrotum', 'epididymis', 'ductus deferens', 'spermatic', 'genital', 'deferent duct']),
    ('lymphatic', ['thymus', 'spleen', 'lymph', 'tonsil']),
    ('endocrine', ['thyroid gland', 'parathyroid', 'adrenal', 'suprarenal gland', 'pituitary', 'hypophysis', 'pineal']),
    ('circulatory', ['artery', 'arteries', 'vein', 'arterial', 'venous', 'heart', 'aorta', 'vena cava', 'sinus of dura', 'atrium', 'ventricle', 'cardiac', 'valve', 'blood vessel', 'trunk of', 'arch of aorta', 'cusp', 'chordae', 'papillary muscle', 'coronary', 'pericardi']),
    ('nervous', ['nerve', 'brain', 'cerebr', 'gyrus', 'lobe of cerebral', 'cerebellum', 'spinal cord', 'neuraxis', 'ganglion', 'plexus', 'thalamus', 'pons', 'medulla oblongata', 'midbrain', 'ventricle of brain', 'nucleus', 'hippocampus', 'corpus callosum', 'fornix', 'cord', 'diencephalon', 'telencephalon', 'insula', 'cortex', 'neural', 'sulcus', 'commissure', 'optic chiasm', 'peduncle', 'vermis', 'cauda equina', 'meninges', 'dura mater', 'colliculus']),
    ('respiratory', ['lung', 'bronch', 'trachea', 'larynx', 'laryngeal', 'pleura', 'nasal cavity', 'arytenoid', 'cricoid', 'epiglott', 'thyroid cartilage', 'diaphragm']),
    ('digestive', ['tooth', 'teeth', 'tongue', 'esophagus', 'stomach', 'intestine', 'duodenum', 'jejunum', 'ileum', 'colon', 'cecum', 'rectum', 'anal', 'liver', 'hepat', 'gallbladder', 'bile', 'pancrea', 'salivary', 'parotid', 'submandibular gland', 'sublingual gland', 'pharynx', 'appendix', 'peritone', 'mesentery', 'omentum', 'palate', 'oral', 'cystic duct', 'gingiva', 'lip', 'ileocecal', 'pterygomandibular raphe', 'pharyngeal raphe']),
    ('urinary', ['kidney', 'renal', 'ureter', 'urinary bladder', 'urethra']),
    ('skeletal', ['bone', 'vertebra', 'skull', 'cartilage', 'rib', 'sternum', 'carpal', 'tarsal', 'phalanx', 'sacrum', 'coccyx', 'mandible', 'ligament', 'joint', 'meniscus', 'intervertebral disc', 'symphysis', 'hyoid', 'skeleton', 'maxilla', 'patella', 'clavicle', 'scapula', 'pelvis', 'femur', 'tibia', 'fibula', 'humerus', 'radius', 'ulna', 'skeletal system', 'interosseous membrane', 'conus elasticus']),
    ('muscular', ['muscle', 'tendon', 'aponeurosis', 'fascia', 'retinaculum', 'muscular', 'head of', 'belly', 'trapezius', 'interossei', 'lumbrical', 'levatores', 'intertransversarii', 'interspinales', 'tendinous ring']),
]

def classify(names):
    text = ' | '.join(names).lower()
    for system, kws in RULES:
        if any(k in text for k in kws):
            return system
    return 'other'

def build():
    el, cnt, cname, par = load()
    out = {}
    for f, cs in el.items():
        good = [x for x in cs if cname[x] not in GENERIC] or list(cs)
        c = min(good, key=lambda x: (cnt[x], cname[x]))
        anc = ancestors(c, par)
        # classify using own name first, then nearest ancestors (by specificity)
        chain = [cname[c]] + sorted((cname[a] for a in anc), key=lambda n: -sum(1 for _ in n))
        anc_names = {cname[a] for a in anc}
        system = classify([cname[c]])
        if ({'muscle organ', 'zone of muscle organ'} & anc_names) and system not in ('circulatory',) \
                and not any('cardiac' in n or 'heart' in n for n in anc_names):
            system = 'muscular'
        if system == 'other':
            # walk ancestors breadth-first: the nearest classifiable ancestor wins
            frontier, seen = [c], {c}
            while frontier and system == 'other':
                nxt = []
                for x in frontier:
                    for p in sorted(par.get(x, ())):
                        if p not in seen:
                            seen.add(p); nxt.append(p)
                level = [classify([cname[p]]) for p in nxt]
                level = [l for l in level if l != 'other']
                if level:
                    system = collections.Counter(level).most_common(1)[0][0]
                frontier = nxt
        out[f] = {'fma': c, 'name': cname[c], 'system': system}
    return out

if __name__ == '__main__':
    out = build()
    json.dump(out, open(os.path.join(SRC, 'index.json'), 'w'), indent=0)
    print(collections.Counter(v['system'] for v in out.values()))
    others = sorted({v['name'] for v in out.values() if v['system'] == 'other'})
    print(len(others), others[:80])
