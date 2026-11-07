import type { Block, Exercise, Routine, Session, SetsBlock } from '../types.ts';

/**
 * Gasto energético con METs (Compendio de Actividades Físicas para Adultos 2024, Herrmann et al.).
 *   kcal = MET × peso (kg) × horas
 * Las kcal "netas" restan el gasto en reposo (1 MET): son las que se suman a tu objetivo del día.
 */
export const kcalFromMet = (met: number, kg: number, min: number) => (met * kg * min) / 60;
export const netKcalFromMet = (met: number, kg: number, min: number) => (Math.max(0, met - 1) * kg * min) / 60;

export const SETUP_SEC = 5;
export const TRANSITION_SEC = 40;
export const DEFAULT_TEMPO = 3;
export const WARMUP_MET = 3.5;

export type ExLookup = (id: string) => Exercise | undefined;

export function avgReps(r: SetsBlock['reps']): number {
  if (Array.isArray(r)) return (r[0] + r[1]) / 2;
  return r ?? 10;
}

export function repsLabel(r: SetsBlock['reps']): string {
  if (Array.isArray(r)) return `${r[0]}–${r[1]}`;
  return r != null ? String(r) : '';
}

export function setWorkSec(b: Pick<SetsBlock, 'reps' | 'sec'>, ex?: Exercise): number {
  if (b.sec) return b.sec * (ex?.perSide ? 2 : 1);
  return avgReps(b.reps) * (ex?.tempo ?? DEFAULT_TEMPO) * (ex?.perSide ? 2 : 1) + SETUP_SEC;
}

export interface Segment {
  sec: number;
  met: number;
}

export function blockSegments(b: Block, sessionMet: number, getEx: ExLookup): Segment[] {
  if (b.type === 'sets') {
    const ex = getEx(b.ex);
    const work = setWorkSec(b, ex);
    const sec = b.sets * work + Math.max(0, b.sets - 1) * b.rest + TRANSITION_SEC;
    return [{ sec, met: sessionMet }];
  }
  const segs: Segment[] = [];
  for (let r = 0; r < b.rounds; r++) {
    b.items.forEach((it, i) => {
      const ex = getEx(it.ex);
      const work = it.sec ?? (it.reps ? it.reps * (ex?.tempo ?? DEFAULT_TEMPO) * (ex?.perSide ? 2 : 1) : b.work);
      segs.push({ sec: work, met: b.met ?? ex?.met ?? sessionMet });
      const isLastItem = i === b.items.length - 1;
      const rest = isLastItem ? (r < b.rounds - 1 ? b.restRounds : 0) : b.rest;
      if (rest > 0) segs.push({ sec: rest, met: b.met ?? 2.0 });
    });
  }
  segs.push({ sec: TRANSITION_SEC, met: b.met ?? 2.0 });
  return segs;
}

export interface SessionEstimate {
  totalSec: number;
  minutes: number;
  kcal: number;
  netKcal: number;
  avgMet: number;
  sets: number;
  exercises: number;
  /** g/kg de proteína recomendados después de la sesión (0,25–0,40 según intensidad). */
  proteinPerKg: number;
  /** Gramos de proteína recomendados después de la sesión. */
  proteinG: number;
}

/**
 * Dosis de proteína post-entreno según la sesión (ISSN 2017: 0,25–0,40 g/kg por toma).
 * - Movilidad o cardio sin fuerza: 0,25 g/kg.
 * - Fuerza moderada: 0,30 g/kg.
 * - Fuerza intensa o de mucho volumen (MET ≥ 5 o 20+ series): 0,40 g/kg
 *   (tras entrenamiento de cuerpo completo, 40 g estimulan más síntesis que 20 g: Macnaughton et al., 2016).
 */
export function proteinFactor(avgMet: number, sets: number, hasStrength: boolean): number {
  if (!hasStrength || avgMet < 3.2) return 0.25;
  if (avgMet >= 5 || sets >= 20) return 0.4;
  return 0.3;
}

export function proteinDose(kg: number, perKg: number): number {
  return Math.round(Math.min(40, Math.max(20, perKg * kg)));
}

export function estimateSession(s: Session, kg: number, getEx: ExLookup): SessionEstimate {
  const segs: Segment[] = [];
  if (s.warmupMin > 0) segs.push({ sec: s.warmupMin * 60, met: WARMUP_MET });
  let sets = 0;
  const exIds = new Set<string>();
  for (const b of s.blocks) {
    segs.push(...blockSegments(b, s.met, getEx));
    if (b.type === 'sets') {
      sets += b.sets;
      exIds.add(b.ex);
    } else {
      sets += b.rounds * b.items.length;
      b.items.forEach((i) => exIds.add(i.ex));
    }
  }
  const totalSec = segs.reduce((a, x) => a + x.sec, 0);
  const metMin = segs.reduce((a, x) => a + (x.met * x.sec) / 60, 0);
  const avgMet = totalSec ? metMin / (totalSec / 60) : s.met;
  const minutes = totalSec / 60;
  const hasStrength = s.blocks.some((b) => b.type === 'sets' && getEx(b.ex)?.category === 'fuerza');
  const proteinPerKg = proteinFactor(avgMet, sets, hasStrength);
  return {
    totalSec,
    minutes,
    kcal: kcalFromMet(avgMet, kg, minutes),
    netKcal: netKcalFromMet(avgMet, kg, minutes),
    avgMet,
    sets,
    exercises: exIds.size,
    proteinPerKg,
    proteinG: proteinDose(kg, proteinPerKg),
  };
}

