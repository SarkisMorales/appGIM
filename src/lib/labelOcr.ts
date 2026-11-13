/**
 * Lectura de la tabla nutricional de un envase a partir de una foto.
 * - OCR: Tesseract.js (gratis, corre en el teléfono; se descarga la primera vez que se usa).
 * - Parser: entiende rótulos del Mercosur ("Valor energético 143 kcal = 601 kJ", "Proteínas 2,4 g"),
 *   tablas nuevas con columnas "100 g | porción | %VD" y etiquetas en inglés ("Total Fat 8g").
 * El resultado siempre se muestra para revisar antes de guardar.
 */

export interface LabelValues {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  satFat?: number;
  /** mg */
  sodium?: number;
}

export interface LabelResult extends LabelValues {
  /** Los valores están expresados cada 100 g/ml o por porción. */
  basis: '100' | 'porcion';
  portionG?: number;
  portionLabel?: string;
  unit?: 'g' | 'ml';
  /** Cuántos nutrientes se pudieron leer. */
  found: number;
  warning?: string;
}

type Key = keyof LabelValues;

/** Orden importa: primero los más específicos (saturadas antes que grasas totales). */
const NUTRIENTS: { key: Key; rx: RegExp; not?: RegExp }[] = [
  { key: 'kcal', rx: /valor energetic|energia|calorias|calories|energy|\bkcal\b/, not: /dieta|diet\b|valores diarios|daily value|base a|from fat/ },
  { key: 'satFat', rx: /saturad|saturated/ },
  { key: 'sugar', rx: /azucar|sugars?\b/, not: /anadid|added|incl/ },
  { key: 'fiber', rx: /fibra|fiber|fibre/ },
  { key: 'sodium', rx: /sodio|sodium/ },
  { key: 'protein', rx: /protein/ },
  { key: 'carbs', rx: /carbohidrat|hidratos de carbono|carbohydrat|glucidos|\bh\.?\s?de\s?c\b/ },
  { key: 'fat', rx: /grasas? totales?|grasa total|total fat|lipidos|^\s*grasas?\b|^\s*fat\b|\bgrasas?\s*\(g\)/, not: /saturad|trans|mono|poli|saturated/ },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[|¦]/g, ' ')
    // Confusiones típicas del OCR dentro de números: "1o" → "10", "O,5" → "0,5".
    .replace(/(\d)[o](?=\d|\s*[.,]\d)/g, '$10')
    .replace(/\b[o](?=[.,]\d)/g, '0')
    .replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2')
    // Unidades mal leídas: "(9)" → "(g)", "200 mi" → "200 ml", "og" → "0 g", "30 9 (" → "30 g (".
    .replace(/\(9\)/g, '(g)')
    .replace(/(\d)\s?mi\b/g, '$1 ml')
    .replace(/\bog\b/g, '0 g')
    .replace(/(\d) 9(?=\s*\()/g, '$1 g')
    .replace(/[ \t]+/g, ' ');
}

interface NumTok {
  v: number;
  unit: string;
  pos: number;
  /** Texto del número tal como lo leyó el OCR (para corregir comas perdidas o una "g" leída como 9). */
  txt: string;
  /** Posición horizontal en la foto (centro de la palabra), si el OCR la informó. */
  x?: number;
  /** Factor para pasar a la base elegida (ej. de "por porción" a "cada 100 g"). */
  scale?: number;
}

/** Números de una línea con su unidad (si la tiene). Ignora porcentajes (%VD). */
function numbersIn(s: string): NumTok[] {
  const out: NumTok[] = [];
  const rx = /(<\s*)?(\d+(?:\.\d+)?)\s*(?:(kcal|kj|mg|mcg|µg|grs|gr|g|ml)(?![a-z])|(%))?/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(s))) {
    if (m[4]) continue; // porcentaje (%VD)
    const unit = m[3] === 'gr' || m[3] === 'grs' ? 'g' : (m[3] ?? '');
    out.push({ v: m[1] ? 0 : parseFloat(m[2]), unit, pos: m.index + (m[1]?.length ?? 0), txt: m[1] ? '0' : m[2] });
  }
  return out;
}

