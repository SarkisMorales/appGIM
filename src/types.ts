// ===================== Perfil =====================
export type Sex = 'm' | 'f';
export type ActivityLevel = 'sedentario' | 'ligero' | 'activo' | 'muy-activo';
export type Goal = 'bajar' | 'mantener' | 'subir';
export type Level = 'principiante' | 'intermedio' | 'avanzado';
export type Place = 'casa' | 'gimnasio';

export interface Overrides {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  waterMl?: number;
}

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  activity: ActivityLevel;
  goal: Goal;
  /** Ritmo semanal deseado en kg (magnitud). */
  paceKg: number;
  level: Level;
  place: Place;
  trainingDays: number;
  /** Fracción (0–1) de las kcal netas del ejercicio que se suman al objetivo diario. */
  exerciseBack: number;
  overrides?: Overrides;
  createdAt: string;
}

// ===================== Comida =====================
export type FoodCategory =
  | 'carnes'
  | 'pescados'
  | 'huevos'
  | 'lacteos'
  | 'cereales'
  | 'legumbres'
  | 'frutas'
  | 'verduras'
  | 'frutos-secos'
  | 'grasas'
  | 'bebidas'
  | 'dulces'
  | 'platos'
  | 'suplementos';

export type MealId = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'snacks';

export interface Portion {
  label: string;
  grams: number;
}

export type FoodSource = 'usda' | 'est' | 'custom' | 'off';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  category: FoodCategory | 'personal' | 'producto';
  /** Valores por 100 g (o 100 ml). */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  unit: 'g' | 'ml';
  portions: Portion[];
  tags?: string;
  source: FoodSource;
  fdcId?: number;
  barcode?: string;
  image?: string;
  /** Si el alimento es una receta propia: ingredientes y porciones que rinde. */
  recipe?: Recipe;
}

export interface RecipeItem {
  foodId: string;
  name: string;
  grams: number;
  unit: 'g' | 'ml';
  per100: Macros;
}

