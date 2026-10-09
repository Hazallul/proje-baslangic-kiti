import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { pushToRemote } from '../dist/core/generate/git.js';
import { repoWebUrl, setProjectKind, validate, withDefaults } from '../dist/core/selection.js';
import { planSteps } from '../dist/core/steps.js';
import { baseSelection } from './helpers.mjs';

const remote = (mode, extra = {}) => ({ mode, url: '', private: true, ...extra });

describe('uzak depo', () => {
  it('sadece yerel depoda push adımı yok, uzak depo seçilince git\'ten hemen sonra gelir', () => {
    assert.deepEqual(planSteps(baseSelection({ start: false })), ['backend', 'docker-files', 'git']);
    const github = baseSelection({ start: false, gitRemote: remote('github') });
    assert.deepEqual(planSteps(github), ['backend', 'docker-files', 'git', 'git-push']);
    const python = setProjectKind(baseSelection({ gitRemote: remote('url', { url: 'https://github.com/a/b.git' }) }), 'python');
    assert.deepEqual(planSteps(python), ['python-files', 'python-env', 'git', 'git-push']);
  });

  it('git kapalıyken uzak depo seçimi yok sayılır', () => {
    const sel = baseSelection({ start: false, git: false, gitRemote: remote('url') });
    assert.deepEqual(planSteps(sel), ['backend', 'docker-files']);
    assert.equal(validate(sel).length, 0);
  });

  it('adres seçeneğinde geçerli bir depo adresi ister', () => {
    const issue = (url) => validate(baseSelection({ gitRemote: remote('url', { url }) })).find((i) => i.field === 'remote');
    assert.ok(issue(''));
    assert.ok(issue('github.com/a/b'));
    assert.ok(issue('https://github.com/a/b.git" && del *'), 'kabuk karakterleri reddedilir');
    assert.ok(issue('https://github.com/a b/c'));
    assert.equal(issue('https://github.com/Hazallul/enerji-kasabasi.git'), undefined);
    assert.equal(issue('https://github.com/Hazallul/enerji-kasabasi'), undefined);
    assert.equal(issue('git@github.com:Hazallul/enerji-kasabasi.git'), undefined);
    assert.equal(issue('https://gitlab.com/grup/alt-grup/depo.git'), undefined);
  });

  it('GitHub adresinin web sayfasını bulur', () => {
    assert.equal(repoWebUrl('https://github.com/Hazallul/demo.git'), 'https://github.com/Hazallul/demo');
    assert.equal(repoWebUrl('git@github.com:Hazallul/demo.git'), 'https://github.com/Hazallul/demo');
    assert.equal(repoWebUrl('https://github.com/Hazallul/demo'), 'https://github.com/Hazallul/demo');
    assert.equal(repoWebUrl('https://gitlab.com/a/b.git'), null);
  });

  it('eski kayıtlarda uzak depo ayarı yoksa yerel sayılır', () => {
    const sel = withDefaults({ name: 'eski', git: true });
    assert.deepEqual(sel.gitRemote, { mode: 'local', url: '', private: true });
  });
});

describe('push', () => {
  const root = mkdtempSync(join(tmpdir(), 'cha-git-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cmd, cwd) => execSync(`git ${cmd}`, { cwd, stdio: 'pipe' }).toString();
  const project = (name) => {
    const dir = join(root, name);
    execSync(`git init -q -b main "${dir}"`);
    writeFileSync(join(dir, 'README.md'), name);
    git('add -A', dir);
    git('-c user.name=Test -c user.email=test@example.com commit -q -m ilk', dir);
    return dir;
  };

  it('boş depoya main dalını gönderir ve takip eder', async () => {
    const bare = join(root, 'bos.git');
    execSync(`git init -q --bare "${bare}"`);
    const dir = project('proje');
    const web = await pushToRemote(dir, bare, {});
    assert.equal(web, null, 'GitHub dışı adreste web adresi yok');
    assert.match(git('log --oneline main', bare), /ilk/);
    assert.equal(git('rev-parse --abbrev-ref main@{upstream}', dir).trim(), 'origin/main');
  });

  it('dolu depoda anlaşılır bir hata verir', async () => {
    const bare = join(root, 'dolu.git');
    execSync(`git init -q --bare "${bare}"`);
    await pushToRemote(project('ilki'), bare, {});
    await assert.rejects(pushToRemote(project('ikincisi'), bare, {}), /Uzak depo boş değil/);
  });
});
