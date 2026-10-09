import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hasBackend, isPython, resolve as resolveSelection, validate } from '../selection.js';
export { planSteps, STEP_LABELS } from '../steps.js';
import type { GenerateEvent, GenerateResult, PortAssignment, Selection, StepId } from '../types.js';
import { CancelledError, commandSucceeds, run, waitForUrl, writeFiles } from '../util.js';
import { generateBackend } from './backend.js';
import { assignPorts, composeFile, credentialsOf, envFile, portsFromEnv, serviceFiles } from './compose.js';
import { readme, rootGitignore } from './docs.js';
import { generateFrontend } from './frontend.js';
import { createGithubRepo, pushToRemote } from './git.js';
import { findPython, installPythonEnv, writePythonProject } from './python.js';
import { pythonCommands, pythonContext, requirementsFileOf, venvPython } from './python-files.js';

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
  const issue = validate(sel)[0];
  if (issue) throw new Error(issue.message);
  if (!isTargetFree(sel)) throw new Error(`"${projectDirOf(sel)}" klasörü zaten var ve boş değil.`);
  return isPython(sel) ? generatePython(sel, opts) : generateSpring(sel, opts);
}

/** Python projesi: dosyalar, isteğe bağlı sanal ortam ve paketler, git. Docker kullanılmaz. */
async function generatePython(sel: Selection, opts: GenerateOptions): Promise<GenerateResult> {
  const emit = opts.onEvent ?? (() => {});
  const log = (text: string) => emit({ type: 'log', text });
  const projectDir = projectDirOf(sel);
  const ctx = pythonContext(sel, process.platform === 'win32');
  const warnings: string[] = [];
  const { step, skip } = stepRunner(emit, opts.signal);

  try {
    await step('python-files', async () => writePythonProject(sel, projectDir));
  } catch (error) {
    rmSync(projectDir, { recursive: true, force: true });
    throw error;
  }

  // Kurulum başarısız olsa da (ör. internet yok) dosyalar kullanılabilir: hata uyarıya dönüşür
  let installed = false;
  if (sel.python.install) {
    const python = await findPython();
    if (!python) {
      warnings.push("Python 3.10 veya üstü bulunamadı. python.org'dan kurup proje klasöründe aşağıdaki kurulum komutlarını çalıştır.");
      skip('python-env', 'Python bulunamadı');
    } else {
      try {
        await step('python-env', async () => {
          const result = await installPythonEnv(sel, projectDir, python, { signal: opts.signal, log });
          if (result.warning) warnings.push(result.warning);
          return result.message;
        });
        installed = true;
      } catch (error) {
        if (error instanceof CancelledError) throw error;
        warnings.push('Paketler kurulamadı (internet bağlantısını kontrol et). Aşağıdaki kurulum komutlarıyla tekrar deneyebilirsin.');
      }
    }
  }

  const repoUrl = await initGit(sel, projectDir, { step, skip, warnings, signal: opts.signal, log });

  const python = venvPython(ctx.windows);
  const setup = installed ? [] : [
    { label: 'Sanal ortamı kur', command: 'python -m venv .venv' },
    { label: 'Paketleri indir', command: `${python} -m pip install -r ${requirementsFileOf(ctx)}` },
  ];
  return { projectDir, ports: [], started: false, warnings, credentials: [], commands: [...setup, ...pythonCommands(ctx)], repoUrl };
}

/** Spring Boot ve/veya frontend projesi: Docker Compose ile. */
async function generateSpring(sel: Selection, opts: GenerateOptions): Promise<GenerateResult> {
  const emit = opts.onEvent ?? (() => {});
  const log = (text: string) => emit({ type: 'log', text });
  const ctx = { signal: opts.signal, log };
  const resolved = resolveSelection(sel);
  const projectDir = projectDirOf(sel);
  const warnings: string[] = [];
  let credentials: GenerateResult['credentials'] = [];

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
  const repoUrl = await initGit(sel, projectDir, { step, skip, warnings, signal: opts.signal, log });

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

  return { projectDir, ports, started, warnings, credentials, repoUrl };
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

type StepRunner = ReturnType<typeof stepRunner>;

/**
 * Depoyu başlatır, ilk commit'i atar ve istenirse uzak depoya gönderir. Commit ve push bilgisayardaki
 * git'in kimliğini ve kayıtlı girişini kullanır; hiçbir hesap bilgisi sorulmaz. Push başarısız olursa
 * proje yerel olarak hazırdır, hata uyarıya dönüşür. Gönderilen deponun web adresini döner.
 */
async function initGit(sel: Selection, projectDir: string, ctx: StepRunner & {
  warnings: string[];
  signal?: AbortSignal;
  log: (text: string) => void;
}): Promise<string | undefined> {
  const { step, skip, warnings } = ctx;
  const remote = sel.gitRemote;
  if (!sel.git) {
    skip('git');
    return undefined;
  }
  let committed = false;
  await step('git', async () => {
    await run('git init -q -b main', { cwd: projectDir });
    // Bilgisayarda genel git kimliği yoksa arayüzde girilen ad/e-posta sadece bu depoya yazılır
    if (sel.gitAuthor?.name && sel.gitAuthor.email) {
      await run(`git config user.name "${sel.gitAuthor.name.replace(/"/g, '')}"`, { cwd: projectDir });
      await run(`git config user.email "${sel.gitAuthor.email.replace(/"/g, '')}"`, { cwd: projectDir });
    }
    await run('git add -A', { cwd: projectDir });
    committed = await commandSucceeds(`git commit -q -m "${sel.name} projesi oluşturuldu"`, projectDir);
    if (committed) return 'İlk commit atıldı';
    warnings.push('İlk commit atılamadı: git kullanıcı adı ve e-postası tanımlı değil (git config --global user.name / user.email).');
    return 'Depo başlatıldı, ilk commit atılamadı';
  });

  if (remote.mode === 'local') return undefined;
  if (!committed) {
    skip('git-push', 'İlk commit atılamadı');
    return undefined;
  }
  let repoUrl: string | undefined;
  try {
    await step('git-push', async () => {
      const url = remote.mode === 'github'
        ? await createGithubRepo(sel.name, remote.private, ctx.signal)
        : remote.url.trim();
      repoUrl = (await pushToRemote(projectDir, url, { signal: ctx.signal, log: ctx.log })) ?? undefined;
      return remote.mode === 'github' ? `GitHub'da ${remote.private ? 'gizli' : 'açık'} depo açıldı, gönderildi` : 'main dalı gönderildi';
    });
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    warnings.push(`Proje uzak depoya gönderilemedi. ${error instanceof Error ? error.message : String(error)}`);
  }
  return repoUrl;
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
