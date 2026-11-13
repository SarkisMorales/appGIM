import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseTargets, bmr, dayTargets, scaleMacros, per100, minutesToBurn, adaptiveTdee } from '../src/lib/nutrition.ts';
import { estimateSession, summarizeRoutine, kcalFromMet, netKcalFromMet, buildSteps, oneRepMax, postWorkoutProtein } from '../src/lib/training.ts';
import { ROUTINES } from '../src/data/routines.ts';
import { EXERCISES, getExercise } from '../src/data/exercises.ts';
import { ANIMS } from '../src/data/animations.ts';
import { FOODS } from '../src/data/foods.ts';
import { ACTIVITIES } from '../src/data/activities.ts';
import type { Profile } from '../src/types.ts';

const P: Profile = {
  name: 'Test', sex: 'm', age: 30, heightCm: 175, weightKg: 75, activity: 'ligero', goal: 'bajar', paceKg: 0.5,
  level: 'principiante', place: 'casa', trainingDays: 3, exerciseBack: 1, createdAt: '2026-01-01',
};

test('Mifflin-St Jeor', () => {
  // 10*75 + 6.25*175 - 5*30 + 5 = 1698.75
  assert.equal(Math.round(bmr(P)), 1699);
  assert.equal(Math.round(bmr({ ...P, sex: 'f' })), 1533);
});

test('objetivo con déficit y macros que cierran', () => {
  const t = baseTargets(P);
  assert.equal(t.tdee, Math.round(1698.75 * 1.375));
  assert.equal(t.adjust, -550);
  assert.ok(Math.abs(t.kcal - (t.tdee - 550)) <= 10);
  assert.equal(t.protein, 150); // 2,0 g/kg × 75
  const kcalFromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  assert.ok(Math.abs(kcalFromMacros - t.kcal) < 15, `macros ${kcalFromMacros} vs ${t.kcal}`);
});

test('el piso de seguridad no deja bajar del basal', () => {
  const t = baseTargets({ ...P, sex: 'f', weightKg: 50, heightCm: 155, age: 55, activity: 'sedentario', paceKg: 0.75 });
  assert.ok(t.kcal >= 1200 && t.clamped);
});

test('el ejercicio suma kcal netas al objetivo del día', () => {
  const base = baseTargets(P);
  const d = dayTargets(P, 300, 45);
  assert.equal(d.kcal, base.kcal + 300);
  assert.equal(d.bonus, 300);
  assert.ok(d.carbs > base.carbs);
  assert.equal(d.waterMl, base.waterMl + 400);
  const half = dayTargets({ ...P, exerciseBack: 0.5 }, 300, 45);
  assert.equal(half.bonus, 150);
});

test('MET: fórmula y kcal netas', () => {
  assert.equal(kcalFromMet(8, 70, 60), 560);
  assert.equal(netKcalFromMet(8, 70, 60), 490);
  assert.ok(Math.abs(minutesToBurn(490, 8, 70) - 60) < 0.001);
});

test('todas las rutinas: ejercicios existentes, con animación y estimaciones razonables', () => {
  assert.ok(ROUTINES.length >= 15);
  for (const lvl of ['principiante', 'intermedio', 'avanzado']) assert.ok(ROUTINES.filter((r) => r.level === lvl).length >= 4, lvl);
  for (const r of ROUTINES) {
    assert.equal(r.suggestedDays.length >= r.daysPerWeek || r.weekPattern.length > 0, true);
    for (const s of r.sessions) {
      for (const b of s.blocks) {
        const ids = b.type === 'sets' ? [b.ex] : b.items.map((i) => i.ex);
        for (const id of ids) {
          const ex = getExercise(id);
          assert.ok(ex, `${r.id}/${s.id}: falta ejercicio ${id}`);
          assert.ok(ANIMS[ex!.anim], `${id}: falta animación ${ex!.anim}`);
        }
      }
      const e = estimateSession(s, 75, getExercise);
      assert.ok(e.minutes > 8 && e.minutes < 110, `${r.id}/${s.id}: ${e.minutes.toFixed(1)} min`);
      assert.ok(e.kcal > 40 && e.kcal < 1000, `${r.id}/${s.id}: ${e.kcal.toFixed(0)} kcal`);
      assert.ok(buildSteps(s).length > 0);
    }
    const sum = summarizeRoutine(r, 75, getExercise, (id) => !!ANIMS[getExercise(id)!.anim]);
    assert.equal(sum.animated, sum.totalExercises, `${r.id}: hay ejercicios sin animación`);
  }
});

