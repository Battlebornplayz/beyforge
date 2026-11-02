// BeyForge desktop shell: loads the live site (always up to date), falls back to the bundled copy offline,
// handles beyforge:// links (Google sign-in hand-off) and updates itself from GitHub Releases.
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const LIVE = 'https://battlebornplayz.github.io/beyforge/';
let win = null, pendingLink = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
if (process.defaultApp) app.setAsDefaultProtocolClient('beyforge', process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient('beyforge');

function deliver(url) {
  if (!url || !url.startsWith('beyforge://')) return;
  if (win && win.webContents) { win.webContents.send('deep-link', url); if (win.isMinimized()) win.restore(); win.focus(); }
  else pendingLink = url;
}
app.on('second-instance', (_e, argv) => deliver(argv.find(a => a.startsWith('beyforge://'))));
app.on('open-url', (e, url) => { e.preventDefault(); deliver(url); });

function create() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#07060e', title: 'BeyForge',
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  let fellBack = false;
  win.webContents.on('did-fail-load', (_e, code, _d, url, isMain) => {
    if (isMain && !fellBack && code !== -3) { fellBack = true; win.loadFile(path.join(__dirname, 'app', 'index.html')); }
  });
  // links to other sites open in the real browser; Firebase's own sign-in popups stay in-app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/firebaseapp\.com|accounts\.google\.com/.test(url)) return { action: 'allow' };
    shell.openExternal(url); return { action: 'deny' };
  });
  win.webContents.on('did-finish-load', () => { if (pendingLink) { win.webContents.send('deep-link', pendingLink); pendingLink = null; } });
  win.loadURL(LIVE + '?shell=desktop&build=' + app.getVersion());
  const first = process.argv.find(a => a.startsWith('beyforge://')); if (first) pendingLink = first;
}

ipcMain.handle('open-external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('version', () => app.getVersion());

app.whenReady().then(() => {
  create();
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', info => { if (win) win.webContents.send('update-ready', info.version); });
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000);
    ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
  } catch (e) { /* updater unavailable in dev */ }
});
app.on('window-all-closed', () => app.quit());
