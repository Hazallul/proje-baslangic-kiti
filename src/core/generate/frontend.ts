import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findFramework } from '../catalog/frontend.js';
import { hasBackend } from '../selection.js';
import type { FrameworkId, ResolvedProject } from '../types.js';
import { run, writeFiles } from '../util.js';
import type { StepContext } from './backend.js';
import {
  angularStartPage, localeFiles, needsStartPageCss, REACT_I18N, reactStartPage, reactStartPageTest, START_PAGE_CSS,
  svelteStartPage, VUE_I18N, vueStartPage,
} from './startpage.js';

/**
 * Frontend'i resmi araçlarla (create-vite / Angular CLI) oluşturur, sonra seçilen
 * seçenekleri (Tailwind, UI kütüphanesi, router...) kurar ve yapılandırır.
 */
export async function generateFrontend(resolved: ResolvedProject, projectDir: string, ctx: StepContext): Promise<void> {
  const sel = resolved.selection;
  const framework = sel.frontend.framework;
  if (!framework) return;

  const options = new Set(resolved.frontendOptions);
  const dir = join(projectDir, 'frontend');
  const exec = (command: string, cwd = dir) => {
    ctx.log(`> ${command}\n`);
    return run(command, { cwd, signal: ctx.signal, onOutput: ctx.log, env: { NG_CLI_ANALYTICS: 'false' } });
  };

  // 1. Resmi iskelet
  if (framework === 'angular') {
    await exec(
      `npx -y @angular/cli@22 new ${sel.name} --directory frontend --defaults --skip-git --skip-install `
      + '--style=css --routing --ssr=false --ai-config=none --interactive=false',
      projectDir,
    );
  } else {
    const template = { react: 'react-ts', vue: 'vue-ts', svelte: 'svelte-ts' }[framework];
    const eslint = framework === 'react' && options.has('eslint') ? ' --eslint' : '';
    await exec(`npx -y create-vite@9 frontend --template ${template} --no-interactive --no-immediate${eslint}`, projectDir);
  }

  // 2. Seçeneklere göre dosyalar
  const plan = buildPlan(framework, options, sel.name, hasBackend(sel));
  writeFiles(dir, plan.files);
  plan.edits.forEach((edit) => edit(dir));
  if (framework !== 'angular') cleanupViteScaffold(dir, sel.name);
  writeFiles(dir, {
    Dockerfile: dockerfile(framework),
    '.dockerignore': 'node_modules/\ndist/\n.angular/\n',
  });

  // 3. Paketler
  // Bilgisayardaki node_modules sadece editör ve kurulum komutları için; uygulama Docker'da kendi
  // kurulumuyla çalışır. Paketlerin kurulum betikleri (esbuild gibi) Windows Akıllı Uygulama
  // Denetimi'ne takılabildiği için çalıştırılmaz.
  const install = 'npm install --no-audit --no-fund --ignore-scripts';
  await exec(install);
  if (plan.dependencies.length) await exec(`${install} ${plan.dependencies.join(' ')}`);
  if (plan.devDependencies.length) await exec(`${install} -D ${plan.devDependencies.join(' ')}`);
  for (const [name, value] of Object.entries(plan.scripts)) {
    await exec(`npm pkg set "scripts.${name}=${value}"`);
  }

  // 4. Kendi kurulum komutu olan kütüphaneler
  for (const command of plan.postInstall) await exec(command);

  // 5. Üretilen tüm dosyaları projenin Prettier ayarına göre biçimlendir
  if (options.has('prettier')) await exec('npx prettier --write src --log-level warn');
}

