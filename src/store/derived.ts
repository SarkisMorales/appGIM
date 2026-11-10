import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ActivePlan, Food, FoodEntry, MealId, Profile, Routine, Session, Workout } from '../types.ts';
import { useStore } from './useStore.ts';
import { FOODS } from '../data/foods.ts';
import { ROUTINES } from '../data/routines.ts';
import { dayTargets, sumMacros, targetsAt, type DayTargets, type TargetLog } from '../lib/nutrition.ts';
import { addDays, todayISO, weekday } from '../lib/dates.ts';
import type { Macros } from '../types.ts';

export const MEALS: { id: MealId; label: string; emoji: string; hint: string }[] = [
  { id: 'desayuno', label: 'Desayuno', emoji: '☕', hint: '7–10 h' },
  { id: 'almuerzo', label: 'Almuerzo', emoji: '🍽️', hint: '12–14 h' },
  { id: 'merienda', label: 'Merienda', emoji: '🧉', hint: '16–18 h' },
  { id: 'cena', label: 'Cena', emoji: '🌙', hint: '20–22 h' },
  { id: 'snacks', label: 'Snacks', emoji: '🍎', hint: 'Entre comidas' },
];

/** Comida sugerida según la hora actual. */
export function mealForNow(d = new Date()): MealId {
  const h = d.getHours();
  if (h < 11) return 'desayuno';
  if (h < 15) return 'almuerzo';
  if (h < 19) return 'merienda';
  if (h < 23) return 'cena';
  return 'snacks';
}

const FOOD_MAP = new Map(FOODS.map((f) => [f.id, f]));

export function useFoodMap(): Map<string, Food> {
  const custom = useStore((s) => s.customFoods);
  return useMemo(() => {
    const m = new Map(FOOD_MAP);
    custom.forEach((f) => m.set(f.id, f));
    return m;
  }, [custom]);
}

export function useRoutines(): Routine[] {
  const custom = useStore((s) => s.customRoutines);
  return useMemo(() => [...ROUTINES, ...custom], [custom]);
}

export function findRoutine(id: string | undefined, custom: Routine[]): Routine | undefined {
  if (!id) return undefined;
  return ROUTINES.find((r) => r.id === id) || custom.find((r) => r.id === id);
}

export interface DayData {
  date: string;
  entries: FoodEntry[];
  consumed: Macros;
  byMeal: Record<MealId, FoodEntry[]>;
  workouts: Workout[];
  exerciseKcal: number;
  exerciseNet: number;
  exerciseMin: number;
  targets: DayTargets;
  remaining: Macros;
  water: number;
}

export function computeDay(
  profile: Profile,
  date: string,
  entries: FoodEntry[],
  workouts: Workout[],
  water: Record<string, number>,
  targetLog?: TargetLog[],
): DayData {
  const es = entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const ws = workouts.filter((w) => w.date === date).sort((a, b) => a.startedAt - b.startedAt);
  const consumed = sumMacros(es);
  const exerciseKcal = ws.reduce((a, w) => a + w.kcal, 0);
  const exerciseNet = ws.reduce((a, w) => a + w.netKcal, 0);
  const exerciseMin = ws.reduce((a, w) => a + w.durationMin, 0);
  const targets = dayTargets(profile, exerciseNet, exerciseMin, targetsAt(targetLog, date, todayISO()));
  const byMeal = { desayuno: [], almuerzo: [], merienda: [], cena: [], snacks: [] } as Record<MealId, FoodEntry[]>;
  es.forEach((e) => byMeal[e.meal]?.push(e));
  return {
    date,
    entries: es,
    consumed,
    byMeal,
    workouts: ws,
    exerciseKcal,
    exerciseNet,
    exerciseMin,
    targets,
    remaining: {
      kcal: targets.kcal - consumed.kcal,
      protein: targets.protein - consumed.protein,
      carbs: targets.carbs - consumed.carbs,
      fat: targets.fat - consumed.fat,
      fiber: targets.fiber - consumed.fiber,
    },
    water: water[date] || 0,
  };
}

export function useDay(date: string): DayData | null {
  const { profile, entries, workouts, water, targetLog } = useStore(
    useShallow((s) => ({ profile: s.profile, entries: s.entries, workouts: s.workouts, water: s.water, targetLog: s.targetLog })),
  );
  return useMemo(() => (profile ? computeDay(profile, date, entries, workouts, water, targetLog) : null), [profile, date, entries, workouts, water, targetLog]);
}

/** Días seguidos (hasta hoy o ayer) con algo registrado: comida o entrenamiento. */
export function computeStreak(entries: FoodEntry[], workouts: Workout[], today = todayISO()): number {
  const days = new Set<string>();
  entries.forEach((e) => days.add(e.date));
  workouts.forEach((w) => days.add(w.date));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface PlanToday {
  routine: Routine;
  session: Session;
  sessionIndex: number;
  isTrainingDay: boolean;
  doneToday: boolean;
  nextDayLabel: number;
}

/** Sesión que toca según el plan activo. */
export function planForDate(plan: ActivePlan | null, routines: Routine[], workouts: Workout[], date: string): PlanToday | null {
  if (!plan) return null;
  const routine = routines.find((r) => r.id === plan.routineId);
  if (!routine || !routine.sessions.length) return null;
  const doneToday = workouts.some((w) => w.date === date && w.routineId === routine.id);
  const idx = routine.weekPattern[(doneToday ? plan.nextIndex - 1 + routine.weekPattern.length * 100 : plan.nextIndex) % routine.weekPattern.length];
  const session = routine.sessions[idx] ?? routine.sessions[0];
  const wd = weekday(date);
  const days = [...plan.days].sort((a, b) => a - b);
  const isTrainingDay = days.includes(wd);
  const next = days.find((d) => d > wd) ?? days[0] ?? wd;
  return { routine, session, sessionIndex: idx, isTrainingDay, doneToday, nextDayLabel: next };
}
