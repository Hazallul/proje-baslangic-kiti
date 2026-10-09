import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InitializrCatalog } from '../../core/initializr';
import { findFramework } from '../../core/catalog/frontend';
import { findPythonTemplate } from '../../core/catalog/python';
import {
  applyPreset, defaultSelection, hasBackend, isPython, projectKindOf, pythonOptionsOf, resolve, setProjectKind, validate,
  withDefaults,
} from '../../core/selection';
import { planSteps, STEP_LABELS } from '../../core/steps';
import type { GenerateEvent, GenerateResult, ProjectKind, PythonTemplate, Selection, StepId } from '../../core/types';
import type { GenerateOutcome, SavedTemplate, Settings, TargetCheck, ToolStatus } from '../../shared/bridge';
import { api } from './api';
import { findKit } from './kits';
import { TitleBar } from './TitleBar';
import { Button, inputClass, Kbd } from './ui';
import { ConfigView } from './views/ConfigView';
import { DoneView } from './views/DoneView';
import { PreviewPane } from './views/PreviewPane';
import { initialProgress, type ProgressState, ProgressView, type StepStatus } from './views/ProgressView';
import { WelcomeView } from './views/WelcomeView';

type View = 'welcome' | 'config' | 'progress' | 'done';
const LOG_LIMIT = 300_000;

