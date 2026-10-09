import { ArrowRight, History, X } from 'lucide-react';
import type { ProjectKind, PythonTemplate, Selection } from '../../../core/types';
import type { SavedTemplate, ToolStatus } from '../../../shared/bridge';
import { projectKindOf } from '../../../core/selection';
import { findKit, type KitDef, KITS, kitRequirements } from '../kits';
import { cx } from '../ui';

/** Kit kutusunun rengi ve üstündeki yazının rengi (sarı kutuda koyu yazı) */
function kitColors(id: ProjectKind): { background: string; color: string } {
  return {
    background: `var(--kit-${id})`,
    color: id === 'python' ? 'var(--kit-python-ink)' : '#ffffff',
  };
}

export function WelcomeView({ tools, lastSelection, templates, onPick, onResume, onApplyTemplate, onDeleteTemplate }: {
  tools: ToolStatus | null;
  lastSelection: Selection | null;
  templates: SavedTemplate[];
  onPick: (kind: ProjectKind, template?: PythonTemplate) => void;
  onResume: () => void;
  onApplyTemplate: (template: SavedTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[1180px] flex-col justify-center px-8 py-6 min-[1180px]:py-10">
        <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.01em] text-fg">Ne kuruyorsun?</h1>
        <p className="mt-1.5 text-[15px] text-fg-2">Türü seç, kutudan çıkacakları bir sonraki adımda ayarlarsın.</p>

        {/* Dört kart her zaman tek sırada: en küçük pencerede (980x640) 2x2 olsa ikinci sıra ekran dışında kalır.
            2 sütun sadece tarayıcıda (npm run ui) daha dar açıldığında devreye girer. */}
        <div className="mt-7 grid grid-cols-2 gap-3 min-[900px]:grid-cols-4 min-[1180px]:gap-4">
          {KITS.map((kit) => (
            <KitCard key={kit.id} kit={kit} tools={tools} onPick={(template) => onPick(kit.id, template)} />
          ))}
        </div>

        {(lastSelection || templates.length > 0) && (
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {lastSelection && (
              <button
                type="button"
                onClick={onResume}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg hover:border-line-strong hover:bg-surface-2"
              >
                <History size={14} className="text-fg-3" />
                Son ayarlarla devam et
                <span className="text-fg-3">
                  {findKit(projectKindOf(lastSelection)).label} · {lastSelection.name}
                </span>
              </button>
            )}
            {templates.length > 0 && <span className="ml-2 text-[13px] text-fg-3">Kayıtlı şablonların</span>}
            {templates.map((t) => (
              <span key={t.id} className="group inline-flex h-8 items-center rounded-lg border border-dashed border-line-strong bg-surface">
                <button
                  type="button"
                  onClick={() => onApplyTemplate(t)}
                  className="flex h-full items-center gap-2 pr-1 pl-3 text-[13px] text-fg"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: `var(--kit-${projectKindOf(t.selection)})` }} />
                  {t.name}
                </button>
                <button
                  type="button"
                  aria-label={`${t.name} şablonunu sil`}
                  onClick={() => onDeleteTemplate(t.id)}
                  className="mr-1 rounded p-1 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KitCard({ kit, tools, onPick }: { kit: KitDef; tools: ToolStatus | null; onPick: (template?: PythonTemplate) => void }) {
  const Icon = kit.icon;
  const colors = kitColors(kit.id);
  const requirements = kitRequirements(kit.id, tools);

  // Kartın tamamı tek bir tıklama alanı (ana düğmenin ::after katmanı kartı kaplar). Şablon satırları
  // (Python) bu katmanın üstünde ayrı düğmelerdir: iç içe düğme olmadan doğrudan o şablonu açarlar.
  return (
    <div className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop">
      {/* Şerit relative değil: başlık düğmesinin tıklama katmanı kartın tamamına yayılsın */}
      <div className="flex h-[92px] shrink-0 flex-col justify-between p-4 min-[1180px]:h-[104px]" style={colors}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]">
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <button
          type="button"
          onClick={() => onPick()}
          className="text-left font-display text-[22px] leading-none font-bold outline-none after:absolute after:inset-0 after:z-0 after:rounded-2xl after:content-[''] focus-visible:after:shadow-[inset_0_0_0_2px_var(--accent-line)]"
        >
          {kit.label}
        </button>
        <ArrowRight
          aria-hidden
          size={18}
          className="absolute top-4 right-4 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </div>

      <div className="flex flex-1 flex-col p-4 pt-3.5">
        <p className="text-[13.5px] leading-snug text-fg-2">{kit.tagline}</p>

        <div className="mt-3 mb-1.5 text-[12px] font-semibold text-fg-3">Kutuda</div>
        <ol className="space-y-1">
          {kit.contents.map((part, i) => {
            const body = (
              <>
                <PartNumber color={colors.background}>{`A${i + 1}`}</PartNumber>
                <span className="min-w-0">
                  <span className="font-medium text-fg">{part.label}</span>
                  {part.detail && <span className="text-fg-3"> · {part.detail}</span>}
                </span>
              </>
            );
            return (
              <li key={part.label}>
                {part.template ? (
                  <button
                    type="button"
                    onClick={() => onPick(part.template)}
                    className="relative z-10 -mx-1.5 flex w-[calc(100%+12px)] items-baseline gap-2 rounded-lg px-1.5 py-1 text-left text-[13px] hover:bg-surface-2"
                  >
                    {body}
                    <ArrowRight aria-hidden size={13} className="ml-auto shrink-0 self-center text-fg-3" />
                  </button>
                ) : (
                  <div className="flex items-baseline gap-2 py-0.5 text-[13px]">{body}</div>
                )}
              </li>
            );
          })}
        </ol>

        {requirements.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4">
            {requirements.map((r) => (
              <span key={r.label} title={r.hint} className={cx('inline-flex items-center gap-1.5 text-[12px]', r.ok ? 'text-fg-3' : 'text-warn')}>
                <span className={cx('h-1.5 w-1.5 rounded-full', r.ok ? 'bg-ok' : 'bg-warn')} />
                {r.ok ? r.label : `${r.label} yok`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Parça çerçevesiyle aynı dil: kit renginde hafif zemin üstünde dar, kalın parça numarası */
function PartNumber({ color, children }: { color: string; children: string }) {
  return (
    <span
      className="relative top-[-1px] inline-flex h-[18px] min-w-[24px] shrink-0 items-center justify-center rounded-[5px] px-1 font-display text-[11.5px] font-bold text-fg tabular"
      style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      {children}
    </span>
  );
}
