import { Activity, Beef, ChevronRight, Dumbbell, Flame, Plus, Sparkles, Utensils, Zap } from 'lucide-react';
import { useStore, useUI } from '../../store/useStore.ts';
import { computeStreak, mealForNow, useDay, useFoodMap, type DayData } from '../../store/derived.ts';
import { EQUIVALENTS, minutesToBurn, per100, scaleMacros, suggestToClose } from '../../lib/nutrition.ts';
import { postWorkoutProtein } from '../../lib/training.ts';
import { Card, MacroRow, Rings, SectionTitle, cx } from '../../components/ui.tsx';
import { DateNav } from '../../components/DateNav.tsx';
import { PlanCard } from '../exercise/PlanCard.tsx';
import { WaterCard } from '../food/WaterSheet.tsx';
import { navigate } from '../../lib/router.ts';
import { fmt, fmtMinutes } from '../../lib/format.ts';
import { longDate, todayISO } from '../../lib/dates.ts';
import { Logo } from '../../components/Logo.tsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function BalanceCard({ day }: { day: DayData }) {
  const t = day.targets;
  const remaining = Math.round(day.remaining.kcal);
  const over = remaining < 0;
  const exTarget = 30;
  return (
    <Card className="relative overflow-hidden">
      <div className="grad-hero pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative">
        <div className="flex items-center gap-4">
          <Rings
            size={172}
            stroke={11}
            gap={3}
            rings={[
              { value: day.consumed.kcal, max: t.kcal, color: over ? 'var(--danger)' : 'var(--d-kcal)' },
              { value: day.consumed.protein, max: t.protein, color: 'var(--pro)' },
              { value: day.exerciseMin, max: exTarget, color: 'var(--d-ex)' },
            ]}
          >
            <div className="num text-[25px] font-extrabold leading-none tracking-tight" style={over ? { color: 'var(--danger)' } : undefined}>
              {fmt(Math.abs(remaining))}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-ink-3">{over ? 'kcal de más' : 'kcal restantes'}</div>
          </Rings>
          <div className="min-w-0 flex-1 space-y-2.5">
            {[
              { l: 'Calorías', v: `${fmt(day.consumed.kcal)} / ${fmt(t.kcal)}`, u: 'kcal', c: over ? 'var(--danger)' : 'var(--d-kcal)' },
              { l: 'Proteína', v: `${fmt(day.consumed.protein)} / ${fmt(t.protein)}`, u: 'g', c: 'var(--pro)' },
              { l: 'Ejercicio', v: `${fmt(day.exerciseMin)} / ${exTarget}`, u: 'min', c: 'var(--d-ex)' },
            ].map((r) => (
              <div key={r.l}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: r.c }} />
                  {r.l}
                </div>
                <div className="num text-[15px] font-bold">
                  {r.v} <span className="text-xs font-semibold text-ink-3">{r.u}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ecuación del balance: la fusión de los dos módulos */}
        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-surface-2/80 p-2 text-center">
          {[
            { l: 'Objetivo', v: t.base.kcal, c: 'var(--ink-3)', s: '' },
            { l: 'Comida', v: day.consumed.kcal, c: 'var(--d-kcal)', s: '−' },
            { l: 'Ejercicio', v: t.bonus, c: 'var(--d-ex)', s: '+' },
            { l: over ? 'Excedido' : 'Restante', v: Math.abs(remaining), c: over ? 'var(--danger)' : 'var(--bal)', s: '=' },
          ].map((x) => (
            <div key={x.l} className="relative">
              {x.s && <span className="absolute -left-1.5 top-2.5 text-xs font-bold text-ink-3">{x.s}</span>}
              <div className="num text-[15px] font-extrabold text-ink">{fmt(x.v)}</div>
              <div className="mx-auto mt-0.5 h-1 w-6 rounded-full" style={{ background: x.c }} />
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">{x.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <MacroRow label="Carbohidratos" value={day.consumed.carbs} target={t.carbs} color="var(--carb)" extra={t.bonusCarbs > 0 ? <span className="ml-1 text-fit">+{t.bonusCarbs}</span> : null} />
          <MacroRow label="Grasas" value={day.consumed.fat} target={t.fat} color="var(--fat)" />
          <MacroRow label="Fibra" value={day.consumed.fiber} target={t.fiber} color="var(--fib)" />
        </div>
      </div>
    </Card>
  );
}

function Insight({ icon, tone, title, children, action }: { icon: React.ReactNode; tone: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface-2 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: tone }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold leading-snug">{title}</div>
        {children && <div className="mt-0.5 text-[13px] text-ink-2">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** "Balance inteligente": conecta lo que comiste con lo que entrenaste. */
export function Insights({ day }: { day: DayData }) {
  const profile = useStore((s) => s.profile)!;
  const addEntry = useStore((s) => s.addEntry);
  const openSheet = useUI((s) => s.openSheet);
  const toast = useUI((s) => s.toast);
  const foods = useFoodMap();
  const kg = profile.weightKg;
  const items: React.ReactNode[] = [];
  const t = day.targets;
  const isToday = day.date === todayISO();

  if (day.workouts.length) {
    const prot = Math.max(...day.workouts.map((w) => w.proteinG ?? postWorkoutProtein(kg, w.met >= 5 ? 0.4 : w.met >= 3.2 && w.kind === 'rutina' ? 0.3 : 0.25)));
    items.push(
      <Insight key="ex" icon={<Flame size={18} />} tone="var(--fit)" title={`Entrenaste ${fmtMinutes(day.exerciseMin)} y quemaste ~${fmt(day.exerciseKcal)} kcal`}>
        Sumamos <b className="text-fit">+{fmt(t.bonus)} kcal</b> a tu objetivo de hoy (+{t.bonusCarbs} g de carbohidratos y +{t.bonusFat} g de grasas). Para recuperar, apuntá a <b>{prot} g de proteína</b> en tu próxima comida.
      </Insight>,
    );
  }

  if (day.remaining.kcal < -80) {
    const extra = -day.remaining.kcal;
    items.push(
      <Insight
        key="over"
        icon={<Zap size={18} />}
        tone="var(--danger)"
        title={`Te pasaste ${fmt(extra)} kcal`}
        action={
          <button className="text-[13px] font-bold text-fit" onClick={() => openSheet({ kind: 'activity', date: day.date })}>
            Registrar una actividad →
          </button>
        }
      >
        Equivale a ~{fmt(minutesToBurn(extra, EQUIVALENTS[0].met, kg))} min {EQUIVALENTS[0].label} o ~{fmt(minutesToBurn(extra, EQUIVALENTS[1].met, kg))} min {EQUIVALENTS[1].label}. Un día no define nada: mañana seguís.
      </Insight>,
    );
  }

  const remP = day.remaining.protein;
  if (day.entries.length > 0 && remP > 20 && day.remaining.kcal > 150) {
    const sugs = suggestToClose(day.remaining, foods).slice(0, 2);
    items.push(
      <Insight key="prot" icon={<Beef size={18} />} tone="var(--pro)" title={`Te faltan ${fmt(remP)} g de proteína y ${fmt(day.remaining.kcal)} kcal`}>
        <div className="mt-1.5 space-y-1.5">
          {sugs.map((sg, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-surface p-2">
              <div className="min-w-0 flex-1 text-[13px]">
                <div className="truncate font-semibold text-ink">{sg.items.map((it) => `${it.food.name} (${it.label})`).join(' + ')}</div>
                <div className="num text-xs text-ink-3">
                  {fmt(sg.macros.kcal)} kcal · {fmt(sg.macros.protein)} g prot.
                </div>
              </div>
              <button
                aria-label="Agregar sugerencia"
                className="grad-food flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                onClick={() => {
                  sg.items.forEach((it) => {
                    const m = scaleMacros(per100(it.food), it.grams);
                    addEntry(day.date, mealForNow(), { name: it.food.name, foodId: it.food.id, amount: it.grams, unit: it.food.unit, portionLabel: it.label, qty: 1, source: it.food.source, per100: per100(it.food), ...m });
                  });
                  toast('Agregado a tu día ✓');
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          ))}
        </div>
      </Insight>,
    );
  }

  if (!day.entries.length && isToday) {
    items.push(
      <Insight
        key="start"
        icon={<Utensils size={18} />}
        tone="var(--food)"
        title="Empezá registrando tu primera comida"
        action={
          <button className="text-[13px] font-bold text-food" onClick={() => openSheet({ kind: 'addFood', date: day.date, meal: mealForNow() })}>
            Agregar comida →
          </button>
        }
      >
        Cuanto más registres, mejores van a ser las sugerencias.
      </Insight>,
    );
  }

  if (!day.workouts.length && day.remaining.kcal >= -80 && day.entries.length > 0 && day.remaining.kcal < 400) {
    items.push(
      <Insight key="move" icon={<Activity size={18} />} tone="var(--bal)" title="¿Querés más margen para comer?">
        Una caminata rápida de 30 min te suma ~{fmt(((EQUIVALENTS[0].met - 1) * kg * 30) / 60)} kcal a tu objetivo de hoy.
      </Insight>,
    );
  }

  if (!items.length) return null;
  return (
    <>
      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Sparkles size={16} className="text-bal" /> Balance inteligente
        </span>
      </SectionTitle>
      <Card className="space-y-2 p-2">{items}</Card>
    </>
  );
}

export default function HomePage() {
  const profile = useStore((s) => s.profile)!;
  const entries = useStore((s) => s.entries);
  const workouts = useStore((s) => s.workouts);
  const date = useUI((s) => s.date);
  const openSheet = useUI((s) => s.openSheet);
  const day = useDay(date);
  const streak = computeStreak(entries, workouts);
  if (!day) return null;

  return (
    <div className="anim-fade">
      <header className="pt-safe flex items-center gap-3 pb-2 pt-4">
        <button onClick={() => navigate('perfil')} aria-label="Perfil" className="shrink-0 rounded-2xl">
          <Logo size={44} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-ink-3">{longDate(date)}</div>
          <div className="truncate text-[22px] font-extrabold tracking-tight">
            {greeting()}, {profile.name.split(' ')[0]}
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-fit-soft px-2.5 py-1 text-sm font-extrabold text-fit" title="Días seguidos registrando">
            🔥 {streak}
          </div>
        )}
      </header>
      <div className="mb-3 flex justify-center">
        <DateNav />
      </div>

      <BalanceCard day={day} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => openSheet({ kind: 'addFood', date, meal: mealForNow() })} className="grad-food flex items-center gap-2 rounded-2xl px-4 py-3.5 text-left text-white shadow-card active:scale-[0.98]">
          <Utensils size={20} />
          <span className="text-[15px] font-bold leading-tight">Registrar comida</span>
        </button>
        <button onClick={() => openSheet({ kind: 'activity', date })} className="grad-fit flex items-center gap-2 rounded-2xl px-4 py-3.5 text-left text-white shadow-card active:scale-[0.98]">
          <Activity size={20} />
          <span className="text-[15px] font-bold leading-tight">Sumar actividad</span>
        </button>
      </div>

      <Insights day={day} />

      <SectionTitle action={<button className="flex items-center text-[13px] font-bold text-fit" onClick={() => navigate('ejercicio')}>Entrenar <ChevronRight size={16} /></button>}>
        <span className="flex items-center gap-1.5">
          <Dumbbell size={16} className="text-fit" /> Tu plan
        </span>
      </SectionTitle>
      <PlanCard date={date} />

      {day.workouts.length > 0 && (
        <div className="mt-3 space-y-2">
          {day.workouts.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl text-white', w.kind === 'rutina' ? 'grad-fit' : 'bg-bal')}>
                {w.kind === 'rutina' ? <Dumbbell size={18} /> : <Activity size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{w.title}</div>
                <div className="text-xs text-ink-3">{fmtMinutes(w.durationMin)}</div>
              </div>
              <div className="num text-right text-sm font-extrabold text-fit">
                {fmt(w.kcal)} <span className="text-xs text-ink-3">kcal</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Hidratación</SectionTitle>
      <WaterCard date={date} />
    </div>
  );
}
