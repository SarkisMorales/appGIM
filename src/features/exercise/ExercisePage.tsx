import { useMemo, useState } from 'react';
import { Activity, Beef, ChevronRight, Clock, Dumbbell, Film, Flame, Home, Plus, Search, Trash2, Trophy, Building2 } from 'lucide-react';
import type { Level, Muscle, Routine, Workout } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { useRoutines } from '../../store/derived.ts';
import { LEVELS } from '../../data/routines.ts';
import { EXERCISES, MUSCLE_LABEL, getExercise } from '../../data/exercises.ts';
import { hasAnim } from '../../data/animations.ts';
import { oneRepMax, postWorkoutProtein, summarizeRoutine } from '../../lib/training.ts';
import { searchBy } from '../../lib/search.ts';
import { Badge, Button, Card, Chip, Empty, PageHeader, SectionTitle, Segmented, cx, inputCls } from '../../components/ui.tsx';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';
import { PlanCard } from './PlanCard.tsx';
import { navigate } from '../../lib/router.ts';
import { fmt, fmt1, fmtMinutes } from '../../lib/format.ts';
import { addDays, lastNDays, shortDate, startOfWeek, todayISO, WEEKDAYS_SHORT } from '../../lib/dates.ts';

const LEVEL_COLOR: Record<Level, string> = { principiante: '#10b26c', intermedio: '#f2a516', avanzado: '#ec4471' };
export const levelInfo = (l: Level) => LEVELS.find((x) => x.id === l)!;

export function RoutineCard({ r }: { r: Routine }) {
  const kg = useStore((s) => s.profile?.weightKg ?? 70);
  const plan = useStore((s) => s.plan);
  const sum = useMemo(() => summarizeRoutine(r, kg, getExercise, (id) => !!getExercise(id) && hasAnim(getExercise(id)!.anim)), [r, kg]);
  const firstEx = r.sessions[0]?.blocks[0];
  const anim = firstEx ? getExercise(firstEx.type === 'sets' ? firstEx.ex : firstEx.items[0].ex)?.anim : undefined;
  const active = plan?.routineId === r.id;
  return (
    <button onClick={() => navigate(`rutina/${r.id}`)} className="flex w-full gap-3 rounded-3xl border border-line bg-surface p-3.5 text-left shadow-card transition active:scale-[0.99]">
      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
        <ExerciseFigure anim={anim} playing={false} className="h-full w-full" />
        <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: LEVEL_COLOR[r.level] }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Badge style={{ background: `${LEVEL_COLOR[r.level]}22`, color: LEVEL_COLOR[r.level] }}>{levelInfo(r.level).label}</Badge>
          <Badge>
            {r.place === 'gimnasio' ? <Building2 size={11} /> : <Home size={11} />}
            {r.place === 'gimnasio' ? 'Gimnasio' : r.place === 'casa' ? 'Casa' : 'Casa o gym'}
          </Badge>
          {active && <Badge className="bg-fit-soft text-fit">Tu plan</Badge>}
        </div>
        <div className="mt-1 truncate text-[16px] font-extrabold leading-tight">{r.name}</div>
        <div className="truncate text-[13px] text-ink-3">{r.short}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-2">
          <span className="flex items-center gap-1">
            <Clock size={13} className="text-ink-3" />
            {fmt(sum.avgMinutes)} min
          </span>
          <span className="flex items-center gap-1">
            <Flame size={13} className="text-fit" />
            {fmt(sum.avgKcal)} kcal
          </span>
          <span className="flex items-center gap-1">
            <Beef size={13} className="text-pro" />
            {postWorkoutProtein(kg)} g
          </span>
          <span className="flex items-center gap-1">
            <Film size={13} className="text-bal" />
            {sum.animated === sum.totalExercises ? 'Animada' : `${sum.animated}/${sum.totalExercises} animados`}
          </span>
          <span className="text-ink-3">{r.daysPerWeek} días/sem</span>
        </div>
      </div>
    </button>
  );
}

