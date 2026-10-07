import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hasBackend, resolve as resolveSelection, validate } from '../selection.js';
export { STEP_LABELS } from '../steps.js';
import type { GenerateEvent, GenerateResult, PortAssignment, Selection, StepId } from '../types.js';
import { CancelledError, commandSucceeds, run, waitForUrl, writeFiles } from '../util.js';
import { generateBackend } from './backend.js';
import { assignPorts, composeFile, credentialsOf, envFile, portsFromEnv, serviceFiles } from './compose.js';
import { readme, rootGitignore } from './docs.js';
import { generateFrontend } from './frontend.js';

export interface GenerateOptions {
  onEvent?: (event: GenerateEvent) => void;
  signal?: AbortSignal;
}

export function projectDirOf(sel: Selection): string {
  return join(sel.location, sel.name);
}

/** Hedef klasör kullanılabilir mi? (yok veya boş olmalı) */
export function isTargetFree(sel: Selection): boolean {
  const dir = projectDirOf(sel);
  return !existsSync(dir) || readdirSync(dir).length === 0;
}

/**
 * Projeyi uçtan uca oluşturur. Her adımda onEvent ile ilerleme bildirilir.
 * Dosya üretimi aşamasında hata olursa veya iptal edilirse yarım klasör silinir.
 */
export async function generateProject(sel: Selection, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const emit = opts.onEvent ?? (() => {});
  const log = (text: string) => emit({ type: 'log', text });
  const ctx = { signal: opts.signal, log };
  const resolved = resolveSelection(sel);
  const projectDir = projectDirOf(sel);
  const warnings: string[] = [];
  let credentials: GenerateResult['credentials'] = [];

  const issue = validate(sel)[0];
  if (issue) throw new Error(issue.message);
  if (!isTargetFree(sel)) throw new Error(`"${projectDir}" klasörü zaten var ve boş değil.`);
  const conflict = await dockerConflict(sel.name);
  if (conflict) throw new Error(conflict);

  const { step, skip } = stepRunner(emit, opts.signal);

  // 1-3: Dosyalar. Burada bir şey ters giderse klasörü temizle.
  let ports: PortAssignment[];
  try {
    if (hasBackend(sel)) {
      await step('backend', () => generateBackend(resolved, projectDir, ctx));
    } else {
      mkdirSync(projectDir, { recursive: true });
      skip('backend', 'Sadece frontend projesi');
    }

    if (sel.frontend.framework) await step('frontend', () => generateFrontend(resolved, projectDir, ctx));
    else skip('frontend', 'Frontend seçilmedi');

    ports = [];
    await step('docker-files', async () => {
      ports = await assignPorts(resolved);
      const moved = ports.filter((p) => p.port !== p.preferred);
      for (const p of moved) {
        emit({ type: 'info', message: `${p.preferred} kullanımda, ${p.label} için ${p.port} seçildi` });
      }
      const env = envFile(resolved, ports, true);
      credentials = credentialsOf(env);
      writeFiles(projectDir, {
        'compose.yaml': composeFile(resolved),
        '.env': env,
        '.env.example': envFile(resolved, ports, false),
        'README.md': readme(resolved, ports),
        '.gitignore': rootGitignore(),
        ...serviceFiles(resolved),
      });
    });
  } catch (error) {
    rmSync(projectDir, { recursive: true, force: true });
    throw error;
  }

  // 4: Git (başarısız olursa proje yine de kullanılabilir)
  if (sel.git) {
    await step('git', async () => {
      await run('git init -q -b main', { cwd: projectDir });
      // Bilgisayarda genel git kimliği yoksa arayüzde girilen ad/e-posta sadece bu depoya yazılır
      if (sel.gitAuthor?.name && sel.gitAuthor.email) {
        await run(`git config user.name "${sel.gitAuthor.name.replace(/"/g, '')}"`, { cwd: projectDir });
        await run(`git config user.email "${sel.gitAuthor.email.replace(/"/g, '')}"`, { cwd: projectDir });
      }
      await run('git add -A', { cwd: projectDir });
      if (await commandSucceeds(`git commit -q -m "${sel.name} projesi oluşturuldu"`, projectDir)) return 'İlk commit atıldı';
      warnings.push('İlk commit atılamadı: git kullanıcı adı ve e-postası tanımlı değil (git config --global user.name / user.email).');
      return 'Depo başlatıldı, ilk commit atılamadı';
    });
  } else {
    skip('git');
  }

  // 5-6: Docker
  let started = false;
  if (!sel.start) {
    skip('docker-build');
    skip('services');
  } else if (!(await isDockerRunning())) {
    warnings.push(`Docker çalışmıyor. Docker Desktop'u açıp proje klasöründe "docker compose up -d --build" çalıştır.`);
    skip('docker-build', 'Docker çalışmıyor');
    skip('services', 'Docker çalışmıyor');
  } else {
    await runDocker(projectDir, ports, opts);
    started = true;
  }

  return { projectDir, ports, started, warnings, credentials };
}

