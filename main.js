const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { Licensing } = require('./licensing');

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
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  licensing = new Licensing();
  ipcMain.handle('license:status', () => licensing.status());
  ipcMain.handle('license:refresh', () => licensing.refresh());
  ipcMain.handle('license:activate', (_e, key) => licensing.activate(String(key || '').trim()));
  ipcMain.handle('license:deactivate', () => licensing.deactivate());
  ipcMain.handle('license:store', () => { const u = licensing.config.storeUrl; if (/^https:\/\//.test(u || '')) shell.openExternal(u); });
  ipcMain.handle('app:version', () => app.getVersion());

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
