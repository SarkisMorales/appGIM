import type { Food } from '../types.ts';
import { searchBy } from './search.ts';
import { FOOD_PHRASES, FOOD_SYNONYMS } from '../data/foodSynonyms.ts';

/**
 * Buscador de alimentos: tolera plurales, errores de tipeo y nombres de otros países
 * ("aguacate" → palta, "frijoles" → porotos). Lo que registrás seguido aparece primero.
 */
export function searchFoods(foods: Food[], q: string, limit = 40, boost?: Map<string, number>): Food[] {
  return searchBy(foods, q, (f) => `${f.name} ${f.brand ?? ''}`, (f) => f.tags ?? '', limit, {
    synonyms: FOOD_SYNONYMS,
    phrases: FOOD_PHRASES,
    boost: boost ? (f) => boost.get(f.id) ?? 0 : undefined,
  });
}
