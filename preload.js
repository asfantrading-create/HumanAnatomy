const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseAPI', {
  status: () => ipcRenderer.invoke('license:status'),
  refresh: () => ipcRenderer.invoke('license:refresh'),
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  deactivate: () => ipcRenderer.invoke('license:deactivate'),
  openStore: () => ipcRenderer.invoke('license:store'),
  version: () => ipcRenderer.invoke('app:version')
});
