import { findDatabase } from '../../core/catalog/databases';
import { findFramework } from '../../core/catalog/frontend';
import { findNeed, findVariant } from '../../core/catalog/needs';
import { findPythonOption, findPythonTemplate } from '../../core/catalog/python';
import { findService } from '../../core/catalog/services';
import { hasBackend, isPython, pythonOptionsOf } from '../../core/selection';
import type { ResolvedProject, StepId } from '../../core/types';

/** Parça çerçevesindeki bir parça: A1, B3 gibi numarası, adı, kısa açıklaması ve hangi adımda takıldığı */
export interface Part {
  id: string;
  number: string;
  label: string;
  detail?: string;
  /** Oluşturma sırasında bu adım bitince parça "takılmış" görünür */
  step: StepId;
}

export interface PartGroup {
  letter: string;
  title: string;
  /** Grup boşken yuvada gösterilen ipucu */
  empty: string;
  parts: Part[];
}

type Draft = Omit<Part, 'number'>;

/**
 * Projeye girecek her şey, kit kitapçığındaki gibi harfli gruplar halinde: A çekirdek, B seçimler,
 * C altyapı. Gruplar hep aynı harfle durur; boş grup boş yuva olarak görünür ve seçim yapınca dolar.
 */
export function partsOf(resolved: ResolvedProject): PartGroup[] {
  const sel = resolved.selection;
  const core: Draft[] = [];
  const extras: Draft[] = [];
  const infra: Draft[] = [];

  if (isPython(sel)) {
    const template = findPythonTemplate(sel.python.template);
    core.push({ id: 'python', label: 'Python', detail: template.label, step: 'python-files' });
    template.includes.forEach((label) => core.push({ id: `inc-${label}`, label, step: 'python-files' }));
    pythonOptionsOf(sel).forEach((id) => {
      const option = findPythonOption(id);
      extras.push({ id: `opt-${id}`, label: option.label, detail: option.description, step: 'python-files' });
    });
    if (sel.python.install) infra.push({ id: 'venv', label: '.venv', detail: 'paketler kurulu', step: 'python-env' });
    infra.push({ id: 'vscode', label: 'VS Code ayarları', detail: 'F5 ile çalıştır', step: 'python-files' });
  } else {
    if (hasBackend(sel)) {
      const build = sel.backend.buildTool === 'gradle' ? 'Gradle' : 'Maven';
      core.push({ id: 'spring', label: 'Spring Boot', detail: `Java ${sel.backend.javaVersion} · ${build}`, step: 'backend' });
    }
    if (sel.frontend.framework) {
      const fw = findFramework(sel.frontend.framework);
      core.push({ id: `fw-${fw.id}`, label: fw.label, detail: 'TypeScript · Vite', step: 'frontend' });
      for (const id of resolved.frontendOptions) {
        const option = fw.options.find((o) => o.id === id);
        if (option) extras.push({ id: `fe-${id}`, label: option.label, step: 'frontend' });
      }
    }
    for (const [needId, variantId] of Object.entries(sel.needs)) {
      const need = findNeed(needId);
      const variant = findVariant(needId, variantId);
      const detail = need.variants.length > 1 ? variant.label : undefined;
      extras.push({ id: `need-${needId}`, label: need.label, detail, step: 'backend' });
    }
    resolved.databases.forEach((id) => infra.push({ id: `db-${id}`, label: findDatabase(id).label, detail: 'veritabanı', step: 'docker-files' }));
    resolved.services.forEach((id) => infra.push({ id: `svc-${id}`, label: findService(id).label, step: 'docker-files' }));
    infra.push({ id: 'compose', label: 'Docker Compose', detail: '.env ile', step: 'docker-files' });
  }
  if (sel.git) {
    infra.push({ id: 'git', label: 'Git', detail: 'ilk commit', step: 'git' });
    const remote = sel.gitRemote;
    if (remote.mode === 'github') {
      infra.push({ id: 'remote', label: 'GitHub deposu', detail: remote.private ? 'yeni, gizli' : 'yeni, herkese açık', step: 'git-push' });
    } else if (remote.mode === 'url') {
      const host = /^(?:https:\/\/|git@)([^/:]+)/.exec(remote.url)?.[1];
      infra.push({ id: 'remote', label: 'Uzak depo', detail: host ? `${host}'a push` : 'adres bekleniyor', step: 'git-push' });
    }
  }

  const groups: [string, string, string, Draft[]][] = [
    ['A', 'Çekirdek', 'Henüz parça yok', core],
    ['B', 'Seçimler', 'İhtiyaç ya da seçenek işaretleyince buraya takılır', extras],
    ['C', 'Altyapı', 'Henüz parça yok', infra],
  ];
  return groups.map(([letter, title, empty, parts]) => ({
    letter,
    title,
    empty,
    parts: parts.map((p, i) => ({ ...p, number: `${letter}${i + 1}` })),
  }));
}
