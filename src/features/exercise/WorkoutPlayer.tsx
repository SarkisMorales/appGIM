import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Info, List, Pause, Play, SkipForward, Volume2, VolumeX, X, Trophy, Beef, Flame, Clock, Dumbbell, Utensils } from 'lucide-react';
import type { ExerciseLog, SetLog } from '../../types.ts';
import { useStore, useUI } from '../../store/useStore.ts';
import { findRoutine } from '../../store/derived.ts';
import { getExercise } from '../../data/exercises.ts';
import { avgReps, buildSteps, estimateSession, kcalFromMet, netKcalFromMet, postWorkoutProtein, repsLabel, type Step } from '../../lib/training.ts';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';
import { Button, Card, Empty, Sheet, Stepper, cx } from '../../components/ui.tsx';
import { ExerciseInfo } from './ExerciseDetail.tsx';
import { beep, chime, speak, unlockAudio, vibrate } from '../../lib/feedback.ts';
import { navigate } from '../../lib/router.ts';
import { fmt, fmt1, fmtClock } from '../../lib/format.ts';
import { todayISO } from '../../lib/dates.ts';

type Phase = 'intro' | 'ready' | 'work' | 'rest' | 'done';

function stepTarget(s: Step): string {
  if (s.kind === 'warmup') return `${Math.round(s.sec / 60)} min`;
  if (s.kind === 'set') return s.sec ? `${s.sec} s` : `${repsLabel(s.reps)} reps`;
  return s.reps ? `${s.reps} reps` : `${s.sec} s`;
}

function stepSeconds(s: Step): number | null {
  if (s.kind === 'warmup') return s.sec;
  if (s.kind === 'set') return s.sec ?? null;
  return s.reps ? null : (s.sec ?? null);
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      } catch {
        /* sin soporte */
      }
    };
    void req();
    const onVis = () => document.visibilityState === 'visible' && void req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

