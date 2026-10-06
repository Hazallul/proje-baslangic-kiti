import { DATABASES, findDatabase } from './catalog/databases.js';
import { findFramework, OPTION_GROUPS } from './catalog/frontend.js';
import { findNeed, findVariant, NEEDS } from './catalog/needs.js';
import { findService, SERVICES, type ServiceDef } from './catalog/services.js';
import type { FrameworkId, ResolvedProject, Selection } from './types.js';

export const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
export const GROUP_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export function defaultSelection(): Selection {
  return {
    name: 'my-app',
    location: '',
    backend: { groupId: 'com.example', javaVersion: '21', buildTool: 'maven', dependencies: [], libraries: [] },
    needs: {},
    database: { sql: null, nosql: [], migration: 'flyway' },
    frontend: { framework: null, options: [] },
    services: [],
    git: true,
    start: true,
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
    label: 'REST API',
    description: 'Doğrulama, Swagger, sağlık kontrolü, Lombok',
    needs: restNeeds,
    dependencies: ['lombok'],
    frontend: { framework: null, options: [] },
  },
  {
    id: 'fullstack',
    label: 'Fullstack web',
    description: 'REST API + React, Tailwind, Router',
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

/** Şablonu uygular. Ad, konum, Java ayarları ve veritabanı seçimi korunur. */
export function applyPreset(sel: Selection, presetId: string): Selection {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Bilinmeyen şablon: ${presetId}`);

  let next: Selection = {
    ...sel,
    backend: { ...sel.backend, dependencies: [...preset.dependencies], libraries: [] },
    needs: {},
    frontend: { framework: preset.frontend.framework, options: [...preset.frontend.options] },
    services: [],
  };
  for (const [needId, variantId] of Object.entries(preset.needs)) {
    next = setNeed(next, needId, variantId);
  }
  return next;
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
    const { dependencies = [], databases = [] } = service.suggestWhen;
    return dependencies.some((d) => resolved.dependencies.includes(d))
      || databases.some((d) => resolved.databases.includes(d));
  });
}

/** Seçilebilir servisler (ilgili veritabanı yoksa veritabanı arayüzleri gizlenir) */
export function availableServices(resolved: ResolvedProject): ServiceDef[] {
  return SERVICES.filter((s) => !s.forDatabases || s.forDatabases.some((d) => resolved.databases.includes(d)));
}

export interface ValidationIssue {
  field: 'name' | 'location' | 'groupId';
  message: string;
}

export function validate(sel: Selection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!sel.name) issues.push({ field: 'name', message: 'Proje adı boş olamaz' });
  else if (!NAME_PATTERN.test(sel.name)) {
    issues.push({ field: 'name', message: 'Küçük harfle başlamalı; sadece küçük harf, rakam ve tire kullanılabilir' });
  }
  if (!sel.location) issues.push({ field: 'location', message: 'Projenin oluşturulacağı klasörü seç' });
  else if (!/^([a-zA-Z]:[\\/]|\/|\\\\)/.test(sel.location)) {
    issues.push({ field: 'location', message: 'Konum tam bir klasör yolu olmalı (örn. C:\\Projeler)' });
  }
  if (!GROUP_PATTERN.test(sel.backend.groupId)) {
    issues.push({ field: 'groupId', message: 'Geçerli bir Java paket adı olmalı, örn. com.sirket' });
  }
  return issues;
}

export { NEEDS };
