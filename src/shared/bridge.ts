import type { InitializrCatalog } from '../core/initializr.js';
import type { GenerateEvent, GenerateResult, Selection } from '../core/types.js';

export interface SavedTemplate {
  id: string;
  name: string;
  selection: Selection;
}

export interface Settings {
  lastSelection: Selection | null;
  templates: SavedTemplate[];
  theme: 'system' | 'light' | 'dark';
}

export interface ToolStatus {
  docker: boolean;
  node: boolean;
  git: boolean;
}

export type GenerateOutcome =
  | { ok: true; result: GenerateResult; links: { label: string; url: string }[] }
  | { ok: false; cancelled: boolean; message: string };

/** Arayüzün (renderer) ana süreçten kullanabildiği tüm işlemler. preload bunu window.api olarak açar. */
export interface AppApi {
  loadCatalog(): Promise<InitializrCatalog>;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  defaultLocation(): Promise<string>;
  pickFolder(current: string): Promise<string | null>;
  isTargetFree(selection: Selection): Promise<boolean>;
  toolStatus(): Promise<ToolStatus>;
  generate(selection: Selection): Promise<GenerateOutcome>;
  cancelGenerate(): Promise<void>;
  onGenerateEvent(listener: (event: GenerateEvent) => void): () => void;
  openUrl(url: string): Promise<void>;
  openFolder(path: string): Promise<void>;
  /** VS Code ile açar; VS Code bulunamazsa false döner */
  openInEditor(path: string): Promise<boolean>;
  /** Yeni bir terminal penceresinde "docker compose watch" başlatır */
  startWatch(path: string): Promise<void>;
  setTheme(theme: 'light' | 'dark'): Promise<void>;
}

export const IPC = {
  loadCatalog: 'catalog:load',
  loadSettings: 'settings:load',
  saveSettings: 'settings:save',
  defaultLocation: 'app:default-location',
  pickFolder: 'dialog:pick-folder',
  isTargetFree: 'project:is-target-free',
  toolStatus: 'tools:status',
  generate: 'project:generate',
  cancelGenerate: 'project:cancel',
  generateEvent: 'project:event',
  openUrl: 'shell:open-url',
  openFolder: 'shell:open-folder',
  openInEditor: 'shell:open-editor',
  startWatch: 'shell:start-watch',
  setTheme: 'window:set-theme',
} as const;
