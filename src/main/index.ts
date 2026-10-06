import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serviceLinks } from '../core/generate/compose.js';
import { generateProject, isDockerRunning, isTargetFree } from '../core/generate/index.js';
import { loadCatalog } from '../core/initializr.js';
import { resolve } from '../core/selection.js';
import type { Selection } from '../core/types.js';
import { CancelledError, commandSucceeds } from '../core/util.js';
import { type AppApi, type GenerateOutcome, IPC, type Settings } from '../shared/bridge.js';

const here = dirname(fileURLToPath(import.meta.url));
const settingsFile = () => join(app.getPath('userData'), 'settings.json');

const TITLE_BAR = {
  dark: { color: '#0f1014', symbolColor: '#c9cbd6' },
  light: { color: '#f6f6f9', symbolColor: '#3a3d4a' },
};

let window: BrowserWindow | null = null;
let running: AbortController | null = null;

/**
 * Uygulama Başlat menüsünden açıldığında PATH, araçlar kurulmadan önceki haliyle gelebilir
 * (ör. Node yeni kurulduysa oturum yeniden açılana kadar). Bilinen kurulum klasörlerini ekle.
 */
function ensureToolPaths(): void {
  if (process.platform !== 'win32') return;
  const candidates = [
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'nodejs'),
    join(process.env.APPDATA ?? '', 'npm'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'cmd'),
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Microsoft VS Code', 'bin'),
  ];
  const current = (process.env.PATH ?? '').split(';').map((p) => p.toLowerCase());
  const missing = candidates.filter((p) => existsSync(p) && !current.includes(p.toLowerCase()));
  if (missing.length) process.env.PATH = [process.env.PATH, ...missing].join(';');
}

ensureToolPaths();

function createWindow(): void {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'create-hazal-app',
    backgroundColor: TITLE_BAR[theme].color,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLE_BAR[theme], height: 40 },
    // exe'nin kendisi değiştirilmediği için (bkz. README: Smart App Control) ikon pencereye buradan verilir
    icon: join(here, '../../build/icon.png'),
    show: false,
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.once('ready-to-show', () => window?.show());

  // Arayüzdeki bağlantılar uygulamanın içinde değil, varsayılan tarayıcıda açılsın
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) void window.loadURL(devServer);
  else void window.loadFile(join(here, '../renderer/index.html'));
}

function readSettings(): Settings {
  try {
    return { lastSelection: null, templates: [], theme: 'system', ...JSON.parse(readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return { lastSelection: null, templates: [], theme: 'system' };
  }
}

type Handlers = { [K in keyof AppApi]?: (...args: Parameters<AppApi[K]>) => ReturnType<AppApi[K]> };

const handlers: Handlers = {
  loadCatalog: () => loadCatalog(join(app.getPath('userData'), 'initializr.json')),

  loadSettings: async () => readSettings(),

  saveSettings: async (settings) => {
    mkdirSync(dirname(settingsFile()), { recursive: true });
    writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  },

  defaultLocation: async () => {
    const projects = join(app.getPath('home'), 'Projects');
    return existsSync(projects) ? projects : app.getPath('documents');
  },

  pickFolder: async (current) => {
    const result = await dialog.showOpenDialog(window!, {
      title: 'Projenin oluşturulacağı klasör',
      defaultPath: current || undefined,
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  },

  isTargetFree: async (selection) => isTargetFree(selection),

  toolStatus: async () => {
    const [docker, node, git] = await Promise.all([
      isDockerRunning(),
      commandSucceeds('npm --version', app.getPath('home')),
      commandSucceeds('git --version', app.getPath('home')),
    ]);
    return { docker, node, git };
  },

  generate: async (selection: Selection): Promise<GenerateOutcome> => {
    if (running) return { ok: false, cancelled: false, message: 'Zaten bir proje oluşturuluyor.' };
    running = new AbortController();
    try {
      const result = await generateProject(selection, {
        signal: running.signal,
        onEvent: (event) => window?.webContents.send(IPC.generateEvent, event),
      });
      return { ok: true, result, links: serviceLinks(resolve(selection), result.ports) };
    } catch (error) {
      return {
        ok: false,
        cancelled: error instanceof CancelledError,
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      running = null;
    }
  },

  cancelGenerate: async () => {
    running?.abort();
  },

  openUrl: async (url) => {
    if (/^https?:\/\//.test(url)) await shell.openExternal(url);
  },

  openFolder: async (path) => {
    await shell.openPath(path);
  },

  openInEditor: async (path) => commandSucceeds(`code "${path}"`, path),

  startWatch: async (path) => {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '"docker compose watch"', 'cmd', '/k', 'docker compose watch'], {
        cwd: path,
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: true,
      }).unref();
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', `tell app "Terminal" to do script "cd '${path}' && docker compose watch"`], { detached: true }).unref();
    } else {
      spawn('x-terminal-emulator', ['-e', 'docker compose watch'], { cwd: path, detached: true, stdio: 'ignore' }).unref();
    }
  },

  setTheme: async (theme) => {
    window?.setTitleBarOverlay({ ...TITLE_BAR[theme], height: 40 });
    window?.setBackgroundColor(TITLE_BAR[theme].color);
  },
};

const channels = IPC as Record<string, string>;
for (const [name, handler] of Object.entries(handlers)) {
  ipcMain.handle(channels[name], (_event, ...args: unknown[]) => (handler as (...a: unknown[]) => unknown)(...args));
}

// Uygulama tek pencerede çalışır; tekrar açılınca mevcut pencere öne gelir
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
}

app.whenReady().then(() => {
  if (!primaryInstance) return;
  app.setAppUserModelId('com.hazallul.createhazalapp');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  running?.abort();
  if (process.platform !== 'darwin') app.quit();
});
