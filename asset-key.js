// Key for the packaged (encrypted) assets. It deters casual copying; it is not
// meant as strong DRM since the key necessarily ships with the application.
const crypto = require('crypto');
const parts = ['HA3D', 'asfan', 'anatomy', '2026', 'assets-v1'];
exports.assetKey = () => crypto.createHash('sha256').update(parts.join('|')).digest();

exports.decrypt = (buf) => {
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), body = buf.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', exports.assetKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
};