/** Kayıtlı seçimi bugünkü yapıyla birleştirir; konumu yoksa varsayılan klasörü kullanır */
function restore(saved: Partial<Selection> | null, location: string): Selection {
  const sel = withDefaults(saved);
  // Ad ve depo adresi o projeye özeldi: ayarlar kalır, yeni projenin adı boş başlar (alanda şakalı bir
  // örnek görünür) ve yeni proje eski depoya gönderilmez
  return { ...sel, name: '', location: sel.location || location, gitRemote: { ...sel.gitRemote, url: '' } };
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App() {
  const [catalog, setCatalog] = useState<InitializrCatalog | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tools, setTools] = useState<ToolStatus | null>(null);
  const [defaultLocation, setDefaultLocation] = useState('');
  const [sel, setSel] = useState<Selection>(() => ({ ...defaultSelection(), name: '' }));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [view, setView] = useState<View>('welcome');
  const [progress, setProgress] = useState<ProgressState>(() => initialProgress([]));
  const [done, setDone] = useState<{ result: GenerateResult; links: { label: string; url: string }[] } | null>(null);
  const [target, setTarget] = useState<TargetCheck>({ folderTaken: false, dockerConflict: null });
  const [livePorts, setLivePorts] = useState<Record<string, number> | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const projectDirRef = useRef('');
  const busyRef = useRef(false);

  // İlk açılış: katalog, ayarlar ve araç durumu
  useEffect(() => {
    void api.loadCatalog().then(setCatalog);
    void api.toolStatus().then(setTools);
    void Promise.all([api.loadSettings(), api.defaultLocation()]).then(([s, location]) => {
      setSettings(s);
      setDefaultLocation(location);
      setSel(restore(s.lastSelection, location));
    });
  }, []);

  const theme = !settings || settings.theme === 'system' ? systemTheme() : settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    void api.setTheme(theme);
  }, [theme]);

  // Seçim renkleri açık olan kitin rengini alır (açılış ekranında kit yok)
  const kind = projectKindOf(sel);
  useEffect(() => {
    if (view === 'welcome') delete document.documentElement.dataset.kit;
    else document.documentElement.dataset.kit = kind;
  }, [kind, view]);

  const saveSettings = useCallback((next: Settings) => {
    setSettings(next);
    void api.saveSettings(next);
  }, []);

  const update = useCallback((fn: (s: Selection) => Selection) => {
    setSel((s) => fn(s));
    setActivePreset(null);
  }, []);

  const resolved = useMemo(() => resolve(sel), [sel]);
  const issues = useMemo(() => validate(sel), [sel]);
  const nameValid = !issues.some((i) => i.field === 'name');

  // Aynı adla dolu bir klasör ya da Docker projesi var mı? (yazmayı bırakınca kontrol et)
  useEffect(() => {
    // Önceki adın sonucu yeni adın altında kalmasın (oluştururken zaten tekrar kontrol edilir)
    setTarget({ folderTaken: false, dockerConflict: null });
    if (!sel.location || !nameValid) return;
    let stale = false;
    const timer = setTimeout(() => void api.checkTarget(sel).then((t) => !stale && setTarget(t)), 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.name, sel.location, sel.stack, nameValid]);

  // Önizlemede gerçekte kullanılacak portları göster (3306 doluysa 3307 gibi)
  const portKey = JSON.stringify([kind, sel.frontend.framework, resolved.databases, resolved.services]);
  useEffect(() => {
    if (view !== 'config') return;
    let stale = false;
    const timer = setTimeout(() => {
      void api.previewPorts(sel)
        .then((ports) => !stale && setLivePorts(Object.fromEntries(ports.map((p) => [p.envName, p.port]))))
        .catch(() => !stale && setLivePorts(null));
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portKey, view]);

  const targetIssue = target.folderTaken
    ? `"${sel.name}" klasörü bu konumda zaten var ve boş değil`
    : target.dockerConflict;

  // Henüz doldurulmamış alan hata değil, yapılacak iş: altbilgide kırmızı yerine nötr görünür
  const pendingInput = issues[0]?.field === 'name' && !sel.name ? 'Başlamak için projeye bir ad ver'
    : issues[0]?.field === 'remote' && !sel.gitRemote.url.trim() ? 'Gönderilecek deponun adresini yapıştır'
      : null;
  const blocking = issues[0]?.message
    ?? (targetIssue ? 'Bu ad kullanılıyor, başka bir ad seç' : null)
    ?? (tools && !tools.node && !isPython(sel) && sel.frontend.framework ? 'Frontend için Node.js gerekli (npm bulunamadı)' : null);

  // -------------------------------------------------------------------------

  const handleEvent = useCallback((event: GenerateEvent) => {
    setProgress((p) => {
      if (event.type === 'log') {
        const log = p.log + event.text;
        return { ...p, log: log.length > LOG_LIMIT ? log.slice(-LOG_LIMIT) : log };
      }
      if (event.type === 'info') return { ...p, infos: [...p.infos, event.message] };
      const prev = p.steps[event.step] ?? { status: 'pending' };
      const now = Date.now();
      const next = {
        status: event.status,
        message: event.message,
        startedAt: event.status === 'running' ? now : prev.startedAt,
        endedAt: event.status === 'running' ? undefined : now,
      };
      return { ...p, steps: { ...p.steps, [event.step]: next } };
    });
  }, []);

  /** Oluşturma veya yeniden başlatma: ilerlemeyi dinler, sonuca göre bitiş ya da hata ekranı */
  const runJob = useCallback(async (job: () => Promise<GenerateOutcome>) => {
    const unsubscribe = api.onGenerateEvent(handleEvent);
    const outcome = await job();
    unsubscribe();
    busyRef.current = false;

    if (outcome.ok) {
      setDone({ result: outcome.result, links: outcome.links });
      setView('done');
      void api.toolStatus().then(setTools);
    } else {
      setProgress((p) => ({ ...p, phase: outcome.cancelled ? 'cancelled' : 'error', error: outcome.message }));
    }
  }, [handleEvent]);

  const generate = useCallback(async () => {
    if (blocking || busyRef.current) return;
    busyRef.current = true;
    if (settings) saveSettings({ ...settings, lastSelection: sel });
    projectDirRef.current = `${sel.location.replace(/[\\/]+$/, '')}\\${sel.name}`;
    setProgress(initialProgress(planSteps(sel)));
    setView('progress');

    await runJob(() => api.generate(sel));
  }, [blocking, settings, sel, saveSettings, runJob]);

  // Docker adımı hata verdiyse: dosyalara dokunmadan sadece derle ve başlat
  const restartDocker = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProgress((p) => ({
      ...p,
      phase: 'running',
      error: undefined,
      steps: { ...p.steps, 'docker-build': { status: 'pending' }, services: { status: 'pending' } },
    }));
    await runJob(() => api.startProject(sel));
  }, [sel, runJob]);

  // Ctrl+Enter ile oluştur (sadece ayar ekranında)
  useEffect(() => {
    if (view !== 'config') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void generate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generate, view]);

  const pickFolder = async () => {
    const folder = await api.pickFolder(sel.location);
    if (folder) setSel((s) => ({ ...s, location: folder }));
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name || !settings) return;
    const template: SavedTemplate = { id: `t-${Date.now()}`, name, selection: { ...sel } };
    saveSettings({ ...settings, templates: [...settings.templates, template] });
    setActivePreset(template.id);
    setSavingTemplate(false);
    setTemplateName('');
  };

  const applyTemplate = (t: SavedTemplate) => {
    setSel((s) => ({ ...restore(t.selection, s.location), name: s.name, location: s.location }));
    setActivePreset(t.id);
  };

  const pickKit = (next: ProjectKind, template?: PythonTemplate) => {
    setSel((s) => {
      const picked = setProjectKind(s, next);
      if (!template) return picked;
      // Karttaki şablon satırı "bununla başla" demek: o şablonun varsayılan seçenekleriyle açılır
      const options = [...findPythonTemplate(template).defaultOptions];
      return { ...picked, python: { ...picked.python, template, options } };
    });
    setActivePreset(null);
    setView('config');
  };

  const kit = findKit(kind);
  const crumb = view === 'welcome'
    ? 'Yeni proje'
    : view === 'config'
      ? kit.label
      : view === 'done'
        ? 'Hazır'
        : progress.phase === 'error' ? 'Oluşturulamadı' : progress.phase === 'cancelled' ? 'İptal edildi' : 'Kuruluyor';

  return (
    <div className="flex h-full flex-col">
      <TitleBar
        crumb={crumb}
        kit={view === 'welcome' ? null : kind}
        tools={tools}
        theme={theme}
        onToggleTheme={() => settings && saveSettings({ ...settings, theme: theme === 'dark' ? 'light' : 'dark' })}
        onRecheck={() => void api.toolStatus().then(setTools)}
      />

      {view === 'welcome' && (
        <main className="min-h-0 flex-1">
          <WelcomeView
            tools={tools}
            lastSelection={settings?.lastSelection ?? null}
            templates={settings?.templates ?? []}
            onPick={pickKit}
            onResume={() => {
              setSel(restore(settings?.lastSelection ?? null, defaultLocation));
              setActivePreset(null);
              setView('config');
            }}
            onApplyTemplate={(t) => {
              applyTemplate(t);
              setView('config');
            }}
            onDeleteTemplate={(id) => settings && saveSettings({ ...settings, templates: settings.templates.filter((t) => t.id !== id) })}
          />
        </main>
      )}

      {view !== 'welcome' && (
        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            {view === 'config' && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-[1180px] px-6 pt-5">
                    <button
                      type="button"
                      onClick={() => setView('welcome')}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md pr-2 pl-1 text-[13px] text-fg-2 hover:bg-surface-2 hover:text-fg"
                    >
                      <ArrowLeft size={15} /> Proje türleri
                    </button>
                  </div>
                  <ConfigView
                    sel={sel}
                    update={update}
                    resolved={resolved}
                    catalog={catalog}
                    issues={issues}
                    targetIssue={targetIssue}
                    tools={tools}
                    activePreset={activePreset}
                    templates={settings?.templates ?? []}
                    onApplyPreset={(id) => {
                      setSel((s) => applyPreset(s, id));
                      setActivePreset(id);
                    }}
                    onApplyTemplate={applyTemplate}
                    onDeleteTemplate={(id) => settings && saveSettings({ ...settings, templates: settings.templates.filter((t) => t.id !== id) })}
                    onPickFolder={pickFolder}
                  />
                </div>

                <footer className="flex h-[64px] shrink-0 items-center gap-3 border-t border-line bg-bg px-6">
                  {savingTemplate ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTemplate();
                      }}
                    >
                      <input
                        autoFocus
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setSavingTemplate(false)}
                        placeholder="Şablon adı, örn. Benim API'm"
                        className={`${inputClass} max-w-[260px]`}
                      />
                      <Button type="submit" disabled={!templateName.trim()}>Kaydet</Button>
                      <Button variant="ghost" onClick={() => setSavingTemplate(false)}>Vazgeç</Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1 text-[13px]">
                        {blocking && pendingInput ? (
                          <span className="text-fg-2">{pendingInput}</span>
                        ) : blocking ? (
                          <span className="flex items-center gap-1.5 text-danger">
                            <AlertCircle size={15} className="shrink-0" /> <span className="truncate">{blocking}</span>
                          </span>
                        ) : (
                          <span className="block truncate text-fg-2">{summaryOf(sel, resolved)}</span>
                        )}
                      </div>
                      <Button variant="ghost" onClick={() => setSavingTemplate(true)}>Şablon olarak kaydet</Button>
                    </>
                  )}
                  <Button variant="primary" className="min-w-[196px]" disabled={Boolean(blocking)} onClick={() => void generate()}>
                    Projeyi oluştur <Kbd>Ctrl ↵</Kbd>
                  </Button>
                </footer>
              </>
            )}

            {view === 'progress' && (
              <ProgressView
                name={sel.name}
                projectDir={projectDirRef.current}
                progress={progress}
                onCancel={() => void api.cancelGenerate()}
                onBack={() => setView('config')}
                onRetry={() => {
                  setView('config');
                  setTimeout(() => void generate(), 0);
                }}
                onRestartDocker={() => void restartDocker()}
                onOpenFolder={() => void api.openFolder(projectDirRef.current)}
                onOpenEditor={() => void api.openInEditor(projectDirRef.current)}
              />
            )}

            {view === 'done' && done && (
              <DoneView
                name={sel.name}
                result={done.result}
                links={done.links}
                startRequested={sel.start}
                python={isPython(sel)}
                onOpenUrl={(url) => void api.openUrl(url)}
                onOpenFolder={() => void api.openFolder(done.result.projectDir)}
                onOpenEditor={() => api.openInEditor(done.result.projectDir)}
                onStartWatch={() => void api.startWatch(done.result.projectDir)}
                onNew={() => {
                  setDone(null);
                  setView('welcome');
                  setSel((s) => ({ ...s, name: '' }));
                }}
              />
            )}
          </main>

          <PreviewPane
            resolved={resolved}
            livePorts={livePorts}
            assembly={view === 'config' ? null : view === 'done' ? DONE_ASSEMBLY : stepStatuses(progress)}
          />
        </div>
      )}
    </div>
  );
}

