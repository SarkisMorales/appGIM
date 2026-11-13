import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractGtin, expandUpcE, isInStoreCode, isValidGtin, lookupVariants } from '../src/lib/barcode.ts';
import { parseNutritionLabel } from '../src/lib/labelOcr.ts';
import { offToDraft, offToFood, tidyName } from '../src/lib/off.ts';
import { searchFoods } from '../src/lib/foodSearch.ts';
import { stem } from '../src/lib/search.ts';
import { FOODS } from '../src/data/foods.ts';

test('códigos de barras: GTIN, UPC-E, QR GS1, ITF-14 y códigos de balanza', () => {
  assert.ok(isValidGtin('7790895000997'));
  assert.ok(!isValidGtin('7790895000990'));
  assert.equal(expandUpcE('04963406'), '049000006346');
  assert.deepEqual(lookupVariants('04963406').slice(0, 2), ['04963406', '049000006346']);
  // QR nuevo de los envases (GS1 Digital Link), GS1-128 y lo que tipea un lector USB.
  assert.equal(extractGtin('https://id.gs1.org/01/07790895000997/10/ABC'), '7790895000997');
  assert.equal(extractGtin(']C1010779089500099717251231\u001d10ABC'), '7790895000997');
  assert.equal(extractGtin(' 7790895000997\n'), '7790895000997');
  assert.equal(extractGtin('https://example.com/menu'), null);
  // Caja ITF-14 → producto suelto.
  assert.ok(lookupVariants('17790895000994').includes('7790895000997'));
  assert.ok(isInStoreCode('2012345012349'));
  assert.ok(!isInStoreCode('7790895000997'));
});

test('Open Food Facts: datos por porción, nombres en mayúsculas y productos sin tabla', () => {
  const f = offToFood({ code: '1', product_name: 'GALLETITAS DE AGUA', serving_size: '30 g', nutriments: { 'energy-kcal_serving': 126, proteins_serving: 3, carbohydrates_serving: 21, fat_serving: 3.3 } })!;
  assert.equal(f.name, 'Galletitas de agua');
  assert.equal(f.kcal, 420);
  assert.equal(f.protein, 10);
  // kJ cargados como kcal: se corrige.
  const g = offToFood({ code: '2', product_name: 'Yogur', nutriments: { 'energy-kcal_100g': 1900, proteins_100g: 3.5, carbohydrates_100g: 12, fat_100g: 3 } })!;
  assert.ok(g.kcal < 120);
  // Sin nutrientes: no es "found", pero sí sirve para precargar el formulario.
  assert.equal(offToFood({ code: '3', product_name: 'Criollitas', nutriments: {} }), null);
  const d = offToDraft({ code: '3', product_name: 'Criollitas', brands: 'Bagley', serving_size: '30 g', serving_quantity: 30 }, '3');
  assert.equal(d.name, 'Criollitas');
  assert.equal(d.portion?.grams, 30);
  assert.equal(tidyName('LECHE ENTERA'), 'Leche entera');
});

test('lectura de etiquetas: rótulo clásico, tabla con columna 100 g y errores típicos del OCR', () => {
  const clasico = parseNutritionLabel(`INFORMACIÓN NUTRICIONAL
Porción 30 9 (6 galletitas)
Cantidad por porción %VD(*)
Valor energético 143 kcal = 601 kJ 7
Carbohidratos 20g 7
Proteínas 249 3
Grasas totales 5.99 11
Grasas saturadas 28g 13
Fibra alimentaria 0,6 g 2
Sodio 105 mg 4
(*) % Valores Diarios con base a una dieta de 2.000 kcal u 8.400 kJ.`);
  assert.equal(clasico.basis, 'porcion');
  assert.equal(clasico.portionG, 30);
  assert.equal(clasico.kcal, 143);
  assert.equal(clasico.protein, 2.4); // "249" = 2,4 g con la g leída como 9
  assert.equal(clasico.satFat, 2.8); // "28g" no puede superar a las grasas totales
  assert.equal(clasico.sodium, 105);

  const nueva = parseNutritionLabel(`Porción: 200 mi (1 vaso)
100 mi 200 mi %VD(*)
Valor energético (kcal) 61 122 6
Carbohidratos (9) 4,9 9,8 3
Proteínas (9) 31 6,2 8
Grasas totales (9) 32 6,4 12
Sodio (mg) 50 100 4`);
  assert.equal(nueva.basis, '100');
  assert.equal(nueva.unit, 'ml');
  assert.equal(nueva.kcal, 61);
  assert.equal(nueva.protein, 3.1); // coma perdida
  assert.equal(nueva.fat, 3.2);

  // Con posiciones: si falta el número de la columna 100 ml se calcula desde la porción.
  const w = (t: string, x: number) => ({ text: t, x0: x - 10, x1: x + 10 });
  const pos = parseNutritionLabel('', [
    [w('Porción:', 50), w('200', 120), w('ml', 150)],
    [w('100', 400), w('ml', 430), w('200', 600), w('ml', 630), w('%VD', 800)],
    [w('Valor', 50), w('energético', 120), w('(kcal)', 200), w('122', 610), w('6', 800)],
    [w('Proteínas', 60), w('(g)', 120), w('3,1', 410), w('6,2', 610), w('8', 800)],
  ]);
  assert.equal(pos.kcal, 61);
  assert.equal(pos.protein, 3.1);

  const us = parseNutritionLabel('Serving size 2/3 cup (55g)\nCalories 230\nTotal Fat 8g 10%\nTotal Carbohydrate 37g 13%\nProtein 3g');
  assert.equal(us.portionG, 55);
  assert.equal(us.kcal, 230);
  assert.equal(us.carbs, 37);
});

test('buscador: plurales, errores de tipeo y sinónimos regionales', () => {
  const first = (q: string) => searchFoods(FOODS, q, 5).map((f) => f.id);
  assert.equal(stem('huevos'), 'huevo');
  assert.equal(stem('limones'), 'limon');
  assert.equal(stem('nueces'), 'nuez');
  assert.ok(first('huevos').includes('huevo'));
  assert.ok(first('milaneza').some((id) => id.startsWith('milanesa')));
  assert.equal(first('aguacate')[0], 'palta');
  assert.equal(first('fresas')[0], 'frutillas');
  assert.ok(first('frijoles').some((id) => id.startsWith('porotos')));
  assert.ok(first('hot dog').includes('pancho'));
  // Sin coincidencias "aproximadas" si hay exactas: pechuga ≠ lechuga.
  assert.ok(!first('pechuga').includes('lechuga'));
  assert.ok(FOODS.length >= 500);
});