/**
 * Docker'da bu adla (compose proje adı) container veya volume var mı? Varsa yeni proje onlarla
 * karışır: başka bir projenin container'larını değiştirir ya da eski veritabanı verisini eski
 * şifreyle açmaya çalışır. Sorun varsa kullanıcıya gösterilecek mesajı döner.
 */
export async function dockerConflict(name: string): Promise<string | null> {
  const filter = `--filter label=com.docker.compose.project=${name}`;
  try {
    const [running, all, volumes] = await Promise.all([
      run(`docker ps -q ${filter}`, { cwd: process.cwd() }),
      run(`docker ps -a -q ${filter}`, { cwd: process.cwd() }),
      run(`docker volume ls -q ${filter}`, { cwd: process.cwd() }),
    ]);
    if (running.trim()) return `Docker'da "${name}" adında çalışan bir proje var. Başka bir ad seç.`;
    if (all.trim() || volumes.trim()) {
      return `Docker'da "${name}" adlı eski bir projeden kalan container veya veri var. Başka bir ad seç ya da artık `
        + `gerekmiyorsa sil (o projenin veritabanı da silinir): docker compose -p ${name} down -v`;
    }
    return null;
  } catch {
    return null;
  }
}

/** git commit için ad ve e-posta tanımlı mı? */
export async function hasGitIdentity(): Promise<boolean> {
  const cwd = process.cwd();
  return (await commandSucceeds('git config --global user.name', cwd)) && (await commandSucceeds('git config --global user.email', cwd));
}

function stepRunner(emit: (event: GenerateEvent) => void, signal?: AbortSignal) {
  const step = async (id: StepId, fn: () => Promise<void | string>) => {
    if (signal?.aborted) throw new CancelledError();
    emit({ type: 'step', step: id, status: 'running' });
    try {
      const message = await fn();
      emit({ type: 'step', step: id, status: 'done', message: message || undefined });
    } catch (error) {
      emit({ type: 'step', step: id, status: 'error', message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  };
  const skip = (id: StepId, message?: string) => emit({ type: 'step', step: id, status: 'skipped', message });
  return { step, skip };
}

/** İmajları derler, servisleri başlatır ve uygulama cevap verene kadar bekler. */
async function runDocker(projectDir: string, ports: PortAssignment[], opts: GenerateOptions): Promise<void> {
  const emit = opts.onEvent ?? (() => {});
  const log = (text: string) => emit({ type: 'log', text });
  const { step } = stepRunner(emit, opts.signal);

  await step('docker-build', async () => {
    await run('docker compose build', { cwd: projectDir, signal: opts.signal, onOutput: log });
  });
  await step('services', async () => {
    await run('docker compose up -d', { cwd: projectDir, signal: opts.signal, onOutput: log });
    // Backend varsa onun örnek endpoint'i, yoksa (sadece frontend) geliştirme sunucusu beklenir
    const target = ports.find((p) => p.envName === 'BACKEND_PORT') ?? ports.find((p) => p.envName === 'FRONTEND_PORT')!;
    const service = target.envName === 'BACKEND_PORT' ? 'backend' : 'frontend';
    if (!(await waitForUrl(target.url!, 180_000, opts.signal))) {
      // Sebebi kullanıcı görebilsin diye son log satırlarını hataya ekle
      const logs = await run(`docker compose logs --no-color --tail 40 ${service}`, { cwd: projectDir }).catch(() => '');
      const tail = logs.split('\n').filter((l) => /ERROR|Error|Caused by|Exception|APPLICATION FAILED|Description|Action/.test(l)).slice(-8).join('\n');
      throw new Error(`${target.label} 3 dakika içinde cevap vermedi. Tüm loglar için: docker compose logs ${service}${tail ? `\n\n${tail}` : ''}`);
    }
  });
}

/**
 * Dosyaları zaten oluşmuş projeyi Docker'da yeniden derleyip başlatır
 * (ilk denemede Docker adımı hata verdiyse "Tekrar başlat" için).
 */
export async function startProject(sel: Selection, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const projectDir = projectDirOf(sel);
  const envPath = join(projectDir, '.env');
  if (!existsSync(envPath)) throw new Error(`"${projectDir}" içinde .env bulunamadı; proje oluşturulmamış görünüyor.`);
  if (!(await isDockerRunning())) throw new Error(`Docker çalışmıyor. Docker Desktop'u açıp tekrar dene.`);

  const env = readFileSync(envPath, 'utf8');
  const ports = portsFromEnv(resolveSelection(sel), env);
  await runDocker(projectDir, ports, opts);
  return { projectDir, ports, started: true, warnings: [], credentials: credentialsOf(env) };
}

export async function isDockerRunning(): Promise<boolean> {
  return commandSucceeds('docker info', process.cwd());
}