export interface RoutineSummary {
  proteinMin: number;
  proteinMax: number;
  avgMinutes: number;
  avgKcal: number;
  avgNetKcal: number;
  weeklyKcal: number;
  weeklyNetKcal: number;
  weeklyMinutes: number;
  perSession: SessionEstimate[];
  animated: number;
  totalExercises: number;
}

export function summarizeRoutine(r: Routine, kg: number, getEx: ExLookup, hasAnim: (id: string) => boolean): RoutineSummary {
  const perSession = r.sessions.map((s) => estimateSession(s, kg, getEx));
  const n = perSession.length || 1;
  const avg = (f: (e: SessionEstimate) => number) => perSession.reduce((a, e) => a + f(e), 0) / n;
  const week: SessionEstimate[] = [];
  for (let d = 0; d < r.daysPerWeek; d++) {
    const e = perSession[r.weekPattern[d % r.weekPattern.length]];
    if (e) week.push(e);
  }
  const ids = new Set<string>();
  r.sessions.forEach((s) => s.blocks.forEach((b) => (b.type === 'sets' ? ids.add(b.ex) : b.items.forEach((i) => ids.add(i.ex)))));
  const animated = [...ids].filter((id) => hasAnim(id)).length;
  return {
    proteinMin: Math.min(...perSession.map((e) => e.proteinG)),
    proteinMax: Math.max(...perSession.map((e) => e.proteinG)),
    avgMinutes: avg((e) => e.minutes),
    avgKcal: avg((e) => e.kcal),
    avgNetKcal: avg((e) => e.netKcal),
    weeklyKcal: week.reduce((a, e) => a + e.kcal, 0),
    weeklyNetKcal: week.reduce((a, e) => a + e.netKcal, 0),
    weeklyMinutes: week.reduce((a, e) => a + e.minutes, 0),
    perSession,
    animated,
    totalExercises: ids.size,
  };
}

/** Proteína recomendada después de entrenar: ~0,3 g/kg (ISSN: 0,25–0,40 g/kg o 20–40 g por toma). */
export function postWorkoutProtein(kg: number, perKg = 0.3): number {
  return proteinDose(kg, perKg);
}

/** 1RM estimado (fórmula de Epley). */
export function oneRepMax(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// ---------------- Pasos del reproductor ----------------
export type Step =
  | { kind: 'warmup'; sec: number }
  | {
      kind: 'set';
      ex: string;
      block: number;
      set: number;
      sets: number;
      reps?: number | [number, number];
      sec?: number;
      rest: number;
      note?: string;
      load?: string;
    }
  | {
      kind: 'work';
      ex: string;
      block: number;
      round: number;
      rounds: number;
      item: number;
      items: number;
      sec?: number;
      reps?: number;
      rest: number;
      blockName: string;
      label?: string;
    };

export function buildSteps(s: Session, includeWarmup = true): Step[] {
  const steps: Step[] = [];
  if (includeWarmup && s.warmupMin > 0) steps.push({ kind: 'warmup', sec: s.warmupMin * 60 });
  s.blocks.forEach((b, bi) => {
    if (b.type === 'sets') {
      for (let k = 0; k < b.sets; k++) {
        steps.push({
          kind: 'set',
          ex: b.ex,
          block: bi,
          set: k + 1,
          sets: b.sets,
          reps: b.reps,
          sec: b.sec,
          rest: k < b.sets - 1 ? b.rest : bi < s.blocks.length - 1 ? Math.min(b.rest, 90) : 0,
          note: b.note,
          load: b.load,
        });
      }
    } else {
      for (let r = 0; r < b.rounds; r++) {
        b.items.forEach((it, i) => {
          const last = i === b.items.length - 1;
          const rest = last ? (r < b.rounds - 1 ? b.restRounds : bi < s.blocks.length - 1 ? 60 : 0) : b.rest;
          steps.push({
            kind: 'work',
            ex: it.ex,
            block: bi,
            round: r + 1,
            rounds: b.rounds,
            item: i + 1,
            items: b.items.length,
            sec: it.sec ?? (it.reps ? undefined : b.work),
            reps: it.reps,
            rest,
            blockName: b.name,
            label: it.label,
          });
        });
      }
    }
  });
  return steps;
}

export function sessionExerciseIds(s: Session): string[] {
  const ids: string[] = [];
  s.blocks.forEach((b) => {
    const add = (id: string) => {
      if (!ids.includes(id)) ids.push(id);
    };
    if (b.type === 'sets') add(b.ex);
    else b.items.forEach((i) => add(i.ex));
  });
  return ids;
}
