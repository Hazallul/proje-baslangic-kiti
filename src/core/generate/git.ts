import { spawn } from 'node:child_process';
import { repoWebUrl } from '../selection.js';
import { run } from '../util.js';

/**
 * Bilgisayarda kayıtlı GitHub girişi (Windows'ta Git Credential Manager, macOS'ta Anahtar Zinciri).
 * Terminalde bir kez `git push` ile giriş yapılmışsa buradan okunur; yeni bir hesap ya da token
 * istenmez. Giriş yoksa pencere açmadan null döner.
 */
async function githubCredential(): Promise<{ username: string; token: string } | null> {
  return new Promise((resolve) => {
    const child = spawn('git', ['credential', 'fill'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      // Kayıtlı giriş yoksa giriş penceresi açmasın ya da terminalden sormasın
      env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
    });
    const timer = setTimeout(() => child.kill(), 15_000);
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      clearTimeout(timer);
      const fields = Object.fromEntries(output.split(/\r?\n/).map((l) => l.split('=')).filter((kv) => kv.length >= 2)
        .map(([k, ...v]) => [k, v.join('=')]));
      resolve(code === 0 && fields.username && fields.password ? { username: fields.username, token: fields.password } : null);
    });
    child.stdin.end('protocol=https\nhost=github.com\n\n');
  });
}

/** Kayıtlı GitHub kullanıcı adı (giriş yoksa null). Token dışarı verilmez. */
export async function githubAccount(): Promise<string | null> {
  return (await githubCredential())?.username ?? null;
}

/** GitHub'da boş bir depo açar ve gönderilecek adresi döner. */
export async function createGithubRepo(name: string, isPrivate: boolean, signal?: AbortSignal): Promise<string> {
  const credential = await githubCredential();
  if (!credential) {
    throw new Error('Bu bilgisayarda kayıtlı bir GitHub girişi bulunamadı. Terminalde herhangi bir depoya bir kez git push yapınca giriş kaydedilir.');
  }
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${credential.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'create-hazal-app',
    },
    body: JSON.stringify({ name, private: isPrivate, auto_init: false }),
  });
  if (res.ok) return ((await res.json()) as { clone_url: string }).clone_url;

  const body = (await res.json().catch(() => ({}))) as { message?: string; errors?: { message?: string }[] };
  const detail = [body.message, ...(body.errors ?? []).map((e) => e.message)].filter(Boolean).join(': ');
  if (res.status === 401) throw new Error('GitHub girişinin süresi dolmuş. Terminalde bir kez git push yapıp tekrar giriş yap.');
  if (res.status === 403 || res.status === 404) {
    throw new Error(`Kayıtlı GitHub girişinin depo açma izni yok (${detail || res.status}). Depoyu GitHub'da kendin açıp adresini yapıştırabilirsin.`);
  }
  if (res.status === 422 && /already exists/i.test(detail)) {
    throw new Error(`GitHub hesabında "${name}" adlı bir depo zaten var. Başka bir proje adı seç ya da o depoyu adresiyle kullan.`);
  }
  throw new Error(`GitHub depoyu açmadı: ${detail || res.status}`);
}

/** origin'i ekler ve main dalını gönderir. Giriş, terminaldeki git'in kayıtlı girişidir. */
export async function pushToRemote(projectDir: string, url: string, opts: { signal?: AbortSignal; log?: (text: string) => void }) {
  await run(`git remote add origin "${url}"`, { cwd: projectDir });
  try {
    await run('git push -u origin main', { cwd: projectDir, signal: opts.signal, onOutput: opts.log, env: { GIT_TERMINAL_PROMPT: '0' } });
  } catch (error) {
    const output = error instanceof Error ? error.message : String(error);
    if (/rejected|fetch first|non-fast-forward/i.test(output)) {
      throw new Error('Uzak depo boş değil (README ya da lisansla oluşturulmuş). GitHub\'da depoyu hiçbir dosya eklemeden aç, '
        + 'ya da proje klasöründe: git pull --rebase origin main, sonra git push -u origin main');
    }
    if (/not found|does not exist/i.test(output)) throw new Error('Depo bulunamadı ya da erişimin yok; adresi kontrol et.');
    if (/Authentication failed|could not read Username|Permission denied|403/i.test(output)) {
      throw new Error('Git bu depoya giriş yapamadı. Terminalde bir kez git push yapıp giriş yap, sonra proje klasöründe: git push -u origin main');
    }
    throw error;
  }
  return repoWebUrl(url);
}
