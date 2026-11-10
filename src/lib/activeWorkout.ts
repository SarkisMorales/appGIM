import { useSyncExternalStore } from 'react';
import type { SetLog } from '../types.ts';

/**
 * Entrenamiento en curso: se guarda aparte en el teléfono para poder retomarlo
 * si se cierra la app, se recarga la página o tocás "atrás" sin querer.
 */
export interface ActiveWorkout {
  routineId: string;
  sessionId: string;
  title: string;
  idx: number;
  total: number;
  logs: Record<number, SetLog & { exId: string }>;
  startedAt: number;
  /** Milisegundos realmente entrenados (sin pausas ni tiempo fuera de la app). */
  elapsedMs: number;
  done: boolean;
  savedAt: number;
}

const KEY = 'appgim-workout-v1';
const MAX_AGE_MS = 12 * 3600 * 1000;
const listeners = new Set<() => void>();
let cache: ActiveWorkout | null | undefined;

function read(): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as ActiveWorkout;
    if (!w || typeof w.idx !== 'number' || !w.routineId || Date.now() - w.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return w;
  } catch {
    return null;
  }
}

export function loadActive(): ActiveWorkout | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function saveActive(w: Omit<ActiveWorkout, 'savedAt'>) {
  cache = { ...w, savedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* sin espacio: seguimos sin guardar */
  }
  listeners.forEach((l) => l());
}

export function clearActive() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada */
  }
  listeners.forEach((l) => l());
}

export function useActiveWorkout(): ActiveWorkout | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    loadActive,
    () => null,
  );
}

// Si venís del aviso "Retomar", el reproductor arranca directo donde lo dejaste.
let autoResume = false;
export const requestAutoResume = () => (autoResume = true);
export const takeAutoResume = () => {
  const v = autoResume;
  autoResume = false;
  return v;
};
