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

/** Puntaje simple: coincidencia al inicio > palabra completa > contiene. 0 = no coincide. */
export function matchScore(query: string, name: string, tags = ''): number {
  const q = norm(query);
  if (!q) return 0;
  const n = norm(name);
  const t = norm(tags);
  const words = q.split(' ');
  let score = 0;
  for (const w of words) {
    if (n.startsWith(w)) score += 6;
    else if (n.split(' ').some((x) => x.startsWith(w))) score += 4;
    else if (n.includes(w)) score += 2;
    else if (t.split(' ').some((x) => x.startsWith(w))) score += 1.5;
    else return 0;
  }
  if (n === q) score += 10;
  return score - n.length / 100;
}

export function searchBy<T>(items: T[], query: string, getName: (t: T) => string, getTags?: (t: T) => string, limit = 40): T[] {
  const scored: { item: T; s: number }[] = [];
  for (const it of items) {
    const s = matchScore(query, getName(it), getTags?.(it));
    if (s > 0) scored.push({ item: it, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.item);
}
