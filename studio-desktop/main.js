// BeyForge Studio desktop shell: loads the live Studio (always current), falls back to the bundled copy offline,
// handles beyforgestudio:// (Google sign-in hand-off) and ASKS before installing updates.
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path'), https = require('https'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const LIVE = 'https://battlebornplayz.github.io/beyforge/studio/';
const REL = 'https://api.github.com/repos/Battlebornplayz/beyforge/releases/tags/studio';
let win = null, pendingLink = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
if (process.defaultApp) app.setAsDefaultProtocolClient('beyforgestudio', process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient('beyforgestudio');
function deliver(url) {
  if (!url || !url.startsWith('beyforgestudio://')) return;
  if (win && win.webContents) { win.webContents.send('deep-link', url); if (win.isMinimized()) win.restore(); win.focus(); } else pendingLink = url;
}
app.on('second-instance', (_e, argv) => deliver(argv.find(a => a.startsWith('beyforgestudio://'))));
app.on('open-url', (e, url) => { e.preventDefault(); deliver(url); });

function create() {
  win = new BrowserWindow({ width: 1480, height: 920, minWidth: 900, minHeight: 600, backgroundColor: '#0a0c0f', title: 'BeyForge Studio',
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  let fellBack = false;
  win.webContents.on('did-fail-load', (_e, code, _d, _u, isMain) => { if (isMain && !fellBack && code !== -3) { fellBack = true; win.loadFile(path.join(__dirname, 'app', 'studio', 'index.html')); } });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('did-finish-load', () => { if (pendingLink) { win.webContents.send('deep-link', pendingLink); pendingLink = null; } });
  win.loadURL(LIVE + '?shell=studio-desktop&build=' + app.getVersion());
  const first = process.argv.find(a => a.startsWith('beyforgestudio://')); if (first) pendingLink = first;
}

// ---------- ask-first updates from the rolling "studio" GitHub release ----------
function getJSON(url) { return new Promise((res, rej) => { https.get(url, { headers: { 'User-Agent': 'BeyForge-Studio' } }, r => {
  if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return getJSON(r.headers.location).then(res, rej);
  let s = ''; r.on('data', d => s += d); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
function download(url, file) { return new Promise((res, rej) => { https.get(url, { headers: { 'User-Agent': 'BeyForge-Studio', Accept: 'application/octet-stream' } }, r => {
  if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return download(r.headers.location, file).then(res, rej);
  if (r.statusCode !== 200) return rej(new Error('Download failed: ' + r.statusCode));
  const out = fs.createWriteStream(file); r.pipe(out); out.on('finish', () => out.close(() => res(file))); }).on('error', rej); }); }
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; } return false; };
async function checkUpdate(manual) {
  try {
    const rel = await getJSON(REL), m = /(\d+\.\d+\.\d+)/.exec(rel.name || ''), latest = m && m[1];
    const asset = (rel.assets || []).find(a => /Studio-Setup\.exe$/.test(a.name));
    if (!latest || !asset || !newer(latest, app.getVersion())) { if (manual) dialog.showMessageBox(win, { message: 'BeyForge Studio is up to date', detail: 'Version ' + app.getVersion() }); return; }
    const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Install update', 'Later'], defaultId: 0, cancelId: 1, title: 'Update available',
      message: `BeyForge Studio ${latest} is available`, detail: `You have ${app.getVersion()}. Studio will close, update and reopen.` });
    if (r.response !== 0) return;
    const file = path.join(os.tmpdir(), 'BeyForge-Studio-Setup.exe'); await download(asset.browser_download_url, file);
    spawn(file, [], { detached: true, stdio: 'ignore' }).unref(); app.quit();
  } catch (e) { if (manual) dialog.showErrorBox('Update check failed', String(e.message || e)); }
}
ipcMain.handle('open-external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('version', () => app.getVersion());
ipcMain.handle('check-update', () => checkUpdate(true));

app.whenReady().then(() => { create(); setTimeout(() => checkUpdate(false), 8000); setInterval(() => checkUpdate(false), 6 * 60 * 60 * 1000); });
app.on('window-all-closed', () => app.quit());
