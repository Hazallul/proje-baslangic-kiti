import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignPorts } from '../dist/core/generate/compose.js';
import {
  devRequirements, pythonCommands, pythonContext, pythonFiles, runtimeRequirements, venvPython,
} from '../dist/core/generate/python-files.js';
import {
  applyPreset, hasBackend, isPython, projectKindOf, pythonOptionsOf, resolve, setProjectKind, setPythonTemplate,
  togglePythonOption, validate, withDefaults,
} from '../dist/core/selection.js';
import { planSteps } from '../dist/core/steps.js';
import { baseSelection, withFrontend } from './helpers.mjs';

function python(template = 'game', options) {
  let sel = setPythonTemplate(setProjectKind(baseSelection({ name: 'enerji-kasabasi' }), 'python'), template);
  if (options) sel = { ...sel, python: { ...sel.python, options } };
  return sel;
}

const filesOf = (sel, windows = true) => pythonFiles(pythonContext(sel, windows));

describe('Python proje türü', () => {
  it('türe geçince Spring tarafı devre dışı kalır ama seçimleri silinmez', () => {
    const spring = withFrontend(baseSelection(), 'react', ['tailwind']);
    const sel = setProjectKind(spring, 'python');
    assert.equal(isPython(sel), true);
    assert.equal(hasBackend(sel), false);
    assert.equal(projectKindOf(sel), 'python');
    assert.deepEqual(setProjectKind(sel, 'fullstack').frontend, spring.frontend);
  });

  it('Python projesinde Spring paketleri, veritabanı ve frontend çözülmez', () => {
    const resolved = resolve(setProjectKind(withFrontend(baseSelection(), 'react', ['tailwind']), 'python'));
    assert.deepEqual(resolved.dependencies, []);
    assert.deepEqual(resolved.services, []);
    assert.deepEqual(resolved.frontendOptions, []);
  });

  it('Python projesi port ayırmaz (Docker Compose yok)', async () => {
    assert.deepEqual(await assignPorts(resolve(setProjectKind(withFrontend(baseSelection(), 'react'), 'python'))), []);
  });

  it('eski kayıtlarda python alanı yoksa varsayılanla tamamlanır', () => {
    const saved = baseSelection();
    delete saved.python;
    delete saved.stack;
    const sel = withDefaults(saved);
    assert.equal(sel.python.template, 'game');
    assert.equal(isPython(sel), false);
  });
});

describe('Python şablon ve seçenekleri', () => {
  it('şablon değişince ortak seçenekler korunur, yeni şablonun varsayılanı eklenir', () => {
    const sel = setPythonTemplate(python('api', ['ai', 'tests', 'docker']), 'cli');
    assert.deepEqual(sel.python.options.sort(), ['ai', 'exe', 'tests']);
  });

  it('şablonda olmayan seçenek açılamaz ve hesaba katılmaz', () => {
    const sel = python('game', ['tests', 'docker']);
    assert.deepEqual([...pythonOptionsOf(sel)], ['tests']);
    assert.deepEqual(togglePythonOption(sel, 'docker'), sel);
  });

  it('seçenek açılıp kapanır', () => {
    const on = togglePythonOption(python('game', []), 'ai');
    assert.deepEqual(on.python.options, ['ai']);
    assert.deepEqual(togglePythonOption(on, 'ai').python.options, []);
  });
});

describe('Python adı', () => {
  it('Python modülüyle ya da ayrılmış kelimeyle çakışan ad reddedilir', () => {
    for (const name of ['pygame', 'random', 'test', 'class', 'fast-api'.replace('-', '')]) {
      const issues = validate({ ...python(), name });
      assert.equal(issues[0]?.field, 'name', `"${name}" reddedilmeli`);
    }
  });

  it('Java anahtar kelimesi Python projesinde sorun değil, Spring projesinde sorun', () => {
    assert.deepEqual(validate({ ...python(), name: 'new' }), []);
    assert.equal(validate(baseSelection({ name: 'new' }))[0]?.field, 'name');
  });
});

describe('adım planı', () => {
  it('Python projesinde Docker adımları yok', () => {
    assert.deepEqual(planSteps(python()), ['python-files', 'python-env', 'git']);
    assert.deepEqual(planSteps({ ...python(), git: false, python: { ...python().python, install: false } }), ['python-files']);
  });

  it('Spring projesinde sadece seçime uyan adımlar var', () => {
    assert.deepEqual(planSteps(baseSelection()), ['backend', 'docker-files', 'git', 'docker-build', 'services']);
    const site = setProjectKind(baseSelection({ start: false, git: false }), 'frontend');
    assert.deepEqual(planSteps(site), ['frontend', 'docker-files']);
  });
});

