const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseAPI', {
  status: () => ipcRenderer.invoke('license:status'),
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  deactivate: () => ipcRenderer.invoke('license:deactivate'),
  open: (url) => ipcRenderer.invoke('app:open', url),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, r) => cb(r)),
  printPDF: (html, fileName) => ipcRenderer.invoke('pdf:print', html, fileName)
});
