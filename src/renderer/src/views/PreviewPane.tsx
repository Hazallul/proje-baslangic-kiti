import type { ResolvedProject } from '../../../core/types';
import { buildTree, previewPorts, type TreeNode } from '../tree';

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

export function PreviewPane({ resolved }: { resolved: ResolvedProject }) {
  const tree = buildTree(resolved);
  const lines = flatten(tree);
  const ports = previewPorts(resolved);

  return (
    <aside className="flex h-full w-[372px] shrink-0 flex-col border-l border-line bg-panel" aria-label="Canlı önizleme">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Canlı önizleme
        </div>
        <div className="font-mono text-[11px] text-fg-3 tabular">
          {countFiles(tree)} dosya · {ports.length} servis
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <pre className="font-mono text-[11.75px] leading-[1.75]">
          {lines.map(({ prefix, node }, i) => (
            <div key={i} className="whitespace-pre">
              <span className="text-line-strong">{prefix}</span>
              <span className={node.children ? 'font-semibold text-fg' : 'text-fg-2'}>{node.name}</span>
              {node.note && <span className="text-fg-3">{'  '}{node.note}</span>}
            </div>
          ))}
        </pre>
      </div>

      <div className="shrink-0 border-t border-line px-5 pt-3.5 pb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold">Servisler ve portlar</span>
          <span className="font-mono text-[11px] text-fg-3">localhost</span>
        </div>
        <ul className="space-y-1.5">
          {ports.map((p) => (
            <li key={`${p.label}-${p.port}`} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-1 w-1 shrink-0 rounded-full bg-fg-3" />
              <span className="shrink-0 font-medium text-fg">{p.label}</span>
              <span className="min-w-0 flex-1 truncate text-fg-3">{p.detail}</span>
              <span className="font-mono text-fg-2 tabular">:{p.port}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11.5px] text-fg-3">Port doluysa oluştururken sıradaki boş port seçilir.</p>
      </div>
    </aside>
  );
}
