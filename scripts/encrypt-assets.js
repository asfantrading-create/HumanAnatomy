// Encrypts src/assets into build-enc/ (AES-256-GCM) for packaged builds, so the
// anatomical models, translations and narration cannot simply be copied out of
// the installed application. main.js decrypts them on the fly.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { assetKey } = require('../asset-key');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'assets');
const out = path.join(root, 'build-enc');
fs.rmSync(out, { recursive: true, force: true });

let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    const rel = path.relative(src, p);
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', assetKey(), iv);
    const body = Buffer.concat([c.update(fs.readFileSync(p)), c.final()]);
    const dst = path.join(out, rel + '.enc');
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, Buffer.concat([iv, c.getAuthTag(), body]));
    n++;
  }
})(src);
console.log(`encrypted ${n} asset files into build-enc/`);
