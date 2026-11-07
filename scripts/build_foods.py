"""Genera src/data/foods.ts a partir de USDA FoodData Central (SR Legacy) + estimaciones
para platos típicos rioplatenses que USDA no cubre.

Uso: OUT_DIR=<dir con usda_cache.json> python3 build_foods.py <salida.ts>
Valores por 100 g (o 100 ml en bebidas). Porciones en gramos.
"""
import json, os, re, sys

cache = json.load(open(os.path.join(os.environ['OUT_DIR'], 'usda_cache.json')))

MISSING = []
def U(pat):
    rx = re.compile(pat, re.I)
    hits = [(fid, v) for fid, v in cache.items() if rx.search(v['d'])]
    if not hits:
        MISSING.append(pat)
        return ('usda', ('0', {'d': 'MISSING', 'kcal': 0, 'p': 0, 'c': 0, 'f': 0}))
    hits.sort(key=lambda h: len(h[1]['d']))
    return ('usda', hits[0])

def M(kcal, p, c, f, fib=0, sug=None, na=None):
    return ('est', {'kcal': kcal, 'p': p, 'c': c, 'f': f, 'fib': fib, 'sug': sug, 'na': na})

# (id, nombre, categoría, fuente, porciones [(etiqueta, g)], alias, unidad)
F = [
 # ---------------- Carnes y aves
 ('pollo-pechuga', 'Pechuga de pollo a la plancha', 'carnes', U(r'^Chicken, broilers or fryers, breast, meat only, cooked, roasted$'), [('1 filet mediano', 150), ('1 filet chico', 100)], 'pollo plancha grillado', 'g'),
 ('pollo-muslo', 'Muslo de pollo sin piel (al horno)', 'carnes', U(r'^Chicken, broilers or fryers, thigh, meat only, cooked, roasted$'), [('1 muslo', 95)], 'pollo pata', 'g'),
 ('pollo-pata-muslo-piel', 'Pata muslo de pollo con piel (al horno)', 'carnes', U(r'^Chicken, broilers or fryers, leg, meat and skin, cooked, roasted$'), [('1 pata muslo', 180)], 'pollo horno', 'g'),
 ('carne-picada-comun', 'Carne picada común (cocida)', 'carnes', U(r'^Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned$'), [('1 porción', 120)], 'carne molida', 'g'),
 ('carne-picada-magra', 'Carne picada especial magra (cocida)', 'carnes', U(r'^Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned$'), [('1 porción', 120)], 'carne molida magra', 'g'),
 ('hamburguesa-casera', 'Medallón de hamburguesa casera (cocido)', 'carnes', U(r'^Beef, ground, 80% lean meat / 20% fat, patty, cooked, broiled$'), [('1 medallón', 90), ('1 medallón grande', 150)], 'burger', 'g'),
 ('bife-chorizo', 'Bife de chorizo (a la parrilla)', 'carnes', U(r'^Beef, short loin, top loin, steak, separable lean and fat, trimmed to 1/8" fat, choice, cooked, grilled$'), [('1 bife', 250), ('1 porción', 150)], 'bife carne vacuna', 'g'),
 ('lomo', 'Lomo vacuno (a la plancha)', 'carnes', U(r'^Beef, tenderloin, steak, separable lean only, trimmed to 1/8" fat, all grades, cooked, broiled$'), [('1 medallón', 150)], 'carne magra', 'g'),
 ('nalga', 'Nalga / peceto (cocida)', 'carnes', U(r'^Beef, round, top round, steak, separable lean only, trimmed to 1/8" fat, choice, cooked, broiled$'), [('1 porción', 150)], 'carne magra cuadrada', 'g'),
 ('vacio', 'Vacío (a la parrilla)', 'carnes', U(r'^Beef, flank, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled$'), [('1 porción', 200)], 'asado', 'g'),
 ('asado-tira', 'Asado de tira (a la parrilla)', 'carnes', M(330, 24, 0, 26), [('1 tira', 250), ('1 porción', 200)], 'asado costilla parrilla', 'g'),
 ('cerdo-solomillo', 'Solomillo / lomo de cerdo', 'carnes', U(r'^Pork, fresh, loin, tenderloin, separable lean and fat, cooked, roasted$'), [('1 porción', 150)], 'cerdo', 'g'),
 ('bondiola', 'Bondiola de cerdo (cocida)', 'carnes', U(r'^Pork, fresh, shoulder, blade, boston \(steaks\), separable lean and fat, cooked, broiled$'), [('1 porción', 150)], 'cerdo', 'g'),
 ('chorizo', 'Chorizo parrillero', 'carnes', M(330, 16, 2, 29), [('1 chorizo', 100)], 'embutido parrilla', 'g'),
 ('morcilla', 'Morcilla', 'carnes', U(r'^Blood sausage$'), [('1 morcilla', 90)], 'embutido parrilla', 'g'),
 ('jamon-cocido', 'Jamón cocido', 'carnes', U(r'^Ham, sliced, regular \(approximately 11% fat\)$'), [('1 feta', 20)], 'fiambre', 'g'),
 ('jamon-crudo', 'Jamón crudo', 'carnes', M(250, 28, 0.5, 15), [('1 feta', 15)], 'fiambre serrano', 'g'),
 ('salame', 'Salame', 'carnes', U(r'^Salami, dry or hard, pork$'), [('1 feta', 8), ('5 fetas', 40)], 'fiambre salamin', 'g'),
 ('salchicha', 'Salchicha (tipo viena)', 'carnes', U(r'^Frankfurter, meat and poultry, cooked, boiled$'), [('1 salchicha', 40)], 'pancho', 'g'),
 ('pavo-pechuga', 'Pechuga de pavo (cocida)', 'carnes', U(r'^Turkey, whole, breast, meat only, cooked, roasted$'), [('1 porción', 120), ('1 feta fiambre', 20)], 'pavita', 'g'),
 ('milanesa-carne-frita', 'Milanesa de carne frita', 'carnes', M(270, 20, 14, 15, 0.8), [('1 milanesa mediana', 130), ('1 milanesa grande', 200)], 'mila rebozada', 'g'),
 ('milanesa-carne-horno', 'Milanesa de carne al horno', 'carnes', M(215, 22, 15, 7.5, 0.9), [('1 milanesa mediana', 130), ('1 milanesa grande', 200)], 'mila', 'g'),
 ('milanesa-pollo-horno', 'Milanesa de pollo al horno', 'carnes', M(200, 23, 14, 6, 0.9), [('1 milanesa mediana', 130)], 'suprema mila', 'g'),
 ('milanesa-pollo-frita', 'Milanesa de pollo frita', 'carnes', M(255, 21, 14, 13, 0.8), [('1 milanesa mediana', 130)], 'suprema mila', 'g'),
 ('higado', 'Hígado vacuno (cocido)', 'carnes', U(r'^Beef, variety meats and by-products, liver, cooked, pan-fried$'), [('1 bife', 120)], 'achuras', 'g'),
 # ---------------- Pescados
 ('merluza', 'Merluza / pescado blanco (cocido)', 'pescados', U(r'^Fish, cod, Atlantic, cooked, dry heat$'), [('1 filet', 150)], 'pescado filet abadejo', 'g'),
 ('salmon', 'Salmón rosado (cocido)', 'pescados', U(r'^Fish, salmon, Atlantic, farmed, cooked, dry heat$'), [('1 porción', 150)], 'pescado', 'g'),
 ('atun-agua', 'Atún al natural (escurrido)', 'pescados', U(r'^Fish, tuna, light, canned in water, without salt, drained solids$'), [('1 lata', 120), ('1/2 lata', 60)], 'lata', 'g'),
 ('atun-aceite', 'Atún en aceite (escurrido)', 'pescados', U(r'^Fish, tuna, light, canned in oil, drained solids$'), [('1 lata', 120)], 'lata', 'g'),
 ('sardinas', 'Sardinas en aceite', 'pescados', U(r'^Fish, sardine, Atlantic, canned in oil, drained solids with bone$'), [('1 lata', 85)], 'lata', 'g'),
 ('langostinos', 'Langostinos / camarones (cocidos)', 'pescados', U(r'^Crustaceans, shrimp, cooked$'), [('1 porción', 120)], 'mariscos', 'g'),
 ('rabas', 'Rabas (calamar frito)', 'pescados', U(r'^Mollusks, squid, mixed species, cooked, fried$'), [('1 porción', 150)], 'calamar', 'g'),
 # ---------------- Huevos
 ('huevo', 'Huevo entero', 'huevos', U(r'^Egg, whole, raw, fresh$'), [('1 huevo', 50), ('2 huevos', 100)], 'huevo crudo', 'g'),
 ('huevo-duro', 'Huevo duro', 'huevos', U(r'^Egg, whole, cooked, hard-boiled$'), [('1 huevo', 50)], 'huevo hervido', 'g'),
 ('huevo-frito', 'Huevo frito', 'huevos', U(r'^Egg, whole, cooked, fried$'), [('1 huevo', 46)], 'huevo', 'g'),
 ('huevo-revuelto', 'Huevos revueltos', 'huevos', U(r'^Egg, whole, cooked, scrambled$'), [('2 huevos', 110)], 'revuelto', 'g'),
 ('clara', 'Clara de huevo', 'huevos', U(r'^Egg, white, raw, fresh$'), [('1 clara', 33), ('3 claras', 100)], 'claras', 'g'),
 ('omelette', 'Omelette de queso', 'huevos', M(190, 13, 1.5, 15), [('1 omelette (2 huevos)', 130)], 'tortilla huevo', 'g'),
 # ---------------- Lácteos
 ('leche-entera', 'Leche entera', 'lacteos', U(r'^Milk, whole, 3.25% milkfat, with added vitamin D$'), [('1 vaso', 200), ('1 taza', 250), ('1 chorrito', 30)], 'leche', 'ml'),
 ('leche-parcial', 'Leche parcialmente descremada', 'lacteos', U(r'^Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D$'), [('1 vaso', 200), ('1 taza', 250)], 'leche', 'ml'),
 ('leche-descremada', 'Leche descremada', 'lacteos', U(r'^Milk, nonfat, fluid, with added vitamin A and vitamin D \(fat free or skim\)$'), [('1 vaso', 200), ('1 taza', 250)], 'leche', 'ml'),
 ('leche-chocolatada', 'Leche chocolatada', 'lacteos', U(r'^Milk, chocolate, fluid, commercial, whole, with added vitamin A and vitamin D$'), [('1 vaso', 200), ('1 caja', 250)], 'cindor', 'ml'),
 ('yogur-entero', 'Yogur natural entero', 'lacteos', U(r'^Yogurt, plain, whole milk$'), [('1 pote', 190), ('1 taza', 245)], 'yogurt', 'g'),
 ('yogur-descremado', 'Yogur natural descremado', 'lacteos', U(r'^Yogurt, plain, skim milk$'), [('1 pote', 190)], 'yogurt light', 'g'),
 ('yogur-frutado', 'Yogur con frutas / bebible', 'lacteos', U(r'^Yogurt, fruit, low fat,9 g protein/8 oz$'), [('1 pote', 190), ('1 vaso bebible', 200)], 'yogurt bebible', 'g'),
 ('yogur-griego', 'Yogur griego natural (descremado)', 'lacteos', U(r'^Yogurt, Greek, plain, nonfat'), [('1 pote', 170)], 'yogurt griego proteico', 'g'),
 ('queso-cremoso', 'Queso cremoso / port salut', 'lacteos', M(300, 19, 2, 24), [('1 porción', 30), ('1 cubo', 20)], 'queso', 'g'),
 ('muzzarella', 'Muzzarella', 'lacteos', U(r'^Cheese, mozzarella, whole milk$'), [('1 porción', 30), ('1 taza rallada', 110)], 'queso pizza', 'g'),
 ('queso-rallado', 'Queso rallado (tipo reggianito)', 'lacteos', U(r'^Cheese, parmesan, grated$'), [('1 cucharada', 6), ('1 cucharada colmada', 10)], 'parmesano', 'g'),
 ('queso-maquina', 'Queso de máquina / tybo / dambo', 'lacteos', U(r'^Cheese, gouda$'), [('1 feta', 15)], 'queso feta sandwich', 'g'),
 ('ricota', 'Ricota', 'lacteos', U(r'^Cheese, ricotta, whole milk$'), [('1 cucharada', 25), ('1/2 taza', 125)], 'ricotta', 'g'),
 ('ricota-light', 'Ricota descremada', 'lacteos', U(r'^Cheese, ricotta, part skim milk$'), [('1 cucharada', 25), ('1/2 taza', 125)], 'ricotta light', 'g'),
 ('queso-untable', 'Queso crema / untable', 'lacteos', U(r'^Cheese, cream$'), [('1 cucharada', 15)], 'casancrem philadelphia', 'g'),
 ('queso-untable-light', 'Queso untable light', 'lacteos', U(r'^Cheese, cream, low fat$'), [('1 cucharada', 15)], 'queso blanco light', 'g'),
 ('cottage', 'Queso cottage', 'lacteos', U(r'^Cheese, cottage, lowfat, 2% milkfat$'), [('1/2 taza', 113)], 'queso', 'g'),
 ('manteca', 'Manteca', 'lacteos', U(r'^Butter, salted$'), [('1 cucharadita', 5), ('1 cucharada', 14)], 'mantequilla', 'g'),
 ('crema-leche', 'Crema de leche', 'lacteos', U(r'^Cream, fluid, heavy whipping$'), [('1 cucharada', 15)], 'crema', 'ml'),
 ('dulce-de-leche', 'Dulce de leche', 'lacteos', U(r'^Dulce de Leche$'), [('1 cucharada', 20), ('1 cucharadita', 7)], 'ddl', 'g'),
 ('helado-crema', 'Helado de crema', 'dulces', U(r'^Ice creams, vanilla$'), [('1 bocha', 70), ('1/4 kg', 250)], 'helado', 'g'),
 ('helado-chocolate', 'Helado de chocolate', 'dulces', U(r'^Ice creams, chocolate$'), [('1 bocha', 70), ('1/4 kg', 250)], 'helado', 'g'),
 # ---------------- Panes, cereales y pastas
 ('pan-frances', 'Pan francés', 'cereales', U(r'^Bread, french or vienna \(includes sourdough\)$'), [('1 mignon', 40), ('1 flautita', 60), ('1 rodaja', 25)], 'pan blanco felipe', 'g'),
 ('pan-lactal', 'Pan lactal blanco', 'cereales', U(r'^Bread, white, commercially prepared \(includes soft bread crumbs\)$'), [('1 rebanada', 25), ('2 rebanadas', 50)], 'pan de molde', 'g'),
 ('pan-integral', 'Pan integral', 'cereales', U(r'^Bread, whole-wheat, commercially prepared$'), [('1 rebanada', 28), ('2 rebanadas', 56)], 'pan salvado', 'g'),
 ('tostadas', 'Tostadas de pan', 'cereales', U(r'^Bread, white, commercially prepared, toasted$'), [('1 tostada', 22)], 'pan tostado', 'g'),
 ('pan-hamburguesa', 'Pan de hamburguesa / pancho', 'cereales', U(r'^Rolls, hamburger or hotdog, plain$'), [('1 pan', 45)], 'pan', 'g'),
 ('galletitas-agua', 'Galletitas de agua', 'cereales', U(r'^Crackers, saltines \(includes oyster, soda, soup\)$'), [('1 galletita', 6), ('1 paquetito', 30)], 'criollitas crackers', 'g'),
 ('galletas-arroz', 'Galletas de arroz', 'cereales', U(r'^Snacks, rice cakes, brown rice, plain, unsalted$'), [('1 galleta', 9)], 'tostadas arroz', 'g'),
 ('avena', 'Avena arrollada', 'cereales', U(r'^Cereals, oats, regular and quick, not fortified, dry$'), [('1/2 taza', 40), ('1 cucharada', 8)], 'copos avena porridge', 'g'),
 ('granola', 'Granola', 'cereales', U(r'^Cereals ready-to-eat, granola, homemade$'), [('1/2 taza', 60), ('1 cucharada', 10)], 'cereal', 'g'),
 ('copos-maiz', 'Copos de maíz (sin azúcar)', 'cereales', U(r'^Cereals ready-to-eat, RALSTON Corn Flakes$'), [('1 taza', 30)], 'corn flakes cereal', 'g'),
 ('arroz-blanco', 'Arroz blanco (cocido)', 'cereales', U(r'^Rice, white, long-grain, regular, enriched, cooked$'), [('1 taza', 160), ('1 plato', 250)], 'arroz', 'g'),
 ('arroz-integral', 'Arroz integral (cocido)', 'cereales', U(r'^Rice, brown, long-grain, cooked'), [('1 taza', 160), ('1 plato', 250)], 'arroz', 'g'),
 ('fideos', 'Fideos / pasta (cocidos)', 'cereales', U(r'^Pasta, cooked, enriched, without added salt$'), [('1 taza', 140), ('1 plato', 250)], 'spaghetti tallarines tirabuzones', 'g'),
 ('fideos-integrales', 'Fideos integrales (cocidos)', 'cereales', U(r'^Pasta, whole-wheat, cooked'), [('1 taza', 140), ('1 plato', 250)], 'pasta', 'g'),
 ('fideos-secos', 'Fideos secos (crudos)', 'cereales', U(r'^Pasta, dry, enriched$'), [('1 porción', 80)], 'pasta cruda', 'g'),
 ('polenta', 'Polenta (cocida)', 'cereales', U(r'^Cereals, corn grits, white, regular and quick, enriched, cooked with water, without salt$'), [('1 plato', 250), ('1 taza', 240)], 'harina de maiz', 'g'),
 ('quinoa', 'Quinoa (cocida)', 'cereales', U(r'^Quinoa, cooked$'), [('1 taza', 185)], 'quinua', 'g'),
 ('harina', 'Harina de trigo 000', 'cereales', U(r'^Wheat flour, white, all-purpose, enriched, bleached$'), [('1 cucharada', 8), ('1 taza', 125)], 'harina', 'g'),
 ('tortilla-trigo', 'Tortilla de trigo (wrap)', 'cereales', U(r'^Tortillas, ready-to-bake or -fry, flour, refrigerated$'), [('1 tortilla', 45)], 'rapidita fajita wrap', 'g'),
 ('medialuna', 'Medialuna de manteca', 'cereales', U(r'^Croissants, butter$'), [('1 medialuna', 45)], 'croissant factura', 'g'),
 ('factura', 'Factura (con crema o dulce)', 'cereales', U(r'^Danish pastry, cheese$'), [('1 factura', 60)], 'bola de fraile vigilante', 'g'),
 ('papa-hervida', 'Papa hervida', 'cereales', U(r'^Potatoes, boiled, cooked without skin, flesh, without salt$'), [('1 papa mediana', 170), ('1 taza', 155)], 'papas', 'g'),
 ('papa-horno', 'Papa al horno (con cáscara)', 'cereales', U(r'^Potatoes, baked, flesh and skin, without salt$'), [('1 papa mediana', 170)], 'papas', 'g'),
 ('pure-papa', 'Puré de papas', 'cereales', U(r'^Potatoes, mashed, home-prepared, whole milk and margarine added$'), [('1 taza', 210), ('1 porción', 200)], 'pure', 'g'),
 ('papas-fritas', 'Papas fritas', 'cereales', U(r'^Fast foods, potato, french fried in vegetable oil$'), [('1 porción chica', 80), ('1 porción mediana', 120), ('1 porción grande', 160)], 'fritas', 'g'),
 ('batata', 'Batata (al horno)', 'cereales', U(r'^Sweet potato, cooked, baked in skin, flesh, without salt$'), [('1 batata mediana', 150)], 'camote boniato', 'g'),
 ('choclo', 'Choclo (cocido)', 'cereales', U(r'^Corn, sweet, yellow, cooked, boiled, drained, without salt$'), [('1 choclo', 100), ('1/2 taza granos', 80)], 'maiz elote', 'g'),
 ('mandioca', 'Mandioca (cocida)', 'cereales', M(160, 1.4, 38, 0.3, 1.8), [('1 porción', 150)], 'yuca', 'g'),
 # ---------------- Legumbres
 ('lentejas', 'Lentejas (cocidas)', 'legumbres', U(r'^Lentils, mature seeds, cooked, boiled, without salt$'), [('1 taza', 200), ('1/2 taza', 100)], 'legumbres', 'g'),
 ('garbanzos', 'Garbanzos (cocidos)', 'legumbres', U(r'^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt$'), [('1 taza', 165), ('1/2 taza', 82)], 'legumbres', 'g'),
 ('porotos-negros', 'Porotos negros (cocidos)', 'legumbres', U(r'^Beans, black, mature seeds, cooked, boiled, without salt$'), [('1 taza', 172)], 'frijoles', 'g'),
 ('porotos-alubia', 'Porotos alubia (cocidos)', 'legumbres', U(r'^Beans, white, mature seeds, cooked, boiled, without salt$'), [('1 taza', 179)], 'frijoles blancos', 'g'),
 ('arvejas', 'Arvejas (cocidas)', 'legumbres', U(r'^Peas, green, frozen, cooked, boiled, drained, without salt$'), [('1/2 taza', 80)], 'guisantes', 'g'),
 ('soja', 'Porotos de soja (cocidos)', 'legumbres', U(r'^Soybeans, mature cooked, boiled, without salt$'), [('1/2 taza', 86)], 'soya', 'g'),
 ('tofu', 'Tofu firme', 'legumbres', U(r'^Tofu, raw, firm, prepared with calcium sulfate$'), [('1 porción', 100)], 'soja', 'g'),
 ('hummus', 'Hummus', 'legumbres', U(r'^Hummus, commercial$'), [('1 cucharada', 15), ('1/4 taza', 60)], 'garbanzos untable', 'g'),
 ('milanesa-soja', 'Milanesa de soja', 'legumbres', M(230, 11, 25, 10, 4), [('1 milanesa', 100)], 'mila vegetariana', 'g'),
 ('medallon-legumbres', 'Medallón de legumbres / vegetal', 'legumbres', M(190, 8, 22, 8, 5), [('1 medallón', 80)], 'hamburguesa vegana', 'g'),
 # ---------------- Frutas
 ('banana', 'Banana', 'frutas', U(r'^Bananas, raw$'), [('1 banana mediana', 118), ('1 banana chica', 100)], 'platano', 'g'),
 ('manzana', 'Manzana', 'frutas', U(r'^Apples, raw, with skin'), [('1 manzana mediana', 182)], 'fruta', 'g'),
 ('naranja', 'Naranja', 'frutas', U(r'^Oranges, raw, all commercial varieties$'), [('1 naranja mediana', 140)], 'fruta citrico', 'g'),
 ('mandarina', 'Mandarina', 'frutas', U(r'^Tangerines, \(mandarin oranges\), raw$'), [('1 mandarina', 88)], 'fruta citrico', 'g'),
 ('pera', 'Pera', 'frutas', U(r'^Pears, raw$'), [('1 pera mediana', 178)], 'fruta', 'g'),
 ('frutillas', 'Frutillas', 'frutas', U(r'^Strawberries, raw$'), [('1 taza', 150), ('5 frutillas', 60)], 'fresas', 'g'),
 ('uvas', 'Uvas', 'frutas', U(r'^Grapes, red or green \(European type'), [('1 taza', 150), ('1 racimo chico', 100)], 'fruta', 'g'),
 ('durazno', 'Durazno', 'frutas', U(r'^Peaches, yellow, raw$'), [('1 durazno', 150)], 'melocoton', 'g'),
 ('kiwi', 'Kiwi', 'frutas', U(r'^Kiwifruit, green, raw$'), [('1 kiwi', 75)], 'fruta', 'g'),
 ('anana', 'Ananá', 'frutas', U(r'^Pineapple, raw, all varieties$'), [('1 rodaja', 85), ('1 taza', 165)], 'piña', 'g'),
 ('sandia', 'Sandía', 'frutas', U(r'^Watermelon, raw$'), [('1 tajada', 280), ('1 taza', 150)], 'fruta', 'g'),
 ('melon', 'Melón', 'frutas', U(r'^Melons, cantaloupe, raw$'), [('1 tajada', 130), ('1 taza', 160)], 'fruta', 'g'),
 ('mango', 'Mango', 'frutas', U(r'^Mangos, raw$'), [('1 mango', 200), ('1 taza', 165)], 'fruta tropical', 'g'),
 ('arandanos', 'Arándanos', 'frutas', U(r'^Blueberries, raw$'), [('1 taza', 148), ('1 puñado', 50)], 'berries', 'g'),
 ('palta', 'Palta', 'frutas', U(r'^Avocados, raw, all commercial varieties$'), [('1/2 palta', 75), ('1 palta', 150)], 'aguacate', 'g'),
 ('ciruela', 'Ciruela', 'frutas', U(r'^Plums, raw$'), [('1 ciruela', 66)], 'fruta', 'g'),
 ('pasas', 'Pasas de uva', 'frutas', U(r'^Raisins, dark, seedless'), [('1 puñado', 30), ('1 cucharada', 10)], 'fruta seca', 'g'),
 ('datiles', 'Dátiles', 'frutas', U(r'^Dates, medjool$'), [('1 dátil', 24)], 'fruta seca', 'g'),
 ('jugo-naranja', 'Jugo de naranja exprimido', 'bebidas', U(r'^Orange juice, raw'), [('1 vaso', 200)], 'jugo exprimido', 'ml'),
 ('ensalada-frutas', 'Ensalada de frutas (sin azúcar)', 'frutas', M(55, 0.7, 14, 0.2, 1.8), [('1 compotera', 200)], 'macedonia', 'g'),
 # ---------------- Verduras
 ('lechuga', 'Lechuga', 'verduras', U(r'^Lettuce, green leaf, raw$'), [('1 plato', 50), ('1 taza', 36)], 'ensalada verde', 'g'),
 ('tomate', 'Tomate', 'verduras', U(r'^Tomatoes, red, ripe, raw, year round average$'), [('1 tomate mediano', 123), ('1 taza', 180)], 'ensalada', 'g'),
 ('zanahoria', 'Zanahoria', 'verduras', U(r'^Carrots, raw$'), [('1 zanahoria', 61), ('1 taza rallada', 110)], 'ensalada', 'g'),
 ('cebolla', 'Cebolla', 'verduras', U(r'^Onions, raw$'), [('1 cebolla mediana', 110), ('1/2 taza', 80)], 'verdura', 'g'),
 ('brocoli', 'Brócoli (cocido)', 'verduras', U(r'^Broccoli, cooked, boiled, drained, without salt$'), [('1 taza', 156)], 'brocoli', 'g'),
 ('espinaca', 'Espinaca (cocida)', 'verduras', U(r'^Spinach, cooked, boiled, drained, without salt$'), [('1 taza', 180)], 'verdura de hoja', 'g'),
 ('acelga', 'Acelga (cocida)', 'verduras', U(r'^Chard, swiss, cooked, boiled, drained, without salt$'), [('1 taza', 175)], 'verdura de hoja', 'g'),
 ('zapallito', 'Zapallito / zucchini (cocido)', 'verduras', U(r'^Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt$'), [('1 taza', 180), ('1 zapallito', 120)], 'calabacin', 'g'),
 ('calabaza', 'Calabaza / zapallo (al horno)', 'verduras', U(r'^Squash, winter, butternut, cooked, baked, without salt$'), [('1 taza', 205), ('1 porción', 150)], 'anco zapallo', 'g'),
 ('morron', 'Morrón rojo', 'verduras', U(r'^Peppers, sweet, red, raw$'), [('1 morrón', 120), ('1/2 taza', 75)], 'pimiento aji', 'g'),
 ('pepino', 'Pepino', 'verduras', U(r'^Cucumber, with peel, raw$'), [('1 pepino', 200), ('1/2 taza', 52)], 'ensalada', 'g'),
 ('berenjena', 'Berenjena (cocida)', 'verduras', U(r'^Eggplant, cooked, boiled, drained, without salt$'), [('1 taza', 100)], 'verdura', 'g'),
 ('remolacha', 'Remolacha (cocida)', 'verduras', U(r'^Beets, cooked, boiled, drained$'), [('1/2 taza', 85)], 'betarraga', 'g'),
 ('champinones', 'Champiñones', 'verduras', U(r'^Mushrooms, white, raw$'), [('1 taza', 70)], 'hongos', 'g'),
 ('coliflor', 'Coliflor (cocida)', 'verduras', U(r'^Cauliflower, cooked, boiled, drained, without salt$'), [('1 taza', 124)], 'verdura', 'g'),
 ('chauchas', 'Chauchas (cocidas)', 'verduras', U(r'^Beans, snap, green, cooked, boiled, drained, without salt$'), [('1 taza', 125)], 'judias verdes', 'g'),
 ('repollo', 'Repollo', 'verduras', U(r'^Cabbage, raw$'), [('1 taza', 89)], 'col', 'g'),
 ('rucula', 'Rúcula', 'verduras', U(r'^Arugula, raw$'), [('1 taza', 20)], 'ensalada verde', 'g'),
 ('ensalada-mixta', 'Ensalada mixta (lechuga, tomate, cebolla)', 'verduras', M(20, 1, 4.2, 0.2, 1.4), [('1 plato', 200)], 'ensalada', 'g'),
 ('verduras-salteadas', 'Verduras salteadas / wok', 'verduras', M(75, 2, 8, 4, 2.5), [('1 plato', 250)], 'wok salteado', 'g'),
 ('sopa-verduras', 'Sopa de verduras', 'verduras', M(30, 1, 5, 0.6, 1), [('1 plato', 300)], 'caldo', 'ml'),
 # ---------------- Frutos secos y semillas
 ('mani', 'Maní tostado', 'frutos-secos', U(r'^Peanuts, all types, dry-roasted, without salt$'), [('1 puñado', 28), ('1 cucharada', 9)], 'cacahuate', 'g'),
 ('mantequilla-mani', 'Pasta de maní', 'frutos-secos', U(r'^Peanut butter, smooth style, without salt$'), [('1 cucharada', 16), ('1 cucharadita', 5)], 'mantequilla de mani', 'g'),
 ('almendras', 'Almendras', 'frutos-secos', U(r'^Nuts, almonds$'), [('1 puñado', 28), ('10 almendras', 12)], 'frutos secos', 'g'),
 ('nueces', 'Nueces', 'frutos-secos', U(r'^Nuts, walnuts, english$'), [('1 puñado', 28), ('1 nuez', 4)], 'frutos secos', 'g'),
 ('castanas-caju', 'Castañas de cajú', 'frutos-secos', U(r'^Nuts, cashew nuts, raw$'), [('1 puñado', 28)], 'anacardos', 'g'),
 ('mix-frutos-secos', 'Mix de frutos secos', 'frutos-secos', U(r'^Nuts, mixed nuts, dry roasted, with peanuts, without salt added$'), [('1 puñado', 30)], 'frutos secos', 'g'),
 ('chia', 'Semillas de chía', 'frutos-secos', U(r'^Seeds, chia seeds, dried$'), [('1 cucharada', 12)], 'semillas', 'g'),
 ('lino', 'Semillas de lino', 'frutos-secos', U(r'^Seeds, flaxseed$'), [('1 cucharada', 10)], 'semillas linaza', 'g'),
 ('girasol', 'Semillas de girasol', 'frutos-secos', U(r'^Seeds, sunflower seed kernels, dried$'), [('1 cucharada', 9), ('1 puñado', 28)], 'semillas', 'g'),
 # ---------------- Aceites y aderezos
 ('aceite-oliva', 'Aceite de oliva', 'grasas', U(r'^Oil, olive, salad or cooking$'), [('1 cucharada', 13.5), ('1 cucharadita', 4.5)], 'aceite', 'g'),
 ('aceite-girasol', 'Aceite de girasol', 'grasas', U(r'^Oil, sunflower, linoleic, \(approx. 65%\)$'), [('1 cucharada', 13.6), ('1 cucharadita', 4.5)], 'aceite', 'g'),
 ('mayonesa', 'Mayonesa', 'grasas', U(r'^Salad dressing, mayonnaise, regular$'), [('1 cucharada', 14), ('1 sobrecito', 8)], 'aderezo', 'g'),
 ('mayonesa-light', 'Mayonesa light', 'grasas', U(r'^Salad dressing, mayonnaise, light$'), [('1 cucharada', 15)], 'aderezo', 'g'),
 ('ketchup', 'Ketchup', 'grasas', U(r'^Catsup$'), [('1 cucharada', 17)], 'aderezo', 'g'),
 ('mostaza', 'Mostaza', 'grasas', U(r'^Mustard, prepared, yellow$'), [('1 cucharadita', 5)], 'aderezo', 'g'),
 ('salsa-tomate', 'Salsa de tomate', 'grasas', U(r'^Sauce, pasta, spaghetti/marinara, ready-to-serve$'), [('1/2 taza', 125)], 'tuco fileto', 'g'),
 ('chimichurri', 'Chimichurri', 'grasas', M(480, 0.8, 4, 51, 1), [('1 cucharada', 15)], 'salsa criolla', 'g'),
 # ---------------- Bebidas
 ('agua', 'Agua', 'bebidas', M(0, 0, 0, 0), [('1 vaso', 250), ('1 botella', 500)], 'agua', 'ml'),
 ('cafe', 'Café negro / espresso', 'bebidas', U(r'^Beverages, coffee, brewed, prepared with tap water$'), [('1 taza', 150), ('1 pocillo', 50)], 'cafe', 'ml'),
 ('cafe-con-leche', 'Café con leche', 'bebidas', M(38, 2, 3, 2), [('1 taza', 250), ('1 jarrito', 200)], 'cortado lagrima', 'ml'),
 ('mate', 'Mate amargo', 'bebidas', M(2, 0, 0.4, 0), [('1 termo (1 l)', 1000), ('1 mate', 60)], 'yerba mate', 'ml'),
 ('mate-cocido-azucar', 'Mate cocido / té con azúcar', 'bebidas', M(20, 0, 5, 0), [('1 taza', 250)], 'te azucar', 'ml'),
 ('te', 'Té (sin azúcar)', 'bebidas', U(r'^Beverages, tea, black, brewed, prepared with tap water$'), [('1 taza', 240)], 'infusion', 'ml'),
 ('gaseosa', 'Gaseosa común (cola)', 'bebidas', U(r'^Beverages, carbonated, cola, regular$'), [('1 vaso', 250), ('1 lata', 354), ('1 botella', 500)], 'coca refresco', 'ml'),
 ('gaseosa-zero', 'Gaseosa light / zero', 'bebidas', M(1, 0, 0.1, 0), [('1 vaso', 250), ('1 lata', 354)], 'coca zero refresco', 'ml'),
 ('agua-saborizada', 'Agua saborizada', 'bebidas', M(18, 0, 4.5, 0), [('1 botella', 500)], 'levite', 'ml'),
 ('jugo-polvo', 'Jugo en polvo preparado', 'bebidas', M(8, 0, 2, 0), [('1 vaso', 250)], 'clight tang', 'ml'),
 ('bebida-isotonica', 'Bebida isotónica', 'bebidas', M(26, 0, 6.4, 0), [('1 botella', 500)], 'gatorade powerade', 'ml'),
 ('cerveza', 'Cerveza', 'bebidas', U(r'^Alcoholic beverage, beer, regular, all$'), [('1 vaso', 330), ('1 lata', 473), ('1 porrón', 340), ('1 litro', 1000)], 'birra', 'ml'),
 ('vino-tinto', 'Vino tinto', 'bebidas', U(r'^Alcoholic beverage, wine, table, red$'), [('1 copa', 150)], 'malbec', 'ml'),
 ('vino-blanco', 'Vino blanco', 'bebidas', U(r'^Alcoholic beverage, wine, table, white$'), [('1 copa', 150)], 'vino', 'ml'),
 ('fernet-cola', 'Fernet con cola', 'bebidas', M(80, 0, 7.5, 0), [('1 vaso', 300)], 'fernet', 'ml'),
 ('licuado-banana', 'Licuado de banana con leche', 'bebidas', M(78, 2.6, 13, 1.9, 0.8), [('1 vaso', 300)], 'smoothie batido', 'ml'),
 # ---------------- Dulces y snacks
 ('azucar', 'Azúcar', 'dulces', U(r'^Sugars, granulated$'), [('1 cucharadita', 5), ('1 sobrecito', 6), ('1 cucharada', 12.5)], 'endulzar', 'g'),
 ('miel', 'Miel', 'dulces', U(r'^Honey$'), [('1 cucharada', 21), ('1 cucharadita', 7)], 'endulzar', 'g'),
 ('mermelada', 'Mermelada', 'dulces', U(r'^Jams and preserves$'), [('1 cucharada', 20)], 'dulce', 'g'),
 ('mermelada-light', 'Mermelada light', 'dulces', M(110, 0.3, 27, 0.1, 0.8), [('1 cucharada', 20)], 'dulce', 'g'),
 ('dulce-membrillo', 'Dulce de membrillo / batata', 'dulces', M(275, 0.4, 68, 0.1, 1.5), [('1 porción', 40)], 'postre vigilante', 'g'),
 ('alfajor-chocolate', 'Alfajor de chocolate', 'dulces', M(455, 5.5, 62, 20.5, 2), [('1 alfajor', 50), ('1 alfajor triple', 75)], 'golosina', 'g'),
 ('alfajor-maicena', 'Alfajor de maicena', 'dulces', M(430, 5, 63, 17.5, 1), [('1 alfajor', 45)], 'golosina', 'g'),
 ('chocolate-leche', 'Chocolate con leche', 'dulces', U(r'^Candies, milk chocolate$'), [('1 barrita', 25), ('1 tableta', 100)], 'golosina', 'g'),
 ('chocolate-amargo', 'Chocolate amargo 70%', 'dulces', U(r'^Chocolate, dark, 70-85% cacao solids$'), [('2 cuadraditos', 20), ('1 tableta', 100)], 'golosina', 'g'),
 ('galletitas-dulces', 'Galletitas dulces (vainilla / María)', 'dulces', U(r'^Cookies, vanilla wafers, higher fat$'), [('1 galletita', 8), ('5 galletitas', 40)], 'galletas', 'g'),
 ('galletitas-chips', 'Galletitas con chips de chocolate', 'dulces', U(r'^Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched$'), [('1 galletita', 12), ('3 galletitas', 36)], 'galletas cookies', 'g'),
 ('barra-cereal', 'Barra de cereal', 'dulces', U(r'^Snacks, granola bars, soft, uncoated, plain$'), [('1 barra', 25)], 'barrita', 'g'),
 ('papas-chips', 'Papas fritas de paquete', 'dulces', U(r'^Snacks, potato chips, plain, salted$'), [('1 bolsita', 30), ('1 puñado', 15)], 'snack lays', 'g'),
 ('pochoclo', 'Pochoclo (sin manteca)', 'dulces', U(r'^Snacks, popcorn, air-popped$'), [('1 taza', 8), ('1 balde chico', 40)], 'palomitas', 'g'),
 ('torta', 'Torta / bizcochuelo', 'dulces', U(r'^Cake, pound, commercially prepared, butter'), [('1 porción', 80)], 'pastel budin', 'g'),
 ('flan', 'Flan (con leche entera)', 'dulces', U(r'^Flan, caramel custard, dry mix, prepared with whole milk$'), [('1 porción', 120)], 'postre', 'g'),
 ('gelatina', 'Gelatina (común)', 'dulces', U(r'^Gelatin desserts, dry mix, prepared with water$'), [('1 compotera', 150)], 'postre', 'g'),
 ('gelatina-light', 'Gelatina light', 'dulces', M(7, 1.2, 0.5, 0), [('1 compotera', 150)], 'postre', 'g'),
 ('chocotorta', 'Chocotorta', 'dulces', M(390, 6, 40, 23, 1), [('1 porción', 120)], 'postre torta', 'g'),
 # ---------------- Platos y comidas típicas (estimados por receta)
 ('empanada-carne', 'Empanada de carne (al horno)', 'platos', M(265, 10.5, 25, 13.5, 1.5), [('1 empanada', 90)], 'empanadas', 'g'),
 ('empanada-jyq', 'Empanada de jamón y queso', 'platos', M(285, 11.5, 26, 15, 1), [('1 empanada', 85)], 'empanadas', 'g'),
 ('empanada-verdura', 'Empanada de verdura / humita', 'platos', M(240, 7.5, 27, 11.5, 2), [('1 empanada', 85)], 'empanadas', 'g'),
 ('pizza-muzza', 'Pizza de muzzarella', 'platos', M(265, 11, 30, 11, 1.8), [('1 porción', 120), ('2 porciones', 240)], 'pizza', 'g'),
 ('faina', 'Fainá', 'platos', M(250, 8.5, 26, 12.5, 4), [('1 porción', 80)], 'faina garbanzo', 'g'),
 ('tarta-verdura', 'Tarta de verdura / jamón y queso', 'platos', M(215, 8, 18, 12.5, 1.5), [('1 porción', 150)], 'tarta pascualina quiche', 'g'),
 ('tortilla-papas', 'Tortilla de papas', 'platos', M(160, 6, 13, 9.5, 1.3), [('1 porción', 150)], 'tortilla española', 'g'),
 ('noquis', 'Ñoquis de papa (sin salsa)', 'platos', M(135, 3.5, 29, 0.6, 1.5), [('1 plato', 250)], 'ñoquis gnocchi', 'g'),
 ('ravioles', 'Ravioles de ricota (sin salsa)', 'platos', M(185, 8, 26, 5.5, 1.3), [('1 plato', 250)], 'pasta rellena', 'g'),
 ('lasagna', 'Lasaña / canelones', 'platos', M(150, 8.5, 14, 6.8, 1), [('1 porción', 300)], 'pasta horno', 'g'),
 ('fideos-bolognesa', 'Fideos con salsa bolognesa', 'platos', M(150, 7, 20, 4.5, 1.6), [('1 plato', 350)], 'pasta tuco', 'g'),
 ('arroz-pollo', 'Arroz con pollo', 'platos', M(160, 10, 18.5, 4.8, 0.8), [('1 plato', 350)], 'arroz', 'g'),
 ('guiso-lentejas', 'Guiso de lentejas', 'platos', M(115, 6.5, 13, 3.8, 3.5), [('1 plato', 350)], 'guiso', 'g'),
 ('locro', 'Locro', 'platos', M(130, 6.5, 13, 5.8, 2.5), [('1 plato', 350)], 'guiso', 'g'),
 ('estofado', 'Carne al horno / estofado con papas', 'platos', M(140, 10, 10, 6.5, 1.2), [('1 plato', 350)], 'guiso carne', 'g'),
 ('pastel-papa', 'Pastel de papa', 'platos', M(150, 8.5, 11, 8, 1), [('1 porción', 250)], 'pastel', 'g'),
 ('choripan', 'Choripán', 'platos', M(300, 12, 22, 18, 1), [('1 choripán', 200)], 'chori', 'g'),
 ('hamburguesa-completa', 'Hamburguesa completa (pan, queso, lechuga, tomate)', 'platos', M(245, 13, 20, 12.5, 1.2), [('1 hamburguesa', 220), ('1 doble', 320)], 'burger', 'g'),
 ('pancho', 'Pancho (pan + salchicha)', 'platos', M(265, 9.5, 24, 14.5, 1), [('1 pancho', 100)], 'hot dog', 'g'),
 ('sandwich-miga', 'Sándwich de miga (jamón y queso)', 'platos', M(285, 11, 26, 15.5, 1.2), [('1 sándwich triple', 50), ('1 sándwich simple', 35)], 'miga', 'g'),
 ('tostado', 'Tostado de jamón y queso', 'platos', M(275, 14, 27, 12.5, 1.5), [('1 tostado', 130)], 'sandwich', 'g'),
 ('sushi', 'Sushi (pieza)', 'platos', M(150, 5, 25, 3.2, 1), [('1 pieza', 30), ('10 piezas', 300)], 'roll', 'g'),
 ('ensalada-cesar', 'Ensalada César con pollo', 'platos', M(150, 11, 6, 9.5, 1.5), [('1 plato', 300)], 'ensalada', 'g'),
 ('wrap-pollo', 'Wrap de pollo', 'platos', M(210, 13, 21, 8, 1.8), [('1 wrap', 220)], 'fajita', 'g'),
 # ---------------- Suplementos
 ('whey', 'Proteína whey (en polvo)', 'suplementos', M(400, 78, 10, 6), [('1 scoop', 30)], 'proteina batido suplemento', 'g'),
 ('creatina', 'Creatina monohidrato', 'suplementos', M(0, 0, 0, 0), [('1 dosis', 5)], 'suplemento', 'g'),
 ('barra-proteica', 'Barra proteica', 'suplementos', M(370, 33, 38, 11, 6), [('1 barra', 50)], 'suplemento', 'g'),
]

