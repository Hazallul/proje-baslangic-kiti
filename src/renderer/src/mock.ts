import type { InitializrCatalog } from '../../core/initializr';
import type { GenerateEvent, StepId } from '../../core/types';
import type { AppApi, Settings } from '../../shared/bridge';
import snapshot from '../../core/data/initializr-snapshot.json';

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
    isTargetFree: async (sel) => sel.name !== 'devhub',
    toolStatus: async () => ({ docker: !new URLSearchParams(location.search).has('nodocker'), node: true, git: true }),
    generate: async (sel) => {
      cancelled = false;
      const steps: StepId[] = ['backend', 'frontend', 'docker-files', 'git', 'docker-build', 'services'];
      for (const step of steps) {
        if (cancelled) return { ok: false, cancelled: true, message: 'İşlem iptal edildi' };
        if (step === 'frontend' && !sel.frontend.framework) {
          emit({ type: 'step', step, status: 'skipped', message: 'Frontend seçilmedi' });
          continue;
        }
        emit({ type: 'step', step, status: 'running' });
        for (let i = 0; i < 6; i++) {
          emit({ type: 'log', text: `[${step}] adım ${i + 1}/6 tamamlandı\n` });
          await wait(step === 'docker-build' ? 500 : 200);
        }
        if (fail === step) {
          emit({ type: 'step', step, status: 'error', message: '"docker compose build" başarısız oldu (çıkış kodu 1)' });
          return { ok: false, cancelled: false, message: '"docker compose build" başarısız oldu (çıkış kodu 1)' };
        }
        if (step === 'docker-files') emit({ type: 'info', message: '3306 kullanımda, MySQL için 3307 seçildi' });
        emit({ type: 'step', step, status: 'done', message: step === 'git' ? 'İlk commit atıldı' : undefined });
      }
      const dir = `${sel.location}\\${sel.name}`;
      return {
        ok: true,
        result: { projectDir: dir, ports: [], started: true, warnings: [] },
        links: [
          ...(sel.frontend.framework ? [{ label: 'Uygulama', url: 'http://localhost:5173' }] : []),
          { label: 'Backend API', url: 'http://localhost:8080/api/hello' },
          { label: 'Swagger UI', url: 'http://localhost:8080/swagger-ui.html' },
          { label: 'Adminer', url: 'http://localhost:8090' },
        ],
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
