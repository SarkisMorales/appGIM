import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import { useUI } from '../store/useStore.ts';
import { goBack } from '../lib/router.ts';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------- Card ----------------
export function Card({ children, className, onClick, as = 'div' }: { children: ReactNode; className?: string; onClick?: () => void; as?: 'div' | 'button' | 'section' }) {
  const Tag = as as 'div';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'rounded-3xl border border-line bg-surface p-4 shadow-card',
        onClick && 'w-full cursor-pointer text-left transition active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2 mt-6 flex items-center justify-between px-1', className)}>
      <h2 className="text-[15px] font-bold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

// ---------------- Button ----------------
type Variant = 'primary' | 'food' | 'fit' | 'bal' | 'soft' | 'ghost' | 'danger' | 'outline';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:opacity-90',
  food: 'grad-food text-white shadow-[0_6px_20px_-6px_var(--food)]',
  fit: 'grad-fit text-white shadow-[0_6px_20px_-6px_var(--fit)]',
  bal: 'grad-bal text-white shadow-[0_6px_20px_-6px_var(--bal)]',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; block?: boolean }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.97] disabled:opacity-40',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-14 px-6 text-base',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cx('inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface-2 active:scale-95', className)}
    >
      {children}
    </button>
  );
}

// ---------------- Chip / Pill ----------------
export function Chip({ active, children, onClick, className, color }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active && color ? { background: color, borderColor: color } : undefined}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95',
        active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
        active && color && 'text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span style={style} className={cx('inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2', className)}>
      {children}
    </span>
  );
}

// ---------------- Segmented ----------------
export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex rounded-2xl bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Progreso ----------------
export function ProgressBar({ value, max, color, className, height = 8 }: { value: number; max: number; color: string; className?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-surface-3', className)} style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} />
    </div>
  );
}

export interface RingSpec {
  value: number;
  max: number;
  color: string;
  track?: string;
}

