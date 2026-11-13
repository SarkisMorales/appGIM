import { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, ChefHat, ChevronLeft, ExternalLink, Globe, Loader2, Pencil, Plus, Search, Star, Trash2, Zap, PencilLine, History, UtensilsCrossed } from 'lucide-react';
import type { EntryDraft, Food, MealId } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { MEALS, mealForNow, useDay } from '../../store/derived.ts';
import { FOODS } from '../../data/foods.ts';
import { searchFoods } from '../../lib/foodSearch.ts';
import { offContributeUrl, searchOff } from '../../lib/off.ts';
import { per100, scaleMacros, sumMacros } from '../../lib/nutrition.ts';
import { Button, Chip, Empty, Field, NumberInput, Sheet, cx, inputCls } from '../../components/ui.tsx';
import { CATEGORY_EMOJI, FoodDetail, type PortionChoice } from './FoodDetail.tsx';
import CustomFoodForm from './CustomFoodForm.tsx';
import BarcodeScanner, { type MissingProduct } from './BarcodeScanner.tsx';
import RecipeForm from './RecipeForm.tsx';
import { dayLabel, todayISO } from '../../lib/dates.ts';
import { fmt } from '../../lib/format.ts';

type Tab = 'buscar' | 'recientes' | 'favoritos' | 'mios' | 'comidas';
type View = { v: 'list' } | { v: 'detail'; food: Food } | { v: 'custom'; barcode?: string; name?: string; food?: Food; missing?: MissingProduct } | { v: 'recipe'; food?: Food } | { v: 'scan' } | { v: 'quick' };

const POPULAR = ['huevo', 'pollo-pechuga', 'arroz-blanco', 'banana', 'pan-frances', 'leche-entera', 'yogur-entero', 'manzana', 'avena', 'fideos', 'milanesa-carne-horno', 'cafe-con-leche', 'mate', 'empanada-carne', 'tomate', 'palta', 'papa-hervida', 'queso-cremoso', 'carne-picada-comun', 'pizza-muzza'];

export function draftFrom(food: Food, c: Pick<PortionChoice, 'amount' | 'portionLabel' | 'qty'>): EntryDraft {
  const p = per100(food);
  return {
    name: food.name,
    brand: food.brand,
    foodId: food.id,
    amount: c.amount,
    unit: food.unit,
    portionLabel: c.portionLabel,
    qty: c.qty,
    source: food.source,
    per100: p,
    ...scaleMacros(p, c.amount),
  };
}

/** Porción que se usa al tocar "+": nunca el envase entero de un producto (sería una carga enorme sin querer). */
function defaultPortion(f: Food) {
  return f.portions.find((p) => !p.label.startsWith('Envase completo')) ?? { label: `100 ${f.unit}`, grams: 100 };
}

