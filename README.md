# appGIM · Comida + Entrenamiento

App web gratuita (PWA) para registrar **lo que comés** y **lo que entrenás**, con los dos módulos conectados:

- Si entrenás, la app suma a tu objetivo del día las calorías que quemaste y te sugiere la proteína para recuperarte.
- Si comés de más, te muestra cuánto movimiento equivale y te deja registrar una actividad.
- Todo funciona **offline**, **sin cuentas** y **sin costos**: los datos quedan en tu teléfono (con backup a archivo).

> Abrila en el celular, tocá *“Agregar a pantalla de inicio”* y se usa como una app más.

## Qué incluye

### 🍽️ Módulo Comida
- **218 alimentos en español** con valores por 100 g: 158 de **USDA FoodData Central** (dominio público) y 60 platos y productos típicos rioplatenses estimados por receta (milanesas, empanadas, asado, mate, dulce de leche, alfajores, fainá, locro…).
- Porciones reales (“1 milanesa mediana”, “1 empanada”, “1 taza”…), buscador sin acentos, recientes, favoritos.
- **Productos de supermercado** vía [Open Food Facts](https://world.openfoodfacts.org) (gratis, sin clave): búsqueda online y **lector de código de barras** con la cámara (nativo en Android; en iPhone usa ZXing en WebAssembly, también gratis).
- Alimentos propios, **comidas guardadas** para cargar con un toque, copiar la comida de ayer, agregado rápido de calorías.
- Desayuno, almuerzo, **merienda**, cena y snacks. Agua por vasos.
- Cada alimento muestra su **equivalencia en ejercicio** (“= 25 min caminando rápido”).

### 🏋️ Módulo Ejercicio
- **17 rutinas** en tres niveles, cada una con **tiempo, calorías y proteína calculados para tu peso** y **animación propia en todos los ejercicios** (82 ejercicios, figuras SVG animadas con cinemática inversa: funcionan sin internet).

| Nivel | Rutinas |
|---|---|
| 🌱 Principiante | Primeros pasos en casa · Rutina científica de 7 minutos · Gimnasio inicial con máquinas · Fuerza base 5×5 · Movilidad y core · Caminar–trotar (inicio al running) |
| 🔥 Intermedio | Torso / Pierna 4 días · Push / Pull / Legs · HIIT 40/20 · Calistenia intermedia · Mancuernas en casa |
| 🏆 Avanzado / Pro | PHUL · PPL hipertrofia 6 días · Fuerza 5/3/1 · Calistenia avanzada · Metcon funcional · Atleta híbrido (carrera + fuerza) |

- **Entrenamiento guiado**: animación grande, series y repeticiones, registro de peso por serie (“la última vez hiciste…” y sugerencia de progresión), temporizadores de trabajo/descanso, pitidos 3‑2‑1, **voz guía en español**, vibración y pantalla siempre encendida.
- **Plan semanal** (“Hoy te toca…”), historial con mapa de calor, récords (1RM estimado) y **creador de rutinas propias**.
- **Actividades rápidas**: caminar, correr, bici, natación, fútbol, pádel, tenis, básquet, vóley, boxeo, yoga, baile, soga… con METs oficiales.

### ⚖️ Balance (la fusión)
- **Objetivo − Comida + Ejercicio = Restante**, en anillos (calorías, proteína, minutos de ejercicio).
- En días de entrenamiento suben las calorías (80% carbohidratos, 20% grasas), el agua (+500 ml/h) y se recomienda la proteína post‑entreno.
- **Balance inteligente**: avisos y sugerencias de comidas para completar tu proteína sin pasarte de calorías.

### 📈 Progreso
- Peso con **línea de tendencia**, meta, IMC; semana de calorías vs. objetivo; minutos activos vs. los 150 de la OMS.
- **Gasto real adaptativo**: con tus registros de comida y peso estima tu metabolismo real (lo que hacen apps pagas como MacroFactor).
- Logros y racha de días.

## Cómo calculamos (fuentes)

| Qué | Método | Fuente |
|---|---|---|
| Metabolismo basal | Mifflin‑St Jeor | Mifflin et al., 1990 |
| Gasto diario | Basal × factor de actividad **sin** entrenamientos (se suman aparte) | — |
| Calorías del ejercicio | kcal = MET × kg × horas; al objetivo se suman las netas (MET − 1) | [Compendio de Actividades Físicas para Adultos 2024](https://pacompendium.com) (Herrmann et al.) |
| Proteína | 1,6–2,0 g/kg según objetivo; ~0,3 g/kg post‑entreno | [ISSN Position Stand, 2017](https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8); Morton et al., 2018 |
| Frecuencia y volumen | Novatos 2–3 días, intermedios 3–4, avanzados 4–6 | ACSM Position Stand, 2009 |
| Déficit / superávit | ~7.700 kcal por kg | — |
| Fibra / agua | 14 g cada 1.000 kcal / ~35 ml por kg + 500 ml por hora de ejercicio | Guías Alimentarias EE.UU.; ACSM |
| Alimentos | USDA FoodData Central SR Legacy | [fdc.nal.usda.gov](https://fdc.nal.usda.gov) |
| Productos | Open Food Facts (ODbL) | [openfoodfacts.org](https://world.openfoodfacts.org) |

Las rutinas se basan en: Klika y Jordan (2013, “7 minutos”), StrongLifts 5×5 / Starting Strength, PPL de r/Fitness, PHUL (Brandon Campbell), 5/3/1 de Jim Wendler, Couch to 5K y la rutina recomendada de r/bodyweightfitness.

> ⚠️ Son estimaciones educativas, no reemplazan el consejo de un médico o nutricionista.

## Publicarla gratis (GitHub Pages)

1. En GitHub: **Settings → Pages → Build and deployment → Source: “GitHub Actions”**.
2. Cada vez que hay un cambio en `main`, el workflow `.github/workflows/deploy.yml` corre los tests, compila y publica.
3. La app queda en `https://<tu-usuario>.github.io/appGIM/`.

## Desarrollo

Requiere Node 22+.

```bash
npm install
npm run dev        # servidor local en http://localhost:5173
npm test           # tests de cálculos y de integridad de datos
npm run build      # compila a dist/
```

Galería de control de animaciones (solo en desarrollo): `http://localhost:5173/#/dev`.

### Estructura

```
src/
  data/        alimentos (generado), ejercicios, animaciones, rutinas, actividades
  lib/         cálculos de nutrición y entrenamiento, búsqueda, Open Food Facts, sonidos/voz
  store/       estado persistente (zustand + localStorage) y datos derivados del día
  components/  UI, gráficos SVG y el motor de figuras animadas
  features/    inicio (balance), comida, ejercicio (rutinas, reproductor), progreso, perfil
scripts/build_foods.py   regenera src/data/foods.ts desde el CSV de USDA
```

Tecnologías (todas libres): React, TypeScript, Vite, Tailwind CSS, Zustand, Lucide, vite‑plugin‑pwa, barcode‑detector/ZXing.