export default function WorkoutPlayer({ routineId, sessionId }: { routineId?: string; sessionId?: string }) {
  const custom = useStore((s) => s.customRoutines);
  const profile = useStore((s) => s.profile)!;
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const workouts = useStore((s) => s.workouts);
  const addWorkout = useStore((s) => s.addWorkout);
  const advancePlan = useStore((s) => s.advancePlan);
  const openSheet = useUI((s) => s.openSheet);
  const toast = useUI((s) => s.toast);
  const routine = findRoutine(routineId, custom);
  const session = routine?.sessions.find((s) => s.id === sessionId) ?? routine?.sessions[0];
  const steps = useMemo(() => (session ? buildSteps(session) : []), [session]);
  const est = useMemo(() => (session ? estimateSession(session, profile.weightKg, getExercise) : null), [session, profile.weightKg]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState(0);
  const [logs, setLogs] = useState<Record<number, SetLog & { exId: string }>>({});
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [durationOverride, setDurationOverride] = useState<number | null>(null);
  const [feeling, setFeeling] = useState(4);
  const lastBeep = useRef<number>(-1);

  useWakeLock(phase !== 'intro' && phase !== 'done');

  const step = steps[idx];
  const exId = step && step.kind !== 'warmup' ? step.ex : undefined;
  const ex = exId ? getExercise(exId) : undefined;
  const nextStep = steps[idx + 1];
  const nextEx = nextStep && nextStep.kind !== 'warmup' ? getExercise(nextStep.ex) : undefined;

  // Historial previo de cada ejercicio (para "la última vez")
  const lastSets = useCallback(
    (id: string) => {
      for (let i = workouts.length - 1; i >= 0; i--) {
        const e = workouts[i].exercises?.find((x) => x.exId === id);
        if (e && e.sets.some((s) => s.done)) return e.sets.filter((s) => s.done);
      }
      return null;
    },
    [workouts],
  );

  const say = useCallback((t: string) => settings.voice && speak(t), [settings.voice]);
  const ding = useCallback((f = 880, ms = 140) => settings.sound && beep(f, ms), [settings.sound]);
  const buzz = useCallback((p: number | number[]) => settings.vibration && vibrate(p), [settings.vibration]);

  const left = pausedLeft != null ? pausedLeft : endsAt != null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  // Prepara un paso: valores sugeridos y voz
  const enterStep = useCallback(
    (i: number) => {
      const s = steps[i];
      if (!s) return;
      setIdx(i);
      setPhase('work');
      setPausedLeft(null);
      lastBeep.current = -1;
      const secs = stepSeconds(s);
      setEndsAt(secs ? Date.now() + secs * 1000 : null);
      if (s.kind !== 'warmup') {
        const prev = lastSets(s.ex);
        const k = s.kind === 'set' ? s.set - 1 : 0;
        const targetReps = s.kind === 'set' ? Math.round(avgReps(s.reps)) : (s.reps ?? 10);
        setReps(prev?.[k]?.reps ?? targetReps);
        setWeight(prev?.[k]?.weight ?? prev?.[0]?.weight ?? 0);
        const e = getExercise(s.ex);
        say(`${e?.name ?? ''}. ${stepTarget(s).replace('reps', 'repeticiones').replace(' s', ' segundos')}${e?.perSide ? ' por lado' : ''}`);
      } else {
        say('Calentamiento. Movilidad articular y cardio suave.');
      }
    },
    [steps, lastSets, say],
  );

  const finishStep = useCallback(
    (done: boolean) => {
      const s = steps[idx];
      if (!s) return;
      if (s.kind !== 'warmup') {
        const secs = stepSeconds(s);
        setLogs((l) => ({
          ...l,
          [idx]: { exId: s.ex, done, reps: secs ? undefined : reps, weight: secs ? undefined : weight || undefined, sec: secs ?? undefined },
        }));
      }
      if (idx >= steps.length - 1) {
        setPhase('done');
        setEndsAt(null);
        if (settings.sound) chime();
        buzz([120, 80, 120]);
        say('¡Entrenamiento completado! Excelente trabajo.');
        return;
      }
      const rest = s.kind === 'warmup' ? 0 : s.rest;
      if (rest > 0) {
        setPhase('rest');
        setPausedLeft(null);
        setEndsAt(Date.now() + rest * 1000);
        lastBeep.current = -1;
        const n = steps[idx + 1];
        const ne = n && n.kind !== 'warmup' ? getExercise(n.ex) : undefined;
        say(`Descanso. ${rest} segundos.${ne ? ` Después: ${ne.name}.` : ''}`);
      } else enterStep(idx + 1);
    },
    [steps, idx, reps, weight, enterStep, say, buzz, settings.sound],
  );

  // Reloj
  useEffect(() => {
    if (phase === 'intro' || phase === 'done') return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [phase]);

  // Fin de cuentas regresivas + pitidos 3-2-1
  useEffect(() => {
    if (left == null || pausedLeft != null) return;
    if (left <= 3 && left > 0 && lastBeep.current !== left) {
      lastBeep.current = left;
      ding(660, 120);
    }
    if (left === 0) {
      if (phase === 'ready') {
        ding(1046, 220);
        enterStep(0);
      } else if (phase === 'rest') {
        ding(1046, 260);
        buzz(200);
        enterStep(idx + 1);
      } else if (phase === 'work' && endsAt != null) {
        ding(1046, 260);
        buzz(200);
        finishStep(true);
      }
    }
  }, [left, phase, pausedLeft, idx, endsAt, ding, buzz, enterStep, finishStep]);

  const start = () => {
    unlockAudio();
    setStartedAt(Date.now());
    setPhase('ready');
    setEndsAt(Date.now() + 3000);
    lastBeep.current = -1;
    say(`Arrancamos ${session?.name ?? ''}. Preparate.`);
  };

  const togglePause = () => {
    if (pausedLeft != null) {
      setEndsAt(Date.now() + pausedLeft * 1000);
      setPausedLeft(null);
    } else if (left != null) {
      setPausedLeft(left);
    }
  };

  const addRest = (d: number) => {
    if (pausedLeft != null) setPausedLeft(Math.max(1, pausedLeft + d));
    else if (endsAt) setEndsAt(Math.max(Date.now() + 1000, endsAt + d * 1000));
  };

  // ---------------- Resumen ----------------
  const elapsedMin = startedAt ? (Date.now() - startedAt) / 60000 : 0;
  const summary = useMemo(() => {
    if (phase !== 'done' || !est) return null;
    const dur = durationOverride ?? Math.max(1, Math.round(Math.min(elapsedMin, est.minutes * 1.6)));
    const exLogs: ExerciseLog[] = [];
    Object.entries(logs)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .forEach(([, l]) => {
        let e = exLogs.find((x) => x.exId === l.exId);
        if (!e) {
          e = { exId: l.exId, name: getExercise(l.exId)?.name ?? l.exId, sets: [] };
          exLogs.push(e);
        }
        e.sets.push({ reps: l.reps, weight: l.weight, sec: l.sec, done: l.done });
      });
    const volume = exLogs.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done && s.reps && s.weight ? s.reps * s.weight : 0), 0), 0);
    const doneSets = exLogs.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    const kcal = kcalFromMet(est.avgMet, profile.weightKg, dur);
    const net = netKcalFromMet(est.avgMet, profile.weightKg, dur);
    return { dur, exLogs, volume, doneSets, kcal, net, bonus: Math.round(net * profile.exerciseBack) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, logs, durationOverride, est]);

  const save = (thenFood: boolean) => {
    if (!summary || !routine || !session) return;
    addWorkout({
      date: todayISO(),
      kind: 'rutina',
      title: `${session.name}`,
      subtitle: routine.name,
      routineId: routine.id,
      sessionId: session.id,
      startedAt,
      durationMin: summary.dur,
      met: Math.round(est!.avgMet * 10) / 10,
      kcal: Math.round(summary.kcal),
      netKcal: Math.round(summary.net),
      exercises: summary.exLogs,
      volumeKg: Math.round(summary.volume),
      feeling,
    });
    advancePlan(routine.id);
    navigate('', { replace: true });
    toast(`¡Guardado! +${fmt(summary.bonus)} kcal sumadas a tu objetivo de hoy 💪`);
    if (thenFood) setTimeout(() => openSheet({ kind: 'addFood', date: todayISO() }), 50);
  };

  if (!routine || !session || !est) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Empty title="No encontramos la sesión" action={<Button onClick={() => navigate('ejercicio')}>Volver</Button>} />
      </div>
    );
  }

  // ---------------- Pantallas ----------------
  if (phase === 'intro') {
    return (
      <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-8">
        <div className="flex items-center justify-between py-3">
          <button onClick={() => window.history.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2" aria-label="Volver">
            <X size={20} />
          </button>
          <span className="text-sm font-bold text-ink-3">{routine.name}</span>
          <span className="w-10" />
        </div>
        <div className="anim-rise">
          <h1 className="text-3xl font-extrabold tracking-tight">{session.name}</h1>
          <p className="text-ink-2">{session.focus}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Card className="p-3 text-center">
              <Clock size={18} className="mx-auto text-ink-3" />
              <div className="num mt-1 text-xl font-extrabold">{fmt(est.minutes)}′</div>
              <div className="text-[11px] text-ink-3">estimado</div>
            </Card>
            <Card className="p-3 text-center">
              <Flame size={18} className="mx-auto text-fit" />
              <div className="num mt-1 text-xl font-extrabold">{fmt(est.kcal)}</div>
              <div className="text-[11px] text-ink-3">kcal aprox.</div>
            </Card>
            <Card className="p-3 text-center">
              <Dumbbell size={18} className="mx-auto text-bal" />
              <div className="num mt-1 text-xl font-extrabold">{est.sets}</div>
              <div className="text-[11px] text-ink-3">series / tramos</div>
            </Card>
          </div>
          <Card className="mt-3 divide-y divide-line py-1">
            {[...new Set(steps.filter((s) => s.kind !== 'warmup').map((s) => (s as Exclude<Step, { kind: 'warmup' }>).ex))].map((id) => {
              const e = getExercise(id);
              const n = steps.filter((s) => s.kind !== 'warmup' && s.ex === id);
              return (
                <div key={id} className="flex items-center gap-3 py-2">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-surface-2">
                    <ExerciseFigure anim={e?.anim} playing={false} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold">{e?.name}</div>
                    <div className="text-xs text-ink-3">
                      {n.length} × {stepTarget(n[0])}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2">
            <span className="text-sm font-semibold text-ink-2">Voz guía y sonidos</span>
            <button onClick={() => updateSettings({ voice: !settings.voice, sound: !settings.voice })} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface" aria-label="Activar o desactivar voz">
              {settings.voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
          <Button variant="fit" size="lg" block className="mt-4" onClick={start}>
            <Play size={20} fill="currentColor" /> Empezar
          </Button>
          <p className="mt-3 text-center text-xs text-ink-3">La pantalla se mantiene encendida durante el entrenamiento.</p>
        </div>
      </div>
    );
  }

  if (phase === 'done' && summary) {
    const prot = postWorkoutProtein(profile.weightKg);
    return (
      <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-8">
        <div className="anim-pop pt-8 text-center">
          <div className="grad-fit mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-pop">
            <Trophy size={38} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">¡Entrenamiento completado!</h1>
          <p className="text-ink-2">
            {session.name} · {routine.name}
          </p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="num text-2xl font-extrabold">{summary.dur}′</div>
            <div className="text-[11px] text-ink-3">duración</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="num text-2xl font-extrabold text-fit">{fmt(summary.kcal)}</div>
            <div className="text-[11px] text-ink-3">kcal quemadas</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="num text-2xl font-extrabold">{summary.volume ? `${fmt(summary.volume)}` : summary.doneSets}</div>
            <div className="text-[11px] text-ink-3">{summary.volume ? 'kg levantados' : 'series hechas'}</div>
          </Card>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-sm">
          <span className="text-ink-3">¿La duración fue otra?</span>
          <Stepper value={summary.dur} onChange={(v) => setDurationOverride(v)} min={1} max={300} step={1} format={(v) => `${v} min`} className="bg-transparent p-0" />
        </div>

        <Card className="mt-3 border-fit/30">
          <div className="text-xs font-bold uppercase tracking-wide text-fit">Conectado con tu comida</div>
          <div className="mt-2 space-y-2 text-[14px]">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-fit" /> Tu objetivo de hoy sube <b>+{fmt(summary.bonus)} kcal</b>
            </div>
            <div className="flex items-center gap-2">
              <Beef size={18} className="text-pro" /> Recargá con <b>~{prot} g de proteína</b> y <b>~{fmt(Math.max(20, Math.round((summary.bonus * 0.5) / 4)))} g de carbohidratos</b>
            </div>
            <p className="text-xs text-ink-3">Ej.: yogur griego + banana, o sándwich de pollo, o licuado con leche y avena.</p>
          </div>
        </Card>

        <div className="mt-4 text-center text-sm font-semibold text-ink-2">¿Cómo te sentiste?</div>
        <div className="mt-2 flex justify-center gap-2">
          {['😫', '😕', '🙂', '😀', '🔥'].map((e, i) => (
            <button key={e} onClick={() => setFeeling(i + 1)} className={cx('flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition', feeling === i + 1 ? 'scale-110 bg-fit-soft ring-2 ring-fit' : 'bg-surface-2')}>
              {e}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <Button variant="fit" size="lg" block onClick={() => save(false)}>
            <Check size={20} /> Guardar entrenamiento
          </Button>
          <Button variant="outline" block onClick={() => save(true)}>
            <Utensils size={18} /> Guardar y registrar comida post-entreno
          </Button>
        </div>
      </div>
    );
  }

  // ---------------- Entrenando ----------------
  const totalSteps = steps.length;
  const progress = (idx + (phase === 'rest' ? 1 : 0)) / totalSteps;
  const timed = step ? stepSeconds(step) : null;
  const header =
    step?.kind === 'set' ? `Serie ${step.set} de ${step.sets}` : step?.kind === 'work' ? `${step.blockName} · vuelta ${step.round}/${step.rounds} · ${step.item}/${step.items}` : 'Calentamiento';
  const prev = exId ? lastSets(exId) : null;
  const targetTop = step?.kind === 'set' ? (Array.isArray(step.reps) ? step.reps[1] : step.reps) : undefined;
  const suggestUp = prev && targetTop && prev.length && prev.every((s) => (s.reps ?? 0) >= targetTop) && prev[0].weight;

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-6">
      <div className="flex items-center gap-3 py-3">
        <button onClick={() => setExitOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2" aria-label="Salir">
          <X size={20} />
        </button>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="grad-fit h-full rounded-full transition-all duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-ink-3">
            <span>
              {Math.min(idx + 1, totalSteps)}/{totalSteps}
            </span>
            <span className="num">{fmtClock((now - startedAt) / 1000)}</span>
          </div>
        </div>
        <button onClick={() => setListOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2" aria-label="Ver lista">
          <List size={20} />
        </button>
      </div>

      {phase === 'ready' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-fit">Preparate</div>
          <div className="num text-[120px] font-extrabold leading-none">{left}</div>
          <div className="mt-2 text-ink-2">Primero: {step?.kind === 'warmup' ? 'calentamiento' : ex?.name}</div>
        </div>
      )}

      {phase === 'rest' && (
        <div className="anim-fade flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-bal">Descanso</div>
          <div className="num text-[96px] font-extrabold leading-none">{fmtClock(left ?? 0)}</div>
          <div className="mt-4 flex gap-2">
            <Button variant="soft" onClick={() => addRest(-15)}>
              −15 s
            </Button>
            <Button variant="soft" onClick={() => togglePause()}>
              {pausedLeft != null ? <Play size={18} /> : <Pause size={18} />}
            </Button>
            <Button variant="soft" onClick={() => addRest(15)}>
              +15 s
            </Button>
          </div>
          {nextStep && (
            <Card className="mt-8 flex w-full items-center gap-3 text-left">
              <div className="h-20 w-20 shrink-0 rounded-2xl bg-surface-2">
                <ExerciseFigure anim={nextEx?.anim} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Siguiente</div>
                <div className="truncate text-lg font-extrabold">{nextEx?.name ?? 'Calentamiento'}</div>
                <div className="text-sm text-ink-2">{stepTarget(nextStep)}</div>
              </div>
            </Card>
          )}
          <Button variant="bal" size="lg" block className="mt-4" onClick={() => enterStep(idx + 1)}>
            Saltar descanso <SkipForward size={18} />
          </Button>
        </div>
      )}

      {phase === 'work' && step && (
        <div className="anim-fade flex flex-1 flex-col">
          <div className="text-center text-xs font-bold uppercase tracking-widest text-fit">{header}</div>
          <div className="relative mx-auto mt-1 aspect-square w-full max-w-[340px] rounded-[32px] bg-surface-2">
            {step.kind === 'warmup' ? <ExerciseFigure anim="walk" className="h-full w-full" /> : <ExerciseFigure anim={ex?.anim} className="h-full w-full" title={ex?.name} />}
            {ex && (
              <button onClick={() => setInfoOpen(true)} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Cómo se hace">
                <Info size={18} />
              </button>
            )}
          </div>
          <div className="mt-3 text-center">
            <div className="text-[26px] font-extrabold leading-tight tracking-tight">{step.kind === 'warmup' ? 'Calentamiento' : ex?.name}</div>
            <div className="text-lg font-bold text-ink-2">
              {stepTarget(step)}
              {ex?.perSide ? ' por lado' : ''}
              {step.kind === 'set' && step.load ? <span className="text-fit"> · {step.load}</span> : null}
            </div>
            {step.kind === 'set' && step.note && <div className="text-sm text-fit">{step.note}</div>}
            {step.kind === 'warmup' && <div className="mt-1 text-sm text-ink-3">Círculos de brazos y cadera, sentadillas suaves y trote o caminata en el lugar.</div>}
          </div>

          {timed ? (
            <div className="mt-4 flex flex-col items-center">
              <div className="num text-6xl font-extrabold">{fmtClock(left ?? timed)}</div>
              <div className="mt-3 flex gap-2">
                <Button variant="soft" onClick={togglePause}>
                  {pausedLeft != null ? <Play size={18} /> : <Pause size={18} />} {pausedLeft != null ? 'Seguir' : 'Pausa'}
                </Button>
                <Button variant="fit" onClick={() => finishStep(true)}>
                  <Check size={18} /> Listo
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {prev && (
                <div className="mb-2 text-center text-xs text-ink-3">
                  La última vez: {prev.map((s) => `${s.reps ?? '-'}${s.weight ? `×${fmt1(s.weight)}` : ''}`).join(' · ')}
                  {suggestUp ? <span className="font-bold text-food"> → probá +2,5 kg</span> : null}
                </div>
              )}
              <div className={cx('grid gap-2', ex?.weighted ? 'grid-cols-2' : 'grid-cols-1')}>
                <div>
                  <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink-3">Repeticiones</div>
                  <Stepper value={reps} onChange={setReps} min={0} max={100} />
                </div>
                {ex?.weighted && (
                  <div>
                    <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink-3">Peso (kg)</div>
                    <Stepper value={weight} onChange={setWeight} step={2.5} min={0} max={500} format={(v) => fmt1(v)} />
                  </div>
                )}
              </div>
              <Button variant="fit" size="lg" block className="mt-3" onClick={() => finishStep(true)}>
                <Check size={22} /> Serie hecha
              </Button>
            </div>
          )}
          <div className="flex-1" />
          <button onClick={() => finishStep(false)} className="mx-auto mt-4 flex items-center gap-1 text-sm font-bold text-ink-3">
            Saltar <ChevronRight size={16} />
          </button>
          {nextStep && (
            <div className="mt-2 text-center text-xs text-ink-3">
              Después: {nextEx?.name} · {stepTarget(nextStep)}
            </div>
          )}
        </div>
      )}

      {infoOpen && ex && (
        <Sheet open onClose={() => setInfoOpen(false)} title={ex.name}>
          <ExerciseInfo id={ex.id} compact />
        </Sheet>
      )}

      {listOpen && (
        <Sheet open onClose={() => setListOpen(false)} title="Tu sesión">
          <div className="divide-y divide-line">
            {steps.map((s, i) => {
              const e = s.kind !== 'warmup' ? getExercise(s.ex) : undefined;
              const lg = logs[i];
              return (
                <button
                  key={i}
                  onClick={() => {
                    setListOpen(false);
                    enterStep(i);
                  }}
                  className={cx('flex w-full items-center gap-3 py-2 text-left', i === idx && 'font-extrabold')}
                >
                  <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-[11px]', lg?.done ? 'bg-ok text-white' : i === idx ? 'bg-fit text-white' : 'bg-surface-2 text-ink-3')}>{lg?.done ? <Check size={14} /> : i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{s.kind === 'warmup' ? 'Calentamiento' : e?.name}</span>
                  <span className="text-xs text-ink-3">{stepTarget(s)}</span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {exitOpen && (
        <Sheet open onClose={() => setExitOpen(false)} title="¿Terminar el entrenamiento?">
          <div className="space-y-2">
            <Button
              variant="fit"
              block
              onClick={() => {
                setExitOpen(false);
                setPhase('done');
                setEndsAt(null);
              }}
            >
              Terminar y guardar lo hecho
            </Button>
            <Button variant="soft" block onClick={() => setExitOpen(false)}>
              Seguir entrenando
            </Button>
            <Button variant="danger" block onClick={() => navigate('ejercicio', { replace: true })}>
              Salir sin guardar
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
