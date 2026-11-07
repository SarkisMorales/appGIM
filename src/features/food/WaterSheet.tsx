import { Droplets, Minus, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore.ts';
import { useDay } from '../../store/derived.ts';
import { Button, ProgressBar, Sheet, cx } from '../../components/ui.tsx';
import { fmt, fmt1 } from '../../lib/format.ts';

const GLASS = 250;

export function WaterCard({ date, compact }: { date: string; compact?: boolean }) {
  const day = useDay(date);
  const addWater = useStore((s) => s.addWater);
  if (!day) return null;
  const target = day.targets.waterMl;
  const glasses = Math.ceil(target / GLASS);
  const filled = Math.floor(day.water / GLASS);
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-water/15 text-water">
            <Droplets size={18} />
          </span>
          <div>
            <div className="text-[15px] font-bold">Agua</div>
            <div className="num text-xs text-ink-3">
              {fmt1(day.water / 1000)} / {fmt1(target / 1000)} L{day.targets.bonusWater > 0 && <span className="text-fit"> (+{fmt(day.targets.bonusWater)} ml por ejercicio)</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button aria-label="Quitar un vaso" onClick={() => addWater(date, -GLASS)} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2 active:scale-95">
            <Minus size={16} />
          </button>
          <button aria-label="Sumar un vaso" onClick={() => addWater(date, GLASS)} className="flex h-9 w-9 items-center justify-center rounded-full bg-water text-white active:scale-95">
            <Plus size={16} />
          </button>
        </div>
      </div>
      {compact ? (
        <ProgressBar className="mt-3" value={day.water} max={target} color="var(--water)" />
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: Math.max(glasses, filled) }).map((_, i) => (
            <button
              key={i}
              aria-label={`Vaso ${i + 1}`}
              onClick={() => addWater(date, i < filled ? -GLASS * (filled - i) : GLASS * (i - filled + 1))}
              className={cx('flex h-9 w-7 items-end justify-center rounded-b-xl rounded-t-md border-2 transition', i < filled ? 'border-water bg-water/80' : 'border-line bg-surface-2')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WaterSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const addWater = useStore((s) => s.addWater);
  return (
    <Sheet open={open} onClose={onClose} title="Agua" accent="var(--water)">
      <WaterCard date={date} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[150, 250, 500].map((ml) => (
          <Button key={ml} variant="soft" onClick={() => addWater(date, ml)}>
            +{ml} ml
          </Button>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-3">Base: ~35 ml por kg de peso. Los días que entrenás sumamos ~500 ml por hora de ejercicio.</p>
    </Sheet>
  );
}
