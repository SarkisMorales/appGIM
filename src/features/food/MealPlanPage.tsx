import { useMemo, useState } from 'react';
import { Check, Copy, Leaf, ListChecks, RefreshCw, Shuffle, Sparkles, Utensils } from 'lucide-react';
import type { MealPlan, PlanMeal } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { MEALS, useFoodMap } from '../../store/derived.ts';
import { FOOD_CATEGORIES } from '../../data/foods.ts';
import { baseTargets, per100, scaleMacros } from '../../lib/nutrition.ts';
import { dayMacros, fmtAmount, generatePlan, mealMacros, shoppingList, swapMeal } from '../../lib/mealPlan.ts';
import { Button, Card, Empty, PageHeader, Segmented, Toggle, cx } from '../../components/ui.tsx';
import { addDays, dayLabel, diffDays, todayISO, weekday, WEEKDAYS_3 } from '../../lib/dates.ts';
import { fmt, fmt1 } from '../../lib/format.ts';

const CAT_LABEL: Record<string, string> = { ...FOOD_CATEGORIES, platos: 'Platos (para cocinar o comprar hechos)', personal: 'Mis alimentos', producto: 'Productos' };

export default function MealPlanPage() {
  const profile = useStore((s) => s.profile)!;
  const plan = useStore((s) => s.mealPlan);
  const setMealPlan = useStore((s) => s.setMealPlan);
  const addEntry = useStore((s) => s.addEntry);
  const removeEntries = useStore((s) => s.removeEntries);
  const toast = useUI((s) => s.toast);
  const foods = useFoodMap();
  const today = todayISO();
  const base = useMemo(() => baseTargets(profile), [profile]);
  const target = { kcal: base.kcal, protein: base.protein };
  const [veg, setVeg] = useState(plan?.veg ?? false);
  const [tab, setTab] = useState<'menu' | 'compras'>('menu');
  const offset = plan ? diffDays(today, plan.createdAt) : 0;
  const [dayIdx, setDayIdx] = useState(Math.min(6, Math.max(0, offset)));

  const create = () => {
    const prev = plan;
    setMealPlan(generatePlan(target, foods, { veg, today }));
    setDayIdx(0);
    setTab('menu');
    if (prev) toast('Armamos un plan nuevo', { action: { label: 'Deshacer', run: () => setMealPlan(prev) } });
  };

  if (!plan) {
    return (
      <div className="anim-fade">
        <PageHeader title="Plan semanal" subtitle="Menú de 7 días + lista de compras" back="comida" />
        <Card>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-food-soft text-food">
            <Sparkles size={24} />
          </div>
          <div className="mt-3 text-lg font-extrabold">Te armamos la semana</div>
          <p className="mt-1 text-[14px] text-ink-2">
            Un menú de 7 días con comidas comunes, ajustado a tu objetivo de <b className="num">{fmt(target.kcal)} kcal</b> y <b className="num">{fmt(target.protein)} g de proteína</b> por día. Podés cambiar cualquier comida, registrarla con un toque y sacar la lista de compras.
          </p>
          <div className="mt-2 border-t border-line">
            <Toggle checked={veg} onChange={setVeg} label="Sin carne ni pescado" desc="Menú vegetariano (con huevo y lácteos)" />
          </div>
          <Button variant="food" size="lg" block className="mt-2" onClick={create}>
            <Sparkles size={18} /> Armar mi plan
          </Button>
          <p className="mt-3 text-xs text-ink-3">Es una guía con cantidades aproximadas, no una dieta médica. Si tenés una condición de salud, consultá a un nutricionista.</p>
        </Card>
      </div>
    );
  }

  const day = plan.days[dayIdx] ?? [];
  const dm = dayMacros(day, foods);
  const dayDate = addDays(plan.createdAt, dayIdx);
  // Lo que ya pasó o es de hoy se registra en su día; lo que todavía no llegó, en hoy.
  const logDate = dayDate <= today ? dayDate : today;
  const expired = offset > 6;

  const log = (ml: PlanMeal) => {
    const ids: string[] = [];
    ml.items.forEach((it) => {
      const f = foods.get(it.foodId);
      if (!f) return;
      const por = f.portions[0];
      const qty = por ? it.grams / por.grams : 0;
      const whole = por && Math.abs(qty * 2 - Math.round(qty * 2)) < 0.01 && qty >= 0.5;
      const e = addEntry(logDate, ml.meal, {
        name: f.name,
        foodId: f.id,
        amount: it.grams,
        unit: f.unit,
        portionLabel: whole ? por!.label : undefined,
        qty: whole ? qty : 1,
        source: f.source,
        per100: per100(f),
        ...scaleMacros(per100(f), it.grams),
      });
      ids.push(e.id);
    });
    toast(`${ml.name} → ${dayLabel(logDate).toLowerCase()}`, { action: { label: 'Deshacer', run: () => removeEntries(ids) } });
  };

  const swap = (ml: PlanMeal) => setMealPlan(swapMeal(plan, dayIdx, ml.meal, target, foods));

  return (
    <div className="anim-fade">
      <PageHeader title="Plan semanal" subtitle={`${fmt(plan.kcal)} kcal · ${fmt(plan.protein)} g de proteína por día`} back="comida" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'menu', label: 'Menú' },
          { value: 'compras', label: 'Lista de compras' },
        ]}
      />

      {(expired || Math.abs(plan.kcal - target.kcal) > 60) && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-warn/10 p-3 text-[13px]">
          <span className="flex-1">{expired ? 'Este plan ya cumplió su semana.' : `Tu objetivo cambió a ${fmt(target.kcal)} kcal: el plan está armado para ${fmt(plan.kcal)}.`}</span>
          <Button size="sm" variant="soft" onClick={create}>
            Armar otro
          </Button>
        </div>
      )}

      {tab === 'menu' ? (
        <>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {plan.days.map((_, i) => {
              const d = addDays(plan.createdAt, i);
              return (
                <button key={i} onClick={() => setDayIdx(i)} className={cx('rounded-2xl py-2 text-center transition', i === dayIdx ? 'bg-ink text-bg' : d === today ? 'bg-food-soft text-food' : 'bg-surface-2 text-ink-2')}>
                  <div className="text-[10px] font-bold uppercase">{WEEKDAYS_3[weekday(d) - 1]}</div>
                  <div className="num text-[15px] font-extrabold">{Number(d.slice(8))}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5 text-[13px]">
            <span className="font-semibold text-ink-2">{dayLabel(dayDate)}</span>
            <span className="num font-bold">
              {fmt(dm.kcal)} kcal · P {fmt(dm.protein)} · C {fmt(dm.carbs)} · G {fmt(dm.fat)}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {day.map((ml) => {
              const info = MEALS.find((m) => m.id === ml.meal);
              const mm = mealMacros(ml, foods);
              return (
                <Card key={ml.meal} className="p-0">
                  <div className="flex items-start gap-3 px-4 pt-3.5">
                    <span className="text-2xl">{info?.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{ml.meal === 'snacks' ? 'Colación proteica' : info?.label}</div>
                      <div className="text-[16px] font-extrabold leading-tight">{ml.name}</div>
                      <div className="num mt-0.5 text-xs text-ink-3">
                        {fmt(mm.kcal)} kcal · {fmt(mm.protein)} g de proteína
                      </div>
                    </div>
                  </div>
                  <ul className="mt-2 divide-y divide-line border-t border-line">
                    {ml.items.map((it) => {
                      const f = foods.get(it.foodId);
                      if (!f) return null;
                      const por = f.portions[0];
                      const qty = por ? it.grams / por.grams : 0;
                      const nice = por && qty >= 0.5 && Math.abs(qty * 2 - Math.round(qty * 2)) < 0.01;
                      return (
                        <li key={it.foodId} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[14px]">
                          <span className="min-w-0 truncate">{f.name}</span>
                          <span className="num shrink-0 text-right text-[13px] font-semibold text-ink-2">
                            {nice ? `${fmt1(qty)} × ${por!.label.replace(/^1 /, '')}` : fmtAmount(it.grams, f.unit)}
                            {nice && <span className="ml-1 font-normal text-ink-3">({fmtAmount(it.grams, f.unit)})</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex gap-2 border-t border-line p-3">
                    <Button size="sm" variant="soft" className="flex-1" onClick={() => swap(ml)}>
                      <Shuffle size={15} /> Cambiar
                    </Button>
                    <Button size="sm" variant="food" className="flex-1" onClick={() => log(ml)}>
                      <Utensils size={15} /> Registrar en {dayLabel(logDate).toLowerCase()}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="mt-3 px-1 text-xs text-ink-3">
            Las cantidades están ajustadas para acercarse a tu objetivo ({fmt(target.kcal)} kcal y {fmt(target.protein)} g de proteína). Los pesos de carnes, arroz, fideos y legumbres son ya cocidos.
          </p>
          <Button variant="outline" block className="mt-3" onClick={create}>
            <RefreshCw size={16} /> Armar otro plan
          </Button>
          <div className="mt-1">
            <Toggle checked={veg} onChange={setVeg} label="Sin carne ni pescado" desc="Se aplica al armar otro plan" />
          </div>
        </>
      ) : (
        <Shopping plan={plan} />
      )}
    </div>
  );
}

function Shopping({ plan }: { plan: MealPlan }) {
  const setMealPlan = useStore((s) => s.setMealPlan);
  const toast = useUI((s) => s.toast);
  const foods = useFoodMap();
  const groups = useMemo(() => shoppingList(plan, foods), [plan, foods]);
  const checked = new Set(plan.checked);
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const toggle = (id: string) => setMealPlan({ ...plan, checked: checked.has(id) ? plan.checked.filter((x) => x !== id) : [...plan.checked, id] });

  const asText = () =>
    groups
      .map((g) => `${(CAT_LABEL[g.category] ?? g.category).toUpperCase()}\n` + g.items.map((i) => `- ${i.food.name}: ${fmtAmount(i.grams, i.food.unit)}${i.units ? ` (aprox. ${i.units} × ${i.unitLabel})` : ''}`).join('\n'))
      .join('\n\n');

  const share = async () => {
    const text = `Lista de compras de la semana\n\n${asText()}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Lista de compras', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Lista copiada ✓ Pegala en WhatsApp o en tus notas');
      }
    } catch {
      /* el usuario canceló */
    }
  };

  if (!total) return <Empty icon={<ListChecks />} title="La lista está vacía" />;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5 text-[13px]">
        <span className="font-semibold text-ink-2">
          <span className="num">{plan.checked.filter((id) => groups.some((g) => g.items.some((i) => i.food.id === id))).length}</span> de <span className="num">{total}</span> en el carrito
        </span>
        <button onClick={share} className="flex items-center gap-1.5 font-bold text-food">
          <Copy size={15} /> Compartir lista
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((g) => (
          <Card key={g.category} className="p-0">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-ink-3">
              {g.category === 'verduras' || g.category === 'frutas' ? <Leaf size={14} /> : null}
              {CAT_LABEL[g.category] ?? g.category}
            </div>
            <div className="divide-y divide-line">
              {g.items.map((i) => {
                const on = checked.has(i.food.id);
                return (
                  <button key={i.food.id} onClick={() => toggle(i.food.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left" aria-pressed={on}>
                    <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition', on ? 'border-food bg-food text-white' : 'border-line')}>{on && <Check size={15} strokeWidth={3} />}</span>
                    <span className={cx('min-w-0 flex-1 truncate text-[14px]', on && 'text-ink-3 line-through')}>{i.food.name}</span>
                    <span className="num shrink-0 text-right text-[13px] font-semibold text-ink-2">
                      {fmtAmount(i.grams, i.food.unit)}
                      {i.units ? <span className="block text-[11px] font-normal text-ink-3">≈ {i.units} × {i.unitLabel}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-3 px-1 text-xs text-ink-3">
        Cantidades para los 7 días del plan. Carnes, arroz, fideos y legumbres están en peso cocido: en crudo, arroz y fideos pesan cerca de un tercio y las carnes un 25–30% más.
      </p>
    </div>
  );
}
