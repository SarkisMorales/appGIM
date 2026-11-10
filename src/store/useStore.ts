import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActivePlan,
  EntryDraft,
  Food,
  FoodEntry,
  MealId,
  MealPlan,
  Measure,
  Profile,
  Routine,
  SavedMeal,
  Settings,
  WeightEntry,
  Workout,
} from '../types.ts';
import { uid } from '../lib/format.ts';
import { todayISO } from '../lib/dates.ts';
import { nextTargetLog, type TargetLog } from '../lib/nutrition.ts';

export interface RecentFood {
  food: Food;
  amount: number;
  portionLabel?: string;
  qty?: number;
  at: number;
}

export interface AppState {
  profile: Profile | null;
  settings: Settings;
  entries: FoodEntry[];
  water: Record<string, number>;
  workouts: Workout[];
  weights: WeightEntry[];
  customFoods: Food[];
  savedMeals: SavedMeal[];
  favorites: string[];
  recents: RecentFood[];
  customRoutines: Routine[];
  plan: ActivePlan | null;
  /** Historial de objetivos: cada cambio de perfil rige desde su fecha. */
  targetLog: TargetLog[];
  /** Logros ganados (id → fecha). Una vez ganados, no se pierden. */
  badges: Record<string, string>;
  measures: Measure[];
  mealPlan: MealPlan | null;
  lastBackupAt: number;
  backupSnoozeUntil: number;

  setProfile: (p: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  addEntry: (date: string, meal: MealId, draft: EntryDraft) => FoodEntry;
  updateEntry: (id: string, patch: Partial<FoodEntry>) => void;
  removeEntry: (id: string) => void;
  restoreEntry: (e: FoodEntry) => void;
  copyMeal: (fromDate: string, toDate: string, meal: MealId) => number;
  copyDay: (fromDate: string, toDate: string) => string[];
  removeEntries: (ids: string[]) => void;

  addWater: (date: string, ml: number) => void;

  addWorkout: (w: Omit<Workout, 'id'>) => Workout;
  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  removeWorkout: (id: string) => void;

  setWeight: (date: string, kg: number) => void;
  removeWeight: (date: string) => void;

  saveCustomFood: (f: Food) => void;
  removeCustomFood: (id: string) => void;
  toggleFavorite: (foodId: string) => void;
  pushRecent: (r: Omit<RecentFood, 'at'>) => void;

  saveMeal: (name: string, items: EntryDraft[]) => void;
  removeSavedMeal: (id: string) => void;

  setPlan: (p: ActivePlan | null) => void;
  advancePlan: (routineId: string) => void;

  saveRoutine: (r: Routine) => void;
  removeRoutine: (id: string) => void;

  earnBadges: (ids: string[]) => void;
  setMeasure: (m: Measure) => void;
  removeMeasure: (date: string) => void;
  setMealPlan: (p: MealPlan | null) => void;
  markBackup: () => void;
  snoozeBackup: (days: number) => void;

  importData: (data: Partial<AppState>) => void;
  resetAll: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  sound: true,
  vibration: true,
  voice: true,
  animations: true,
  offCountry: 'ar',
  restDefault: 90,
};

const initial = {
  profile: null as Profile | null,
  settings: DEFAULT_SETTINGS,
  entries: [] as FoodEntry[],
  water: {} as Record<string, number>,
  workouts: [] as Workout[],
  weights: [] as WeightEntry[],
  customFoods: [] as Food[],
  savedMeals: [] as SavedMeal[],
  favorites: [] as string[],
  recents: [] as RecentFood[],
  customRoutines: [] as Routine[],
  plan: null as ActivePlan | null,
  targetLog: [] as TargetLog[],
  badges: {} as Record<string, string>,
  measures: [] as Measure[],
  mealPlan: null as MealPlan | null,
  lastBackupAt: 0,
  backupSnoozeUntil: 0,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,

      setProfile: (p) => {
        set((s) => ({ profile: p, targetLog: nextTargetLog(s.profile, p, s.targetLog, todayISO()) }));
        if (!get().weights.length) set({ weights: [{ date: todayISO(), kg: p.weightKg }] });
      },
      updateProfile: (patch) =>
        set((s) => {
          if (!s.profile) return {};
          const profile = { ...s.profile, ...patch };
          return { profile, targetLog: nextTargetLog(s.profile, profile, s.targetLog, todayISO()) };
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addEntry: (date, meal, draft) => {
        const e: FoodEntry = { ...draft, id: uid(), date, meal, createdAt: Date.now() };
        set((s) => ({ entries: [...s.entries, e] }));
        return e;
      },
      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      restoreEntry: (e) => set((s) => ({ entries: [...s.entries, e] })),
      copyMeal: (fromDate, toDate, meal) => {
        const src = get().entries.filter((e) => e.date === fromDate && e.meal === meal);
        const now = Date.now();
        const copies = src.map((e, i) => ({ ...e, id: uid(), date: toDate, createdAt: now + i }));
        set((s) => ({ entries: [...s.entries, ...copies] }));
        return copies.length;
      },
      copyDay: (fromDate, toDate) => {
        const src = get().entries.filter((e) => e.date === fromDate).sort((a, b) => a.createdAt - b.createdAt);
        const now = Date.now();
        const copies = src.map((e, i) => ({ ...e, id: uid(), date: toDate, createdAt: now + i }));
        set((s) => ({ entries: [...s.entries, ...copies] }));
        return copies.map((c) => c.id);
      },
      removeEntries: (ids) => set((s) => ({ entries: s.entries.filter((e) => !ids.includes(e.id)) })),

      addWater: (date, ml) => set((s) => ({ water: { ...s.water, [date]: Math.max(0, (s.water[date] || 0) + ml) } })),

      addWorkout: (w) => {
        const full: Workout = { ...w, id: uid() };
        set((s) => ({ workouts: [...s.workouts, full] }));
        return full;
      },
      updateWorkout: (id, patch) => set((s) => ({ workouts: s.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

      setWeight: (date, kg) => {
        set((s) => {
          const weights = [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => (a.date < b.date ? -1 : 1));
          const latest = weights[weights.length - 1];
          const profile = s.profile && latest ? { ...s.profile, weightKg: latest.kg } : s.profile;
          return { weights, profile, targetLog: nextTargetLog(s.profile, profile, s.targetLog, todayISO()) };
        });
      },
      removeWeight: (date) =>
        set((s) => {
          const weights = s.weights.filter((w) => w.date !== date);
          const latest = weights[weights.length - 1];
          const profile = s.profile && latest ? { ...s.profile, weightKg: latest.kg } : s.profile;
          return { weights, profile, targetLog: nextTargetLog(s.profile, profile, s.targetLog, todayISO()) };
        }),

      saveCustomFood: (f) =>
        set((s) => ({
          customFoods: [...s.customFoods.filter((x) => x.id !== f.id), f],
          recents: s.recents.map((r) => (r.food.id === f.id ? { ...r, food: f } : r)),
        })),
      removeCustomFood: (id) => set((s) => ({ customFoods: s.customFoods.filter((x) => x.id !== id), favorites: s.favorites.filter((x) => x !== id) })),
      toggleFavorite: (foodId) =>
        set((s) => ({ favorites: s.favorites.includes(foodId) ? s.favorites.filter((x) => x !== foodId) : [foodId, ...s.favorites] })),
      pushRecent: (r) =>
        set((s) => ({ recents: [{ ...r, at: Date.now() }, ...s.recents.filter((x) => x.food.id !== r.food.id)].slice(0, 40) })),

      saveMeal: (name, items) => set((s) => ({ savedMeals: [{ id: uid(), name, items, createdAt: Date.now() }, ...s.savedMeals] })),
      removeSavedMeal: (id) => set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id) })),

      setPlan: (p) => set({ plan: p }),
      advancePlan: (routineId) => set((s) => (s.plan && s.plan.routineId === routineId ? { plan: { ...s.plan, nextIndex: s.plan.nextIndex + 1 } } : {})),

      saveRoutine: (r) => set((s) => ({ customRoutines: [...s.customRoutines.filter((x) => x.id !== r.id), r] })),
      removeRoutine: (id) => set((s) => ({ customRoutines: s.customRoutines.filter((x) => x.id !== id), plan: s.plan?.routineId === id ? null : s.plan })),

      earnBadges: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => !s.badges[id]);
          if (!fresh.length) return {};
          const badges = { ...s.badges };
          fresh.forEach((id) => (badges[id] = todayISO()));
          return { badges };
        }),
      setMeasure: (m) => set((s) => ({ measures: [...s.measures.filter((x) => x.date !== m.date), m].sort((a, b) => (a.date < b.date ? -1 : 1)) })),
      removeMeasure: (date) => set((s) => ({ measures: s.measures.filter((x) => x.date !== date) })),
      setMealPlan: (p) => set({ mealPlan: p }),
      markBackup: () => set({ lastBackupAt: Date.now() }),
      snoozeBackup: (days) => set({ backupSnoozeUntil: Date.now() + days * 86400000 }),

      importData: (data) => {
        const keys = Object.keys(initial) as (keyof typeof initial)[];
        const patch: Partial<AppState> = {};
        for (const k of keys) if (k in data && (data as Record<string, unknown>)[k] != null) (patch as Record<string, unknown>)[k] = (data as Record<string, unknown>)[k];
        // Lo que el backup no trae vuelve a su valor inicial: importar reemplaza todo.
        set({ ...initial, ...patch, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) }, lastBackupAt: Date.now() });
      },
      resetAll: () => set({ ...initial, settings: get().settings }),
    }),
    {
      name: 'appgim-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(initial)) out[k] = (s as unknown as Record<string, unknown>)[k];
        return out as Partial<AppState>;
      },
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<AppState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) } };
      },
    },
  ),
);

