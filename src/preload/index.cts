// Preload sandbox içinde çalışır ve sadece "electron" modülünü yükleyebilir; bu yüzden
// kanal adları burada tekrar yazılı (karşılıkları: src/shared/bridge.ts → IPC).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { AppApi } from '../shared/bridge.js';
import type { GenerateEvent } from '../core/types.js';

const api: AppApi = {
  loadCatalog: () => ipcRenderer.invoke('catalog:load'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  defaultLocation: () => ipcRenderer.invoke('app:default-location'),
  pickFolder: (current) => ipcRenderer.invoke('dialog:pick-folder', current),
  isTargetFree: (selection) => ipcRenderer.invoke('project:is-target-free', selection),
  toolStatus: () => ipcRenderer.invoke('tools:status'),
  generate: (selection) => ipcRenderer.invoke('project:generate', selection),
  cancelGenerate: () => ipcRenderer.invoke('project:cancel'),
  onGenerateEvent: (listener) => {
    const handler = (_: IpcRendererEvent, event: GenerateEvent) => listener(event);
    ipcRenderer.on('project:event', handler);
    return () => ipcRenderer.removeListener('project:event', handler);
  },
  openUrl: (url) => ipcRenderer.invoke('shell:open-url', url),
  openFolder: (path) => ipcRenderer.invoke('shell:open-folder', path),
  openInEditor: (path) => ipcRenderer.invoke('shell:open-editor', path),
  startWatch: (path) => ipcRenderer.invoke('shell:start-watch', path),
  setTheme: (theme) => ipcRenderer.invoke('window:set-theme', theme),
};

contextBridge.exposeInMainWorld('api', api);
