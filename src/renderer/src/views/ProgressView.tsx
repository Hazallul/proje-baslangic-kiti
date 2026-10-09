import { Check, ChevronDown, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STEP_LABELS } from '../../../core/steps';
import type { StepId } from '../../../core/types';
import { Button, cx } from '../ui';

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export interface StepState {
  status: StepStatus;
  message?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface ProgressState {
  /** Bu projede çalışacak adımlar, sırasıyla (core/steps.ts → planSteps) */
  order: StepId[];
  steps: Partial<Record<StepId, StepState>>;
  infos: string[];
  log: string;
  phase: 'running' | 'error' | 'cancelled';
  error?: string;
}

export function initialProgress(order: StepId[]): ProgressState {
  const steps = Object.fromEntries(order.map((id) => [id, { status: 'pending' }])) as ProgressState['steps'];
  return { order, steps, infos: [], log: '', phase: 'running' };
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk ${s % 60} sn`;
}

/** Uzun sürebilecek adımlar için bekleme notu */
const SLOW_NOTES: Partial<Record<StepId, string>> = {
  'docker-build': 'İlk seferde Maven/npm bağımlılıkları indiği için birkaç dakika sürebilir',
  'python-env': 'Paketler indiriliyor; internet hızına göre bir iki dakika sürebilir',
};

export function ProgressView({ name, projectDir, progress, onCancel, onBack, onRetry, onRestartDocker, onOpenFolder, onOpenEditor }: {
  name: string;
  projectDir: string;
  progress: ProgressState;
  onCancel: () => void;
  onBack: () => void;
  onRetry: () => void;
  onRestartDocker: () => void;
  onOpenFolder: () => void;
  onOpenEditor: () => void;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const logRef = useRef<HTMLPreElement>(null);
  const running = progress.phase === 'running';
  const status = (id: StepId) => progress.steps[id]?.status ?? 'pending';
  // Dosyalar yazıldıktan sonraki adımlarda (git, docker) hata olursa proje klasörü yerinde kalır
  const filesWritten = status('docker-files') === 'done' || status('python-files') === 'done';
  const dockerFailed = status('docker-build') === 'error' || status('services') === 'error';
  const finished = progress.order.filter((id) => ['done', 'skipped'].includes(status(id))).length;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (progress.phase === 'error') setLogOpen(true);
  }, [progress.phase]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progress.log, logOpen]);

  const title = progress.phase === 'error'
    ? `${name} kurulamadı`
    : progress.phase === 'cancelled' ? 'İşlem iptal edildi' : `${name} kuruluyor`;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-8 pt-9 pb-8">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-[26px] leading-tight font-bold">{title}</h1>
            <span className="font-mono text-[12px] text-fg-3 tabular">{finished}/{progress.order.length}</span>
          </div>
          <p className="mt-1 truncate font-mono text-[12px] text-fg-3">{projectDir}</p>

          {/* Montaj kitapçığı: her adım numaralı bir parça, bitince yerine oturur */}
          <ol className="mt-6 space-y-2">
            {progress.order.map((id, index) => {
              const step = progress.steps[id] ?? { status: 'pending' as const };
              const elapsed = step.startedAt ? (step.endedAt ?? now) - step.startedAt : 0;
              return (
                <li
                  key={id}
                  className={cx(
                    'flex items-center gap-3.5 rounded-xl border px-4 py-3 transition-colors duration-200',
                    step.status === 'running' && 'border-accent-line bg-accent-soft',
                    step.status === 'error' && 'border-danger/40 bg-danger-soft',
                    !['running', 'error'].includes(step.status) && 'border-line bg-surface',
                  )}
                >
                  <StepBadge index={index + 1} status={step.status} />
                  <div className="min-w-0 flex-1">
                    <div className={cx('text-[14px]', step.status === 'pending' || step.status === 'skipped' ? 'text-fg-3' : 'font-medium text-fg')}>
                      {STEP_LABELS[id]}
                    </div>
                    {step.message && step.status !== 'error' && <div className="truncate text-[12.5px] text-fg-2">{step.message}</div>}
                    {step.status === 'running' && SLOW_NOTES[id] && <div className="text-[12.5px] text-fg-2">{SLOW_NOTES[id]}</div>}
                  </div>
                  <span className="shrink-0 font-mono text-[11.5px] text-fg-3 tabular">
                    {step.status === 'skipped' ? 'atlandı' : step.startedAt ? formatDuration(elapsed) : ''}
                  </span>
                </li>
              );
            })}
          </ol>

          {progress.infos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {progress.infos.map((info) => (
                <li key={info} className="flex items-center gap-2 text-[13px] text-fg-2">
                  <Info size={14} className="shrink-0 text-accent" /> {info}
                </li>
              ))}
            </ul>
          )}

          {progress.phase === 'error' && progress.error && (
            <div className="enter mt-4 rounded-xl border border-danger/40 bg-danger-soft p-3.5">
              <div className="mb-1 text-[13.5px] font-semibold text-danger">Hata</div>
              <pre className="max-h-40 overflow-auto font-mono text-[11.5px] whitespace-pre-wrap text-fg select-text">{progress.error}</pre>
              <p className="mt-2 text-[12.5px] text-fg-2">
                {dockerFailed
                  ? 'Proje dosyaları oluştu; sorun Docker tarafında. Sebebi düzelttikten sonra (ör. Docker Desktop açık mı, port boş mu) "Tekrar başlat" ile sadece Docker adımlarını tekrarlayabilirsin.'
                  : filesWritten
                    ? 'Proje dosyaları oluştu; klasörü açıp devam edebilirsin.'
                    : 'Yarım kalan klasör silindi. Ayarları kontrol edip tekrar deneyebilirsin.'}
              </p>
            </div>
          )}

          <div className="mt-5">
            <button
              type="button"
              aria-expanded={logOpen}
              onClick={() => setLogOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-fg-2 hover:text-fg"
            >
              <ChevronDown size={15} className={cx('transition-transform duration-200', !logOpen && '-rotate-90')} />
              Ayrıntılı log
            </button>
            {logOpen && (
              <pre
                ref={logRef}
                className="enter mt-2 h-[260px] overflow-auto rounded-xl border border-line bg-panel p-3 font-mono text-[11px] leading-[1.6] whitespace-pre-wrap text-fg-2 select-text"
              >
                {progress.log || 'Henüz çıktı yok.'}
              </pre>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[64px] shrink-0 items-center justify-end gap-2 border-t border-line px-8">
        {running ? (
          <Button variant="danger" onClick={onCancel}>İptal et</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onBack}>Ayarlara dön</Button>
            {progress.phase === 'error' && filesWritten && (
              <>
                <Button onClick={onOpenFolder}>Klasörü aç</Button>
                <Button variant={dockerFailed ? undefined : 'primary'} onClick={onOpenEditor}>VS Code'da aç</Button>
                {dockerFailed && <Button variant="primary" onClick={onRestartDocker}>Tekrar başlat</Button>}
              </>
            )}
            {progress.phase === 'error' && !filesWritten && <Button variant="primary" onClick={onRetry}>Tekrar dene</Button>}
          </>
        )}
      </div>
    </div>
  );
}

/** Kitapçıktaki adım numarası: bekliyor (çerçeve), sürüyor (kit renginde), bitti (tik), hata, atlandı */
function StepBadge({ index, status }: { index: number; status: StepStatus }) {
  const base = 'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold tabular';
  if (status === 'done') {
    return <span className={cx(base, 'snap bg-ok text-white')} aria-label={`Adım ${index}: bitti`}><Check size={16} strokeWidth={3} /></span>;
  }
  if (status === 'error') {
    return <span className={cx(base, 'bg-danger text-white')} aria-label={`Adım ${index}: hata`}><X size={16} strokeWidth={3} /></span>;
  }
  if (status === 'running') {
    return (
      <span className={cx(base, 'bg-accent text-accent-ink')} aria-label={`Adım ${index}: sürüyor`}>
        {index}
        <span aria-hidden className="absolute -inset-1 animate-spin rounded-full border-2 border-transparent border-t-accent" />
      </span>
    );
  }
  return (
    <span
      className={cx(base, 'border-2 border-line-strong text-fg-3', status === 'skipped' && 'border-dashed')}
      aria-label={`Adım ${index}: ${status === 'skipped' ? 'atlandı' : 'bekliyor'}`}
    >
      {index}
    </span>
  );
}
