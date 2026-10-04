// Renderer side of licensing. Without the Electron preload (e.g. in a browser)
// licensing is disabled and the app runs freely.
const api = window.licenseAPI;

export const licensing = {
  listener: () => {},
  async init(listener) {
    this.listener = listener;
    if (!api) { listener({ enabled: false, allowed: true }); return; }
    const v = await api.version();
    const el = document.querySelector('#app-version');
    if (el) el.textContent = `v${v}`;
    listener(await api.status());
    // re-check hourly so an expiring subscription is noticed while the app stays open
    setInterval(async () => listener(await api.status()), 60 * 60 * 1000);
  },
  async activate(key) {
    if (!api) return { ok: false, error: 'format' };
    const r = await api.activate(key);
    this.listener(r.status);
    return r;
  },
  async deactivate() { if (api) this.listener(await api.deactivate()); },
  open(url) { if (api) api.open(url); else window.open(url, '_blank'); }
};
