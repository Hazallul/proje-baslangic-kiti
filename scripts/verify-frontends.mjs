// Her framework + UI kütüphanesi kombinasyonu için frontend'i gerçekten üretir ve Docker içinde
// "npm run build" (seçiliyse Vitest ve ESLint de) çalıştırır. Docker ve internet gerekir; birkaç dakika sürer.
//
// Üçüncü alan false ise proje backend'siz (sadece frontend) üretilir.
//
// Kullanım: npm run verify:frontends [-- r1,v3,...]   (varsayılan: hepsi)
// Çıktı: <geçici klasör>/create-hazal-app-verify/report.txt ve başarısız olanların logları
import { execSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultSelection, resolve } from '../dist/core/selection.js';
import { generateFrontend } from '../dist/core/generate/frontend.js';

const VARIANTS = {
  r1: ['react', ['vitest', 'eslint']],
  r2: ['react', ['tailwind', 'axios', 'react-router']],
  r3: ['react', ['tailwind', 'shadcn', 'vitest', 'eslint', 'prettier']],
  r4: ['react', ['mui', 'axios', 'vitest']],
  r5: ['react', ['antd', 'vitest', 'eslint']],
  r6: ['react', ['mantine', 'vitest', 'zustand']],
  v1: ['vue', ['vitest', 'vue-router']],
  v2: ['vue', ['tailwind', 'axios']],
  v3: ['vue', ['vuetify', 'vitest', 'pinia']],
  v4: ['vue', ['primevue', 'vitest']],
  v5: ['vue', ['element-plus', 'axios', 'prettier']],
  a1: ['angular', []],
  a2: ['angular', ['tailwind', 'angular-material']],
  a3: ['angular', ['primeng']],
  s1: ['svelte', ['vitest', 'axios']],
  s2: ['svelte', ['tailwind']],
  // Backend'li projede çoklu dil ve animasyon
  r7: ['react', ['motion', 'i18n', 'vitest', 'eslint']],
  v6: ['vue', ['primevue', 'i18n', 'vitest']],
  // Sadece frontend (backend yok): portfolyo gibi siteler
  f1: ['react', ['tailwind', 'motion', 'i18n', 'vitest', 'eslint', 'vercel'], false],
  f2: ['react', ['tailwind', 'shadcn', 'motion', 'i18n', 'react-router', 'vitest', 'eslint'], false],
  f3: ['react', ['mui', 'motion', 'i18n', 'axios', 'vitest'], false],
  f4: ['vue', ['vuetify', 'i18n', 'vitest', 'vercel'], false],
  f5: ['vue', ['tailwind', 'i18n', 'vue-router', 'vitest'], false],
  f6: ['angular', ['vercel'], false],
  f7: ['svelte', ['vitest'], false],
};

const ids = process.argv[2] ? process.argv[2].split(',') : Object.keys(VARIANTS);
const base = join(tmpdir(), 'create-hazal-app-verify');
const report = join(base, 'report.txt');
mkdirSync(base, { recursive: true });
let failed = 0;

for (const id of ids) {
  const [framework, options, backend = true] = VARIANTS[id];
  const name = `fe-${id}`;
  const projectDir = join(base, name);
  rmSync(projectDir, { recursive: true, force: true });
  mkdirSync(projectDir, { recursive: true });
  const defaults = defaultSelection();
  const sel = { ...defaults, name, location: base, backend: { ...defaults.backend, enabled: backend }, frontend: { framework, options } };
  const log = [];
  let result = 'OK';
  try {
    await generateFrontend(resolve(sel), projectDir, { log: (text) => log.push(text) });
    const tag = `verify-${name}`;
    execSync(`docker build -q -t ${tag} .`, { cwd: join(projectDir, 'frontend'), stdio: 'pipe' });
    const commands = ['npm run build'];
    if (options.includes('vitest')) commands.push('npx vitest run');
    if (options.includes('eslint')) commands.push('npm run lint');
    // vercel.json'daki çıktı klasöründe derlenmiş site olmalı
    if (options.includes('vercel')) {
      const vercel = JSON.parse(readFileSync(join(projectDir, 'vercel.json'), 'utf8'));
      commands.push(`test -f ${vercel.outputDirectory.replace('frontend/', '')}/index.html`);
    }
    const run = spawnSync('docker', ['run', '--rm', tag, 'sh', '-c', commands.join(' && ')], { encoding: 'utf8' });
    if (run.status !== 0) {
      result = 'FAIL';
      writeFileSync(join(base, `${id}.log`), (run.stdout ?? '') + (run.stderr ?? ''));
    }
    execSync(`docker rmi -f ${tag}`, { stdio: 'ignore' });
  } catch (error) {
    result = 'ERROR';
    writeFileSync(join(base, `${id}.log`), `${log.join('')}\n${error.stdout ?? ''}${error.stderr ?? ''}${error.message}`);
  }
  if (result !== 'OK') failed++;
  const line = `${id} ${framework}${backend ? '' : ' (sadece frontend)'} [${options.join(', ')}] ${result}`;
  appendFileSync(report, `${line}\n`);
  console.log(line);
}

console.log(`\nRapor: ${report}`);
process.exit(failed ? 1 : 0);