/** Palabra leída por el OCR con su posición horizontal. */
export interface OcrWord {
  text: string;
  x0: number;
  x1: number;
}

interface Row {
  text: string;
  /** Centro horizontal de la palabra que contiene el carácter `pos` (si hay posiciones). */
  xAt?: (pos: number) => number | undefined;
}

function rowsFromText(raw: string): Row[] {
  return normalize(raw)
    .split(/\n+/)
    .map((l) => ({ text: l.trim() }))
    .filter((r) => r.text);
}

function rowsFromWords(lines: OcrWord[][]): Row[] {
  const rows: Row[] = [];
  for (const words of lines) {
    const parts: string[] = [];
    const spans: { a: number; b: number; x: number }[] = [];
    let at = 0;
    for (const w of words) {
      const t = normalize(w.text).trim();
      if (!t) continue;
      spans.push({ a: at, b: at + t.length, x: (w.x0 + w.x1) / 2 });
      parts.push(t);
      at += t.length + 1;
    }
    // Arreglos entre palabras que no cambian el largo del texto: "30 9 (6 galletitas)" → "30 g (…".
    const text = parts.join(' ').replace(/(\d) 9(?= \()/g, '$1 g');
    if (text) rows.push({ text, xAt: (pos) => spans.find((s) => pos >= s.a && pos < s.b)?.x });
  }
  return rows;
}

type Layout = { cols: number; idx100: number; idxPor: number; x100?: number; xPor?: number; xVd?: number };

/** Busca la fila de encabezado para saber si hay columna "cada 100 g", "por porción" o ambas (y dónde está cada una). */
function detectLayout(rows: Row[], portionG?: number): Layout {
  for (const r of rows) {
    const l = r.text;
    // La línea "Porción 100 g" no es un encabezado de columnas.
    if (/(porcion|serving size|racion)[^0-9\n]{0,20}\d/.test(l)) continue;
    const has100 = l.search(/\b100\s*(g|gr|ml|grs)\b|por 100|cada 100|per 100/);
    if (has100 < 0) continue;
    let por = l.search(/porci|serving|racion|\bunidad/);
    if (por < 0 && portionG) {
      const m = l.slice(has100 + 5).search(new RegExp(`\\b${String(portionG).replace('.', '\\.')}\\s*(g|ml)`));
      if (m >= 0) por = has100 + 5 + m;
    }
    const vd = l.search(/%?\s?v\.?\s?d|%/);
    const x100 = r.xAt?.(l.indexOf('100', has100));
    const xPor = por >= 0 ? r.xAt?.(por) : undefined;
    const xVd = vd >= 0 ? r.xAt?.(vd) : undefined;
    if (por < 0) return { cols: 1, idx100: 0, idxPor: -1, x100, xVd };
    return { ...(has100 < por ? { cols: 2, idx100: 0, idxPor: 1 } : { cols: 2, idx100: 1, idxPor: 0 }), x100, xPor, xVd };
  }
  return { cols: 1, idx100: -1, idxPor: 0 };
}

/**
 * Elige el número de la columna que nos interesa. Con posiciones: el más cercano a la columna "100 g";
 * si en esa fila no se leyó, usa el de la columna "por porción" convertido a 100 g.
 */
function pickToken(nums: NumTok[], layout: Layout, portionG?: number): NumTok {
  const useIdx = layout.idx100 >= 0 ? layout.idx100 : layout.idxPor;
  const byIdx = nums[Math.min(useIdx, nums.length - 1)];
  if (layout.x100 == null || nums.some((n) => n.x == null)) return byIdx;
  const cols = [
    { id: '100', x: layout.x100 },
    ...(layout.xPor != null ? [{ id: 'por', x: layout.xPor }] : []),
    ...(layout.xVd != null ? [{ id: 'vd', x: layout.xVd }] : []),
  ];
  const nearest = (t: NumTok) => cols.reduce((a, c) => (Math.abs(c.x - t.x!) < Math.abs(a.x - t.x!) ? c : a)).id;
  const dist = (t: NumTok, x: number) => Math.abs(t.x! - x);
  const in100 = nums.filter((t) => nearest(t) === '100').sort((a, b) => dist(a, layout.x100!) - dist(b, layout.x100!))[0];
  if (in100) return in100;
  if (layout.xPor != null && portionG) {
    const inPor = nums.filter((t) => nearest(t) === 'por').sort((a, b) => dist(a, layout.xPor!) - dist(b, layout.xPor!))[0];
    if (inPor) return { ...inPor, scale: 100 / portionG };
  }
  return byIdx;
}

function findPortion(text: string): { g?: number; label?: string; unit?: 'g' | 'ml' } {
  const m = text.match(/(?:porcion|serving size|tamano de la porcion|racion)[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*(g|gr|grs|ml|cc)\b([^\n]{0,40})/);
  if (m) {
    const g = parseFloat(m[1]);
    const extra = m[3].match(/\(([^)]{2,30})\)?/)?.[1]?.replace(/[,;.]+$/, '');
    if (g > 0 && g < 2000) return { g, label: extra ? `1 porción (${extra.trim()})` : undefined, unit: m[2] === 'ml' || m[2] === 'cc' ? 'ml' : 'g' };
  }
  const us = text.match(/serving size[^\n(]*\((\d+(?:\.\d+)?)\s*(g|ml)\)/);
  if (us) return { g: parseFloat(us[1]), unit: us[2] as 'g' | 'ml' };
  return {};
}

/**
 * Lecturas alternativas de un número con los errores típicos del OCR:
 * - coma perdida: "31" → 3,1
 * - la "g" de la unidad leída como 9: "249" → 2,4 g; "5.99" → 5,9 g
 * Cada alternativa tiene una penalidad; se elige la combinación que hace cerrar las calorías.
 */
function candidates(t: NumTok): { v: number; pen: number }[] {
  const k = t.scale ?? 1;
  const out = [{ v: t.v * k, pen: 0 }];
  if ((t.unit && t.unit !== 'g') || t.txt === '0') return out;
  const add = (txt: string, pen: number) => {
    const v = parseFloat(txt) * k;
    if (Number.isFinite(v) && !out.some((o) => Math.abs(o.v - v) < 1e-9)) out.push({ v, pen });
  };
  const noDot = !t.txt.includes('.');
  if (noDot && t.txt.length >= 2) add(t.txt.slice(0, -1) + '.' + t.txt.slice(-1), 1);
  if (!t.unit && t.txt.length >= 2 && t.txt.endsWith('9')) {
    const d = t.txt.slice(0, -1);
    add(d, 1);
    if (!d.includes('.') && d.length >= 2) add(d.slice(0, -1) + '.' + d.slice(-1), 2);
  }
  return out;
}

function fixDigits(vals: LabelValues, toks: Partial<Record<Key, NumTok>>, limit: number) {
  const macro: ('protein' | 'carbs' | 'fat')[] = ['protein', 'carbs', 'fat'];
  const opts = macro.map((k) => (toks[k] && toks[k]!.unit !== 'mg' ? candidates(toks[k]!) : vals[k] != null ? [{ v: vals[k]!, pen: 0 }] : [{ v: NaN, pen: 0 }]));
  let best = { cost: Infinity, v: [NaN, NaN, NaN] };
  for (const p of opts[0])
    for (const c of opts[1])
      for (const f of opts[2]) {
        const vs = [p.v, c.v, f.v];
        const known = vs.filter((x) => Number.isFinite(x));
        const sum = known.reduce((a, b) => a + b, 0);
        let cost = p.pen + c.pen + f.pen;
        if (sum > limit) cost += 50;
        if (vals.kcal && known.length === 3) {
          const atw = 4 * p.v + 4 * c.v + 9 * f.v;
          cost += (Math.abs(vals.kcal - atw) / Math.max(vals.kcal, 40)) * 12;
        }
        if (cost < best.cost) best = { cost, v: vs };
      }
  macro.forEach((k, i) => {
    if (Number.isFinite(best.v[i])) vals[k] = Math.round(best.v[i] * 10) / 10;
  });
  // Sub-nutrientes: no pueden superar a su total.
  const pick = (k: 'sugar' | 'satFat' | 'fiber', max: number) => {
    const t = toks[k];
    if (!t || t.unit === 'mg') return;
    const ok = candidates(t)
      .filter((c) => c.v <= max + 0.05)
      .sort((a, b) => a.pen - b.pen)[0];
    // Si ninguna lectura es posible (ej. saturadas > grasas totales) preferimos dejarlo vacío.
    if (ok) vals[k] = Math.round(ok.v * 10) / 10;
    else delete vals[k];
  };
  pick('sugar', vals.carbs ?? limit);
  pick('satFat', vals.fat ?? limit);
  pick('fiber', Math.min(limit * 0.5, 60));
}

/**
 * Interpreta el texto de una tabla nutricional. Si se pasan las palabras con su posición (OCR),
 * asigna cada número a su columna aunque falte alguno en la fila.
 */
export function parseNutritionLabel(raw: string, wordLines?: OcrWord[][]): LabelResult {
  const rows = wordLines?.length ? rowsFromWords(wordLines) : rowsFromText(raw);
  const text = wordLines?.length ? rows.map((r) => r.text).join('\n') : normalize(raw);
  const portion = findPortion(text);
  const layout = detectLayout(rows, portion.g);
  const vals: LabelValues = {};
  const toks: Partial<Record<Key, NumTok>> = {};

  for (const row of rows) {
    const line = row.text;
    if (/porcion(es)? por envase|servings per/.test(line)) continue;
    for (const n of NUTRIENTS) {
      if (vals[n.key] != null) continue;
      const hit = line.match(n.rx);
      if (!hit || (n.not && n.not.test(line))) continue;
      // Un renglón por nutriente: no seguir buscando otros en la misma línea.
      const restAt = (hit.index ?? 0) + hit[0].length;
      let nums = numbersIn(line.slice(restAt)).map((t) => ({ ...t, x: row.xAt?.(t.pos + restAt) }));
      if (n.key === 'kcal') {
        const unitInName = /\(kcal\)|kcal\)/.test(line.slice(0, restAt + 8));
        const kcal = nums.filter((x) => x.unit === 'kcal');
        const kj = nums.filter((x) => x.unit === 'kj');
        if (kcal.length) nums = kcal;
        else if (kj.length && !unitInName) nums = kj.map((x) => ({ ...x, v: x.v / 4.184 }));
        else nums = nums.filter((x) => x.unit !== 'kj');
      } else {
        const withUnit = nums.filter((x) => x.unit && x.unit !== 'kcal' && x.unit !== 'kj');
        if (withUnit.length) nums = withUnit;
      }
      if (!nums.length) break;
      const tok = pickToken(nums, layout, portion.g);
      toks[n.key] = tok;
      let v = tok.v * (tok.scale ?? 1);
      if (n.key === 'sodium') {
        if (tok.unit === 'g') v *= 1000;
        else if (tok.unit === 'mcg' || tok.unit === 'µg') v /= 1000;
      } else if (tok.unit === 'mg') v /= 1000;
      vals[n.key] = Math.round(v * 10) / 10;
      break;
    }
  }

  const limit = layout.idx100 >= 0 ? 100 : portion.g ? portion.g * 1.05 : 1000;
  fixDigits(vals, toks, limit);
  const found = Object.values(vals).filter((v) => v != null).length;
  const macroKcal = (vals.protein ?? 0) * 4 + (vals.carbs ?? 0) * 4 + (vals.fat ?? 0) * 9;
  let warning: string | undefined;
  if (vals.kcal == null && macroKcal > 0) {
    vals.kcal = Math.round(macroKcal);
    warning = 'No leímos las calorías: las calculamos con los macros.';
  } else if (vals.kcal && macroKcal > 0 && Math.abs(macroKcal - vals.kcal) / vals.kcal > 0.3) {
    warning = 'Algún número puede estar mal leído: las calorías no coinciden con los macros.';
  }
  if (vals.kcal != null) vals.kcal = Math.round(vals.kcal);
  return {
    ...vals,
    basis: layout.idx100 >= 0 ? '100' : 'porcion',
    portionG: portion.g,
    portionLabel: portion.label,
    unit: portion.unit,
    found,
    warning,
  };
}

// ---------------- Limpieza de la imagen ----------------

/** Umbral adaptativo (Bradley): oscuro si es bastante más oscuro que su entorno. Sirve con sombras y luz despareja. */
function adaptiveThreshold(gray: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 40));
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
      const v = gray[y * w + x];
      if (v < (sum / ((x1 - x0) * (y1 - y0))) * 0.85 && v < 200) dark[y * w + x] = 1;
    }
  }
  return dark;
}

