import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InitializrCatalog } from '../../core/initializr';
import { findFramework } from '../../core/catalog/frontend';
import { applyPreset, defaultSelection, hasBackend, resolve, validate } from '../../core/selection';
import type { GenerateEvent, GenerateResult, Selection } from '../../core/types';
import type { GenerateOutcome, SavedTemplate, Settings, TargetCheck, ToolStatus } from '../../shared/bridge';
import { api } from './api';
import { TitleBar } from './TitleBar';
import { Button, inputClass, Kbd } from './ui';
import { ConfigView } from './views/ConfigView';
import { DoneView } from './views/DoneView';
import { PreviewPane } from './views/PreviewPane';
import { initialProgress, type ProgressState } from './views/ProgressView';
import { ProgressView } from './views/ProgressView';

type View = 'config' | 'progress' | 'done';
const LOG_LIMIT = 300_000;

/** Eski sürümde kaydedilmiş seçimleri bugünkü yapıyla birleştirir */
function withDefaults(saved: Partial<Selection> | null, location: string): Selection {
  const base = defaultSelection();
  if (!saved) return { ...base, location };
  return {
    ...base,
    ...saved,
    backend: { ...base.backend, ...saved.backend },
    database: { ...base.database, ...saved.database },
    frontend: { ...base.frontend, ...saved.frontend },
    location: saved.location || location,
  };
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App() {
  const [catalog, setCatalog] = useState<InitializrCatalog | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tools, setTools] = useState<ToolStatus | null>(null);
  const [sel, setSel] = useState<Selection>(() => defaultSelection());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [view, setView] = useState<View>('config');
  const [progress, setProgress] = useState<ProgressState>(initialProgress);
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
      setSel(withDefaults(s.lastSelection, location));
    });
  }, []);

  const theme = !settings || settings.theme === 'system' ? systemTheme() : settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    void api.setTheme(theme);
  }, [theme]);

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
  }, [sel.name, sel.location, nameValid]);

  // Önizlemede gerçekte kullanılacak portları göster (3306 doluysa 3307 gibi)
  const portKey = JSON.stringify([sel.frontend.framework, resolved.databases, resolved.services]);
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

  const blocking = issues[0]?.message
    ?? (targetIssue ? 'Bu ad kullanılıyor, başka bir ad seç' : null)
    ?? (tools && !tools.node && sel.frontend.framework ? 'Frontend için Node.js gerekli (npm bulunamadı)' : null);

  // -------------------------------------------------------------------------

  const handleEvent = useCallback((event: GenerateEvent) => {
    setProgress((p) => {
      if (event.type === 'log') {
        const log = p.log + event.text;
        return { ...p, log: log.length > LOG_LIMIT ? log.slice(-LOG_LIMIT) : log };
      }
      if (event.type === 'info') return { ...p, infos: [...p.infos, event.message] };
      const prev = p.steps[event.step];
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
    projectDirRef.current = `${sel.location}\\${sel.name}`;
    setProgress(initialProgress());
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

  const crumb = view === 'config'
    ? 'Yeni proje'
    : view === 'done'
      ? 'Hazır'
      : progress.phase === 'error' ? 'Oluşturulamadı' : progress.phase === 'cancelled' ? 'İptal edildi' : 'Oluşturuluyor';

  return (
    <div className="flex h-full flex-col">
      <TitleBar
        crumb={crumb}
        tools={tools}
        theme={theme}
        onToggleTheme={() => settings && saveSettings({ ...settings, theme: theme === 'dark' ? 'light' : 'dark' })}
        onRecheck={() => void api.toolStatus().then(setTools)}
      />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {view === 'config' && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
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
                  onApplyTemplate={(t) => {
                    setSel((s) => ({ ...withDefaults(t.selection, s.location), name: s.name, location: s.location }));
                    setActivePreset(t.id);
                  }}
                  onDeleteTemplate={(id) => settings && saveSettings({ ...settings, templates: settings.templates.filter((t) => t.id !== id) })}
                  onPickFolder={pickFolder}
                />
              </div>

              <footer className="flex h-[60px] shrink-0 items-center gap-3 border-t border-line bg-bg px-8">
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
                    <div className="min-w-0 flex-1 text-[12.5px]">
                      {blocking ? (
                        <span className="flex items-center gap-1.5 text-danger">
                          <AlertCircle size={14} className="shrink-0" /> <span className="truncate">{blocking}</span>
                        </span>
                      ) : !hasBackend(sel) ? (
                        <span className="truncate text-fg-2">
                          Sadece frontend · {findFramework(sel.frontend.framework!).label}
                          {' · '}<span className="tabular">{sel.frontend.options.length}</span> seçenek
                        </span>
                      ) : (
                        <span className="truncate text-fg-2">
                          <span className="tabular">{resolved.dependencies.length + resolved.libraries.length}</span> paket
                          {' · '}<span className="tabular">{resolved.databases.length}</span> veritabanı
                          {' · '}<span className="tabular">{resolved.services.length}</span> ek servis
                          {sel.frontend.framework && ` · ${sel.frontend.framework[0].toUpperCase()}${sel.frontend.framework.slice(1)}`}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" onClick={() => setSavingTemplate(true)}>Şablon olarak kaydet</Button>
                  </>
                )}
                <Button variant="primary" className="min-w-[188px]" disabled={Boolean(blocking)} onClick={() => void generate()}>
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
              onOpenUrl={(url) => void api.openUrl(url)}
              onOpenFolder={() => void api.openFolder(done.result.projectDir)}
              onOpenEditor={() => api.openInEditor(done.result.projectDir)}
              onStartWatch={() => void api.startWatch(done.result.projectDir)}
              onNew={() => {
                setDone(null);
                setView('config');
                setSel((s) => ({ ...s, name: '' }));
              }}
            />
          )}
        </main>

        <PreviewPane resolved={resolved} livePorts={livePorts} />
      </div>
    </div>
  );
}
