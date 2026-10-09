import { DATABASES, findDatabase } from './catalog/databases.js';
import { findFramework, OPTION_GROUPS } from './catalog/frontend.js';
import { findNeed, findVariant, NEEDS } from './catalog/needs.js';
import { findPythonTemplate, PYTHON_RESERVED, pythonPackageName } from './catalog/python.js';
import { findService, SERVICES, type ServiceDef } from './catalog/services.js';
import type { FrameworkId, ProjectKind, PythonTemplate, ResolvedProject, Selection } from './types.js';

export const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
export const GROUP_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

/** Java paket adında kullanılamayan kelimeler (proje adı paketin son parçası olur) */
const JAVA_KEYWORDS = new Set(('abstract assert boolean break byte case catch char class const continue default do double '
  + 'else enum extends false final finally float for goto if implements import instanceof int interface long native new '
  + 'null package private protected public return short static strictfp super switch synchronized this throw throws '
  + 'transient true try void volatile while').split(' '));

export function defaultSelection(): Selection {
  return {
    stack: 'spring',
    name: 'my-app',
    location: '',
    backend: { enabled: true, groupId: 'com.example', javaVersion: '21', buildTool: 'maven', dependencies: [], libraries: [] },
    needs: {},
    database: { sql: null, nosql: [], migration: 'flyway' },
    frontend: { framework: null, options: [] },
    python: { template: 'game', options: [...findPythonTemplate('game').defaultOptions], install: true },
    services: [],
    git: true,
    gitRemote: { mode: 'local', url: '', private: true },
    start: true,
  };
}

/**
 * Kayıtlı (eski sürümden kalmış olabilecek) ya da elle yazılmış bir seçimi bugünkü yapıyla birleştirir:
 * iç içe alanlarda eksik olanlar varsayılan değerini alır.
 */
export function withDefaults(saved: Partial<Selection> | null | undefined): Selection {
  const base = defaultSelection();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    backend: { ...base.backend, ...saved.backend },
    database: { ...base.database, ...saved.database },
    frontend: { ...base.frontend, ...saved.frontend },
    python: { ...base.python, ...saved.python },
    gitRemote: { ...base.gitRemote, ...saved.gitRemote },
  };
}

// ---------------------------------------------------------------------------
// Hızlı başlangıç şablonları
// ---------------------------------------------------------------------------

export interface PresetDef {
  id: string;
  label: string;
  description: string;
  needs: Record<string, string>;
  dependencies: string[];
  frontend: { framework: FrameworkId | null; options: string[] };
}

const restNeeds = { validation: 'default', 'api-docs': 'swagger', monitoring: 'health' };

export const PRESETS: PresetDef[] = [
  {
    id: 'empty',
    label: 'Boş proje',
    description: 'Sadece Spring Web',
    needs: {},
    dependencies: [],
    frontend: { framework: null, options: [] },
  },
  {
    id: 'rest-api',
    label: 'Dokümanlı API',
    description: 'Doğrulama, Swagger, sağlık kontrolü, Lombok',
    needs: restNeeds,
    dependencies: ['lombok'],
    frontend: { framework: null, options: [] },
  },
  {
    id: 'fullstack',
    label: 'API + React',
    description: 'Dokümanlı API + React, Tailwind, Router',
    needs: restNeeds,
    dependencies: ['lombok'],
    frontend: { framework: 'react', options: ['tailwind', 'react-router', 'axios'] },
  },
  {
    id: 'secure-api',
    label: 'Güvenli API',
    description: 'REST API + JWT ile kimlik doğrulama',
    needs: { ...restNeeds, security: 'jwt' },
    dependencies: ['lombok'],
    frontend: { framework: null, options: [] },
  },
  {
    id: 'event-driven',
    label: 'Olay tabanlı servis',
    description: 'Kafka, Prometheus + Grafana izleme',
    needs: { validation: 'default', messaging: 'kafka', monitoring: 'prometheus' },
    dependencies: ['lombok'],
    frontend: { framework: null, options: [] },
  },
];

/**
 * Şablonu uygular. Ad, konum, Java ayarları ve veritabanı seçimi korunur. Fullstack projede
 * frontend'i olmayan bir şablon (ör. REST API) seçilirse mevcut frontend kalır: şablon backend'i
 * hazırlar, kullanıcının seçtiği proje türünü değiştirmez.
 */
