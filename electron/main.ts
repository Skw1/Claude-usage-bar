import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { UsageScraper } from './scraper';
import { SettingsManager } from './settings-manager';
import type { UsageData, AppSettings } from '../src/lib/types';

const isDev = !app.isPackaged;
const WIDGET_W = 260;

function preloadPath(file: string): string {
  if (!app.isPackaged) return path.join(__dirname, file);
  // Preloads are asarUnpack'd — reference from app.asar.unpacked
  return path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), file);
}

// ---------------------------------------------------------------------------
// Local static file server — used in packaged mode so relative asset paths
// (e.g. ./_next/...) resolve correctly for both / and /settings/ pages
// ---------------------------------------------------------------------------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
  '.map':  'application/json',
};

let staticPort = 0;

function startStaticServer(dir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = (req.url ?? '/').split('?')[0];
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const filePath = path.join(dir, urlPath);
      try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      staticPort = (server.address() as { port: number }).port;
      resolve(staticPort);
    });
    server.on('error', reject);
  });
}
const PREFS_FILE = () => path.join(app.getPath('userData'), 'claude-usage-bar-pos.json');

let widget: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let scraper: UsageScraper | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastData: UsageData | null = null;
let isRefreshing = false;
let lastNotifiedThreshold = 0;
let alwaysOnTop = true;
let settings: SettingsManager;

// ---------------------------------------------------------------------------
// Position persistence
// ---------------------------------------------------------------------------
function loadPos(): { x: number; y: number } | undefined {
  try {
    const raw = fs.readFileSync(PREFS_FILE(), 'utf-8');
    return JSON.parse(raw) as { x: number; y: number };
  } catch { return undefined; }
}

function savePos(x: number, y: number): void {
  try { fs.writeFileSync(PREFS_FILE(), JSON.stringify({ x, y }), 'utf-8'); } catch { /* */ }
}

// ---------------------------------------------------------------------------
// Tray icon — crab mascot PNG (status communicated via tooltip)
// ---------------------------------------------------------------------------
const TRAY_ICON_B64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA3klEQVR4nGNgGAWjYBQMVnC3Pec/CN/vQuA7bRB8rwOBYeqQ1cLUIasl2QH3oYbdbs2CY5jYreZMOEZ2ILo6ZLVDzwF38AQ3tmhBVostWihyQImbBciA//W+dgQdMCHCDaw2y9FkiDngPp44BBkGMhRkOK50AVMLcwDI0fjSEEkOWJsZ/L/Sy/r/7qJogg4AqQGF1IaMMOo54BZaisfnAFw5g6ADBl1BdHegHXB/oAui+wPtABiAGQpiE8rTpKglGtxDikNYXFND7dBxAAMDw38K8dB3wCgYBaOAgZYAAHvvaZKyjaujAAAAAElFTkSuQmCC';

const TRAY_ICON = nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_ICON_B64);

