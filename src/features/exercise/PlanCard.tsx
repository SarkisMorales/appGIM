import { CalendarDays, CheckCircle2, Clock, Flame, Play, Beef, Moon } from 'lucide-react';
import { useStore, useUI } from '../../store/useStore.ts';
import { planForDate, useRoutines } from '../../store/derived.ts';
import { estimateSession, postWorkoutProtein, sessionExerciseIds } from '../../lib/training.ts';
import { getExercise } from '../../data/exercises.ts';
import { Button, Card, cx } from '../../components/ui.tsx';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';
import { navigate } from '../../lib/router.ts';
import { fmt } from '../../lib/format.ts';
import { WEEKDAYS, WEEKDAYS_SHORT, todayISO, weekday } from '../../lib/dates.ts';

export function PlanCard({ date }: { date?: string }) {
  const plan = useStore((s) => s.plan);
  const workouts = useStore((s) => s.workouts);
  const profile = useStore((s) => s.profile)!;
  const uiDate = useUI((s) => s.date);
  const routines = useRoutines();
  const d = date ?? uiDate;
  const p = planForDate(plan, routines, workouts, d);

  if (!plan || !p) {
    return (
      <Card className="relative overflow-hidden">
        <div className="grad-fit absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl" />
        <div className="text-xs font-bold uppercase tracking-wide text-fit">Entrenamiento</div>
        <div className="mt-1 text-lg font-extrabold">Elegí tu plan semanal</div>
        <p className="mt-1 text-[13px] text-ink-2">Rutinas para principiante, intermedio y avanzado con calorías, proteína y tiempo calculados para vos.</p>
        <Button variant="fit" className="mt-3" onClick={() => navigate('ejercicio/rutinas')}>
          Ver rutinas
        </Button>
      </Card>
    );
  }

  const est = estimateSession(p.session, profile.weightKg, getExercise);
  const firstEx = sessionExerciseIds(p.session)[0];
  const anim = firstEx ? getExercise(firstEx)?.anim : undefined;
  const today = todayISO();
  const isToday = d === today;
  const wd = weekday(d);

  return (
    <Card className="relative overflow-hidden p-0">
      <div className="flex gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-fit">
            <CalendarDays size={14} />
            {p.doneToday ? 'Hecho hoy' : p.isTrainingDay ? (isToday ? 'Hoy te toca' : `${WEEKDAYS[wd - 1]} te toca`) : 'Día de descanso'}
          </div>
          <div className="mt-1 truncate text-lg font-extrabold">{p.isTrainingDay || p.doneToday ? p.session.name : 'Recuperación activa'}</div>
          <div className="truncate text-[13px] text-ink-2">
            {p.isTrainingDay || p.doneToday ? `${p.routine.name} · ${p.session.focus}` : `Próxima: ${WEEKDAYS[p.nextDayLabel - 1]} · ${p.session.name}`}
          </div>
          {(p.isTrainingDay || p.doneToday) && (
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-ink-2">
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-ink-3" />~{fmt(est.minutes)} min
              </span>
              <span className="flex items-center gap-1">
                <Flame size={14} className="text-fit" />~{fmt(est.kcal)} kcal
              </span>
              <span className="flex items-center gap-1">
                <Beef size={14} className="text-pro" />
                {postWorkoutProtein(profile.weightKg)} g prot. después
              </span>
            </div>
          )}
        </div>
        <div className="h-24 w-24 shrink-0 rounded-2xl bg-surface-2">
          {p.isTrainingDay || p.doneToday ? <ExerciseFigure anim={anim} playing={!p.doneToday} className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-ink-3"><Moon size={30} /></div>}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <div className="flex flex-1 gap-1">
          {WEEKDAYS_SHORT.map((l, i) => (
            <span
              key={i}
              className={cx(
                'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                plan.days.includes(i + 1) ? 'bg-fit-soft text-fit' : 'text-ink-3',
                i + 1 === wd && 'ring-2 ring-fit',
              )}
            >
              {l}
            </span>
          ))}
        </div>
        {p.doneToday ? (
          <span className="flex items-center gap-1 text-sm font-bold text-ok">
            <CheckCircle2 size={18} /> Listo
          </span>
        ) : p.isTrainingDay ? (
          <Button variant="fit" size="sm" onClick={() => navigate(`entrenar/${p.routine.id}/${p.session.id}`)}>
            <Play size={16} fill="currentColor" /> Empezar
          </Button>
        ) : (
          <Button variant="soft" size="sm" onClick={() => navigate(`rutina/movilidad-core`)}>
            Movilidad
          </Button>
        )}
      </div>
    </Card>
  );
}
