import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LIBRARIES } from '../../../core/catalog/libraries';
import type { InitializrCatalog } from '../../../core/initializr';
import { toggleDependency } from '../../../core/selection';
import type { ResolvedProject, Selection } from '../../../core/types';
import { Checkbox, cx, inputClass, Section, Tag } from '../ui';

interface Props {
  sel: Selection;
  update: (fn: (sel: Selection) => Selection) => void;
  resolved: ResolvedProject;
  catalog: InitializrCatalog | null;
}

/** Spring Initializr'ın tüm kataloğu: aranabilir, gruplu. İhtiyaçlardan gelenler kilitli gösterilir. */
export function PackagesSection({ sel, update, resolved, catalog }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const total = catalog?.groups.reduce((n, g) => n + g.dependencies.length, 0) ?? 0;
  const selectedCount = resolved.dependencies.length + resolved.libraries.length;

  const groups = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLocaleLowerCase('tr');
    return catalog.groups
      .map((g) => ({
        ...g,
        dependencies: q
          ? g.dependencies.filter((d) => `${d.name} ${d.id} ${d.description}`.toLocaleLowerCase('tr').includes(q))
          : g.dependencies,
      }))
      .filter((g) => g.dependencies.length > 0);
  }, [catalog, query]);

  const libraries = LIBRARIES.filter((l) => {
    const q = query.trim().toLocaleLowerCase('tr');
    return !q || `${l.label} ${l.description}`.toLocaleLowerCase('tr').includes(q);
  });

  return (
    <Section id="paketler" title="Tüm Spring paketleri">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex w-full items-center gap-3 border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-line-strong',
          open ? 'rounded-t-lg' : 'rounded-lg',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-fg">
            <span className="tabular">{selectedCount}</span> paket seçili
          </div>
          <div className="truncate font-mono text-[11.5px] text-fg-3">
            {resolved.dependencies.join(' · ')}
          </div>
        </div>
        <span className="shrink-0 text-[12px] text-fg-2 tabular">{total} paket</span>
        <ChevronDown size={16} className={cx('shrink-0 text-fg-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="enter rounded-b-lg border border-t-0 border-line bg-surface">
          <div className="sticky top-0 z-10 border-b border-line bg-surface p-2.5">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paket ara: kafka, oauth, graphql…"
                className={cx(inputClass, 'pl-8')}
              />
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto px-2 pb-2">
            {libraries.length > 0 && (
              <PackageGroup title="Initializr dışı kütüphaneler">
                {libraries.map((lib) => {
                  const viaNeed = resolved.libraries.includes(lib.id) && !sel.backend.libraries.includes(lib.id);
                  const on = resolved.libraries.includes(lib.id);
                  return (
                    <PackageRow
                      key={lib.id}
                      name={lib.label}
                      id={`${lib.groupId}:${lib.artifactId}`}
                      description={lib.description}
                      checked={on}
                      source={viaNeed ? 'API dokümantasyonu' : undefined}
                      onToggle={() => update((s) => {
                        const libs = s.backend.libraries.includes(lib.id)
                          ? s.backend.libraries.filter((l) => l !== lib.id)
                          : [...s.backend.libraries, lib.id];
                        return { ...s, backend: { ...s.backend, libraries: libs } };
                      })}
                    />
                  );
                })}
              </PackageGroup>
            )}

            {groups.map((group) => (
              <PackageGroup key={group.name} title={group.name}>
                {group.dependencies.map((d) => {
                  const source = resolved.dependencySources[d.id];
                  const locked = Boolean(source && source !== 'Elle seçildi');
                  return (
                    <PackageRow
                      key={d.id}
                      name={d.name}
                      id={d.id}
                      description={d.description}
                      checked={Boolean(source)}
                      source={locked ? source : undefined}
                      onToggle={() => !locked && update((s) => toggleDependency(s, d.id))}
                    />
                  );
                })}
              </PackageGroup>
            ))}

            {groups.length === 0 && libraries.length === 0 && (
              <p className="px-2 py-8 text-center text-[12.5px] text-fg-2">
                "{query}" için paket bulunamadı. Adının bir kısmını ya da Initializr id'sini dene.
              </p>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function PackageGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <div className="px-1.5 pb-1.5 text-[12px] font-semibold text-fg-2">{title}</div>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </div>
  );
}

function PackageRow({ name, id, description, checked, source, onToggle }: {
  name: string;
  id: string;
  description: string;
  checked: boolean;
  source?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={Boolean(source)}
      onClick={onToggle}
      title={description}
      className={cx(
        'flex min-w-0 items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150',
        checked ? 'bg-accent-soft' : 'hover:bg-surface-2',
        source && 'cursor-default',
      )}
    >
      <span className="pt-[2px]"><Checkbox checked={checked} disabled={Boolean(source)} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-medium text-fg">{name}</span>
          {source && <Tag tone="accent">{source}</Tag>}
        </span>
        <span className="block truncate font-mono text-[11px] text-fg-3">{id}</span>
      </span>
    </button>
  );
}