/**
 * Inclinación de la foto: prueba ángulos de −7° a 7° y se queda con el que deja los renglones
 * (o columnas, si vertical) más "nítidos" en la proyección. Devuelve la pendiente (tan del ángulo).
 */
function estimateSlope(dark: Uint8Array, w: number, h: number, vertical: boolean): number {
  const f = Math.max(1, Math.ceil(Math.max(w, h) / 700));
  const sw = Math.floor(w / f);
  const sh = Math.floor(h / f);
  const pts: number[] = [];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (dark[y * f * w + x * f]) pts.push(x, y);
  let best = 0;
  let bestScore = -1;
  const len = (vertical ? sw : sh) + 2 * Math.max(sw, sh);
  const hist = new Float64Array(len);
  for (let a = -7; a <= 7.001; a += 0.25) {
    const t = Math.tan((a * Math.PI) / 180);
    hist.fill(0);
    const off = Math.max(sw, sh);
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      const k = vertical ? Math.round(x - y * t) + off : Math.round(y - x * t) + off;
      if (k >= 0 && k < len) hist[k]++;
    }
    let score = 0;
    for (let i = 0; i < len; i++) score += hist[i] * hist[i];
    if (score > bestScore + 1e-6) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Endereza con dos cizallas (aprox. una rotación para ángulos chicos): renglones y columnas quedan rectos. */
function deskew(m: Uint8Array, w: number, h: number): { m: Uint8Array; w: number; h: number } {
  const tH = estimateSlope(m, w, h, false);
  let cur = m;
  let cw = w;
  let ch = h;
  if (Math.abs(tH) > 0.002) {
    const extra = Math.ceil(Math.abs(tH) * w);
    const nh = h + extra;
    const out = new Uint8Array(w * nh);
    const off = tH > 0 ? extra : 0;
    for (let x = 0; x < w; x++) {
      const dy = Math.round(-x * tH) + off;
      for (let y = 0; y < h; y++) if (cur[y * w + x]) out[(y + dy) * w + x] = 1;
    }
    cur = out;
    ch = nh;
  }
  const tV = estimateSlope(cur, cw, ch, true);
  if (Math.abs(tV) > 0.002) {
    const extra = Math.ceil(Math.abs(tV) * ch);
    const nw = cw + extra;
    const out = new Uint8Array(nw * ch);
    const off = tV > 0 ? extra : 0;
    for (let y = 0; y < ch; y++) {
      const dx = Math.round(-y * tV) + off;
      for (let x = 0; x < cw; x++) if (cur[y * cw + x]) out[y * nw + x + dx] = 1;
    }
    cur = out;
    cw = nw;
  }
  return { m: cur, w: cw, h: ch };
}

/** Borra los trazos largos horizontales y verticales (líneas de la tabla) sin borrar las letras que las tocan. */
function removeLines(m: Uint8Array, w: number, h: number) {
  const out = m.slice();
  const minH = Math.max(60, Math.round(w * 0.07));
  const minV = Math.max(60, Math.round(h * 0.06));
  const at = (x: number, y: number) => (y >= 0 && y < h && m[y * w + x] ? 1 : 0);
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && (at(x, y) || at(x, y - 1) || at(x, y + 1));
      if (on && start < 0) start = x;
      else if (!on && start >= 0) {
        if (x - start >= minH) for (let i = start; i < x; i++) out[y * w + i] = 0;
        start = -1;
      }
    }
  }
  const atx = (x: number, y: number) => (x >= 0 && x < w && m[y * w + x] ? 1 : 0);
  for (let x = 0; x < w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && (atx(x, y) || atx(x - 1, y) || atx(x + 1, y));
      if (on && start < 0) start = y;
      else if (!on && start >= 0) {
        if (y - start >= minV) for (let i = start; i < y; i++) out[i * w + x] = 0;
        start = -1;
      }
    }
  }
  return out;
}