/** Exporta los datos persistidos (para backup). */
export function exportState(): string {
  const s = useStore.getState();
  const out: Record<string, unknown> = { app: 'appGIM', version: 1, exportedAt: new Date().toISOString() };
  for (const k of Object.keys(initial)) out[k] = (s as unknown as Record<string, unknown>)[k];
  return JSON.stringify(out, null, 2);
}

// ---------------- Estado de interfaz (no persistido) ----------------
interface Toast {
  id: string;
  text: string;
  action?: { label: string; run: () => void };
  tone?: 'ok' | 'info' | 'warn';
}

export type SheetState =
  | { kind: 'addFood'; meal?: MealId; date?: string }
  | { kind: 'activity'; date?: string }
  | { kind: 'weight' }
  | { kind: 'water' }
  | null;

interface UIState {
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  date: string;
  setDate: (d: string) => void;
  toasts: Toast[];
  toast: (text: string, opts?: Omit<Toast, 'id' | 'text'>) => void;
  dismiss: (id: string) => void;
  quickOpen: boolean;
  setQuick: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  sheet: null,
  openSheet: (sheet) => set({ sheet, quickOpen: false }),
  closeSheet: () => set({ sheet: null }),
  date: todayISO(),
  setDate: (d) => set({ date: d }),
  toasts: [],
  toast: (text, opts) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-1), { id, text, ...opts }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), opts?.action ? 5000 : 2600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  quickOpen: false,
  setQuick: (v) => set({ quickOpen: v }),
}));
