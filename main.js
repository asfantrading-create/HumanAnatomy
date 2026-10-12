const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Licensing } = require('./licensing');
const { decrypt } = require('./asset-key');

// Auto-update from GitHub Releases (installer builds only; the portable exe cannot self-update).
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch { /* not available in development */ }
const canUpdate = () => autoUpdater && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR;


// Serve the app from a custom privileged scheme so fetch() and ES modules work.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

let licensing;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#0b1220',
    title: 'Human Anatomy 3D',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);
  win.loadURL('app://bundle/src/index.html');
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' && !app.isPackaged) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  const root = path.resolve(__dirname);
  const TYPES = { '.json': 'application/json', '.mp3': 'audio/mpeg', '.bin': 'application/octet-stream', '.png': 'image/png' };
  const ASSETS = path.join(root, 'src', 'assets') + path.sep;
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    // packaged builds ship src/assets encrypted in src/assets-enc/*.enc
    if (file.startsWith(ASSETS) && !fs.existsSync(file)) {
      const enc = path.join(root, 'src', 'assets-enc', file.slice(ASSETS.length) + '.enc');
      try {
        const data = decrypt(fs.readFileSync(enc));
        return new Response(data, { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': String(data.length) } });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
    return net.fetch(pathToFileURL(file).toString());
  });

  licensing = new Licensing();
  ipcMain.handle('license:status', () => licensing.status());
  ipcMain.handle('license:activate', (_e, key) => licensing.activate(String(key || '')));
  ipcMain.handle('license:deactivate', () => licensing.deactivate());
  ipcMain.handle('app:open', (_e, url) => {
    if (/^(https:\/\/wa\.me\/|mailto:)/.test(String(url))) shell.openExternal(String(url));
  });
  ipcMain.handle('app:version', () => app.getVersion());
  // Certificates: render HTML off-screen, print to an A4 landscape PDF and let the user save it.
  ipcMain.handle('pdf:print', async (e, html, fileName) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(String(html)));
      const pdf = await win.webContents.printToPDF({ landscape: true, pageSize: 'A4', printBackground: true, margins: { marginType: 'none' } });
      const parent = BrowserWindow.fromWebContents(e.sender);
      const safe = String(fileName || 'certificate.pdf').replace(/[\\/:*?"<>|]+/g, '_');
      const { canceled, filePath } = await dialog.showSaveDialog(parent, { defaultPath: path.join(app.getPath('documents'), safe), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (canceled || !filePath) return { ok: false };
      fs.writeFileSync(filePath, pdf);
      shell.openPath(filePath);
      return { ok: true, filePath };
    } finally {
      win.destroy();
    }
  });

  ipcMain.handle('update:check', async () => {
    if (!canUpdate()) return { state: 'unsupported' };
    try {
      const r = await autoUpdater.checkForUpdates();
      const v = r && r.updateInfo && r.updateInfo.version;
      return v && v !== app.getVersion() ? { state: 'available', version: v } : { state: 'latest' };
    } catch (e) {
      return { state: 'error', error: String(e.message || e) };
    }
  });

  createWindow();
  if (canUpdate()) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', { state: 'downloaded', version: info.version });
    });
    autoUpdater.on('error', () => { /* offline or no release yet: stay silent */ });
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 15000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
