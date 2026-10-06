import type { AppApi } from '../../shared/bridge';
import { createMockApi } from './mock';

declare global {
  interface Window {
    api?: AppApi;
  }
}

/** Electron içinde preload'un açtığı API; tarayıcıda (tasarım önizlemesi) sahte API */
export const api: AppApi = window.api ?? createMockApi();
export const isMock = !window.api;
