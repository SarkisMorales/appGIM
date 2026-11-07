import { useState } from 'react';
import { Copy, Dumbbell, MoreHorizontal, Plus, Save, Trash2 } from 'lucide-react';
import type { FoodEntry, MealId } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { MEALS, useDay, useFoodMap } from '../../store/derived.ts';
import { EQUIVALENTS, minutesToBurn, sumMacros } from '../../lib/nutrition.ts';
import { Button, Card, Field, MacroRow, PageHeader, Sheet, inputCls, cx } from '../../components/ui.tsx';
import { DateNav } from '../../components/DateNav.tsx';
import { FoodDetail, MacroSplitBar, CATEGORY_EMOJI } from './FoodDetail.tsx';
import { draftFrom } from './AddFoodSheet.tsx';
import { WaterCard } from './WaterSheet.tsx';
import { addDays } from '../../lib/dates.ts';
import { fmt, fmt1 } from '../../lib/format.ts';
import { navigate } from '../../lib/router.ts';

function entryLabel(e: FoodEntry) {
  if (e.source === 'quick') return 'Agregado rápido';
  if (e.portionLabel) return (e.qty ?? 1) === 1 ? e.portionLabel : `${fmt1(e.qty ?? 1)} × ${e.portionLabel.replace(/^1 /, '')}`;
  return `${fmt(e.amount)} ${e.unit}`;
}

function EntryEditSheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const foods = useFoodMap();
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const restoreEntry = useStore((s) => s.restoreEntry);
  const toast = useUI((s) => s.toast);
  const kg = useStore((s) => s.profile?.weightKg ?? 70);
  const food =
    (entry.foodId && foods.get(entry.foodId)) ||
    (entry.per100
      ? { id: entry.foodId ?? entry.id, name: entry.name, brand: entry.brand, category: 'personal' as const, ...entry.per100, unit: entry.unit, portions: [], source: 'custom' as const }
      : null);

  const del = () => {
    removeEntry(entry.id);
    onClose();
    toast(`${entry.name} eliminado`, { action: { label: 'Deshacer', run: () => restoreEntry(entry) } });
  };

  return (
    <Sheet open onClose={onClose} title="Editar" accent="var(--food)">
      {food && entry.source !== 'quick' ? (
        <FoodDetail
          food={food}
          confirmLabel="Guardar cambios"
          initial={{ amount: entry.amount, portionLabel: entry.portionLabel, qty: entry.qty ?? 1, meal: entry.meal }}
          onConfirm={(c) => {
            const d = draftFrom(food, c);
            updateEntry(entry.id, { ...d, meal: c.meal, name: entry.name, brand: entry.brand });
            onClose();
          }}
        />
      ) : (
        <div>
          <div className="text-lg font-extrabold">{entry.name}</div>
          <div className="num mt-1 text-sm text-ink-2">
            {fmt(entry.kcal)} kcal · P {fmt1(entry.protein)} · C {fmt1(entry.carbs)} · G {fmt1(entry.fat)}
          </div>
          <div className="mt-2 text-xs text-ink-3">
            Equivale a {fmt(minutesToBurn(entry.kcal, EQUIVALENTS[0].met, kg))} min {EQUIVALENTS[0].label}.
          </div>
        </div>
      )}
      <Button variant="danger" block className="mt-3" onClick={del}>
        <Trash2 size={16} /> Eliminar
      </Button>
    </Sheet>
  );
}