function FoodRow({ food, onOpen, onQuick, sub }: { food: Food; onOpen: () => void; onQuick: () => void; sub?: string }) {
  const por = defaultPortion(food);
  const kcal = Math.round((food.kcal * por.grams) / 100);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-xl">
          {food.image ? <img src={food.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : CATEGORY_EMOJI[food.category] ?? '🍽️'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{food.name}</span>
          <span className="block truncate text-xs text-ink-3">
            {food.brand ? `${food.brand} · ` : ''}
            {sub ?? `${por.label} · ${fmt(kcal)} kcal`}
          </span>
        </span>
      </button>
      <button aria-label={`Agregar ${food.name}`} onClick={onQuick} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-food-soft text-food active:scale-90">
        <Plus size={18} strokeWidth={2.6} />
      </button>
    </div>
  );
}

export default function AddFoodSheet({ open, onClose, date, initialMeal }: { open: boolean; onClose: () => void; date: string; initialMeal?: MealId }) {
  const [meal, setMeal] = useState<MealId>(initialMeal ?? mealForNow());
  const [tab, setTab] = useState<Tab>('buscar');
  const [view, setView] = useState<View>({ v: 'list' });
  const [q, setQ] = useState('');
  const [off, setOff] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; items: Food[]; q: string }>({ status: 'idle', items: [], q: '' });
  const abortRef = useRef<AbortController | null>(null);

  const customFoods = useStore((s) => s.customFoods);
  const recents = useStore((s) => s.recents);
  const favorites = useStore((s) => s.favorites);
  const savedMeals = useStore((s) => s.savedMeals);
  const country = useStore((s) => s.settings.offCountry);
  const addEntry = useStore((s) => s.addEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const pushRecent = useStore((s) => s.pushRecent);
  const saveCustomFood = useStore((s) => s.saveCustomFood);
  const removeSavedMeal = useStore((s) => s.removeSavedMeal);
  const removeCustomFood = useStore((s) => s.removeCustomFood);
  const toast = useUI((s) => s.toast);
  const day = useDay(date);

  useEffect(() => () => abortRef.current?.abort(), []);

  const all = useMemo(() => [...customFoods, ...FOODS], [customFoods]);
  const byId = useMemo(() => {
    const m = new Map(all.map((f) => [f.id, f]));
    recents.forEach((r) => !m.has(r.food.id) && m.set(r.food.id, r.food));
    return m;
  }, [all, recents]);
  // Productos con código que ya conocemos (cargados por vos o escaneados antes): se reconocen sin internet.
  const knownProducts = useMemo(() => [...customFoods, ...recents.map((r) => r.food)].filter((f) => f.barcode), [customFoods, recents]);
  // Lo que registrás seguido (recientes) y tus favoritos suben en los resultados.
  const boost = useMemo(() => {
    const m = new Map<string, number>(POPULAR.map((id) => [id, 1]));
    recents.forEach((r, i) => m.set(r.food.id, Math.max(1, 3 - i * 0.1)));
    favorites.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1.5));
    return m;
  }, [recents, favorites]);
  const results = useMemo(() => (q.trim() ? searchFoods(all, q, 40, boost) : []), [all, q, boost]);

  const add = (food: Food, c: PortionChoice) => {
    const e = addEntry(date, c.meal, draftFrom(food, c));
    pushRecent({ food, amount: c.amount, portionLabel: c.portionLabel, qty: c.qty });
    if (food.source === 'off' && !customFoods.some((f) => f.id === food.id)) {
      // Guardamos el producto para que funcione offline la próxima vez.
      saveCustomFood({ ...food });
    }
    toast(`${food.name} → ${MEALS.find((m) => m.id === c.meal)?.label}`, { action: { label: 'Deshacer', run: () => removeEntry(e.id) } });
  };

  const quickAdd = (food: Food) => {
    const r = recents.find((x) => x.food.id === food.id);
    const por = defaultPortion(food);
    add(food, r ? { amount: r.amount, portionLabel: r.portionLabel, qty: r.qty ?? 1, meal } : { amount: por.grams, portionLabel: por.label, qty: 1, meal });
  };

  const runOff = async () => {
    const term = q.trim();
    if (!term) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setOff({ status: 'loading', items: [], q: term });
    try {
      const items = await searchOff(term, country, ac.signal);
      setOff({ status: 'done', items, q: term });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setOff({ status: 'error', items: [], q: term });
    }
  };

  // Si con lo que tenemos guardado hay pocos resultados, buscamos solos en productos de supermercado.
  const localCount = results.length;
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3 || localCount >= 4 || (off.q === term && off.status !== 'idle')) return;
    const t = setTimeout(runOff, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, localCount]);

  const title =
    view.v === 'list' ? (
      <span className="flex items-center gap-2">
        Agregar comida
      </span>
    ) : (
      <button onClick={() => setView({ v: 'list' })} className="-ml-1 flex items-center gap-1 text-lg font-bold">
        <ChevronLeft size={22} />
        {view.v === 'detail' ? 'Porción' : view.v === 'custom' ? (view.food ? 'Editar alimento' : 'Nuevo alimento') : view.v === 'recipe' ? (view.food ? 'Editar receta' : 'Nueva receta') : view.v === 'scan' ? 'Escanear código' : 'Agregado rápido'}
      </button>
    );

  const remaining = day ? day.remaining.kcal : undefined;

  return (
    <Sheet open={open} onClose={onClose} title={title} full accent="var(--food)">
      {view.v === 'list' && (
        <div>
          <div className="sticky top-0 z-10 -mx-5 bg-bg px-5 pb-2 pt-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setTab('buscar');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && results.length === 0 && runOff()}
                  placeholder="Buscar: milanesa, yogur, banana…"
                  className={cx(inputCls, 'pl-10')}
                  enterKeyHint="search"
                />
              </div>
              <button onClick={() => setView({ v: 'scan' })} aria-label="Escanear código de barras" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-bg active:scale-95">
                <Barcode size={22} />
              </button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              {MEALS.map((ml) => (
                <Chip key={ml.id} active={meal === ml.id} onClick={() => setMeal(ml.id)}>
                  {ml.emoji} {ml.label}
                </Chip>
              ))}
            </div>
            {!q && (
              <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                {(
                  [
                    ['buscar', 'Sugeridos', Search],
                    ['recientes', 'Recientes', History],
                    ['favoritos', 'Favoritos', Star],
                    ['mios', 'Mis alimentos', PencilLine],
                    ['comidas', 'Mis comidas', UtensilsCrossed],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setTab(id)} className={cx('flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-bold', tab === id ? 'bg-food-soft text-food' : 'text-ink-3')}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {day && (
            <div className="mb-1 flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-[13px]">
              <span className="text-ink-3">{date === todayISO() ? 'Te quedan hoy' : `Te quedan · ${dayLabel(date).toLowerCase()}`}</span>
              <span className={cx('num font-extrabold', day.remaining.kcal < 0 ? 'text-danger' : 'text-food')}>{fmt(day.remaining.kcal)} kcal</span>
            </div>
          )}

          {q ? (
            <div>
              <div className="divide-y divide-line">
                {results.map((f) => (
                  <FoodRow key={f.id} food={f} onOpen={() => setView({ v: 'detail', food: f })} onQuick={() => quickAdd(f)} />
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-dashed border-line p-3">
                {off.status === 'idle' || off.q !== q.trim() ? (
                  <button onClick={runOff} className="flex w-full items-center gap-3 text-left">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bal-soft text-bal">
                      <Globe size={18} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold">Buscar “{q.trim()}” en productos de supermercado</span>
                      <span className="block text-xs text-ink-3">Open Food Facts · gratis · requiere internet</span>
                    </span>
                  </button>
                ) : off.status === 'loading' ? (
                  <div className="flex items-center gap-2 text-sm text-ink-3">
                    <Loader2 size={16} className="animate-spin" /> Buscando productos…
                  </div>
                ) : off.status === 'error' ? (
                  <div className="text-sm">
                    <b>El buscador online está ocupado o no hay conexión.</b>
                    <p className="text-ink-3">Probá de nuevo en unos segundos o escaneá el código de barras (es más confiable).</p>
                    <Button size="sm" variant="soft" className="mt-2" onClick={runOff}>
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Productos ({off.items.length})</div>
                    {off.items.length === 0 && <p className="mt-1 text-sm text-ink-3">Sin resultados. Probá con otra palabra o cargalo vos.</p>}
                    <div className="divide-y divide-line">
                      {off.items.map((f) => (
                        <FoodRow key={f.id} food={f} onOpen={() => setView({ v: 'detail', food: f })} onQuick={() => quickAdd(f)} sub={`${fmt(f.kcal)} kcal / 100 ${f.unit}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="soft" onClick={() => setView({ v: 'custom', name: q.trim() })}>
                  <PencilLine size={16} /> Crear alimento
                </Button>
                <Button variant="soft" onClick={() => setView({ v: 'quick' })}>
                  <Zap size={16} /> Solo calorías
                </Button>
              </div>
            </div>
          ) : tab === 'buscar' ? (
            <div>
              {recents.length > 0 && <div className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-3">Lo último que comiste</div>}
              <div className="divide-y divide-line">
                {recents.slice(0, 6).map((r) => (
                  <FoodRow key={r.food.id} food={r.food} onOpen={() => setView({ v: 'detail', food: r.food })} onQuick={() => quickAdd(r.food)} sub={`${r.portionLabel ? `${r.qty ?? 1} × ${r.portionLabel}` : `${fmt(r.amount)} ${r.food.unit}`} · ${fmt((r.food.kcal * r.amount) / 100)} kcal`} />
                ))}
              </div>
              <div className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-3">Populares</div>
              <div className="divide-y divide-line">
                {POPULAR.slice(0, 16).map((id) => byId.get(id))
                  .filter((f): f is Food => !!f)
                  .map((f) => (
                    <FoodRow key={f.id} food={f} onOpen={() => setView({ v: 'detail', food: f })} onQuick={() => quickAdd(f)} />
                  ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="soft" onClick={() => setView({ v: 'quick' })}>
                  <Zap size={16} /> Solo calorías
                </Button>
                <Button variant="soft" onClick={() => setView({ v: 'custom' })}>
                  <PencilLine size={16} /> Crear alimento
                </Button>
                <Button variant="soft" className="col-span-2" onClick={() => setView({ v: 'recipe' })}>
                  <ChefHat size={16} /> Armar una receta con ingredientes
                </Button>
              </div>
            </div>
          ) : tab === 'recientes' ? (
            recents.length ? (
              <div className="divide-y divide-line">
                {recents.map((r) => (
                  <FoodRow key={r.food.id} food={r.food} onOpen={() => setView({ v: 'detail', food: r.food })} onQuick={() => quickAdd(r.food)} />
                ))}
              </div>
            ) : (
              <Empty icon={<History />} title="Todavía no hay recientes" text="Los alimentos que registres van a aparecer acá para cargarlos con un toque." />
            )
          ) : tab === 'favoritos' ? (
            favorites.length ? (
              <div className="divide-y divide-line">
                {favorites
                  .map((id) => byId.get(id))
                  .filter((f): f is Food => !!f)
                  .map((f) => (
                    <FoodRow key={f.id} food={f} onOpen={() => setView({ v: 'detail', food: f })} onQuick={() => quickAdd(f)} />
                  ))}
              </div>
            ) : (
              <Empty icon={<Star />} title="Sin favoritos" text="Tocá el corazón en cualquier alimento para guardarlo acá." />
            )
          ) : tab === 'mios' ? (
            <div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="food" onClick={() => setView({ v: 'custom' })}>
                  <Plus size={18} /> Alimento
                </Button>
                <Button variant="outline" onClick={() => setView({ v: 'recipe' })}>
                  <ChefHat size={18} /> Receta
                </Button>
              </div>
              <div className="mt-2 divide-y divide-line">
                {customFoods.map((f) => (
                  <div key={f.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <FoodRow food={f} onOpen={() => setView({ v: 'detail', food: f })} onQuick={() => quickAdd(f)} />
                    </div>
                    <button aria-label={`Editar ${f.name}`} onClick={() => setView(f.recipe ? { v: 'recipe', food: f } : { v: 'custom', food: f })} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:text-ink">
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Eliminar ${f.name}`}
                      onClick={() => {
                        removeCustomFood(f.id);
                        toast(`${f.name} eliminado`, { action: { label: 'Deshacer', run: () => saveCustomFood(f) } });
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {!customFoods.length && <Empty title="Tus alimentos" text="Cargá un producto con su etiqueta, o armá una receta con ingredientes y la app calcula cada porción. Los productos escaneados también se guardan acá." />}
            </div>
          ) : (
            <div>
              {savedMeals.length ? (
                <div className="mt-2 space-y-2">
                  {savedMeals.map((sm) => {
                    const tot = sumMacros(sm.items);
                    return (
                      <div key={sm.id} className="rounded-2xl border border-line bg-surface p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold">{sm.name}</div>
                            <div className="truncate text-xs text-ink-3">{sm.items.map((i) => i.name).join(', ')}</div>
                            <div className="num mt-1 text-xs font-semibold text-ink-2">
                              {fmt(tot.kcal)} kcal · {fmt(tot.protein)} g prot.
                            </div>
                          </div>
                          <button aria-label="Eliminar comida guardada" onClick={() => removeSavedMeal(sm.id)} className="p-1 text-ink-3 hover:text-danger">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <Button
                          size="sm"
                          variant="food"
                          className="mt-2"
                          onClick={() => {
                            sm.items.forEach((it) => addEntry(date, meal, it));
                            toast(`${sm.name} agregada ✓`);
                          }}
                        >
                          <Plus size={16} /> Agregar a {MEALS.find((m) => m.id === meal)?.label}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty icon={<UtensilsCrossed />} title="Guardá tus comidas habituales" text="Desde la pantalla Comida, en el menú de cada comida, tocá “Guardar como comida” para reutilizarla con un toque." />
              )}
            </div>
          )}
        </div>
      )}

      {view.v === 'detail' && (
        <FoodDetail
          food={view.food}
          remainingKcal={remaining}
          initial={(() => {
            const r = recents.find((x) => x.food.id === view.food.id);
            const por = defaultPortion(view.food);
            return r ? { amount: r.amount, portionLabel: r.portionLabel, qty: r.qty ?? 1, meal } : { amount: por.grams, portionLabel: view.food.portions.length ? por.label : undefined, qty: 1, meal };
          })()}
          onConfirm={(c) => {
            add(view.food, c);
            setView({ v: 'list' });
          }}
        />
      )}

      {view.v === 'custom' && (
        <CustomFoodForm
          key={view.food?.id ?? view.barcode ?? 'new'}
          barcode={view.barcode}
          initialName={view.name}
          initial={view.food}
          draft={view.missing?.draft}
          notice={
            view.missing && (
              <MissingNotice
                m={view.missing}
                onSearch={() => {
                  setQ('');
                  setView({ v: 'list' });
                }}
                onRescan={() => setView({ v: 'scan' })}
              />
            )
          }
          onSaved={(f) => {
            saveCustomFood(f);
            if (view.food) toast('Cambios guardados ✓');
            setView({ v: 'detail', food: f });
          }}
        />
      )}

      {view.v === 'recipe' && (
        <RecipeForm
          key={view.food?.id ?? 'new'}
          foods={all}
          initial={view.food}
          onSaved={(f) => {
            saveCustomFood(f);
            toast(view.food ? 'Receta actualizada ✓' : 'Receta guardada en “Mis alimentos” ✓');
            setView({ v: 'detail', food: f });
          }}
        />
      )}

      {view.v === 'scan' && (
        <BarcodeScanner
          onFound={(f) => setView({ v: 'detail', food: f })}
          onMissing={(m) => setView({ v: 'custom', barcode: m.code, missing: m })}
          known={knownProducts}
        />
      )}

      {view.v === 'quick' && (
        <QuickAdd
          onAdd={(d, ml) => {
            const e = addEntry(date, ml, d);
            toast(`${d.name} agregado`, { action: { label: 'Deshacer', run: () => removeEntry(e.id) } });
            setView({ v: 'list' });
          }}
          meal={meal}
        />
      )}
    </Sheet>
  );
}

/** Explica por qué un código no trajo datos y qué hacer (con la foto de la etiqueta se completa en segundos). */
function MissingNotice({ m, onSearch, onRescan }: { m: MissingProduct; onSearch: () => void; onRescan: () => void }) {
  return (
    <div className="rounded-2xl bg-warn/10 p-3 text-[13px] leading-snug">
      {m.draft ? (
        <>
          Encontramos <b>{m.draft.name || `el código ${m.code}`}</b>
          {m.draft.brand ? ` (${m.draft.brand})` : ''} en Open Food Facts, pero <b>sin la tabla nutricional</b>. Completala una vez (podés leerla con la cámara) y la próxima vez lo reconocemos al instante.
        </>
      ) : m.instore ? (
        <>
          <b className="num">{m.code}</b> es un <b>código de balanza del súper</b> (fiambrería, carnicería, verdulería o panadería): esos códigos los arma cada local y no figuran en ninguna base. Buscá el alimento por nombre (ej: jamón cocido, queso, pan) o cargalo acá.
        </>
      ) : (
        <>
          El código <b className="num">{m.code}</b> todavía no está en Open Food Facts. Cargalo una vez (sacale una foto a la tabla nutricional y completamos los números) y la próxima vez lo reconocemos al instante.
        </>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-bold">
        {m.instore && (
          <button onClick={onSearch} className="text-food">
            Buscar por nombre
          </button>
        )}
        <button onClick={onRescan} className="text-food">
          Escanear de nuevo
        </button>
        {!m.instore && (
          <a href={offContributeUrl(m.code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-3">
            Sumarlo a Open Food Facts <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function QuickAdd({ onAdd, meal }: { onAdd: (d: EntryDraft, meal: MealId) => void; meal: MealId }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | ''>('');
  const [p, setP] = useState<number | ''>('');
  const [c, setC] = useState<number | ''>('');
  const [f, setF] = useState<number | ''>('');
  const [m, setM] = useState<MealId>(meal);
  const macroKcal = (Number(p) || 0) * 4 + (Number(c) || 0) * 4 + (Number(f) || 0) * 9;
  const total = kcal === '' ? macroKcal : Number(kcal);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">Para cuando no encontrás el alimento o comiste afuera: cargá solo las calorías (y si querés, los macros).</p>
      <Field label="Descripción">
        <input className={inputCls} placeholder="Ej: Almuerzo en el trabajo" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Calorías" hint={kcal === '' && macroKcal > 0 ? `Calculadas desde los macros: ${fmt(macroKcal)} kcal` : undefined}>
        <NumberInput value={kcal} onChange={setKcal} suffix="kcal" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Proteína">
          <NumberInput value={p} onChange={setP} suffix="g" />
        </Field>
        <Field label="Carbos">
          <NumberInput value={c} onChange={setC} suffix="g" />
        </Field>
        <Field label="Grasas">
          <NumberInput value={f} onChange={setF} suffix="g" />
        </Field>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {MEALS.map((ml) => (
          <Chip key={ml.id} active={m === ml.id} onClick={() => setM(ml.id)}>
            {ml.emoji} {ml.label}
          </Chip>
        ))}
      </div>
      <Button
        variant="food"
        size="lg"
        block
        disabled={!total}
        onClick={() =>
          onAdd(
            { name: name.trim() || 'Agregado rápido', amount: 1, unit: 'g', source: 'quick', kcal: Math.round(total), protein: Number(p) || 0, carbs: Number(c) || 0, fat: Number(f) || 0, fiber: 0 },
            m,
          )
        }
      >
        Agregar {total ? `${fmt(total)} kcal` : ''}
      </Button>
    </div>
  );
}
