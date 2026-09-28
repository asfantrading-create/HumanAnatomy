// Copies the parts of three.js used by the app into src/vendor so the
// renderer can load them offline (both in development and when packaged).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const three = path.join(root, 'node_modules', 'three');
const out = path.join(root, 'src', 'vendor');
const files = {
  'build/three.module.js': 'three.module.js',
  'build/three.core.js': 'three.core.js',
  'examples/jsm/controls/OrbitControls.js': 'OrbitControls.js',
  'examples/jsm/environments/RoomEnvironment.js': 'RoomEnvironment.js',
  'examples/jsm/utils/BufferGeometryUtils.js': 'BufferGeometryUtils.js',
  LICENSE: 'three-LICENSE.txt'
};

fs.mkdirSync(out, { recursive: true });
for (const [from, to] of Object.entries(files)) {
  fs.copyFileSync(path.join(three, from), path.join(out, to));
}
console.log(`three.js vendored into ${path.relative(root, out)}`);
