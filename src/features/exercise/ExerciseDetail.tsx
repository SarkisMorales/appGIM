import { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Gauge, Pause, Play, Video } from 'lucide-react';
import { useStore } from '../../store/useStore.ts';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, getExercise } from '../../data/exercises.ts';
import { Badge, Card, Empty, PageHeader, SectionTitle } from '../../components/ui.tsx';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';
import { kcalFromMet, oneRepMax } from '../../lib/training.ts';
import { navigate } from '../../lib/router.ts';
import { fmt, fmt1 } from '../../lib/format.ts';
import { shortDate } from '../../lib/dates.ts';

export function ExerciseInfo({ id, compact }: { id: string; compact?: boolean }) {
  const ex = getExercise(id);
  if (!ex) return null;
  return (
    <div className="space-y-3">
      <Card>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-3">Paso a paso</div>
        <ol className="space-y-2">
          {ex.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-snug">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fit-soft text-xs font-extrabold text-fit">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-3">Claves</div>
        <ul className="space-y-1.5">
          {ex.tips.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14px]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" />
              {t}
            </li>
          ))}
          {!compact &&
            ex.mistakes?.map((m, i) => (
              <li key={'m' + i} className="flex gap-2 text-[14px]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
                Evitá: {m.charAt(0).toLowerCase() + m.slice(1)}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

export default function ExerciseDetail({ id }: { id?: string }) {
  const ex = id ? getExercise(id) : undefined;
  const kg = useStore((s) => s.profile?.weightKg ?? 70);
  const workouts = useStore((s) => s.workouts);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  if (!ex) {
    return (
      <div>
        <PageHeader title="Ejercicio" back="ejercicio/biblioteca" />
        <Empty title="No encontramos este ejercicio" />
      </div>
    );
  }
  const history = workouts
    .flatMap((w) => (w.exercises ?? []).filter((e) => e.exId === ex.id).map((e) => ({ date: w.date, sets: e.sets.filter((s) => s.done) })))
    .filter((h) => h.sets.length)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const best = history.flatMap((h) => h.sets).reduce((a, s) => Math.max(a, oneRepMax(s.weight ?? 0, s.reps ?? 0)), 0);
  const met = ex.met ?? (ex.category === 'movilidad' ? 2.3 : ex.category === 'core' ? 3.8 : 5.0);
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} técnica correcta`)}`;

  return (
    <div className="anim-fade">
      <PageHeader title={ex.name} subtitle={ex.muscles.map((m) => MUSCLE_LABEL[m]).join(' · ')} back="ejercicio/biblioteca" />
      <Card className="relative overflow-hidden p-0">
        <div className="aspect-square bg-surface-2">
          <ExerciseFigure anim={ex.anim} playing={playing} speed={speed} className="h-full w-full" title={`Animación: ${ex.name}`} />
        </div>
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button onClick={() => setSpeed(speed === 1 ? 0.5 : 1)} className="flex h-10 items-center gap-1 rounded-full bg-surface/90 px-3 text-xs font-bold shadow-card" aria-label="Velocidad">
            <Gauge size={16} /> {speed === 1 ? '1×' : '0,5×'}
          </button>
          <button onClick={() => setPlaying(!playing)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 shadow-card" aria-label={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge className="bg-surface/90">{ex.category === 'fuerza' ? '💪 Fuerza' : ex.category === 'cardio' ? '❤️ Cardio' : ex.category === 'core' ? '🎯 Core' : '🧘 Movilidad'}</Badge>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ex.muscles.map((m) => (
          <Badge key={m} className="bg-fit-soft text-fit">
            {MUSCLE_LABEL[m]}
          </Badge>
        ))}
        {ex.secondary?.map((m) => (
          <Badge key={m}>{MUSCLE_LABEL[m]}</Badge>
        ))}
        {ex.equipment.map((e) => (
          <Badge key={e} className="bg-bal-soft text-bal">
            {EQUIPMENT_LABEL[e]}
          </Badge>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-surface-2 p-3 text-[13px]">
          <div className="font-semibold text-ink-3">10 min de este ejercicio</div>
          <div className="num text-xl font-extrabold text-fit">≈ {fmt(kcalFromMet(met, kg, 10))} kcal</div>
          <div className="text-[11px] text-ink-3">MET {fmt1(met)} · {fmt1(kg)} kg</div>
        </div>
        <a href={yt} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[13px] font-bold">
          <Video size={22} className="text-danger" /> Ver videos de técnica
        </a>
      </div>

      <div className="mt-3">
        <ExerciseInfo id={ex.id} />
      </div>

      {(ex.easier || ex.harder) && (
        <>
          <SectionTitle>Progresiones</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {ex.easier && (
              <button onClick={() => navigate(`ej/${ex.easier}`)} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-left">
                <ArrowDown size={18} className="text-food" />
                <span className="text-[13px]">
                  <span className="block text-ink-3">Más fácil</span>
                  <b>{getExercise(ex.easier)?.name}</b>
                </span>
              </button>
            )}
            {ex.harder && (
              <button onClick={() => navigate(`ej/${ex.harder}`)} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-left">
                <ArrowUp size={18} className="text-fit" />
                <span className="text-[13px]">
                  <span className="block text-ink-3">Más difícil</span>
                  <b>{getExercise(ex.harder)?.name}</b>
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>Tu historial</SectionTitle>
          <Card className="divide-y divide-line py-1">
            {best > 0 && <div className="py-2 text-[13px]">Mejor 1RM estimado: <b>{fmt1(best)} kg</b></div>}
            {history.slice(0, 6).map((h, i) => (
              <div key={i} className="flex justify-between py-2 text-[13px]">
                <span className="font-semibold">{shortDate(h.date)}</span>
                <span className="num text-ink-3">{h.sets.map((s) => (s.sec ? `${s.sec}s` : `${s.reps ?? '-'}${s.weight ? `×${fmt1(s.weight)}` : ''}`)).join(' · ')}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
