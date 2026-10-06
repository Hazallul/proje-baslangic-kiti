#!/usr/bin/env node
import * as p from '@clack/prompts';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { DATABASES } from '../core/catalog/databases.js';
import { FRAMEWORKS, findFramework, OPTION_GROUPS } from '../core/catalog/frontend.js';
import { NEEDS } from '../core/catalog/needs.js';
import { generateProject, isTargetFree, STEP_LABELS } from '../core/generate/index.js';
import { serviceLinks } from '../core/generate/compose.js';
import { loadCatalog } from '../core/initializr.js';
import {
  applyPreset, availableServices, defaultSelection, GROUP_PATTERN, NAME_PATTERN, PRESETS, resolve as resolveSelection,
  setFramework, setNeed, suggestedServices,
} from '../core/selection.js';
import type { FrameworkId, Selection } from '../core/types.js';

const VERSION = '0.2.2';

const HELP = `
${pc.bold('create-hazal-app')} - Spring Boot projesini (isteğe bağlı frontend ve Docker servisleriyle) kurar

${pc.bold('Kullanım')}
  create-hazal-app [proje-adı] [seçenekler]

${pc.bold('Seçenekler')}
  --config <dosya>  Seçimleri JSON dosyasından oku (soru sormaz)
  --no-start        Docker ile başlatma
  -h, --help        Bu yardımı göster
  -v, --version     Sürümü göster
`;

function check<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel('İptal edildi.');
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

