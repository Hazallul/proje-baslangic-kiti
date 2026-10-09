// Her Python şablonunu gerçekten üretir, sanal ortamı kurar ve üretilen projede pytest, ruff check,
// ruff format --check ile şablona özel bir duman testi çalıştırır (oyun: pencere açmadan bir kare çizer,
// API: sunucuyu başlatıp istek atar, konsol: komutu çalıştırır). Python 3.10+ ve internet gerekir.
//
// Kullanım: npm run verify:python [-- game-all,api-all,...] [--exe] [--docker]
//   --exe     .exe paketlemeyi de dener (yavaş, sadece bilgisayarda)
//   --docker  kontrolleri .venv yerine python:3.13-slim container'ında çalıştırır. Windows Smart App
//             Control imzasız paket dosyalarını (pydantic-core, ruff) engelliyorsa bunu kullan.
// Çıktı: <geçici klasör>/create-hazal-app-verify-python/report.txt ve başarısız olanların logları
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateProject } from '../dist/core/generate/index.js';
import { venvPython } from '../dist/core/generate/python-files.js';
import { defaultSelection, setProjectKind, setPythonTemplate } from '../dist/core/selection.js';

const VARIANTS = {
  'game-all': ['game', ['ai', 'tests', 'lint', 'exe']],
  'game-min': ['game', []],
  'api-all': ['api', ['ai', 'tests', 'lint', 'docker']],
  'api-min': ['api', ['tests']],
  'cli-all': ['cli', ['ai', 'tests', 'lint', 'exe']],
  'cli-min': ['cli', []],
};

const args = process.argv.slice(2);
const withExe = args.includes('--exe');
const inDocker = args.includes('--docker');
const ids = args.find((a) => !a.startsWith('--'))?.split(',') ?? Object.keys(VARIANTS);
const base = join(tmpdir(), 'create-hazal-app-verify-python');
const report = join(base, 'report.txt');
mkdirSync(base, { recursive: true });
const windows = process.platform === 'win32';
let failed = 0;

/** Komutu çalıştırır; başarısızsa çıktısıyla hata fırlatır */
function sh(command, cwd, env = {}) {
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 600_000 });
  if (result.status !== 0) throw new Error(`"${command}" başarısız (${result.status})\n${result.stdout}${result.stderr}`);
  return result.stdout;
}

const SMOKE = {
  // Pencere açmadan (SDL dummy sürücüsü) simülasyonu ilerletip bir kare çizer ve ekran görüntüsü kaydeder
  game: (pkg) => `-c "import pygame; from ${pkg}.game import Game; g = Game(); [g.sim.update(1) for _ in range(400)]; g.draw(); pygame.image.save(g.window, 'smoke.png'); print('ok', g.sim.clock)"`,
  // Sunucuyu arka planda başlatmak yerine uygulamayı içeriden çağırır (TestClient) ve Swagger şemasını alır
  api: (pkg) => `-c "from fastapi.testclient import TestClient; from ${pkg}.main import app; c = TestClient(app); assert c.get('/api/hello').status_code == 200; assert c.get('/openapi.json').status_code == 200; assert c.get('/docs').status_code == 200; print('ok')"`,
  cli: (pkg) => `-m ${pkg} merhaba --ad Test`,
};

for (const id of ids) {
  const [template, options] = VARIANTS[id];
  const name = `py-${id}`;
  const projectDir = join(base, name);
  rmSync(projectDir, { recursive: true, force: true });
  let sel = setProjectKind({ ...defaultSelection(), name, location: base, git: false }, 'python');
  sel = setPythonTemplate(sel, template);
  sel.python.options = options;
  sel.python.install = !inDocker;
  const pkg = name.replace(/-/g, '_');
  const python = venvPython(windows);
  const log = [];
  let result = 'OK';
  try {
    const generated = await generateProject(sel, { onEvent: (e) => e.type === 'log' && log.push(e.text) });
    if (generated.warnings.length) throw new Error(`Uyarılar:\n${generated.warnings.join('\n')}`);
    const checks = [];
    if (options.includes('tests')) checks.push('-m pytest -q');
    if (options.includes('lint')) checks.push('-m ruff check .', '-m ruff format --check .');
    checks.push(SMOKE[template](pkg));
    if (inDocker) {
      // Proje salt okunur bağlanır ve container içinde kopyalanıp kurulur; bilgisayardaki klasör değişmez
      const requirements = existsSync(join(projectDir, 'requirements-dev.txt')) ? 'requirements-dev.txt' : 'requirements.txt';
      const script = join(base, `${id}.sh`);
      writeFileSync(script, [
        'set -e',
        'cp -r /src /app && cd /app',
        `pip install -q --root-user-action=ignore --disable-pip-version-check -r ${requirements}`,
        ...checks.map((c) => `python ${c}`),
      ].join('\n'));
      log.push(sh(`docker run --rm -e SDL_VIDEODRIVER=dummy -e SDL_AUDIODRIVER=dummy -v "${projectDir}:/src:ro" -v "${script}:/verify.sh:ro" python:3.13-slim sh /verify.sh`, base));
    } else {
      for (const check of checks) {
        log.push(sh(`${python} ${check}`, projectDir, { SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' }));
      }
    }
    if (withExe && options.includes('exe')) {
      log.push(sh(`${python} build_exe.py`, projectDir));
      const exe = join(projectDir, 'dist', windows ? `${name}.exe` : name);
      if (!existsSync(exe)) throw new Error(`${exe} oluşmadı`);
      if (template === 'cli') log.push(sh(`"${exe}" merhaba --ad Exe`, projectDir));
    }
  } catch (error) {
    result = 'FAIL';
    writeFileSync(join(base, `${id}.log`), `${log.join('')}\n${error.message}`);
  }
  if (result !== 'OK') failed++;
  const line = `${id} ${template} [${options.join(', ')}] ${result}`;
  appendFileSync(report, `${line}\n`);
  console.log(line);
}

console.log(`\nRapor: ${report}`);
process.exit(failed ? 1 : 0);
