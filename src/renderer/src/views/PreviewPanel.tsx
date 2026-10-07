import { useState } from 'react';
import { findDatabase } from '../../../core/catalog/databases';
import { findFramework } from '../../../core/catalog/frontend';
import { findService } from '../../../core/catalog/services';
import { hasBackend } from '../../../core/selection';
import type { ResolvedProject } from '../../../core/types';
import { cx } from '../ui';
import { servicePreview, SwaggerUi } from './ServicePreviews';
import { BrowserFrame, PreviewBody, usePreviewState } from './UiPreview';

export type PreviewTarget = { kind: 'frontend' } | { kind: 'swagger' } | { kind: 'service'; id: string };

export function sameTarget(a: PreviewTarget | null, b: PreviewTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind !== 'service' || (b.kind === 'service' && a.id === b.id);
}

interface TargetOption {
  target: PreviewTarget;
  label: string;
}

/** Seçimlere göre önizlemesi olan her şey: uygulama, Swagger, arayüzü olan servisler */
export function previewTargets(resolved: ResolvedProject): TargetOption[] {
  const list: TargetOption[] = [];
  const fw = resolved.selection.frontend.framework;
  if (fw) list.push({ target: { kind: 'frontend' }, label: 'Uygulama' });
  if (resolved.libraries.includes('springdoc')) list.push({ target: { kind: 'swagger' }, label: 'Swagger UI' });
  for (const id of resolved.services) {
    // Kafka'nın arayüzü Kafka UI üzerinden gösterilir; ikisi seçiliyse tek sekme yeter
    if (id === 'kafka' && resolved.services.includes('kafka-ui')) continue;
    if (servicePreview(id, ctxOf(resolved))) list.push({ target: { kind: 'service', id }, label: findService(id).label });
  }
  return list;
}

function ctxOf(resolved: ResolvedProject) {
  const sql = resolved.selection.database.sql;
  return { projectName: resolved.selection.name || 'my-app', sqlLabel: sql ? findDatabase(sql).label : 'SQL' };
}

function targetLabel(target: PreviewTarget, resolved: ResolvedProject): string {
  if (target.kind === 'frontend') return 'Uygulama';
  if (target.kind === 'swagger') return 'Swagger UI';
  return findService(target.id).label;
}

/**
 * Formun solundaki önizleme paneli. Üzerine gelinen şey anında gösterilir (hover),
 * tıklanan şey sabitlenir (pinned); ikisi de yoksa ilk uygun önizleme açılır.
 */
export function PreviewPanel({ resolved, hoverKit, hoverTarget, pinned, onPin, onGoToFrontend }: {
  resolved: ResolvedProject;
  hoverKit: string | null;
  hoverTarget: PreviewTarget | null;
  pinned: PreviewTarget | null;
  onPin: (target: PreviewTarget) => void;
  onGoToFrontend: () => void;
}) {
  const [tab, setTab] = useState<'components' | 'start'>('components');
  const targets = previewTargets(resolved);
  const pinnedValid = pinned && targets.some((t) => sameTarget(t.target, pinned)) ? pinned : null;
  const shown = hoverTarget ?? pinnedValid ?? targets[0]?.target ?? null;
  const transient = Boolean(hoverTarget && !targets.some((t) => sameTarget(t.target, hoverTarget)));
  const sel = resolved.selection;
  const { kit, previewing } = usePreviewState({ options: sel.frontend.options, hoverKit });

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[13.5px] font-semibold text-fg">Önizleme</div>

      {targets.length > 0 && (
        <div role="tablist" aria-label="Önizlenecek arayüz" className="mt-2.5 flex flex-wrap gap-1.5">
          {targets.map(({ target, label }) => {
            const active = sameTarget(target, shown);
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPin(target)}
                className={cx(
                  'h-6 rounded-md px-2 text-[12px] font-medium transition-colors duration-150',
                  active ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--accent-line)]' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {shown && (
        <div className="mt-2 mb-3 text-[12px] text-fg-2">
          {transient
            ? <><span className="text-accent">{targetLabel(shown, resolved)}</span> önizleniyor · eklemek için tıkla</>
            : shown.kind === 'frontend'
              ? <>{findFramework(sel.frontend.framework!).label} · <span className={previewing ? 'text-accent' : undefined}>{kit.label}</span>{previewing && <span className="text-accent"> · seçmek için tıkla</span>}</>
              : `${targetLabel(shown, resolved)} · localhost:${portOf(shown)}`}
        </div>
      )}

      <div key={shown ? JSON.stringify(shown) : 'none'} className="enter">
        {!shown && (
          <div className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
            <p className="text-[12.5px] leading-relaxed text-fg-2">
              Frontend, Swagger veya arayüzü olan bir servis (Grafana, Kafka UI, Keycloak…) seçtiğinde ya da üzerine
              geldiğinde nasıl görüneceği burada çıkar.
            </p>
            <button type="button" onClick={onGoToFrontend} className="mt-3 text-[12.5px] font-medium text-accent hover:underline">
              Frontend seçimine git
            </button>
          </div>
        )}

        {shown?.kind === 'frontend' && sel.frontend.framework && (
          <PreviewBody framework={sel.frontend.framework} projectName={sel.name} backend={hasBackend(sel)} kit={kit} tab={tab} setTab={setTab} />
        )}

        {shown?.kind === 'swagger' && (
          <>
            <BrowserFrame url="localhost:8080/swagger-ui.html">
              <SwaggerUi security={sel.needs.security === 'jwt'} />
            </BrowserFrame>
            <p className="mt-2.5 text-[12px] leading-relaxed text-fg-2">
              Swagger UI: backend'deki tüm endpoint'ler otomatik listelenir, her birini tarayıcıdan deneyebilirsin. Yeni bir
              controller yazdığında kendiliğinden eklenir.
            </p>
          </>
        )}

        {shown?.kind === 'service' && <ServiceBody id={shown.id} resolved={resolved} />}
      </div>

      {shown && <p className="mt-2 text-[11.5px] text-fg-3">Temsili görünüm. Seçeneklerin üzerine gelerek karşılaştırabilirsin.</p>}
    </div>
  );
}

function portOf(target: PreviewTarget): number {
  if (target.kind !== 'service') return 8080;
  const service = findService(target.id === 'kafka' ? 'kafka-ui' : target.id);
  return (service.ports.find((p) => p.web) ?? service.ports[0]).preferred;
}

function ServiceBody({ id, resolved }: { id: string; resolved: ResolvedProject }) {
  const info = servicePreview(id, ctxOf(resolved));
  if (!info) return null;
  return (
    <>
      <BrowserFrame url={`localhost:${portOf({ kind: 'service', id })}${info.path}`}>{info.render()}</BrowserFrame>
      <p className="mt-2.5 text-[12px] leading-relaxed text-fg-2">{info.note}</p>
    </>
  );
}

/** Dar pencerede açıklama kartında gösterilen küçük servis önizlemesi */
export function ServiceThumb({ id, resolved }: { id: string; resolved: ResolvedProject }) {
  const info = servicePreview(id, ctxOf(resolved));
  if (!info) return null;
  return (
    <div className="mb-2.5 h-[190px] overflow-hidden rounded-md border border-line" style={{ colorScheme: 'light' }}>
      {info.render()}
    </div>
  );
}