CAT = {
 'carnes': 'Carnes y aves', 'pescados': 'Pescados y mariscos', 'huevos': 'Huevos', 'lacteos': 'Lácteos',
 'cereales': 'Panes, cereales y tubérculos', 'legumbres': 'Legumbres y soja', 'frutas': 'Frutas', 'verduras': 'Verduras',
 'frutos-secos': 'Frutos secos y semillas', 'grasas': 'Aceites y aderezos', 'bebidas': 'Bebidas', 'dulces': 'Dulces y snacks',
 'platos': 'Platos y comidas típicas', 'suplementos': 'Suplementos',
}

def r1(x):
    return None if x is None else round(float(x), 1)

seen = set()
out_rows = []
report = []
for (fid, name, cat, src, portions, alias, unit) in F:
    assert fid not in seen, fid
    seen.add(fid)
    assert cat in CAT, cat
    kind, data = src
    if kind == 'usda':
        usda_id, v = data
        vals = {k: v.get(k) for k in ('kcal', 'p', 'c', 'f', 'fib', 'sug', 'na')}
        report.append(f'{fid:24s} <- {usda_id} {v["d"][:70]} | {vals["kcal"]} P{vals["p"]} C{vals["c"]} F{vals["f"]}')
    else:
        vals = data
        usda_id = None
    kcal = round(vals['kcal'] or 0)
    row = {
        'id': fid, 'n': name, 'cat': cat, 'kcal': kcal,
        'p': r1(vals['p'] or 0), 'c': r1(vals['c'] or 0), 'f': r1(vals['f'] or 0),
        'fib': r1(vals.get('fib') or 0),
        'u': unit, 'por': [[l, g] for l, g in portions], 'tags': alias,
        'src': 'usda' if usda_id else 'est',
    }
    if usda_id:
        row['fdc'] = int(usda_id)
    if vals.get('na') is not None:
        row['na'] = round(vals['na'])
    out_rows.append(row)