test('7 minutos ≈ 7–8 min por vuelta', () => {
  const r = ROUTINES.find((x) => x.id === 'siete-minutos')!;
  const one = { ...r.sessions[0], warmupMin: 0, blocks: r.sessions[0].blocks.map((b) => (b.type === 'circuit' ? { ...b, rounds: 1 } : b)) };
  const e = estimateSession(one, 75, getExercise);
  assert.ok(e.minutes > 7 && e.minutes < 9, String(e.minutes));
});

test('ejercicios: ids únicos y textos completos', () => {
  const ids = new Set<string>();
  for (const e of EXERCISES) {
    assert.ok(!ids.has(e.id), `duplicado ${e.id}`);
    ids.add(e.id);
    assert.ok(e.steps.length >= 2 && e.tips.length >= 1, e.id);
    assert.ok(ANIMS[e.anim], `${e.id} → ${e.anim}`);
  }
});

test('alimentos: datos coherentes (Atwater) y porciones válidas', () => {
  assert.ok(FOODS.length >= 200);
  const ids = new Set<string>();
  for (const f of FOODS) {
    assert.ok(!ids.has(f.id), `duplicado ${f.id}`);
    ids.add(f.id);
    assert.ok(f.kcal >= 0 && f.protein >= 0 && f.carbs >= 0 && f.fat >= 0, f.id);
    f.portions.forEach((p) => assert.ok(p.grams > 0, `${f.id}: ${p.label}`));
    if (f.kcal > 40 && !/cerveza|vino|fernet|destilado|sidra|espumante|vermu/.test(f.id)) {
      const atw = f.protein * 4 + f.carbs * 4 + f.fat * 9;
      assert.ok(Math.abs(atw - f.kcal) / f.kcal < 0.2, `${f.id}: ${f.kcal} kcal vs Atwater ${atw.toFixed(0)}`);
    }
  }
  const m = scaleMacros(per100(FOODS.find((f) => f.id === 'banana')!), 118);
  assert.equal(m.kcal, 105);
});

test('actividades con MET válidos', () => {
  for (const a of ACTIVITIES) for (const o of a.options) assert.ok(o.met >= 1.5 && o.met <= 16, `${a.id} ${o.label}`);
});

test('1RM, proteína post-entreno y TDEE adaptativo', () => {
  assert.equal(Math.round(oneRepMax(100, 5)), 117);
  assert.equal(postWorkoutProtein(75), 23);
  assert.equal(postWorkoutProtein(50), 20);
  const days = Array.from({ length: 28 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, kcal: 2000, logged: true }));
  // Bajó 1 kg en 27 días comiendo 2000 → gasto ≈ 2000 + 7700/27 ≈ 2285
  const r = adaptiveTdee(days, [
    { date: '2026-01-01', kg: 80 },
    { date: '2026-01-28', kg: 79 },
  ]);
  assert.ok(r && Math.abs(r.tdee - 2285) < 20, JSON.stringify(r));
});

// ---------------- Segunda tanda: correcciones y funciones nuevas ----------------
import { parseQuantity, offToFood } from '../src/lib/off.ts';
import { nextTargetLog, targetsAt, dayTargets as dayTargets2, baseTargets as baseTargets2 } from '../src/lib/nutrition.ts';
import { generatePlan, dayMacros, shoppingList, swapMeal } from '../src/lib/mealPlan.ts';
import { MEAL_TEMPLATES } from '../src/data/mealTemplates.ts';
import { FOODS as FOODS2 } from '../src/data/foods.ts';
import type { Profile as Profile2 } from '../src/types.ts';

const P2: Profile2 = { name: 'Test', sex: 'm', age: 30, heightCm: 175, weightKg: 80, activity: 'ligero', goal: 'bajar', paceKg: 0.5, level: 'principiante', place: 'casa', trainingDays: 3, exerciseBack: 1, createdAt: '2026-01-01' };

