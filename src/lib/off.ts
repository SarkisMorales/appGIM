import type { Food } from '../types.ts';
import { extractGtin, lookupVariants } from './barcode.ts';

/**
 * Open Food Facts: base de datos abierta y gratuita de productos (licencia ODbL).
 * - Búsqueda: /cgi/search.pl (permite CORS). A veces devuelve 503 en horas pico: reintentamos en otro servidor.
 * - Código de barras: /api/v2/product/{code}.json
 */
const FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'product_name_en',
  'product_name_pt',
  'generic_name_es',
  'generic_name',
  'abbreviated_product_name',
  'brands',
  'nutriments',
  'nutrition_data_per',
  'serving_size',
  'serving_quantity',
  'image_front_small_url',
  'image_small_url',
  'quantity',
  'nutriscore_grade',
  'nova_group',
].join(',');

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

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  product_name_en?: string;
  product_name_pt?: string;
  generic_name_es?: string;
  generic_name?: string;
  abbreviated_product_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutrition_data_per?: string;
  image_front_small_url?: string;
  image_small_url?: string;
  nutriscore_grade?: string;
  nova_group?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

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

/** "GALLETITAS DULCES SABOR VAINILLA" → "Galletitas dulces sabor vainilla" (sin tocar nombres que ya vienen bien). */
export function tidyName(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function productName(p: OffProduct): string {
  const n = [p.product_name_es, p.product_name, p.product_name_en, p.product_name_pt, p.generic_name_es, p.generic_name, p.abbreviated_product_name].find((x) => x && x.trim().length > 1);
  return n ? tidyName(n) : '';
}

function isLiquidProduct(p: OffProduct): boolean {
  return /\d\s*(ml|cc|cl|dl|l|lt|lts|litros?)\b/i.test(p.quantity || '') || /\d\s*(ml|cc|cl)\b/i.test(p.serving_size || '');
}

type Nutr = { kcal?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number; satFat?: number; sodium?: number };

/** Lee los nutrientes con un sufijo (_100g o _serving). Calorías desde kcal o, si falta, desde kJ. */
function readNutr(n: Record<string, unknown>, suffix: '_100g' | '_serving'): Nutr {
  let kcal = num(n[`energy-kcal${suffix}`]);
  if (kcal == null) {
    const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`]);
    if (kj != null) kcal = kj / 4.184;
  }
  const sodium = num(n[`sodium${suffix}`]) ?? (num(n[`salt${suffix}`]) != null ? (num(n[`salt${suffix}`]) as number) / 2.5 : undefined);
  return {
    kcal,
    protein: num(n[`proteins${suffix}`]),
    carbs: num(n[`carbohydrates${suffix}`]),
    fat: num(n[`fat${suffix}`]),
    fiber: num(n[`fiber${suffix}`]),
    sugar: num(n[`sugars${suffix}`]),
    satFat: num(n[`saturated-fat${suffix}`]),
    sodium: sodium != null ? sodium * 1000 : undefined, // mg
  };
}

const hasCore = (v: Nutr) => v.kcal != null || v.protein != null || v.carbs != null || v.fat != null;

function scaleNutr(v: Nutr, k: number): Nutr {
  const o: Nutr = {};
  for (const key of Object.keys(v) as (keyof Nutr)[]) if (v[key] != null) o[key] = (v[key] as number) * k;
  return o;
}

/** Tamaño de la porción en g/ml, desde serving_quantity o desde el texto "30 g (3 galletitas)". */
function servingGrams(p: OffProduct): number | undefined {
  const s = num(p.serving_quantity);
  if (s && s > 0 && s < 2000) return s;
  const q = parseQuantity(p.serving_size);
  return q && q > 0 && q < 2000 ? q : undefined;
}

/** Valores por 100 g/ml: directos o convertidos desde "por porción" (muchos productos solo cargan eso). */
function per100Nutr(p: OffProduct): Nutr | null {
  const n = p.nutriments || {};
  const v100 = readNutr(n, '_100g');
  if (hasCore(v100)) return v100;
  const sv = readNutr(n, '_serving');
  const g = servingGrams(p);
  if (hasCore(sv) && g) return scaleNutr(sv, 100 / g);
  return null;
}

function portionsFor(p: OffProduct, liquid: boolean): Food['portions'] {
  const portions = [] as Food['portions'];
  const serving = servingGrams(p);
  if (serving) portions.push({ label: `1 porción (${p.serving_size?.trim() || serving + (liquid ? ' ml' : ' g')})`, grams: Math.round(serving * 10) / 10 });
  const pkg = parseQuantity(p.quantity);
  if (pkg && pkg > 0 && pkg <= 5000 && pkg !== serving) portions.push({ label: `Envase completo (${p.quantity})`, grams: pkg });
  return portions;
}

/** Producto de Open Food Facts → alimento listo para registrar. null si no tiene datos nutricionales usables. */
export function offToFood(p: OffProduct): Food | null {
  const v = per100Nutr(p);
  if (!v) return null;
  let kcal = v.kcal;
  const macroKcal = (v.protein ?? 0) * 4 + (v.carbs ?? 0) * 4 + (v.fat ?? 0) * 9;
  // Calorías imposibles (> 900 por 100 g) suelen ser kJ cargados como kcal.
  if (kcal != null && kcal > 930) kcal = macroKcal > 0 ? macroKcal : kcal / 4.184;
  if (kcal == null) kcal = macroKcal;
  const liquid = isLiquidProduct(p);
  const brand = p.brands?.split(',')[0]?.trim() || undefined;
  const code = (p.code || '').replace(/\D/g, '');
  const name = productName(p) || (brand ? `Producto ${brand}` : `Producto ${code}`);
  const notes: string[] = [];
  if (v.protein == null || v.carbs == null || v.fat == null) notes.push('Al producto le faltan algunos macronutrientes.');
  const grams = (v.protein ?? 0) + (v.carbs ?? 0) + (v.fat ?? 0);
  if (grams > 105) notes.push('Los valores parecen tener un error de carga.');
  if (kcal > 0 && macroKcal > 0 && Math.abs(macroKcal - kcal) / kcal > 0.35) notes.push('Las calorías no coinciden con los macros: verificá con el envase.');
  const nova = num(p.nova_group);
  const grade = (p.nutriscore_grade || '').toLowerCase();
  return {
    id: `off-${code}`,
    name,
    brand: brand ? tidyName(brand) : undefined,
    category: 'producto',
    kcal: Math.round(kcal),
    protein: r1(v.protein ?? 0),
    carbs: r1(v.carbs ?? 0),
    fat: r1(v.fat ?? 0),
    fiber: r1(v.fiber ?? 0),
    sugar: v.sugar != null ? r1(v.sugar) : undefined,
    satFat: v.satFat != null ? r1(v.satFat) : undefined,
    sodium: v.sodium != null ? Math.round(v.sodium) : undefined,
    unit: liquid ? 'ml' : 'g',
    portions: portionsFor(p, liquid),
    source: 'off',
    barcode: code || undefined,
    image: p.image_front_small_url || p.image_small_url,
    nutriscore: /^[a-e]$/.test(grade) ? grade : undefined,
    nova: nova && nova >= 1 && nova <= 4 ? nova : undefined,
    dataNote: notes.length ? notes.join(' ') : undefined,
  };
}

/** Lo que se sabe de un producto que está en la base pero sin tabla nutricional (para precargar el formulario). */
export interface ProductDraft {
  barcode: string;
  name?: string;
  brand?: string;
  image?: string;
  unit: 'g' | 'ml';
  portion?: { label: string; grams: number };
}

export type ProductLookup = { kind: 'found'; food: Food } | { kind: 'partial'; draft: ProductDraft } | { kind: 'notfound'; code: string };

export function offToDraft(p: OffProduct, code: string): ProductDraft {
  const liquid = isLiquidProduct(p);
  const serving = servingGrams(p);
  const brand = p.brands?.split(',')[0]?.trim();
  return {
    barcode: code,
    name: productName(p) || undefined,
    brand: brand ? tidyName(brand) : undefined,
    image: p.image_front_small_url || p.image_small_url,
    unit: liquid ? 'ml' : 'g',
    // Solo la porción del rótulo: el envase entero no sirve para cargar la tabla (que viene por porción).
    portion: serving ? { label: `1 porción${p.serving_size ? ` (${p.serving_size.trim()})` : ''}`, grams: serving } : undefined,
  };
}

async function fetchJson(url: string, signal?: AbortSignal, tries = 2, timeoutMs = 9000): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
      if (res.status === 404) {
        // La API devuelve 404 con {status:0} para "no encontrado".
        try {
          return await res.json();
        } catch {
          return null;
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr;
}

function hostFor(country: string) {
  return country && country !== 'world' ? `https://${country}.openfoodfacts.org` : 'https://world.openfoodfacts.org';
}

/** Búsqueda por texto. Si el servidor está saturado (503) probamos otro servidor de la misma base. */
export async function searchOff(query: string, country = 'world', signal?: AbortSignal): Promise<Food[]> {
  const path = `/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=30&lc=es&fields=${FIELDS}`;
  const hosts = [...new Set([hostFor(country), 'https://world.openfoodfacts.org', 'https://ar.openfoodfacts.org'])];
  let data: any = null;
  let lastErr: unknown;
  for (const h of hosts) {
    try {
      data = await fetchJson(h + path, signal, 2);
      break;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  if (!data) throw lastErr ?? new Error('sin datos');
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

const lookupCache = new Map<string, ProductLookup>();

/**
 * Busca un código en Open Food Facts probando sus variantes (UPC-E, ITF-14, con/sin cero inicial).
 * - found: tiene datos nutricionales → se puede registrar directo.
 * - partial: el producto existe pero sin tabla → precargamos nombre/marca/porción para completarlo.
 * - notfound: no está en la base.
 * Lanza error solo si no hubo conexión.
 */
export async function lookupProduct(rawCode: string, signal?: AbortSignal): Promise<ProductLookup> {
  const code = extractGtin(rawCode) ?? rawCode.replace(/\D/g, '');
  if (lookupCache.has(code)) return lookupCache.get(code)!;
  let partial: ProductDraft | null = null;
  let answered = false;
  let lastErr: unknown;
  for (const v of lookupVariants(code)) {
    try {
      const data = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${v}.json?fields=${FIELDS}`, signal, 2);
      answered = true;
      if (!data || data.status === 0 || !data.product) continue;
      const p: OffProduct = { ...data.product, code: data.product.code || v };
      const food = offToFood(p);
      if (food) {
        const res: ProductLookup = { kind: 'found', food: { ...food, barcode: code } };
        lookupCache.set(code, res);
        return res;
      }
      partial ??= offToDraft(p, code);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  if (partial) return { kind: 'partial', draft: partial };
  if (!answered) throw lastErr ?? new Error('sin conexión');
  const res: ProductLookup = { kind: 'notfound', code };
  lookupCache.set(code, res);
  return res;
}

/** Compatibilidad: devuelve solo el alimento si tiene datos completos. */
export async function getOffProduct(barcode: string, signal?: AbortSignal): Promise<Food | null> {
  const r = await lookupProduct(barcode, signal);
  return r.kind === 'found' ? r.food : null;
}

/** Página del producto en Open Food Facts (para sumarlo o completarlo y que le sirva a todos). */
export function offContributeUrl(code: string) {
  return `https://world.openfoodfacts.org/product/${code}`;
}
