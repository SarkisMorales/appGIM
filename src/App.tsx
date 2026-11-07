import { lazy, Suspense, useEffect } from 'react';
import { Activity, Dumbbell, Home, Plus, Scale, TrendingUp, Utensils, Droplets, X } from 'lucide-react';
import { navigate, useRoute } from './lib/router.ts';
import { useStore, useUI } from './store/useStore.ts';
import { cx, Toasts } from './components/ui.tsx';
import { todayISO } from './lib/dates.ts';
import Onboarding from './features/onboarding/Onboarding.tsx';
import HomePage from './features/home/HomePage.tsx';
import FoodPage from './features/food/FoodPage.tsx';
import AddFoodSheet from './features/food/AddFoodSheet.tsx';
import ExercisePage from './features/exercise/ExercisePage.tsx';
import RoutineDetail from './features/exercise/RoutineDetail.tsx';
import ExerciseDetail from './features/exercise/ExerciseDetail.tsx';
import ActivitySheet from './features/exercise/ActivitySheet.tsx';
import ProgressPage from './features/progress/ProgressPage.tsx';
import WeightSheet from './features/progress/WeightSheet.tsx';
import ProfilePage from './features/profile/ProfilePage.tsx';
import WaterSheet from './features/food/WaterSheet.tsx';

const WorkoutPlayer = lazy(() => import('./features/exercise/WorkoutPlayer.tsx'));
const RoutineBuilder = lazy(() => import('./features/exercise/RoutineBuilder.tsx'));
const DevGallery = lazy(() => import('./features/dev/DevGallery.tsx'));

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0a0c11' : '#f3f4f7'));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

const TABS = [
  { id: '', label: 'Inicio', icon: Home },
  { id: 'comida', label: 'Comida', icon: Utensils },
  { id: 'ejercicio', label: 'Ejercicio', icon: Dumbbell },
  { id: 'progreso', label: 'Progreso', icon: TrendingUp },
];

function BottomNav({ current }: { current: string }) {
  const setQuick = useUI((s) => s.setQuick);
  const quick = useUI((s) => s.quickOpen);
  const item = (t: (typeof TABS)[number]) => {
    const active = current === t.id;
    const Icon = t.icon;
    return (
      <button
        key={t.id}
        onClick={() => navigate(t.id)}
        className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition', active ? 'text-ink' : 'text-ink-3')}
        aria-current={active ? 'page' : undefined}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
        {t.label}
      </button>
    );
  };
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {TABS.slice(0, 2).map(item)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => setQuick(!quick)}
            aria-label="Registrar"
            className={cx(
              'grad-bal -mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_28px_-8px_var(--bal)] transition active:scale-95',
              quick && 'rotate-45',
            )}
          >
            <Plus size={28} strokeWidth={2.6} />
          </button>
        </div>
        {TABS.slice(2).map(item)}
      </div>
    </nav>
  );
}

function QuickActions() {
  const open = useUI((s) => s.quickOpen);
  const setQuick = useUI((s) => s.setQuick);
  const openSheet = useUI((s) => s.openSheet);
  const date = useUI((s) => s.date);
  if (!open) return null;
  const actions = [
    { label: 'Comida', desc: 'Buscar o escanear', icon: Utensils, cls: 'grad-food', run: () => openSheet({ kind: 'addFood', date }) },
    { label: 'Entrenar', desc: 'Rutinas guiadas', icon: Dumbbell, cls: 'grad-fit', run: () => { setQuick(false); navigate('ejercicio'); } },
    { label: 'Actividad', desc: 'Caminar, fútbol, bici…', icon: Activity, cls: 'grad-fit', run: () => openSheet({ kind: 'activity', date }) },
    { label: 'Agua', desc: 'Vasos del día', icon: Droplets, cls: 'bg-water', run: () => openSheet({ kind: 'water' }) },
    { label: 'Peso', desc: 'Registrar peso', icon: Scale, cls: 'grad-bal', run: () => openSheet({ kind: 'weight' }) },
  ];
  return (
    <div className="fixed inset-0 z-30" onClick={() => setQuick(false)}>
      <div className="anim-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="absolute inset-x-0 bottom-24 mx-auto max-w-lg px-4" onClick={(e) => e.stopPropagation()}>
        <div className="anim-pop grid grid-cols-2 gap-2 rounded-3xl border border-line bg-surface p-3 shadow-pop">
          {actions.map((a, i) => (
            <button key={a.label} onClick={a.run} className={cx('flex items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-surface-2 active:scale-[0.98]', i === 0 && 'col-span-2 bg-surface-2')}>
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white', a.cls)}>
                <a.icon size={20} />
              </span>
              <span>
                <span className="block text-[15px] font-bold">{a.label}</span>
                <span className="block text-xs text-ink-3">{a.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setQuick(false)} className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-2 shadow-pop" aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function GlobalSheets() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.closeSheet);
  const uiDate = useUI((s) => s.date);
  if (!sheet) return null;
  if (sheet.kind === 'addFood') return <AddFoodSheet open onClose={close} date={sheet.date ?? uiDate} initialMeal={sheet.meal} />;
  if (sheet.kind === 'activity') return <ActivitySheet open onClose={close} date={sheet.date ?? uiDate} />;
  if (sheet.kind === 'weight') return <WeightSheet open onClose={close} />;
  if (sheet.kind === 'water') return <WaterSheet open onClose={close} date={uiDate} />;
  return null;
}

export default function App() {
  useTheme();
  const route = useRoute();
  const profile = useStore((s) => s.profile);
  const setDate = useUI((s) => s.setDate);

  // Al volver a la app otro día, la fecha seleccionada vuelve a "hoy".
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setDate(todayISO());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setDate]);

  if (route[0] === 'dev' && import.meta.env.DEV) {
    return (
      <Suspense fallback={null}>
        <DevGallery />
      </Suspense>
    );
  }
  if (!profile) return <Onboarding />;

  const [r0, r1, r2] = route;
  if (r0 === 'entrenar') {
    return (
      <Suspense fallback={null}>
        <WorkoutPlayer routineId={r1} sessionId={r2} />
        <Toasts />
      </Suspense>
    );
  }

  let page: React.ReactNode;
  let tab = r0 ?? '';
  switch (r0) {
    case undefined:
    case 'inicio':
      page = <HomePage />;
      tab = '';
      break;
    case 'comida':
      page = <FoodPage />;
      break;
    case 'ejercicio':
      page = <ExercisePage tab={r1} />;
      break;
    case 'rutina':
      page = <RoutineDetail id={r1} />;
      tab = 'ejercicio';
      break;
    case 'ej':
      page = <ExerciseDetail id={r1} />;
      tab = 'ejercicio';
      break;
    case 'crear-rutina':
      page = (
        <Suspense fallback={null}>
          <RoutineBuilder id={r1} />
        </Suspense>
      );
      tab = 'ejercicio';
      break;
    case 'progreso':
      page = <ProgressPage />;
      break;
    case 'perfil':
      page = <ProfilePage />;
      tab = '';
      break;
    default:
      page = <HomePage />;
      tab = '';
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32">
      {page}
      <QuickActions />
      <BottomNav current={tab} />
      <GlobalSheets />
      <Toasts />
    </div>
  );
}
