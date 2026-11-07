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
    if (f.kcal > 40 && !/cerveza|vino|fernet/.test(f.id)) {
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
