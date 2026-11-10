import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Food, RecipeItem } from '../../types.ts';
import { searchBy } from '../../lib/search.ts';
import { per100, scaleMacros, sumMacros } from '../../lib/nutrition.ts';
import { Button, Field, NumberInput, Stepper, cx, inputCls } from '../../components/ui.tsx';
import { fmt, fmt1, uid } from '../../lib/format.ts';

/**
 * Receta propia: sumás ingredientes con sus gramos, decís cuántas porciones rinde
 * y la app calcula las calorías y macros de cada porción.
 */
export default function RecipeForm({ foods, initial, onSaved }: { foods: Food[]; initial?: Food; onSaved: (f: Food) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [servings, setServings] = useState(initial?.recipe?.servings ?? 4);
  const [items, setItems] = useState<RecipeItem[]>(initial?.recipe?.items ?? []);
  const [q, setQ] = useState('');

  // Una receta no puede ser ingrediente de sí misma.
  const pool = useMemo(() => foods.filter((f) => f.id !== initial?.id), [foods, initial?.id]);
  const results = useMemo(() => (q.trim() ? searchBy(pool, q, (f) => `${f.name} ${f.brand ?? ''}`, (f) => f.tags ?? '', 8) : []), [pool, q]);

  const scaled = items.map((it) => scaleMacros(it.per100, it.grams));
  const total = sumMacros(scaled);
  const weight = items.reduce((a, it) => a + it.grams, 0);
  const per = (v: number) => v / Math.max(1, servings);
  const valid = name.trim().length > 1 && items.length > 0 && weight > 0;

  const add = (f: Food) => {
    setItems((l) => [...l, { foodId: f.id, name: f.name, grams: f.portions[0]?.grams ?? 100, unit: f.unit, per100: per100(f) }]);
    setQ('');
  };

  const save = () => {
    const k = 100 / weight;
    const r1 = (v: number) => Math.round(v * k * 10) / 10;
    onSaved({
      id: initial?.id ?? `custom-rec-${uid()}`,
      name: name.trim(),
      category: 'personal',
      kcal: Math.round(total.kcal * k),
      protein: r1(total.protein),
      carbs: r1(total.carbs),
      fat: r1(total.fat),
      fiber: r1(total.fiber),
      unit: 'g',
      portions: [{ label: '1 porción', grams: Math.round(weight / Math.max(1, servings)) }],
      tags: 'receta',
      source: 'custom',
      recipe: { servings, items },
    });
  };

  return (
    <div className="space-y-3">
      <Field label="Nombre de la receta">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Guiso de lentejas de casa" />
      </Field>

      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Ingredientes (peso en crudo o como lo pesaste)</div>
        {items.length > 0 && (
          <div className="mb-2 divide-y divide-line rounded-2xl border border-line">
            {items.map((it, i) => (
              <div key={it.foodId + i} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{it.name}</div>
                  <div className="num text-xs text-ink-3">
                    {fmt(scaled[i].kcal)} kcal · {fmt1(scaled[i].protein)} g prot.
                  </div>
                </div>
                <NumberInput compact className="w-24" value={it.grams || ''} onChange={(v) => setItems((l) => l.map((x, k) => (k === i ? { ...x, grams: Number(v) || 0 } : x)))} suffix={it.unit} min={0} />
                <button aria-label={`Quitar ${it.name}`} onClick={() => setItems((l) => l.filter((_, k) => k !== i))} className="p-1 text-ink-3 hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={cx(inputCls, 'pl-10')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ingrediente: arroz, pollo, aceite…" />
        </div>
        {results.length > 0 && (
          <div className="mt-1 divide-y divide-line rounded-2xl border border-line bg-surface">
            {results.map((f) => (
              <button key={f.id} onClick={() => add(f)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate text-[14px]">{f.name}</span>
                <span className="num text-xs text-ink-3">{fmt(f.kcal)} kcal/100 {f.unit}</span>
                <Plus size={16} className="text-food" />
              </button>
            ))}
          </div>
        )}
        {q.trim() && results.length === 0 && <p className="mt-1 text-xs text-ink-3">No lo encontramos. Podés crearlo antes como alimento propio y después sumarlo acá.</p>}
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">¿Cuántas porciones rinde?</div>
        <Stepper value={servings} onChange={setServings} min={1} max={40} format={(v) => `${v} ${v === 1 ? 'porción' : 'porciones'}`} />
      </div>

      {items.length > 0 && (
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Cada porción (~{fmt(per(weight))} g)</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="num text-3xl font-extrabold">
              {fmt(per(total.kcal))} <span className="text-sm font-bold text-ink-3">kcal</span>
            </div>
            <div className="num text-right text-[13px] text-ink-2">
              P {fmt1(per(total.protein))} g · C {fmt1(per(total.carbs))} g · G {fmt1(per(total.fat))} g
            </div>
          </div>
          <div className="num mt-1 text-xs text-ink-3">
            Receta completa: {fmt(total.kcal)} kcal · {fmt(weight)} g
          </div>
        </div>
      )}

      <Button variant="food" size="lg" block disabled={!valid} onClick={save}>
        {initial ? 'Guardar cambios' : 'Guardar receta'}
      </Button>
      <p className="text-xs text-ink-3">Queda guardada en “Mis alimentos” para cargarla por porción o por gramos.</p>
    </div>
  );
}
