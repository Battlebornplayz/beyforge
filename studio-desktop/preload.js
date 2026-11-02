const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studioNative', {
  platform: 'studio-desktop',
  openExternal: url => ipcRenderer.invoke('open-external', url),
  version: () => ipcRenderer.invoke('version'),
  onDeepLink: cb => ipcRenderer.on('deep-link', (_e, url) => cb(url)),
  checkUpdate: () => ipcRenderer.invoke('check-update')
});
