import type { Food, Macros, MealId, MealPlan, PlanItem, PlanMeal } from '../types.ts';
import { MEAL_TEMPLATES, type MealTpl, type TplItem } from '../data/mealTemplates.ts';
import { EMPTY_MACROS, per100, scaleMacros } from './nutrition.ts';

/**
 * Plan de comidas semanal: combina comidas base y ajusta las cantidades para
 * acercarse a tus calorías y a tu proteína. Es una guía, no una dieta médica.
 */
export interface PlanTargets {
  kcal: number;
  protein: number;
}

type FoodMap = Map<string, Food>;
type Rnd = () => number;

/** Cómo se reparten las calorías (y la proteína) del día. */
export const MEAL_SHARE: Record<Exclude<MealId, 'snacks'>, number> = { desayuno: 0.22, almuerzo: 0.33, merienda: 0.15, cena: 0.3 };
const SLOTS = ['desayuno', 'almuerzo', 'merienda', 'cena'] as const;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function itemMacros(it: PlanItem, foods: FoodMap): Macros {
  const f = foods.get(it.foodId);
  return f ? scaleMacros(per100(f), it.grams) : { ...EMPTY_MACROS };
}

export function mealMacros(meal: PlanMeal, foods: FoodMap): Macros {
  return meal.items.reduce(
    (a, it) => {
      const m = itemMacros(it, foods);
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, fiber: a.fiber + m.fiber };
    },
    { ...EMPTY_MACROS },
  );
}

export function dayMacros(day: PlanMeal[], foods: FoodMap): Macros {
  return day.reduce(
    (a, ml) => {
      const m = mealMacros(ml, foods);
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, fiber: a.fiber + m.fiber };
    },
    { ...EMPTY_MACROS },
  );
}

function roundGrams(it: TplItem, grams: number, food: Food): number {
  if (it.u) {
    // Alimentos por unidad: se redondea a media unidad (mínimo media).
    const unit = food.portions[0]?.grams ?? it.g;
    const half = unit / 2;
    return Math.max(half, Math.round(grams / half) * half);
  }
  const step = grams > 150 ? 10 : 5;
  return Math.max(step, Math.round(grams / step) * step);
}

/**
 * Ajusta una comida base a un objetivo de kcal y proteína:
 * los ingredientes "p" (proteína) y el resto se escalan por separado.
 */
export function buildMeal(tpl: MealTpl, target: PlanTargets, foods: FoodMap): PlanMeal {
  const acc = { kp: 0, pp: 0, kc: 0, pc: 0, kf: 0, pf: 0 };
  for (const it of tpl.items) {
    const f = foods.get(it.id);
    if (!f) continue;
    const k = (f.kcal * it.g) / 100;
    const p = (f.protein * it.g) / 100;
    if (it.fix) {
      acc.kf += k;
      acc.pf += p;
    } else if (it.p) {
      acc.kp += k;
      acc.pp += p;
    } else {
      acc.kc += k;
      acc.pc += p;
    }
  }
  const K = target.kcal - acc.kf;
  const P = target.protein - acc.pf;
  let fp = 1;
  let fc = 1;
  if (acc.kp > 0 && acc.kc > 0) {
    const det = acc.kp * acc.pc - acc.kc * acc.pp;
    fp = Math.abs(det) > 1e-6 ? (K * acc.pc - acc.kc * P) / det : K / (acc.kp + acc.kc);
    fp = clamp(fp, 0.6, 2.2);
    fc = clamp((K - fp * acc.kp) / acc.kc, 0.5, 3);
    // Si el acompañamiento quedó en su límite, la proteína absorbe la diferencia de calorías.
    fp = clamp((K - fc * acc.kc) / acc.kp, 0.6, 2.4);
  } else if (acc.kp > 0) {
    fp = clamp(K / acc.kp, 0.5, 2.4);
  } else if (acc.kc > 0) {
    fc = clamp(K / acc.kc, 0.5, 2.4);
  }
  const items: PlanItem[] = [];
  for (const it of tpl.items) {
    const f = foods.get(it.id);
    if (!f) continue;
    const grams = it.fix ? it.g : roundGrams(it, it.g * (it.p ? fp : fc), f);
    items.push({ foodId: it.id, grams });
  }
  return { meal: tpl.meal, tpl: tpl.id, name: tpl.name, items };
}

function pick<T>(list: T[], rnd: Rnd): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

const tplById = (id: string) => MEAL_TEMPLATES.find((t) => t.id === id);

/** Arma el día con las comidas base elegidas y, si falta proteína, suma una colación proteica. */
export function buildDay(tpls: MealTpl[], target: PlanTargets, foods: FoodMap, veg: boolean, rnd: Rnd): PlanMeal[] {
  const make = (kcal: number, protein: number) => tpls.map((t) => buildMeal(t, { kcal: kcal * MEAL_SHARE[t.meal as keyof typeof MEAL_SHARE], protein: protein * MEAL_SHARE[t.meal as keyof typeof MEAL_SHARE] }, foods));
  let day = make(target.kcal, target.protein);
  const m = dayMacros(day, foods);
  if (m.protein < target.protein * 0.93) {
    const snacks = MEAL_TEMPLATES.filter((t) => t.meal === 'snacks' && (!veg || t.veg));
    const tpl = pick(snacks, rnd);
    const raw: PlanMeal = { meal: 'snacks', tpl: tpl.id, name: tpl.name, items: tpl.items.map((it) => ({ foodId: it.id, grams: it.g })) };
    const sm = mealMacros(raw, foods);
    // Al sumar la colación, las otras comidas se achican y pierden algo de proteína: por eso se pide un poco más.
    const gap = (target.protein - m.protein) * 1.25;
    const k = clamp(gap / Math.max(1, sm.protein), 0.75, 2.5);
    const snack: PlanMeal = {
      ...raw,
      items: tpl.items.map((it) => {
        const f = foods.get(it.id)!;
        return { foodId: it.id, grams: roundGrams(it, it.g * k, f) };
      }),
    };
    const sk = mealMacros(snack, foods);
    day = [...make(target.kcal - sk.kcal, target.protein - sk.protein), snack];
  }
  return day;
}

