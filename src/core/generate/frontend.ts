import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findFramework } from '../catalog/frontend.js';
import type { FrameworkId, ResolvedProject } from '../types.js';
import { run, writeFiles } from '../util.js';
import type { StepContext } from './backend.js';

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
  const plan = buildPlan(framework, options, sel.name);
  writeFiles(dir, plan.files);
  plan.edits.forEach((edit) => edit(dir));
  writeFiles(dir, {
    Dockerfile: dockerfile(framework),
    '.dockerignore': 'node_modules/\ndist/\n.angular/\n',
  });

  // 3. Paketler
  await exec('npm install --no-audit --no-fund');
  if (plan.dependencies.length) await exec(`npm install --no-audit --no-fund ${plan.dependencies.join(' ')}`);
  if (plan.devDependencies.length) await exec(`npm install -D --no-audit --no-fund ${plan.devDependencies.join(' ')}`);
  for (const [name, value] of Object.entries(plan.scripts)) {
    await exec(`npm pkg set "scripts.${name}=${value}"`);
  }

  // 4. Kendi kurulum komutu olan kütüphaneler
  for (const command of plan.postInstall) await exec(command);

  // 5. Üretilen tüm dosyaları projenin Prettier ayarına göre biçimlendir
  if (options.has('prettier')) await exec('npx prettier --write src --log-level warn');
}

