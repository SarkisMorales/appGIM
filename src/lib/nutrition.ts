import type { ActivityLevel, Food, FoodEntry, Goal, Macros, Profile } from '../types.ts';

/**
 * Cálculos nutricionales.
 * - Metabolismo basal: Mifflin-St Jeor (1990).
 * - Factor de actividad: describe tu día SIN contar los entrenamientos (esos se suman aparte).
 * - Proteína: ISSN 2017 (1,4–2,0 g/kg/día; más alto en déficit) y Morton 2018 (~1,6 g/kg).
 * - Fibra: 14 g cada 1.000 kcal (Guías Alimentarias EE.UU.).
 * - Agua: ~35 ml/kg + ~500 ml por hora de ejercicio.
 */

export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; desc: string }> = {
  sedentario: { factor: 1.2, label: 'Sedentario', desc: 'Trabajo o estudio sentado, poco movimiento (menos de 5.000 pasos).' },
  ligero: { factor: 1.375, label: 'Poco activo', desc: 'Caminás algo o pasás ratos de pie (5.000–7.500 pasos).' },
  activo: { factor: 1.55, label: 'Activo', desc: 'Trabajo de pie o caminás bastante (7.500–12.000 pasos).' },
  'muy-activo': { factor: 1.725, label: 'Muy activo', desc: 'Trabajo físico pesado o más de 12.000 pasos.' },
};

export const GOALS: Record<Goal, { label: string; desc: string; protein: number; fatPct: number; emoji: string }> = {
  bajar: { label: 'Bajar grasa', desc: 'Déficit moderado cuidando el músculo.', protein: 2.0, fatPct: 0.27, emoji: '🔥' },
  mantener: { label: 'Mantener / tonificar', desc: 'Comer lo que gastás y mejorar tu composición.', protein: 1.6, fatPct: 0.3, emoji: '⚖️' },
  subir: { label: 'Ganar músculo', desc: 'Superávit pequeño para construir músculo.', protein: 1.8, fatPct: 0.27, emoji: '💪' },
};

export const KCAL_PER_KG = 7700;

export function bmi(p: Pick<Profile, 'weightKg' | 'heightCm'>): number {
  const h = p.heightCm / 100;
  return p.weightKg / (h * h);
}

export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
}

/** Peso de referencia para proteína: con IMC alto se usa peso ajustado (IMC 23 + 40% del excedente). */
export function referenceWeight(p: Pick<Profile, 'weightKg' | 'heightCm'>): number {
  const b = bmi(p);
  if (b <= 27) return p.weightKg;
  const h = p.heightCm / 100;
  const ideal = 23 * h * h;
  return ideal + 0.4 * (p.weightKg - ideal);
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  bmr: number;
  tdee: number;
  adjust: number;
  clamped: boolean;
  proteinPerKg: number;
}

export function baseTargets(p: Profile): Targets {
  const b = bmr(p);
  const tdee = b * ACTIVITY[p.activity].factor;
  const sign = p.goal === 'bajar' ? -1 : p.goal === 'subir' ? 1 : 0;
  const adjust = sign * Math.round((p.paceKg * KCAL_PER_KG) / 7);
  let kcal = tdee + adjust;
  const floor = Math.max(p.sex === 'm' ? 1500 : 1200, b);
  let clamped = false;
  if (kcal < floor) {
    kcal = floor;
    clamped = true;
  }
  kcal = Math.round(kcal / 10) * 10;
  if (p.overrides?.kcal) kcal = p.overrides.kcal;

  let proteinPerKg = GOALS[p.goal].protein;
  if (p.trainingDays === 0) proteinPerKg = p.goal === 'bajar' ? 1.4 : 1.2;
  const refW = referenceWeight(p);
  let protein = Math.round(Math.min(proteinPerKg, 2.2) * refW);
  if (p.overrides?.protein) protein = p.overrides.protein;

  let fat = Math.max(Math.round((kcal * GOALS[p.goal].fatPct) / 9), Math.round(0.6 * p.weightKg));
  if (p.overrides?.fat) fat = p.overrides.fat;

  let carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  if (p.overrides?.carbs) carbs = p.overrides.carbs;

  const waterMl = p.overrides?.waterMl ?? Math.round(Math.min(4000, Math.max(1500, 35 * p.weightKg)) / 50) * 50;
  const fiber = Math.round((kcal / 1000) * 14);
  return { kcal, protein, carbs, fat, fiber, waterMl, bmr: Math.round(b), tdee: Math.round(tdee), adjust, clamped, proteinPerKg };
}

