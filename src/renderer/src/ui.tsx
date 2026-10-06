import { Check, Info } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HelpText } from '../../core/catalog/help';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------

export function Section({ id, title, meta, hint, children }: {
  id: string;
  title: string;
  meta?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 pt-7 first:pt-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.005em] text-fg">
          {title}
          {hint && (
            <span title={hint} className="text-fg-3">
              <Info size={13} strokeWidth={2} />
            </span>
          )}
        </h2>
        {meta && <div className="text-[12px] text-fg-2">{meta}</div>}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-fg-2">
      {children}
    </label>
  );
}

export const inputClass =
  'h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-3 hover:border-line-strong focus:border-accent-line focus:ring-3 focus:ring-accent-soft';

// ---------------------------------------------------------------------------

export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        'relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={cx(
          'absolute left-[2px] h-[14px] w-[14px] rounded-full shadow-sm transition-transform duration-200 ease-out',
          checked ? 'translate-x-[14px] bg-white' : 'translate-x-0 bg-white',
        )}
      />
    </button>
  );
}

export function Checkbox({ checked, disabled, radio }: { checked: boolean; disabled?: boolean; radio?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center border transition-colors duration-150',
        radio ? 'rounded-full' : 'rounded-[4px]',
        checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface',
        disabled && 'opacity-55',
      )}
    >
      {checked && (radio ? <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" /> : <Check size={11} strokeWidth={3.25} />)}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', label }: {
  value: T;
  options: { value: T; label: ReactNode; hint?: string; help?: HelpText }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-surface p-[3px]">
      {options.map((o) => (
        <HelpPopover key={o.value} title={typeof o.label === 'string' ? o.label : o.value} help={o.help} className="inline-flex">
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.help ? undefined : o.hint}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-[5px] font-medium transition-colors duration-150',
            size === 'sm' ? 'h-6 px-2.5 text-[12px]' : 'h-[28px] px-3 text-[12.5px]',
            value === o.value ? 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--border-strong)]' : 'text-fg-2 hover:text-fg',
          )}
        >
          {o.label}
        </button>
        </HelpPopover>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-accent text-accent-ink hover:bg-accent-hover',
        variant === 'secondary' && 'border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2',
        variant === 'ghost' && 'text-fg-2 hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'border border-line bg-surface text-danger hover:border-danger hover:bg-danger-soft',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[4px] border border-current/25 px-1.5 py-px font-mono text-[10.5px] font-medium opacity-80">
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------

/** Veritabanı ve framework'ler için marka renginde kısaltma rozeti */
const MARKS: Record<string, { text: string; color: string }> = {
  mysql: { text: 'My', color: '#2d8ab3' },
  postgresql: { text: 'Pg', color: '#4f7fb6' },
  mariadb: { text: 'Ma', color: '#c0765a' },
  sqlserver: { text: 'SQ', color: '#d6453d' },
  mongodb: { text: 'Mo', color: '#4ea94b' },
  redis: { text: 'Re', color: '#e0453a' },
  elasticsearch: { text: 'Es', color: '#14a89c' },
  react: { text: 'Re', color: '#38bdf8' },
  vue: { text: 'Vu', color: '#42b883' },
  angular: { text: 'Ng', color: '#e23d5b' },
  svelte: { text: 'Sv', color: '#ff5a1f' },
};

export function Mark({ id, size = 28 }: { id: string; size?: number }) {
  const mark = MARKS[id];
  if (!mark) return null;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[6px] font-mono font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        color: mark.color,
        background: `color-mix(in srgb, ${mark.color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${mark.color} 28%, transparent)`,
      }}
    >
      {mark.text}
    </span>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'warn' }) {
  return (
    <span
      className={cx(
        'inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-fg-2',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

const LEVEL_TONE: Record<HelpText['level'], 'ok' | 'neutral' | 'warn'> = {
  Önerilir: 'ok',
  'İhtiyaç olursa': 'neutral',
  'İleri seviye': 'warn',
};

/**
 * Üzerine gelince (veya klavyeyle odaklanınca) "Nedir / Ne zaman" açıklama kartı gösterir.
 * Kart body'ye çizilir; kaydırılan veya taşması gizlenen kutuların içinde kesilmez.
 */
export function HelpPopover({ title, help, children, className, visual }: {
  title: string;
  help?: HelpText;
  /** Metnin üstünde gösterilecek görsel örnek (ör. UI kütüphanesinin görünümü) */
  visual?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const id = useId();

  if (!help) return <span className={className}>{children}</span>;

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const above = r.bottom + (visual ? 260 : 200) > window.innerHeight;
      setPos({
        x: Math.min(Math.max(r.left, 12), window.innerWidth - 340),
        y: above ? r.top - 8 : r.bottom + 8,
        above,
      });
    }, 300);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={pos ? id : undefined}
    >
      {children}
      {pos && createPortal(
        <div
          id={id}
          role="tooltip"
          style={{ left: pos.x, top: pos.y, transform: pos.above ? 'translateY(-100%)' : undefined }}
          className="enter pointer-events-none fixed z-50 w-[320px] rounded-lg border border-line-strong bg-surface p-3.5 text-left shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-fg">{title}</span>
            <Tag tone={LEVEL_TONE[help.level]}>{help.level}</Tag>
          </div>
          {visual}
          <div className="text-[11px] font-medium text-fg-3">Nedir?</div>
          <p className="mb-2 text-[12.5px] leading-relaxed text-fg">{help.what}</p>
          <div className="text-[11px] font-medium text-fg-3">Ne zaman seçmeli?</div>
          <p className="text-[12.5px] leading-relaxed text-fg-2">{help.when}</p>
        </div>,
        document.body,
      )}
    </span>
  );
}