function MealMenu({ meal, date, items, onClose }: { meal: MealId; date: string; items: FoodEntry[]; onClose: () => void }) {
  const copyMeal = useStore((s) => s.copyMeal);
  const saveMeal = useStore((s) => s.saveMeal);
  const removeEntry = useStore((s) => s.removeEntry);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState(`Mi ${MEALS.find((m) => m.id === meal)?.label.toLowerCase()}`);
  const label = MEALS.find((m) => m.id === meal)?.label;
  return (
    <Sheet open onClose={onClose} title={label}>
      <div className="space-y-2">
        <Button
          variant="soft"
          block
          onClick={() => {
            const n = copyMeal(addDays(date, -1), date, meal);
            toast(n ? `Copiamos ${n} alimento${n > 1 ? 's' : ''} de ayer` : 'Ayer no registraste esta comida');
            onClose();
          }}
        >
          <Copy size={16} /> Copiar {label?.toLowerCase()} de ayer
        </Button>
        {items.length > 0 && (
          <div className="rounded-2xl border border-line p-3">
            <Field label="Guardar como comida para reutilizarla">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button
              variant="food"
              block
              className="mt-2"
              onClick={() => {
                saveMeal(
                  name.trim() || 'Mi comida',
                  items.map(({ id: _id, date: _d, meal: _m, createdAt: _c, ...rest }) => rest),
                );
                toast('Comida guardada. La encontrás en “Mis comidas” ✓');
                onClose();
              }}
            >
              <Save size={16} /> Guardar comida
            </Button>
          </div>
        )}
        {items.length > 0 && (
          <Button
            variant="danger"
            block
            onClick={() => {
              items.forEach((e) => removeEntry(e.id));
              toast('Comida vaciada');
              onClose();
            }}
          >
            <Trash2 size={16} /> Vaciar {label?.toLowerCase()}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export default function FoodPage() {
  const date = useUI((s) => s.date);
  const openSheet = useUI((s) => s.openSheet);
  const day = useDay(date);
  const foods = useFoodMap();
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [menu, setMenu] = useState<MealId | null>(null);
  if (!day) return null;
  const t = day.targets;

  return (
    <div className="anim-fade">
      <PageHeader title="Comida" subtitle="Conectada con tu entreno" right={<DateNav />} />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Consumido</div>
            <div className="num text-3xl font-extrabold">
              {fmt(day.consumed.kcal)}
              <span className="text-base font-bold text-ink-3"> / {fmt(t.kcal)} kcal</span>
            </div>
          </div>
          <div className={cx('rounded-full px-3 py-1 text-sm font-extrabold', day.remaining.kcal < 0 ? 'bg-danger/10 text-danger' : 'bg-food-soft text-food')}>
            {day.remaining.kcal < 0 ? `+${fmt(-day.remaining.kcal)} de más` : `${fmt(day.remaining.kcal)} restantes`}
          </div>
        </div>
        {t.bonus > 0 && (
          <button onClick={() => navigate('ejercicio/historial')} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-fit-soft px-3 py-2 text-left text-[13px] text-ink-2">
            <Dumbbell size={16} className="shrink-0 text-fit" />
            <span>
              Tu entrenamiento de hoy sumó <b className="text-fit">+{fmt(t.bonus)} kcal</b> a tu objetivo (base {fmt(t.base.kcal)}).
            </span>
          </button>
        )}
        <MacroSplitBar className="mt-3" protein={day.consumed.protein} carbs={day.consumed.carbs} fat={day.consumed.fat} />
        <div className="mt-4 space-y-3">
          <MacroRow label="Proteína" value={day.consumed.protein} target={t.protein} color="var(--pro)" />
          <MacroRow label="Carbohidratos" value={day.consumed.carbs} target={t.carbs} color="var(--carb)" />
          <MacroRow label="Grasas" value={day.consumed.fat} target={t.fat} color="var(--fat)" />
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {MEALS.map((ml) => {
          const items = day.byMeal[ml.id];
          const tot = sumMacros(items);
          return (
            <Card key={ml.id} className="p-0">
              <div className="flex items-center gap-3 px-4 pb-2 pt-3.5">
                <span className="text-2xl">{ml.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-extrabold">{ml.label}</div>
                  <div className="num text-xs text-ink-3">
                    {items.length ? `${fmt(tot.kcal)} kcal · P ${fmt(tot.protein)} · C ${fmt(tot.carbs)} · G ${fmt(tot.fat)}` : ml.hint}
                  </div>
                </div>
                <button aria-label={`Opciones de ${ml.label}`} onClick={() => setMenu(ml.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2">
                  <MoreHorizontal size={18} />
                </button>
                <button aria-label={`Agregar a ${ml.label}`} onClick={() => openSheet({ kind: 'addFood', date, meal: ml.id })} className="grad-food flex h-9 w-9 items-center justify-center rounded-full text-white active:scale-90">
                  <Plus size={18} strokeWidth={2.6} />
                </button>
              </div>
              {items.length > 0 && (
                <div className="divide-y divide-line border-t border-line">
                  {items.map((e) => (
                    <button key={e.id} onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                      <span className="text-lg">{e.source === 'quick' ? '⚡' : CATEGORY_EMOJI[(e.foodId && foods.get(e.foodId)?.category) || (e.source === 'off' ? 'producto' : 'personal')] ?? '🍽️'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{e.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {e.brand ? `${e.brand} · ` : ''}
                          {entryLabel(e)}
                        </span>
                      </span>
                      <span className="num text-right text-sm font-bold">
                        {fmt(e.kcal)}
                        <span className="block text-[11px] font-semibold text-ink-3">P {fmt(e.protein)} g</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4">
        <WaterCard date={date} />
      </div>

      {editing && <EntryEditSheet entry={editing} onClose={() => setEditing(null)} />}
      {menu && <MealMenu meal={menu} date={date} items={day.byMeal[menu]} onClose={() => setMenu(null)} />}
    </div>
  );
}
