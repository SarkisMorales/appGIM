import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUI } from '../store/useStore.ts';
import { addDays, dayLabel, todayISO } from '../lib/dates.ts';
import { cx } from './ui.tsx';

export function DateNav({ className }: { className?: string }) {
  const date = useUI((s) => s.date);
  const setDate = useUI((s) => s.setDate);
  const today = todayISO();
  const isToday = date === today;
  return (
    <div className={cx('flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-card', className)}>
      <button aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2">
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setDate(today)} className="min-w-20 px-1 text-center text-[13px] font-bold" title="Ir a hoy">
        {dayLabel(date, today).split(',')[0]}
      </button>
      <button aria-label="Día siguiente" disabled={isToday} onClick={() => setDate(addDays(date, 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-30">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
