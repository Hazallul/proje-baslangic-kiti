import { Moon, Sun } from 'lucide-react';
import type { ProjectKind } from '../../core/types';
import type { ToolStatus } from '../../shared/bridge';
import appIcon from '../../../build/icon.png';
import { allRequirements, kitRequirements } from './kits';
import { cx } from './ui';

export function TitleBar({ crumb, kit, tools, theme, onToggleTheme, onRecheck }: {
  crumb: string;
  /** Açık olan kit; açılış ekranında null */
  kit: ProjectKind | null;
  tools: ToolStatus | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRecheck: () => void;
}) {
  // Açık kit varsa onun ihtiyaçları, açılış ekranında hepsi; tıklayınca yeniden kontrol edilir
  // (ör. Docker Desktop uygulama açıldıktan sonra başlatıldıysa)
  const requirements = kit ? kitRequirements(kit, tools) : allRequirements(tools);

  return (
    // Sağdaki 140px Windows'un kendi pencere düğmeleri için boş bırakılır
    <header className="drag flex h-10 shrink-0 items-center gap-3 border-b border-line bg-bg pr-[148px] pl-3.5">
      <img src={appIcon} alt="" className="h-[22px] w-[22px]" draggable={false} />
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-semibold">create-hazal-app</span>
        <span className="text-fg-3">/</span>
        {kit && <span aria-hidden className="h-2 w-2 rounded-[3px]" style={{ background: `var(--kit-${kit})` }} />}
        <span className="text-fg-2">{crumb}</span>
      </div>
      <div className="flex-1" />
      {requirements.length > 0 && (
        <button
          type="button"
          onClick={onRecheck}
          title="Tekrar kontrol et"
          className="no-drag flex h-7 items-center gap-3 rounded-md px-2 text-[12.5px] text-fg-2 hover:bg-surface-2 hover:text-fg"
        >
          {requirements.map((r) => (
            <span key={r.label} title={r.hint} className={cx('flex items-center gap-1.5', !r.ok && 'text-warn')}>
              <span className={cx('h-1.5 w-1.5 rounded-full', r.ok ? 'bg-ok' : 'bg-warn')} />
              {r.ok ? r.label : `${r.label} yok`}
            </span>
          ))}
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
