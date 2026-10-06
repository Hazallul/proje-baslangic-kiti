import type { FrameworkId } from '../types.js';

export type OptionGroup = 'styling' | 'ui' | 'routing' | 'state' | 'data' | 'quality' | 'testing';

export const OPTION_GROUPS: Record<OptionGroup, { label: string; exclusive: boolean }> = {
  styling: { label: 'Stil', exclusive: false },
  ui: { label: 'UI kütüphanesi', exclusive: true },
  routing: { label: 'Sayfa yönlendirme', exclusive: false },
  state: { label: 'State yönetimi', exclusive: true },
  data: { label: 'Veri çekme', exclusive: false },
  quality: { label: 'Kod kalitesi', exclusive: false },
  testing: { label: 'Test', exclusive: false },
};

export interface FrontendOptionDef {
  id: string;
  label: string;
  description: string;
  group: OptionGroup;
  /** Bu seçenek için önce işaretlenmesi gereken seçenekler */
  requires?: string[];
}

export interface FrameworkDef {
  id: FrameworkId;
  label: string;
  description: string;
  devPort: number;
  options: FrontendOptionDef[];
}

const tailwind: FrontendOptionDef = { id: 'tailwind', label: 'Tailwind CSS', description: 'Utility-first CSS (v4)', group: 'styling' };
const axios: FrontendOptionDef = { id: 'axios', label: 'Axios', description: '/api için hazır HTTP istemcisi', group: 'data' };
const prettier: FrontendOptionDef = { id: 'prettier', label: 'Prettier', description: 'Otomatik kod biçimlendirme', group: 'quality' };

export const FRAMEWORKS: FrameworkDef[] = [
  {
    id: 'react',
    label: 'React',
    description: 'React 19 + TypeScript + Vite',
    devPort: 5173,
    options: [
      tailwind,
      { id: 'shadcn', label: 'shadcn/ui', description: 'Kopyala-yapıştır Radix bileşenleri', group: 'ui', requires: ['tailwind'] },
      { id: 'mui', label: 'Material UI', description: 'Google Material Design bileşenleri', group: 'ui' },
      { id: 'antd', label: 'Ant Design', description: 'Kurumsal arayüz bileşenleri', group: 'ui' },
      { id: 'mantine', label: 'Mantine', description: '100+ bileşen ve hook', group: 'ui' },
      { id: 'react-router', label: 'React Router', description: 'Sayfalar arası yönlendirme', group: 'routing' },
      { id: 'zustand', label: 'Zustand', description: 'Hafif, basit global state', group: 'state' },
      { id: 'redux', label: 'Redux Toolkit', description: 'Büyük uygulamalar için öngörülebilir state', group: 'state' },
      { id: 'tanstack-query', label: 'TanStack Query', description: 'Sunucu verisi önbellekleme ve senkronizasyon', group: 'data' },
      axios,
      { id: 'eslint', label: 'ESLint', description: 'Oxlint yerine ESLint ile lint', group: 'quality' },
      prettier,
      { id: 'vitest', label: 'Vitest + Testing Library', description: 'Birim ve bileşen testleri', group: 'testing' },
    ],
  },
  {
    id: 'vue',
    label: 'Vue',
    description: 'Vue 3 + TypeScript + Vite',
    devPort: 5173,
    options: [
      tailwind,
      { id: 'vuetify', label: 'Vuetify', description: 'Material Design bileşenleri', group: 'ui' },
      { id: 'primevue', label: 'PrimeVue', description: '90+ zengin bileşen', group: 'ui' },
      { id: 'element-plus', label: 'Element Plus', description: 'Masaüstü odaklı bileşen seti', group: 'ui' },
      { id: 'vue-router', label: 'Vue Router', description: 'Sayfalar arası yönlendirme', group: 'routing' },
      { id: 'pinia', label: 'Pinia', description: 'Resmi state yönetimi', group: 'state' },
      { id: 'tanstack-query', label: 'TanStack Query', description: 'Sunucu verisi önbellekleme ve senkronizasyon', group: 'data' },
      axios,
      prettier,
      { id: 'vitest', label: 'Vitest + Vue Test Utils', description: 'Birim ve bileşen testleri', group: 'testing' },
    ],
  },
  {
    id: 'angular',
    label: 'Angular',
    description: 'Angular (güncel sürüm), router dahil',
    devPort: 4200,
    options: [
      tailwind,
      { id: 'angular-material', label: 'Angular Material', description: 'Resmi Material Design bileşenleri', group: 'ui' },
      { id: 'primeng', label: 'PrimeNG', description: '80+ zengin bileşen', group: 'ui' },
      prettier,
    ],
  },
  {
    id: 'svelte',
    label: 'Svelte',
    description: 'Svelte 5 + TypeScript + Vite',
    devPort: 5173,
    options: [
      tailwind,
      axios,
      prettier,
      { id: 'vitest', label: 'Vitest', description: 'Birim testleri', group: 'testing' },
    ],
  },
];

export function findFramework(id: FrameworkId): FrameworkDef {
  const fw = FRAMEWORKS.find((f) => f.id === id);
  if (!fw) throw new Error(`Bilinmeyen framework: ${id}`);
  return fw;
}
