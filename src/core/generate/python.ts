import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findPythonTemplate, MIN_PYTHON } from '../catalog/python.js';
import type { Selection } from '../types.js';
import { CancelledError, run, writeFiles } from '../util.js';
import { type PythonContext, pythonContext, pythonFiles, requirementsFileOf, venvPython } from './python-files.js';

export interface PythonInterpreter {
  /** Kabukta çalıştırılacak komut, ör. "python" ya da "py -3" */
  command: string;
  version: string;
}

/**
 * Bilgisayardaki Python'u bulur (en az MIN_PYTHON). Windows'ta "python" komutu Microsoft Store
 * kısayolu olabilir ve sürüm yazmaz; o yüzden py başlatıcısı da denenir. Uygun sürüm yoksa null.
 */
export async function findPython(): Promise<PythonInterpreter | null> {
  const candidates = process.platform === 'win32' ? ['python', 'py -3'] : ['python3', 'python'];
  for (const command of candidates) {
    try {
      const output = await run(`${command} -c "import sys; print('%d.%d.%d' % sys.version_info[:3])"`, { cwd: process.cwd() });
      const version = output.trim().split(/\s+/).pop() ?? '';
      const [major, minor] = version.split('.').map(Number);
      if (major > MIN_PYTHON.major || (major === MIN_PYTHON.major && minor >= MIN_PYTHON.minor)) return { command, version };
    } catch {
      // bu komut yok, sıradakini dene
    }
  }
  return null;
}

export interface StepContext {
  signal?: AbortSignal;
  log: (text: string) => void;
}

/** Proje dosyalarını yazar. Dönen değer adımın arayüzde görünen mesajı. */
export function writePythonProject(sel: Selection, projectDir: string): string {
  const ctx = pythonContext(sel, process.platform === 'win32');
  const files = pythonFiles(ctx);
  writeFiles(projectDir, files);
  return `${Object.keys(files).length} dosya`;
}

export interface EnvResult {
  message: string;
  /** Kurulum tamam ama testler geçmediyse kullanıcıya gösterilecek uyarı */
  warning?: string;
}

const APP_CONTROL_WARNING = 'Windows Uygulama Denetimi (Smart App Control) projedeki bir paketin imzasız dosyasını '
  + 'engelledi, bu yüzden program bu bilgisayarda açılamayabilir. Proje dosyaları doğru: engel kalkınca ya da başka '
  + 'bir bilgisayarda/Docker içinde çalışır.';

/**
 * .venv sanal ortamını kurar, paketleri indirir, ana paketleri içe aktarıp dener ve test seçiliyse
 * testleri bir kez çalıştırır (üretilen projenin bu bilgisayarda gerçekten çalıştığını göstermek için).
 * Deneme ya da test başarısızlığı adımı düşürmez, uyarı olur.
 */
export async function installPythonEnv(
  sel: Selection,
  projectDir: string,
  python: PythonInterpreter,
  { signal, log }: StepContext,
): Promise<EnvResult> {
  const ctx: PythonContext = pythonContext(sel, process.platform === 'win32');
  const venv = venvPython(ctx.windows);
  const opts = { cwd: projectDir, signal, onOutput: log };
  const installed = `Python ${python.version}, paketler kuruldu`;

  await run(`${python.command} -m venv .venv`, opts);
  if (!existsSync(join(projectDir, venv + (ctx.windows ? '.exe' : '')))) {
    throw new Error('Sanal ortam oluşturuldu ama içinde python bulunamadı.');
  }
  await run(`"${venv}" -m pip install --disable-pip-version-check -r ${requirementsFileOf(ctx)}`, opts);

  // Testler ana paketi her zaman içe aktarmaz (ör. simülasyon testleri pygame'siz çalışır); doğrudan dene
  const modules = [...findPythonTemplate(ctx.template).imports, ...(ctx.options.has('ai') ? ['anthropic'] : [])];
  if (modules.length) {
    try {
      await run(`"${venv}" -c "import ${modules.join(', ')}"`, opts);
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      return {
        message: installed,
        warning: isBlockedByAppControl(error)
          ? APP_CONTROL_WARNING
          : `Paketler kuruldu ama içe aktarılamadı (${modules.join(', ')}). Ayrıntı için Ayrıntılı log'a bak.`,
      };
    }
  }

  if (!ctx.options.has('tests')) return { message: installed };
  try {
    const output = await run(`"${venv}" -m pytest -q`, opts);
    const passed = /(\d+) passed/.exec(output)?.[1];
    return { message: `${installed}${passed ? `, ${passed} test geçti` : ''}` };
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    return {
      message: installed,
      warning: isBlockedByAppControl(error)
        ? APP_CONTROL_WARNING
        : `Örnek testler geçmedi. Ayrıntı için proje klasöründe çalıştır: ${venv} -m pytest`,
    };
  }
}

/**
 * Smart App Control açık Windows'ta imzasız DLL/exe'ler (pygame, pydantic-core, ruff gibi) "WinError 4551"
 * ile engellenir. Hata metni Windows'un dilinde gelir, o yüzden kod numarası da aranır.
 */
function isBlockedByAppControl(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /WinError 4551|Uygulama Denetimi|Application Control/i.test(text);
}
