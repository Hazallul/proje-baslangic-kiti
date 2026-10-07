import { findDatabase } from '../../core/catalog/databases';
import { findFramework } from '../../core/catalog/frontend';
import { findService } from '../../core/catalog/services';
import { hasBackend } from '../../core/selection';
import type { ResolvedProject } from '../../core/types';

export interface TreeNode {
  name: string;
  /** Satırın sağında soluk açıklama */
  note?: string;
  children?: TreeNode[];
}

const dir = (name: string, children: (TreeNode | false | null | undefined)[], note?: string): TreeNode => ({
  name: `${name}/`,
  note,
  children: children.filter(Boolean) as TreeNode[],
});
const file = (name: string, note?: string): TreeNode => ({ name, note });

function pascal(name: string): string {
  return name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/** Oluşturulacak projenin özet klasör ağacı (gerçek çıktıyla aynı adlar) */
export function buildTree(resolved: ResolvedProject): TreeNode {
  const sel = resolved.selection;
  const name = sel.name || 'my-app';
  const pkgPath = `${sel.backend.groupId}.${name.replace(/[^a-z0-9]/g, '')}`.replaceAll('.', '/');
  const security = sel.needs.security;
  const sql = sel.database.sql ? findDatabase(sel.database.sql) : null;

  const withBackend = hasBackend(sel);
  const backend = withBackend && dir('backend', [
    dir(`src/main/java/${pkgPath}`, [
      file(`${pascal(name)}Application.java`),
      dir('api', [file('HelloController.java'), security === 'jwt' && file('AuthController.java', 'token')]),
      security ? dir('config', [file('SecurityConfig.java')]) : null,
    ]),
    dir('src/main/resources', [
      file('application.properties'),
      sql && sel.database.migration === 'flyway' && dir('db/migration', [file('V1__init.sql')]),
      sql && sel.database.migration === 'liquibase' && dir('db/changelog', [file('db.changelog-master.yaml')]),
    ]),
    file(sel.backend.buildTool === 'gradle' ? 'build.gradle' : 'pom.xml', `${resolved.dependencies.length + resolved.libraries.length} paket`),
    file('Dockerfile'),
  ]);

  const fw = sel.frontend.framework;
  const opts = new Set(resolved.frontendOptions);
  const proxyNote = withBackend ? '/api → backend' : undefined;
  const locales = opts.has('i18n') && dir('locales', [file('tr.ts'), file('en.ts')]);
  let frontend: TreeNode | null = null;
  if (fw === 'react') {
    frontend = dir('frontend', [
      dir('src', [
        file('main.tsx'),
        file('App.tsx'),
        dir('pages', [file('StatusPage.tsx')]),
        opts.has('shadcn') && dir('components/ui', [file('button.tsx')]),
        (opts.has('zustand') || opts.has('redux')) && dir('store', [file(opts.has('zustand') ? 'useAppStore.ts' : 'index.ts')]),
        opts.has('axios') && dir('lib', [file('api.ts')]),
        opts.has('i18n') && file('i18n.ts', 'TR / EN'),
        locales,
        file('index.css', opts.has('tailwind') ? '@import "tailwindcss"' : undefined),
      ]),
      file('package.json'),
      file('vite.config.ts', proxyNote),
      file('Dockerfile'),
    ]);
  } else if (fw === 'vue') {
    frontend = dir('frontend', [
      dir('src', [
        file('main.ts'),
        file('App.vue'),
        dir('pages', [file('StatusPage.vue')]),
        opts.has('vue-router') && dir('router', [file('index.ts')]),
        opts.has('pinia') && dir('stores', [file('app.ts')]),
        opts.has('axios') && dir('lib', [file('api.ts')]),
        opts.has('i18n') && file('i18n.ts', 'TR / EN'),
        locales,
      ]),
      file('package.json'),
      file('vite.config.ts', proxyNote),
      file('Dockerfile'),
    ]);
  } else if (fw === 'angular') {
    frontend = dir('frontend', [
      dir('src/app', [file('app.config.ts'), file('app.routes.ts'), dir('pages', [file('status-page.ts')])]),
      file('angular.json'),
      withBackend && file('proxy.conf.mjs', '/api → backend'),
      file('Dockerfile'),
    ]);
  } else if (fw === 'svelte') {
    frontend = dir('frontend', [
      dir('src', [file('main.ts'), file('App.svelte'), dir('lib', [file('status.ts'), opts.has('axios') && file('api.ts')])]),
      file('package.json'),
      file('vite.config.ts', proxyNote),
      file('Dockerfile'),
    ]);
  }

  const services = resolved.services;
  const containerCount = (withBackend ? 1 : 0) + (fw ? 1 : 0) + resolved.databases.length + services.length;

  return dir(name, [
    backend,
    frontend,
    services.includes('keycloak') && dir('keycloak', [file('realm.json', 'demo kullanıcı')]),
    (services.includes('prometheus') || services.includes('grafana')) && dir('monitoring', [
      services.includes('prometheus') && file('prometheus.yml'),
      services.includes('grafana') && dir('grafana', [file('datasource.yml')]),
    ]),
    file('.env', withBackend ? 'portlar, şifreler' : 'portlar'),
    file('.gitignore'),
    file('compose.yaml', `${containerCount} servis`),
    file('README.md'),
    opts.has('vercel') && file('vercel.json', 'Vercel ayarı'),
  ]);
}

export interface PortRow {
  /** .env'deki değişken adı (gerçek portla eşleştirmek için) */
  envName: string;
  label: string;
  detail: string;
  port: number;
}

/** Varsayılan portlar (doluysa oluştururken sıradaki boş port seçilir) */
export function previewPorts(resolved: ResolvedProject): PortRow[] {
  const rows: PortRow[] = [];
  const fw = resolved.selection.frontend.framework;
  if (fw) rows.push({ envName: 'FRONTEND_PORT', label: 'Uygulama', detail: findFramework(fw).label, port: findFramework(fw).devPort });
  if (hasBackend(resolved.selection)) rows.push({ envName: 'BACKEND_PORT', label: 'Backend', detail: 'Spring Boot', port: 8080 });
  for (const id of resolved.databases) {
    const db = findDatabase(id);
    rows.push({ envName: db.port.envName, label: db.label, detail: 'veritabanı', port: db.port.preferred });
  }
  for (const id of resolved.services) {
    const service = findService(id);
    const port = service.ports.find((p) => p.web) ?? service.ports[0];
    rows.push({ envName: port.envName, label: service.label, detail: service.description, port: port.preferred });
  }
  return rows;
}
