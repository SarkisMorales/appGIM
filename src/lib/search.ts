/** Normaliza para búsquedas: minúsculas, sin acentos ni signos. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Singular aproximado: "huevos" → "huevo", "limones" → "limon", "nueces" → "nuez". */
export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ces') && w.length > 4) return w.slice(0, -3) + 'z';
  if (w.endsWith('es') && w.length > 4 && /[lrnd]es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Distancia de edición (con transposición) acotada: devuelve max+1 si se pasa. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

export interface SearchOptions<T = unknown> {
  /** Sinónimos: palabra (normalizada y en singular) → alternativas. */
  synonyms?: Record<string, string[]>;
  /** Frases que se reemplazan antes de buscar ("hot dog" → "pancho"). */
  phrases?: [string, string][];
  /** Puntos extra por ítem (ej. lo que más registrás). */
  boost?: (item: T) => number;
}

interface PreparedQuery {
  q: string;
  words: string[][];
}

function prepare(query: string, o?: SearchOptions<never>): PreparedQuery {
  let q = norm(query);
  for (const [from, to] of o?.phrases ?? []) if (q.includes(from)) q = q.replace(from, to);
  const words = q
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const s = stem(w);
      const alts = new Set([s, ...(o?.synonyms?.[s] ?? []), ...(o?.synonyms?.[w] ?? [])].map((x) => stem(norm(x))));
      return [...alts];
    });
  return { q, words };
}

function scoreWord(alts: string[], nameWords: string[], name: string, tagWords: string[]): number {
  let best = 0;
  for (const w of alts) {
    const multi = w.includes(' ');
    if (multi) {
      if (name.includes(w)) best = Math.max(best, 4);
      else if (tagWords.join(' ').includes(w)) best = Math.max(best, 1.5);
      continue;
    }
    if (nameWords[0] === w) best = Math.max(best, 6.5);
    else if (nameWords[0]?.startsWith(w)) best = Math.max(best, 6);
    else if (nameWords.includes(w)) best = Math.max(best, 4.5);
    else if (nameWords.some((x) => x.startsWith(w))) best = Math.max(best, 4);
    else if (name.includes(w)) best = Math.max(best, 2);
    else if (tagWords.some((x) => x.startsWith(w))) best = Math.max(best, 1.5);
  }
  if (best) return best;
  // Errores de tipeo: "milaneza", "yogurth", "hamburgueza".
  const w = alts[0];
  if (w.length >= 4) {
    const max = w.length >= 7 ? 2 : 1;
    for (const x of [...nameWords, ...tagWords]) {
      const target = x.length > w.length + 1 ? x.slice(0, w.length) : x;
      // Puntaje fraccionario (x.25): marca que la coincidencia fue aproximada.
      if (target.length >= 3 && editDistance(w, target, max) <= max) return nameWords.includes(x) ? 1.25 : 0.25;
    }
  }
  return 0;
}

/** Puntaje: coincidencia al inicio > palabra completa > contiene > etiqueta > con error de tipeo. 0 = no coincide. */
export function matchScore(query: string | PreparedQuery, name: string, tags = '', o?: SearchOptions<never>): number {
  return scoreDetail(typeof query === 'string' ? prepare(query, o) : query, name, tags).score;
}

function scoreDetail(pq: PreparedQuery, name: string, tags: string): { score: number; fuzzy: boolean } {
  if (!pq.words.length) return { score: 0, fuzzy: false };
  const n = norm(name);
  const nameWords = n.split(' ').map(stem);
  const nStem = nameWords.join(' ');
  const tagWords = norm(tags).split(' ').filter(Boolean).map(stem);
  let score = 0;
  let fuzzy = false;
  for (const alts of pq.words) {
    const s = scoreWord(alts, nameWords, nStem, tagWords);
    if (!s) return { score: 0, fuzzy: false };
    if (s % 1 === 0.25) fuzzy = true;
    score += s;
  }
  if (n === pq.q || nStem === pq.words.map((a) => a[0]).join(' ')) score += 10;
  return { score: score - n.length / 100, fuzzy };
}

export function searchBy<T>(items: T[], query: string, getName: (t: T) => string, getTags?: (t: T) => string, limit = 40, o?: SearchOptions<T>): T[] {
  const pq = prepare(query, o);
  const scored: { item: T; s: number; fuzzy: boolean }[] = [];
  for (const it of items) {
    const d = scoreDetail(pq, getName(it), getTags?.(it) ?? '');
    if (d.score > 0) scored.push({ item: it, s: d.score + (o?.boost?.(it) ?? 0), fuzzy: d.fuzzy });
  }
  // Las coincidencias por error de tipeo solo se muestran si no hay coincidencias exactas.
  const exact = scored.filter((x) => !x.fuzzy);
  return (exact.length ? exact : scored)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}
