import { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { ACTIVITIES, type Activity } from '../../data/activities.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { kcalFromMet, netKcalFromMet } from '../../lib/training.ts';
import { searchBy } from '../../lib/search.ts';
import { Button, Chip, Sheet, Stepper, cx, inputCls } from '../../components/ui.tsx';
import { fmt, fmt1, fmtMinutes } from '../../lib/format.ts';
import { dayLabel } from '../../lib/dates.ts';

export default function ActivitySheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const profile = useStore((s) => s.profile)!;
  const addWorkout = useStore((s) => s.addWorkout);
  const removeWorkout = useStore((s) => s.removeWorkout);
  const toast = useUI((s) => s.toast);
  const [act, setAct] = useState<Activity | null>(null);
  const [opt, setOpt] = useState(0);
  const [min, setMin] = useState(30);
  const [q, setQ] = useState('');

  const pick = (a: Activity) => {
    setAct(a);
    setOpt(a.options.length >= 3 ? 1 : 0);
    setMin(a.defaultMin);
  };
  const list = q.trim() ? searchBy(ACTIVITIES, q, (a) => a.name, (a) => a.options.map((o) => o.label).join(' ')) : ACTIVITIES;
  const o = act?.options[opt];
  const kcal = o ? kcalFromMet(o.met, profile.weightKg, min) : 0;
  const net = o ? netKcalFromMet(o.met, profile.weightKg, min) : 0;
  const bonus = Math.round(net * profile.exerciseBack);

  const save = () => {
    if (!act || !o) return;
    const w = addWorkout({
      date,
      kind: 'actividad',
      title: act.name,
      subtitle: o.label,
      activityId: act.id,
      startedAt: Date.now(),
      durationMin: min,
      met: o.met,
      kcal: Math.round(kcal),
      netKcal: Math.round(net),
    });
    toast(`${act.emoji} ${act.name}: +${fmt(bonus)} kcal a tu objetivo`, { action: { label: 'Deshacer', run: () => removeWorkout(w.id) } });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full={!act}
      accent="var(--fit)"
      title={
        act ? (
          <button onClick={() => setAct(null)} className="-ml-1 flex items-center gap-1 text-lg font-bold">
            <ChevronLeft size={22} /> {act.emoji} {act.name}
          </button>
        ) : (
          'Registrar actividad'
        )
      }
    >
      {!act ? (
        <div>
          <div className="relative mb-3">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className={cx(inputCls, 'pl-10')} placeholder="Caminar, fútbol, pádel, natación…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {list.map((a) => (
              <button key={a.id} onClick={() => pick(a)} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-3 text-center active:scale-95">
                <span className="text-3xl">{a.emoji}</span>
                <span className="text-[12px] font-bold leading-tight">{a.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-3">Valores MET del Compendio de Actividades Físicas para Adultos 2024. Las calorías se estiman con tu peso actual.</p>
        </div>
      ) : (
        <div>
          <div className="text-[13px] font-semibold text-ink-2">Intensidad</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {act.options.map((op, i) => (
              <Chip key={op.code + i} active={opt === i} onClick={() => setOpt(i)}>
                {op.label}
              </Chip>
            ))}
          </div>
          <div className="mt-5 text-[13px] font-semibold text-ink-2">Duración</div>
          <Stepper className="mt-2" size="lg" value={min} onChange={setMin} step={5} min={5} max={480} format={(v) => fmtMinutes(v)} />
          <div className="mt-2 flex gap-2">
            {[15, 30, 45, 60, 90].map((m) => (
              <button key={m} onClick={() => setMin(m)} className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold', min === m ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-3')}>
                {m}′
              </button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-fit-soft p-3">
              <div className="text-xs font-semibold text-ink-3">Quemás aprox.</div>
              <div className="num text-2xl font-extrabold text-fit">{fmt(kcal)} kcal</div>
              <div className="text-[11px] text-ink-3">
                MET {fmt1(o!.met)} · código {o!.code}
              </div>
            </div>
            <div className="rounded-2xl bg-food-soft p-3">
              <div className="text-xs font-semibold text-ink-3">Se suma a tu comida</div>
              <div className="num text-2xl font-extrabold text-food">+{fmt(bonus)} kcal</div>
              <div className="text-[11px] text-ink-3">netas (sin el gasto en reposo)</div>
            </div>
          </div>
          <Button variant="fit" size="lg" block className="mt-5" onClick={save}>
            Guardar en {dayLabel(date).toLowerCase()}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