export function applyPreset(sel: Selection, presetId: string): Selection {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Bilinmeyen şablon: ${presetId}`);
  const keepFrontend = !preset.frontend.framework && projectKindOf(sel) === 'fullstack';

  let next: Selection = {
    ...sel,
    stack: 'spring',
    backend: { ...sel.backend, enabled: true, dependencies: [...preset.dependencies], libraries: [] },
    needs: {},
    frontend: keepFrontend ? sel.frontend : { framework: preset.frontend.framework, options: [...preset.frontend.options] },
    services: [],
  };
  for (const [needId, variantId] of Object.entries(preset.needs)) {
    next = setNeed(next, needId, variantId);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Proje türü
// ---------------------------------------------------------------------------

export function isPython(sel: Selection): boolean {
  return sel.stack === 'python';
}

/** Projede Spring Boot backend var mı? (Eski kayıtlarda alan yoksa var sayılır) */
export function hasBackend(sel: Selection): boolean {
  return !isPython(sel) && sel.backend.enabled !== false;
}

export function projectKindOf(sel: Selection): ProjectKind {
  if (isPython(sel)) return 'python';
  if (!hasBackend(sel)) return 'frontend';
  return sel.frontend.framework ? 'fullstack' : 'backend';
}

/**
 * Proje türünü değiştirir; frontend gerekiyorsa ve seçili değilse React seçilir.
 * Yayınlama seçenekleri (Vercel) sadece backend'siz projede anlamlı, backend açılınca kaldırılır.
 * Python'a geçmek Spring tarafındaki seçimleri silmez; geri dönünce yerinde durur.
 */
export function setProjectKind(sel: Selection, kind: ProjectKind): Selection {
  if (kind === 'python') return { ...sel, stack: 'python' };
  sel = { ...sel, stack: 'spring' };
  const backend = { ...sel.backend, enabled: kind !== 'frontend' };
  if (kind === 'backend') return { ...sel, backend, frontend: { framework: null, options: [] } };
  const framework = sel.frontend.framework ?? 'react';
  const deploy = new Set(findFramework(framework).options.filter((o) => o.group === 'deploy').map((o) => o.id));
  const options = kind === 'frontend' ? sel.frontend.options : sel.frontend.options.filter((o) => !deploy.has(o));
  return { ...sel, backend, frontend: { framework, options } };
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

/**
 * Şablonu değiştirir. Yeni şablonda da olan seçenekler korunur; eski şablonda hiç olmayan
 * ama yeni şablonun varsayılanı olan seçenekler (ör. konsol uygulamasında exe) eklenir.
 */
export function setPythonTemplate(sel: Selection, template: PythonTemplate): Selection {
  const previous = findPythonTemplate(sel.python.template);
  const next = findPythonTemplate(template);
  const kept = sel.python.options.filter((o) => next.options.includes(o));
  const added = next.defaultOptions.filter((o) => !previous.options.includes(o) && !kept.includes(o));
  return { ...sel, python: { ...sel.python, template, options: [...kept, ...added] } };
}

export function togglePythonOption(sel: Selection, optionId: string): Selection {
  if (!findPythonTemplate(sel.python.template).options.includes(optionId)) return sel;
  const options = sel.python.options.includes(optionId)
    ? sel.python.options.filter((o) => o !== optionId)
    : [...sel.python.options, optionId];
  return { ...sel, python: { ...sel.python, options } };
}

/** Şablonda gerçekten bulunan seçenekler (eski kayıtlardaki geçersizler ayıklanır) */
export function pythonOptionsOf(sel: Selection): Set<string> {
  const available = findPythonTemplate(sel.python.template).options;
  return new Set(sel.python.options.filter((o) => available.includes(o)));
}

// ---------------------------------------------------------------------------
// İhtiyaçlar
// ---------------------------------------------------------------------------

/** İhtiyacı açar/kapatır veya varyantını değiştirir. variantId null ise kapatır. */
export function setNeed(sel: Selection, needId: string, variantId: string | null): Selection {
  const needs = { ...sel.needs };
  const previous = needs[needId];
  let services = [...sel.services];

  if (previous) {
    // Önceki varyantın getirdiği servisleri, başka bir ihtiyaç da istemiyorsa kaldır
    const others = Object.entries(needs).filter(([id]) => id !== needId);
    const stillWanted = new Set(others.flatMap(([id, v]) => findVariant(id, v).services ?? []));
    const removed = (findVariant(needId, previous).services ?? []).filter((s) => !stillWanted.has(s));
    services = services.filter((s) => !removed.includes(s));
    delete needs[needId];
  }

  if (variantId) {
    needs[needId] = variantId;
    for (const service of findVariant(needId, variantId).services ?? []) {
      if (!services.includes(service)) services.push(service);
    }
  }

  return { ...sel, needs, services: withRequiredServices(services) };
}

// ---------------------------------------------------------------------------
// Veritabanı
// ---------------------------------------------------------------------------

export function setSqlDatabase(sel: Selection, id: string | null): Selection {
  return { ...sel, database: { ...sel.database, sql: id } };
}

export function toggleNoSqlDatabase(sel: Selection, id: string): Selection {
  const nosql = sel.database.nosql.includes(id)
    ? sel.database.nosql.filter((d) => d !== id)
    : [...sel.database.nosql, id];
  return { ...sel, database: { ...sel.database, nosql } };
}

// ---------------------------------------------------------------------------
// Frontend
// ---------------------------------------------------------------------------

export function setFramework(sel: Selection, framework: FrameworkId | null): Selection {
  if (!framework) return { ...sel, frontend: { framework: null, options: [] } };
  // Yeni framework'te de bulunan seçenekleri koru (Tailwind, Prettier gibi)
  const available = new Set(findFramework(framework).options.map((o) => o.id));
  const options = sel.frontend.options.filter((o) => available.has(o));
  return { ...sel, frontend: { framework, options } };
}

export function toggleFrontendOption(sel: Selection, optionId: string): Selection {
  const framework = sel.frontend.framework;
  if (!framework) return sel;
  const all = findFramework(framework).options;
  const option = all.find((o) => o.id === optionId);
  if (!option) return sel;

  let options = [...sel.frontend.options];
  if (options.includes(optionId)) {
    // Kaldırılıyor: bu seçeneğe ihtiyaç duyanları da kaldır (Tailwind kalkarsa shadcn de kalkar)
    const dependents = all.filter((o) => o.requires?.includes(optionId)).map((o) => o.id);
    options = options.filter((o) => o !== optionId && !dependents.includes(o));
  } else {
    if (OPTION_GROUPS[option.group].exclusive) {
      const sameGroup = all.filter((o) => o.group === option.group).map((o) => o.id);
      options = options.filter((o) => !sameGroup.includes(o));
    }
    options.push(optionId, ...(option.requires ?? []).filter((r) => !options.includes(r)));
  }
  return { ...sel, frontend: { ...sel.frontend, options } };
}

// ---------------------------------------------------------------------------
// Servisler ve paketler
// ---------------------------------------------------------------------------

export function toggleService(sel: Selection, id: string): Selection {
  if (sel.services.includes(id)) {
    // Bu servise bağımlı olanları da kaldır (Kafka kalkarsa Kafka UI da kalkar)
    const dependents = SERVICES.filter((s) => s.requires?.includes(id)).map((s) => s.id);
    return { ...sel, services: sel.services.filter((s) => s !== id && !dependents.includes(s)) };
  }
  return { ...sel, services: withRequiredServices([...sel.services, id]) };
}

function withRequiredServices(services: string[]): string[] {
  const result = [...services];
  for (const id of services) {
    for (const required of findService(id).requires ?? []) {
      if (!result.includes(required)) result.unshift(required);
    }
  }
  return result;
}

export function toggleDependency(sel: Selection, id: string): Selection {
  const deps = sel.backend.dependencies;
  const dependencies = deps.includes(id) ? deps.filter((d) => d !== id) : [...deps, id];
  return { ...sel, backend: { ...sel.backend, dependencies } };
}

// ---------------------------------------------------------------------------
// Çözümleme: seçimlerden nihai listeyi hesapla
// ---------------------------------------------------------------------------

export function resolve(sel: Selection): ResolvedProject {
  const sources: Record<string, string> = {};
  const add = (id: string, source: string) => {
    if (!sources[id]) sources[id] = source;
  };

  // Sadece frontend ve Python projelerinde Spring tarafından hiçbir şey üretilmez
  if (!hasBackend(sel)) {
    return {
      selection: sel,
      dependencies: [],
      dependencySources: {},
      libraries: [],
      databases: [],
      services: [],
      frontendOptions: isPython(sel) ? [] : sel.frontend.options,
    };
  }

  add('web', 'Temel');

  const databases = new Set<string>();
  if (sel.database.sql) databases.add(sel.database.sql);
  sel.database.nosql.forEach((d) => databases.add(d));

  const libraries = new Set(sel.backend.libraries);
  for (const [needId, variantId] of Object.entries(sel.needs)) {
    const need = findNeed(needId);
    const variant = findVariant(needId, variantId);
    variant.dependencies.forEach((d) => add(d, need.label));
    variant.libraries?.forEach((l) => libraries.add(l));
    variant.databases?.forEach((d) => databases.add(d));
  }

  for (const dbId of databases) {
    const db = findDatabase(dbId);
    db.dependencies.forEach((d) => add(d, db.label));
  }
  if (sel.database.sql && sel.database.migration !== 'none') {
    add(sel.database.migration, 'Veritabanı');
  }

  sel.backend.dependencies.forEach((d) => add(d, 'Elle seçildi'));

  // Sadece ilgili veritabanı varken anlamlı olan servisleri (ör. pgAdmin) ele
  const services = sel.services.filter((id) => {
    const service = findService(id);
    return !service.forDatabases || service.forDatabases.some((d) => databases.has(d));
  });

  return {
    selection: sel,
    dependencies: Object.keys(sources),
    dependencySources: sources,
    libraries: [...libraries],
    databases: DATABASES.map((d) => d.id).filter((id) => databases.has(id)),
    services: withRequiredServices(services),
    frontendOptions: sel.frontend.options,
  };
}

/** Seçimlere göre önerilen ama henüz eklenmemiş servisler */
export function suggestedServices(resolved: ResolvedProject): ServiceDef[] {
  return SERVICES.filter((service) => {
    if (resolved.services.includes(service.id)) return false;
    const { dependencies = [], databases = [], unlessNeeds = {} } = service.suggestWhen;
    const needs = resolved.selection.needs;
    if (Object.entries(unlessNeeds).some(([need, variants]) => variants.includes(needs[need]))) return false;
    return dependencies.some((d) => resolved.dependencies.includes(d))
      || databases.some((d) => resolved.databases.includes(d));
  });
}

/** Seçilebilir servisler (ilgili veritabanı yoksa veritabanı arayüzleri gizlenir) */
export function availableServices(resolved: ResolvedProject): ServiceDef[] {
  return SERVICES.filter((s) => !s.forDatabases || s.forDatabases.some((d) => resolved.databases.includes(d)));
}

/**
 * Uzak depo adresi: https://sunucu/kullanıcı/depo(.git) ya da git@sunucu:kullanıcı/depo(.git).
 * Komut satırına gideceği için boşluk, tırnak ve kabuk karakterlerine izin verilmez.
 */
export const REMOTE_URL_PATTERN = /^(https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[A-Za-z0-9._~-]+\/[A-Za-z0-9._~/-]+|git@[A-Za-z0-9.-]+:[A-Za-z0-9._~-]+\/[A-Za-z0-9._~/-]+)$/;

/** GitHub depo adresinin tarayıcıda açılan hali (GitHub değilse null) */
export function repoWebUrl(url: string): string | null {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match ? `https://github.com/${match[1]}` : null;
}

