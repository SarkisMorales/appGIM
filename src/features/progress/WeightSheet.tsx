import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore, useUI } from '../../store/useStore.ts';
import { Button, Field, Sheet, Stepper, inputCls } from '../../components/ui.tsx';
import { fmt1 } from '../../lib/format.ts';
import { shortDate, todayISO } from '../../lib/dates.ts';
import { baseTargets } from '../../lib/nutrition.ts';

export default function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const weights = useStore((s) => s.weights);
  const setWeight = useStore((s) => s.setWeight);
  const removeWeight = useStore((s) => s.removeWeight);
  const toast = useUI((s) => s.toast);
  const last = weights[weights.length - 1]?.kg ?? profile.weightKg;
  const [kg, setKg] = useState(Math.round(last * 10) / 10);
  const [date, setDate] = useState(todayISO());
  const before = baseTargets(profile).kcal;
  const after = baseTargets({ ...profile, weightKg: kg }).kcal;
  return (
    <Sheet open={open} onClose={onClose} title="Registrar peso" accent="var(--bal)">
      <Stepper size="lg" value={kg} onChange={setKg} step={0.1} min={30} max={300} format={(v) => `${fmt1(v)} kg`} />
      <div className="mt-2 flex justify-center gap-2">
        {[-1, -0.5, 0.5, 1].map((d) => (
          <button key={d} onClick={() => setKg(Math.round((kg + d) * 10) / 10)} className="rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink-2">
            {d > 0 ? '+' : ''}
            {fmt1(d)}
          </button>
        ))}
      </div>
      <Field label="Fecha" className="mt-4">
        <input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {after !== before && <p className="mt-3 text-xs text-ink-3">Tu objetivo diario se recalcula: {before} → {after} kcal.</p>}
      <Button
        variant="bal"
        size="lg"
        block
        className="mt-4"
        onClick={() => {
          setWeight(date, kg);
          toast('Peso guardado ✓');
          onClose();
        }}
      >
        Guardar
      </Button>
      <p className="mt-3 text-xs text-ink-3">Consejo: pesate a la mañana, en ayunas y después de ir al baño. Mirá la tendencia, no el número de un día.</p>
      {weights.length > 0 && (
        <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {[...weights]
            .reverse()
            .slice(0, 8)
            .map((w) => (
              <div key={w.date} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-ink-2">{shortDate(w.date)}</span>
                <span className="num font-bold">{fmt1(w.kg)} kg</span>
                <button aria-label="Eliminar pesaje" onClick={() => removeWeight(w.date)} className="p-1 text-ink-3 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
      )}
    </Sheet>
  );
}