export interface Recipe {
  servings: number;
  items: RecipeItem[];
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface FoodEntry extends Macros {
  id: string;
  date: string;
  meal: MealId;
  foodId?: string;
  name: string;
  brand?: string;
  amount: number;
  unit: 'g' | 'ml';
  portionLabel?: string;
  qty?: number;
  source: FoodSource | 'quick' | 'saved';
  /** Valores por 100 para poder editar la cantidad luego. */
  per100?: Macros;
  createdAt: number;
}

export type EntryDraft = Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt'>;

export interface SavedMeal {
  id: string;
  name: string;
  items: EntryDraft[];
  createdAt: number;
}

// ===================== Ejercicio =====================
export type Muscle =
  | 'pecho'
  | 'espalda'
  | 'hombros'
  | 'biceps'
  | 'triceps'
  | 'antebrazos'
  | 'core'
  | 'gluteos'
  | 'cuadriceps'
  | 'isquios'
  | 'gemelos'
  | 'cardio'
  | 'movilidad';

export type Equipment =
  | 'ninguno'
  | 'mancuernas'
  | 'barra'
  | 'banco'
  | 'maquina'
  | 'polea'
  | 'barra-fija'
  | 'paralelas'
  | 'kettlebell'
  | 'cajon'
  | 'soga'
  | 'silla'
  | 'rueda'
  | 'mochila'
  | 'colchoneta';

export interface Exercise {
  id: string;
  name: string;
  muscles: Muscle[];
  secondary?: Muscle[];
  equipment: Equipment[];
  category: 'fuerza' | 'cardio' | 'core' | 'movilidad';
  mode: 'reps' | 'tiempo';
  /** Segundos por repetición (para estimar duración). */
  tempo?: number;
  perSide?: boolean;
  weighted?: boolean;
  steps: string[];
  tips: string[];
  mistakes?: string[];
  anim: string;
  easier?: string;
  harder?: string;
  /** MET del ejercicio cuando se usa como intervalo/cardio. */
  met?: number;
}

export interface SetsBlock {
  type: 'sets';
  ex: string;
  sets: number;
  reps?: number | [number, number];
  sec?: number;
  rest: number;
  note?: string;
  load?: string;
}

export interface CircuitItem {
  ex: string;
  sec?: number;
  reps?: number;
  label?: string;
}

export interface CircuitBlock {
  type: 'circuit';
  name: string;
  rounds: number;
  /** Segundos de trabajo por ejercicio (si el ítem no define sec/reps). */
  work: number;
  /** Descanso entre ejercicios. */
  rest: number;
  /** Descanso entre vueltas. */
  restRounds: number;
  items: CircuitItem[];
  /** MET del bloque completo (incluye pausas). Si falta, se usa el MET de cada ejercicio. */
  met?: number;
  note?: string;
}

export type Block = SetsBlock | CircuitBlock;

export interface Session {
  id: string;
  name: string;
  focus: string;
  /** MET de la sesión (Compendio de Actividades Físicas 2024). */
  met: number;
  warmupMin: number;
  blocks: Block[];
}

export interface Routine {
  id: string;
  name: string;
  short: string;
  level: Level;
  place: Place | 'ambos';
  goals: string[];
  daysPerWeek: number;
  description: string;
  basedOn: string;
  metNote: string;
  progression: string[];
  equipment: Equipment[];
  sessions: Session[];
  /** Orden de sesiones a lo largo de la semana (índices de sessions). */
  weekPattern: number[];
  /** Días sugeridos (1 = lunes … 7 = domingo), mismo largo que weekPattern. */
  suggestedDays: number[];
  custom?: boolean;
}

export interface SetLog {
  reps?: number;
  weight?: number;
  sec?: number;
  done: boolean;
}

export interface ExerciseLog {
  exId: string;
  name: string;
  sets: SetLog[];
}

export interface Workout {
  id: string;
  date: string;
  kind: 'rutina' | 'actividad';
  title: string;
  subtitle?: string;
  routineId?: string;
  sessionId?: string;
  activityId?: string;
  startedAt: number;
  durationMin: number;
  met: number;
  kcal: number;
  netKcal: number;
  exercises?: ExerciseLog[];
  volumeKg?: number;
  /** Proteína post-entreno recomendada para esta sesión (g). */
  proteinG?: number;
  feeling?: number;
  notes?: string;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

/** Medidas corporales en cm. */
export interface Measure {
  date: string;
  cintura?: number;
  pecho?: number;
  cadera?: number;
  brazo?: number;
  muslo?: number;
}

// ===================== Plan de comidas =====================
export interface PlanItem {
  foodId: string;
  grams: number;
}

export interface PlanMeal {
  meal: MealId;
  /** Id de la plantilla usada (para poder cambiarla por otra). */
  tpl: string;
  name: string;
  items: PlanItem[];
}

export interface MealPlan {
  /** Fecha (YYYY-MM-DD) del primer día del plan. */
  createdAt: string;
  kcal: number;
  protein: number;
  veg?: boolean;
  days: PlanMeal[][];
  /** Ítems de la lista de compras ya tildados (foodId). */
  checked: string[];
}

export interface ActivePlan {
  routineId: string;
  /** Días de la semana elegidos (1 = lunes … 7 = domingo). */
  days: number[];
  startedAt: string;
  /** Índice dentro de weekPattern de la próxima sesión. */
  nextIndex: number;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  animations: boolean;
  offCountry: string;
  restDefault: number;
}

// ===================== Figura animada =====================
export type Pt = [number, number];

export interface Pose {
  hip: Pt;
  /** Ángulo del torso en grados: 0 = vertical, 90 = horizontal con la cabeza a la derecha. */
  torso: number;
  /** Inclinación extra de la cabeza respecto del torso. */
  head?: number;
  /** Mano cercana / lejana (objetivo para IK). */
  hn: Pt;
  hf?: Pt;
  /** Tobillo cercano / lejano. */
  fn: Pt;
  ff?: Pt;
  /** Vectores "polo" para la dirección de codos y rodillas. */
  pe?: Pt;
  pef?: Pt;
  pk?: Pt;
  pkf?: Pt;
  /** Posición del disco de la barra (si no, el medio de las manos). */
  bar?: Pt;
  /** Ángulos del pie (grados, 0 = apunta a la derecha). */
  ftn?: number;
  ftf?: number;
  /** Fase de la soga (0–1). */
  rope?: number;
  /** Curvatura de la columna (-1 a 1): positivo hacia el pecho. */
  curve?: number;
}

export type FigSeg = 'torso' | 'upper' | 'fore' | 'thigh' | 'shin';

export type Prop =
  | { k: 'bench'; x: number; y: number; w: number; angle?: number; legs?: boolean }
  | { k: 'box'; x: number; y: number; w: number; h: number }
  | { k: 'pullbar'; x: number; y: number }
  | { k: 'dipbars'; x: number; y: number }
  | { k: 'wall'; x: number }
  | { k: 'barbell'; r?: number }
  | { k: 'dumbbells'; one?: boolean }
  | { k: 'kettlebell' }
  | { k: 'cable'; x: number; y: number; to?: 'n' | 'f' }
  | { k: 'mat'; x: number; w: number }
  | { k: 'rope' }
  | { k: 'wheel' }
  | { k: 'backpack' }
  | { k: 'seat'; x: number; y: number; w: number; back?: number; backAngle?: number }
  | { k: 'legpad'; x: number; y: number }
  | { k: 'anklepad' }
  | { k: 'sled'; angle: number }
  | { k: 'parallettes'; x: number; y: number }
  | { k: 'chair'; x: number; y: number; flip?: boolean }
  | { k: 'plate' };

export interface Keyframe {
  pose: Pose;
  /** Duración de la transición hacia este cuadro (ms). */
  ms: number;
  /** Pausa en este cuadro (ms). */
  hold?: number;
}

export interface AnimSpec {
  view?: 'side' | 'front';
  viewBox?: [number, number, number, number];
  frames: Keyframe[];
  props?: Prop[];
  hl?: FigSeg[];
  ground?: boolean;
  /** Cuadro a usar como imagen fija (por defecto 1). */
  thumb?: number;
}
