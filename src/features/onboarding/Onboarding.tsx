import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Dumbbell, Lock, Sparkles, Utensils } from 'lucide-react';
import type { ActivityLevel, Goal, Level, Place, Profile, Sex } from '../../types.ts';
import { useStore } from '../../store/useStore.ts';
import { ACTIVITY, GOALS, baseTargets, bmi } from '../../lib/nutrition.ts';
import { LEVELS, ROUTINE_MAP } from '../../data/routines.ts';
import { recommendRoutine } from '../../lib/recommend.ts';
import { Button, Card, Field, NumberInput, Segmented, Stepper, cx } from '../../components/ui.tsx';
import { Logo } from '../../components/Logo.tsx';
import { fmt } from '../../lib/format.ts';
import { todayISO, WEEKDAYS_SHORT } from '../../lib/dates.ts';

const STEPS = 6;

function Option({ active, onClick, title, desc, emoji }: { active: boolean; onClick: () => void; title: string; desc?: string; emoji?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99]',
        active ? 'border-bal bg-bal-soft' : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      {emoji && <span className="text-2xl">{emoji}</span>}
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        {desc && <span className="mt-0.5 block text-[13px] text-ink-2">{desc}</span>}
      </span>
      <span className={cx('flex h-6 w-6 items-center justify-center rounded-full border-2', active ? 'border-bal bg-bal text-white' : 'border-line')}>
        {active && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

export default function Onboarding() {
  const setProfile = useStore((s) => s.setProfile);
  const setPlan = useStore((s) => s.setPlan);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('m');
  const [age, setAge] = useState<number | ''>(30);
  const [height, setHeight] = useState<number | ''>(170);
  const [weight, setWeight] = useState<number | ''>(72);
  const [activity, setActivity] = useState<ActivityLevel>('ligero');
  const [goal, setGoal] = useState<Goal>('bajar');
  const [pace, setPace] = useState(0.5);
  const [target, setTarget] = useState<number | ''>('');
  const [level, setLevel] = useState<Level>('principiante');
  const [place, setPlace] = useState<Place>('casa');
  const [days, setDays] = useState(3);
  const [activate, setActivate] = useState(true);

  const profile: Profile = useMemo(
    () => ({
      name: name.trim() || 'Atleta',
      sex,
      age: Number(age) || 30,
      heightCm: Number(height) || 170,
      weightKg: Number(weight) || 70,
      targetWeightKg: target ? Number(target) : undefined,
      activity,
      goal,
      paceKg: goal === 'mantener' ? 0 : pace,
      level,
      place,
      trainingDays: days,
      exerciseBack: 1,
      createdAt: todayISO(),
    }),
    [name, sex, age, height, weight, target, activity, goal, pace, level, place, days],
  );
  const t = baseTargets(profile);
  const recId = recommendRoutine(level, place, days);
  const rec = ROUTINE_MAP.get(recId)!;

  const valid1 = Number(age) >= 14 && Number(age) <= 100 && Number(height) >= 120 && Number(height) <= 230 && Number(weight) >= 30 && Number(weight) <= 300;

  const finish = () => {
    setProfile(profile);
    if (activate) {
      const sug = rec.suggestedDays.slice(0, Math.max(1, Math.min(days, rec.suggestedDays.length)));
      setPlan({ routineId: rec.id, days: sug, startedAt: todayISO(), nextIndex: 0 });
    }
  };

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="grad-hero min-h-dvh">
      <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-6">
        {step > 0 && (
          <div className="flex items-center gap-3 py-3">
            <button onClick={prev} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Atrás">
              <ChevronLeft size={24} />
            </button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="grad-bal h-full rounded-full transition-all duration-500" style={{ width: `${(step / (STEPS - 1)) * 100}%` }} />
            </div>
            <span className="num w-10 text-right text-xs font-semibold text-ink-3">
              {step}/{STEPS - 1}
            </span>
          </div>
        )}

        <div key={step} className="anim-rise flex flex-1 flex-col">
          {step === 0 && (
            <div className="flex flex-1 flex-col justify-center py-8">
              <Logo size={64} />
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight">
                Tu comida y tu entrenamiento, <span className="text-grad-bal">conectados.</span>
              </h1>
              <p className="mt-4 text-[17px] text-ink-2">Si entrenás, la app te dice cuánto más podés comer. Si comés, ves cuánto movimiento equivale. Todo en un solo lugar.</p>
              <div className="mt-8 space-y-3">
                {[
                  { icon: Utensils, color: 'var(--food)', t: 'Registrá comidas en segundos', d: '+200 alimentos (incluye platos típicos), búsqueda online y lector de códigos de barras.' },
                  { icon: Dumbbell, color: 'var(--fit)', t: 'Rutinas guiadas con animaciones', d: 'Principiante, intermedio y avanzado, con calorías, proteína y tiempo calculados.' },
                  { icon: Lock, color: 'var(--bal)', t: 'Gratis, sin cuentas y offline', d: 'Tus datos quedan en tu teléfono. Podés exportarlos cuando quieras.' },
                ].map((f) => (
                  <div key={f.t} className="flex gap-3 rounded-2xl border border-line bg-surface/80 p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: f.color }}>
                      <f.icon size={20} />
                    </span>
                    <span>
                      <span className="block font-bold">{f.t}</span>
                      <span className="block text-[13px] text-ink-2">{f.d}</span>
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="bal" size="lg" block className="mt-8" onClick={next}>
                Empezar <ArrowRight size={20} />
              </Button>
              <p className="mt-3 text-center text-xs text-ink-3">Tarda menos de un minuto.</p>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-1 flex-col">
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Contanos de vos</h2>
              <p className="mt-1 text-ink-2">Con esto calculamos tu gasto de energía.</p>
              <div className="mt-6 space-y-4">
                <Field label="¿Cómo te llamamos?">
                  <input className="h-12 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-bal" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
                </Field>
                <Field label="Sexo biológico" hint="Se usa en la fórmula de metabolismo basal (Mifflin-St Jeor).">
                  <Segmented value={sex} onChange={setSex} options={[{ value: 'f', label: 'Mujer' }, { value: 'm', label: 'Hombre' }]} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Edad">
                    <NumberInput value={age} onChange={setAge} suffix="años" />
                  </Field>
                  <Field label="Altura">
                    <NumberInput value={height} onChange={setHeight} suffix="cm" />
                  </Field>
                  <Field label="Peso">
                    <NumberInput value={weight} onChange={setWeight} suffix="kg" step={0.1} />
                  </Field>
                </div>
                {valid1 && (
                  <p className="text-[13px] text-ink-3">
                    IMC: <b className="text-ink">{bmi(profile).toFixed(1)}</b> · Metabolismo basal: <b className="text-ink">{fmt(t.bmr)} kcal</b>
                  </p>
                )}
              </div>
              <div className="flex-1" />
              <Button variant="bal" size="lg" block disabled={!valid1} onClick={next}>
                Continuar
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-1 flex-col">
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Tu día a día</h2>
              <p className="mt-1 text-ink-2">Sin contar tus entrenamientos: esos los sumamos aparte cuando los registrás.</p>
              <div className="mt-6 space-y-2.5">
                {(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => (
                  <Option key={k} active={activity === k} onClick={() => setActivity(k)} title={ACTIVITY[k].label} desc={ACTIVITY[k].desc} />
                ))}
              </div>
              <div className="flex-1" />
              <Button variant="bal" size="lg" block className="mt-6" onClick={next}>
                Continuar
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-1 flex-col">
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">¿Cuál es tu objetivo?</h2>
              <div className="mt-6 space-y-2.5">
                {(Object.keys(GOALS) as Goal[]).map((k) => (
                  <Option key={k} active={goal === k} onClick={() => setGoal(k)} title={GOALS[k].label} desc={GOALS[k].desc} emoji={GOALS[k].emoji} />
                ))}
              </div>
              {goal !== 'mantener' && (
                <div className="mt-5">
                  <div className="mb-2 text-[13px] font-semibold text-ink-2">Ritmo (kg por semana)</div>
                  <Segmented
                    value={String(pace)}
                    onChange={(v) => setPace(Number(v))}
                    options={
                      goal === 'bajar'
                        ? [
                            { value: '0.25', label: 'Suave 0,25' },
                            { value: '0.5', label: 'Ideal 0,5' },
                            { value: '0.75', label: 'Rápido 0,75' },
                          ]
                        : [
                            { value: '0.25', label: 'Limpio 0,25' },
                            { value: '0.5', label: 'Rápido 0,5' },
                          ]
                    }
                  />
                  <Field label="Peso objetivo (opcional)" className="mt-4">
                    <NumberInput value={target} onChange={setTarget} suffix="kg" step={0.5} placeholder={goal === 'bajar' ? String(Math.round(Number(weight) * 0.92)) : String(Math.round(Number(weight) * 1.05))} />
                  </Field>
                </div>
              )}
              <div className="flex-1" />
              <Button variant="bal" size="lg" block className="mt-6" onClick={() => { if (goal === 'subir' && pace > 0.5) setPace(0.5); next(); }}>
                Continuar
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-1 flex-col">
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Tu entrenamiento</h2>
              <p className="mt-1 text-ink-2">Elegimos rutinas acordes a tu nivel.</p>
              <div className="mt-5 space-y-2.5">
                {LEVELS.map((l) => (
                  <Option key={l.id} active={level === l.id} onClick={() => setLevel(l.id)} title={l.label} desc={l.desc} emoji={l.emoji} />
                ))}
              </div>
              <div className="mt-5 text-[13px] font-semibold text-ink-2">¿Dónde entrenás?</div>
              <Segmented
                className="mt-2"
                value={place}
                onChange={setPlace}
                options={[
                  { value: 'casa', label: '🏠 En casa / plaza' },
                  { value: 'gimnasio', label: '🏋️ Gimnasio' },
                ]}
              />
              <div className="mt-5 text-[13px] font-semibold text-ink-2">Días por semana</div>
              <Stepper className="mt-2" value={days} onChange={setDays} min={0} max={7} format={(v) => `${v} ${v === 1 ? 'día' : 'días'}`} />
              <div className="flex-1" />
              <Button variant="bal" size="lg" block className="mt-6" onClick={next}>
                Ver mi plan
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-1 flex-col">
              <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-bal-soft px-3 py-1 text-xs font-bold text-bal">
                <Sparkles size={14} /> Tu plan personalizado
              </div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">{profile.name}, este es tu punto de partida</h2>
              <Card className="mt-5">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Objetivo diario base</div>
                    <div className="num text-4xl font-extrabold">
                      {fmt(t.kcal)} <span className="text-base font-bold text-ink-3">kcal</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-ink-3">
                    Gasto estimado: <b className="text-ink">{fmt(t.tdee)}</b>
                    <br />
                    {t.adjust < 0 ? 'Déficit' : t.adjust > 0 ? 'Superávit' : 'Ajuste'}: <b className="text-ink">{t.adjust > 0 ? '+' : ''}{fmt(t.adjust)}</b>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { l: 'Proteína', v: t.protein, c: 'var(--pro)', s: `${t.proteinPerKg} g/kg` },
                    { l: 'Carbos', v: t.carbs, c: 'var(--carb)' },
                    { l: 'Grasas', v: t.fat, c: 'var(--fat)' },
                  ].map((m) => (
                    <div key={m.l} className="rounded-2xl bg-surface-2 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: m.c }} />
                        {m.l}
                      </div>
                      <div className="num text-xl font-extrabold">{m.v} g</div>
                      {m.s && <div className="text-[11px] text-ink-3">{m.s}</div>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl bg-fit-soft p-3 text-[13px] text-ink-2">
                  <b className="text-fit">+ Ejercicio:</b> cada vez que entrenes, sumamos a tu objetivo las calorías que quemaste (mayormente en carbohidratos) y te sugerimos la proteína para recuperarte.
                </div>
                {t.clamped && <p className="mt-2 text-xs text-warn">Ajustamos el objetivo para que no quede por debajo de tu metabolismo basal.</p>}
              </Card>

              {days > 0 && (
                <Card className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Rutina recomendada</div>
                  <div className="mt-1 text-lg font-extrabold">{rec.name}</div>
                  <div className="text-[13px] text-ink-2">{rec.short}</div>
                  <div className="mt-2 flex gap-1">
                    {WEEKDAYS_SHORT.map((d, i) => (
                      <span key={i} className={cx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', rec.suggestedDays.slice(0, days).includes(i + 1) ? 'grad-fit text-white' : 'bg-surface-2 text-ink-3')}>
                        {d}
                      </span>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="h-5 w-5 accent-[var(--bal)]" />
                    Activar como mi plan semanal
                  </label>
                </Card>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
                Estimaciones basadas en fórmulas validadas (Mifflin-St Jeor, Compendio de Actividades Físicas 2024, ISSN). No reemplazan el consejo de un profesional de la salud. Podés cambiar todo después en Perfil.
              </p>
              <div className="flex-1" />
              <Button variant="bal" size="lg" block className="mt-4" onClick={finish}>
                ¡Vamos! <ArrowRight size={20} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
