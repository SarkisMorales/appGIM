import { useState } from 'react';
import type { Food } from '../../types.ts';
import { Button, Field, NumberInput, Segmented, inputCls } from '../../components/ui.tsx';
import { uid, fmt } from '../../lib/format.ts';

/** Crear un alimento propio (receta casera o producto con etiqueta). */
export default function CustomFoodForm({ onSaved, barcode, initialName }: { onSaved: (f: Food) => void; barcode?: string; initialName?: string }) {
  const [name, setName] = useState(initialName ?? '');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState<'g' | 'ml'>('g');
  const [basis, setBasis] = useState<'100' | 'porcion'>('porcion');
  const [portionLabel, setPortionLabel] = useState('1 porción');
  const [portionG, setPortionG] = useState<number | ''>(100);
  const [kcal, setKcal] = useState<number | ''>('');
  const [p, setP] = useState<number | ''>('');
  const [c, setC] = useState<number | ''>('');
  const [f, setF] = useState<number | ''>('');
  const [fib, setFib] = useState<number | ''>('');

  const base = basis === '100' ? 100 : Number(portionG) || 0;
  const k = base ? 100 / base : 0;
  const valid = name.trim().length > 1 && kcal !== '' && base > 0;

  const save = () => {
    const food: Food = {
      id: barcode ? `custom-bc-${barcode}` : `custom-${uid()}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      category: 'personal',
      kcal: Math.round(Number(kcal) * k),
      protein: Math.round((Number(p) || 0) * k * 10) / 10,
      carbs: Math.round((Number(c) || 0) * k * 10) / 10,
      fat: Math.round((Number(f) || 0) * k * 10) / 10,
      fiber: Math.round((Number(fib) || 0) * k * 10) / 10,
      unit,
      portions: basis === 'porcion' ? [{ label: portionLabel.trim() || '1 porción', grams: base }] : [],
      source: 'custom',
      barcode,
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
        Guardar alimento
      </Button>
    </div>
  );
}