export interface DayTargets extends Targets {
  base: Targets;
  /** kcal que el ejercicio suma al objetivo del día */
  bonus: number;
  bonusCarbs: number;
  bonusFat: number;
  bonusWater: number;
}

/** Objetivo del día = base + (kcal netas del ejercicio × % elegido). El extra va 80% a carbohidratos y 20% a grasas. */
export function dayTargets(p: Profile, exerciseNetKcal: number, exerciseMin: number): DayTargets {
  const base = baseTargets(p);
  const bonus = Math.round(exerciseNetKcal * p.exerciseBack);
  const bonusCarbs = Math.round((bonus * 0.8) / 4);
  const bonusFat = Math.round((bonus * 0.2) / 9);
  const bonusWater = Math.round(((exerciseMin / 60) * 500) / 50) * 50;
  return {
    ...base,
    kcal: base.kcal + bonus,
    carbs: base.carbs + bonusCarbs,
    fat: base.fat + bonusFat,
    waterMl: base.waterMl + bonusWater,
    base,
    bonus,
    bonusCarbs,
    bonusFat,
    bonusWater,
  };
}

export const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function sumMacros(entries: Pick<FoodEntry, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'>[]): Macros {
  return entries.reduce(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs,
      fat: a.fat + e.fat,
      fiber: a.fiber + (e.fiber || 0),
    }),
    { ...EMPTY_MACROS },
  );
}

export function per100(food: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'>): Macros {
  return { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber || 0 };
}

export function scaleMacros(m: Macros, amount: number): Macros {
  const k = amount / 100;
  return {
    kcal: Math.round(m.kcal * k),
    protein: Math.round(m.protein * k * 10) / 10,
    carbs: Math.round(m.carbs * k * 10) / 10,
    fat: Math.round(m.fat * k * 10) / 10,
    fiber: Math.round(m.fiber * k * 10) / 10,
  };
}

/** % de calorías que aporta cada macro (para la barra de composición). */
export function macroSplit(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>) {
  const p = m.protein * 4;
  const c = m.carbs * 4;
  const f = m.fat * 9;
  const t = p + c + f || 1;
  return { p: p / t, c: c / t, f: f / t };
}

/** Minutos de una actividad para compensar X kcal (kcal netas por encima del reposo). */
export function minutesToBurn(kcal: number, met: number, kg: number): number {
  const perMin = ((met - 1) * kg) / 60;
  return perMin > 0 ? kcal / perMin : 0;
}

export const EQUIVALENTS = [
  { id: 'caminar', label: 'caminando rápido', met: 4.8, emoji: '🚶' },
  { id: 'trotar', label: 'trotando', met: 8.5, emoji: '🏃' },
  { id: 'bici', label: 'en bici moderada', met: 8.0, emoji: '🚴' },
] as const;

/** Estimación del gasto real (TDEE adaptativo, estilo MacroFactor simplificado). */
export function adaptiveTdee(
  days: { date: string; kcal: number; logged: boolean }[],
  weights: { date: string; kg: number }[],
): { tdee: number; days: number; confidence: 'baja' | 'media' | 'alta' } | null {
  const logged = days.filter((d) => d.logged && d.kcal > 600);
  if (logged.length < 10 || weights.length < 2) return null;
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const inRange = weights.filter((w) => w.date >= first && w.date <= last).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inRange.length < 2) return null;
  // Regresión lineal del peso vs. días para suavizar el ruido diario.
  const t0 = new Date(inRange[0].date).getTime();
  const xs = inRange.map((w) => (new Date(w.date).getTime() - t0) / 86400000);
  const ys = inRange.map((w) => w.kg);
  const span = xs[xs.length - 1] - xs[0];
  if (span < 10) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slopeKgPerDay = den ? num / den : 0;
  const avgIntake = logged.reduce((a, d) => a + d.kcal, 0) / logged.length;
  const tdee = Math.round((avgIntake - slopeKgPerDay * KCAL_PER_KG) / 10) * 10;
  const confidence = logged.length >= 21 && n >= 6 ? 'alta' : logged.length >= 14 ? 'media' : 'baja';
  return { tdee, days: logged.length, confidence };
}

