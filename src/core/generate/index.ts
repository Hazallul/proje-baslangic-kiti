import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { resolve as resolveSelection, validate } from '../selection.js';
export { STEP_LABELS } from '../steps.js';
import type { GenerateEvent, GenerateResult, PortAssignment, Selection, StepId } from '../types.js';
import { CancelledError, commandSucceeds, run, waitForUrl, writeFiles } from '../util.js';
import { generateBackend } from './backend.js';
import { assignPorts, composeFile, envFile, serviceFiles } from './compose.js';
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

  const issue = validate(sel)[0];
  if (issue) throw new Error(issue.message);
  if (!isTargetFree(sel)) throw new Error(`"${projectDir}" klasörü zaten var ve boş değil.`);

  const step = async (id: StepId, fn: () => Promise<void | string>) => {
    if (opts.signal?.aborted) throw new CancelledError();
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

  // 1-3: Dosyalar. Burada bir şey ters giderse klasörü temizle.
  let ports: PortAssignment[];
  try {
    await step('backend', () => generateBackend(resolved, projectDir, ctx));

    if (sel.frontend.framework) await step('frontend', () => generateFrontend(resolved, projectDir, ctx));
    else skip('frontend', 'Frontend seçilmedi');

    ports = [];
    await step('docker-files', async () => {
      ports = await assignPorts(resolved);
      const moved = ports.filter((p) => p.port !== p.preferred);
      for (const p of moved) {
        emit({ type: 'info', message: `${p.preferred} kullanımda, ${p.label} için ${p.port} seçildi` });
      }
      writeFiles(projectDir, {
        'compose.yaml': composeFile(resolved),
        '.env': envFile(resolved, ports, true),
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
    warnings.push('Docker çalışmıyor. Docker Desktop\'u açıp proje klasöründe "docker compose up -d --build" çalıştır.');
    skip('docker-build', 'Docker çalışmıyor');
    skip('services', 'Docker çalışmıyor');
  } else {
    await step('docker-build', async () => {
      await run('docker compose build', { cwd: projectDir, signal: opts.signal, onOutput: log });
    });
    await step('services', async () => {
      await run('docker compose up -d', { cwd: projectDir, signal: opts.signal, onOutput: log });
      const backend = ports.find((p) => p.envName === 'BACKEND_PORT')!;
      if (!(await waitForUrl(`http://localhost:${backend.port}/api/hello`, 180_000, opts.signal))) {
        throw new Error('Backend 3 dakika içinde cevap vermedi. Loglar için: docker compose logs backend');
      }
      started = true;
    });
  }

  return { projectDir, ports, started, warnings };
}

export async function isDockerRunning(): Promise<boolean> {
  return commandSucceeds('docker info', process.cwd());
}