/** Anillos concéntricos estilo "actividad". */
export function Rings({ rings, size = 180, stroke = 14, gap = 4, children }: { rings: RingSpec[]; size?: number; stroke?: number; gap?: number; children?: ReactNode }) {
  const c = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {rings.map((r, i) => {
          const radius = c - stroke / 2 - i * (stroke + gap);
          const circ = 2 * Math.PI * radius;
          const pct = r.max > 0 ? Math.min(1, r.value / r.max) : 0;
          return (
            <g key={i}>
              <circle cx={c} cy={c} r={radius} fill="none" stroke={r.track ?? 'var(--surface-3)'} strokeWidth={stroke} />
              {pct > 0 && (
                <circle
                  cx={c}
                  cy={c}
                  r={radius}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${circ * pct} ${circ}`}
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.2,.9,.25,1)' }}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ---------------- Stepper ----------------
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format, className, size = 'md' }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => ReactNode; className?: string; size?: 'md' | 'lg' }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  const btn = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  return (
    <div className={cx('flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-1', className)}>
      <button type="button" aria-label="Menos" onClick={() => set(value - step)} className={cx(btn, 'flex items-center justify-center rounded-xl bg-surface text-ink shadow-card active:scale-95')}>
        <Minus size={18} />
      </button>
      <div className={cx('num min-w-16 text-center font-bold', size === 'lg' ? 'text-3xl' : 'text-lg')}>{format ? format(value) : value}</div>
      <button type="button" aria-label="Más" onClick={() => set(value + step)} className={cx(btn, 'flex items-center justify-center rounded-xl bg-surface text-ink shadow-card active:scale-95')}>
        <Plus size={18} />
      </button>
    </div>
  );
}

// ---------------- Campos ----------------
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 outline-none transition focus:border-bal focus:ring-2 focus:ring-bal/20';

export function NumberInput({ value, onChange, suffix, step = 1, min, max, className, placeholder, compact }: { value: number | ''; onChange: (v: number | '') => void; suffix?: string; step?: number; min?: number; max?: number; className?: string; placeholder?: string; compact?: boolean }) {
  return (
    <div className={cx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={cx(inputCls, 'num', suffix && 'pr-14', compact && 'px-2 text-center')}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {desc && <span className="block text-xs text-ink-3">{desc}</span>}
      </span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-surface-3 transition peer-checked:bg-food" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

// ---------------- Sheet (modal inferior) ----------------
// El botón/gesto "atrás" del teléfono cierra la ventana abierta en vez de salir de la pantalla.
const sheetStack: { id: number; close: () => void }[] = [];
let sheetSeq = 0;
let skipPops = 0;
let afterSettle: (() => void)[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skipPops > 0) {
      skipPops--;
      if (skipPops === 0) {
        const fns = afterSettle;
        afterSettle = [];
        fns.forEach((f) => f());
      }
      return;
    }
    sheetStack.pop()?.close();
  });
}

/** Ejecuta `fn` cuando terminó de cerrarse la ventana actual (para navegar sin ensuciar el historial). */
export function afterSheetClose(fn: () => void) {
  setTimeout(() => (skipPops > 0 ? afterSettle.push(fn) : fn()), 0);
}

export function Sheet({ open, onClose, title, children, footer, full, accent }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; full?: boolean; accent?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const entry = { id: ++sheetSeq, close: () => closeRef.current() };
    sheetStack.push(entry);
    window.history.pushState({ sheet: entry.id }, '');
    return () => {
      const i = sheetStack.indexOf(entry);
      if (i < 0) return; // ya la cerró el botón "atrás"
      sheetStack.splice(i, 1);
      if ((window.history.state as { sheet?: number } | null)?.sheet === entry.id) {
        skipPops++;
        window.history.back();
      }
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        className={cx(
          'anim-sheet relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-line bg-bg shadow-pop sm:rounded-[28px]',
          full ? 'h-[94dvh] sm:h-[88dvh]' : 'max-h-[90dvh]',
        )}
      >
        {accent && <div className="h-1 w-full" style={{ background: accent }} />}
        <div className="flex items-center gap-2 px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-surface-3 sm:hidden" />
          <div className="min-w-0 flex-1 pt-2 text-lg font-bold tracking-tight">{title}</div>
          <IconButton label="Cerrar" onClick={onClose} className="mt-1 bg-surface-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line bg-surface px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------- Cabecera de página ----------------
export function PageHeader({ title, subtitle, back, right, className }: { title: ReactNode; subtitle?: ReactNode; back?: string | boolean; right?: ReactNode; className?: string }) {
  return (
    <header className={cx('pt-safe sticky top-0 z-30 -mx-4 bg-bg/85 px-4 backdrop-blur-xl', className)}>
      <div className="flex min-h-14 items-center gap-2 py-2">
        {back !== undefined && back !== false && (
          <IconButton label="Volver" onClick={() => goBack(typeof back === 'string' ? back : '')} className="-ml-2">
            <ChevronLeft size={24} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold tracking-tight">{title}</h1>
          {subtitle && <div className="truncate text-[13px] text-ink-3">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

// ---------------- Estado vacío ----------------
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">{icon}</div>}
      <div className="font-bold">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-3">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------- Toasts ----------------
export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="anim-pop pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-pop">
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button
              className="font-bold text-food-2"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ---------------- Stat ----------------
export function Stat({ label, value, unit, icon, tone }: { label: string; value: ReactNode; unit?: string; icon?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        {icon}
        {label}
      </div>
      <div className="num mt-1 text-xl font-extrabold" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

export function MacroRow({ label, value, target, color, unit = 'g', extra }: { label: string; value: number; target: number; color: string; unit?: string; extra?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="num text-ink-3">
          <b className="text-ink">{Math.round(value)}</b> / {Math.round(target)} {unit}
          {extra}
        </span>
      </div>
      <ProgressBar value={value} max={target} color={color} />
    </div>
  );
}
