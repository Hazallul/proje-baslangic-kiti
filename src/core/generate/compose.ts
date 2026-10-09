import { type EnvVar, findDatabase } from '../catalog/databases.js';
import { findFramework } from '../catalog/frontend.js';
import { findService, type ServiceContext } from '../catalog/services.js';
import type { PortAssignment, ResolvedProject } from '../types.js';
import { dockerPublishedPorts, findFreePort, randomPassword } from '../util.js';
import { hasBackend, isPython } from '../selection.js';
import { securityEnv } from './backend.js';

export function serviceContext(resolved: ResolvedProject): ServiceContext {
  return {
    projectName: resolved.selection.name,
    databases: resolved.databases,
    dependencies: resolved.dependencies,
  };
}

interface PortSpec {
  envName: string;
  label: string;
  preferred: number;
  web: 'root' | 'api' | false;
}

/** Projede bilgisayara açılacak tüm portlar (frontend, backend, veritabanları, servisler) */
function portSpecs(resolved: ResolvedProject): PortSpec[] {
  // Python projeleri Docker Compose kullanmaz; bilgisayarda doğrudan çalışır
  if (isPython(resolved.selection)) return [];
  const specs: PortSpec[] = [];
  const framework = resolved.selection.frontend.framework;
  if (framework) specs.push({ envName: 'FRONTEND_PORT', label: 'Uygulama', preferred: findFramework(framework).devPort, web: 'root' });
  if (hasBackend(resolved.selection)) specs.push({ envName: 'BACKEND_PORT', label: 'Backend API', preferred: 8080, web: 'api' });
  for (const dbId of resolved.databases) {
    const db = findDatabase(dbId);
    specs.push({ envName: db.port.envName, label: db.label, preferred: db.port.preferred, web: false });
  }
  for (const serviceId of resolved.services) {
    for (const p of findService(serviceId).ports) {
      specs.push({ envName: p.envName, label: p.label, preferred: p.preferred, web: p.web ? 'root' : false });
    }
  }
  return specs;
}

function toAssignment(spec: PortSpec, port: number): PortAssignment {
  const url = spec.web === 'root' ? `http://localhost:${port}` : spec.web === 'api' ? `http://localhost:${port}/api/hello` : undefined;
  return { envName: spec.envName, label: spec.label, port, preferred: spec.preferred, url };
}

/** Varsayılan portlar doluysa (başka proje, Docker container'ı) sıradaki boş portu seçer. */
export async function assignPorts(resolved: ResolvedProject): Promise<PortAssignment[]> {
  const taken = await dockerPublishedPorts();
  const ports: PortAssignment[] = [];
  for (const spec of portSpecs(resolved)) {
    ports.push(toAssignment(spec, await findFreePort(spec.preferred, taken)));
  }
  return ports;
}

/** Daha önce oluşturulmuş projenin portları (.env içeriğinden) */
export function portsFromEnv(resolved: ResolvedProject, env: string): PortAssignment[] {
  const values = parseEnv(env);
  return portSpecs(resolved).map((spec) => toAssignment(spec, Number(values[spec.envName]) || spec.preferred));
}

