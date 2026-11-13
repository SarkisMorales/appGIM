/**
 * Utilidades para códigos de barras de productos (GTIN: EAN-13, EAN-8, UPC-A, UPC-E, ITF-14, GS1).
 * Sirven para entender lo que leyó la cámara (o un lector USB/Bluetooth) y buscarlo en las bases
 * de productos con todas sus variantes posibles.
 */

/** Dígito verificador GS1 (módulo 10) de los primeros n-1 dígitos. */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48;
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

/** ¿Es un GTIN válido (8, 12, 13 o 14 dígitos con dígito verificador correcto)? */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/** UPC-E (8 dígitos, empieza con 0 o 1) → UPC-A (12 dígitos). */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if (last <= '2') body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === '3') body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === '4') body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  const upcA = ns + body + check;
  return isValidGtin(upcA) ? upcA : null;
}

/**
 * Extrae el GTIN de lo que devuelve el lector:
 * - números sueltos (EAN/UPC/ITF-14),
 * - QR con "GS1 Digital Link" (https://…/01/07791234567890…), que ya traen muchos envases nuevos,
 * - códigos GS1-128 / DataBar / DataMatrix con identificador (01),
 * - lo que tipea un lector físico (puede traer espacios, prefijos de simbología o un Enter).
 */
export function extractGtin(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  // GS1 Digital Link (QR nuevos de los envases).
  const link = s.match(/\/01\/(\d{8,14})(?:[/?#]|$)/);
  if (link) return normalizeGtin(link[1]);
  const gtinParam = s.match(/[?&](?:gtin|ean|barcode|code)=(\d{8,14})\b/i);
  if (gtinParam) return normalizeGtin(gtinParam[1]);
  // Prefijo de simbología (]C1, ]e0, ]d2, ]Q3) y separadores FNC1/GS.
  s = s.replace(/^\][A-Za-z]\d/, '').replace(/[\u001dè]/g, '|');
  // Formato legible "(01)07791234567890(17)…".
  const hri = s.match(/\(01\)\s*(\d{14})/);
  if (hri) return normalizeGtin(hri[1]);
  // Cadena GS1 sin paréntesis: "0107791234567890…".
  if (/^01\d{14}/.test(s) && s.replace(/\D/g, '').length > 14) return normalizeGtin(s.slice(2, 16));
  const digits = s.replace(/[\s-]/g, '');
  if (/^\d+$/.test(digits)) return normalizeGtin(digits);
  return null;
}

/** Deja el código en su forma más común (13 dígitos si es posible), sin perder información. */
export function normalizeGtin(digits: string): string | null {
  const d = digits.replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0')) return isValidGtin(d) ? d.slice(1) : null;
  if ([8, 12, 13, 14].includes(d.length)) return d;
  // Algunos lectores omiten el cero inicial de un EAN-13/UPC.
  if (d.length === 11 && isValidGtin('0' + d)) return '0' + d;
  return null;
}

/** Códigos de uso interno del súper (balanza de fiambrería, carnicería, verdulería): no figuran en ninguna base. */
export function isInStoreCode(code: string): boolean {
  if (code.length === 13) return code[0] === '2';
  if (code.length === 12) return code[0] === '2' || code[0] === '4';
  if (code.length === 8) return code[0] === '2';
  return false;
}

/** Libros (ISBN) y publicaciones: no son alimentos. */
export function isBookCode(code: string): boolean {
  return code.length === 13 && /^(978|979|977)/.test(code);
}

/**
 * Variantes a probar en las bases de datos, en orden de probabilidad.
 * Open Food Facts normaliza 12↔13 dígitos, pero no UPC-E ni cajas ITF-14 con indicador.
 */
export function lookupVariants(code: string): string[] {
  const out: string[] = [];
  const push = (c: string | null | undefined) => {
    if (c && !out.includes(c)) out.push(c);
  };
  push(code);
  if (code.length === 13 && code.startsWith('0')) push(code.slice(1));
  if (code.length === 12) push('0' + code);
  if (code.length === 8) {
    const a = expandUpcE(code);
    push(a);
    if (a) push('0' + a);
  }
  if (code.length === 14) {
    // Caja (ITF-14 / GTIN-14 con indicador 1–8): el producto suelto suele tener el mismo número sin el indicador.
    const inner = code.slice(1, 13);
    push(inner + gs1CheckDigit(inner));
    if (inner.startsWith('0')) push(inner.slice(1) + gs1CheckDigit(inner.slice(1)));
  }
  return out;
}
