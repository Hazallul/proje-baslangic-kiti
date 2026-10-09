import {
  Activity, BookOpen, CheckCheck, Clock, FolderOpen, Mail, MessagesSquare, Plus, Radio, Share2, Shield, Slash, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import { DATABASES } from '../../../core/catalog/databases';
import { FRAMEWORK_HELP, FRONTEND_OPTION_HELP, NEED_HELP, SERVICE_HELP, VARIANT_HELP } from '../../../core/catalog/help';
import { FRAMEWORKS, findFramework, OPTION_GROUPS, type OptionGroup } from '../../../core/catalog/frontend';
import { NEEDS } from '../../../core/catalog/needs';
import { findPythonOption, findPythonTemplate, PYTHON_TEMPLATES } from '../../../core/catalog/python';
import { findService, SERVICES } from '../../../core/catalog/services';
import { useEffect, useRef, useState } from 'react';
import type { InitializrCatalog } from '../../../core/initializr';
import {
  availableServices, hasBackend, isPython, PRESETS, projectKindOf, pythonOptionsOf, setFramework, setNeed,
  setPythonTemplate, setSqlDatabase, suggestedServices, toggleFrontendOption, toggleNoSqlDatabase, togglePythonOption,
  toggleService, type ValidationIssue,
} from '../../../core/selection';
import type { FrameworkId, ResolvedProject, Selection } from '../../../core/types';
import type { SavedTemplate, ToolStatus } from '../../../shared/bridge';
import { findKit } from '../kits';
import { Checkbox, cx, FieldLabel, HelpPopover, inputClass, Mark, Section, Segmented, Tag, Toggle } from '../ui';
import { PackagesSection } from './PackagesSection';
import { type PreviewTarget, PreviewPanel, ServiceThumb } from './PreviewPanel';
import { KitSwatch, UiPreview } from './UiPreview';

const NEED_ICONS: Record<string, LucideIcon> = {
  shield: Shield, 'check-check': CheckCheck, 'book-open': BookOpen, zap: Zap, 'messages-square': MessagesSquare,
  activity: Activity, mail: Mail, radio: Radio, 'share-2': Share2, clock: Clock,
};

const FRAMEWORK_DETAIL: Record<FrameworkId, string> = {
  react: '19 · TS · Vite',
  vue: '3 · TS · Vite',
  angular: 'Angular CLI',
  svelte: '5 · TS · Vite',
};

export interface ConfigViewProps {
  sel: Selection;
  update: (fn: (sel: Selection) => Selection) => void;
  resolved: ResolvedProject;
  catalog: InitializrCatalog | null;
  issues: ValidationIssue[];
  /** Klasör dolu veya Docker'da aynı adlı proje var */
  targetIssue: string | null;
  tools: ToolStatus | null;
  activePreset: string | null;
  templates: SavedTemplate[];
  onApplyPreset: (id: string) => void;
  onApplyTemplate: (template: SavedTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onPickFolder: () => void;
}

/** Bölümlerin önizleme paneliyle konuşması için: üzerine gelme, sabitleme, panel açık mı */
interface PreviewControls {
  /** Önizleme paneli formun solunda mı (yoksa form içinde/kartlarda mı gösterilmeli) */
  wide: boolean;
  setHoverKit: (id: string | null) => void;
  setHoverTarget: (target: PreviewTarget | null) => void;
  pin: (target: PreviewTarget) => void;
}

type SectionProps = ConfigViewProps & { pv: PreviewControls };

/** Öğenin gerçek genişliği (ekran ölçeğinden bağımsız, CSS pikseli) */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Formun solunda önizleme panelinin açılacağı en küçük genişlik */
const PANEL_MIN_WIDTH = 980;

export function ConfigView(props: ConfigViewProps) {
  const [hoverKit, setHoverKit] = useState<string | null>(null);
  const [hoverTarget, setHoverTarget] = useState<PreviewTarget | null>(null);
  const [pinned, setPinned] = useState<PreviewTarget | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const wide = useWidth(ref) >= PANEL_MIN_WIDTH;
  const pv: PreviewControls = { wide, setHoverKit, setHoverTarget, pin: setPinned };
  const sectionProps: SectionProps = { ...props, pv };
  const goToFrontend = () => document.getElementById('frontend')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const backend = hasBackend(props.sel);
  const python = isPython(props.sel);
  // Python'da önizlenecek bir arayüz yok; form ortada tek sütun
  const showPanel = wide && !python;

  return (
    // Genişlik yetince önizleme formun solunda sabit durur; dar pencerede Frontend bölümünün içine iner
    <div ref={ref}>
      <div className={cx('mx-auto flex justify-center gap-6 px-6', showPanel ? 'max-w-[1180px]' : 'max-w-[784px]')}>
        {showPanel && (
          <aside className="w-[380px] shrink-0" aria-label="Önizleme">
            <div className="sticky top-0 max-h-[calc(100vh-110px)] overflow-y-auto py-5">
              <PreviewPanel
                resolved={props.resolved}
                hoverKit={hoverKit}
                hoverTarget={hoverTarget}
                pinned={pinned}
                onPin={setPinned}
                onGoToFrontend={goToFrontend}
              />
            </div>
          </aside>
        )}
        <div className="min-w-0 max-w-[720px] flex-1 pb-10">
          <KitHeader sel={props.sel} />
          <ProjectSection {...sectionProps} />
          {python && (
            <>
              <PythonTemplateSection {...sectionProps} />
              <PythonOptionsSection {...sectionProps} />
            </>
          )}
          {backend && (
            <>
              <PresetSection {...sectionProps} />
              <NeedsSection {...sectionProps} />
              <DatabaseSection {...sectionProps} />
            </>
          )}
          {!python && <FrontendSection {...sectionProps} hoverKit={hoverKit} />}
          {backend && (
            <>
              <ServicesSection {...sectionProps} />
              <PackagesSection sel={props.sel} update={props.update} resolved={props.resolved} catalog={props.catalog} />
            </>
          )}
          <OptionsSection {...sectionProps} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Ad alanında silik görünen örnekler; sadece ipucu, değer olarak yazılmaz */
const NAME_EXAMPLES = ['milyon-dolarlik-fikir', 'bu-sefer-bitecek', 'hafta-sonu-projesi', 'yeni-unicorn', 'son-final-v2'];

function ProjectSection({ sel, update, issues, targetIssue, catalog, onPickFolder }: SectionProps) {
  const [example] = useState(() => NAME_EXAMPLES[Math.floor(Math.random() * NAME_EXAMPLES.length)]);
  const nameIssue = issues.find((i) => i.field === 'name');
  const groupIssue = issues.find((i) => i.field === 'groupId');
  const locationIssue = issues.find((i) => i.field === 'location');
  // Boş ad henüz bir hata değil, yapılacak bir iş: kırmızı yerine nötr ipucu
  const nameError = sel.name ? (nameIssue?.message ?? targetIssue) : null;
  const javaVersions = catalog?.javaVersions ?? ['17', '21', '25'];
  const backend = hasBackend(sel);

  return (
    <Section
      id="proje"
      title="Proje"
      meta={backend && catalog && (
        <span className="flex items-center gap-2">
          Spring Boot <span className="font-mono text-fg">{catalog.bootVersion}</span>
          {catalog.source !== 'live' && <Tag tone="warn">{catalog.source === 'cache' ? 'önbellekten' : 'çevrimdışı katalog'}</Tag>}
        </span>
      )}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="name">Proje adı</FieldLabel>
          <input
            id="name"
            autoFocus
            spellCheck={false}
            value={sel.name}
            placeholder={example}
            onChange={(e) => update((s) => ({ ...s, name: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
            className={cx(inputClass, 'placeholder:text-fg-3/60', nameError && 'border-danger focus:border-danger focus:ring-danger-soft')}
            aria-invalid={!!nameError}
          />
          <p className={cx('mt-1.5 text-[12px]', nameError ? 'text-danger' : 'text-fg-3')}>
            {nameError ?? (isPython(sel)
              ? `Küçük harf, rakam ve tire. Python paketi: ${sel.name.replace(/-/g, '_') || '…'}`
              : 'Küçük harf, rakam ve tire.')}
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="location">Konum</FieldLabel>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <FolderOpen size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
              <input
                id="location"
                spellCheck={false}
                value={sel.location}
                placeholder="C:\Projeler"
                // Explorer'daki "Yol olarak kopyala" tırnaklı yapıştırır; tırnakları at
                onChange={(e) => update((s) => ({ ...s, location: e.target.value.replace(/"/g, '') }))}
                className={cx(inputClass, 'pl-8 font-mono text-[12.5px]', locationIssue && 'border-danger focus:border-danger focus:ring-danger-soft')}
                aria-invalid={!!locationIssue}
              />
            </div>
            <button
              type="button"
              onClick={onPickFolder}
              className="h-9 shrink-0 rounded-md border border-line bg-surface px-3.5 text-[13px] font-medium hover:border-line-strong hover:bg-surface-2"
            >
              Gözat…
            </button>
          </div>
          {locationIssue ? (
            <p className="mt-1.5 text-[12px] text-danger">{locationIssue.message}</p>
          ) : (
            <p className="mt-1.5 truncate font-mono text-[11.5px] text-fg-3">
              → {sel.location.replace(/[\\/]+$/, '')}\<span className="text-fg-2">{sel.name}</span>
            </p>
          )}
        </div>

        {backend && <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <FieldLabel htmlFor="group">Group ID</FieldLabel>
            <input
              id="group"
              spellCheck={false}
              value={sel.backend.groupId}
              onChange={(e) => update((s) => ({ ...s, backend: { ...s.backend, groupId: e.target.value.toLowerCase() } }))}
              className={cx(inputClass, groupIssue && 'border-danger')}
              aria-invalid={!!groupIssue}
              title={groupIssue?.message}
            />
          </div>
          <div>
            <FieldLabel>Java</FieldLabel>
            <Segmented
              label="Java sürümü"
              value={sel.backend.javaVersion}
              onChange={(v) => update((s) => ({ ...s, backend: { ...s.backend, javaVersion: v } }))}
              options={javaVersions.map((v) => ({ value: v, label: v, hint: `Java ${v} (LTS)` }))}
            />
          </div>
          <div>
            <FieldLabel>Derleme</FieldLabel>
            <Segmented
              label="Derleme aracı"
              value={sel.backend.buildTool}
              onChange={(v) => update((s) => ({ ...s, backend: { ...s.backend, buildTool: v } }))}
              options={[{ value: 'maven', label: 'Maven' }, { value: 'gradle', label: 'Gradle' }]}
            />
          </div>
        </div>}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function PresetSection({ sel, activePreset, templates, onApplyPreset, onApplyTemplate, onDeleteTemplate }: SectionProps) {
  // Seçilen tür korunur: REST API'de frontend getiren şablon, her kitte başka türün kayıtlı şablonu gösterilmez
  const kind = projectKindOf(sel);
  const presets = PRESETS.filter((p) => kind !== 'backend' || !p.frontend.framework);
  const ownTemplates = templates.filter((t) => projectKindOf(t.selection) === kind);
  return (
    <Section id="sablon" title="Hızlı başlangıç" meta="Seçince aşağıdaki her şey işaretlenir, sonra değiştirebilirsin">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onApplyPreset(p.id)}
            className={cx(
              'rounded-lg border px-3 py-2.5 text-left transition-colors duration-150',
              activePreset === p.id ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <div className="text-[13px] font-medium text-fg">{p.label}</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-fg-2">{p.description}</div>
          </button>
        ))}
        {ownTemplates.map((t) => (
          <div
            key={t.id}
            className={cx(
              'group relative rounded-lg border transition-colors duration-150',
              activePreset === t.id ? 'border-accent-line bg-accent-soft' : 'border-dashed border-line-strong bg-surface hover:border-accent-line',
            )}
          >
            <button type="button" onClick={() => onApplyTemplate(t)} className="w-full px-3 py-2.5 pr-8 text-left">
              <div className="truncate text-[13px] font-medium text-fg">{t.name}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-fg-2">Kayıtlı şablonun</div>
            </button>
            <button
              type="button"
              aria-label={`${t.name} şablonunu sil`}
              onClick={() => onDeleteTemplate(t.id)}
              className="absolute top-2 right-2 rounded p-0.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 hover:text-danger focus-visible:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

/** Arayüzü olan ihtiyaçlar: hangi varyantta neyin önizleneceği */
function needPreview(needId: string, variant: string | undefined): PreviewTarget | null {
  switch (needId) {
    case 'api-docs': return { kind: 'swagger' };
    case 'mail': return { kind: 'service', id: 'mailpit' };
    case 'monitoring': return variant === 'health' ? null : { kind: 'service', id: 'grafana' };
    case 'messaging': return { kind: 'service', id: variant === 'rabbitmq' ? 'rabbitmq' : 'kafka-ui' };
    case 'security': return variant === 'keycloak' ? { kind: 'service', id: 'keycloak' } : null;
    default: return null;
  }
}

function NeedsSection({ sel, update, pv }: SectionProps) {
  const active = Object.keys(sel.needs).length;
  return (
    <Section id="ihtiyaclar" title="İhtiyaçlar" meta={`${active} seçili`}>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {NEEDS.map((need) => {
          const Icon = NEED_ICONS[need.icon] ?? Shield;
          const variant = sel.needs[need.id];
          const on = Boolean(variant);
          const current = need.variants.find((v) => v.id === variant);
          return (
            <li key={need.id} className={cx('transition-colors duration-150', on && 'bg-surface-2/40')}>
              <div
                className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5"
                onMouseEnter={() => pv.setHoverTarget(needPreview(need.id, variant ?? need.variants[0].id))}
                onMouseLeave={() => pv.setHoverTarget(null)}
                onClick={() => {
                  const next = on ? null : need.variants[0].id;
                  update((s) => setNeed(s, need.id, next));
                  const target = next && needPreview(need.id, next);
                  if (target) pv.pin(target);
                }}
              >
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', on ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg-2')}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <HelpPopover title={need.label} help={NEED_HELP[need.id]} className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-fg">{need.label}</div>
                  <div className="truncate text-[12px] text-fg-2">{need.description}</div>
                </HelpPopover>
                <Toggle
                  label={need.label}
                  checked={on}
                  onChange={(v) => {
                    update((s) => setNeed(s, need.id, v ? need.variants[0].id : null));
                    const target = v && needPreview(need.id, need.variants[0].id);
                    if (target) pv.pin(target);
                  }}
                />
              </div>
              {on && need.variants.length > 1 && (
                <div className="enter flex flex-wrap items-center gap-3 pb-3 pl-[56px] pr-3.5">
                  <Segmented
                    size="sm"
                    label={`${need.label} türü`}
                    value={variant}
                    onChange={(v) => {
                      update((s) => setNeed(s, need.id, v));
                      const target = needPreview(need.id, v);
                      if (target) pv.pin(target);
                    }}
                    options={need.variants.map((v) => ({ value: v.id, label: v.label, help: VARIANT_HELP[`${need.id}/${v.id}`] }))}
                  />
                  {current && <span className="text-[12px] text-fg-2">{current.description}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function DatabaseSection({ sel, update, resolved }: SectionProps) {
  const sqlDbs = DATABASES.filter((d) => d.kind === 'sql');
  const nosqlDbs = DATABASES.filter((d) => d.kind === 'nosql');

  return (
    <Section id="veritabani" title="Veritabanı" meta="Docker container'ı olarak çalışır">
      <div className="mb-2 text-[12px] font-medium text-fg-2">İlişkisel <span className="font-normal text-fg-3">· en fazla bir tane</span></div>
      <div role="radiogroup" aria-label="İlişkisel veritabanı" className="grid grid-cols-5 gap-2">
        {sqlDbs.map((db) => (
          <DbCard
            key={db.id}
            selected={sel.database.sql === db.id}
            radio
            onClick={() => update((s) => setSqlDatabase(s, s.database.sql === db.id ? null : db.id))}
            mark={<Mark id={db.id} />}
            title={db.label}
            detail={`port ${db.port.preferred}`}
          />
        ))}
        <DbCard
          selected={!sel.database.sql}
          radio
          onClick={() => update((s) => setSqlDatabase(s, null))}
          mark={<span className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-dashed border-line-strong text-fg-3"><Slash size={13} /></span>}
          title="Yok"
          detail="ilişkisel yok"
        />
      </div>

      {sel.database.sql && (
        <div className="enter mt-3 flex items-center gap-3">
          <span className="text-[12px] text-fg-2">Şema yönetimi</span>
          <Segmented
            size="sm"
            label="Şema yönetimi"
            value={sel.database.migration}
            onChange={(v) => update((s) => ({ ...s, database: { ...s.database, migration: v } }))}
            options={[
              { value: 'flyway', label: 'Flyway', hint: 'SQL dosyalarıyla' },
              { value: 'liquibase', label: 'Liquibase', hint: 'YAML changelog' },
              { value: 'none', label: 'Yok', hint: 'Hibernate ddl-auto=update' },
            ]}
          />
        </div>
      )}

      <div className="mt-5 mb-2 text-[12px] font-medium text-fg-2">NoSQL <span className="font-normal text-fg-3">· istediğin kadar</span></div>
      <div className="grid grid-cols-3 gap-2">
        {nosqlDbs.map((db) => {
          const explicit = sel.database.nosql.includes(db.id);
          const viaNeed = !explicit && resolved.databases.includes(db.id);
          return (
            <DbCard
              key={db.id}
              selected={explicit || viaNeed}
              locked={viaNeed}
              onClick={() => !viaNeed && update((s) => toggleNoSqlDatabase(s, db.id))}
              mark={<Mark id={db.id} />}
              title={db.label}
              detail={viaNeed ? 'Önbellek ile eklendi' : db.description}
            />
          );
        })}
      </div>
    </Section>
  );
}

function DbCard({ selected, radio, locked, onClick, mark, title, detail }: {
  selected: boolean;
  radio?: boolean;
  locked?: boolean;
  onClick: () => void;
  mark: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role={radio ? 'radio' : 'checkbox'}
      aria-checked={selected}
      aria-disabled={locked}
      onClick={onClick}
      className={cx(
        'relative flex min-w-0 flex-col items-start gap-2 rounded-lg border p-2.5 text-left transition-colors duration-150',
        selected ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
        locked && 'cursor-default',
      )}
    >
      <div className="flex w-full items-start justify-between">
        {mark}
        <Checkbox checked={selected} radio={radio} disabled={locked} />
      </div>
      <div className="w-full min-w-0">
        <div className="truncate text-[13px] font-medium text-fg">{title}</div>
        <div className="truncate text-[11.5px] text-fg-2" title={detail}>{detail}</div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------

function FrontendSection({ sel, update, pv, hoverKit }: SectionProps & { hoverKit: string | null }) {
  const pinFrontend = () => pv.pin({ kind: 'frontend' });
  const fw = sel.frontend.framework ? findFramework(sel.frontend.framework) : null;
  // Sadece frontend projesinde framework seçmek zorunlu, "Yok" seçeneği gösterilmez.
  // Yayınlama (Vercel) sadece backend'siz projede gösterilir: Vercel Spring Boot çalıştırmaz.
  const backend = hasBackend(sel);
  const groups = fw
    ? (Object.keys(OPTION_GROUPS) as OptionGroup[])
      .filter((g) => fw.options.some((o) => o.group === g))
      .filter((g) => !(backend && g === 'deploy'))
    : [];

  return (
    <Section id="frontend" title="Frontend" meta={fw ? `${sel.frontend.options.length} seçenek` : 'Sadece backend'}>
      <div role="radiogroup" aria-label="Frontend framework" className={cx('grid gap-2', backend ? 'grid-cols-5' : 'grid-cols-4')}>
        {backend && (
          <DbCard
            selected={!fw}
            radio
            onClick={() => update((s) => setFramework(s, null))}
            mark={<span className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-dashed border-line-strong text-fg-3"><Slash size={13} /></span>}
            title="Yok"
            detail="sadece API"
          />
        )}
        {FRAMEWORKS.map((f) => (
          <HelpPopover key={f.id} title={f.label} help={FRAMEWORK_HELP[f.id]} className="flex min-w-0 [&>button]:w-full">
          <DbCard
            selected={sel.frontend.framework === f.id}
            radio
            onClick={() => {
              update((s) => setFramework(s, f.id as FrameworkId));
              pinFrontend();
            }}
            mark={<Mark id={f.id} />}
            title={f.label}
            detail={FRAMEWORK_DETAIL[f.id]}
          />
          </HelpPopover>
        ))}
      </div>

      {fw && (
        <div key={fw.id} className="enter mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
          {groups.map((group) => {
            const { label, exclusive } = OPTION_GROUPS[group];
            return (
              <div key={group} className="flex items-start gap-3 px-3.5 py-2.5">
                <div className="w-[118px] shrink-0 pt-[5px] text-[12px] text-fg-2">
                  {label}
                  {exclusive && <span className="block text-[11px] text-fg-3">birini seç</span>}
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {fw.options.filter((o) => o.group === group).map((o) => {
                    const on = sel.frontend.options.includes(o.id);
                    return (
                      <HelpPopover
                        key={o.id}
                        title={o.label}
                        help={FRONTEND_OPTION_HELP[o.id]}
                        visual={group === 'ui' ? <KitSwatch kitId={o.id} /> : undefined}
                        className="inline-flex"
                      >
                      <button
                        type="button"
                        role={exclusive ? 'radio' : 'checkbox'}
                        aria-checked={on}
                        onMouseEnter={() => {
                          if (group !== 'ui') return;
                          pv.setHoverKit(o.id);
                          pv.setHoverTarget({ kind: 'frontend' });
                        }}
                        onMouseLeave={() => {
                          pv.setHoverKit(null);
                          pv.setHoverTarget(null);
                        }}
                        onClick={() => {
                          update((s) => toggleFrontendOption(s, o.id));
                          pinFrontend();
                        }}
                        className={cx(
                          'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors duration-150',
                          on ? 'border-accent-line bg-accent-soft text-fg' : 'border-line text-fg-2 hover:border-line-strong hover:text-fg',
                        )}
                      >
                        <Checkbox checked={on} radio={exclusive} />
                        {o.label}
                      </button>
                      </HelpPopover>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!pv.wide && (
        <UiPreview framework={sel.frontend.framework} options={sel.frontend.options} hoverKit={hoverKit} projectName={sel.name} backend={backend} />
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function ServicesSection({ sel, update, resolved, pv }: SectionProps) {
  const hover = (id: string | null) => pv.setHoverTarget(id ? { kind: 'service', id } : null);
  const toggle = (id: string) => {
    if (!sel.services.includes(id)) pv.pin({ kind: 'service', id });
    update((x) => toggleService(x, id));
  };
  const available = availableServices(resolved);
  const suggested = suggestedServices(resolved);
  const categories = [...new Set(available.map((s) => s.category))];

  return (
    <Section id="servisler" title="Ek servisler" meta={`${resolved.services.length} seçili · compose.yaml içine eklenir`}>
      {suggested.length > 0 && (
        <div className="enter mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent-line/50 bg-accent-soft px-3 py-2">
          <span className="text-[12px] text-fg-2">Seçimlerine göre öneriler</span>
          {suggested.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseEnter={() => hover(s.id)}
              onMouseLeave={() => hover(null)}
              onClick={() => toggle(s.id)}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-surface px-2 text-[12px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--accent-line)]"
            >
              <Plus size={12} strokeWidth={2.5} /> {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category}>
            <div className="mb-1.5 text-[12px] font-medium text-fg-2">{category}</div>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {available.filter((s) => s.category === category).map((s) => {
                const on = sel.services.includes(s.id);
                const port = s.ports.find((p) => p.web) ?? s.ports[0];
                const requires = s.requires?.map((r) => findService(r).label).join(', ');
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onMouseEnter={() => hover(s.id)}
                      onMouseLeave={() => hover(null)}
                      onClick={() => toggle(s.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-surface-2/60"
                    >
                      <Checkbox checked={on} />
                      <HelpPopover
                        title={s.label}
                        help={SERVICE_HELP[s.id]}
                        visual={pv.wide ? undefined : <ServiceThumb id={s.id} resolved={resolved} />}
                        className="min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
                          {s.label}
                          {suggested.some((x) => x.id === s.id) && <Tag tone="accent">önerilen</Tag>}
                        </div>
                        <div className="truncate text-[12px] text-fg-2">
                          {s.description}{requires && ` · ${requires} ile birlikte`}
                        </div>
                      </HelpPopover>
                      <span className="font-mono text-[11.5px] text-fg-3 tabular">:{port.preferred}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {SERVICES.length > available.length && (
        <p className="mt-2 text-[12px] text-fg-3">Veritabanı arayüzleri (pgAdmin, Mongo Express…) ilgili veritabanını seçince görünür.</p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

/** Ayar sayfasının başı: hangi kitin kurulduğu, kit renginde */
function KitHeader({ sel }: { sel: Selection }) {
  const kit = findKit(projectKindOf(sel));
  const Icon = kit.icon;
  return (
    <header className="flex items-center gap-3.5 pt-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `var(--kit-${kit.id})`, color: kit.id === 'python' ? 'var(--kit-python-ink)' : '#fff' }}
      >
        <Icon size={21} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] leading-tight font-bold text-fg">{kit.label}</h1>
        <p className="truncate text-[13.5px] text-fg-2">{kit.tagline}</p>
      </div>
    </header>
  );
}

function PythonTemplateSection({ sel, update }: SectionProps) {
  return (
    <Section id="sablon" title="Ne yapacaksın?" meta="Seçenekler şablona göre değişir">
      <div role="radiogroup" aria-label="Python şablonu" className="grid grid-cols-3 gap-3">
        {PYTHON_TEMPLATES.map((t) => {
          const selected = sel.python.template === t.id;
          return (
            <HelpPopover key={t.id} title={t.label} help={t.help} className="flex min-w-0 [&>button]:w-full">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update((s) => setPythonTemplate(s, t.id))}
                className={cx(
                  'flex min-h-[148px] flex-col rounded-xl border p-3.5 text-left transition-colors duration-150',
                  selected ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="font-display text-[17px] leading-tight font-bold text-fg">{t.label}</span>
                  <Checkbox checked={selected} radio />
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-fg-2">{t.description}</p>
                <div className="mt-auto flex flex-wrap gap-1 pt-3">
                  {t.includes.map((part) => <Tag key={part}>{part}</Tag>)}
                </div>
              </button>
            </HelpPopover>
          );
        })}
      </div>
    </Section>
  );
}

function PythonOptionsSection({ sel, update }: SectionProps) {
  const template = findPythonTemplate(sel.python.template);
  const active = pythonOptionsOf(sel);
  return (
    <Section id="python-secenekler" title="Seçenekler" meta={`${active.size} seçili`}>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {template.options.map((id) => {
          const option = findPythonOption(id);
          const on = active.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => update((s) => togglePythonOption(s, id))}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2/60"
              >
                <Checkbox checked={on} />
                <HelpPopover title={option.label} help={option.help} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
                    {option.label}
                    {option.help.level === 'Önerilir' && <Tag tone="ok">önerilir</Tag>}
                  </div>
                  <div className="truncate text-[12.5px] text-fg-2">{option.description}</div>
                </HelpPopover>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function OptionsSection({ sel, update, tools, issues }: SectionProps) {
  const dockerOff = tools && !tools.docker;
  const needsAuthor = Boolean(sel.git && tools && tools.git && !tools.gitIdentity);
  return (
    <Section id="kurulum" title="Kurulum">
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {isPython(sel) ? (
          <OptionRow
            title="Sanal ortamı kur ve paketleri indir"
            detail={!tools || tools.python
              ? `.venv oluşturulur, paketler kurulur${pythonOptionsOf(sel).has('tests') ? ', testler bir kez çalıştırılır' : ''}`
              : "Python 3.10+ bulunamadı. Proje yine oluşur; Python'u kurduktan sonra README'deki komutlarla kurarsın."}
            warn={Boolean(tools && !tools.python && sel.python.install)}
            checked={sel.python.install}
            onChange={(v) => update((s) => ({ ...s, python: { ...s.python, install: v } }))}
          />
        ) : (
          <OptionRow
            title="Oluşturunca Docker ile başlat"
            detail={dockerOff
              ? 'Docker Desktop çalışmıyor. Proje yine oluşur, sonra kendin başlatabilirsin.'
              : 'docker compose up; hazır olunca adresleri gösterir'}
            warn={Boolean(dockerOff && sel.start)}
            checked={sel.start}
            onChange={(v) => update((s) => ({ ...s, start: v }))}
          />
        )}
        <OptionRow
          title="Git deposu başlat"
          detail={needsAuthor
            ? 'İlk commit için bir kez ad ve e-posta gerekiyor'
            : 'İlk commit bu bilgisayardaki git kimliğinle atılır, hesap sorulmaz'}
          checked={sel.git}
          onChange={(v) => update((s) => ({ ...s, git: v }))}
        />
        {needsAuthor && (
          <li className="px-3.5 py-3">
            <div className="text-[12px] text-warn">
              Bu bilgisayarda git için ad ve e-posta tanımlı değil; ilk commit için gerekli. Sadece bu projeye yazılır.
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                aria-label="Git adı"
                placeholder="Ad Soyad"
                value={sel.gitAuthor?.name ?? ''}
                onChange={(e) => update((s) => ({ ...s, gitAuthor: { name: e.target.value, email: s.gitAuthor?.email ?? '' } }))}
                className={inputClass}
              />
              <input
                aria-label="Git e-postası"
                type="email"
                placeholder="ornek@mail.com"
                value={sel.gitAuthor?.email ?? ''}
                onChange={(e) => update((s) => ({ ...s, gitAuthor: { name: s.gitAuthor?.name ?? '', email: e.target.value } }))}
                className={inputClass}
              />
            </div>
          </li>
        )}
        {sel.git && <RemoteChooser sel={sel} update={update} tools={tools} issue={issues.find((i) => i.field === 'remote')} />}
      </ul>
    </Section>
  );
}

/**
 * İlk commit'ten sonra projenin nereye gideceği. Hepsi bilgisayardaki git'in kayıtlı girişini kullanır:
 * "yeni depo" o girişle GitHub'da depo açar, "açtığım depo" ise kullanıcının elle açtığı boş depoya gönderir.
 */
function RemoteChooser({ sel, update, tools, issue }: Pick<SectionProps, 'sel' | 'update' | 'tools'> & { issue?: ValidationIssue }) {
  const remote = sel.gitRemote;
  const account = tools?.github ?? null;
  const set = (patch: Partial<Selection['gitRemote']>) => update((s) => ({ ...s, gitRemote: { ...s.gitRemote, ...patch } }));
  // Boş adres henüz hata değil, yapılacak iş: kırmızı yerine nötr ipucu
  const urlError = remote.url.trim() ? issue?.message : undefined;

  const choices: { mode: Selection['gitRemote']['mode']; title: string; detail: string; disabled?: boolean }[] = [
    { mode: 'local', title: 'Sadece bu bilgisayarda', detail: 'Uzak depo yok; istediğin zaman kendin bağlarsın' },
    {
      mode: 'github',
      title: "GitHub'da yeni depo aç",
      detail: account
        ? `${account} hesabında, ${sel.name || 'proje'} adıyla; bu bilgisayardaki GitHub girişiyle`
        : 'Bu bilgisayarda kayıtlı GitHub girişi yok. Terminalde bir kez git push yapınca açılır.',
      disabled: Boolean(tools && !account),
    },
    { mode: 'url', title: 'Açtığım depoya gönder', detail: "GitHub'da boş bir depo aç, adresini buraya yapıştır" },
  ];

  return (
    <li className="bg-surface-2/40 px-3.5 py-3">
      <div role="radiogroup" aria-label="Uzak depo" className="space-y-1">
        {choices.map((c) => {
          const on = remote.mode === c.mode;
          return (
            <div key={c.mode}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                disabled={c.disabled}
                onClick={() => set({ mode: c.mode })}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <span className="mt-0.5"><Checkbox radio checked={on} disabled={c.disabled} /></span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-[13px] font-medium', c.disabled ? 'text-fg-3' : 'text-fg')}>{c.title}</span>
                  <span className={cx('block text-[12px]', c.disabled ? 'text-warn' : 'text-fg-2')}>{c.detail}</span>
                </span>
              </button>

              {on && c.mode === 'github' && (
                <div className="mt-1 mb-1 ml-9 flex items-center gap-3">
                  <Segmented
                    size="sm"
                    label="Depo görünürlüğü"
                    value={remote.private ? 'private' : 'public'}
                    options={[{ value: 'private', label: 'Gizli' }, { value: 'public', label: 'Herkese açık' }]}
                    onChange={(v) => set({ private: v === 'private' })}
                  />
                  <span className="text-[12px] text-fg-3">{remote.private ? 'Sadece sen görürsün' : 'Portfolyoda gösterilebilir'}</span>
                </div>
              )}

              {on && c.mode === 'url' && (
                <div className="mt-1 mb-1 ml-9">
                  <input
                    aria-label="Depo adresi"
                    spellCheck={false}
                    autoFocus
                    placeholder="https://github.com/kullanici/depo.git"
                    value={remote.url}
                    // github.com/... diye yapıştırılan adrese https:// eklenir
                    onChange={(e) => set({ url: e.target.value.trim().replace(/^(github\.com|gitlab\.com)\//, 'https://$1/') })}
                    className={cx(inputClass, 'font-mono text-[12.5px]', urlError && 'border-danger focus:border-danger focus:ring-danger-soft')}
                    aria-invalid={!!urlError}
                  />
                  <p className={cx('mt-1.5 text-[12px]', urlError ? 'text-danger' : 'text-fg-3')}>
                    {urlError ?? 'Depoyu README ya da lisans eklemeden aç; doluysa gönderim reddedilir.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </li>
  );
}

function OptionRow({ title, detail, checked, onChange, warn }: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warn?: boolean;
}) {
  return (
    <li className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5" onClick={() => onChange(!checked)}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        <div className={cx('text-[12px]', warn ? 'text-warn' : 'text-fg-2')}>{detail}</div>
      </div>
      <Toggle label={title} checked={checked} onChange={onChange} />
    </li>
  );
}