/** .env içeriğini anahtar → değer olarak okur */
export function parseEnv(env: string): Record<string, string> {
  return Object.fromEntries([...env.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
}

/** .env'deki kullanıcı adları ve şifreler (portlar hariç), bitiş ekranında gösterilir */
export function credentialsOf(env: string): { key: string; value: string }[] {
  return Object.entries(parseEnv(env))
    .filter(([key]) => !key.endsWith('_PORT') && key !== 'API_URL')
    .map(([key, value]) => ({ key, value }));
}

/** Arayüzde ve README'de gösterilecek, tarayıcıda açılabilir adresler */
export function serviceLinks(resolved: ResolvedProject, ports: PortAssignment[]): { label: string; url: string }[] {
  const links = ports.filter((p) => p.url).map((p) => ({ label: p.label, url: p.url! }));
  if (resolved.libraries.includes('springdoc')) {
    const backend = ports.find((p) => p.envName === 'BACKEND_PORT')!;
    links.push({ label: 'Swagger UI', url: `http://localhost:${backend.port}/swagger-ui.html` });
  }
  return links;
}

function allEnvVars(resolved: ResolvedProject): EnvVar[] {
  const vars: EnvVar[] = [];
  const seen = new Set<string>();
  const push = (list: EnvVar[] = []) => list.forEach((v) => {
    if (!seen.has(v.key)) {
      seen.add(v.key);
      vars.push(v);
    }
  });
  resolved.databases.forEach((id) => push(findDatabase(id).env));
  resolved.services.forEach((id) => push(findService(id).env));
  push(securityEnv(resolved).env);
  return vars;
}

/** .env içeriği. secrets=false ise şifreler yerine yer tutucu yazılır (.env.example için). */
export function envFile(resolved: ResolvedProject, ports: PortAssignment[], secrets: boolean): string {
  const lines = ["# Geliştirme ortamı ayarları. .env git'e eklenmez, .env.example eklenir.", ''];
  const vars = allEnvVars(resolved);
  if (vars.length) {
    lines.push('# Kullanıcılar ve şifreler');
    for (const v of vars) {
      const value = typeof v.value === 'string'
        ? v.value
        : secrets ? randomPassword(v.value.length ?? 20) + (v.value.suffix ?? '') : 'degistir';
      lines.push(`${v.key}=${value}`);
    }
    lines.push('');
  }
  lines.push('# Bilgisayarında açılan portlar');
  ports.forEach((p) => lines.push(`${p.envName}=${p.port}`));
  return lines.join('\n') + '\n';
}

export function composeFile(resolved: ResolvedProject): string {
  const sel = resolved.selection;
  const ctx = serviceContext(resolved);
  const blocks: string[] = [];
  const volumes: string[] = [];

  for (const dbId of resolved.databases) {
    const db = findDatabase(dbId);
    blocks.push(db.compose);
    volumes.push(db.volume);
  }

  // Backend ortam değişkenleri: veritabanları + servisler + güvenlik
  const backendEnv: Record<string, string> = {};
  const dependsOn: Record<string, string> = {};
  for (const dbId of resolved.databases) {
    const db = findDatabase(dbId);
    Object.assign(backendEnv, db.backendEnv);
    Object.assign(dependsOn, db.backendDependsOn);
  }
  for (const serviceId of resolved.services) {
    const env = findService(serviceId).backendEnv;
    Object.assign(backendEnv, typeof env === 'function' ? env(ctx) : env);
  }
  Object.assign(backendEnv, securityEnv(resolved).backendEnv);

  const backend = hasBackend(sel);
  const buildFile = sel.backend.buildTool === 'gradle' ? 'build.gradle' : 'pom.xml';
  const envLines = Object.entries(backendEnv).map(([k, v]) => `      ${k}: ${quote(v)}`);
  const dependsLines = Object.entries(dependsOn).map(([s, c]) => `      ${s}:\n        condition: ${c}`);
  if (backend) blocks.push(`  backend:
    build: ./backend
    # Veritabanı ilk açılışta geç kalırsa birkaç kez yeniden dener
    restart: on-failure:5${envLines.length ? `\n    environment:\n${envLines.join('\n')}` : ''}
    ports:
      - "\${BACKEND_PORT}:8080"${dependsLines.length ? `\n    depends_on:\n${dependsLines.join('\n')}` : ''}
    # "docker compose watch" açıkken Java kodu değişince imaj yeniden derlenir
    develop:
      watch:
        - action: rebuild
          path: ./backend/src
        - action: rebuild
          path: ./backend/${buildFile}`);

  const framework = sel.frontend.framework;
  if (framework) {
    const port = findFramework(framework).devPort;
    blocks.push(`  frontend:
    build: ./frontend${backend ? `
    environment:
      # Backend'i IDE'de çalıştırırken .env'e API_URL=http://host.docker.internal:8080 yaz
      API_URL: "\${API_URL:-http://backend:8080}"` : ''}
    ports:
      - "\${FRONTEND_PORT}:${port}"${backend ? `
    depends_on:
      - backend` : ''}
    # "docker compose watch" açıkken dosyalar container'a kopyalanır, dev sunucusu anında yeniler
    develop:
      watch:
        - action: sync
          path: ./frontend
          target: /app
          ignore:
            - node_modules/
        - action: rebuild
          path: ./frontend/package.json`);
  }

  for (const serviceId of resolved.services) {
    blocks.push(findService(serviceId).compose(ctx));
  }

  return `name: ${sel.name}

services:
${blocks.join('\n\n')}
${volumes.length ? `\nvolumes:\n${volumes.map((v) => `  ${v}:`).join('\n')}\n` : ''}`;
}

/** Değişken veya özel karakter içeren değerleri YAML için tırnakla */
function quote(value: string): string {
  return /[:;{}$#]/.test(value) ? `"${value}"` : value;
}

/** Servislerin ihtiyaç duyduğu yapılandırma dosyaları (prometheus.yml, Keycloak realm...) */
export function serviceFiles(resolved: ResolvedProject): Record<string, string> {
  const ctx = serviceContext(resolved);
  return Object.assign({}, ...resolved.services.map((id) => findService(id).files?.(ctx) ?? {}));
}