// ---------------------------------------------------------------------------
// Widget window — transparent frameless always-on-top overlay
// ---------------------------------------------------------------------------
function createWidget(): BrowserWindow {
  const savedPos = loadPos();
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea;
  const defaultX = wa.x + wa.width - WIDGET_W - 20;
  const defaultY = wa.y + 20;

  const win = new BrowserWindow({
    width: WIDGET_W,
    height: 40,
    x: savedPos?.x ?? defaultX,
    y: savedPos?.y ?? defaultY,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000', // fully transparent — prevents white corners on Windows
    ...(process.platform === 'linux' ? { type: 'dock' } : {}),
    ...(process.platform === 'win32' ? { roundedCorners: false } : {}), // we handle rounding in CSS
    webPreferences: {
      preload: preloadPath('preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    savePos(x, y);
  });

  if (isDev) {
    win.loadURL('http://localhost:3030');
  } else {
    win.loadURL(`http://127.0.0.1:${staticPort}/`);
  }

  return win;
}

// ---------------------------------------------------------------------------
// Settings window — native-framed, dark-themed
// ---------------------------------------------------------------------------
function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 560,
    height: 480,
    title: 'Claude Usage Bar — Settings',
    icon: TRAY_ICON,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    center: true,
    show: false,
    backgroundColor: '#18181b',
    webPreferences: {
      preload: preloadPath('settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
  });
  settingsWin.setMenu(null);

  if (isDev) {
    settingsWin.loadURL('http://localhost:3030/settings/');
  } else {
    settingsWin.loadURL(`http://127.0.0.1:${staticPort}/settings/`);
  }

  settingsWin.once('ready-to-show', () => {
    settingsWin?.show();
    settingsWin?.focus();
  });

  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------------------------------------------------------------------------
// Usage refresh
// ---------------------------------------------------------------------------
async function doRefresh(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    push('usage:loading', undefined);
    const data = await scraper!.fetchUsage();
    lastData = data;
    push('usage:update', data);
    updateTray(data);
    maybeNotify(data);
  } finally {
    isRefreshing = false;
  }
}

function scheduleRefresh(): void {
  if (refreshTimer) clearInterval(refreshTimer);
  const intervalMs = (settings?.get().refreshIntervalMinutes ?? 5) * 60_000;
  refreshTimer = setInterval(() => void doRefresh(), intervalMs);
}

function push(channel: string, payload: unknown): void {
  if (!widget || widget.isDestroyed()) return;
  if (widget.webContents.isLoading()) {
    widget.webContents.once('did-finish-load', () => widget?.webContents.send(channel, payload));
  } else {
    widget.webContents.send(channel, payload);
  }
}

function updateTray(data: UsageData): void {
  if (!tray) return;
  tray.setImage(TRAY_ICON);
  if (!data.isLoggedIn) {
    tray.setToolTip('Claude Usage — sign in');
    return;
  }
  if (data.error) {
    tray.setToolTip('Claude Usage — error fetching data');
    return;
  }
  const pct = data.sessionPercent ?? 0;
  tray.setToolTip(`Claude Usage — Session ${pct}%`);
}

function maybeNotify(data: UsageData): void {
  if (!data.isLoggedIn || data.error || !Notification.isSupported()) return;
  const cfg = settings.get();
  const pct = data.sessionPercent ?? 0;
  if (cfg.notifyAt95 && pct >= 95 && lastNotifiedThreshold < 95) {
    lastNotifiedThreshold = 95;
    new Notification({ title: 'Claude Usage', body: `Session at ${pct}% — almost at the limit!` }).show();
  } else if (cfg.notifyAt80 && pct >= 80 && lastNotifiedThreshold < 80) {
    lastNotifiedThreshold = 80;
    new Notification({ title: 'Claude Usage', body: `Session reached ${pct}%.` }).show();
  } else if (pct < 80) {
    lastNotifiedThreshold = 0;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  app.setAppUserModelId('com.claude.usage-bar');

  // Hide from macOS dock — we live in the menu bar only
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  // Start local file server for packaged mode (fixes relative chunk paths for /settings/ page)
  if (!isDev) {
    const outDir = path.join(__dirname, '../../out');
    await startStaticServer(outDir);
  }

  settings = new SettingsManager();

  // Apply startup setting (Windows + macOS only)
  if (process.platform !== 'linux') {
    try {
      app.setLoginItemSettings({ openAtLogin: settings.get().launchAtStartup });
    } catch { /* */ }
  }

  scraper = new UsageScraper();
  await scraper.init();
  scraper.on('login-success', () => setTimeout(() => void doRefresh(), 800));

  widget = createWidget();

  tray = new Tray(TRAY_ICON);
  tray.setToolTip('Claude Usage Bar');

  function buildTrayMenu() {
    return Menu.buildFromTemplate([
      { label: 'Refresh now', click: () => void doRefresh() },
      { type: 'separator' },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: alwaysOnTop,
        click: (item) => {
          alwaysOnTop = item.checked;
          if (widget && !widget.isDestroyed()) {
            widget.setAlwaysOnTop(alwaysOnTop, 'pop-up-menu');
          }
          push('always-on-top', alwaysOnTop);
        },
      },
      {
        label: widget?.isVisible() ? 'Hide Widget' : 'Show Widget',
        click: () => {
          if (widget?.isVisible()) widget.hide(); else widget?.show();
        },
      },
      { type: 'separator' },
      { label: 'Settings…', click: openSettings },
      { type: 'separator' },
      {
        label: 'Sign out…',
        click: () => {
          void scraper?.clearSession().then(() => {
            push('usage:login-required', undefined);
            updateTray({ isLoggedIn: false, error: null } as UsageData);
          });
        },
      },
      { label: 'Quit Claude Usage Bar', click: () => app.quit() },
    ]);
  }

  tray.on('click', () => void doRefresh());
  tray.on('right-click', () => tray?.popUpContextMenu(buildTrayMenu()));

  // macOS: left-click shows context menu (no separate click-to-refresh UX)
  if (process.platform === 'darwin') {
    tray.on('click', () => tray?.popUpContextMenu(buildTrayMenu()));
  }

  // Widget IPC
  ipcMain.handle('get-usage', () => lastData);
  ipcMain.handle('refresh', async () => { await doRefresh(); return lastData; });
  ipcMain.handle('get-prefs', () => ({ alwaysOnTop }));
  ipcMain.on('open-login', () => scraper?.showLoginWindow());
  ipcMain.on('open-settings', () => openSettings());
  ipcMain.on('sign-out', async () => {
    await scraper?.clearSession();
    push('usage:login-required', undefined);
    updateTray({ isLoggedIn: false, error: null } as UsageData);
  });
  ipcMain.on('widget-resize', (_e, h: number) => {
    if (widget && !widget.isDestroyed()) widget.setSize(WIDGET_W, Math.round(h));
  });
  ipcMain.on('set-always-on-top', (_e, val: boolean) => {
    alwaysOnTop = val;
    if (widget && !widget.isDestroyed()) widget.setAlwaysOnTop(val, 'pop-up-menu');
  });

  // Settings IPC
  ipcMain.handle('settings:account-email', () => lastData?.accountEmail ?? null);
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:save', (_e, partial: Partial<AppSettings>) => {
    const saved = settings.save(partial);
    scheduleRefresh();
    if (process.platform !== 'linux') {
      try { app.setLoginItemSettings({ openAtLogin: saved.launchAtStartup }); } catch { /* */ }
    }
    return saved;
  });
  ipcMain.on('settings:close', () => settingsWin?.close());

  await doRefresh();
  scheduleRefresh();
});

app.on('window-all-closed', () => { /* stay alive in tray */ });

app.on('before-quit', () => {
  if (refreshTimer) clearInterval(refreshTimer);
  scraper?.destroy();
});