function RoutinesTab() {
  const routines = useRoutines();
  const profile = useStore((s) => s.profile)!;
  const [level, setLevel] = useState<Level | 'todos'>('todos');
  const [place, setPlace] = useState<'todos' | 'casa' | 'gimnasio'>('todos');
  const list = routines.filter((r) => (level === 'todos' || r.level === level) && (place === 'todos' || r.place === place || r.place === 'ambos'));
  const custom = list.filter((r) => r.custom);
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Chip active={level === 'todos'} onClick={() => setLevel('todos')}>
          Todas
        </Chip>
        {LEVELS.map((l) => (
          <Chip key={l.id} active={level === l.id} color={LEVEL_COLOR[l.id]} onClick={() => setLevel(l.id)}>
            {l.emoji} {l.label}
          </Chip>
        ))}
      </div>
      <Segmented
        className="mt-2"
        value={place}
        onChange={setPlace}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'casa', label: '🏠 Casa' },
          { value: 'gimnasio', label: '🏋️ Gimnasio' },
        ]}
      />
      <p className="mt-3 px-1 text-xs text-ink-3">
        Calorías estimadas para tus {fmt1(profile.weightKg)} kg con METs del Compendio de Actividades Físicas 2024. Proteína: dosis recomendada después de entrenar (ISSN).
      </p>
      {LEVELS.filter((l) => level === 'todos' || level === l.id).map((l) => {
        const rs = list.filter((r) => r.level === l.id && !r.custom);
        if (!rs.length) return null;
        return (
          <div key={l.id}>
            <SectionTitle>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: LEVEL_COLOR[l.id] }} />
                {l.label}
                <span className="text-xs font-semibold text-ink-3">{rs.length} rutinas</span>
              </span>
            </SectionTitle>
            <p className="-mt-1 mb-2 px-1 text-xs text-ink-3">{l.desc}</p>
            <div className="space-y-2.5">
              {rs.map((r) => (
                <RoutineCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        );
      })}
      <SectionTitle action={<Button size="sm" variant="soft" onClick={() => navigate('crear-rutina')}><Plus size={16} /> Crear</Button>}>Mis rutinas</SectionTitle>
      {custom.length ? (
        <div className="space-y-2.5">
          {custom.map((r) => (
            <RoutineCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon={<Dumbbell />} title="Armá tu propia rutina" text="Elegí ejercicios de la biblioteca, series, repeticiones y descansos. La app calcula tiempo y calorías." action={<Button variant="fit" onClick={() => navigate('crear-rutina')}>Crear rutina</Button>} />
        </Card>
      )}
    </div>
  );
}

function LibraryTab() {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'todos'>('todos');
  const muscles: Muscle[] = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'core', 'gluteos', 'cuadriceps', 'isquios', 'gemelos', 'cardio', 'movilidad'];
  const base = muscle === 'todos' ? EXERCISES : EXERCISES.filter((e) => e.muscles.includes(muscle) || e.secondary?.includes(muscle));
  const list = q.trim() ? searchBy(base, q, (e) => e.name, (e) => e.muscles.join(' '), 100) : base;
  return (
    <div>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={cx(inputCls, 'pl-10')} placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Chip active={muscle === 'todos'} onClick={() => setMuscle('todos')}>
          Todos
        </Chip>
        {muscles.map((m) => (
          <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
            {MUSCLE_LABEL[m]}
          </Chip>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {list.map((e) => (
          <button key={e.id} onClick={() => navigate(`ej/${e.id}`)} className="overflow-hidden rounded-3xl border border-line bg-surface text-left shadow-card active:scale-[0.98]">
            <div className="aspect-square bg-surface-2">
              <ExerciseFigure anim={e.anim} playing={false} className="h-full w-full" />
            </div>
            <div className="p-2.5">
              <div className="line-clamp-2 text-[13px] font-bold leading-tight">{e.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-ink-3">{e.muscles.map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-ink-3">{EXERCISES.length} ejercicios, todos con animación propia (funciona sin internet).</p>
    </div>
  );
}

export function WorkoutRow({ w, onDelete }: { w: Workout; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white', w.kind === 'rutina' ? 'grad-fit' : 'grad-bal')}>
          {w.kind === 'rutina' ? <Dumbbell size={18} /> : <Activity size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{w.title}</span>
          <span className="block truncate text-xs text-ink-3">
            {shortDate(w.date)} · {fmtMinutes(w.durationMin)}
            {w.volumeKg ? ` · ${fmt(w.volumeKg)} kg levantados` : ''}
            {w.subtitle ? ` · ${w.subtitle}` : ''}
          </span>
        </span>
        <span className="num text-right text-sm font-extrabold text-fit">
          {fmt(w.kcal)}
          <span className="block text-[11px] font-semibold text-ink-3">kcal</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-3.5 py-3 text-[13px]">
          {w.exercises?.length ? (
            <div className="space-y-1.5">
              {w.exercises.map((ex, i) => (
                <div key={i} className="flex gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{ex.name}</span>
                  <span className="num text-ink-3">
                    {ex.sets
                      .filter((s) => s.done)
                      .map((s) => (s.sec ? `${s.sec}s` : `${s.reps ?? '-'}${s.weight ? `×${fmt1(s.weight)}` : ''}`))
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-ink-3">
              MET {fmt1(w.met)} · {fmt(w.netKcal)} kcal sumadas a tu objetivo
            </div>
          )}
          {onDelete && (
            <button onClick={onDelete} className="mt-3 flex items-center gap-1 text-xs font-bold text-danger">
              <Trash2 size={14} /> Eliminar registro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const workouts = useStore((s) => s.workouts);
  const removeWorkout = useStore((s) => s.removeWorkout);
  const toast = useUI((s) => s.toast);
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const thisWeek = workouts.filter((w) => w.date >= weekStart && w.date <= today);
  const weekMin = thisWeek.reduce((a, w) => a + w.durationMin, 0);
  const weekKcal = thisWeek.reduce((a, w) => a + w.kcal, 0);

  // Mapa de calor: 12 semanas
  const start = addDays(weekStart, -7 * 11);
  const days = lastNDays(addDays(weekStart, 6), 84).filter((d) => d >= start);
  const perDay = new Map<string, number>();
  workouts.forEach((w) => perDay.set(w.date, (perDay.get(w.date) || 0) + w.durationMin));
  const level = (m: number) => (m === 0 ? 0 : m < 20 ? 1 : m < 40 ? 2 : m < 60 ? 3 : 4);
  // Escala secuencial de un solo tono (más intenso = más minutos); funciona en claro y oscuro.
  const COLORS = ['var(--surface-3)', ...[30, 55, 78, 100].map((p) => `color-mix(in oklab, var(--d-ex) ${p}%, var(--surface-3))`)];

  // Récords (1RM estimado)
  const prs = new Map<string, { name: string; orm: number; weight: number; reps: number; date: string }>();
  workouts.forEach((w) =>
    w.exercises?.forEach((ex) =>
      ex.sets.forEach((s) => {
        if (!s.done || !s.weight || !s.reps) return;
        const orm = oneRepMax(s.weight, s.reps);
        const cur = prs.get(ex.exId);
        if (!cur || orm > cur.orm) prs.set(ex.exId, { name: ex.name, orm, weight: s.weight, reps: s.reps, date: w.date });
      }),
    ),
  );
  const sorted = [...workouts].sort((a, b) => (b.date === a.date ? b.startedAt - a.startedAt : b.date < a.date ? -1 : 1));

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="num text-2xl font-extrabold">{thisWeek.length}</div>
          <div className="text-[11px] font-semibold text-ink-3">entrenamientos</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="num text-2xl font-extrabold">{fmt(weekMin)}</div>
          <div className="text-[11px] font-semibold text-ink-3">min (meta OMS 150)</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="num text-2xl font-extrabold text-fit">{fmt(weekKcal)}</div>
          <div className="text-[11px] font-semibold text-ink-3">kcal esta semana</div>
        </Card>
      </div>

      <SectionTitle>Últimas 12 semanas</SectionTitle>
      <Card>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 pr-1">
            {WEEKDAYS_SHORT.map((d, i) => (
              <span key={i} className="flex h-4 items-center text-[9px] font-bold text-ink-3">
                {d}
              </span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
            {days.map((d) => (
              <span key={d} title={`${shortDate(d)}: ${fmt(perDay.get(d) || 0)} min`} className={cx('h-4 rounded', d === today && 'ring-2 ring-ink/40')} style={{ background: d > today ? 'transparent' : COLORS[level(perDay.get(d) || 0)] }} />
            ))}
          </div>
        </div>
      </Card>

      {prs.size > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <Trophy size={16} className="text-carb" /> Récords (1RM estimado)
            </span>
          </SectionTitle>
          <Card className="divide-y divide-line py-1">
            {[...prs.values()]
              .sort((a, b) => b.orm - a.orm)
              .slice(0, 8)
              .map((p) => (
                <div key={p.name} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="num text-xs text-ink-3">
                    {fmt1(p.weight)} kg × {p.reps}
                  </span>
                  <span className="num w-16 text-right text-sm font-extrabold">{fmt1(p.orm)} kg</span>
                </div>
              ))}
            <p className="pt-2 text-[11px] text-ink-3">Fórmula de Epley: peso × (1 + reps/30).</p>
          </Card>
        </>
      )}

      <SectionTitle>Historial</SectionTitle>
      {sorted.length ? (
        <div className="space-y-2">
          {sorted.slice(0, 60).map((w) => (
            <WorkoutRow
              key={w.id}
              w={w}
              onDelete={() => {
                removeWorkout(w.id);
                toast('Registro eliminado');
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon={<Activity />} title="Todavía no hay entrenamientos" text="Completá una rutina o registrá una actividad y la vas a ver acá." />
        </Card>
      )}
    </div>
  );
}

function TodayTab() {
  const openSheet = useUI((s) => s.openSheet);
  const date = useUI((s) => s.date);
  const workouts = useStore((s) => s.workouts).filter((w) => w.date === date);
  const removeWorkout = useStore((s) => s.removeWorkout);
  return (
    <div>
      <PlanCard date={date} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => openSheet({ kind: 'activity', date })} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left shadow-card active:scale-[0.98]">
          <span className="grad-bal flex h-10 w-10 items-center justify-center rounded-2xl text-white">
            <Activity size={20} />
          </span>
          <span className="text-[14px] font-bold leading-tight">
            Registrar actividad
            <span className="block text-xs font-medium text-ink-3">Caminar, fútbol, bici…</span>
          </span>
        </button>
        <button onClick={() => navigate('ejercicio/rutinas')} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left shadow-card active:scale-[0.98]">
          <span className="grad-fit flex h-10 w-10 items-center justify-center rounded-2xl text-white">
            <Dumbbell size={20} />
          </span>
          <span className="text-[14px] font-bold leading-tight">
            Elegir otra rutina
            <span className="block text-xs font-medium text-ink-3">Por nivel y lugar</span>
          </span>
        </button>
      </div>
      <SectionTitle action={<button onClick={() => navigate('ejercicio/historial')} className="flex items-center text-[13px] font-bold text-ink-3">Historial <ChevronRight size={16} /></button>}>
        Registrado en el día
      </SectionTitle>
      {workouts.length ? (
        <div className="space-y-2">
          {workouts.map((w) => (
            <WorkoutRow key={w.id} w={w} onDelete={() => removeWorkout(w.id)} />
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon={<Flame />} title="Nada por ahora" text="Cuando entrenes, las calorías se suman automáticamente a tu objetivo de comida." />
        </Card>
      )}
    </div>
  );
}

export default function ExercisePage({ tab }: { tab?: string }) {
  const current = (['hoy', 'rutinas', 'biblioteca', 'historial'].includes(tab ?? '') ? tab : 'hoy') as 'hoy' | 'rutinas' | 'biblioteca' | 'historial';
  return (
    <div className="anim-fade">
      <PageHeader title="Ejercicio" subtitle="Rutinas guiadas, actividades e historial" />
      <Segmented
        className="sticky top-[72px] z-20 mb-4"
        value={current}
        onChange={(v) => navigate(v === 'hoy' ? 'ejercicio' : `ejercicio/${v}`, { replace: true })}
        options={[
          { value: 'hoy', label: 'Hoy' },
          { value: 'rutinas', label: 'Rutinas' },
          { value: 'biblioteca', label: 'Ejercicios' },
          { value: 'historial', label: 'Historial' },
        ]}
      />
      {current === 'hoy' && <TodayTab />}
      {current === 'rutinas' && <RoutinesTab />}
      {current === 'biblioteca' && <LibraryTab />}
      {current === 'historial' && <HistoryTab />}
    </div>
  );
}
