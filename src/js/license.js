// Renderer side of licensing. Without the Electron preload (e.g. in a browser)
// licensing is simply disabled.
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
    listener(await api.refresh());
    setInterval(async () => listener(await api.refresh()), 6 * 60 * 60 * 1000);
  },
  async activate(key) {
    if (!api) return { ok: false };
    const r = await api.activate(key);
    this.listener(r.status);
    return r;
  },
  async deactivate() { if (api) this.listener(await api.deactivate()); },
  openStore() { if (api) api.openStore(); }
};
