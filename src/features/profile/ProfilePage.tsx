import { useEffect, useRef, useState } from 'react';
import { BookOpen, Download, Dumbbell, HeartPulse, Moon, Palette, Shield, Smartphone, Sun, Target, Trash2, Upload, User } from 'lucide-react';
import type { ActivityLevel, Goal, Level, Overrides, Place, Profile, Sex } from '../../types.ts';
import { useStore, useUI, type AppState } from '../../store/useStore.ts';
import { downloadBackup } from '../../lib/backup.ts';
import { clearPhotos } from '../../lib/photos.ts';
import { clearActive } from '../../lib/activeWorkout.ts';
import { findRoutine } from '../../store/derived.ts';
import { ACTIVITY, GOALS, baseTargets } from '../../lib/nutrition.ts';
import { LEVELS } from '../../data/routines.ts';
import { OFF_COUNTRIES } from '../../lib/off.ts';
import { Button, Card, Field, NumberInput, PageHeader, SectionTitle, Segmented, Sheet, Toggle, cx, inputCls } from '../../components/ui.tsx';
import { Logo } from '../../components/Logo.tsx';
import { navigate } from '../../lib/router.ts';
import { fmt } from '../../lib/format.ts';
import { WEEKDAYS_SHORT, todayISO } from '../../lib/dates.ts';
import { getInstallPrompt, onInstallPromptChange } from '../../lib/install.ts';

function Row({ label, value, onClick }: { label: string; value: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 py-3 text-left">
      <span className="text-[15px] font-semibold">{label}</span>
      <span className="num text-right text-[14px] text-ink-2">{value}</span>
    </button>
  );
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const updateProfile = useStore((s) => s.updateProfile);
  const setWeight = useStore((s) => s.setWeight);
  const [p, setP] = useState<Profile>(profile);
  const [w, setW] = useState<number | ''>(profile.weightKg);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  return (
    <Sheet open onClose={onClose} title="Tus datos" full>
      <div className="space-y-4">
        <Field label="Nombre">
          <input className={inputCls} value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Segmented<Sex> value={p.sex} onChange={(v) => set('sex', v)} options={[{ value: 'f', label: 'Mujer' }, { value: 'm', label: 'Hombre' }]} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Edad">
            <NumberInput value={p.age} onChange={(v) => set('age', Number(v) || p.age)} suffix="años" />
          </Field>
          <Field label="Altura">
            <NumberInput value={p.heightCm} onChange={(v) => set('heightCm', Number(v) || p.heightCm)} suffix="cm" />
          </Field>
          <Field label="Peso">
            <NumberInput value={w} onChange={setW} suffix="kg" step={0.1} />
          </Field>
        </div>
        <Field label="Actividad diaria (sin contar entrenamientos)">
          <select className={inputCls} value={p.activity} onChange={(e) => set('activity', e.target.value as ActivityLevel)}>
            {(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY[k].label} — {ACTIVITY[k].desc}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objetivo">
          <Segmented<Goal>
            value={p.goal}
            onChange={(v) => setP((x) => ({ ...x, goal: v, paceKg: v === 'mantener' ? 0 : x.paceKg || 0.5 }))}
            options={(Object.keys(GOALS) as Goal[]).map((g) => ({ value: g, label: GOALS[g].label.split(' ')[0] + (g === 'subir' ? ' músculo' : g === 'bajar' ? ' grasa' : '') }))}
          />
        </Field>
        {p.goal !== 'mantener' && (
          <Field label="Ritmo semanal">
            <Segmented
              value={String(p.paceKg)}
              onChange={(v) => set('paceKg', Number(v))}
              options={(p.goal === 'bajar' ? [0.25, 0.5, 0.75] : [0.25, 0.5]).map((v) => ({ value: String(v), label: `${String(v).replace('.', ',')} kg` }))}
            />
          </Field>
        )}
        <Field label="Peso objetivo (opcional)">
          <NumberInput value={p.targetWeightKg ?? ''} onChange={(v) => set('targetWeightKg', v === '' ? undefined : Number(v))} suffix="kg" step={0.5} />
        </Field>
        <Field label="Nivel de entrenamiento">
          <Segmented<Level> value={p.level} onChange={(v) => set('level', v)} options={LEVELS.map((l) => ({ value: l.id, label: l.label.split(' ')[0] }))} />
        </Field>
        <Field label="Lugar">
          <Segmented<Place> value={p.place} onChange={(v) => set('place', v)} options={[{ value: 'casa', label: 'Casa / plaza' }, { value: 'gimnasio', label: 'Gimnasio' }]} />
        </Field>
        <Field label="Días de entrenamiento por semana">
          <Segmented value={String(p.trainingDays)} onChange={(v) => set('trainingDays', Number(v))} options={[0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: String(d) }))} />
        </Field>
        <Button
          variant="bal"
          size="lg"
          block
          onClick={() => {
            updateProfile(p);
            if (w !== '' && Number(w) !== profile.weightKg) setWeight(todayISO(), Number(w));
            onClose();
          }}
        >
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}