interface FrontendPlan {
  files: Record<string, string>;
  edits: ((dir: string) => void)[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  postInstall: string[];
}

function buildPlan(framework: FrameworkId, options: Set<string>, name: string): FrontendPlan {
  const plan: FrontendPlan = { files: {}, edits: [], dependencies: [], devDependencies: [], scripts: {}, postInstall: [] };

  if (options.has('prettier')) {
    plan.devDependencies.push('prettier');
    plan.files['.prettierrc.json'] = '{\n  "singleQuote": true,\n  "semi": false\n}\n';
    plan.files['.prettierignore'] = 'dist\nnode_modules\n.angular\n';
    plan.scripts.format = 'prettier --write src';
  }
  if (options.has('axios') && framework !== 'angular') {
    plan.dependencies.push('axios');
    plan.files['src/lib/api.ts'] = `import axios from 'axios'

/** Backend istekleri için ortak istemci. Vite proxy /api isteklerini backend'e yönlendirir. */
export const api = axios.create({ baseURL: '/api' })
`;
  }

  switch (framework) {
    case 'react': reactPlan(plan, options, name); break;
    case 'vue': vuePlan(plan, options, name); break;
    case 'svelte': sveltePlan(plan, options, name); break;
    case 'angular': angularPlan(plan, options, name); break;
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Ortak: durum sayfası stilleri ve Vite yapılandırması
// ---------------------------------------------------------------------------

const STATUS_CSS = `.status-page {
  max-width: 560px;
  margin: 15vh auto 0;
  padding: 0 16px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

.status-page h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.status-page .lead {
  opacity: 0.7;
  line-height: 1.6;
}

.status-list {
  list-style: none;
  padding: 0;
  margin: 32px 0 0;
  border: 1px solid #8884;
  border-radius: 10px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}

.status-row + .status-row {
  border-top: 1px solid #8884;
}

.badge {
  font-size: 0.85rem;
  padding: 2px 10px;
  border-radius: 999px;
}

.badge-ok { background: #1a7f3722; color: #1a7f37; }
.badge-error { background: #cf222e22; color: #cf222e; }
.badge-loading { background: #8882; }
`;

function viteConfig(pluginImport: string, plugin: string, options: Set<string>, alias: boolean): string {
  const tailwind = options.has('tailwind');
  const vitest = options.has('vitest');
  return `${vitest ? '/// <reference types="vitest/config" />\n' : ''}${alias ? "import path from 'node:path'\n" : ''}import { defineConfig } from 'vite'
${pluginImport}
${tailwind ? "import tailwindcss from '@tailwindcss/vite'\n" : ''}
export default defineConfig({
  plugins: [${plugin}${tailwind ? ', tailwindcss()' : ''}],${alias ? `
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },` : ''}
  server: {
    // /api istekleri backend'e gider, CORS ayarı gerekmez. Docker içinde API_URL verilir.
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },${vitest ? `
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
    });
    plan.postInstall.push('npx -y shadcn@4 init -y --base radix --preset nova --no-monorepo', 'npx -y shadcn@4 add button -y');
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
  if (options.has('vitest')) {
    plan.devDependencies.push('vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom');
    plan.scripts.test = 'vitest';
    plan.files['src/pages/StatusPage.test.tsx'] = `import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusPage from './StatusPage'

describe('StatusPage', () => {
  it('proje adını gösterir', () => {
    render(<StatusPage />)
    expect(screen.getByRole('heading', { name: '${name}' })).toBeInTheDocument()
  })
})
`;
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

  plan.files['src/pages/StatusPage.tsx'] = `import { useEffect, useState } from 'react'
import './status.css'

type Status = 'loading' | 'ok' | 'error'

interface HelloResponse {
  message: string
  checks: Record<string, 'ok' | 'error'>
}

const LABELS: Record<Status, string> = {
  loading: 'kontrol ediliyor…',
  ok: 'çalışıyor',
  error: 'ulaşılamıyor',
}

function StatusRow({ label, status }: { label: string; status: Status }) {
  return (
    <li className="status-row">
      <span>{label}</span>
      <span className={\`badge badge-\${status}\`}>{LABELS[status]}</span>
    </li>
  )
}

/** Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. */
export default function StatusPage() {
  const [backend, setBackend] = useState<Status>('loading')
  const [checks, setChecks] = useState<Record<string, Status>>({})

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => (res.ok ? (res.json() as Promise<HelloResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        setBackend('ok')
        setChecks(data.checks)
      })
      .catch(() => setBackend('error'))
  }, [])

  return (
    <main className="status-page">
      <h1>${name}</h1>
      <p className="lead">
        Proje hazır. Geliştirmeye <code>frontend/src</code> ve <code>backend/src</code> klasörlerinden başlayabilirsin.
      </p>
      <ul className="status-list">
        <StatusRow label="Frontend" status="ok" />
        <StatusRow label="Backend" status={backend} />
        {Object.entries(checks).map(([label, status]) => (
          <StatusRow key={label} label={label} status={status} />
        ))}
      </ul>
    </main>
  )
}
`;
  plan.files['src/pages/status.css'] = STATUS_CSS;
  plan.files['src/index.css'] = resetCss(options);
  plan.files['vite.config.ts'] = viteConfig("import react from '@vitejs/plugin-react'", 'react()', options, shadcn);
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
  if (options.has('vitest')) {
    plan.devDependencies.push('vitest', 'jsdom', '@vue/test-utils');
    plan.scripts.test = 'vitest';
    plan.files['src/pages/StatusPage.spec.ts'] = `import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusPage from './StatusPage.vue'

describe('StatusPage', () => {
  it('proje adını gösterir', () => {
    const wrapper = mount(StatusPage)
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

  plan.files['src/App.vue'] = router
    ? `<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
`
    : `<script setup lang="ts">
import StatusPage from './pages/StatusPage.vue'
</script>

<template>
  <StatusPage />
</template>
`;

  plan.files['src/pages/StatusPage.vue'] = `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import './status.css'

type Status = 'loading' | 'ok' | 'error'

const LABELS: Record<Status, string> = {
  loading: 'kontrol ediliyor…',
  ok: 'çalışıyor',
  error: 'ulaşılamıyor',
}

const backend = ref<Status>('loading')
const checks = ref<Record<string, Status>>({})

onMounted(async () => {
  try {
    const res = await fetch('/api/hello')
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { checks: Record<string, Status> }
    backend.value = 'ok'
    checks.value = data.checks
  } catch {
    backend.value = 'error'
  }
})
</script>

<!-- Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. -->
<template>
  <main class="status-page">
    <h1>${name}</h1>
    <p class="lead">
      Proje hazır. Geliştirmeye <code>frontend/src</code> ve <code>backend/src</code> klasörlerinden başlayabilirsin.
    </p>
    <ul class="status-list">
      <li class="status-row"><span>Frontend</span><span class="badge badge-ok">{{ LABELS.ok }}</span></li>
      <li class="status-row">
        <span>Backend</span><span :class="['badge', \`badge-\${backend}\`]">{{ LABELS[backend] }}</span>
      </li>
      <li v-for="(status, label) in checks" :key="label" class="status-row">
        <span>{{ label }}</span><span :class="['badge', \`badge-\${status}\`]">{{ LABELS[status] }}</span>
      </li>
    </ul>
  </main>
</template>
`;
  plan.files['src/pages/status.css'] = STATUS_CSS;
  plan.files['src/style.css'] = resetCss(options);
  plan.files['vite.config.ts'] = viteConfig("import vue from '@vitejs/plugin-vue'", 'vue()', options, false);
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
  plan.files['src/App.svelte'] = `<script lang="ts">
  import { onMount } from 'svelte'
  import { statusLabel, type Status } from './lib/status'
  import './lib/status.css'

  let backend = $state<Status>('loading')
  let checks = $state<Record<string, Status>>({})

  onMount(async () => {
    try {
      const res = await fetch('/api/hello')
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { checks: Record<string, Status> }
      backend = 'ok'
      checks = data.checks
    } catch {
      backend = 'error'
    }
  })
</script>

<!-- Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. -->
<main class="status-page">
  <h1>${name}</h1>
  <p class="lead">
    Proje hazır. Geliştirmeye <code>frontend/src</code> ve <code>backend/src</code> klasörlerinden başlayabilirsin.
  </p>
  <ul class="status-list">
    <li class="status-row"><span>Frontend</span><span class="badge badge-ok">{statusLabel('ok')}</span></li>
    <li class="status-row">
      <span>Backend</span><span class="badge badge-{backend}">{statusLabel(backend)}</span>
    </li>
    {#each Object.entries(checks) as [label, status] (label)}
      <li class="status-row"><span>{label}</span><span class="badge badge-{status}">{statusLabel(status)}</span></li>
    {/each}
  </ul>
</main>
`;
  plan.files['src/lib/status.css'] = STATUS_CSS;
  plan.files['src/app.css'] = resetCss(options);
  plan.files['vite.config.ts'] = viteConfig("import { svelte } from '@sveltejs/vite-plugin-svelte'", 'svelte()', options, false);
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
  plan.files['src/app/pages/status-page.ts'] = `import { HttpClient } from '@angular/common/http'
import { Component, inject, OnInit, signal } from '@angular/core'

type Status = 'loading' | 'ok' | 'error'

const LABELS: Record<Status, string> = {
  loading: 'kontrol ediliyor…',
  ok: 'çalışıyor',
  error: 'ulaşılamıyor',
}

/** Kurulumun çalıştığını gösteren başlangıç sayfası. Kendi sayfalarınla değiştir. */
@Component({
  selector: 'app-status-page',
  templateUrl: './status-page.html',
  styleUrl: './status-page.css',
})
export class StatusPage implements OnInit {
  private readonly http = inject(HttpClient)

  protected readonly labels = LABELS
  protected readonly backend = signal<Status>('loading')
  protected readonly checks = signal<[string, Status][]>([])

  ngOnInit(): void {
    this.http.get<{ checks: Record<string, Status> }>('/api/hello').subscribe({
      next: (data) => {
        this.backend.set('ok')
        this.checks.set(Object.entries(data.checks))
      },
      error: () => this.backend.set('error'),
    })
  }
}
`;
  plan.files['src/app/pages/status-page.html'] = `<main class="status-page">
  <h1>${name}</h1>
  <p class="lead">
    Proje hazır. Geliştirmeye <code>frontend/src</code> ve <code>backend/src</code> klasörlerinden başlayabilirsin.
  </p>
  <ul class="status-list">
    <li class="status-row"><span>Frontend</span><span class="badge badge-ok">{{ labels.ok }}</span></li>
    <li class="status-row">
      <span>Backend</span><span class="badge" [class]="'badge-' + backend()">{{ labels[backend()] }}</span>
    </li>
    @for (check of checks(); track check[0]) {
      <li class="status-row">
        <span>{{ check[0] }}</span><span class="badge" [class]="'badge-' + check[1]">{{ labels[check[1]] }}</span>
      </li>
    }
  </ul>
</main>
`;
  plan.files['src/app/pages/status-page.css'] = STATUS_CSS;
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

/** Şablonun artık kullanılmayan örnek dosyalarını siler */
function removeFiles(...files: string[]) {
  return (dir: string) => files.forEach((f) => rmSync(join(dir, f), { force: true }));
}
