// Actividades rápidas con MET del Compendio de Actividades Físicas para Adultos 2024 (pacompendium.com).
// Entre paréntesis, el código del compendio.

export interface ActivityOption {
  label: string;
  met: number;
  code: string;
}

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  group: 'cardio' | 'deporte' | 'gimnasio' | 'cuerpo-mente' | 'vida-diaria';
  options: ActivityOption[];
  defaultMin: number;
}

export const ACTIVITIES: Activity[] = [
  {
    id: 'caminar', name: 'Caminar', emoji: '🚶', group: 'cardio', defaultMin: 30,
    options: [
      { label: 'Paseo tranquilo (3–4 km/h)', met: 2.8, code: '17152' },
      { label: 'Ritmo moderado (4,5–5,5 km/h)', met: 3.8, code: '17190' },
      { label: 'Rápido (5,6–6,3 km/h)', met: 4.8, code: '17200' },
      { label: 'Muy rápido (6,4–7 km/h)', met: 5.5, code: '17220' },
      { label: 'En subida / cerros', met: 7.0, code: '17035' },
    ],
  },
  {
    id: 'correr', name: 'Correr', emoji: '🏃', group: 'cardio', defaultMin: 30,
    options: [
      { label: 'Trote suave (6,5 km/h)', met: 6.5, code: '12028' },
      { label: '8 km/h (7:30 min/km)', met: 8.5, code: '12030' },
      { label: '9,7 km/h (6:12 min/km)', met: 9.3, code: '12050' },
      { label: '10,8 km/h (5:33 min/km)', met: 10.5, code: '12060' },
      { label: '12 km/h (5:00 min/km)', met: 11.8, code: '12080' },
      { label: '13,8 km/h (4:21 min/km)', met: 12.5, code: '12100' },
      { label: '16 km/h (3:45 min/km)', met: 14.8, code: '12120' },
    ],
  },
  {
    id: 'bici', name: 'Bicicleta', emoji: '🚴', group: 'cardio', defaultMin: 45,
    options: [
      { label: 'Paseo (< 16 km/h)', met: 4.0, code: '01010' },
      { label: 'Moderada (19–22 km/h)', met: 8.0, code: '01030' },
      { label: 'Rápida (22–25 km/h)', met: 10.0, code: '01040' },
      { label: 'Muy rápida (26–30 km/h)', met: 12.0, code: '01050' },
      { label: 'Mountain bike', met: 8.5, code: '01009' },
    ],
  },
  {
    id: 'bici-fija', name: 'Bici fija / spinning', emoji: '🚲', group: 'gimnasio', defaultMin: 40,
    options: [
      { label: 'Suave (50 W)', met: 4.0, code: '01214' },
      { label: 'Moderada (90–100 W)', met: 6.0, code: '01220' },
      { label: 'Intensa (150–199 W)', met: 10.3, code: '01232' },
      { label: 'Clase de spinning', met: 9.0, code: '01270' },
    ],
  },
  {
    id: 'natacion', name: 'Natación', emoji: '🏊', group: 'cardio', defaultMin: 40,
    options: [
      { label: 'Recreativa (sin hacer largos)', met: 6.0, code: '18310' },
      { label: 'Crol lento', met: 5.8, code: '18292' },
      { label: 'Crol moderado', met: 8.0, code: '18290' },
      { label: 'Crol rápido', met: 10.5, code: '18280' },
      { label: 'Pecho recreativo', met: 5.3, code: '18265' },
    ],
  },
  {
    id: 'futbol', name: 'Fútbol', emoji: '⚽', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Recreativo / picadito', met: 7.0, code: '15610' },
      { label: 'Competitivo', met: 9.5, code: '15605' },
    ],
  },
  {
    id: 'padel', name: 'Pádel', emoji: '🎾', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Recreativo (aprox. tenis dobles)', met: 6.0, code: '15680' },
      { label: 'Competitivo (aprox. paleta competitiva)', met: 8.0, code: '15676' },
    ],
  },
  {
    id: 'tenis', name: 'Tenis', emoji: '🎾', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Dobles', met: 6.0, code: '15680' },
      { label: 'Singles moderado', met: 6.8, code: '15675' },
      { label: 'Competitivo', met: 8.0, code: '15676' },
    ],
  },
  {
    id: 'basquet', name: 'Básquet', emoji: '🏀', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Tirar al aro', met: 5.0, code: '15070' },
      { label: 'General', met: 7.5, code: '15055' },
      { label: 'Partido', met: 8.0, code: '15040' },
    ],
  },
  {
    id: 'voley', name: 'Vóley', emoji: '🏐', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Recreativo', met: 3.0, code: '15720' },
      { label: 'Competitivo', met: 6.0, code: '15711' },
      { label: 'Beach vóley', met: 8.0, code: '15725' },
    ],
  },
  {
    id: 'rugby-hockey', name: 'Rugby / hockey / handball', emoji: '🏉', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Hockey sobre césped', met: 7.8, code: '15350' },
      { label: 'Handball', met: 8.0, code: '15330' },
      { label: 'Rugby competitivo', met: 8.3, code: '15560' },
    ],
  },
  {
    id: 'boxeo', name: 'Boxeo / artes marciales', emoji: '🥊', group: 'deporte', defaultMin: 45,
    options: [
      { label: 'Bolsa de boxeo', met: 5.8, code: '15110' },
      { label: 'Kickboxing', met: 7.3, code: '15450' },
      { label: 'Sparring', met: 7.8, code: '15120' },
      { label: 'Artes marciales (judo, karate, muay thai)', met: 10.3, code: '15430' },
    ],
  },
  {
    id: 'soga', name: 'Saltar la soga', emoji: '🪢', group: 'cardio', defaultMin: 15,
    options: [
      { label: 'Lento (< 100 saltos/min)', met: 8.3, code: '15552' },
      { label: 'Moderado (100–120/min)', met: 11.8, code: '15551' },
      { label: 'Rápido (120–160/min)', met: 12.3, code: '15550' },
    ],
  },
  {
    id: 'eliptico', name: 'Elíptico', emoji: '⚙️', group: 'gimnasio', defaultMin: 30,
    options: [
      { label: 'Moderado', met: 5.0, code: '02048' },
      { label: 'Intenso', met: 9.0, code: '02049' },
    ],
  },
  {
    id: 'remo', name: 'Remo (máquina)', emoji: '🚣', group: 'gimnasio', defaultMin: 20,
    options: [
      { label: 'Moderado (< 100 W)', met: 5.0, code: '02071' },
      { label: 'Intenso (100–149 W)', met: 7.5, code: '02072' },
      { label: 'Muy intenso (150–199 W)', met: 11.0, code: '02073' },
    ],
  },
  {
    id: 'escaladora', name: 'Escaladora / escaleras', emoji: '🪜', group: 'gimnasio', defaultMin: 20,
    options: [
      { label: 'Subir escaleras (general)', met: 6.8, code: '17131' },
      { label: 'Escaladora (máquina)', met: 9.3, code: '02065' },
    ],
  },
  {
    id: 'pesas-libre', name: 'Pesas (sesión libre)', emoji: '🏋️', group: 'gimnasio', defaultMin: 60,
    options: [
      { label: 'Moderada (8–15 reps, varios ejercicios)', met: 3.5, code: '02054' },
      { label: 'Pesada (sentadilla, peso muerto)', met: 5.0, code: '02052' },
      { label: 'Vigorosa (powerlifting / culturismo)', met: 6.0, code: '02050' },
      { label: 'En circuito (superseries)', met: 5.8, code: '02055' },
    ],
  },
  {
    id: 'funcional', name: 'Funcional / HIIT / crossfit', emoji: '⚡', group: 'gimnasio', defaultMin: 45,
    options: [
      { label: 'Clase de acondicionamiento', met: 7.8, code: '02062' },
      { label: 'HIIT moderado', met: 7.0, code: '02210' },
      { label: 'HIIT vigoroso (burpees, Tabata)', met: 11.0, code: '02214' },
      { label: 'Circuito con kettlebells', met: 7.5, code: '02040' },
    ],
  },
  {
    id: 'yoga', name: 'Yoga', emoji: '🧘', group: 'cuerpo-mente', defaultMin: 45,
    options: [
      { label: 'Hatha', met: 2.3, code: '02150' },
      { label: 'Vinyasa', met: 2.7, code: '02185' },
      { label: 'Power yoga', met: 4.0, code: '02160' },
    ],
  },
  {
    id: 'pilates', name: 'Pilates', emoji: '🤸', group: 'cuerpo-mente', defaultMin: 45,
    options: [
      { label: 'Mat (suelo)', met: 1.8, code: '02103' },
      { label: 'General', met: 2.8, code: '02105' },
    ],
  },
  {
    id: 'estiramiento', name: 'Estiramientos / movilidad', emoji: '🙆', group: 'cuerpo-mente', defaultMin: 15,
    options: [{ label: 'Estiramiento suave', met: 2.3, code: '02101' }],
  },
  {
    id: 'baile', name: 'Baile', emoji: '💃', group: 'cardio', defaultMin: 45,
    options: [
      { label: 'Salsa / folclore / social', met: 4.5, code: '03025' },
      { label: 'Aeróbico / zumba (bajo impacto)', met: 4.8, code: '02005' },
      { label: 'Aeróbico / zumba (alto impacto)', met: 8.0, code: '02006' },
      { label: 'Boliche / baile intenso', met: 9.8, code: '03031' },
    ],
  },
  {
    id: 'trekking', name: 'Trekking / senderismo', emoji: '🥾', group: 'cardio', defaultMin: 90,
    options: [
      { label: 'Con mochila liviana', met: 7.8, code: '17012' },
      { label: 'Subiendo cerros (6–10%)', met: 7.0, code: '17035' },
    ],
  },
  {
    id: 'patinaje', name: 'Patín / skate', emoji: '🛼', group: 'cardio', defaultMin: 40,
    options: [
      { label: 'Skate', met: 5.0, code: '15580' },
      { label: 'Patín / rollers recreativo', met: 7.5, code: '15591' },
    ],
  },
  {
    id: 'escalada', name: 'Escalada', emoji: '🧗', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Escalada general', met: 8.0, code: '15533' },
      { label: 'Boulder', met: 8.8, code: '15534' },
    ],
  },
  {
    id: 'perro', name: 'Pasear al perro', emoji: '🐕', group: 'vida-diaria', defaultMin: 30,
    options: [{ label: 'Paseo con el perro', met: 3.0, code: '17165' }],
  },
  {
    id: 'golf', name: 'Golf / ping pong', emoji: '⛳', group: 'deporte', defaultMin: 60,
    options: [
      { label: 'Ping pong', met: 4.0, code: '15660' },
      { label: 'Golf caminando', met: 4.3, code: '15265' },
    ],
  },
];

export const ACTIVITY_MAP = new Map(ACTIVITIES.map((a) => [a.id, a]));
