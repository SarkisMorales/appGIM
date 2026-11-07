import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
import type { Level, Place, Routine, Session, SetsBlock } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { EXERCISES, MUSCLE_LABEL, getExercise } from '../../data/exercises.ts';
import { LEVELS } from '../../data/routines.ts';
import { estimateSession } from '../../lib/training.ts';
import { searchBy } from '../../lib/search.ts';
import { Button, Card, Field, NumberInput, PageHeader, Segmented, Sheet, Stepper, cx, inputCls } from '../../components/ui.tsx';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';
import { navigate } from '../../lib/router.ts';
import { fmt, uid } from '../../lib/format.ts';

const INTENSITY = [
  { met: 3.5, label: 'Moderada', note: 'MET 3,5 · pesas 8–15 reps (02054)' },
  { met: 5.0, label: 'Exigente', note: 'MET 5,0 · básicos pesados (02052)' },
  { met: 6.0, label: 'Vigorosa', note: 'MET 6,0 · culturismo/powerlifting (02050)' },
  { met: 7.5, label: 'Circuito', note: 'MET 7,5 · circuito vigoroso con poca pausa (02040)' },
];

function ExercisePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = q.trim() ? searchBy(EXERCISES, q, (e) => e.name, (e) => e.muscles.map((m) => MUSCLE_LABEL[m]).join(' '), 100) : EXERCISES;
  return (
    <Sheet open onClose={onClose} title="Elegí un ejercicio" full accent="var(--fit)">
      <div className="relative mb-2">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input autoFocus className={cx(inputCls, 'pl-10')} placeholder="Buscar por nombre o músculo" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="divide-y divide-line">
        {list.map((e) => (
          <button key={e.id} onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 py-2 text-left">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-surface-2">
              <ExerciseFigure anim={e.anim} playing={false} className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold">{e.name}</div>
              <div className="truncate text-xs text-ink-3">{e.muscles.map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
            </div>
            <Plus size={18} className="text-fit" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function newSession(n: number, met: number): Session {
  return { id: `s${uid()}`, name: `Día ${String.fromCharCode(65 + n)}`, focus: 'Personalizada', met, warmupMin: 5, blocks: [] };
}

export default function RoutineBuilder({ id }: { id?: string }) {
  const profile = useStore((s) => s.profile)!;
  const custom = useStore((s) => s.customRoutines);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const toast = useUI((s) => s.toast);
  const existing = custom.find((r) => r.id === id);
  const [name, setName] = useState(existing?.name ?? 'Mi rutina');
  const [level, setLevel] = useState<Level>(existing?.level ?? profile.level);
  const [place, setPlace] = useState<Place>((existing?.place as Place) ?? profile.place);
  const [days, setDays] = useState(existing?.daysPerWeek ?? 3);
  const [met, setMet] = useState(existing?.sessions[0]?.met ?? 3.5);
  const [sessions, setSessions] = useState<Session[]>(existing?.sessions ?? [newSession(0, 3.5)]);
  const [si, setSi] = useState(0);
  const [picker, setPicker] = useState(false);
  const s = sessions[Math.min(si, sessions.length - 1)];
  const est = useMemo(() => estimateSession({ ...s, met }, profile.weightKg, getExercise), [s, met, profile.weightKg]);

  const updateSession = (patch: Partial<Session>) => setSessions((xs) => xs.map((x, i) => (i === si ? { ...x, ...patch } : x)));
  const updateBlock = (bi: number, patch: Partial<SetsBlock>) => updateSession({ blocks: s.blocks.map((b, i) => (i === bi && b.type === 'sets' ? { ...b, ...patch } : b)) });
  const move = (bi: number, d: number) => {
    const bs = [...s.blocks];
    const j = bi + d;
    if (j < 0 || j >= bs.length) return;
    [bs[bi], bs[j]] = [bs[j], bs[bi]];
    updateSession({ blocks: bs });
  };

  const save = () => {
    const r: Routine = {
      id: existing?.id ?? `custom-${uid()}`,
      name: name.trim() || 'Mi rutina',
      short: `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'} · ${days} días/sem`,
      level,
      place,
      goals: ['Personalizada'],
      daysPerWeek: days,
      description: 'Rutina creada por vos.',
      basedOn: '',
      metNote: INTENSITY.find((i) => i.met === met)?.note ?? `MET ${met}`,
      progression: ['Cuando completes todas las series en el tope de repeticiones, subí el peso o la dificultad.'],
      equipment: [...new Set(sessions.flatMap((x) => x.blocks.flatMap((b) => (b.type === 'sets' ? (getExercise(b.ex)?.equipment ?? []) : []))))].filter((e) => e !== 'ninguno'),
      sessions: sessions.map((x) => ({ ...x, met })),
      weekPattern: sessions.map((_, i) => i),
      suggestedDays: [1, 3, 5, 2, 4, 6, 7].slice(0, days).sort(),
      custom: true,
    };
    saveRoutine(r);
    toast('Rutina guardada ✓');
    navigate(`rutina/${r.id}`, { replace: true });
  };

  const valid = sessions.every((x) => x.blocks.length > 0);

  return (
    <div className="anim-fade">
      <PageHeader title={existing ? 'Editar rutina' : 'Crear rutina'} back="ejercicio/rutinas" />
      <Card className="space-y-3">
        <Field label="Nombre">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Segmented<Level> value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.label.split(' ')[0] }))} />
        <Segmented<Place> value={place} onChange={setPlace} options={[{ value: 'casa', label: '🏠 Casa' }, { value: 'gimnasio', label: '🏋️ Gimnasio' }]} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Días por semana">
            <Stepper value={days} onChange={setDays} min={1} max={7} />
          </Field>
          <Field label="Intensidad (para calorías)">
            <select className={inputCls} value={met} onChange={(e) => setMet(Number(e.target.value))}>
              {INTENSITY.map((i) => (
                <option key={i.met} value={i.met}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {sessions.map((x, i) => (
          <button key={x.id} onClick={() => setSi(i)} className={cx('h-9 shrink-0 rounded-full px-4 text-sm font-bold', i === si ? 'grad-fit text-white' : 'bg-surface-2 text-ink-2')}>
            {x.name}
          </button>
        ))}
        {sessions.length < 6 && (
          <button
            onClick={() => {
              setSessions((xs) => [...xs, newSession(xs.length, met)]);
              setSi(sessions.length);
            }}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm font-bold text-ink-3"
          >
            <Plus size={14} /> Sesión
          </button>
        )}
      </div>

      <Card className="mt-2">
        <div className="flex items-center gap-2">
          <input className={cx(inputCls, 'h-10 flex-1 font-bold')} value={s.name} onChange={(e) => updateSession({ name: e.target.value })} />
          {sessions.length > 1 && (
            <button
              aria-label="Eliminar sesión"
              onClick={() => {
                setSessions((xs) => xs.filter((_, i) => i !== si));
                setSi(0);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:text-danger"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <div className="num mt-2 text-xs font-semibold text-ink-3">
          ⏱ ~{fmt(est.minutes)} min · 🔥 ~{fmt(est.kcal)} kcal · {est.sets} series
        </div>
        <div className="mt-2 divide-y divide-line">
          {s.blocks.map((b, bi) => {
            if (b.type !== 'sets') return null;
            const ex = getExercise(b.ex);
            const timed = ex?.mode === 'tiempo';
            const lo = Array.isArray(b.reps) ? b.reps[0] : (b.reps ?? 10);
            const hi = Array.isArray(b.reps) ? b.reps[1] : (b.reps ?? 10);
            return (
              <div key={bi} className="py-3">
                <div className="flex items-center gap-2">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-surface-2">
                    <ExerciseFigure anim={ex?.anim} playing={false} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-[14px] font-bold">{ex?.name}</div>
                  <button aria-label="Subir" onClick={() => move(bi, -1)} className="p-1 text-ink-3">
                    <ArrowUp size={16} />
                  </button>
                  <button aria-label="Bajar" onClick={() => move(bi, 1)} className="p-1 text-ink-3">
                    <ArrowDown size={16} />
                  </button>
                  <button aria-label="Quitar" onClick={() => updateSession({ blocks: s.blocks.filter((_, i) => i !== bi) })} className="p-1 text-ink-3 hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[64px_1fr_96px] gap-2">
                  <Field label="Series">
                    <NumberInput compact value={b.sets} onChange={(v) => updateBlock(bi, { sets: Math.max(1, Math.min(10, Number(v) || 1)) })} />
                  </Field>
                  {timed ? (
                    <Field label="Segundos">
                      <NumberInput compact value={b.sec ?? 30} onChange={(v) => updateBlock(bi, { sec: Math.max(5, Number(v) || 30), reps: undefined })} />
                    </Field>
                  ) : (
                    <Field label="Reps (mín–máx)">
                      <div className="flex items-center gap-1">
                        <NumberInput compact className="flex-1" value={lo} onChange={(v) => updateBlock(bi, { reps: [Math.max(1, Number(v) || 1), Math.max(hi, Number(v) || 1)] })} />
                        <span className="text-ink-3">–</span>
                        <NumberInput compact className="flex-1" value={hi} onChange={(v) => updateBlock(bi, { reps: [lo, Math.max(lo, Number(v) || lo)] })} />
                      </div>
                    </Field>
                  )}
                  <Field label="Descanso">
                    <select className={cx(inputCls, 'px-2')} value={b.rest} onChange={(e) => updateBlock(bi, { rest: Number(e.target.value) })}>
                      {[15, 30, 45, 60, 75, 90, 120, 150, 180].map((r) => (
                        <option key={r} value={r}>
                          {r < 60 ? `${r} s` : `${r / 60} min`.replace('.5', ',5')}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="soft" block className="mt-2" onClick={() => setPicker(true)}>
          <Plus size={18} /> Agregar ejercicio
        </Button>
      </Card>

      <Button variant="fit" size="lg" block className="mt-4" disabled={!valid} onClick={save}>
        Guardar rutina
      </Button>
      {!valid && <p className="mt-2 text-center text-xs text-ink-3">Cada sesión necesita al menos un ejercicio.</p>}

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(exId) => {
            const ex = getExercise(exId);
            const block: SetsBlock = ex?.mode === 'tiempo' ? { type: 'sets', ex: exId, sets: 3, sec: 30, rest: 45 } : { type: 'sets', ex: exId, sets: 3, reps: [8, 12], rest: ex?.weighted ? 90 : 60 };
            updateSession({ blocks: [...s.blocks, block] });
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
