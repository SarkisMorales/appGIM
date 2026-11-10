import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Ruler, Trash2 } from 'lucide-react';
import type { Measure } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { Button, Card, Chip, Field, NumberInput, Sheet, cx, inputCls } from '../../components/ui.tsx';
import { LineChart } from '../../components/charts.tsx';
import { fmt1 } from '../../lib/format.ts';
import { shortDate, todayISO } from '../../lib/dates.ts';
import { addPhoto, deletePhoto, listPhotos, type ProgressPhoto } from '../../lib/photos.ts';

type MKey = Exclude<keyof Measure, 'date'>;
const MEASURES: { id: MKey; label: string; hint: string }[] = [
  { id: 'cintura', label: 'Cintura', hint: 'A la altura del ombligo' },
  { id: 'pecho', label: 'Pecho', hint: 'A la altura de las tetillas' },
  { id: 'cadera', label: 'Cadera', hint: 'En la parte más ancha' },
  { id: 'brazo', label: 'Brazo', hint: 'Bíceps contraído' },
  { id: 'muslo', label: 'Muslo', hint: 'En la mitad del muslo' },
];

function MeasureSheet({ onClose }: { onClose: () => void }) {
  const measures = useStore((s) => s.measures);
  const setMeasure = useStore((s) => s.setMeasure);
  const removeMeasure = useStore((s) => s.removeMeasure);
  const toast = useUI((s) => s.toast);
  const [date, setDate] = useState(todayISO());
  const existing = measures.find((m) => m.date === date);
  const last = measures[measures.length - 1];
  const [vals, setVals] = useState<Partial<Record<MKey, number | ''>>>(() => ({ ...(existing ?? {}) }));
  const any = MEASURES.some((m) => Number(vals[m.id]) > 0);

  return (
    <Sheet open onClose={onClose} title="Registrar medidas" accent="var(--bal)">
      <p className="text-[13px] text-ink-2">En centímetros. Cargá solo las que quieras seguir; medite siempre en el mismo lugar y a la misma hora.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MEASURES.map((m) => (
          <Field key={m.id} label={m.label} hint={last?.[m.id] ? `Última: ${fmt1(last[m.id]!)} cm` : m.hint}>
            <NumberInput value={vals[m.id] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [m.id]: v }))} suffix="cm" step={0.5} min={10} max={250} />
          </Field>
        ))}
        <Field label="Fecha">
          <input
            type="date"
            className={inputCls}
            value={date}
            max={todayISO()}
            onChange={(e) => {
              const d = e.target.value || todayISO();
              setDate(d);
              const ex = measures.find((m) => m.date === d);
              if (ex) setVals({ ...ex });
            }}
          />
        </Field>
      </div>
      <Button
        variant="bal"
        size="lg"
        block
        className="mt-4"
        disabled={!any}
        onClick={() => {
          const m: Measure = { date };
          MEASURES.forEach((k) => {
            const v = Number(vals[k.id]);
            if (v > 0) m[k.id] = Math.round(v * 10) / 10;
          });
          setMeasure(m);
          toast('Medidas guardadas ✓');
          onClose();
        }}
      >
        Guardar
      </Button>
      {measures.length > 0 && (
        <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {[...measures]
            .reverse()
            .slice(0, 6)
            .map((m) => (
              <div key={m.date} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                <span className="w-14 shrink-0 text-ink-2">{shortDate(m.date)}</span>
                <span className="num min-w-0 flex-1 truncate text-ink-3">
                  {MEASURES.filter((k) => m[k.id])
                    .map((k) => `${k.label} ${fmt1(m[k.id]!)}`)
                    .join(' · ')}
                </span>
                <button aria-label="Eliminar medición" onClick={() => removeMeasure(m.date)} className="p-1 text-ink-3 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
      )}
    </Sheet>
  );
}

export function MeasuresCard() {
  const measures = useStore((s) => s.measures);
  const [open, setOpen] = useState(false);
  const used = MEASURES.filter((m) => measures.some((x) => x[m.id]));
  const [sel, setSel] = useState<MKey | null>(null);
  const key = sel && used.some((u) => u.id === sel) ? sel : used[0]?.id;
  const series = key ? measures.filter((m) => m[key]).map((m) => ({ date: m.date, v: m[key]! })) : [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold">Medidas corporales</div>
          <p className="text-xs text-ink-3">La balanza no cuenta todo: la cintura suele bajar antes que el peso.</p>
        </div>
        <Button variant="bal" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          <Ruler size={16} /> Registrar
        </Button>
      </div>
      {used.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {used.map((m) => {
              const pts = measures.filter((x) => x[m.id]);
              const first = pts[0][m.id]!;
              const lastV = pts[pts.length - 1][m.id]!;
              const d = lastV - first;
              return (
                <button key={m.id} onClick={() => setSel(m.id)} className={cx('rounded-2xl p-2.5 text-left transition', key === m.id ? 'bg-bal-soft ring-1 ring-bal/40' : 'bg-surface-2')}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{m.label}</div>
                  <div className="num text-lg font-extrabold">
                    {fmt1(lastV)} <span className="text-[11px] font-semibold text-ink-3">cm</span>
                  </div>
                  {pts.length > 1 && (
                    <div className="num text-[11px] font-semibold text-ink-2">
                      {d > 0 ? '+' : ''}
                      {fmt1(d)} cm
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {series.length >= 2 ? (
            <div className="mt-3">
              <LineChart points={series} unit="cm" label={`Evolución de ${MEASURES.find((m) => m.id === key)?.label}`} height={140} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-3">Con una segunda medición vas a ver el gráfico de evolución.</p>
          )}
        </>
      )}
      {open && <MeasureSheet onClose={() => setOpen(false)} />}
    </Card>
  );
}

// ---------------- Fotos de progreso ----------------
function usePhotoUrls(photos: ProgressPhoto[]) {
  const urls = useMemo(() => new Map(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export function PhotosCard() {
  const toast = useUI((s) => s.toast);
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ProgressPhoto | null>(null);
  const [filter, setFilter] = useState<'todas' | 'comparar'>('todas');
  const input = useRef<HTMLInputElement>(null);

  const reload = () =>
    listPhotos()
      .then(setPhotos)
      .catch(() => setPhotos([]));
  useEffect(() => {
    void reload();
  }, []);
  const list = photos ?? [];
  const urls = usePhotoUrls(list);

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      await addPhoto(f, todayISO());
      await reload();
      toast('Foto guardada en este dispositivo ✓');
    } catch {
      toast('No pudimos guardar la foto. Probá con otra imagen.', { tone: 'warn' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const first = list[0];
  const last = list[list.length - 1];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold">Fotos de progreso</div>
          <p className="text-xs text-ink-3">Quedan solo en este dispositivo: no se suben a ningún lado ni entran en el backup.</p>
        </div>
        <Button variant="bal" size="sm" className="shrink-0" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Agregar
        </Button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>

      {list.length >= 2 && (
        <div className="mt-3 flex gap-2">
          <Chip active={filter === 'todas'} onClick={() => setFilter('todas')}>
            Todas ({list.length})
          </Chip>
          <Chip active={filter === 'comparar'} onClick={() => setFilter('comparar')}>
            Antes y ahora
          </Chip>
        </div>
      )}

      {list.length > 0 && filter === 'comparar' && first && last && first.id !== last.id ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[first, last].map((p, i) => (
            <button key={p.id} onClick={() => setView(p)} className="overflow-hidden rounded-2xl bg-surface-2 text-left">
              <img src={urls.get(p.id)} alt={`Foto del ${shortDate(p.date)}`} className="aspect-[3/4] w-full object-cover" />
              <div className="px-2 py-1.5 text-xs">
                <b>{i === 0 ? 'Antes' : 'Ahora'}</b> <span className="text-ink-3">· {shortDate(p.date)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[...list].reverse().map((p) => (
            <button key={p.id} onClick={() => setView(p)} className="relative overflow-hidden rounded-xl bg-surface-2">
              <img src={urls.get(p.id)} alt={`Foto del ${shortDate(p.date)}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">{shortDate(p.date)}</span>
            </button>
          ))}
        </div>
      ) : (
        photos && <p className="mt-3 text-xs text-ink-3">Consejo: misma luz, misma pose y misma hora cada 2 a 4 semanas. Los cambios se ven mejor en fotos que en el espejo.</p>
      )}

      {view && (
        <Sheet open onClose={() => setView(null)} title={shortDate(view.date)}>
          <img src={urls.get(view.id)} alt={`Foto del ${shortDate(view.date)}`} className="max-h-[62dvh] w-full rounded-2xl object-contain" />
          <Button
            variant="danger"
            block
            className="mt-3"
            onClick={async () => {
              await deletePhoto(view.id).catch(() => {});
              setView(null);
              await reload();
              toast('Foto eliminada');
            }}
          >
            <Trash2 size={16} /> Eliminar foto
          </Button>
        </Sheet>
      )}
    </Card>
  );
}