describe('Python dosyaları', () => {
  it('oyun şablonu simülasyonu pygame\'den ayrı dosyalarda üretir', () => {
    const files = filesOf(python('game', ['tests']));
    for (const path of ['world.py', 'agent.py', 'simulation.py', 'game.py', 'sprites.py', '__main__.py']) {
      assert.ok(files[`enerji_kasabasi/${path}`], path);
    }
    assert.ok(!files['enerji_kasabasi/simulation.py'].includes('import pygame'), 'simülasyon pygame\'e bağımlı olmamalı');
    assert.ok(files['tests/test_simulation.py']);
  });

  it('paket adı tireden arındırılır ve importlarda kullanılır', () => {
    const files = filesOf(python('cli', ['tests']));
    assert.match(files['enerji_kasabasi/__main__.py'], /from enerji_kasabasi\.cli import main/);
    assert.match(files['tests/test_cli.py'], /from enerji_kasabasi\.cli import main/);
  });

  it('AI seçeneği .env (git dışı), .env.example ve Claude modülünü ekler', () => {
    const files = filesOf(python('game', ['ai']));
    assert.match(files['.gitignore'], /^\.env$/m);
    assert.match(files['.env.example'], /ANTHROPIC_API_KEY=\n/);
    assert.match(files['enerji_kasabasi/ai.py'], /claude-opus-5-5/);
    assert.ok(files['enerji_kasabasi/brain.py'], 'oyunda karakter düşünmesi gelmeli');
    assert.ok(runtimeRequirements(pythonContext(python('game', ['ai']), true)).some((r) => r.startsWith('anthropic')));
  });

  it('AI seçilmezse anahtar dosyası ve SDK gelmez', () => {
    const files = filesOf(python('game', []));
    assert.equal(files['.env'], undefined);
    assert.equal(files['enerji_kasabasi/ai.py'], undefined);
    assert.ok(!files['enerji_kasabasi/game.py'].includes('brain'));
  });

  it('geliştirme araçları ayrı requirements dosyasında, yoksa dosya da yok', () => {
    const ctx = pythonContext(python('api', ['tests', 'lint']), true);
    assert.deepEqual(devRequirements(ctx).map((r) => r.split('>=')[0]), ['pytest', 'httpx', 'ruff']);
    assert.match(pythonFiles(ctx)['requirements-dev.txt'], /^-r requirements\.txt$/m);
    assert.equal(filesOf(python('cli', []))['requirements-dev.txt'], undefined);
    assert.equal(filesOf(python('cli', []))['pyproject.toml'], undefined);
  });

  it('Dockerfile sadece API şablonunda ve seçilince', () => {
    assert.ok(filesOf(python('api', ['docker']))['Dockerfile']);
    assert.equal(filesOf(python('api', []))['Dockerfile'], undefined);
    assert.equal(filesOf(python('game', ['docker']))['Dockerfile'], undefined);
  });

  it('exe paketleme modül yollarını bulsun diye proje klasörünü arama yoluna ekler', () => {
    const build = filesOf(python('game', ['exe']))['build_exe.py'];
    assert.match(build, /--paths=\./);
    assert.match(build, /--windowed/);
    assert.match(filesOf(python('cli', ['exe']))['build_exe.py'], /--console/);
  });

  it('VS Code sanal ortamı ve F5 çalıştırmayı tanır, yol işletim sistemine göre', () => {
    const win = JSON.parse(filesOf(python('game'), true)['.vscode/settings.json']);
    const unix = JSON.parse(filesOf(python('game'), false)['.vscode/settings.json']);
    assert.match(win['python.defaultInterpreterPath'], /\.venv\\Scripts\\python\.exe$/);
    assert.match(unix['python.defaultInterpreterPath'], /\.venv\/bin\/python$/);
    const launch = JSON.parse(filesOf(python('game'))['.vscode/launch.json']);
    assert.equal(launch.configurations[0].module, 'enerji_kasabasi');
  });

  it('Python kaynaklarında kaçış dizileri bozulmaz (\\n Python\'a aynen geçer)', () => {
    const files = filesOf(python('game', ['ai', 'tests', 'lint', 'exe']));
    for (const [path, content] of Object.entries(files)) {
      if (!path.endsWith('.py')) continue;
      assert.ok(!content.includes('\r'), `${path} CR içermemeli`);
      assert.ok(!/\$\{/.test(content), `${path} doldurulmamış şablon içermemeli`);
    }
  });
});

describe('Python komutları', () => {
  it('seçeneklere göre çalıştırma, test, lint ve exe komutları', () => {
    const ctx = pythonContext(python('cli', ['tests', 'lint', 'exe']), true);
    const labels = pythonCommands(ctx).map((c) => c.label);
    assert.deepEqual(labels, ['Programı çalıştır', 'Testler', 'Lint', '.exe üret']);
    assert.ok(pythonCommands(ctx).every((c) => c.command.startsWith(venvPython(true))));
  });

  it('şablon uygulamak Python projesini Spring\'e çevirir (açık tercih)', () => {
    assert.equal(projectKindOf(applyPreset(python(), 'rest-api')), 'backend');
  });
});
