const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseAPI', {
  status: () => ipcRenderer.invoke('license:status'),
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  deactivate: () => ipcRenderer.invoke('license:deactivate'),
  open: (url) => ipcRenderer.invoke('app:open', url),
  version: () => ipcRenderer.invoke('app:version')
});
