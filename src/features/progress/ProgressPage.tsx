import { useMemo } from 'react';
import { Award, Beef, Brain, Dumbbell, Flame, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore, useUI } from '../../store/useStore.ts';
import { computeDay, computeStreak } from '../../store/derived.ts';
import { adaptiveTdee, baseTargets, bmi } from '../../lib/nutrition.ts';
import { Button, Card, Empty, PageHeader, ProgressBar, SectionTitle, Stat, cx } from '../../components/ui.tsx';
import { WeightChart, WeekBars, type DayBar } from '../../components/charts.tsx';
import { fmt, fmt1 } from '../../lib/format.ts';
import { lastNDays, todayISO } from '../../lib/dates.ts';

function bmiLabel(b: number) {
  if (b < 18.5) return 'Bajo peso';
  if (b < 25) return 'Saludable';
  if (b < 30) return 'Sobrepeso';
  return 'Obesidad';
}

export default function ProgressPage() {
  const profile = useStore((s) => s.profile)!;
  const weights = useStore((s) => s.weights);
  const entries = useStore((s) => s.entries);
  const workouts = useStore((s) => s.workouts);
  const water = useStore((s) => s.water);
  const openSheet = useUI((s) => s.openSheet);
  const today = todayISO();

  const week = useMemo(() => lastNDays(today, 7).map((d) => computeDay(profile, d, entries, workouts, water)), [profile, entries, workouts, water, today]);
  const bars: DayBar[] = week.map((d) => ({ date: d.date, kcal: d.consumed.kcal, target: d.targets.kcal, exercise: d.targets.bonus, logged: d.entries.length > 0 }));
  const logged = week.filter((d) => d.entries.length > 0);
  const avg = (f: (d: (typeof week)[number]) => number) => (logged.length ? logged.reduce((a, d) => a + f(d), 0) / logged.length : 0);
  const weekMin = week.reduce((a, d) => a + d.exerciseMin, 0);
  const weekWorkouts = week.reduce((a, d) => a + d.workouts.length, 0);
  const proteinDays = week.filter((d) => d.consumed.protein >= d.targets.protein * 0.9).length;

  const last28 = useMemo(
    () =>
      lastNDays(today, 28).map((d) => {
        const es = entries.filter((e) => e.date === d);
        return { date: d, kcal: es.reduce((a, e) => a + e.kcal, 0), logged: es.length > 0 };
      }),
    [entries, today],
  );
  const adaptive = adaptiveTdee(last28, weights);
  const base = baseTargets(profile);

  const pts = weights.slice(-60);
  const first = weights[0];
  const lastW = weights[weights.length - 1];
  const change = first && lastW ? lastW.kg - first.kg : 0;
  const goal = profile.targetWeightKg;
  const goalProgress = goal && first ? Math.max(0, Math.min(1, (first.kg - lastW.kg) / (first.kg - goal))) : 0;

  const streak = computeStreak(entries, workouts);
  const totalDaysLogged = new Set(entries.map((e) => e.date)).size;
  const waterDays = week.filter((d) => d.water >= d.targets.waterMl).length;
  const badges = [
    { id: 'first', t: 'Primer registro', d: 'Cargaste tu primera comida', ok: entries.length > 0, e: '🍽️' },
    { id: 'routine', t: 'Primera rutina', d: 'Completaste un entrenamiento guiado', ok: workouts.some((w) => w.kind === 'rutina'), e: '💪' },
    { id: 'streak7', t: 'Racha de 7', d: '7 días seguidos registrando', ok: streak >= 7, e: '🔥' },
    { id: 'ten', t: '10 entrenamientos', d: 'Constancia que se nota', ok: workouts.length >= 10, e: '🏅' },
    { id: 'protein', t: 'Proteína al día', d: '5 de 7 días cumpliendo proteína', ok: proteinDays >= 5, e: '🥩' },
    { id: 'who', t: '150 minutos', d: 'Meta semanal de la OMS', ok: weekMin >= 150, e: '🌍' },
    { id: 'water', t: 'Bien hidratado', d: '5 días con tu meta de agua', ok: waterDays >= 5, e: '💧' },
    { id: 'month', t: 'Un mes', d: '30 días con comidas registradas', ok: totalDaysLogged >= 30, e: '🗓️' },
  ];

  return (
    <div className="anim-fade">
      <PageHeader title="Progreso" subtitle="Tu evolución, semana a semana" />

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Peso actual</div>
            <div className="num text-3xl font-extrabold">
              {fmt1(lastW?.kg ?? profile.weightKg)} <span className="text-base font-bold text-ink-3">kg</span>
            </div>
            {first && weights.length > 1 && (
              <div className={cx('flex items-center gap-1 text-sm font-bold', change <= 0 ? 'text-ok' : 'text-ink-2')}>
                {change <= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                {change > 0 ? '+' : ''}
                {fmt1(change)} kg desde el inicio
              </div>
            )}
          </div>
          <Button variant="bal" size="sm" onClick={() => openSheet({ kind: 'weight' })}>
            <Scale size={16} /> Registrar
          </Button>
        </div>
        {goal && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-ink-3">
              <span>Meta: {fmt1(goal)} kg</span>
              <span>{Math.round(goalProgress * 100)}%</span>
            </div>
            <ProgressBar value={goalProgress} max={1} color="var(--bal)" />
          </div>
        )}
        <div className="mt-4">{pts.length >= 2 ? <WeightChart points={pts} goal={goal} /> : <p className="text-sm text-ink-3">Registrá tu peso al menos dos veces para ver el gráfico de tendencia.</p>}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="IMC" value={fmt1(bmi({ ...profile, weightKg: lastW?.kg ?? profile.weightKg }))} unit={bmiLabel(bmi(profile))} />
          <Stat label="Basal" value={fmt(base.bmr)} unit="kcal/día" />
        </div>
      </Card>

      <SectionTitle>Últimos 7 días</SectionTitle>
      <Card>
        <WeekBars days={bars} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Promedio kcal" value={fmt(avg((d) => d.consumed.kcal))} unit={`/ ${fmt(avg((d) => d.targets.kcal))}`} icon={<Flame size={12} />} />
          <Stat label="Proteína media" value={fmt(avg((d) => d.consumed.protein))} unit="g" icon={<Beef size={12} />} />
          <Stat label="Entrenamientos" value={weekWorkouts} unit={`· ${fmt(weekMin)} min`} icon={<Dumbbell size={12} />} />
          <Stat label="Días registrados" value={`${logged.length}/7`} icon={<Award size={12} />} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs font-semibold text-ink-3">
            <span>Actividad semanal (OMS recomienda 150 min)</span>
            <span className="num">{fmt(weekMin)} / 150</span>
          </div>
          <ProgressBar value={weekMin} max={150} color="var(--d-ex)" />
        </div>
      </Card>

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Brain size={16} className="text-bal" /> Tu gasto real
        </span>
      </SectionTitle>
      <Card>
        {adaptive ? (
          <div>
            <div className="num text-3xl font-extrabold">
              {fmt(adaptive.tdee)} <span className="text-base font-bold text-ink-3">kcal/día</span>
            </div>
            <p className="mt-1 text-[13px] text-ink-2">
              Estimado con lo que comiste y cómo cambió tu peso en {adaptive.days} días registrados (confianza {adaptive.confidence}). La fórmula decía {fmt(base.tdee)} kcal sin ejercicio.
            </p>
            {Math.abs(adaptive.tdee - base.tdee) > 150 && (
              <p className="mt-2 rounded-xl bg-bal-soft p-2 text-xs text-ink-2">
                Tu metabolismo real parece {adaptive.tdee > base.tdee ? 'más alto' : 'más bajo'} que la fórmula. Si en 2 semanas más se mantiene, podés ajustar tu objetivo en Perfil → Objetivos.
              </p>
            )}
          </div>
        ) : (
          <Empty
            title="Aprendiendo de vos…"
            text="Con 10+ días de comidas registradas y al menos 2 pesajes separados por 10 días, calculamos tu gasto real (como las apps premium, pero gratis)."
          />
        )}
      </Card>

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Award size={16} className="text-carb" /> Logros
        </span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {badges.map((b) => (
          <div key={b.id} className={cx('rounded-2xl border p-3', b.ok ? 'border-carb/40 bg-surface' : 'border-line bg-surface-2 opacity-60')}>
            <div className={cx('text-2xl', !b.ok && 'grayscale')}>{b.e}</div>
            <div className="mt-1 text-[13px] font-bold">{b.t}</div>
            <div className="text-[11px] text-ink-3">{b.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
