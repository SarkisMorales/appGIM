import { useRef, useState, type ReactNode } from 'react';
import { Camera, ChevronDown, Loader2, ScanText } from 'lucide-react';
import type { Food } from '../../types.ts';
import type { ProductDraft } from '../../lib/off.ts';
import type { LabelResult } from '../../lib/labelOcr.ts';
import { Button, Field, NumberInput, Segmented, cx, inputCls } from '../../components/ui.tsx';
import { uid, fmt } from '../../lib/format.ts';

type Num = number | '';
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Crear o editar un alimento propio (producto con etiqueta o comida casera). Puede leer la tabla nutricional con la cámara. */
export default function CustomFoodForm({
  onSaved,
  barcode,
  initialName,
  initial,
  draft,
  notice,
}: {
  onSaved: (f: Food) => void;
  barcode?: string;
  initialName?: string;
  initial?: Food;
  draft?: ProductDraft;
  notice?: ReactNode;
}) {
  // Al editar, mostramos los valores como los cargaste: por porción si tiene una, si no cada 100.
  const por = initial?.portions[0];
  const back = (v?: number): Num => (v == null ? '' : r1((v * (por?.grams ?? 100)) / 100));
  const [name, setName] = useState(initial?.name ?? draft?.name ?? initialName ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? draft?.brand ?? '');
  const [unit, setUnit] = useState<'g' | 'ml'>(initial?.unit ?? draft?.unit ?? 'g');
  const [basis, setBasis] = useState<'100' | 'porcion'>(initial && !por ? '100' : 'porcion');
  const [portionLabel, setPortionLabel] = useState(por?.label ?? draft?.portion?.label ?? '1 porción');
  const [portionG, setPortionG] = useState<Num>(por?.grams ?? draft?.portion?.grams ?? (initial ? '' : 100));
  const [kcal, setKcal] = useState<Num>(initial ? Math.round(Number(back(initial.kcal))) : '');
  const [p, setP] = useState<Num>(initial ? back(initial.protein) : '');
  const [c, setC] = useState<Num>(initial ? back(initial.carbs) : '');
  const [f, setF] = useState<Num>(initial ? back(initial.fat) : '');
  const [fib, setFib] = useState<Num>(initial ? back(initial.fiber ?? 0) : '');
  const [sug, setSug] = useState<Num>(initial ? back(initial.sugar) : '');
  const [sat, setSat] = useState<Num>(initial ? back(initial.satFat) : '');
  const [na, setNa] = useState<Num>(initial?.sodium != null ? Math.round(Number(back(initial.sodium))) : '');
  const [more, setMore] = useState(!!(initial?.sugar ?? initial?.satFat ?? initial?.sodium));
  const [ocr, setOcr] = useState<{ status: 'idle' | 'busy' | 'done' | 'error'; pct: number; msg?: string; res?: LabelResult }>({ status: 'idle', pct: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const portionNum = Number(portionG) || 0;
  const base = basis === '100' ? 100 : portionNum;
  const k = base ? 100 / base : 0;
  const valid = name.trim().length > 1 && kcal !== '' && base > 0;

  const readLabel = async (file: File) => {
    setOcr({ status: 'busy', pct: 0, msg: 'Preparando el lector…' });
    try {
      const { readLabelPhoto } = await import('../../lib/labelOcr.ts');
      const { result } = await readLabelPhoto(file, (pct, st) =>
        setOcr((o) => ({ ...o, pct: st.includes('recogn') ? 0.3 + pct * 0.7 : pct * 0.3, msg: st.includes('recogn') ? 'Leyendo la etiqueta…' : 'Descargando el lector (solo la primera vez)…' })),
      );
      if (result.found < 2) {
        setOcr({ status: 'error', pct: 0, msg: 'No pudimos leer la tabla. Sacá la foto de frente, con buena luz, que la tabla ocupe toda la imagen y sin reflejos.' });
        return;
      }
      // Cada lectura reemplaza la anterior: lo que no se leyó queda vacío para completarlo.
      const set = (fn: (v: Num) => void, v?: number) => fn(v ?? '');
      setBasis(result.basis);
      if (result.portionG) {
        setPortionG(result.portionG);
        if (result.portionLabel) setPortionLabel(result.portionLabel);
      }
      if (result.unit) setUnit(result.unit);
      set(setKcal, result.kcal);
      set(setP, result.protein);
      set(setC, result.carbs);
      set(setF, result.fat);
      set(setFib, result.fiber);
      set(setSug, result.sugar);
      set(setSat, result.satFat);
      set(setNa, result.sodium);
      if (result.sugar != null || result.satFat != null || result.sodium != null) setMore(true);
      setOcr({ status: 'done', pct: 1, res: result });
    } catch {
      setOcr({ status: 'error', pct: 0, msg: 'No se pudo usar el lector de etiquetas (¿sin conexión la primera vez?). Cargá los valores a mano.' });
    }
  };

  const save = () => {
    const opt = (v: Num) => (v === '' ? undefined : r1(Number(v) * k));
    // En modo "cada 100" la porción es opcional: no guardamos la de ejemplo (1 porción = 100) si no se tocó.
    const keepPortion = portionNum > 0 && (basis === 'porcion' || !(portionNum === 100 && portionLabel.trim() === '1 porción'));
    const portions = keepPortion ? [{ label: portionLabel.trim() || '1 porción', grams: portionNum }] : [];
    const food: Food = {
      ...(initial ?? {}),
      id: initial?.id ?? (barcode ? `custom-bc-${barcode}` : `custom-${uid()}`),
      name: name.trim(),
      brand: brand.trim() || undefined,
      category: 'personal',
      kcal: Math.round(Number(kcal) * k),
      protein: r1((Number(p) || 0) * k),
      carbs: r1((Number(c) || 0) * k),
      fat: r1((Number(f) || 0) * k),
      fiber: r1((Number(fib) || 0) * k),
      sugar: opt(sug),
      satFat: opt(sat),
      sodium: na === '' ? undefined : Math.round(Number(na) * k),
      unit,
      portions: [...portions, ...(initial?.portions.slice(1) ?? [])],
      source: initial?.source ?? 'custom',
      barcode: initial?.barcode ?? barcode,
      image: initial?.image ?? draft?.image,
      dataNote: undefined,
    };
    onSaved(food);
  };

  const readHint = ocr.status === 'done' ? 'border-food/60 bg-food-soft/40' : '';

  return (
    <div className="space-y-3">
      {notice}

      {!initial?.recipe && (
        <div className="rounded-2xl border border-dashed border-line p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) readLabel(file);
            }}
          />
          {ocr.status === 'busy' ? (
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Loader2 size={16} className="animate-spin" /> {ocr.msg}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-food transition-all" style={{ width: `${Math.round(ocr.pct * 100)}%` }} />
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-food-soft text-food">
                <ScanText size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-bold">{ocr.status === 'done' ? 'Volver a leer la etiqueta' : 'Leer la tabla nutricional con la cámara'}</span>
                <span className="block text-xs text-ink-3">Sacale una foto a la tabla del envase y completamos los números.</span>
              </span>
              <Camera size={18} className="text-ink-3" />
            </button>
          )}
          {ocr.status === 'error' && <p className="mt-2 text-[13px] text-danger">{ocr.msg}</p>}
          {ocr.status === 'done' && ocr.res && (
            <p className="mt-2 text-[13px] text-ink-2">
              Leímos {ocr.res.found} valores {ocr.res.basis === '100' ? `cada 100 ${unit}` : 'por porción'}. <b>Revisalos con el envase</b> antes de guardar.
              {ocr.res.warning && <span className="block text-warn">{ocr.res.warning}</span>}
            </p>
          )}
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
      <div className="grid grid-cols-2 gap-2">
        <Field label={basis === '100' ? 'Porción habitual (opcional)' : 'Nombre de la porción'}>
          <input className={inputCls} value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)} />
        </Field>
        <Field label="Tamaño">
          <NumberInput value={portionG} onChange={setPortionG} suffix={unit} />
        </Field>
      </div>
      <Field label={`Calorías (${basis === '100' ? `cada 100 ${unit}` : 'por porción'})`}>
        <div className={cx('rounded-2xl border border-transparent', readHint)}>
          <NumberInput value={kcal} onChange={setKcal} suffix="kcal" />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Proteínas">
          <NumberInput value={p} onChange={setP} suffix="g" />
        </Field>
        <Field label="Carbohidratos">
          <NumberInput value={c} onChange={setC} suffix="g" />
        </Field>
        <Field label="Grasas">
          <NumberInput value={f} onChange={setF} suffix="g" />
        </Field>
        <Field label="Fibra">
          <NumberInput value={fib} onChange={setFib} suffix="g" />
        </Field>
      </div>
      <button onClick={() => setMore(!more)} className="flex items-center gap-1 text-[13px] font-bold text-ink-3">
        <ChevronDown size={16} className={cx('transition-transform', more && 'rotate-180')} /> Azúcares, grasas saturadas y sodio (opcional)
      </button>
      {more && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Azúcares">
            <NumberInput value={sug} onChange={setSug} suffix="g" />
          </Field>
          <Field label="Saturadas">
            <NumberInput value={sat} onChange={setSat} suffix="g" />
          </Field>
          <Field label="Sodio">
            <NumberInput value={na} onChange={setNa} suffix="mg" />
          </Field>
        </div>
      )}
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
