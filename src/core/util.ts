import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { dirname, join } from 'node:path';

/** Dosyaları { "göreli/yol": "içerik" } şeklinde yazar, klasörleri gerekirse oluşturur. */
export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

export interface RunOptions {
  cwd: string;
  /** Her çıktı satırı için çağrılır (canlı log) */
  onOutput?: (text: string) => void;
  signal?: AbortSignal;
  env?: Record<string, string>;
}

export class CancelledError extends Error {
  constructor() {
    super('İşlem iptal edildi');
  }
}

/** Bir kabuk komutu çalıştırır. Başarısız olursa çıktısıyla birlikte hata fırlatır. */
export function run(command: string, { cwd, onOutput, signal, env }: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CancelledError());

    // stdin kapalı: komutlar etkileşimsiz çalışır, soru sorarlarsa takılmak yerine hata verir
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    let output = '';
    const onData = (d: Buffer) => {
      const text = d.toString();
      output += text;
      onOutput?.(text);
    };
    child.stdout.on('data', onData).on('error', reject);
    child.stderr.on('data', onData).on('error', reject);

    const onAbort = () => killTree(child.pid);
    signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', reject);
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return reject(new CancelledError());
      if (code === 0) resolve(output);
      else reject(new Error(`"${command}" başarısız oldu (çıkış kodu ${code})\n${output.slice(-4000)}`));
    });
  });
}

/** Windows'ta shell'in altındaki npm/docker süreçlerini de sonlandırır. */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      process.kill(pid, 'SIGTERM');
    }
  }
}

export async function commandSucceeds(command: string, cwd: string): Promise<boolean> {
  try {
    await run(command, { cwd });
    return true;
  } catch {
    return false;
  }
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
}

/**
 * Windows'ta Docker portları paylaşımlı dinlediği için sadece listen denemesi yetmez,
 * bağlanmayı da deneriz.
 */
async function isPortFree(port: number): Promise<boolean> {
  return !(await canConnect(port)) && (await canListen(port));
}

/** Çalışan Docker container'larının bilgisayarda açtığı portlar (Docker yoksa boş küme) */
export async function dockerPublishedPorts(): Promise<Set<number>> {
  try {
    const output = await run('docker ps --format "{{.Ports}}"', { cwd: process.cwd() });
    return new Set([...output.matchAll(/:(\d+)->/g)].map((m) => Number(m[1])));
  } catch {
    return new Set();
  }
}

/** İstenen porttan başlayarak boştaki ilk portu bulur, `taken` kümesine ekler. */
export async function findFreePort(preferred: number, taken: Set<number>): Promise<number> {
  for (let port = preferred; port < preferred + 100; port++) {
    if (!taken.has(port) && (await isPortFree(port))) {
      taken.add(port);
      return port;
    }
  }
  throw new Error(`${preferred} civarında boş port bulunamadı`);
}

export function randomPassword(length = 20): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(length), (b) => chars[b % chars.length]).join('');
}

/** URL cevap verene kadar bekler. Süre dolarsa false döner. */
export async function waitForUrl(url: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new CancelledError();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      // henüz ayakta değil
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export function packageNameOf(groupId: string, name: string): string {
  return `${groupId}.${name.replace(/[^a-z0-9]/g, '')}`;
}