test('envases de productos: kg, litros, cl y packs se pasan bien a gramos/ml', () => {
  assert.equal(parseQuantity('1 kg'), 1000);
  assert.equal(parseQuantity('1,5 L'), 1500);
  assert.equal(parseQuantity('6 x 125 g'), 750);
  assert.equal(parseQuantity('33 cl'), 330);
  assert.equal(parseQuantity('500 g'), 500);
  assert.equal(parseQuantity('12 unidades'), undefined);
  const f = offToFood({ code: '1', product_name: 'Yerba', quantity: '1 kg', nutriments: { 'energy-kcal_100g': 100 } })!;
  assert.deepEqual(f.portions, [{ label: 'Envase completo (1 kg)', grams: 1000 }]);
  assert.equal(offToFood({ code: '2', product_name: 'Jugo', quantity: '1,5 L', nutriments: { 'energy-kcal_100g': 40 } })!.unit, 'ml');
});

test('historial de objetivos: cambiar el perfil no modifica los días pasados', () => {
  const heavier = { ...P2, weightKg: 90 };
  let log = nextTargetLog(null, P2, [], '2026-01-01');
  assert.equal(log.length, 1);
  // Mismo objetivo: no se agrega nada.
  assert.equal(nextTargetLog(P2, { ...P2, name: 'Otro' }, log, '2026-02-01').length, 1);
  log = nextTargetLog(P2, heavier, log, '2026-03-01');
  assert.equal(log.length, 2);
  const old = targetsAt(log, '2026-02-15', '2026-03-10')!;
  assert.equal(old.base.kcal, baseTargets2(P2).kcal);
  assert.equal(targetsAt(log, '2026-03-05', '2026-03-10')!.base.kcal, baseTargets2(heavier).kcal);
  // Hoy siempre usa el perfil actual.
  assert.equal(targetsAt(log, '2026-03-10', '2026-03-10'), undefined);
  assert.equal(dayTargets2(heavier, 300, 30, old).kcal, baseTargets2(P2).kcal + 300);
  // Usuario que ya tenía datos sin historial: se guarda primero el objetivo viejo.
  const migrated = nextTargetLog(P2, heavier, [], '2026-03-01');
  assert.equal(migrated.length, 2);
  assert.equal(migrated[0].base.kcal, baseTargets2(P2).kcal);
});

test('plan semanal: 7 días cerca del objetivo, con lista de compras', () => {
  const foods = new Map(FOODS2.map((f) => [f.id, f]));
  for (const t of MEAL_TEMPLATES) for (const it of t.items) assert.ok(foods.has(it.id), `${t.id}: falta el alimento ${it.id}`);
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const [kcal, protein, veg] of [[1600, 120, false], [2200, 140, false], [3000, 150, false], [2000, 110, true]] as const) {
    const plan = generatePlan({ kcal, protein }, foods, { veg, today: '2026-11-10' }, rnd);
    assert.equal(plan.days.length, 7);
    let k = 0;
    let p = 0;
    for (const d of plan.days) {
      const m = dayMacros(d, foods);
      assert.ok(m.kcal > kcal * 0.85 && m.kcal < kcal * 1.2, `${kcal} kcal: día con ${m.kcal}`);
      assert.ok(m.protein > protein * 0.7, `${protein} g: día con ${m.protein} g`);
      if (veg) for (const ml of d) assert.ok(MEAL_TEMPLATES.find((t) => t.id === ml.tpl)?.veg, `${ml.name} no es vegetariano`);
      k += m.kcal;
      p += m.protein;
    }
    assert.ok(Math.abs(k / 7 - kcal) < kcal * 0.07, `promedio ${k / 7} vs ${kcal}`);
    assert.ok(p / 7 > protein * 0.88, `proteína promedio ${p / 7} vs ${protein}`);
    assert.ok(shoppingList(plan, foods).length >= 5);
    const before = plan.days[0].find((m) => m.meal === 'almuerzo')!.tpl;
    const swapped = swapMeal(plan, 0, 'almuerzo', { kcal, protein }, foods, rnd);
    assert.notEqual(swapped.days[0].find((m) => m.meal === 'almuerzo')!.tpl, before);
    assert.deepEqual(swapped.days[1], plan.days[1]);
  }
});