async function main(): Promise<void> {
  const { values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      'no-start': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (flags.help) return console.log(HELP);
  if (flags.version) return console.log(VERSION);

  p.intro(pc.bgCyan(pc.black(' create-hazal-app ')));

  let sel: Selection;
  if (flags.config) {
    sel = { ...defaultSelection(), ...JSON.parse(readFileSync(flags.config, 'utf8')) };
    if (positionals[0]) sel.name = positionals[0];
  } else {
    sel = await ask(positionals[0]);
  }
  sel.location = resolvePath(sel.location || process.cwd());
  if (flags['no-start']) sel.start = false;

  if (!NAME_PATTERN.test(sel.name)) throw new Error(`Geçersiz proje adı: ${sel.name}`);
  if (!isTargetFree(sel)) throw new Error(`"${sel.name}" klasörü zaten var ve boş değil.`);

  const spinner = p.spinner();
  const result = await generateProject(sel, {
    onEvent: (event) => {
      if (event.type === 'step') {
        const label = STEP_LABELS[event.step];
        if (event.status === 'running') spinner.start(label);
        else if (event.status === 'done') spinner.stop(event.message ? `${label}: ${event.message}` : label);
        else if (event.status === 'error') spinner.error(`${label}: başarısız`);
        else p.log.info(pc.dim(`${label}: atlandı${event.message ? ` (${event.message})` : ''}`));
      } else if (event.type === 'info') {
        p.log.info(event.message);
      }
    },
  });

  result.warnings.forEach((w) => p.log.warn(w));
  if (result.started) {
    const links = serviceLinks(resolveSelection(sel), result.ports)
      .map((l) => `${l.label.padEnd(16)} ${pc.cyan(l.url)}`)
      .join('\n');
    p.note(links, 'Servisler');
  }
  p.note(
    [`cd ${sel.name}`, result.started ? null : 'docker compose up -d --build', 'docker compose watch   # canlı yenileme']
      .filter(Boolean).join('\n'),
    'Sıradaki adımlar',
  );
  p.outro(`${pc.green('Hazır!')} Kolay gelsin 🚀`);
}

async function ask(nameArg?: string): Promise<Selection> {
  const cache = join(homedir(), '.create-hazal-app', 'initializr.json');
  const catalog = await loadCatalog(cache);

  let sel = defaultSelection();
  sel.name = nameArg ?? check(await p.text({
    message: 'Proje adı?',
    placeholder: 'my-app',
    validate: (v) => (v && NAME_PATTERN.test(v) ? undefined : 'Küçük harfle başlamalı; küçük harf, rakam ve tire'),
  }));

  sel.backend.groupId = check(await p.text({
    message: 'Group ID?',
    initialValue: sel.backend.groupId,
    validate: (v) => (v && GROUP_PATTERN.test(v) ? undefined : 'Örnek: com.sirket'),
  }));
  sel.backend.javaVersion = check(await p.select({
    message: 'Java sürümü?',
    options: catalog.javaVersions.map((v) => ({ value: v, label: `Java ${v}` })),
    initialValue: '21',
  }));
  sel.backend.buildTool = check(await p.select({
    message: 'Derleme aracı?',
    options: [{ value: 'maven' as const, label: 'Maven' }, { value: 'gradle' as const, label: 'Gradle' }],
  }));

  const presetId = check(await p.select({
    message: 'Hızlı başlangıç şablonu?',
    options: PRESETS.map((preset) => ({ value: preset.id, label: preset.label, hint: preset.description })),
  }));
  sel = applyPreset(sel, presetId);

  // İhtiyaçlar: şablonun işaretledikleri seçili gelir
  const needIds = check(await p.multiselect({
    message: 'İhtiyaçlar? (boşluk ile seç)',
    options: NEEDS.map((n) => ({ value: n.id, label: n.label, hint: n.description })),
    initialValues: Object.keys(sel.needs),
    required: false,
  }));
  for (const need of NEEDS) {
    if (!needIds.includes(need.id)) {
      sel = setNeed(sel, need.id, null);
      continue;
    }
    const variant = need.variants.length === 1 ? need.variants[0].id : check(await p.select({
      message: `${need.label}: hangisi?`,
      options: need.variants.map((v) => ({ value: v.id, label: v.label, hint: v.description })),
      initialValue: sel.needs[need.id] ?? need.variants[0].id,
    }));
    sel = setNeed(sel, need.id, variant);
  }

  // Veritabanı
  const sql = check(await p.select({
    message: 'İlişkisel veritabanı?',
    options: [
      { value: 'none', label: 'Yok' },
      ...DATABASES.filter((d) => d.kind === 'sql').map((d) => ({ value: d.id, label: d.label, hint: d.description })),
    ],
  }));
  sel.database.sql = sql === 'none' ? null : sql;
  sel.database.nosql = check(await p.multiselect({
    message: 'NoSQL veritabanları? (isteğe bağlı)',
    options: DATABASES.filter((d) => d.kind === 'nosql').map((d) => ({ value: d.id, label: d.label, hint: d.description })),
    required: false,
  }));
  if (sel.database.sql) {
    sel.database.migration = check(await p.select({
      message: 'Şema yönetimi?',
      options: [
        { value: 'flyway' as const, label: 'Flyway', hint: 'SQL dosyalarıyla' },
        { value: 'liquibase' as const, label: 'Liquibase', hint: 'YAML/XML changelog' },
        { value: 'none' as const, label: 'Yok', hint: 'Hibernate ddl-auto=update' },
      ],
    }));
  }

  // Tüm Initializr kataloğundan ek paketler
  const resolvedNow = resolveSelection(sel);
  sel.backend.dependencies = check(await p.autocompleteMultiselect({
    message: 'Ek Spring paketleri? (yazarak ara, boşluk ile seç)',
    options: catalog.groups.flatMap((g) => g.dependencies
      .filter((d) => !resolvedNow.dependencies.includes(d.id))
      .map((d) => ({ value: d.id, label: d.name, hint: g.name }))),
    initialValues: sel.backend.dependencies,
    required: false,
  }));

  // Frontend
  const framework = check(await p.select({
    message: 'Frontend?',
    options: [
      { value: 'none', label: 'Yok', hint: 'Sadece backend' },
      ...FRAMEWORKS.map((f) => ({ value: f.id, label: f.label, hint: f.description })),
    ],
    initialValue: sel.frontend.framework ?? 'none',
  }));
  sel = setFramework(sel, framework === 'none' ? null : (framework as FrameworkId));
  if (sel.frontend.framework) {
    const fw = findFramework(sel.frontend.framework);
    const options = check(await p.multiselect({
      message: `${fw.label} seçenekleri?`,
      options: fw.options.map((o) => ({ value: o.id, label: o.label, hint: `${OPTION_GROUPS[o.group].label} · ${o.description}` })),
      initialValues: sel.frontend.options,
      required: false,
    }));
    sel.frontend.options = normalizeOptions(sel.frontend.framework, options);
  }

  // Ek servisler: ihtiyaçlardan gelenler ve öneriler seçili gelir
  const resolved = resolveSelection(sel);
  const suggested = suggestedServices(resolved).map((s) => s.id);
  const services = availableServices(resolved);
  if (services.length) {
    sel.services = check(await p.multiselect({
      message: 'Ek Docker servisleri?',
      options: services.map((s) => ({
        value: s.id,
        label: s.label,
        hint: `${s.description}${suggested.includes(s.id) ? ' · önerilen' : ''}`,
      })),
      initialValues: [...resolved.services, ...suggested],
      required: false,
    }));
  }

  sel.start = check(await p.confirm({ message: 'Oluşunca Docker ile başlatılsın mı?', initialValue: true }));
  return sel;
}

/** Aynı gruptan birden fazla UI kütüphanesi seçildiyse ilkini tut, gerekenleri ekle */
function normalizeOptions(framework: FrameworkId, selected: string[]): string[] {
  const all = findFramework(framework).options;
  const result: string[] = [];
  const usedExclusive = new Set<string>();
  for (const id of selected) {
    const option = all.find((o) => o.id === id)!;
    if (OPTION_GROUPS[option.group].exclusive) {
      if (usedExclusive.has(option.group)) continue;
      usedExclusive.add(option.group);
    }
    result.push(id, ...(option.requires ?? []));
  }
  return [...new Set(result)];
}

main().catch((error: unknown) => {
  p.cancel(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