interface FrontendPlan {
  /** Projede Spring Boot backend var mı (başlangıç sayfası ve /api proxy buna göre) */
  backend: boolean;
  files: Record<string, string>;
  edits: ((dir: string) => void)[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  postInstall: string[];
}

function buildPlan(framework: FrameworkId, options: Set<string>, name: string, backend: boolean): FrontendPlan {
  const plan: FrontendPlan = { backend, files: {}, edits: [], dependencies: [], devDependencies: [], scripts: {}, postInstall: [] };

  if (options.has('prettier')) {
    plan.devDependencies.push('prettier');
    plan.files['.prettierrc.json'] = '{\n  "singleQuote": true,\n  "semi": false\n}\n';
    plan.files['.prettierignore'] = 'dist\nnode_modules\n.angular\n';
    plan.scripts.format = 'prettier --write src';
  }
  if (options.has('axios') && framework !== 'angular') {
    plan.dependencies.push('axios');
    plan.files['src/lib/api.ts'] = backend
      ? `import axios from 'axios'

/** Backend istekleri için ortak istemci. Vite proxy /api isteklerini backend'e yönlendirir. */
export const api = axios.create({ baseURL: '/api' })
`
      : `import axios from 'axios'

/** Dış API istekleri için ortak istemci. Adresi .env dosyasında VITE_API_URL ile ver. */
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL })
`;
  }

  switch (framework) {
    case 'react': reactPlan(plan, options, name); break;
    case 'vue': vuePlan(plan, options, name); break;
    case 'svelte': sveltePlan(plan, options, name); break;
    case 'angular': angularPlan(plan, options, name); break;
  }
  if (options.has('vercel')) plan.edits.push((dir) => writeFileSync(join(dir, '..', 'vercel.json'), vercelConfig(framework, name)));
  return plan;
}

/**
 * Vercel ayarı proje kökünde durur (depo kökü). Vercel'de "Root Directory" değiştirmeye gerek kalmaz.
 * rewrites: sayfa yenilenince veya doğrudan bir adres açılınca SPA'nın index.html'i döner.
 */
function vercelConfig(framework: FrameworkId, name: string): string {
  const output = framework === 'angular' ? `frontend/dist/${name}/browser` : 'frontend/dist';
  return JSON.stringify({
    $schema: 'https://openapi.vercel.sh/vercel.json',
    installCommand: 'cd frontend && npm install',
    buildCommand: 'cd frontend && npm run build',
    outputDirectory: output,
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  }, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// Ortak: durum sayfası stilleri ve Vite yapılandırması
// ---------------------------------------------------------------------------

function viteConfig(pluginImport: string, plugin: string, options: Set<string>, alias: boolean, backend: boolean): string {
  const tailwind = options.has('tailwind');
  const vitest = options.has('vitest');
  return `${vitest ? '/// <reference types="vitest/config" />\n' : ''}${alias ? "import path from 'node:path'\n" : ''}import { defineConfig } from 'vite'
${pluginImport}
${tailwind ? "import tailwindcss from '@tailwindcss/vite'\n" : ''}
export default defineConfig({
  plugins: [${plugin}${tailwind ? ', tailwindcss()' : ''}],${alias ? `
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },` : ''}${backend ? `
  server: {
    // /api istekleri backend'e gider, CORS ayarı gerekmez. Docker içinde API_URL verilir.
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },` : ''}${vitest ? `
  test: {
    environment: 'jsdom',
  },` : ''}
})
`;
}

/** create-vite'in ürettiği ana CSS dosyasını sadeleştirir (Tailwind seçiliyse import eder). */
function resetCss(options: Set<string>): string {
  return options.has('tailwind') ? '@import "tailwindcss";\n' : '';
}

// ---------------------------------------------------------------------------
// React
// ---------------------------------------------------------------------------

function reactPlan(plan: FrontendPlan, options: Set<string>, name: string): void {
  const shadcn = options.has('shadcn');
  const router = options.has('react-router');

  if (options.has('tailwind')) plan.devDependencies.push('tailwindcss', '@tailwindcss/vite');
  if (shadcn) {
    // shadcn, "@/" yol kısaltmasını tsconfig'de arar
    plan.edits.push((dir) => {
      editText(join(dir, 'tsconfig.json'), (s) =>
        s.replace('"files": [],', '"files": [],\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },'));
      editText(join(dir, 'tsconfig.app.json'), (s) =>
        s.replace('"compilerOptions": {', '"compilerOptions": {\n    "paths": { "@/*": ["./src/*"] },'));
      // shadcn'in ürettiği bileşen dosyaları yardımcı fonksiyon da export eder; shadcn'in önerdiği gibi lint dışı
      if (options.has('eslint')) {
        editText(join(dir, 'eslint.config.js'), (s) => s.replace("globalIgnores(['dist'])", "globalIgnores(['dist', 'src/components/ui'])"));
      }
    });
    plan.postInstall.push('npx -y shadcn@4 init -y --base radix --preset nova --no-monorepo', 'npx -y shadcn@4 add button input card badge -y');
  }
  if (options.has('mui')) plan.dependencies.push('@mui/material', '@emotion/react', '@emotion/styled');
  if (options.has('antd')) plan.dependencies.push('antd');
  if (options.has('mantine')) plan.dependencies.push('@mantine/core', '@mantine/hooks');
  if (router) plan.dependencies.push('react-router');
  if (options.has('zustand')) {
    plan.dependencies.push('zustand');
    plan.files['src/store/useAppStore.ts'] = `import { create } from 'zustand'

/** Örnek global state. İhtiyacına göre alan ekle. */
interface AppState {
  sidebarOpen: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
`;
  }
  if (options.has('redux')) {
    plan.dependencies.push('@reduxjs/toolkit', 'react-redux');
    plan.files['src/store/index.ts'] = `import { configureStore, createSlice } from '@reduxjs/toolkit'

/** Örnek slice. Yeni özellikler için src/store altına yeni slice dosyaları ekle. */
const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: true },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
  },
})

export const { toggleSidebar } = uiSlice.actions

export const store = configureStore({
  reducer: { ui: uiSlice.reducer },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
`;
  }
  if (options.has('tanstack-query')) plan.dependencies.push('@tanstack/react-query');
  if (options.has('motion')) plan.dependencies.push('motion');
  if (options.has('i18n')) {
    plan.dependencies.push('i18next', 'react-i18next');
    plan.files['src/i18n.ts'] = REACT_I18N;
    Object.assign(plan.files, localeFiles('react'));
  }
  if (options.has('vitest')) {
    plan.devDependencies.push('vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom');
    plan.scripts.test = 'vitest';
    plan.files['src/pages/StatusPage.test.tsx'] = reactStartPageTest({ name, options, backend: plan.backend });
  }

  // main.tsx: seçilen kütüphanelerin provider'ları
  const imports = ["import { StrictMode } from 'react'", "import { createRoot } from 'react-dom/client'"];
  const setup: string[] = [];
  let tree = '<App />';
  if (router) {
    imports.push("import { BrowserRouter } from 'react-router'");
    tree = `<BrowserRouter>\n      ${tree}\n    </BrowserRouter>`;
  }
  if (options.has('redux')) {
    imports.push("import { Provider } from 'react-redux'", "import { store } from './store'");
    tree = `<Provider store={store}>\n      ${tree}\n    </Provider>`;
  }
  if (options.has('tanstack-query')) {
    imports.push("import { QueryClient, QueryClientProvider } from '@tanstack/react-query'");
    setup.push('const queryClient = new QueryClient()');
    tree = `<QueryClientProvider client={queryClient}>\n      ${tree}\n    </QueryClientProvider>`;
  }
  if (options.has('mantine')) {
    imports.push("import '@mantine/core/styles.css'", "import { MantineProvider } from '@mantine/core'");
    tree = `<MantineProvider>\n      ${tree}\n    </MantineProvider>`;
  }
  if (options.has('mui')) {
    imports.push("import CssBaseline from '@mui/material/CssBaseline'");
    tree = `<>\n      <CssBaseline />\n      ${tree}\n    </>`;
  }
  if (options.has('i18n')) imports.push("import './i18n'");
  imports.push("import './index.css'", "import App from './App'");

  plan.files['src/main.tsx'] = `${imports.join('\n')}
${setup.length ? `\n${setup.join('\n')}\n` : ''}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    ${tree}
  </StrictMode>,
)
`;

  plan.files['src/App.tsx'] = router
    ? `import { Route, Routes } from 'react-router'
import StatusPage from './pages/StatusPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
    </Routes>
  )
}
`
    : `import StatusPage from './pages/StatusPage'

export default function App() {
  return <StatusPage />
}
`;

  plan.files['src/pages/StatusPage.tsx'] = reactStartPage({ name, options, backend: plan.backend });
  if (needsStartPageCss(options)) plan.files['src/pages/status.css'] = START_PAGE_CSS;
  plan.files['src/index.css'] = resetCss(options);
  plan.files['vite.config.ts'] = viteConfig("import react from '@vitejs/plugin-react'", 'react()', options, shadcn, plan.backend);
  plan.edits.push(removeFiles('src/App.css'));
}

// ---------------------------------------------------------------------------
// Vue
// ---------------------------------------------------------------------------

function vuePlan(plan: FrontendPlan, options: Set<string>, name: string): void {
  const router = options.has('vue-router');

  if (options.has('tailwind')) plan.devDependencies.push('tailwindcss', '@tailwindcss/vite');
  if (options.has('vuetify')) plan.dependencies.push('vuetify');
  if (options.has('primevue')) plan.dependencies.push('primevue', '@primeuix/themes');
  if (options.has('element-plus')) plan.dependencies.push('element-plus');
  if (router) {
    plan.dependencies.push('vue-router');
    plan.files['src/router/index.ts'] = `import { createRouter, createWebHistory } from 'vue-router'
import StatusPage from '../pages/StatusPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: StatusPage }],
})

export default router
`;
  }
  if (options.has('pinia')) {
    plan.dependencies.push('pinia');
    plan.files['src/stores/app.ts'] = `import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Örnek store. İhtiyacına göre alan ekle. */
export const useAppStore = defineStore('app', () => {
  const sidebarOpen = ref(true)
  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value
  }
  return { sidebarOpen, toggleSidebar }
})
`;
  }
  if (options.has('tanstack-query')) plan.dependencies.push('@tanstack/vue-query');
  const i18n = options.has('i18n');
  if (i18n) {
    plan.dependencies.push('vue-i18n');
    plan.files['src/i18n.ts'] = VUE_I18N;
    Object.assign(plan.files, localeFiles('vue'));
  }
  if (options.has('vitest')) {
    plan.devDependencies.push('vitest', 'jsdom', '@vue/test-utils');
    plan.scripts.test = 'vitest';
    plan.files['src/pages/StatusPage.spec.ts'] = `import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
${i18n ? "import i18n from '../i18n'\n" : ''}import StatusPage from './StatusPage.vue'

describe('StatusPage', () => {
  it('proje adını gösterir', () => {
    // UI kütüphanesi bileşenleri taklit edilir, sadece sayfanın kendisi test edilir
    const wrapper = shallowMount(StatusPage${i18n ? ', { global: { plugins: [i18n] } }' : ''})
    expect(wrapper.get('h1').text()).toBe('${name}')
  })
})
`;
  }

  const imports = ["import { createApp } from 'vue'"];
  const uses: string[] = [];
  if (options.has('pinia')) {
    imports.push("import { createPinia } from 'pinia'");
    uses.push('app.use(createPinia())');
  }
  if (router) {
    imports.push("import router from './router'");
    uses.push('app.use(router)');
  }
  if (options.has('tanstack-query')) {
    imports.push("import { VueQueryPlugin } from '@tanstack/vue-query'");
    uses.push('app.use(VueQueryPlugin)');
  }
  if (i18n) {
    imports.push("import i18n from './i18n'");
    uses.push('app.use(i18n)');
  }
  if (options.has('vuetify')) {
    imports.push(
      "import 'vuetify/styles'",
      "import { createVuetify } from 'vuetify'",
      "import * as components from 'vuetify/components'",
      "import * as directives from 'vuetify/directives'",
    );
    uses.push('app.use(createVuetify({ components, directives }))');
  }
  if (options.has('primevue')) {
    imports.push("import PrimeVue from 'primevue/config'", "import Aura from '@primeuix/themes/aura'");
    uses.push('app.use(PrimeVue, { theme: { preset: Aura } })');
  }
  if (options.has('element-plus')) {
    imports.push("import ElementPlus from 'element-plus'", "import 'element-plus/dist/index.css'");
    uses.push('app.use(ElementPlus)');
  }
  imports.push("import './style.css'", "import App from './App.vue'");

  plan.files['src/main.ts'] = `${imports.join('\n')}

const app = createApp(App)
${uses.join('\n')}${uses.length ? '\n' : ''}app.mount('#app')
`;

  // Vuetify bileşenleri stillerini v-app içinde alır
  const page = router ? '<RouterView />' : '<StatusPage />';
  const body = options.has('vuetify') ? `<v-app>
    <v-main>
      ${page}
    </v-main>
  </v-app>` : page;
  plan.files['src/App.vue'] = `<script setup lang="ts">
${router ? "import { RouterView } from 'vue-router'" : "import StatusPage from './pages/StatusPage.vue'"}
</script>

<template>
  ${body}
</template>
`;

  plan.files['src/pages/StatusPage.vue'] = vueStartPage({ name, options, backend: plan.backend });
  if (needsStartPageCss(options)) plan.files['src/pages/status.css'] = START_PAGE_CSS;
  plan.files['src/style.css'] = resetCss(options);
  plan.files['vite.config.ts'] = viteConfig("import vue from '@vitejs/plugin-vue'", 'vue()', options, false, plan.backend);
  plan.edits.push(removeFiles('src/components/HelloWorld.vue'));
}

// ---------------------------------------------------------------------------
// Svelte
// ---------------------------------------------------------------------------

function sveltePlan(plan: FrontendPlan, options: Set<string>, name: string): void {
  if (options.has('tailwind')) plan.devDependencies.push('tailwindcss', '@tailwindcss/vite');
  if (options.has('vitest')) {
    plan.devDependencies.push('vitest', 'jsdom');
    plan.scripts.test = 'vitest';
    plan.files['src/lib/status.test.ts'] = `import { describe, expect, it } from 'vitest'
import { statusLabel } from './status'

describe('statusLabel', () => {
  it('durumları Türkçe etikete çevirir', () => {
    expect(statusLabel('ok')).toBe('çalışıyor')
    expect(statusLabel('error')).toBe('ulaşılamıyor')
  })
})
`;
  }

  plan.files['src/lib/status.ts'] = `export type Status = 'loading' | 'ok' | 'error'

const LABELS: Record<Status, string> = {
  loading: 'kontrol ediliyor…',
  ok: 'çalışıyor',
  error: 'ulaşılamıyor',
}

export function statusLabel(status: Status): string {
  return LABELS[status]
}
`;
  plan.files['src/App.svelte'] = svelteStartPage({ name, options, backend: plan.backend });
  if (needsStartPageCss(options)) plan.files['src/lib/status.css'] = START_PAGE_CSS;
  plan.files['src/app.css'] = resetCss(options);
  plan.files['vite.config.ts'] = viteConfig("import { svelte } from '@sveltejs/vite-plugin-svelte'", 'svelte()', options, false, plan.backend);
  plan.edits.push(removeFiles('src/lib/Counter.svelte'));
}

// ---------------------------------------------------------------------------
// Angular
// ---------------------------------------------------------------------------

function angularPlan(plan: FrontendPlan, options: Set<string>, name: string): void {
  const primeng = options.has('primeng');

  if (options.has('tailwind')) {
    plan.devDependencies.push('tailwindcss', '@tailwindcss/postcss', 'postcss');
    plan.files['.postcssrc.json'] = '{\n  "plugins": {\n    "@tailwindcss/postcss": {}\n  }\n}\n';
  }
  if (primeng) plan.dependencies.push('primeng', '@primeuix/themes', '@angular/cdk');
  if (options.has('angular-material')) {
    plan.postInstall.push('npx ng add @angular/material --skip-confirmation --defaults');
  }

  plan.files['src/styles.css'] = resetCss(options);
  if (plan.backend) {
    plan.files['proxy.conf.mjs'] = `// /api istekleri backend'e gider, CORS ayarı gerekmez. Docker içinde API_URL verilir.
export default {
  '/api': {
    target: process.env.API_URL ?? 'http://localhost:8080',
    changeOrigin: true,
  },
}
`;
    plan.edits.push((dir) => {
      const file = join(dir, 'angular.json');
      const config = JSON.parse(readFileSync(file, 'utf8'));
      const serve = config.projects[name].architect.serve;
      serve.options = { ...serve.options, proxyConfig: 'proxy.conf.mjs' };
      writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
    });
  }

  plan.files['src/app/app.config.ts'] = `import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideHttpClient, withFetch } from '@angular/common/http'
import { provideRouter } from '@angular/router'
${primeng ? "import { providePrimeNG } from 'primeng/config'\nimport Aura from '@primeuix/themes/aura'\n" : ''}import { routes } from './app.routes'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),${primeng ? '\n    providePrimeNG({ theme: { preset: Aura } }),' : ''}
  ],
}
`;
  plan.files['src/app/app.routes.ts'] = `import { Routes } from '@angular/router'
import { StatusPage } from './pages/status-page'

export const routes: Routes = [{ path: '', component: StatusPage }]
`;
  plan.files['src/app/app.ts'] = `import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
`;
  Object.assign(plan.files, angularStartPage({ name, options, backend: plan.backend }));
  plan.edits.push(removeFiles('src/app/app.html', 'src/app/app.css', 'src/app/app.spec.ts'));
}

// ---------------------------------------------------------------------------

function dockerfile(framework: FrameworkId): string {
  const port = findFramework(framework).devPort;
  const command = framework === 'angular'
    ? '["npm", "start", "--", "--host", "0.0.0.0"]'
    : '["npm", "run", "dev", "--", "--host", "0.0.0.0"]';
  return `# Geliştirme imajı: dev sunucusu (hot reload)
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE ${port}
CMD ${command}
`;
}

function editText(file: string, transform: (content: string) => string): void {
  writeFileSync(file, transform(readFileSync(file, 'utf8')));
}

/**
 * create-vite'in örnek sayfasından kalanlar: kullanılmayan görseller ve "frontend" başlıklı sekme.
 * Görseller sadece hiçbir kaynak dosyada geçmiyorsa silinir.
 */
function cleanupViteScaffold(dir: string, projectName: string): void {
  editText(join(dir, 'index.html'), (s) =>
    s.replace(/<title>[^<]*<\/title>/, `<title>${projectName}</title>`).replace('<html lang="en">', '<html lang="tr">'));

  const assetsDir = join(dir, 'src', 'assets');
  const sources = listFiles(join(dir, 'src')).filter((f) => !f.startsWith(assetsDir));
  const code = [...sources, join(dir, 'index.html')].map((f) => readFileSync(f, 'utf8')).join('\n');
  if (!code.includes('assets/')) rmSync(assetsDir, { recursive: true, force: true });
  if (!code.includes('icons.svg')) rmSync(join(dir, 'public', 'icons.svg'), { force: true });
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]);
}

/** Şablonun artık kullanılmayan örnek dosyalarını siler */
function removeFiles(...files: string[]) {
  return (dir: string) => files.forEach((f) => rmSync(join(dir, f), { force: true }));
}