function TargetsSheet({ onClose }: { onClose: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const updateProfile = useStore((s) => s.updateProfile);
  const auto = baseTargets({ ...profile, overrides: undefined });
  const [o, setO] = useState<Overrides>(profile.overrides ?? {});
  const field = (k: keyof Overrides, label: string, suffix: string, autoV: number) => (
    <Field label={label} hint={`Calculado: ${fmt(autoV)} ${suffix}`}>
      <NumberInput value={o[k] ?? ''} placeholder={String(autoV)} onChange={(v) => setO((x) => ({ ...x, [k]: v === '' ? undefined : Number(v) }))} suffix={suffix} />
    </Field>
  );
  return (
    <Sheet open onClose={onClose} title="Personalizar objetivos" full>
      <p className="text-sm text-ink-2">Dejá vacío para usar el cálculo automático. Útil si te los indicó un/a nutricionista.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {field('kcal', 'Calorías', 'kcal', auto.kcal)}
        {field('protein', 'Proteína', 'g', auto.protein)}
        {field('carbs', 'Carbohidratos', 'g', auto.carbs)}
        {field('fat', 'Grasas', 'g', auto.fat)}
        {field('waterMl', 'Agua', 'ml', auto.waterMl)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => setO({})}>
          Volver a automático
        </Button>
        <Button
          variant="bal"
          onClick={() => {
            const clean = Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !Number.isNaN(v)));
            updateProfile({ overrides: Object.keys(clean).length ? clean : undefined });
            onClose();
          }}
        >
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}

