import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore, useUI } from '../../store/useStore.ts';
import { Minus, Plus } from 'lucide-react';
import { Button, Field, Sheet, inputCls } from '../../components/ui.tsx';
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
  const [txt, setTxt] = useState(String(Math.round(last * 10) / 10).replace('.', ','));
  const parsed = parseFloat(txt.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed >= 30 && parsed <= 300;
  const kg = valid ? Math.round(parsed * 10) / 10 : Math.round(last * 10) / 10;
  const setKg = (v: number) => setTxt(String(Math.min(300, Math.max(30, Math.round(v * 10) / 10))).replace('.', ','));
  const [date, setDate] = useState(todayISO());
  const before = baseTargets(profile).kcal;
  const after = baseTargets({ ...profile, weightKg: kg }).kcal;
  return (
    <Sheet open={open} onClose={onClose} title="Registrar peso" accent="var(--bal)">
      <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-1">
        <button type="button" aria-label="Menos 0,1 kg" onClick={() => setKg(kg - 0.1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-ink shadow-card active:scale-95">
          <Minus size={18} />
        </button>
        <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input
            aria-label="Peso en kilos"
            inputMode="decimal"
            value={txt}
            onChange={(e) => setTxt(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 6))}
            onFocus={(e) => e.target.select()}
            className="num w-28 bg-transparent text-center text-3xl font-bold text-ink outline-none"
          />
          <span className="text-base font-bold text-ink-3">kg</span>
        </label>
        <button type="button" aria-label="Más 0,1 kg" onClick={() => setKg(kg + 0.1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-ink shadow-card active:scale-95">
          <Plus size={18} />
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-ink-3">{valid ? 'Tocá el número para escribirlo' : 'Escribí un peso entre 30 y 300 kg'}</p>
      <div className="mt-2 flex justify-center gap-2">
        {[-1, -0.5, 0.5, 1].map((d) => (
          <button key={d} onClick={() => setKg(kg + d)} className="rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink-2">
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
        disabled={!valid}
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
