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
import { findPythonOption, PYTHON_TEMPLATES } from '../core/catalog/python.js';
import { generateProject, isTargetFree, STEP_LABELS } from '../core/generate/index.js';
import { serviceLinks } from '../core/generate/compose.js';
import { loadCatalog } from '../core/initializr.js';
import {
  applyPreset, availableServices, defaultSelection, GROUP_PATTERN, isPython, NAME_PATTERN, PRESETS, REMOTE_URL_PATTERN,
  resolve as resolveSelection,
  setFramework, setNeed, setProjectKind, setPythonTemplate, suggestedServices, validate, withDefaults,
} from '../core/selection.js';
import type { FrameworkId, PythonTemplate, Selection } from '../core/types.js';

const VERSION = '0.3.0';

const HELP = `
${pc.bold('create-hazal-app')} - Spring Boot, frontend ve Python projelerini çalışır halde kurar

${pc.bold('Kullanım')}
  create-hazal-app [proje-adı] [seçenekler]

${pc.bold('Seçenekler')}
  --config <dosya>  Seçimleri JSON dosyasından oku (soru sormaz)
  --no-start        Docker ile başlatma / Python paketlerini kurma
  --no-git          Git deposu başlatma
  --remote <url>    İlk commit'ten sonra bu (boş) depoya gönder
  --github          GitHub'da yeni gizli depo aç ve gönder (kayıtlı git girişiyle)
  --public          --github ile: depo herkese açık olsun
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
      'no-git': { type: 'boolean' },
      remote: { type: 'string' },
      github: { type: 'boolean' },
      public: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (flags.help) return console.log(HELP);
  if (flags.version) return console.log(VERSION);

  p.intro(pc.bgCyan(pc.black(' create-hazal-app ')));

  let sel: Selection;
  if (flags.config) {
    // İç içe alanlar da birleştirilir: JSON'da sadece backend.dependencies verilse bile diğer backend ayarları varsayılan kalır
    sel = withDefaults(JSON.parse(readFileSync(flags.config, 'utf8')) as Partial<Selection>);
    if (positionals[0]) sel.name = positionals[0];
  } else {
    sel = await ask(positionals[0]);
    if (!flags['no-git'] && !flags.remote && !flags.github) sel = await askGit(sel);
  }
  if (flags['no-git']) sel.git = false;
  if (flags.remote) sel.gitRemote = { ...sel.gitRemote, mode: 'url', url: flags.remote };
  if (flags.github) sel.gitRemote = { ...sel.gitRemote, mode: 'github', private: !flags.public };
  sel.location = resolvePath(sel.location || process.cwd());
  if (flags['no-start']) {
    sel.start = false;
    sel.python.install = false;
  }

  const issue = validate(sel)[0];
  if (issue) throw new Error(issue.message);
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
  if (isPython(sel)) {
    const commands = (result.commands ?? []).map((c) => `${c.command.padEnd(44)} ${pc.dim(`# ${c.label}`)}`);
    p.note([`cd ${sel.name}`, ...commands].join('\n'), 'Sıradaki adımlar');
    if (result.repoUrl) p.log.info(`Depo: ${pc.cyan(result.repoUrl)}`);
    p.outro(`${pc.green('Hazır!')} VS Code'da açıp F5 ile çalıştırabilirsin.`);
    return;
  }
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
  if (result.repoUrl) p.log.info(`Depo: ${pc.cyan(result.repoUrl)}`);
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

  const kind = check(await p.select({
    message: 'Proje türü?',
    options: [
      { value: 'fullstack' as const, label: 'Fullstack', hint: 'Spring Boot + frontend' },
      { value: 'backend' as const, label: 'Sadece backend', hint: 'Spring Boot API' },
      { value: 'frontend' as const, label: 'Sadece frontend', hint: 'Backend yok: portfolyo, tanıtım sitesi' },
      { value: 'python' as const, label: 'Python', hint: 'Oyun/simülasyon, FastAPI ya da konsol uygulaması' },
    ],
  }));
  if (kind === 'python') return askPython(setProjectKind(sel, 'python'));
  if (kind === 'frontend') {
    sel = setProjectKind(sel, 'frontend');
    await askFrontend(sel, false);
    sel.start = check(await p.confirm({ message: 'Oluşunca Docker ile başlatılsın mı?', initialValue: true }));
    return sel;
  }

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
  if (kind === 'fullstack') sel = await askFrontend(sel, true);
  else sel = setFramework(sel, null);

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

/** Git deposu ve uzak depo. Commit ve push bilgisayardaki git'in kimliği ve kayıtlı girişiyle yapılır. */
async function askGit(sel: Selection): Promise<Selection> {
  const mode = check(await p.select({
    message: 'Git?',
    options: [
      { value: 'local' as const, label: 'Bu bilgisayarda depo', hint: 'ilk commit ile' },
      { value: 'github' as const, label: "GitHub'da yeni depo aç", hint: 'kayıtlı git girişiyle' },
      { value: 'url' as const, label: 'Açtığım depoya gönder', hint: 'boş deponun adresini yapıştır' },
      { value: 'none' as const, label: 'Git yok' },
    ],
  }));
  if (mode === 'none') return { ...sel, git: false };
  const remote = { ...sel.gitRemote, mode };
  if (mode === 'url') {
    remote.url = check(await p.text({
      message: 'Depo adresi?',
      placeholder: 'https://github.com/kullanici/depo.git',
      validate: (v) => (v && REMOTE_URL_PATTERN.test(v.trim()) ? undefined : 'Örnek: https://github.com/kullanici/depo.git'),
    })).trim();
  }
  if (mode === 'github') remote.private = check(await p.confirm({ message: 'Depo gizli olsun mu?', initialValue: true }));
  return { ...sel, git: true, gitRemote: remote };
}

async function askPython(sel: Selection): Promise<Selection> {
  const template = check(await p.select({
    message: 'Python şablonu?',
    options: PYTHON_TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.description })),
  })) as PythonTemplate;
  sel = setPythonTemplate(sel, template);
  const available = PYTHON_TEMPLATES.find((t) => t.id === template)!.options;
  const options = check(await p.multiselect({
    message: 'Seçenekler? (boşluk ile seç)',
    options: available.map((id) => ({ value: id, label: findPythonOption(id).label, hint: findPythonOption(id).description })),
    initialValues: sel.python.options,
    required: false,
  }));
  const install = check(await p.confirm({ message: 'Sanal ortam kurulup paketler indirilsin mi?', initialValue: true }));
  return { ...sel, python: { ...sel.python, options, install } };
}

/** Framework ve seçeneklerini sorar (sel'i yerinde günceller ve döner) */
async function askFrontend(sel: Selection, backend: boolean): Promise<Selection> {
  const framework = check(await p.select({
    message: 'Frontend?',
    options: FRAMEWORKS.map((f) => ({ value: f.id, label: f.label, hint: f.description })),
    initialValue: sel.frontend.framework ?? 'react',
  }));
  Object.assign(sel, setFramework(sel, framework as FrameworkId));
  const fw = findFramework(framework as FrameworkId);
  // Vercel sadece frontend yayınlar; backend'li projede gösterme
  const available = fw.options.filter((o) => !(backend && o.group === 'deploy'));
  const options = check(await p.multiselect({
    message: `${fw.label} seçenekleri?`,
    options: available.map((o) => ({ value: o.id, label: o.label, hint: `${OPTION_GROUPS[o.group].label} · ${o.description}` })),
    initialValues: sel.frontend.options,
    required: false,
  }));
  sel.frontend.options = normalizeOptions(fw.id, options);
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