export default function ProfilePage() {
  const profile = useStore((s) => s.profile)!;
  const settings = useStore((s) => s.settings);
  const plan = useStore((s) => s.plan);
  const custom = useStore((s) => s.customRoutines);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateProfile = useStore((s) => s.updateProfile);
  const setPlan = useStore((s) => s.setPlan);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const toast = useUI((s) => s.toast);
  const [edit, setEdit] = useState(false);
  const [targets, setTargets] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [installable, setInstallable] = useState(!!getInstallPrompt());
  useEffect(() => onInstallPromptChange(() => setInstallable(!!getInstallPrompt())), []);
  const t = baseTargets(profile);
  const routine = findRoutine(plan?.routineId, custom);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;

  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const nEntries = useStore((s) => s.entries.length);
  const nWorkouts = useStore((s) => s.workouts.length);
  const nWeights = useStore((s) => s.weights.length);
  const counts = { e: nEntries, w: nWorkouts, p: nWeights };
  const [pending, setPending] = useState<(Partial<AppState> & { exportedAt?: string }) | null>(null);

  const doExport = () => {
    downloadBackup();
    toast('Backup descargado ✓');
  };

  // Importar reemplaza todo: primero se lee el archivo y se pide confirmación mostrando qué trae.
  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const arr = (v: unknown) => v == null || Array.isArray(v);
      if (data.app !== 'appGIM' || !arr(data.entries) || !arr(data.workouts) || !arr(data.weights)) throw new Error('formato');
      setPending(data);
    } catch {
      toast('El archivo no es un backup válido de appGIM', { tone: 'warn' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="anim-fade">
      <PageHeader title="Perfil" back="" />
      <Card className="flex items-center gap-4">
        <Logo size={56} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold">{profile.name}</div>
          <div className="text-[13px] text-ink-3">
            {profile.sex === 'f' ? 'Mujer' : 'Hombre'} · {profile.age} años · {profile.heightCm} cm · {profile.weightKg} kg
          </div>
          <div className="text-[13px] text-ink-3">
            {GOALS[profile.goal].emoji} {GOALS[profile.goal].label} · {LEVELS.find((l) => l.id === profile.level)?.label}
          </div>
        </div>
        <Button variant="soft" size="sm" onClick={() => setEdit(true)}>
          <User size={16} /> Editar
        </Button>
      </Card>

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Target size={16} className="text-bal" /> Objetivos diarios
        </span>
      </SectionTitle>
      <Card className="divide-y divide-line py-1">
        <Row label="Calorías" value={`${fmt(t.kcal)} kcal`} onClick={() => setTargets(true)} />
        <Row label="Proteína" value={`${t.protein} g (${t.proteinPerKg} g/kg)`} onClick={() => setTargets(true)} />
        <Row label="Carbohidratos · Grasas" value={`${t.carbs} g · ${t.fat} g`} onClick={() => setTargets(true)} />
        <Row label="Fibra · Agua" value={`${t.fiber} g · ${(t.waterMl / 1000).toFixed(1).replace('.', ',')} L`} onClick={() => setTargets(true)} />
        <Row label="Metabolismo basal · Gasto sin ejercicio" value={`${fmt(t.bmr)} · ${fmt(t.tdee)} kcal`} />
        <div className="py-3">
          <div className="text-[15px] font-semibold">Calorías del ejercicio que se suman a tu comida</div>
          <p className="mb-2 text-xs text-ink-3">Si sentís que las estimaciones te quedan altas, usá 75% o 50%.</p>
          <Segmented value={String(profile.exerciseBack)} onChange={(v) => updateProfile({ exerciseBack: Number(v) })} options={[1, 0.75, 0.5, 0].map((v) => ({ value: String(v), label: v ? `${v * 100}%` : 'No sumar' }))} />
        </div>
        {profile.overrides && <p className="py-2 text-xs text-warn">Estás usando objetivos personalizados.</p>}
      </Card>

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Dumbbell size={16} className="text-fit" /> Plan de entrenamiento
        </span>
      </SectionTitle>
      <Card>
        {routine && plan ? (
          <div>
            <div className="text-lg font-extrabold">{routine.name}</div>
            <div className="mt-1 flex gap-1">
              {WEEKDAYS_SHORT.map((d, i) => (
                <span key={i} className={cx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', plan.days.includes(i + 1) ? 'grad-fit text-white' : 'bg-surface-2 text-ink-3')}>
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="soft" onClick={() => navigate(`rutina/${routine.id}`)}>
                Ver rutina
              </Button>
              <Button variant="danger" onClick={() => setPlan(null)}>
                Quitar plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-2">No tenés un plan activo.</span>
            <Button variant="fit" size="sm" onClick={() => navigate('ejercicio/rutinas')}>
              Elegir rutina
            </Button>
          </div>
        )}
      </Card>

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Palette size={16} className="text-ink-3" /> Preferencias
        </span>
      </SectionTitle>
      <Card className="py-2">
        <div className="py-2">
          <div className="mb-2 text-[15px] font-semibold">Tema</div>
          <Segmented
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'system', label: 'Automático' },
              { value: 'light', label: <span className="flex items-center justify-center gap-1"><Sun size={14} /> Claro</span> },
              { value: 'dark', label: <span className="flex items-center justify-center gap-1"><Moon size={14} /> Oscuro</span> },
            ]}
          />
        </div>
        <div className="divide-y divide-line">
          <Toggle checked={settings.animations} onChange={(v) => updateSettings({ animations: v })} label="Animaciones de ejercicios" desc="Desactivalas para ahorrar batería." />
          <Toggle checked={settings.voice} onChange={(v) => updateSettings({ voice: v })} label="Voz guía" desc="Te dice el ejercicio, las repeticiones y el descanso." />
          <Toggle checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Sonidos" desc="Pitidos en la cuenta regresiva." />
          <Toggle checked={settings.vibration} onChange={(v) => updateSettings({ vibration: v })} label="Vibración" desc="Al terminar cada descanso (Android)." />
        </div>
        <Field label="País para buscar productos (Open Food Facts)" className="py-2">
          <select className={inputCls} value={settings.offCountry} onChange={(e) => updateSettings({ offCountry: e.target.value })}>
            {OFF_COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Shield size={16} className="text-food" /> Tus datos
        </span>
      </SectionTitle>
      <Card>
        <p className="text-[13px] text-ink-2">Todo se guarda solo en este dispositivo: no hay cuentas ni servidores. Hacé un backup de vez en cuando (o para pasar tus datos a otro teléfono).</p>
        <p className="mt-1 text-xs font-semibold text-ink-3">{lastBackupAt ? `Último backup: ${new Date(lastBackupAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}` : 'Todavía no hiciste ningún backup.'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={doExport}>
            <Download size={16} /> Exportar
          </Button>
          <Button variant="soft" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Importar
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <Button variant="danger" block className="mt-2" onClick={() => setConfirmReset(true)}>
          <Trash2 size={16} /> Borrar todo
        </Button>
      </Card>

      {!standalone && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <Smartphone size={16} className="text-ink-3" /> Instalar como app
            </span>
          </SectionTitle>
          <Card>
            {installable ? (
              <Button variant="bal" block onClick={() => getInstallPrompt()?.prompt()}>
                Instalar appGIM
              </Button>
            ) : ios ? (
              <p className="text-[13px] text-ink-2">
                En iPhone: abrí esta página en <b>Safari</b>, tocá <b>Compartir</b> y elegí <b>“Agregar a inicio”</b>. Va a funcionar como una app, incluso sin internet.
              </p>
            ) : (
              <p className="text-[13px] text-ink-2">
                En Android (Chrome): menú <b>⋮</b> → <b>“Instalar app”</b> o <b>“Agregar a la pantalla principal”</b>. En la compu: ícono de instalar en la barra de direcciones.
              </p>
            )}
          </Card>
        </>
      )}

      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <BookOpen size={16} className="text-ink-3" /> Cómo calculamos y fuentes
        </span>
      </SectionTitle>
      <Card className="space-y-2 text-[13px] leading-relaxed text-ink-2">
        <p>
          <b>Metabolismo basal:</b> ecuación de Mifflin-St Jeor (1990). <b>Gasto diario:</b> basal × factor de actividad (sin contar entrenamientos). <b>Déficit/superávit:</b> ~7.700 kcal por kg.
        </p>
        <p>
          <b>Ejercicio:</b> kcal = MET × kg × horas, con METs del Compendio de Actividades Físicas para Adultos 2024 (Herrmann et al.). A tu objetivo se suman las kcal netas (MET − 1).
        </p>
        <p>
          <b>Proteína:</b> 1,6–2,0 g/kg según objetivo (ISSN 2017; Morton et al. 2018) y ~0,3 g/kg después de entrenar. <b>Fibra:</b> 14 g cada 1.000 kcal.
        </p>
        <p>
          <b>Alimentos:</b> USDA FoodData Central (dominio público) y estimaciones de platos típicos. Productos envasados: Open Food Facts (ODbL).
        </p>
        <p>
          <b>Rutinas:</b> ACSM (2009), Klika y Jordan (2013), StrongLifts 5×5, PPL de r/Fitness, PHUL, 5/3/1 de Jim Wendler y progresiones de r/bodyweightfitness.
        </p>
        <p className="flex items-start gap-1.5 rounded-xl bg-surface-2 p-2 text-xs">
          <HeartPulse size={14} className="mt-0.5 shrink-0 text-danger" />
          Son estimaciones educativas: no reemplazan el consejo de un médico o nutricionista. Si tenés alguna condición de salud, consultá antes de empezar.
        </p>
      </Card>
      <p className="mt-4 text-center text-xs text-ink-3">appGIM · hecha con software libre · v1.0</p>

      {edit && <EditProfileSheet onClose={() => setEdit(false)} />}
      {targets && <TargetsSheet onClose={() => setTargets(false)} />}
      {pending && (
        <Sheet open onClose={() => setPending(null)} title="¿Restaurar este backup?">
          <div className="rounded-2xl bg-surface-2 p-3 text-[13px]">
            <div className="font-bold">El archivo trae</div>
            <div className="num mt-1 text-ink-2">
              {pending.entries?.length ?? 0} comidas · {pending.workouts?.length ?? 0} entrenamientos · {pending.weights?.length ?? 0} pesajes
              {pending.profile?.name ? ` · perfil de ${pending.profile.name}` : ''}
            </div>
            {pending.exportedAt && <div className="mt-0.5 text-xs text-ink-3">Guardado el {new Date(pending.exportedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
          </div>
          <p className="mt-3 text-sm text-ink-2">
            Va a <b>reemplazar todo</b> lo que hay ahora en este dispositivo
            <span className="num"> ({counts.e} comidas, {counts.w} entrenamientos y {counts.p} pesajes)</span>. No se puede deshacer.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="soft" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                importData(pending);
                setPending(null);
                toast('Datos restaurados ✓');
              }}
            >
              Reemplazar todo
            </Button>
          </div>
        </Sheet>
      )}
      {confirmReset && (
        <Sheet open onClose={() => setConfirmReset(false)} title="¿Borrar todos tus datos?">
          <p className="text-sm text-ink-2">Se eliminan comidas, entrenamientos, pesos, medidas, fotos y tu perfil de este dispositivo. No se puede deshacer (salvo que tengas un backup).</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="soft" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAll();
                clearActive();
                void clearPhotos().catch(() => {});
                setConfirmReset(false);
                navigate('', { replace: true });
              }}
            >
              Borrar todo
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
