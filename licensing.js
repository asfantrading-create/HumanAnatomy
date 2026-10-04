// Subscription licensing (main process). Uses Lemon Squeezy's public license API:
// a subscription product issues a license key that becomes inactive/expired when
// the subscription lapses. Activation is bound to this computer via an instance id.
const { app, net } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const API = 'https://api.lemonsqueezy.com/v1/licenses';
const DAY = 24 * 60 * 60 * 1000;

function loadConfig() {
  try {
    return { enabled: false, trialDays: 7, offlineGraceDays: 7, productIds: [], ...JSON.parse(fs.readFileSync(path.join(__dirname, 'licensing.config.json'), 'utf8')) };
  } catch {
    return { enabled: false };
  }
}

class Licensing {
  constructor() {
    this.config = loadConfig();
    this.file = path.join(app.getPath('userData'), 'license.json');
    this.data = this.read();
    if (!this.data.firstRun) { this.data.firstRun = Date.now(); this.write(); }
  }

  read() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return {}; } }
  write() { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); }

  status() {
    const c = this.config;
    if (!c.enabled) return { enabled: false, allowed: true };
    const trialLeft = Math.max(0, Math.ceil((this.data.firstRun + c.trialDays * DAY - Date.now()) / DAY));
    const validRecently = this.data.lastValid && Date.now() - this.data.lastValid < c.offlineGraceDays * DAY;
    const active = !!(this.data.key && this.data.status === 'active' && validRecently);
    return { enabled: true, active, allowed: active || trialLeft > 0, trialDaysLeft: trialLeft, storeUrl: c.storeUrl };
  }

  async call(endpoint, params) {
    const body = new URLSearchParams(params).toString();
    const res = await net.fetch(`${API}/${endpoint}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    return res.json();
  }

  productOk(meta) {
    const ids = this.config.productIds || [];
    return !ids.length || (meta && ids.includes(meta.product_id));
  }

  async activate(key) {
    try {
      const r = await this.call('activate', { license_key: key, instance_name: `${os.hostname()} (${os.platform()})` });
      if (!r.activated || !this.productOk(r.meta)) return { ok: false, error: r.error || 'not activated', status: this.status() };
      this.data = { ...this.data, key, instanceId: r.instance.id, status: r.license_key.status, lastValid: Date.now() };
      this.write();
      return { ok: true, status: this.status() };
    } catch (e) {
      return { ok: false, error: String(e.message || e), status: this.status() };
    }
  }

  /** Re-check the subscription; keeps the last result when offline (grace period). */
  async refresh() {
    if (!this.config.enabled || !this.data.key) return this.status();
    try {
      const r = await this.call('validate', { license_key: this.data.key, instance_id: this.data.instanceId || '' });
      this.data.status = r.valid && this.productOk(r.meta) ? r.license_key.status : (r.license_key?.status || 'invalid');
      if (this.data.status === 'active') this.data.lastValid = Date.now();
      this.write();
    } catch { /* offline: grace period applies */ }
    return this.status();
  }

  async deactivate() {
    if (this.data.key && this.data.instanceId) {
      try { await this.call('deactivate', { license_key: this.data.key, instance_id: this.data.instanceId }); } catch { /* ignore */ }
    }
    delete this.data.key; delete this.data.instanceId; delete this.data.status; delete this.data.lastValid;
    this.write();
    return this.status();
  }
}

module.exports = { Licensing };
