"""Merge translated name files (tools/i18n/*.json) into src/assets/names-i18n.json."""
import glob, json, os
here = os.path.dirname(__file__)
merged = {}
for f in sorted(glob.glob(os.path.join(here, 'i18n', '*.json'))):
    merged.update(json.load(open(f, encoding='utf-8')))
out = os.path.join(here, '..', 'src', 'assets', 'names-i18n.json')
json.dump(merged, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(merged), 'names')
