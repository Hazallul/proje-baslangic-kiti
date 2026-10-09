import type { InitializrCatalog } from '../../core/initializr';
import type { GenerateEvent, StepId } from '../../core/types';
import type { AppApi, Settings } from '../../shared/bridge';
import snapshot from '../../core/data/initializr-snapshot.json';
import { pythonCommands, pythonContext } from '../../core/generate/python-files';
import { isPython, resolve } from '../../core/selection';
import { planSteps } from '../../core/steps';
import { previewPorts } from './tree';

/**
 * Sadece tarayıcıda tasarım önizlemesi için: Electron olmadan arayüzün tüm durumlarını
 * gezebilmek amacıyla gerçek API'yi taklit eder. Uygulamanın kendisinde kullanılmaz.
 */
export function createMockApi(): AppApi {
  const listeners = new Set<(e: GenerateEvent) => void>();
  let settings: Settings = { lastSelection: null, templates: [], theme: 'system' };
  let cancelled = false;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const emit = (e: GenerateEvent) => listeners.forEach((l) => l(e));
  const fail = new URLSearchParams(location.search).get('fail');

  return {
    loadCatalog: async () => {
      const raw = snapshot as unknown as {
        bootVersion: { default: string };
        dependencies: { values: { name: string; values: { id: string; name: string; description?: string }[] }[] };
      };
      const catalog: InitializrCatalog = {
        bootVersion: raw.bootVersion.default,
        javaVersions: ['17', '21', '25'],
        groups: raw.dependencies.values.map((g) => ({
          name: g.name,
          dependencies: g.values.map((d) => ({ id: d.id, name: d.name, description: d.description ?? '' })),
        })),
        source: 'snapshot',
      };
      return catalog;
    },
    loadSettings: async () => settings,
    saveSettings: async (s) => {
      settings = s;
    },
    defaultLocation: async () => 'C:\\Users\\Hazallul\\Projects',
    pickFolder: async () => 'C:\\Users\\Hazallul\\Desktop',
    checkTarget: async (sel) => ({
      folderTaken: sel.name === 'devhub',
      dockerConflict: sel.name === 'eski-proje' ? `Docker'da "eski-proje" adlı eski bir projeden kalan veri var.` : null,
    }),
    previewPorts: async (sel) => {
      const taken = new Set([3306, 5173]);
      const ports = previewPorts(resolve(sel)).map((p) => {
        let port = p.port;
        while (taken.has(port)) port++;
        taken.add(port);
        return { envName: p.envName, label: p.label, port, preferred: p.port };
      });
      return ports;
    },
    toolStatus: async () => ({
      docker: !new URLSearchParams(location.search).has('nodocker'),
      node: true,
      git: true,
      gitIdentity: !new URLSearchParams(location.search).has('nogitid'),
      python: new URLSearchParams(location.search).has('nopython') ? null : '3.13.15',
      github: new URLSearchParams(location.search).has('nogithub') ? null : 'Hazallul',
    }),
    generate: async (sel) => {
      cancelled = false;
      const messages: Partial<Record<StepId, string>> = {
        git: 'İlk commit atıldı',
        'git-push': 'main dalı gönderildi',
        'python-files': '23 dosya',
        'python-env': 'Python 3.13.15, paketler kuruldu, 5 test geçti',
      };
      for (const step of planSteps(sel)) {
        if (cancelled) return { ok: false, cancelled: true, message: 'İşlem iptal edildi' };
        emit({ type: 'step', step, status: 'running' });
        for (let i = 0; i < 6; i++) {
          emit({ type: 'log', text: `[${step}] adım ${i + 1}/6 tamamlandı\n` });
          await wait(step === 'docker-build' || step === 'python-env' ? 500 : 200);
        }
        if (fail === step) {
          emit({ type: 'step', step, status: 'error', message: '"docker compose build" başarısız oldu (çıkış kodu 1)' });
          return { ok: false, cancelled: false, message: '"docker compose build" başarısız oldu (çıkış kodu 1)' };
        }
        if (step === 'docker-files') emit({ type: 'info', message: '3306 kullanımda, MySQL için 3307 seçildi' });
        emit({ type: 'step', step, status: 'done', message: messages[step] });
      }
      const dir = `${sel.location}\\${sel.name}`;
      if (isPython(sel)) {
        const commands = pythonCommands(pythonContext(sel, true));
        const repoUrl = sel.git && sel.gitRemote.mode !== 'local' ? `https://github.com/Hazallul/${sel.name}` : undefined;
        return { ok: true, result: { projectDir: dir, ports: [], started: false, warnings: [], credentials: [], commands, repoUrl }, links: [] };
      }
      return {
        ok: true,
        result: {
          projectDir: dir,
          ports: [],
          started: true,
          warnings: [],
          credentials: [
            { key: 'DB_USER', value: 'app' },
            { key: 'DB_PASSWORD', value: 'k3Jd8sPq2mXz7RtLw9aB' },
            { key: 'APP_USER', value: 'admin' },
            { key: 'APP_PASSWORD', value: 'Vn4hT8cQ2wZp6KmRs3yE' },
          ],
        },
        links: [
          ...(sel.frontend.framework ? [{ label: 'Uygulama', url: 'http://localhost:5173' }] : []),
          { label: 'Backend API', url: 'http://localhost:8080/api/hello' },
          { label: 'Swagger UI', url: 'http://localhost:8080/swagger-ui.html' },
          { label: 'Adminer', url: 'http://localhost:8090' },
        ],
      };
    },
    startProject: async (sel) => {
      for (const step of ['docker-build', 'services'] as StepId[]) {
        emit({ type: 'step', step, status: 'running' });
        await wait(800);
        emit({ type: 'step', step, status: 'done' });
      }
      return {
        ok: true,
        result: { projectDir: `${sel.location}\\${sel.name}`, ports: [], started: true, warnings: [], credentials: [] },
        links: [{ label: 'Backend API', url: 'http://localhost:8080/api/hello' }],
      };
    },
    cancelGenerate: async () => {
      cancelled = true;
    },
    onGenerateEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    openUrl: async (url) => {
      window.open(url, '_blank');
    },
    openFolder: async () => {},
    openInEditor: async () => true,
    startWatch: async () => {},
    setTheme: async () => {},
  };
}