/** Bitiş ekranında bütün parçalar takılı */
const DONE_ASSEMBLY: Record<StepId, StepStatus> = Object.fromEntries(
  Object.keys(STEP_LABELS).map((id) => [id, 'done']),
) as Record<StepId, StepStatus>;

function stepStatuses(progress: ProgressState): Partial<Record<StepId, StepStatus>> {
  return Object.fromEntries(Object.entries(progress.steps).map(([id, step]) => [id, step.status]));
}

/** Alt çubuktaki tek satırlık özet */
function summaryOf(sel: Selection, resolved: ReturnType<typeof resolve>): string {
  if (isPython(sel)) {
    const options = pythonOptionsOf(sel).size;
    return `Python · ${findPythonTemplate(sel.python.template).label} · ${options} seçenek${sel.python.install ? ' · paketler kurulacak' : ''}`;
  }
  if (!hasBackend(sel)) {
    return `Web sitesi · ${findFramework(sel.frontend.framework!).label} · ${sel.frontend.options.length} seçenek`;
  }
  const parts = [
    `${resolved.dependencies.length + resolved.libraries.length} paket`,
    `${resolved.databases.length} veritabanı`,
    `${resolved.services.length} ek servis`,
  ];
  if (sel.frontend.framework) parts.push(findFramework(sel.frontend.framework).label);
  return parts.join(' · ');
}