/** Comidas sugeridas para completar el día priorizando proteína sin pasarse de calorías. */
export const SUGGESTION_POOL: { id: string; portion: number }[] = [
  { id: 'pollo-pechuga', portion: 0 },
  { id: 'yogur-griego', portion: 0 },
  { id: 'atun-agua', portion: 0 },
  { id: 'huevo-duro', portion: 0 },
  { id: 'clara', portion: 1 },
  { id: 'merluza', portion: 0 },
  { id: 'carne-picada-magra', portion: 0 },
  { id: 'lomo', portion: 0 },
  { id: 'queso-untable-light', portion: 0 },
  { id: 'cottage', portion: 0 },
  { id: 'lentejas', portion: 0 },
  { id: 'whey', portion: 0 },
  { id: 'leche-descremada', portion: 0 },
  { id: 'banana', portion: 0 },
  { id: 'manzana', portion: 0 },
  { id: 'arroz-blanco', portion: 0 },
  { id: 'avena', portion: 0 },
  { id: 'papa-hervida', portion: 0 },
  { id: 'pan-integral', portion: 1 },
  { id: 'almendras', portion: 0 },
  { id: 'palta', portion: 0 },
  { id: 'ensalada-mixta', portion: 0 },
  { id: 'fideos', portion: 0 },
  { id: 'salmon', portion: 0 },
];

export interface Suggestion {
  items: { food: Food; grams: number; label: string }[];
  macros: Macros;
  score: number;
}

export function suggestToClose(remaining: Macros, foods: Map<string, Food>): Suggestion[] {
  if (remaining.kcal < 80) return [];
  const pool = SUGGESTION_POOL.map((s) => {
    const f = foods.get(s.id);
    if (!f) return null;
    const por = f.portions[s.portion] ?? { label: '100 g', grams: 100 };
    return { food: f, grams: por.grams, label: por.label, m: scaleMacros(per100(f), por.grams) };
  }).filter(Boolean) as { food: Food; grams: number; label: string; m: Macros }[];

  const remP = Math.max(0, remaining.protein);
  const score = (m: Macros) => {
    if (m.kcal > remaining.kcal + 40) return -1;
    const pCov = remP < 8 ? 1 : Math.min(m.protein, remP) / remP;
    const kCov = 1 - Math.min(1, Math.abs(remaining.kcal - m.kcal) / remaining.kcal);
    const fatPenalty = remaining.fat >= 0 && m.fat > remaining.fat + 8 ? 0.2 : 0;
    return pCov * (remP < 8 ? 0.2 : 0.65) + kCov * (remP < 8 ? 0.8 : 0.35) - fatPenalty;
  };
  const combos: Suggestion[] = [];
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    combos.push({ items: [{ food: a.food, grams: a.grams, label: a.label }], macros: a.m, score: score(a.m) - 0.03 });
    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j];
      const m = {
        kcal: a.m.kcal + b.m.kcal,
        protein: a.m.protein + b.m.protein,
        carbs: a.m.carbs + b.m.carbs,
        fat: a.m.fat + b.m.fat,
        fiber: a.m.fiber + b.m.fiber,
      };
      combos.push({
        items: [
          { food: a.food, grams: a.grams, label: a.label },
          { food: b.food, grams: b.grams, label: b.label },
        ],
        macros: m,
        score: score(m),
      });
    }
  }
  const sorted = combos.filter((c) => c.score > 0).sort((x, y) => y.score - x.score);
  const out: Suggestion[] = [];
  const used = new Set<string>();
  for (const c of sorted) {
    const key = c.items[0].food.id;
    if (used.has(key)) continue;
    used.add(key);
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}
