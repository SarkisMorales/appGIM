import { useState } from 'react';
import type { Food } from '../../types.ts';
import { Button, Field, NumberInput, Segmented, inputCls } from '../../components/ui.tsx';
import { uid, fmt } from '../../lib/format.ts';

/** Crear un alimento propio (receta casera o producto con etiqueta). */
export default function CustomFoodForm({ onSaved, barcode, initialName, initial }: { onSaved: (f: Food) => void; barcode?: string; initialName?: string; initial?: Food }) {
  // Al editar, mostramos los valores como los cargaste: por porción si tiene una, si no cada 100.
  const por = initial?.portions[0];
  const back = (v?: number) => (v == null ? '' : Math.round(((v * (por?.grams ?? 100)) / 100) * 10) / 10);
  const [name, setName] = useState(initial?.name ?? initialName ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [unit, setUnit] = useState<'g' | 'ml'>(initial?.unit ?? 'g');
  const [basis, setBasis] = useState<'100' | 'porcion'>(initial && !por ? '100' : 'porcion');
  const [portionLabel, setPortionLabel] = useState(por?.label ?? '1 porción');
  const [portionG, setPortionG] = useState<number | ''>(por?.grams ?? 100);
  const [kcal, setKcal] = useState<number | ''>(initial ? Math.round(Number(back(initial.kcal))) : '');
  const [p, setP] = useState<number | ''>(initial ? back(initial.protein) : '');
  const [c, setC] = useState<number | ''>(initial ? back(initial.carbs) : '');
  const [f, setF] = useState<number | ''>(initial ? back(initial.fat) : '');
  const [fib, setFib] = useState<number | ''>(initial ? back(initial.fiber ?? 0) : '');

  const base = basis === '100' ? 100 : Number(portionG) || 0;
  const k = base ? 100 / base : 0;
  const valid = name.trim().length > 1 && kcal !== '' && base > 0;

  const save = () => {
    const food: Food = {
      ...(initial ?? {}),
      id: initial?.id ?? (barcode ? `custom-bc-${barcode}` : `custom-${uid()}`),
      name: name.trim(),
      brand: brand.trim() || undefined,
      category: 'personal',
      kcal: Math.round(Number(kcal) * k),
      protein: Math.round((Number(p) || 0) * k * 10) / 10,
      carbs: Math.round((Number(c) || 0) * k * 10) / 10,
      fat: Math.round((Number(f) || 0) * k * 10) / 10,
      fiber: Math.round((Number(fib) || 0) * k * 10) / 10,
      unit,
      portions: basis === 'porcion' ? [{ label: portionLabel.trim() || '1 porción', grams: base }, ...(initial?.portions.slice(1) ?? [])] : [],
      source: initial?.source ?? 'custom',
      barcode: initial?.barcode ?? barcode,
    };
    onSaved(food);
  };

  return (
    <div className="space-y-3">
      {barcode && (
        <div className="rounded-2xl bg-warn/10 p-3 text-[13px]">
          No encontramos el código <b className="num">{barcode}</b>. Cargalo una vez con los datos del envase y la próxima vez lo reconocemos al instante.
        </div>
      )}
      <Field label="Nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Tarta de zapallitos de mamá" />
      </Field>
      <Field label="Marca (opcional)">
        <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Segmented value={unit} onChange={setUnit} options={[{ value: 'g', label: 'Sólido (g)' }, { value: 'ml', label: 'Líquido (ml)' }]} />
        <Segmented value={basis} onChange={setBasis} options={[{ value: 'porcion', label: 'Por porción' }, { value: '100', label: `Por 100 ${unit}` }]} />
      </div>
      {basis === 'porcion' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nombre de la porción">
            <input className={inputCls} value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)} />
          </Field>
          <Field label="Tamaño">
            <NumberInput value={portionG} onChange={setPortionG} suffix={unit} />
          </Field>
        </div>
      )}
      <Field label={`Calorías (${basis === '100' ? `cada 100 ${unit}` : 'por porción'})`}>
        <NumberInput value={kcal} onChange={setKcal} suffix="kcal" />
      </Field>
      <div className="grid grid-cols-4 gap-2">
        <Field label="Prot.">
          <NumberInput value={p} onChange={setP} suffix="g" />
        </Field>
        <Field label="Carbos">
          <NumberInput value={c} onChange={setC} suffix="g" />
        </Field>
        <Field label="Grasas">
          <NumberInput value={f} onChange={setF} suffix="g" />
        </Field>
        <Field label="Fibra">
          <NumberInput value={fib} onChange={setFib} suffix="g" />
        </Field>
      </div>
      {kcal !== '' && (Number(p) || Number(c) || Number(f)) ? (
        <p className="text-xs text-ink-3">
          Control: los macros suman {fmt((Number(p) || 0) * 4 + (Number(c) || 0) * 4 + (Number(f) || 0) * 9)} kcal (Atwater: 4/4/9).
        </p>
      ) : null}
      <Button variant="food" size="lg" block disabled={!valid} onClick={save}>
        {initial ? 'Guardar cambios' : 'Guardar alimento'}
      </Button>
    </div>
  );
}
