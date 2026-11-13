import { useMemo, useState } from 'react';
import { AlertTriangle, Heart, Info } from 'lucide-react';
import type { Food, MealId } from '../../types.ts';
import { useStore } from '../../store/useStore.ts';
import { MEALS } from '../../store/derived.ts';
import { EQUIVALENTS, macroSplit, minutesToBurn, per100, scaleMacros } from '../../lib/nutrition.ts';
import { Button, Chip, NumberInput, Stepper, cx } from '../../components/ui.tsx';
import { fmt, fmt1 } from '../../lib/format.ts';

export const CATEGORY_EMOJI: Record<string, string> = {
  carnes: '🥩',
  pescados: '🐟',
  huevos: '🥚',
  lacteos: '🥛',
  cereales: '🍞',
  legumbres: '🫘',
  frutas: '🍎',
  verduras: '🥦',
  'frutos-secos': '🥜',
  grasas: '🫒',
  bebidas: '🥤',
  dulces: '🍫',
  platos: '🍲',
  suplementos: '💊',
  personal: '⭐',
  producto: '🏷️',
};

export function MacroSplitBar({ protein, carbs, fat, className }: { protein: number; carbs: number; fat: number; className?: string }) {
  const s = macroSplit({ protein, carbs, fat });
  return (
    <div className={cx('flex h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div style={{ width: `${s.p * 100}%`, background: 'var(--pro)' }} />
      <div style={{ width: `${s.c * 100}%`, background: 'var(--carb)' }} />
      <div style={{ width: `${s.f * 100}%`, background: 'var(--fat)' }} />
    </div>
  );
}

const NUTRISCORE_COLOR: Record<string, string> = { a: '#038141', b: '#5f9e2f', c: '#c98d00', d: '#d4581d', e: '#c2271b' };
const NOVA_LABEL: Record<number, string> = { 1: 'Sin procesar', 2: 'Ingrediente culinario', 3: 'Procesado', 4: 'Ultraprocesado' };

/** Fibra, azúcares, grasas saturadas y sodio de la porción elegida (si el alimento los tiene). */
function NutrientExtras({ food, amount }: { food: Food; amount: number }) {
  const k = amount / 100;
  const items = [
    food.fiber ? { l: 'Fibra', v: `${fmt1(food.fiber * k)} g` } : null,
    food.sugar != null ? { l: 'Azúcares', v: `${fmt1(food.sugar * k)} g` } : null,
    food.satFat != null ? { l: 'Grasas sat.', v: `${fmt1(food.satFat * k)} g` } : null,
    food.sodium != null ? { l: 'Sodio', v: `${fmt(food.sodium * k)} mg` } : null,
  ].filter((x): x is { l: string; v: string } => !!x);
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-xs text-ink-2">
      {items.map((x) => (
        <span key={x.l}>
          <span className="text-ink-3">{x.l}</span> <b className="num">{x.v}</b>
        </span>
      ))}
    </div>
  );
}

export interface PortionChoice {
  amount: number;
  portionLabel?: string;
  qty: number;
  meal: MealId;
}

/** Selector de porción con vista previa de macros y equivalencia en ejercicio. */
export function FoodDetail({
  food,
  initial,
  onConfirm,
  confirmLabel = 'Agregar',
  remainingKcal,
}: {
  food: Food;
  initial: PortionChoice;
  onConfirm: (c: PortionChoice) => void;
  confirmLabel?: string;
  remainingKcal?: number;
}) {
  const kg = useStore((s) => s.profile?.weightKg ?? 70);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const unit = food.unit;
  const portions = useMemo(() => [...food.portions, { label: `100 ${unit}`, grams: 100 }], [food.portions, unit]);
  const initialIdx = initial.portionLabel ? portions.findIndex((p) => p.label === initial.portionLabel) : -1;
  const [mode, setMode] = useState<number>(initialIdx >= 0 ? initialIdx : initial.portionLabel === undefined && food.portions.length ? 0 : -1);
  const [qty, setQty] = useState(initialIdx >= 0 || (initial.portionLabel === undefined && food.portions.length) ? initial.qty || 1 : 1);
  const [grams, setGrams] = useState<number | ''>(initial.amount || 100);
  const [meal, setMeal] = useState<MealId>(initial.meal);

  const amount = mode >= 0 ? portions[mode].grams * qty : Number(grams) || 0;
  const m = scaleMacros(per100(food), amount);
  const fav = favorites.includes(food.id);
  const after = remainingKcal != null ? remainingKcal - m.kcal : null;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-3xl">
          {food.image ? <img src={food.image} alt="" className="h-full w-full object-cover" /> : CATEGORY_EMOJI[food.category] ?? '🍽️'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold leading-tight">{food.name}</div>
          <div className="text-[13px] text-ink-3">
            {food.brand ? `${food.brand} · ` : ''}
            {fmt(food.kcal)} kcal cada 100 {unit}
          </div>
          {(food.nutriscore || food.nova) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {food.nutriscore && (
                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-extrabold uppercase text-white" style={{ background: NUTRISCORE_COLOR[food.nutriscore] }} title="Nutri-Score: calidad nutricional de A (mejor) a E">
                  Nutri-Score {food.nutriscore}
                </span>
              )}
              {food.nova && (
                <span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-bold', food.nova === 4 ? 'bg-danger/10 text-danger' : 'bg-surface-3 text-ink-2')} title="NOVA: grado de procesamiento">
                  {NOVA_LABEL[food.nova]}
                </span>
              )}
            </div>
          )}
        </div>
        <button aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'} onClick={() => toggleFavorite(food.id)} className={cx('flex h-10 w-10 items-center justify-center rounded-full', fav ? 'bg-pro/15 text-pro' : 'bg-surface-2 text-ink-3')}>
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {portions.map((p, i) => (
          <Chip key={p.label + i} active={mode === i} onClick={() => { setMode(i); setQty(1); }}>
            {p.label}
          </Chip>
        ))}
        <Chip active={mode === -1} onClick={() => { setMode(-1); setGrams(Math.round(amount) || 100); }}>
          {unit === 'ml' ? 'Mililitros' : 'Gramos'}
        </Chip>
      </div>

      <div className="mt-3">
        {mode >= 0 ? (
          <Stepper value={qty} onChange={setQty} step={0.5} min={0.5} max={50} format={(v) => <span>{fmt1(v)} <span className="text-sm font-semibold text-ink-3">× {portions[mode].label.replace(/^1 /, '')}</span></span>} />
        ) : (
          <NumberInput value={grams} onChange={setGrams} suffix={unit} />
        )}
        <div className="mt-1 text-center text-xs text-ink-3">
          = {fmt(amount)} {unit}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-surface-2 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="num text-3xl font-extrabold">{fmt(m.kcal)}</div>
            <div className="text-xs font-semibold text-ink-3">kcal</div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right">
            {[
              { l: 'Prot.', v: m.protein, c: 'var(--pro)' },
              { l: 'Carbos', v: m.carbs, c: 'var(--carb)' },
              { l: 'Grasas', v: m.fat, c: 'var(--fat)' },
            ].map((x) => (
              <div key={x.l}>
                <div className="num text-lg font-extrabold">{fmt1(x.v)}</div>
                <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-ink-3">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.c }} />
                  {x.l} g
                </div>
              </div>
            ))}
          </div>
        </div>
        <MacroSplitBar className="mt-3" protein={m.protein} carbs={m.carbs} fat={m.fat} />
        {m.kcal > 30 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            <span className="font-semibold text-ink-3">Equivale a:</span>
            {EQUIVALENTS.slice(0, 2).map((e) => (
              <span key={e.id}>
                {e.emoji} {fmt(minutesToBurn(m.kcal, e.met, kg))} min {e.label}
              </span>
            ))}
          </div>
        )}
        <NutrientExtras food={food} amount={amount} />
        {after != null && (
          <div className={cx('mt-2 text-xs font-semibold', after < 0 ? 'text-danger' : 'text-ink-3')}>
            {after >= 0 ? `Te quedarían ${fmt(after)} kcal en el día` : `Te pasarías ${fmt(-after)} kcal de tu objetivo`}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {MEALS.map((ml) => (
          <Chip key={ml.id} active={meal === ml.id} onClick={() => setMeal(ml.id)}>
            {ml.emoji} {ml.label}
          </Chip>
        ))}
      </div>

      <Button variant="food" size="lg" block className="mt-4" disabled={amount <= 0} onClick={() => onConfirm({ amount, portionLabel: mode >= 0 ? portions[mode].label : undefined, qty: mode >= 0 ? qty : 1, meal })}>
        {confirmLabel}
      </Button>
      {food.dataNote && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-warn/10 p-2.5 text-[12px] text-ink-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
          {food.dataNote}
        </p>
      )}
      {food.source !== 'custom' && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-3">
          <Info size={12} className="mt-0.5 shrink-0" />
          {food.source === 'usda' && 'Valores de USDA FoodData Central (dominio público).'}
          {food.source === 'est' && 'Valores estimados por receta típica: pueden variar según la preparación.'}
          {food.source === 'off' && 'Datos de Open Food Facts (base colaborativa). Verificá con el envase.'}
        </p>
      )}
    </div>
  );
}
