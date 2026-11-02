const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('beyforgeNative', {
  platform: 'desktop',
  openExternal: url => ipcRenderer.invoke('open-external', url),
  version: () => ipcRenderer.invoke('version'),
  onDeepLink: cb => ipcRenderer.on('deep-link', (_e, url) => cb(url)),
  onUpdateReady: cb => ipcRenderer.on('update-ready', (_e, v) => cb(v)),
  installUpdate: () => ipcRenderer.invoke('install-update')
});