function chooseTemplates(target: PlanTargets, foods: FoodMap, veg: boolean, rnd: Rnd, avoid: Set<string>, keep?: Partial<Record<MealId, string>>): MealTpl[] {
  return SLOTS.map((slot) => {
    const fixed = keep?.[slot] ? tplById(keep[slot]!) : undefined;
    if (fixed) return fixed;
    const pool = MEAL_TEMPLATES.filter((t) => t.meal === slot && (!veg || t.veg));
    const fresh = pool.filter((t) => !avoid.has(t.id));
    const cands = fresh.length >= 2 ? fresh : pool;
    // Entre las opciones, se prefieren las que mejor llegan a tu proteína (clave si tu objetivo es alto).
    const slotTarget = { kcal: target.kcal * MEAL_SHARE[slot], protein: target.protein * MEAL_SHARE[slot] };
    const ranked = cands
      .map((t) => ({ t, r: mealMacros(buildMeal(t, slotTarget, foods), foods).protein / Math.max(1, slotTarget.protein) }))
      .sort((a, b) => b.r - a.r);
    const good = ranked.filter((x) => x.r >= 0.9);
    const best = good.length >= 3 ? good : ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));
    return pick(best, rnd).t;
  });
}

export function generatePlan(target: PlanTargets, foods: FoodMap, opts: { veg?: boolean; today: string }, rnd: Rnd = Math.random): MealPlan {
  const veg = !!opts.veg;
  const days: PlanMeal[][] = [];
  let recent: string[][] = [];
  for (let d = 0; d < 7; d++) {
    // Evita repetir lo de los dos días anteriores para que la semana sea variada.
    const avoid = new Set(recent.flat());
    const tpls = chooseTemplates(target, foods, veg, rnd, avoid);
    recent = [...recent.slice(-1), tpls.map((t) => t.id)];
    days.push(buildDay(tpls, target, foods, veg, rnd));
  }
  return { createdAt: opts.today, kcal: target.kcal, protein: target.protein, veg, days, checked: [] };
}

/** Cambia una comida del día por otra opción y reajusta las cantidades del día. */
export function swapMeal(plan: MealPlan, dayIdx: number, meal: MealId, target: PlanTargets, foods: FoodMap, rnd: Rnd = Math.random): MealPlan {
  const day = plan.days[dayIdx];
  if (!day) return plan;
  const veg = !!plan.veg;
  const current = day.find((m) => m.meal === meal);
  if (meal === 'snacks') {
    // La colación se recalcula con el resto del día tal como está.
    const keep = Object.fromEntries(day.filter((m) => m.meal !== 'snacks').map((m) => [m.meal, m.tpl]));
    const tpls = chooseTemplates(target, foods, veg, rnd, new Set(), keep);
    const days = plan.days.map((d, i) => (i === dayIdx ? buildDay(tpls, target, foods, veg, rnd) : d));
    return { ...plan, days };
  }
  const keep = Object.fromEntries(day.filter((m) => m.meal !== 'snacks' && m.meal !== meal).map((m) => [m.meal, m.tpl]));
  const tpls = chooseTemplates(target, foods, veg, rnd, new Set(current ? [current.tpl] : []), keep);
  const days = plan.days.map((d, i) => (i === dayIdx ? buildDay(tpls, target, foods, veg, rnd) : d));
  return { ...plan, days };
}

// ---------------- Lista de compras ----------------
/** Infusiones y agua no van a la lista. */
const SKIP = new Set(['agua', 'mate', 'cafe', 'te']);

export interface ShopItem {
  food: Food;
  grams: number;
  /** Cantidad aproximada en unidades, si el alimento se cuenta así. */
  units?: number;
  unitLabel?: string;
}

export interface ShopGroup {
  category: string;
  items: ShopItem[];
}

const UNIT_RE = /^1 (unidad|rebanada|rodaja|feta|filet|huevo|banana|manzana|naranja|mandarina|pan|tostada|galleta|medall[oó]n|milanesa|wrap|tostado|muslo|pote)/i;

export function shoppingList(plan: MealPlan, foods: FoodMap): ShopGroup[] {
  const sum = new Map<string, number>();
  plan.days.forEach((d) => d.forEach((ml) => ml.items.forEach((it) => !SKIP.has(it.foodId) && sum.set(it.foodId, (sum.get(it.foodId) ?? 0) + it.grams))));
  const groups = new Map<string, ShopItem[]>();
  for (const [id, grams] of sum) {
    const food = foods.get(id);
    if (!food) continue;
    const por = food.portions[0];
    const item: ShopItem = { food, grams };
    if (por && UNIT_RE.test(por.label) && por.grams > 0) {
      item.units = Math.ceil(grams / por.grams - 0.05);
      item.unitLabel = por.label.replace(/^1 /, '');
    }
    const g = groups.get(food.category) ?? [];
    g.push(item);
    groups.set(food.category, g);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items: items.sort((a, b) => a.food.name.localeCompare(b.food.name, 'es')) }));
}

export function fmtAmount(grams: number, unit: 'g' | 'ml'): string {
  if (grams >= 1000) return `${(Math.round(grams / 100) / 10).toLocaleString('es-AR')} ${unit === 'ml' ? 'L' : 'kg'}`;
  return `${Math.round(grams)} ${unit}`;
}
