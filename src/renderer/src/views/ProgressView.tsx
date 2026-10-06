import { CheckCircle2, ChevronDown, Circle, CircleSlash, Info, LoaderCircle, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STEP_LABELS, STEP_ORDER } from '../../../core/steps';
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
  steps: Record<StepId, StepState>;
  infos: string[];
  log: string;
  phase: 'running' | 'error' | 'cancelled';
  error?: string;
}

export function initialProgress(): ProgressState {
  const steps = Object.fromEntries(STEP_ORDER.map((id) => [id, { status: 'pending' }])) as Record<StepId, StepState>;
  return { steps, infos: [], log: '', phase: 'running' };
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk ${s % 60} sn`;
}

export function ProgressView({ name, projectDir, progress, onCancel, onBack, onRetry, onOpenFolder, onOpenEditor }: {
  name: string;
  projectDir: string;
  progress: ProgressState;
  onCancel: () => void;
  onBack: () => void;
  onRetry: () => void;
  onOpenFolder: () => void;
  onOpenEditor: () => void;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const logRef = useRef<HTMLPreElement>(null);
  const running = progress.phase === 'running';
  // Dosyalar yazıldıktan sonraki adımlarda (git, docker) hata olursa proje klasörü yerinde kalır
  const filesWritten = progress.steps['docker-files'].status === 'done';

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
    ? `${name} oluşturulamadı`
    : progress.phase === 'cancelled' ? 'İşlem iptal edildi' : `${name} oluşturuluyor`;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-8 pt-8 pb-8">
          <h1 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h1>
          <p className="mt-1 truncate font-mono text-[12px] text-fg-3">{projectDir}</p>

          <ol className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface">
            {STEP_ORDER.map((id) => {
              const step = progress.steps[id];
              const elapsed = step.startedAt ? (step.endedAt ?? now) - step.startedAt : 0;
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3">
                  <StepIcon status={step.status} />
                  <div className="min-w-0 flex-1">
                    <div className={cx('text-[13px]', step.status === 'pending' || step.status === 'skipped' ? 'text-fg-3' : 'font-medium text-fg')}>
                      {STEP_LABELS[id]}
                    </div>
                    {step.message && step.status !== 'error' && (
                      <div className="truncate text-[12px] text-fg-2">{step.message}</div>
                    )}
                    {id === 'docker-build' && step.status === 'running' && (
                      <div className="text-[12px] text-fg-2">İlk seferde Maven/npm bağımlılıkları indiği için birkaç dakika sürebilir</div>
                    )}
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
                <li key={info} className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  <Info size={13} className="shrink-0 text-accent" /> {info}
                </li>
              ))}
            </ul>
          )}

          {progress.phase === 'error' && progress.error && (
            <div className="enter mt-4 rounded-lg border border-danger/40 bg-danger-soft p-3.5">
              <div className="mb-1 text-[13px] font-medium text-danger">Hata</div>
              <pre className="max-h-40 overflow-auto font-mono text-[11.5px] whitespace-pre-wrap text-fg select-text">{progress.error}</pre>
              <p className="mt-2 text-[12px] text-fg-2">
                {filesWritten
                  ? 'Proje dosyaları oluştu; sorun Docker tarafında. Klasörde "docker compose up -d --build" ile tekrar deneyebilirsin.'
                  : 'Yarım kalan klasör silindi. Ayarları kontrol edip tekrar deneyebilirsin.'}
              </p>
            </div>
          )}

          <div className="mt-5">
            <button
              type="button"
              aria-expanded={logOpen}
              onClick={() => setLogOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-2 hover:text-fg"
            >
              <ChevronDown size={14} className={cx('transition-transform duration-200', !logOpen && '-rotate-90')} />
              Ayrıntılı log
            </button>
            {logOpen && (
              <pre
                ref={logRef}
                className="enter mt-2 h-[260px] overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-[11px] leading-[1.6] whitespace-pre-wrap text-fg-2 select-text"
              >
                {progress.log || 'Henüz çıktı yok.'}
              </pre>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[60px] shrink-0 items-center justify-end gap-2 border-t border-line px-8">
        {running ? (
          <Button variant="danger" onClick={onCancel}>İptal et</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onBack}>Ayarlara dön</Button>
            {progress.phase === 'error' && filesWritten && (
              <>
                <Button onClick={onOpenFolder}>Klasörü aç</Button>
                <Button variant="primary" onClick={onOpenEditor}>VS Code'da aç</Button>
              </>
            )}
            {progress.phase === 'error' && !filesWritten && <Button variant="primary" onClick={onRetry}>Tekrar dene</Button>}
          </>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  const common = { size: 17, strokeWidth: 2, className: 'shrink-0' };
  switch (status) {
    case 'running': return <LoaderCircle {...common} className="shrink-0 animate-spin text-accent" />;
    case 'done': return <CheckCircle2 {...common} className="shrink-0 text-ok" />;
    case 'error': return <XCircle {...common} className="shrink-0 text-danger" />;
    case 'skipped': return <CircleSlash {...common} className="shrink-0 text-fg-3" />;
    default: return <Circle {...common} className="shrink-0 text-line-strong" />;
  }
}
