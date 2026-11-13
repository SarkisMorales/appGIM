import type { MealId } from '../types.ts';

/**
 * Comidas base para armar el plan semanal. Las cantidades son de referencia:
 * el plan las ajusta a tus calorías y a tu proteína del día.
 *  - p:   aporta la proteína principal (se ajusta para llegar a tu proteína).
 *  - u:   se cuenta por unidades (se redondea a media unidad).
 *  - fix: no se ajusta (ensaladas, infusiones, aceite).
 */
export interface TplItem {
  id: string;
  g: number;
  p?: boolean;
  u?: boolean;
  fix?: boolean;
}

export interface MealTpl {
  id: string;
  meal: MealId;
  name: string;
  veg?: boolean;
  items: TplItem[];
}

export const MEAL_TEMPLATES: MealTpl[] = [
  // ---------------- Desayuno ----------------
  { id: 'd1', meal: 'desayuno', veg: true, name: 'Tostadas con queso y banana', items: [{ id: 'pan-integral', g: 56, u: true }, { id: 'queso-untable-light', g: 40, p: true }, { id: 'banana', g: 118, u: true }, { id: 'cafe-con-leche', g: 250, fix: true }] },
  { id: 'd2', meal: 'desayuno', veg: true, name: 'Avena con leche y banana', items: [{ id: 'avena', g: 50 }, { id: 'leche-descremada', g: 250, p: true }, { id: 'banana', g: 118, u: true }, { id: 'mantequilla-mani', g: 16 }] },
  { id: 'd3', meal: 'desayuno', veg: true, name: 'Huevos revueltos con tostadas', items: [{ id: 'huevo-revuelto', g: 110, p: true }, { id: 'pan-integral', g: 56, u: true }, { id: 'naranja', g: 140, u: true }, { id: 'cafe', g: 150, fix: true }] },
  { id: 'd4', meal: 'desayuno', veg: true, name: 'Yogur griego con granola y frutillas', items: [{ id: 'yogur-griego', g: 200, p: true }, { id: 'granola', g: 40 }, { id: 'frutillas', g: 150, fix: true }] },
  { id: 'd5', meal: 'desayuno', name: 'Tostado de jamón y queso', items: [{ id: 'pan-lactal', g: 50, fix: true }, { id: 'jamon-cocido', g: 40, p: true }, { id: 'queso-maquina', g: 30, p: true }, { id: 'cafe-con-leche', g: 250, fix: true }, { id: 'mandarina', g: 88, u: true }] },
  { id: 'd6', meal: 'desayuno', veg: true, name: 'Licuado de banana con avena', items: [{ id: 'licuado-banana', g: 300, p: true }, { id: 'avena', g: 30 }, { id: 'almendras', g: 20 }] },
  { id: 'd7', meal: 'desayuno', veg: true, name: 'Yogur proteico con granola y frutos rojos', items: [{ id: 'yogur-proteico', g: 170, p: true }, { id: 'granola', g: 30 }, { id: 'frutos-rojos', g: 100, fix: true }] },
  { id: 'd8', meal: 'desayuno', veg: true, name: 'Omelette de claras con tostadas', items: [{ id: 'omelette-claras', g: 110, p: true, u: true }, { id: 'pan-integral', g: 56, u: true }, { id: 'naranja', g: 140, u: true }, { id: 'cafe', g: 150, fix: true }] },
  { id: 'd9', meal: 'desayuno', veg: true, name: 'Panqueques de avena y banana con yogur', items: [{ id: 'panqueques-avena', g: 180, u: true }, { id: 'yogur-griego', g: 100, p: true }] },

  // ---------------- Almuerzo ----------------
  { id: 'a1', meal: 'almuerzo', name: 'Pollo con arroz y ensalada', items: [{ id: 'pollo-pechuga', g: 150, p: true }, { id: 'arroz-blanco', g: 160 }, { id: 'ensalada-mixta', g: 200, fix: true }, { id: 'aceite-oliva', g: 10, fix: true }] },
  { id: 'a2', meal: 'almuerzo', name: 'Milanesa al horno con puré', items: [{ id: 'milanesa-carne-horno', g: 130, p: true, u: true }, { id: 'pure-papa', g: 210 }, { id: 'ensalada-mixta', g: 150, fix: true }] },
  { id: 'a3', meal: 'almuerzo', name: 'Fideos con bolognesa', items: [{ id: 'fideos-bolognesa', g: 350, p: true }, { id: 'queso-rallado', g: 10, fix: true }, { id: 'ensalada-mixta', g: 150, fix: true }] },
  { id: 'a4', meal: 'almuerzo', name: 'Guiso de lentejas', items: [{ id: 'guiso-lentejas', g: 350, p: true }, { id: 'pan-frances', g: 40, u: true }, { id: 'naranja', g: 140, u: true }] },
  { id: 'a5', meal: 'almuerzo', name: 'Merluza con papas al horno', items: [{ id: 'merluza', g: 180, p: true }, { id: 'papa-horno', g: 200 }, { id: 'ensalada-mixta', g: 200, fix: true }, { id: 'aceite-oliva', g: 10, fix: true }] },
  { id: 'a6', meal: 'almuerzo', name: 'Wrap de pollo y fruta', items: [{ id: 'wrap-pollo', g: 220, p: true, u: true }, { id: 'manzana', g: 182, u: true }] },
  { id: 'a7', meal: 'almuerzo', name: 'Carne magra con batata y brócoli', items: [{ id: 'nalga', g: 150, p: true }, { id: 'batata', g: 200 }, { id: 'brocoli', g: 150, fix: true }, { id: 'aceite-oliva', g: 10, fix: true }] },
  { id: 'a8', meal: 'almuerzo', name: 'Ensalada de atún, arroz y huevo', items: [{ id: 'atun-agua', g: 120, p: true }, { id: 'arroz-integral', g: 160 }, { id: 'huevo-duro', g: 50, u: true, p: true }, { id: 'tomate', g: 120, fix: true }, { id: 'aceite-oliva', g: 10, fix: true }] },
  { id: 'a9', meal: 'almuerzo', veg: true, name: 'Milanesa de soja con puré', items: [{ id: 'milanesa-soja', g: 150, p: true }, { id: 'pure-papa', g: 210 }, { id: 'ensalada-mixta', g: 150, fix: true }] },
  { id: 'a10', meal: 'almuerzo', veg: true, name: 'Garbanzos con arroz y verduras', items: [{ id: 'garbanzos', g: 165, p: true }, { id: 'arroz-integral', g: 160 }, { id: 'verduras-salteadas', g: 200, fix: true }] },
  { id: 'a11', meal: 'almuerzo', veg: true, name: 'Ravioles con salsa de tomate', items: [{ id: 'ravioles', g: 250, p: true }, { id: 'salsa-tomate', g: 125, fix: true }, { id: 'queso-rallado', g: 10, fix: true }, { id: 'ensalada-mixta', g: 150, fix: true }] },
  { id: 'a12', meal: 'almuerzo', veg: true, name: 'Tofu salteado con quinoa', items: [{ id: 'tofu', g: 150, p: true }, { id: 'quinoa', g: 185 }, { id: 'verduras-salteadas', g: 250, fix: true }] },
  { id: 'a13', meal: 'almuerzo', name: 'Wok de pollo con arroz', items: [{ id: 'wok-pollo', g: 350, p: true }, { id: 'arroz-blanco', g: 160 }] },
  { id: 'a14', meal: 'almuerzo', name: 'Colita de cuadril con papas y ensalada', items: [{ id: 'colita-cuadril', g: 180, p: true }, { id: 'papa-hervida', g: 200 }, { id: 'ensalada-mixta', g: 200, fix: true }] },
  { id: 'a15', meal: 'almuerzo', veg: true, name: 'Ensalada de quinoa con huevo', items: [{ id: 'ensalada-quinoa', g: 300 }, { id: 'huevo-duro', g: 100, p: true, u: true }] },

  // ---------------- Merienda ----------------
  { id: 'm1', meal: 'merienda', veg: true, name: 'Yogur con banana y nueces', items: [{ id: 'yogur-descremado', g: 190, p: true }, { id: 'banana', g: 118, u: true }, { id: 'nueces', g: 15 }] },
  { id: 'm2', meal: 'merienda', veg: true, name: 'Mate con tostadas y queso', items: [{ id: 'mate', g: 500, fix: true }, { id: 'tostadas', g: 44, u: true }, { id: 'queso-untable-light', g: 40, p: true }, { id: 'mermelada-light', g: 20, fix: true }] },
  { id: 'm3', meal: 'merienda', name: 'Café con leche y tostado', items: [{ id: 'cafe-con-leche', g: 250, fix: true }, { id: 'tostado', g: 130, p: true, u: true }] },
  { id: 'm4', meal: 'merienda', veg: true, name: 'Licuado proteico de banana', items: [{ id: 'whey', g: 30, p: true }, { id: 'leche-descremada', g: 250 }, { id: 'banana', g: 118, u: true }] },
  { id: 'm5', meal: 'merienda', veg: true, name: 'Manzana con maní', items: [{ id: 'manzana', g: 182, u: true }, { id: 'mani', g: 28, p: true }] },
  { id: 'm6', meal: 'merienda', veg: true, name: 'Cottage con frutillas', items: [{ id: 'cottage', g: 150, p: true }, { id: 'frutillas', g: 150, fix: true }, { id: 'galletas-arroz', g: 18, u: true }] },
  { id: 'm7', meal: 'merienda', veg: true, name: 'Batido de proteína con banana', items: [{ id: 'batido-proteina-leche', g: 280, p: true }, { id: 'banana', g: 118, u: true }] },
  { id: 'm8', meal: 'merienda', veg: true, name: 'Tostadas con cuartirolo y tomate', items: [{ id: 'pan-integral', g: 56, u: true }, { id: 'cuartirolo', g: 50, p: true }, { id: 'tomate', g: 100, fix: true }, { id: 'te', g: 240, fix: true }] },

  // ---------------- Cena ----------------
  { id: 'c1', meal: 'cena', veg: true, name: 'Tarta de verdura con ensalada', items: [{ id: 'tarta-verdura', g: 250, p: true }, { id: 'ensalada-mixta', g: 200, fix: true }, { id: 'aceite-oliva', g: 5, fix: true }] },
  { id: 'c2', meal: 'cena', veg: true, name: 'Omelette con ensalada y pan', items: [{ id: 'omelette', g: 180, p: true }, { id: 'ensalada-mixta', g: 200, fix: true }, { id: 'pan-integral', g: 56, u: true }] },
  { id: 'c3', meal: 'cena', name: 'Salmón con calabaza', items: [{ id: 'salmon', g: 150, p: true }, { id: 'calabaza', g: 250 }, { id: 'ensalada-mixta', g: 150, fix: true }, { id: 'aceite-oliva', g: 5, fix: true }] },
  { id: 'c4', meal: 'cena', name: 'Pollo con verduras salteadas y arroz', items: [{ id: 'pollo-muslo', g: 190, p: true }, { id: 'verduras-salteadas', g: 250, fix: true }, { id: 'arroz-integral', g: 120 }] },
  { id: 'c5', meal: 'cena', veg: true, name: 'Tortilla de papas con ensalada', items: [{ id: 'tortilla-papas', g: 250, p: true }, { id: 'ensalada-mixta', g: 200, fix: true }, { id: 'tomate', g: 120, fix: true }] },
  { id: 'c6', meal: 'cena', name: 'Pastel de papa', items: [{ id: 'pastel-papa', g: 300, p: true }, { id: 'ensalada-mixta', g: 150, fix: true }] },
  { id: 'c7', meal: 'cena', name: 'Hamburguesa casera con papas al horno', items: [{ id: 'hamburguesa-casera', g: 90, p: true, u: true }, { id: 'pan-hamburguesa', g: 45, u: true }, { id: 'tomate', g: 100, fix: true }, { id: 'lechuga', g: 50, fix: true }, { id: 'papa-horno', g: 150 }] },
  { id: 'c8', meal: 'cena', name: 'Lomo con puré y ensalada', items: [{ id: 'lomo', g: 150, p: true }, { id: 'pure-papa', g: 180 }, { id: 'ensalada-mixta', g: 200, fix: true }] },
  { id: 'c9', meal: 'cena', veg: true, name: 'Polenta con salsa y queso', items: [{ id: 'polenta', g: 300 }, { id: 'salsa-tomate', g: 125, fix: true }, { id: 'queso-cremoso', g: 40, p: true }, { id: 'ensalada-mixta', g: 150, fix: true }] },
  { id: 'c10', meal: 'cena', veg: true, name: 'Medallones de legumbres con batata', items: [{ id: 'medallon-legumbres', g: 160, p: true, u: true }, { id: 'batata', g: 150 }, { id: 'ensalada-mixta', g: 200, fix: true }] },
  { id: 'c11', meal: 'cena', name: 'Merluza al horno con verduras y papa', items: [{ id: 'merluza', g: 180, p: true }, { id: 'verduras-vapor', g: 250, fix: true }, { id: 'papa-hervida', g: 170 }] },
  { id: 'c12', meal: 'cena', name: 'Tarta de atún con ensalada', items: [{ id: 'tarta-atun', g: 200, p: true }, { id: 'ensalada-mixta', g: 200, fix: true }] },
  { id: 'c13', meal: 'cena', veg: true, name: 'Revuelto de verduras con huevos', items: [{ id: 'huevo-revuelto', g: 165, p: true }, { id: 'verduras-salteadas', g: 250, fix: true }, { id: 'pan-integral', g: 28, u: true }] },

  // ---------------- Colación proteica (solo si falta proteína) ----------------
  { id: 's1', meal: 'snacks', veg: true, name: 'Yogur griego', items: [{ id: 'yogur-griego', g: 200, p: true }] },
  { id: 's2', meal: 'snacks', veg: true, name: 'Licuado de proteína', items: [{ id: 'whey', g: 30, p: true }, { id: 'leche-descremada', g: 200, p: true }] },
  { id: 's3', meal: 'snacks', veg: true, name: 'Huevos duros', items: [{ id: 'huevo-duro', g: 100, p: true, u: true }] },
  { id: 's4', meal: 'snacks', name: 'Atún con galletas de arroz', items: [{ id: 'atun-agua', g: 120, p: true }, { id: 'galletas-arroz', g: 18, u: true }] },
  { id: 's5', meal: 'snacks', veg: true, name: 'Yogur alto en proteínas', items: [{ id: 'yogur-proteico', g: 250, p: true }] },
];
