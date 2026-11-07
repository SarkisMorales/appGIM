import { useMemo, useState } from 'react';
import { Beef, Calculator, CalendarCheck, Check, Clock, Droplets, Film, Flame, Pencil, Play, Repeat, Trash2, TrendingUp } from 'lucide-react';
import type { Block } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { findRoutine, useDay } from '../../store/derived.ts';
import { EQUIPMENT_LABEL, getExercise } from '../../data/exercises.ts';
import { hasAnim } from '../../data/animations.ts';
import { estimateSession, repsLabel, summarizeRoutine } from '../../lib/training.ts';
import { baseTargets } from '../../lib/nutrition.ts';
import { Badge, Button, Card, Empty, PageHeader, SectionTitle, Segmented, Sheet, Stat, cx } from '../../components/ui.tsx';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';
import { levelInfo } from './ExercisePage.tsx';
import { navigate } from '../../lib/router.ts';
import { fmt, fmt1 } from '../../lib/format.ts';
import { WEEKDAYS_SHORT, todayISO } from '../../lib/dates.ts';

function BlockView({ b }: { b: Block }) {
  if (b.type === 'sets') {
    const ex = getExercise(b.ex);
    return (
      <button onClick={() => navigate(`ej/${b.ex}`)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
          <ExerciseFigure anim={ex?.anim} playing={false} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{ex?.name ?? b.ex}</div>
          <div className="text-[13px] text-ink-2">
            <b>{b.sets}</b> × {b.sec ? `${b.sec} s` : `${repsLabel(b.reps)} reps`}
            {ex?.perSide ? ' por lado' : ''} · descanso {b.rest >= 60 ? `${fmt1(b.rest / 60)} min` : `${b.rest} s`}
          </div>
          {(b.load || b.note) && <div className="truncate text-xs text-fit">{[b.load, b.note].filter(Boolean).join(' · ')}</div>}
        </div>
      </button>
    );
  }
  return (
    <div className="py-2.5">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-fit">
        <Repeat size={14} /> {b.name}: {b.rounds} {b.rounds === 1 ? 'vuelta' : 'vueltas'}
        {b.items.some((i) => !i.reps && !i.sec) ? ` · ${b.work} s trabajo / ${b.rest} s pausa` : ''}
        {b.restRounds ? ` · ${b.restRounds} s entre vueltas` : ''}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {b.items.map((it, i) => {
          const ex = getExercise(it.ex);
          return (
            <button key={i} onClick={() => navigate(`ej/${it.ex}`)} className="rounded-2xl bg-surface-2 p-1.5 text-left">
              <ExerciseFigure anim={ex?.anim} playing={false} className="aspect-square w-full" />
              <div className="line-clamp-2 px-1 text-[11px] font-bold leading-tight">{ex?.name}</div>
              <div className="px-1 text-[11px] text-ink-3">{it.reps ? `${it.reps} reps` : `${it.sec ?? b.work} s`}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanSheet({ routineId, suggested, count, onClose }: { routineId: string; suggested: number[]; count: number; onClose: () => void }) {
  const setPlan = useStore((s) => s.setPlan);
  const toast = useUI((s) => s.toast);
  const [days, setDays] = useState<number[]>(suggested.slice(0, count));
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()));
  return (
    <Sheet open onClose={onClose} title="¿Qué días entrenás?" accent="var(--fit)">
      <p className="text-sm text-ink-2">Recomendado: {count} días, con al menos un día de descanso entre sesiones del mismo grupo muscular.</p>
      <div className="mt-4 flex justify-between gap-1.5">
        {WEEKDAYS_SHORT.map((l, i) => (
          <button key={i} onClick={() => toggle(i + 1)} className={cx('flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-extrabold transition', days.includes(i + 1) ? 'grad-fit text-white' : 'bg-surface-2 text-ink-3')}>
            {l}
          </button>
        ))}
      </div>
      <Button
        variant="fit"
        size="lg"
        block
        className="mt-5"
        disabled={!days.length}
        onClick={() => {
          setPlan({ routineId, days, startedAt: todayISO(), nextIndex: 0 });
          toast('¡Plan activado! Lo vas a ver en Inicio ✓');
          onClose();
        }}
      >
        <CalendarCheck size={18} /> Activar plan
      </Button>
    </Sheet>
  );
}

export default function RoutineDetail({ id }: { id?: string }) {
  const custom = useStore((s) => s.customRoutines);
  const profile = useStore((s) => s.profile)!;
  const plan = useStore((s) => s.plan);
  const removeRoutine = useStore((s) => s.removeRoutine);
  const day = useDay(todayISO());
  const r = findRoutine(id, custom);
  const [si, setSi] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const kg = profile.weightKg;
  const sum = useMemo(() => (r ? summarizeRoutine(r, kg, getExercise, (eid) => !!getExercise(eid) && hasAnim(getExercise(eid)!.anim)) : null), [r, kg]);

  if (!r || !sum) {
    return (
      <div>
        <PageHeader title="Rutina" back="ejercicio/rutinas" />
        <Empty title="No encontramos esta rutina" />
      </div>
    );
  }
  const session = r.sessions[Math.min(si, r.sessions.length - 1)];
  const est = estimateSession(session, kg, getExercise);
  const lv = levelInfo(r.level);
  const prot = est.proteinG;
  const base = baseTargets(profile);
  const bonus = Math.round(est.netKcal * profile.exerciseBack);
  const isPlan = plan?.routineId === r.id;

  return (
    <div className="anim-fade">
      <PageHeader title={r.name} subtitle={r.short} back="ejercicio/rutinas" />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-25 blur-2xl" style={{ background: lv.color }} />
        <div className="relative flex flex-wrap gap-1.5">
          <Badge style={{ background: `${lv.color}22`, color: lv.color }}>
            {lv.emoji} {lv.label}
          </Badge>
          <Badge>{r.place === 'gimnasio' ? '🏋️ Gimnasio' : r.place === 'casa' ? '🏠 Casa / plaza' : 'Casa o gimnasio'}</Badge>
          {r.goals.map((g) => (
            <Badge key={g}>{g}</Badge>
          ))}
        </div>
        <p className="relative mt-3 text-[14px] leading-relaxed text-ink-2">{r.description}</p>
        {r.basedOn && <p className="relative mt-2 text-xs text-ink-3">Basada en: {r.basedOn}</p>}
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <Stat label="Por sesión" value={fmt(sum.avgMinutes)} unit="min" icon={<Clock size={12} />} />
          <Stat label="Quema / sesión" value={fmt(sum.avgKcal)} unit="kcal" icon={<Flame size={12} className="text-fit" />} />
          <Stat label="Proteína post" value={prot} unit="g" icon={<Beef size={12} className="text-pro" />} />
          <Stat label="Con animación" value={`${sum.animated}/${sum.totalExercises}`} unit="ejercicios" icon={<Film size={12} />} />
        </div>
        <div className="relative mt-2 rounded-2xl bg-surface-2 p-3 text-[13px] text-ink-2">
          <b>{r.daysPerWeek} días/semana</b> · ~{fmt(sum.weeklyMinutes)} min y ~{fmt(sum.weeklyKcal)} kcal por semana. Tu proteína diaria: <b className="text-pro">{base.protein} g</b> ({base.proteinPerKg} g/kg).
        </div>
        {r.equipment.length > 0 && (
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {r.equipment.map((e) => (
              <Badge key={e}>{EQUIPMENT_LABEL[e]}</Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Fusión: qué cambia en tu comida si hacés esta sesión */}
      <div className="mt-3 rounded-3xl border border-fit/30 bg-fit-soft p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-fit">Si hacés “{session.name}” hoy</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="num text-xl font-extrabold">{fmt((day?.targets.kcal ?? base.kcal) + bonus)}</div>
            <div className="text-[11px] font-semibold text-ink-3">kcal objetivo (+{fmt(bonus)})</div>
          </div>
          <div>
            <div className="num text-xl font-extrabold text-pro">{prot} g</div>
            <div className="text-[11px] font-semibold text-ink-3">proteína al terminar</div>
          </div>
          <div>
            <div className="num text-xl font-extrabold text-water">+{fmt(Math.round(((est.minutes / 60) * 500) / 50) * 50)}</div>
            <div className="flex items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-3">
              <Droplets size={11} /> ml de agua
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>Sesiones</SectionTitle>
      {r.sessions.length > 1 && (
        <Segmented className="mb-2" value={String(si)} onChange={(v) => setSi(Number(v))} options={r.sessions.map((s, i) => ({ value: String(i), label: s.name.length > 12 ? s.name.split(' ').slice(0, 2).join(' ') : s.name }))} />
      )}
      <Card className="py-2">
        <div className="flex items-center justify-between border-b border-line pb-2.5 pt-1">
          <div>
            <div className="text-[16px] font-extrabold">{session.name}</div>
            <div className="text-xs text-ink-3">{session.focus}</div>
          </div>
          <div className="num text-right text-xs font-semibold text-ink-2">
            ⏱ {fmt(est.minutes)} min · 🔥 {fmt(est.kcal)} kcal
            <div className="text-ink-3">
              {est.exercises} ejercicios · {est.sets} series
            </div>
          </div>
        </div>
        {session.warmupMin > 0 && <div className="border-b border-line py-2 text-[13px] text-ink-2">🔥 Calentamiento: {session.warmupMin} min de movilidad y cardio suave</div>}
        <div className="divide-y divide-line">
          {session.blocks.map((b, i) => (
            <BlockView key={i} b={b} />
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <Button variant="fit" size="lg" block onClick={() => navigate(`entrenar/${r.id}/${session.id}`)}>
          <Play size={18} fill="currentColor" /> Empezar {session.name}
        </Button>
        {isPlan ? (
          <div className="flex items-center justify-center gap-1.5 py-2 text-sm font-bold text-ok">
            <Check size={16} /> Es tu plan activo
          </div>
        ) : (
          <Button variant="outline" block onClick={() => setPlanOpen(true)}>
            <CalendarCheck size={18} /> Usar como mi plan semanal
          </Button>
        )}
      </div>

      {r.progression.length > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <TrendingUp size={16} className="text-food" /> Cómo progresar
            </span>
          </SectionTitle>
          <Card className="space-y-2">
            {r.progression.map((p, i) => (
              <div key={i} className="flex gap-2 text-[14px] text-ink-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-food-soft text-[11px] font-bold text-food">{i + 1}</span>
                {p}
              </div>
            ))}
          </Card>
        </>
      )}

      <button onClick={() => setCalcOpen(!calcOpen)} className="mt-4 flex w-full items-center gap-2 rounded-2xl px-1 py-2 text-left text-[13px] font-bold text-ink-3">
        <Calculator size={16} /> ¿Cómo calculamos estos números?
      </button>
      {calcOpen && (
        <Card className="space-y-2 text-[13px] text-ink-2">
          <p>
            <b>Calorías:</b> kcal = MET × peso (kg) × horas. {r.metNote} Para vos ({fmt1(kg)} kg) esta sesión da ≈ {fmt(est.kcal)} kcal (MET medio {fmt1(est.avgMet)}).
          </p>
          <p>
            <b>Lo que se suma a tu comida:</b> las kcal "netas" (MET − 1, sin contar lo que gastarías en reposo) × {Math.round(profile.exerciseBack * 100)}% = +{fmt(bonus)} kcal.
          </p>
          <p>
            <b>Tiempo:</b> series × (repeticiones × ~3 s + preparación) + descansos + cambios entre ejercicios + calentamiento.
          </p>
          <p>
            <b>Proteína:</b> {String(est.proteinPerKg).replace('.', ',')} g/kg después de esta sesión según su intensidad (ISSN: 0,25–0,40 g/kg o 20–40 g por comida), dentro de tu total diario de {base.protein} g.
          </p>
        </Card>
      )}

      {r.custom && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => navigate(`crear-rutina/${r.id}`)}>
            <Pencil size={16} /> Editar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              removeRoutine(r.id);
              navigate('ejercicio/rutinas', { replace: true });
            }}
          >
            <Trash2 size={16} /> Eliminar
          </Button>
        </div>
      )}

      {planOpen && <PlanSheet routineId={r.id} suggested={r.suggestedDays} count={r.daysPerWeek} onClose={() => setPlanOpen(false)} />}
    </div>
  );
}