/**
 * Deja solo letras y números en negro sobre blanco, derechos:
 * 1) umbral adaptativo, 2) endereza la foto, 3) borra las líneas de la tabla,
 * 4) descarta manchas grandes (fondos, dibujos), restos de líneas y puntitos.
 * Las tablas con bordes son justamente lo que más confunde al OCR.
 */
export function cleanForOcr(gray: Uint8ClampedArray, w0: number, h0: number): { px: Uint8ClampedArray; w: number; h: number } {
  const d = deskew(adaptiveThreshold(gray, w0, h0), w0, h0);
  const { w, h } = d;
  const dark = removeLines(d.m, w, h);
  const label = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const px = new Uint8ClampedArray(w * h).fill(255);
  const pixels: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!dark[i] || label[i]) continue;
    let sp = 0;
    stack[sp++] = i;
    label[i] = 1;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    pixels.length = 0;
    while (sp) {
      const p = stack[--sp];
      pixels.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (dark[q] && !label[q]) {
            label[q] = 1;
            stack[sp++] = q;
          }
        }
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const tooBig = bw > w * 0.16 || bh > h * 0.16;
    const lineBit = (bw > bh * 8 && bw > w * 0.025) || (bh > bw * 8 && bh > h * 0.025);
    if (!tooBig && !lineBit && pixels.length >= 6) for (const p of pixels) px[p] = 0;
  }
  return { px, w, h };
}