export interface ValidationIssue {
  field: 'name' | 'location' | 'groupId' | 'frontend' | 'remote';
  message: string;
}

export function validate(sel: Selection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!sel.name) issues.push({ field: 'name', message: 'Proje adı boş olamaz' });
  else if (!NAME_PATTERN.test(sel.name)) {
    issues.push({ field: 'name', message: 'Küçük harfle başlamalı; sadece küçük harf, rakam ve tire kullanılabilir' });
  } else if (sel.name.endsWith('-')) {
    issues.push({ field: 'name', message: 'Proje adı tireyle bitemez' });
  } else if (isPython(sel) && PYTHON_RESERVED.has(pythonPackageName(sel.name))) {
    issues.push({ field: 'name', message: `"${sel.name}" Python'da bir modül ya da ayrılmış kelime; paket adı olunca onu gölgeler` });
  } else if (hasBackend(sel) && JAVA_KEYWORDS.has(sel.name.replace(/-/g, ''))) {
    issues.push({ field: 'name', message: `"${sel.name}" Java'da ayrılmış bir kelime, paket adı olamaz` });
  }
  if (!sel.location) issues.push({ field: 'location', message: 'Projenin oluşturulacağı klasörü seç' });
  else if (!/^([a-zA-Z]:[\\/]|\/|\\\\)/.test(sel.location)) {
    issues.push({ field: 'location', message: 'Konum tam bir klasör yolu olmalı (örn. C:\\Projeler)' });
  }
  if (sel.git && sel.gitRemote.mode === 'url') {
    const url = sel.gitRemote.url.trim();
    if (!url) issues.push({ field: 'remote', message: 'Gönderilecek deponun adresini yapıştır' });
    else if (!REMOTE_URL_PATTERN.test(url)) {
      issues.push({ field: 'remote', message: 'Depo adresi https://github.com/kullanici/depo.git gibi olmalı' });
    }
  }
  if (isPython(sel)) return issues;
  if (!hasBackend(sel) && !sel.frontend.framework) {
    issues.push({ field: 'frontend', message: 'Sadece frontend projesi için bir framework seç' });
  }
  if (!hasBackend(sel)) return issues;
  if (!GROUP_PATTERN.test(sel.backend.groupId)) {
    issues.push({ field: 'groupId', message: 'Geçerli bir Java paket adı olmalı, örn. com.sirket' });
  } else if (sel.backend.groupId.split('.').some((part) => JAVA_KEYWORDS.has(part))) {
    issues.push({ field: 'groupId', message: "Group ID Java'da ayrılmış bir kelime içeriyor (ör. new, class)" });
  }
  return issues;
}

export { NEEDS };
