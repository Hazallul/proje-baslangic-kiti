import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ResolvedProject, StepId } from '../../../core/types';
import { type PartGroup, partsOf } from '../parts';
import { buildTree, previewPorts, type TreeNode } from '../tree';
import { cx } from '../ui';
import type { StepStatus } from './ProgressView';

interface Line {
  prefix: string;
  node: TreeNode;
}

function flatten(node: TreeNode, prefix = '', isLast = true, root = true): Line[] {
  const lines: Line[] = [{ prefix: root ? '' : `${prefix}${isLast ? '└─ ' : '├─ '}`, node }];
  const childPrefix = root ? '' : `${prefix}${isLast ? '   ' : '│  '}`;
  node.children?.forEach((child, i) => {
    lines.push(...flatten(child, childPrefix, i === node.children!.length - 1, false));
  });
  return lines;
}

function countFiles(node: TreeNode): number {
  return node.children ? node.children.reduce((n, c) => n + countFiles(c), 0) : 1;
}

export function PreviewPane({ resolved, livePorts, assembly }: {
  resolved: ResolvedProject;
  livePorts: Record<string, number> | null;
  /** Oluşturma sırasında adımların durumu: parçalar adımları bitince çerçeveye takılır. Ayar ekranında null. */
  assembly: Partial<Record<StepId, StepStatus>> | null;
}) {
  const [treeOpen, setTreeOpen] = useState(true);
  const tree = buildTree(resolved);
  const lines = flatten(tree);
  const ports = previewPorts(resolved);
  const groups = partsOf(resolved);
  const partCount = groups.reduce((n, g) => n + g.parts.length, 0);

  return (
    <aside className="flex h-full w-[372px] shrink-0 flex-col border-l border-line bg-panel" aria-label="Kutudan çıkacaklar">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
        <h2 className="font-display text-[16px] font-bold">Kutudan çıkacaklar</h2>
        <div className="font-display text-[12.5px] font-semibold text-fg-3 tabular">
          {partCount} parça · {countFiles(tree)} dosya
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <PartsRunner groups={groups} assembly={assembly} />

        <button
          type="button"
          aria-expanded={treeOpen}
          onClick={() => setTreeOpen((o) => !o)}
          className="mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-fg-2 hover:text-fg"
        >
          <ChevronDown size={15} className={cx('transition-transform duration-200', !treeOpen && '-rotate-90')} />
          Dosya planı
        </button>
        {treeOpen && (
          <pre className="mt-2 font-mono text-[11.75px] leading-[1.75]">
            {lines.map(({ prefix, node }, i) => (
              <div key={i} className="whitespace-pre">
                <span className="text-line-strong">{prefix}</span>
                <span className={node.children ? 'font-semibold text-fg' : 'text-fg-2'}>{node.name}</span>
                {node.note && <span className="text-fg-3">{'  '}{node.note}</span>}
              </div>
            ))}
          </pre>
        )}
      </div>

      {ports.length > 0 && (
        <div className="shrink-0 border-t border-line px-5 pt-3.5 pb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">Servisler ve portlar</span>
            <span className="font-mono text-[11px] text-fg-3">localhost</span>
          </div>
          <ul className="space-y-1.5">
            {ports.map((p) => {
              const live = livePorts?.[p.envName];
              const moved = live !== undefined && live !== p.port;
              return (
                <li key={`${p.label}-${p.port}`} className="flex items-center gap-2 text-[13px]">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-fg-3" />
                  <span className="shrink-0 font-medium text-fg">{p.label}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-3">{moved ? `${p.port} dolu` : p.detail}</span>
                  <span className={moved ? 'font-mono text-warn tabular' : 'font-mono text-fg-2 tabular'}>:{live ?? p.port}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-[12px] text-fg-3">
            {ports.some((p) => livePorts?.[p.envName] !== undefined && livePorts[p.envName] !== p.port)
              ? 'Dolu portlar yerine sıradaki boş port kullanılacak (başka bir proje çalışıyor).'
              : 'Port doluysa oluştururken sıradaki boş port seçilir.'}
          </p>
        </div>
      )}
    </aside>
  );
}

/**
 * Maket kitindeki parça çerçevesi: ortadan geçen bir çubuk ve iki yanına kısa kollarla takılı numaralı
 * parçalar. Ayar ekranında seçilen parça yerine oturarak (snap) gelir; oluşturma sırasında parçalar önce
 * kesik çizgili bekler, ait oldukları adım bitince takılır.
 */
function PartsRunner({ groups, assembly }: { groups: PartGroup[]; assembly: Partial<Record<StepId, StepStatus>> | null }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.letter} aria-label={group.title} className="rounded-2xl border-2 border-line-strong/70 p-2.5">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent font-display text-[12.5px] font-bold text-accent-ink">
              {group.letter}
            </span>
            <span className="text-[12.5px] font-semibold text-fg-2">{group.title}</span>
          </div>
          {group.parts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong px-2.5 py-2 text-[12px] text-fg-3">{group.empty}</div>
          ) : (
            <ul className="relative grid grid-cols-2 gap-x-4 gap-y-1.5">
              {/* çerçevenin ortasından geçen çubuk */}
              <span aria-hidden className="absolute top-1 bottom-1 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-line-strong/70" />
              {group.parts.map((part, i) => {
                const status = assembly?.[part.step];
                const waiting = assembly !== null && status !== 'done';
                return (
                  <li
                    // takılınca yeniden çizilir, snap animasyonu o anda oynar
                    key={`${part.id}-${waiting ? 'bekliyor' : 'takili'}`}
                    className={cx(
                      'relative min-w-0 rounded-lg border px-2 py-1.5',
                      waiting ? 'border-dashed border-line-strong bg-transparent opacity-60' : 'snap border-line bg-surface shadow-card',
                      status === 'running' && 'border-accent-line opacity-100',
                    )}
                  >
                    {/* parçayı çubuğa bağlayan kısa kol */}
                    <span
                      aria-hidden
                      className={cx('absolute top-1/2 h-[2px] w-2 -translate-y-1/2 bg-line-strong/70', i % 2 === 0 ? '-right-2' : '-left-2')}
                    />
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-[12px] font-bold text-accent tabular">{part.number}</span>
                      <span className="line-clamp-2 text-[12.5px] leading-snug font-medium break-words text-fg">{part.label}</span>
                    </div>
                    {part.detail && <div className="line-clamp-2 text-[11.5px] leading-snug text-fg-3">{part.detail}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
