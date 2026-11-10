import type { Food } from '../types.ts';

/**
 * Open Food Facts: base de datos abierta y gratuita de productos (licencia ODbL).
 * - Búsqueda: /cgi/search.pl (permite CORS). Puede devolver 503 en horas pico: reintentamos y avisamos.
 * - Código de barras: /api/v2/product/{code}.json
 */
const FIELDS = 'code,product_name,product_name_es,generic_name_es,brands,nutriments,serving_size,serving_quantity,image_front_small_url,quantity';

export const OFF_COUNTRIES: { id: string; label: string }[] = [
  { id: 'world', label: 'Todos los países' },
  { id: 'ar', label: 'Argentina' },
  { id: 'uy', label: 'Uruguay' },
  { id: 'cl', label: 'Chile' },
  { id: 'py', label: 'Paraguay' },
  { id: 'bo', label: 'Bolivia' },
  { id: 'pe', label: 'Perú' },
  { id: 'co', label: 'Colombia' },
  { id: 'ec', label: 'Ecuador' },
  { id: 've', label: 'Venezuela' },
  { id: 'mx', label: 'México' },
  { id: 'es', label: 'España' },
  { id: 'us', label: 'Estados Unidos' },
];

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  generic_name_es?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  image_front_small_url?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Convierte el texto del envase a gramos o mililitros: "500 g", "1 kg", "1,5 L", "33 cl", "6 x 125 g".
 * Si no se entiende la unidad devuelve undefined (mejor no ofrecer la porción que ofrecer una equivocada).
 */
export function parseQuantity(q?: string): number | undefined {
  if (!q) return undefined;
  const s = q.toLowerCase().replace(/,/g, '.');
  const m = s.match(/(?:(\d+)\s*[x×*]\s*)?(\d+(?:\.\d+)?)\s*(kg|kilos?|g|gr|grs|gramos?|ml|cc|cl|dl|l|lt|lts|litros?)\b/);
  if (!m) return undefined;
  const n = parseFloat(m[2]);
  const u = m[3];
  const factor = /^k/.test(u) ? 1000 : /^(l|lt|lts|litros?)$/.test(u) ? 1000 : u === 'cl' ? 10 : u === 'dl' ? 100 : 1;
  const total = n * factor * (m[1] ? parseInt(m[1], 10) : 1);
  return Number.isFinite(total) ? Math.round(total) : undefined;
}

export function offToFood(p: OffProduct): Food | null {
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy_100g']) ?? num(n['energy-kj_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal == null && protein == null && carbs == null && fat == null) return null;
  const name = (p.product_name_es || p.product_name || p.generic_name_es || '').trim();
  if (!name) return null;
  const isLiquid = /\d\s*(ml|cc|cl|dl|l|lt|lts|litros?)\b/i.test(p.quantity || '') || /\d\s*ml\b/i.test(p.serving_size || '');
  const serving = num(p.serving_quantity);
  const portions = [] as Food['portions'];
  if (serving && serving > 0 && serving < 2000) portions.push({ label: `1 porción (${p.serving_size || serving + (isLiquid ? ' ml' : ' g')})`, grams: serving });
  const pkg = parseQuantity(p.quantity);
  if (pkg && pkg > 0 && pkg <= 5000 && pkg !== serving) portions.push({ label: `Envase completo (${p.quantity})`, grams: pkg });
  return {
    id: `off-${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    category: 'producto',
    kcal: Math.round(kcal ?? (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9),
    protein: Math.round((protein ?? 0) * 10) / 10,
    carbs: Math.round((carbs ?? 0) * 10) / 10,
    fat: Math.round((fat ?? 0) * 10) / 10,
    fiber: Math.round((num(n['fiber_100g']) ?? 0) * 10) / 10,
    sodium: num(n['sodium_100g']) != null ? Math.round((num(n['sodium_100g']) as number) * 1000) : undefined,
    unit: isLiquid ? 'ml' : 'g',
    portions,
    source: 'off',
    barcode: p.code,
    image: p.image_front_small_url,
  };
}

async function fetchJson(url: string, signal?: AbortSignal, tries = 2): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 900 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function searchOff(query: string, country = 'world', signal?: AbortSignal): Promise<Food[]> {
  const host = country && country !== 'world' ? `https://${country}.openfoodfacts.org` : 'https://world.openfoodfacts.org';
  const url = `${host}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&lc=es&fields=${FIELDS}`;
  const data = await fetchJson(url, signal);
  const products: OffProduct[] = data?.products || [];
  const out: Food[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const f = offToFood(p);
    if (f && !seen.has(f.id)) {
      seen.add(f.id);
      out.push(f);
    }
  }
  return out;
}

export async function getOffProduct(barcode: string, signal?: AbortSignal): Promise<Food | null> {
  const code = barcode.replace(/\D/g, '');
  if (!code) return null;
  const data = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, signal);
  if (!data || data.status === 0 || !data.product) return null;
  return offToFood({ ...data.product, code });
}
