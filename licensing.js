// Offline subscription licensing (main process).
//
// License keys are signed by the publisher with an ECDSA P-256 private key
// (tools/license-generator.html) and verified here with the embedded public key,
// so no server is needed. A key carries the customer name, plan, expiry date and
// optionally the machine ID of the one computer it is bound to.
//
// Key format:  HA3D1-<base64url(JSON payload)>.<base64url(signature)>
const { app } = require('electron');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PREFIX = 'HA3D1-';
const DAY = 24 * 60 * 60 * 1000;

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const b64uDecode = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Stable per-computer ID shown to the customer (XXXX-XXXX-XXXX-XXXX). */
function machineId() {
  let raw = '';
  try {
    if (process.platform === 'win32') {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf8', windowsHide: true });
      raw = (out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i) || [])[1] || '';
    } else if (fs.existsSync('/etc/machine-id')) {
      raw = fs.readFileSync('/etc/machine-id', 'utf8').trim();
    }
  } catch { /* fall back below */ }
  if (!raw) raw = `${os.hostname()}|${os.cpus()[0]?.model}|${os.totalmem()}`;
  const h = crypto.createHash('sha256').update('human-anatomy-3d|' + raw).digest('hex').toUpperCase();
  return h.slice(0, 16).match(/.{4}/g).join('-');
}

class Licensing {
  constructor() {
    const dir = __dirname;
    this.config = { enabled: true, trialDays: 5, ...readJSON(path.join(dir, 'licensing.config.json'), {}) };
    this.publicKey = readJSON(path.join(dir, 'license-public.jwk.json'), null);
    this.file = path.join(app.getPath('userData'), 'license.json');
    this.data = readJSON(this.file, {});
    this.machine = machineId();
    const now = Date.now();
    if (!this.data.firstRun) this.data.firstRun = now;
    // protect the trial against moving the clock backwards
    if (this.data.lastSeen && now < this.data.lastSeen - DAY) this.data.clockTampered = true;
    this.data.lastSeen = Math.max(now, this.data.lastSeen || 0);
    this.write();
  }

  write() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch { /* read-only profile: keep running in memory */ }
  }

  /** Verifies a key; returns { ok, payload, error }. */
  async verify(key) {
    try {
      const raw = String(key || '').replace(/\s+/g, '');
      if (!raw.startsWith(PREFIX)) return { ok: false, error: 'format' };
      const [p, s] = raw.slice(PREFIX.length).split('.');
      const data = b64uDecode(p), sig = b64uDecode(s);
      const pub = await crypto.webcrypto.subtle.importKey('jwk', this.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const valid = await crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, data);
      if (!valid) return { ok: false, error: 'signature' };
      const payload = JSON.parse(data.toString('utf8'));
      // a key is bound to one machine ("machine") or, for institutions, to a list of machines ("machines")
      const machines = (payload.machines || (payload.machine ? [payload.machine] : [])).map((m) => String(m).toUpperCase());
      if (machines.length && !machines.includes(this.machine)) return { ok: false, error: 'machine', payload };
      if (payload.type !== 'staff' && payload.expires && new Date(payload.expires + 'T23:59:59') < new Date()) return { ok: false, error: 'expired', payload };
      return { ok: true, payload };
    } catch (e) {
      return { ok: false, error: 'format' };
    }
  }

  async status() {
    const c = this.config;
    const base = { enabled: !!c.enabled, machine: this.machine, contact: c.contact || {} };
    if (!c.enabled) return { ...base, allowed: true };
    let license = null, licenseError = null;
    if (this.data.key) {
      const r = await this.verify(this.data.key);
      if (r.ok) license = r.payload;
      else { licenseError = r.error; if (r.payload) license = { ...r.payload, invalid: true }; }
    }
    const active = !!(license && !license.invalid);
    const trialEnd = this.data.firstRun + c.trialDays * DAY;
    const trialDaysLeft = this.data.clockTampered ? 0 : Math.max(0, Math.ceil((trialEnd - Date.now()) / DAY));
    const daysLeft = active && license.expires ? Math.max(0, Math.ceil((new Date(license.expires + 'T23:59:59') - Date.now()) / DAY)) : null;
    return { ...base, active, license, licenseError, daysLeft, trialDays: c.trialDays, trialDaysLeft, allowed: active || trialDaysLeft > 0 };
  }

  async activate(key) {
    const r = await this.verify(key);
    if (r.ok) {
      this.data.key = String(key).replace(/\s+/g, '');
      this.write();
    }
    return { ok: r.ok, error: r.error, status: await this.status() };
  }

  async deactivate() {
    delete this.data.key;
    this.write();
    return this.status();
  }
}

module.exports = { Licensing };
