import type { Level, Place } from '../types.ts';

/** Rutina sugerida según nivel, lugar y días disponibles. */
export function recommendRoutine(level: Level, place: Place, days: number): string {
  if (level === 'principiante') {
    if (place === 'gimnasio') return days >= 3 ? 'maquinas-inicio' : 'maquinas-inicio';
    return days <= 2 ? 'siete-minutos' : 'inicio-casa';
  }
  if (level === 'intermedio') {
    if (place === 'gimnasio') return days >= 4 ? 'torso-pierna' : 'ppl';
    return days >= 3 ? 'mancuernas-casa' : 'hiit-40-20';
  }
  if (place === 'gimnasio') return days >= 6 ? 'ppl-6' : days >= 4 ? 'phul' : 'wendler-531';
  return 'calistenia-avanzada';
}