print('\n'.join(report))
if MISSING:
    print('MISSING:'); print('\n'.join(MISSING)); raise SystemExit(1)
print('TOTAL', len(out_rows), 'usda', sum(1 for r in out_rows if r['src'] == 'usda'))

ts = ['// ARCHIVO GENERADO por scripts/build_foods.py — no editar a mano.',
      '// Fuente: USDA FoodData Central SR Legacy (dominio público) para alimentos básicos (src: "usda", fdc = id).',
      '// Platos típicos y productos regionales: estimación por receta / rótulos (src: "est"). Valores por 100 g o 100 ml.',
      "import type { Food, FoodCategory } from '../types.ts';",
      '',
      'export const FOOD_CATEGORIES: Record<FoodCategory, string> = ' + json.dumps(CAT, ensure_ascii=False, indent=2) + ';',
      '',
      'type Row = { id: string; n: string; cat: FoodCategory; kcal: number; p: number; c: number; f: number; fib: number; na?: number; u: "g" | "ml"; por: [string, number][]; tags: string; src: "usda" | "est"; fdc?: number };',
      '',
      'const ROWS: Row[] = [']
for r in out_rows:
    ts.append('  ' + json.dumps(r, ensure_ascii=False) + ',')
ts.append('];')
ts.append('')
ts.append('export const FOODS: Food[] = ROWS.map((r) => ({')
ts.append('  id: r.id, name: r.n, category: r.cat, kcal: r.kcal, protein: r.p, carbs: r.c, fat: r.f, fiber: r.fib,')
ts.append('  sodium: r.na, unit: r.u, portions: r.por.map(([label, grams]) => ({ label, grams })), tags: r.tags,')
ts.append('  source: r.src, fdcId: r.fdc,')
ts.append('}));')
ts.append('')
open(sys.argv[1], 'w').write('\n'.join(ts))
print('escrito', sys.argv[1])
