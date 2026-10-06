import { Moon, Sun } from 'lucide-react';
import type { ToolStatus } from '../../shared/bridge';
import { cx } from './ui';

export function TitleBar({ crumb, tools, theme, onToggleTheme, onRecheck }: {
  crumb: string;
  tools: ToolStatus | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRecheck: () => void;
}) {
  return (
    // Sağdaki 140px Windows'un kendi pencere düğmeleri için boş bırakılır
    <header className="drag flex h-10 shrink-0 items-center gap-3 border-b border-line bg-bg pr-[148px] pl-3.5">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-accent font-mono text-[12px] font-bold text-accent-ink">
        h
      </span>
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="font-semibold">create-hazal-app</span>
        <span className="text-fg-3">/</span>
        <span className="text-fg-2">{crumb}</span>
      </div>
      <div className="flex-1" />
      {tools && (
        <button
          type="button"
          onClick={onRecheck}
          title={tools.docker ? 'Docker Desktop çalışıyor' : 'Docker Desktop çalışmıyor. Açtıktan sonra tıklayıp tekrar kontrol et.'}
          className="no-drag flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2 hover:bg-surface-2 hover:text-fg"
        >
          <span className={cx('h-1.5 w-1.5 rounded-full', tools.docker ? 'bg-ok' : 'bg-warn')} />
          {tools.docker ? 'Docker' : 'Docker kapalı'}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-fg-2 hover:bg-surface-2 hover:text-fg"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </header>
  );
}