// ---------------- OCR ----------------

type TBlock = { paragraphs: { lines: { words: { text: string; bbox: { x0: number; x1: number } }[] }[] }[] };
type TWorker = { recognize: (img: HTMLCanvasElement, opts?: object, out?: object) => Promise<{ data: { text: string; blocks?: TBlock[] | null } }>; setParameters: (p: Record<string, string>) => Promise<unknown>; terminate: () => Promise<unknown> };
let workerPromise: Promise<TWorker> | null = null;
let progressCb: ((p: number, status: string) => void) | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function getWorker(): Promise<TWorker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const base = new URL('ocr/', document.baseURI).href;
    const w = (await createWorker('spa', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base,
      langPath: base + 'lang',
      logger: (m: { progress: number; status: string }) => progressCb?.(m.progress, m.status),
    })) as unknown as TWorker;
    await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    return w;
  })();
  workerPromise.catch(() => (workerPromise = null));
  return workerPromise;
}

/** Escala la foto a un tamaño cómodo para el OCR y la pasa a grises. */
async function toGray(file: Blob): Promise<{ gray: Uint8ClampedArray; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const max = Math.max(bmp.width, bmp.height);
  const k = Math.min(2.5, 2800 / max);
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return { gray, w, h };
}

function toCanvas(px: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0, j = 0; j < px.length; i += 4, j++) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = px[j];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export async function readLabelPhoto(file: Blob, onProgress?: (p: number, status: string) => void): Promise<{ text: string; result: LabelResult }> {
  progressCb = onProgress;
  clearTimeout(idleTimer);
  try {
    const [w, img] = await Promise.all([getWorker(), toGray(file)]);
    const run = async (gray: Uint8ClampedArray) => {
      const c = cleanForOcr(gray, img.w, img.h);
      const { data } = await w.recognize(toCanvas(c.px, c.w, c.h), {}, { text: true, blocks: true });
      try {
        if (localStorage.getItem('appgim-debug-ocr')) console.info('[OCR]\n' + data.text);
      } catch {
        /* sin storage */
      }
      const lines: OcrWord[][] = [];
      for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) lines.push(l.words.map((wd) => ({ text: wd.text, x0: wd.bbox.x0, x1: wd.bbox.x1 })));
      return { text: data.text, result: parseNutritionLabel(data.text, lines) };
    };
    let best = await run(img.gray);
    // Etiquetas con letras claras sobre fondo oscuro: probamos con la imagen invertida.
    if (best.result.found < 3) {
      const inv = img.gray.map((v) => 255 - v);
      const alt = await run(inv);
      if (alt.result.found > best.result.found) best = alt;
    }
    return best;
  } finally {
    progressCb = undefined;
    // Liberamos memoria si no se vuelve a usar en un rato.
    idleTimer = setTimeout(() => {
      workerPromise?.then((w) => w.terminate()).catch(() => {});
      workerPromise = null;
    }, 120_000);
  }
}
