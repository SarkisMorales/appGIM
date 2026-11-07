import type { AnimSpec, Pose, Pt } from '../types.ts';

/*
 * Animaciones de ejercicios (figura SVG con cinemática inversa, ver components/figure/engine.ts).
 * Convenciones: vista lateral mirando a la derecha; suelo en y≈219; tobillo apoyado en y=214.
 * torso: 0 = vertical, 90 = acostado boca abajo con la cabeza a la derecha, -90 = boca arriba con la cabeza a la izquierda.
 */

const R = Math.PI / 180;
const G = 214;
const sh = (hip: Pt, T: number): Pt => [hip[0] + 50 * Math.sin(T * R), hip[1] - 50 * Math.cos(T * R)];
const add = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];

/** Cuerpo recto desde el tobillo, inclinado beta grados sobre la horizontal (cabeza a la derecha). */
function line(ankle: Pt, beta: number) {
  const u: Pt = [Math.cos(beta * R), -Math.sin(beta * R)];
  const hip: Pt = [ankle[0] + 82 * u[0], ankle[1] + 82 * u[1]];
  const s: Pt = [hip[0] + 50 * u[0], hip[1] + 50 * u[1]];
  return { hip, sh: s, T: 90 - beta };
}

/** Cuerpo recto desde la rodilla apoyada. */
function kneeLine(knee: Pt, beta: number) {
  const u: Pt = [Math.cos(beta * R), -Math.sin(beta * R)];
  const hip: Pt = [knee[0] + 42 * u[0], knee[1] + 42 * u[1]];
  const s: Pt = [hip[0] + 50 * u[0], hip[1] + 50 * u[1]];
  return { hip, sh: s, T: 90 - beta };
}

function stand(x = 120, extra: Partial<Pose> = {}): Pose {
  return { hip: [x, 132], torso: 0, hn: [x + 4, 139], hf: [x + 2, 139], fn: [x + 6, G], ff: [x - 2, G], ...extra };
}

/** Manos en la cintura. */
const onHips = (hip: Pt): Partial<Pose> => ({ hn: [hip[0] + 7, hip[1] - 6], hf: [hip[0] + 5, hip[1] - 6], pe: [-1, 0.1], pef: [-1, 0.1] });
/** Brazos colgando (con mancuernas). */
const hanging = (hip: Pt, T = 0): Partial<Pose> => {
  const s = sh(hip, T);
  return { hn: [s[0] + 4, s[1] + 57], hf: [s[0] + 2, s[1] + 57] };
};

// ---------- Bases reutilizables ----------
// Flexión: abajo el antebrazo queda vertical y el codo apunta hacia atrás.
const PU_TOP = line([55, 210], 22);
const PU_BOT = line([55, 210], 6.96);
const PUSH_FEET: Partial<Pose> = { fn: [55, 210], ff: [51, 210], ftn: 65, ftf: 65 };
const PUSH_HANDS: Partial<Pose> = { hn: [158, 215], hf: [155, 215] };
const pushTop = (extra: Partial<Pose> = {}): Pose => ({ hip: PU_TOP.hip, torso: PU_TOP.T, ...PUSH_HANDS, ...PUSH_FEET, pe: [-1, -0.5], pef: [-1, -0.5], ...extra }) as Pose;
const pushBot = (extra: Partial<Pose> = {}): Pose => ({ hip: PU_BOT.hip, torso: PU_BOT.T, ...PUSH_HANDS, ...PUSH_FEET, pe: [-1, -0.5], pef: [-1, -0.5], ...extra }) as Pose;

const QUAD: Pose = { hip: [95, 172], torso: 71.3, hn: [142, 214], hf: [138, 214], fn: [55, 212], ff: [51, 212], pk: [0, 1], pkf: [0, 1], ftn: 180, ftf: 180 };

const SUPINE = (extra: Partial<Pose> = {}): Pose => ({ hip: [120, 210], torso: -90, hn: [128, 214], hf: [124, 214], fn: [168, G], ff: [164, G], pk: [0, -1], pkf: [0, -1], pe: [0, 1], pef: [0, 1], ...extra }) as Pose;

const FP = line([20, 208], 10.5); // plancha sobre antebrazos
const IR0 = line([30, 212], 10);
const IR1 = line([30, 212], 28);
const INC_TOP = line([85.5, 208], 48);
const INC_BOT = line([85.5, 208], 25.1);
const KP_TOP = kneeLine([85, 214], 38.3);
const KP_BOT = kneeLine([85, 214], 13.8);

function squatBar(hip: Pt, T: number, mode: 'back' | 'front' | 'goblet'): Pose {
  const s = sh(hip, T);
  if (mode === 'back') return { hip, torso: T, bar: [s[0] - 4, s[1] + 1], hn: [s[0] + 3, s[1] + 6], hf: [s[0] + 1, s[1] + 6], pe: [-1, 0.8], pef: [-1, 0.8], fn: [128, G], ff: [120, G] };
  if (mode === 'front') return { hip, torso: T, bar: [s[0] + 9, s[1] + 2], hn: [s[0] + 8, s[1] + 4], hf: [s[0] + 6, s[1] + 4], pe: [1, 0.2], pef: [1, 0.2], fn: [128, G], ff: [120, G] };
  return { hip, torso: T, hn: [s[0] + 10, s[1] + 20], hf: [s[0] + 8, s[1] + 20], pe: [0.1, 1], pef: [0.1, 1], fn: [128, G], ff: [120, G] };
}

function lungeFrames(hands: (hip: Pt) => Partial<Pose>): AnimSpec['frames'] {
  return [
    { pose: { ...stand(120), fn: [124, G], ff: [118, G], ...hands([120, 132]) }, ms: 700, hold: 150 },
    { pose: { hip: [122, 170], torso: 2, fn: [166, G], ff: [82, 210], ftf: 55, pk: [1, -0.2], pkf: [0, 1], ...hands([122, 170]) } as Pose, ms: 900, hold: 250 },
    { pose: { ...stand(120), fn: [124, G], ff: [118, G], ...hands([120, 132]) }, ms: 900, hold: 150 },
    { pose: { hip: [118, 170], torso: 2, fn: [78, 210], ff: [162, G], ftn: 55, pk: [0, 1], pkf: [1, -0.2], ...hands([118, 170]) } as Pose, ms: 900, hold: 250 },
  ];
}

const ROW_HIP: Pt = [102, 138];
const ROW_SH = sh(ROW_HIP, 75);
const rowFrames = (): AnimSpec['frames'] => [
  { pose: { hip: ROW_HIP, torso: 75, hn: [ROW_SH[0] + 2, ROW_SH[1] + 57], hf: [ROW_SH[0], ROW_SH[1] + 57], fn: [120, G], ff: [114, G], pk: [1, -0.2], pkf: [1, -0.2] }, ms: 800, hold: 100 },
  { pose: { hip: ROW_HIP, torso: 75, hn: [128, 152], hf: [126, 152], fn: [120, G], ff: [114, G], pe: [-1, -0.6], pef: [-1, -0.6], pk: [1, -0.2], pkf: [1, -0.2] }, ms: 700, hold: 300 },
];

const BENCH_TOP: Pose = { hip: [118, 163], torso: -90, hn: [70, 105], hf: [68, 105], fn: [168, G], ff: [164, G], pk: [1, -1], pkf: [1, -1], pe: [0.2, 1], pef: [0.2, 1] };

export const ANIMS: Record<string, AnimSpec> = {
  // ===================== Piernas y peso corporal =====================
  squat: {
    hl: ['thigh', 'shin'],
    frames: [
      { pose: stand(120, { fn: [128, G], ff: [120, G] }), ms: 900, hold: 250 },
      { pose: { hip: [98, 176], torso: 38, hn: [182, 134], hf: [180, 136], fn: [128, G], ff: [120, G] }, ms: 1000, hold: 250 },
    ],
  },
  'jump-squat': {
    hl: ['thigh', 'shin'],
    thumb: 2,
    frames: [
      { pose: stand(120, { fn: [128, G], ff: [120, G] }), ms: 450, hold: 100 },
      { pose: { hip: [100, 172], torso: 36, hn: [96, 160], hf: [94, 160], fn: [128, G], ff: [120, G] }, ms: 550, hold: 60 },
      { pose: { hip: [120, 100], torso: 0, hn: [165, 14], hf: [161, 16], fn: [126, 184], ff: [118, 184], ftn: 70, ftf: 70 }, ms: 260, hold: 60 },
      { pose: { hip: [102, 170], torso: 34, hn: [160, 140], hf: [158, 142], fn: [128, G], ff: [120, G] }, ms: 260, hold: 120 },
    ],
  },
  'wall-sit': {
    hl: ['thigh'],
    props: [{ k: 'wall', x: 70 }],
    thumb: 0,
    frames: [
      { pose: { hip: [80, 172], torso: 0, hn: [112, 170], hf: [110, 170], fn: [124, G], ff: [118, G] }, ms: 1300, hold: 400 },
      { pose: { hip: [80, 170], torso: 0, hn: [112, 168], hf: [110, 168], fn: [124, G], ff: [118, G] }, ms: 1300, hold: 400 },
    ],
  },
  lunge: { hl: ['thigh', 'shin'], frames: lungeFrames(onHips) },
  'lunge-db': { hl: ['thigh', 'shin'], props: [{ k: 'dumbbells' }], frames: lungeFrames((h) => hanging(h, 2)) },
  'jump-lunge': {
    hl: ['thigh', 'shin'],
    frames: [
      { pose: { hip: [122, 170], torso: 2, fn: [166, G], ff: [82, 210], ftf: 55, pk: [1, -0.2], pkf: [0, 1], ...onHips([122, 170]) } as Pose, ms: 300, hold: 90 },
      { pose: { hip: [120, 128], torso: 2, fn: [136, 200], ff: [104, 198], ftn: 50, ftf: 50, ...onHips([120, 128]) } as Pose, ms: 260 },
      { pose: { hip: [118, 170], torso: 2, fn: [78, 210], ff: [162, G], ftn: 55, pk: [0, 1], pkf: [1, -0.2], ...onHips([118, 170]) } as Pose, ms: 260, hold: 90 },
      { pose: { hip: [120, 128], torso: 2, fn: [104, 198], ff: [136, 200], ftn: 50, ftf: 50, ...onHips([120, 128]) } as Pose, ms: 260 },
    ],
  },
  'step-up': {
    hl: ['thigh'],
    props: [{ k: 'box', x: 140, y: 172, w: 50, h: 47 }],
    thumb: 2,
    frames: [
      { pose: stand(104, { fn: [110, G], ff: [102, G] }), ms: 600, hold: 200 },
      { pose: { hip: [114, 134], torso: 6, hn: [120, 140], hf: [112, 140], fn: [156, 168], ff: [104, G] }, ms: 600, hold: 100 },
      { pose: { hip: [150, 86], torso: 2, hn: [156, 92], hf: [150, 92], fn: [156, 168], ff: [148, 168] }, ms: 700, hold: 200 },
      { pose: { hip: [118, 134], torso: 6, hn: [124, 140], hf: [116, 140], fn: [156, 168], ff: [104, G] }, ms: 700, hold: 100 },
    ],
  },
  'calf-raise': {
    hl: ['shin'],
    frames: [
      { pose: stand(120, { fn: [126, G], ff: [118, G] }), ms: 600, hold: 200 },
      { pose: { hip: [121, 123], torso: 0, hn: [125, 130], hf: [123, 130], fn: [126, 205], ff: [118, 205], ftn: 45, ftf: 45 }, ms: 600, hold: 450 },
    ],
  },
  'high-knees': {
    hl: ['thigh'],
    thumb: 0,
    frames: [
      { pose: { hip: [120, 130], torso: 4, hn: [110, 136], hf: [146, 112], fn: [154, 168], ff: [118, 212], ftf: 50, pk: [1, -1] }, ms: 230 },
      { pose: { hip: [120, 130], torso: 4, hn: [146, 112], hf: [110, 136], fn: [122, 212], ff: [154, 168], ftn: 50, pkf: [1, -1] }, ms: 230 },
    ],
  },
  'jumping-jack': {
    view: 'front',
    thumb: 1,
    frames: [
      { pose: { hip: [120, 132], torso: 0, hn: [140, 138], hf: [100, 138], fn: [128, G], ff: [112, G] }, ms: 340, hold: 40 },
      { pose: { hip: [120, 128], torso: 0, hn: [160, 34], hf: [80, 34], fn: [150, 210], ff: [90, 210], pe: [1, 0.2], pef: [-1, 0.2] }, ms: 340, hold: 40 },
    ],
  },
  burpee: {
    thumb: 2,
    frames: [
      { pose: stand(120, { fn: [126, G], ff: [118, G] }), ms: 400, hold: 100 },
      { pose: { hip: [112, 190], torso: 60, hn: [158, 215], hf: [155, 215], fn: [126, G], ff: [118, G], pk: [1, -0.6], pkf: [1, -0.6] }, ms: 380 },
      { pose: pushTop(), ms: 260, hold: 150 },
      { pose: { hip: [112, 190], torso: 60, hn: [158, 215], hf: [155, 215], fn: [126, G], ff: [118, G], pk: [1, -0.6], pkf: [1, -0.6] }, ms: 260 },
      { pose: { hip: [120, 104], torso: 0, hn: [150, 22], hf: [146, 24], fn: [126, 186], ff: [118, 186], ftn: 70, ftf: 70 }, ms: 330, hold: 60 },
    ],
  },
  'mountain-climber': {
    hl: ['thigh', 'torso'],
    thumb: 0,
    frames: [
      { pose: pushTop({ fn: [142, 200], pk: [0.3, 1], ftn: 60 }), ms: 260 },
      { pose: pushTop({ ff: [142, 200], pkf: [0.3, 1], ftf: 60 }), ms: 260 },
    ],
  },
  plank: {
    hl: ['torso'],
    thumb: 0,
    frames: [
      { pose: { hip: FP.hip, torso: FP.T, hn: [178, 214], hf: [174, 214], fn: [20, 208], ff: [16, 208], ftn: 65, ftf: 65, pe: [-0.2, 1], pef: [-0.2, 1] }, ms: 1500, hold: 200 },
      { pose: { hip: add(FP.hip, 0, -2), torso: FP.T - 1, hn: [178, 214], hf: [174, 214], fn: [20, 208], ff: [16, 208], ftn: 65, ftf: 65, pe: [-0.2, 1], pef: [-0.2, 1] }, ms: 1500, hold: 200 },
    ],
  },
  'side-plank': {
    hl: ['torso'],
    thumb: 0,
    frames: [
      { pose: { hip: FP.hip, torso: FP.T, hf: [178, 214], hn: [FP.sh[0] + 2, FP.sh[1] - 62], fn: [20, 208], ff: [20, 208], ftn: 0, ftf: 0, pef: [-0.2, 1], pe: [1, 0] }, ms: 1200, hold: 300 },
      { pose: { hip: [102.8, 201.1], torso: 70, hf: [178, 214], hn: [FP.sh[0] + 2, FP.sh[1] - 62], fn: [20, 208], ff: [20, 208], ftn: 0, ftf: 0, pef: [-0.2, 1], pe: [1, 0] }, ms: 1200, hold: 300 },
    ],
  },
  pushup: {
    hl: ['upper', 'fore', 'torso'],
    frames: [
      { pose: pushTop(), ms: 800, hold: 200 },
      { pose: pushBot(), ms: 1000, hold: 150 },
    ],
  },
  'incline-pushup': {
    hl: ['upper', 'fore', 'torso'],
    props: [{ k: 'box', x: 170, y: 168, w: 46, h: 51 }],
    frames: [
      { pose: { hip: INC_TOP.hip, torso: INC_TOP.T, hn: [180, 168], hf: [177, 168], fn: [85.5, 208], ff: [81.5, 208], ftn: 65, ftf: 65, pe: [-1, -0.5], pef: [-1, -0.5] }, ms: 800, hold: 200 },
      { pose: { hip: INC_BOT.hip, torso: INC_BOT.T, hn: [180, 168], hf: [177, 168], fn: [85.5, 208], ff: [81.5, 208], ftn: 65, ftf: 65, pe: [-1, -0.5], pef: [-1, -0.5] }, ms: 1000, hold: 150 },
    ],
  },
  'knee-pushup': {
    hl: ['upper', 'fore', 'torso'],
    frames: [
      { pose: { hip: KP_TOP.hip, torso: KP_TOP.T, hn: [155, 215], hf: [152, 215], fn: [47, 200], ff: [45, 200], pk: [0, 1], pkf: [0, 1], ftn: 200, ftf: 200, pe: [-1, -0.5], pef: [-1, -0.5] }, ms: 800, hold: 200 },
      { pose: { hip: KP_BOT.hip, torso: KP_BOT.T, hn: [155, 215], hf: [152, 215], fn: [47, 200], ff: [45, 200], pk: [0, 1], pkf: [0, 1], ftn: 200, ftf: 200, pe: [-1, -0.5], pef: [-1, -0.5] }, ms: 1000, hold: 150 },
    ],
  },
  'pushup-rotation': {
    hl: ['upper', 'torso'],
    thumb: 3,
    frames: [
      { pose: pushTop(), ms: 600, hold: 100 },
      { pose: pushBot(), ms: 700, hold: 100 },
      { pose: pushTop(), ms: 600 },
      { pose: pushTop({ hn: [PU_TOP.sh[0] + 2, PU_TOP.sh[1] - 62], pe: [1, 0] }), ms: 650, hold: 350 },
    ],
  },
  'plank-tap': {
    hl: ['torso', 'upper'],
    thumb: 1,
    frames: [
      { pose: pushTop(), ms: 350, hold: 100 },
      { pose: pushTop({ hn: [PU_TOP.sh[0] - 8, PU_TOP.sh[1] + 10], pe: [-0.2, 1] }), ms: 350, hold: 150 },
      { pose: pushTop(), ms: 350, hold: 100 },
      { pose: pushTop({ hf: [PU_TOP.sh[0] - 10, PU_TOP.sh[1] + 10], pef: [-0.2, 1] }), ms: 350, hold: 150 },
    ],
  },
  crunch: {
    hl: ['torso'],
    props: [{ k: 'mat', x: 30, w: 180 }],
    frames: [
      { pose: SUPINE({ hn: [126, 204], hf: [124, 205], pe: [0, -1], pef: [0, -1] }), ms: 700, hold: 150 },
      { pose: SUPINE({ torso: -62, head: 10, hn: [132, 180], hf: [130, 181], pe: [0, -1], pef: [0, -1] }), ms: 700, hold: 250 },
    ],
  },
  'dead-bug': {
    hl: ['torso'],
    props: [{ k: 'mat', x: 20, w: 200 }],
    thumb: 1,
    frames: [
      { pose: SUPINE({ hn: [72, 152], hf: [68, 152], fn: [160, 168], ff: [156, 168], pk: [-1, -1], pkf: [-1, -1], pe: [0, -1], pef: [0, -1] }), ms: 600, hold: 150 },
      { pose: SUPINE({ hn: [16, 198], hf: [68, 152], fn: [160, 168], ff: [198, 200], pk: [-1, -1], pkf: [0, -1], pe: [0, -1], pef: [0, -1] }), ms: 900, hold: 250 },
      { pose: SUPINE({ hn: [72, 152], hf: [68, 152], fn: [160, 168], ff: [156, 168], pk: [-1, -1], pkf: [-1, -1], pe: [0, -1], pef: [0, -1] }), ms: 800, hold: 150 },
      { pose: SUPINE({ hn: [72, 152], hf: [16, 198], fn: [198, 200], ff: [156, 168], pk: [0, -1], pkf: [-1, -1], pe: [0, -1], pef: [0, -1] }), ms: 900, hold: 250 },
    ],
  },
  'bird-dog': {
    hl: ['torso'],
    frames: [
      { pose: QUAD, ms: 600, hold: 150 },
      { pose: { ...QUAD, hn: [198, 148], ff: [14, 164], pe: [0, -1] }, ms: 900, hold: 450 },
      { pose: QUAD, ms: 800, hold: 150 },
      { pose: { ...QUAD, hf: [198, 148], fn: [14, 164], pef: [0, -1] }, ms: 900, hold: 450 },
    ],
  },
  superman: {
    hl: ['torso'],
    props: [{ k: 'mat', x: 20, w: 210 }],
    frames: [
      { pose: { hip: [115, 212], torso: 90, hn: [224, 212], hf: [222, 212], fn: [33, 212], ff: [31, 212], ftn: 180, ftf: 180 }, ms: 700, hold: 150 },
      { pose: { hip: [115, 212], torso: 80, head: -10, hn: [219, 184], hf: [217, 186], fn: [35, 196], ff: [33, 198], ftn: 180, ftf: 180 }, ms: 700, hold: 500 },
    ],
  },
  'glute-bridge': {
    hl: ['thigh', 'torso'],
    props: [{ k: 'mat', x: 30, w: 180 }],
    frames: [
      { pose: SUPINE(), ms: 700, hold: 150 },
      { pose: SUPINE({ hip: [113.3, 185], torso: -120, head: 30, pk: [0.3, -1], pkf: [0.3, -1] }), ms: 700, hold: 500 },
    ],
  },
  'hip-thrust': {
    hl: ['thigh', 'torso'],
    props: [{ k: 'bench', x: 28, y: 172, w: 52 }, { k: 'barbell' }],
    frames: [
      { pose: { hip: [106, 200], torso: -56, head: 10, hn: [110, 190], hf: [108, 190], fn: [160, G], ff: [156, G], pk: [0.2, -1], pkf: [0.2, -1], pe: [0, 1], pef: [0, 1] }, ms: 700, hold: 150 },
      { pose: { hip: [116, 170], torso: -90, head: 20, hn: [118, 162], hf: [116, 162], fn: [160, G], ff: [156, G], pk: [0.2, -1], pkf: [0.2, -1], pe: [0, 1], pef: [0, 1] }, ms: 700, hold: 400 },
    ],
  },
  'childs-pose': {
    thumb: 0,
    frames: [
      { pose: { hip: [84, 198], torso: 105, head: -20, hn: [190, 214], hf: [186, 214], fn: [82, 214], ff: [80, 214], pk: [1, 0], pkf: [1, 0], ftn: 180, ftf: 180, pe: [0, -1], pef: [0, -1] }, ms: 1600, hold: 400 },
      { pose: { hip: [86, 194], torso: 100, head: -18, hn: [190, 214], hf: [186, 214], fn: [82, 214], ff: [80, 214], pk: [1, 0], pkf: [1, 0], ftn: 180, ftf: 180, pe: [0, -1], pef: [0, -1] }, ms: 1600, hold: 400 },
    ],
  },
  'cat-cow': {
    hl: ['torso'],
    frames: [
      { pose: { ...QUAD, curve: -1, head: 35 }, ms: 1200, hold: 350 },
      { pose: { ...QUAD, curve: 1, head: -30 }, ms: 1200, hold: 350 },
    ],
  },
  'hamstring-stretch': {
    hl: ['thigh'],
    frames: [
      { pose: stand(120, { fn: [124, G], ff: [118, G] }), ms: 1200, hold: 300 },
      { pose: { hip: [106, 134], torso: 140, head: 10, hn: [150, 212], hf: [146, 212], fn: [124, G], ff: [118, G], pe: [-1, 0] }, ms: 1400, hold: 900 },
    ],
  },
  'lunge-reach': {
    thumb: 1,
    frames: [
      { pose: { hip: [114, 180], torso: 65, hn: [152, 214], hf: [148, 214], fn: [168, G], ff: [74, 210], ftf: 55, pk: [1, -0.2], pkf: [0, 1] }, ms: 800, hold: 250 },
      { pose: { hip: [114, 180], torso: 62, head: -35, hn: [163, 101], hf: [148, 214], fn: [168, G], ff: [74, 210], ftf: 55, pk: [1, -0.2], pkf: [0, 1], pe: [0, -1] }, ms: 900, hold: 700 },
    ],
  },

  // ===================== Tren superior con peso corporal =====================
  'chair-dip': {
    hl: ['upper', 'fore'],
    props: [{ k: 'bench', x: 52, y: 166, w: 58 }],
    frames: [
      { pose: { hip: [110, 160], torso: 0, hn: [106, 168], hf: [104, 168], fn: [170, G], ff: [166, G], pe: [-1, -0.3], pef: [-1, -0.3], pk: [0.3, -1], pkf: [0.3, -1] }, ms: 700, hold: 150 },
      { pose: { hip: [112, 190], torso: 0, hn: [106, 168], hf: [104, 168], fn: [170, G], ff: [166, G], pe: [-1, -0.3], pef: [-1, -0.3], pk: [0.3, -1], pkf: [0.3, -1] }, ms: 900, hold: 150 },
    ],
  },
  dips: {
    hl: ['upper', 'fore', 'torso'],
    props: [{ k: 'dipbars', x: 119, y: 118 }],
    frames: [
      { pose: { hip: [113, 110], torso: 10, hn: [120, 118], hf: [118, 118], fn: [90, 182], ff: [86, 184], pk: [1, 0], pkf: [1, 0], pe: [-1, -0.2], pef: [-1, -0.2] }, ms: 800, hold: 150 },
      { pose: { hip: [106, 140], torso: 25, hn: [120, 118], hf: [118, 118], fn: [84, 198], ff: [80, 200], pk: [1, 0], pkf: [1, 0], pe: [-1, -0.2], pef: [-1, -0.2] }, ms: 1000, hold: 150 },
    ],
  },
  'pull-up': {
    hl: ['upper', 'torso'],
    ground: false,
    props: [{ k: 'pullbar', x: 120, y: 26 }],
    frames: [
      { pose: { hip: [120, 138], torso: 0, hn: [123, 30], hf: [118, 30], fn: [96, 196], ff: [92, 198], pk: [1, 0], pkf: [1, 0], pe: [0.5, 1], pef: [0.5, 1] }, ms: 900, hold: 200 },
      { pose: { hip: [125, 84], torso: -8, head: 5, hn: [123, 30], hf: [118, 30], fn: [100, 142], ff: [96, 144], pk: [1, 0], pkf: [1, 0], pe: [0.5, 1], pef: [0.5, 1] }, ms: 1000, hold: 250 },
    ],
  },
  'inverted-row': {
    hl: ['upper', 'torso'],
    props: [{ k: 'dipbars', x: 163, y: 128 }],
    frames: [
      { pose: { hip: IR0.hip, torso: IR0.T, hn: [163, 131], hf: [161, 131], fn: [30, 212], ff: [26, 212], ftn: -60, ftf: -60, pe: [-0.6, 1], pef: [-0.6, 1] }, ms: 700, hold: 150 },
      { pose: { hip: IR1.hip, torso: IR1.T, hn: [163, 131], hf: [161, 131], fn: [30, 212], ff: [26, 212], ftn: -60, ftf: -60, pe: [-0.6, 1], pef: [-0.6, 1] }, ms: 800, hold: 250 },
    ],
  },
  'bent-row': { hl: ['upper', 'torso'], props: [{ k: 'barbell' }], frames: rowFrames() },
  'backpack-row': { hl: ['upper', 'torso'], props: [{ k: 'backpack' }], frames: rowFrames() },
  'db-row': {
    hl: ['upper', 'torso'],
    props: [{ k: 'bench', x: 150, y: 166, w: 56 }, { k: 'dumbbells', one: true }],
    frames: [
      { pose: { hip: [98, 138], torso: 75, hn: [148, 182], hf: [170, 166], fn: [112, G], ff: [104, G], pe: [-0.5, 1], pef: [0, 1] }, ms: 800, hold: 100 },
      { pose: { hip: [98, 138], torso: 75, hn: [124, 150], hf: [170, 166], fn: [112, G], ff: [104, G], pe: [-1, -0.7], pef: [0, 1] }, ms: 700, hold: 300 },
    ],
  },
  hspu: {
    hl: ['upper', 'fore'],
    props: [{ k: 'wall', x: 44 }],
    frames: [
      { pose: { hip: [68, 106], torso: 180, hn: [70, 214], hf: [66, 214], fn: [54, 26], ff: [50, 26], pe: [1, 0], pef: [1, 0], pk: [-1, 0], pkf: [-1, 0] }, ms: 800, hold: 200 },
      { pose: { hip: [74, 134], torso: 180, hn: [70, 214], hf: [66, 214], fn: [56, 52], ff: [52, 52], pe: [1, 0], pef: [1, 0], pk: [-1, 0], pkf: [-1, 0] }, ms: 1000, hold: 150 },
    ],
  },
  'muscle-up': {
    hl: ['upper', 'fore', 'torso'],
    ground: false,
    viewBox: [0, 0, 240, 300],
    props: [{ k: 'pullbar', x: 120, y: 100 }],
    thumb: 2,
    frames: [
      { pose: { hip: [122.6, 211.9], torso: -3, hn: [123, 104], hf: [118, 104], fn: [110, 286], ff: [106, 288], pk: [1, 0], pkf: [1, 0], pe: [0.5, 1], pef: [0.5, 1] }, ms: 700, hold: 250 },
      { pose: { hip: [129.1, 161], torso: -20, hn: [123, 104], hf: [118, 104], fn: [146, 232], ff: [142, 234], pk: [1, 0], pkf: [1, 0], pe: [0.3, 1], pef: [0.3, 1] }, ms: 650 },
      { pose: { hip: [106.9, 131.3], torso: 25, hn: [123, 104], hf: [118, 104], fn: [96, 208], ff: [92, 210], pk: [1, 0], pkf: [1, 0], pe: [-1, 0.2], pef: [-1, 0.2] }, ms: 450 },
      { pose: { hip: [113.3, 97.2], torso: 10, hn: [123, 104], hf: [118, 104], fn: [104, 176], ff: [100, 178], pk: [1, 0], pkf: [1, 0], pe: [-1, 0.2], pef: [-1, 0.2] }, ms: 500, hold: 400 },
    ],
  },
  'front-lever': {
    hl: ['torso', 'upper'],
    ground: false,
    props: [{ k: 'pullbar', x: 90, y: 40 }],
    thumb: 0,
    frames: [
      { pose: { hip: [140, 102], torso: -90, hn: [92, 44], hf: [88, 44], fn: [136, 80], ff: [132, 80], pk: [-1, -1], pkf: [-1, -1], ftn: 0, ftf: 0 }, ms: 900, hold: 900 },
      { pose: { hip: [140, 102], torso: -90, hn: [92, 44], hf: [88, 44], fn: [222, 102], ff: [132, 80], pk: [-1, -1], pkf: [-1, -1], ftn: 0, ftf: 0 }, ms: 900, hold: 900 },
    ],
  },
  'dragon-flag': {
    hl: ['torso'],
    props: [{ k: 'bench', x: 28, y: 200, w: 170 }],
    frames: [
      { pose: { hip: [87.1, 149], torso: -160, head: 70, hn: [40, 200], hf: [38, 200], fn: [115.1, 71.9], ff: [113, 73], pe: [0, -1], pef: [0, -1] }, ms: 900, hold: 300 },
      { pose: { hip: [118.3, 183.1], torso: -105, head: 15, hn: [40, 200], hf: [38, 200], fn: [197.5, 161.9], ff: [195.5, 163], pe: [0, -1], pef: [0, -1] }, ms: 1700, hold: 300 },
    ],
  },
  'l-sit': {
    hl: ['torso', 'thigh'],
    props: [{ k: 'parallettes', x: 118, y: 190 }],
    frames: [
      { pose: { hip: [118, 182], torso: 0, hn: [119, 190], hf: [117, 190], fn: [150, 190], ff: [146, 190], pk: [0, -1], pkf: [0, -1] }, ms: 900, hold: 500 },
      { pose: { hip: [118, 182], torso: 0, hn: [119, 190], hf: [117, 190], fn: [200, 182], ff: [198, 184], pk: [0, -1], pkf: [0, -1] }, ms: 900, hold: 900 },
    ],
  },
  'hollow-hold': {
    hl: ['torso'],
    props: [{ k: 'mat', x: 10, w: 210 }],
    thumb: 0,
    frames: [
      { pose: { hip: [120, 210], torso: -80, curve: -0.4, hn: [14, 190], hf: [16, 192], fn: [198, 194], ff: [196, 196], pe: [0, -1], pef: [0, -1], ftn: -10, ftf: -10 }, ms: 1300, hold: 300 },
      { pose: { hip: [120, 208], torso: -78, curve: -0.4, hn: [16, 186], hf: [18, 188], fn: [198, 190], ff: [196, 192], pe: [0, -1], pef: [0, -1], ftn: -10, ftf: -10 }, ms: 1300, hold: 300 },
    ],
  },
  'hanging-leg-raise': {
    hl: ['thigh', 'torso'],
    ground: false,
    props: [{ k: 'pullbar', x: 120, y: 26 }],
    frames: [
      { pose: { hip: [120, 138], torso: 0, hn: [123, 30], hf: [118, 30], fn: [124, 218], ff: [120, 218] }, ms: 900, hold: 200 },
      { pose: { hip: [127, 136], torso: -8, hn: [123, 30], hf: [118, 30], fn: [214, 134], ff: [212, 138], pk: [0, -1], pkf: [0, -1] }, ms: 1000, hold: 300 },
    ],
  },
  'ab-wheel': {
    hl: ['torso'],
    props: [{ k: 'wheel' }],
    frames: [
      { pose: { hip: [76, 176], torso: 58, hn: [120, 200], hf: [118, 200], fn: [34, 212], ff: [30, 212], pk: [0, 1], pkf: [0, 1], ftn: 180, ftf: 180 }, ms: 800, hold: 150 },
      { pose: { hip: [108, 196], torso: 80, hn: [208, 200], hf: [206, 200], fn: [34, 212], ff: [30, 212], pk: [0, 1], pkf: [0, 1], ftn: 180, ftf: 180 }, ms: 1300, hold: 200 },
    ],
  },

  // ===================== Gimnasio: barra, mancuernas y máquinas =====================
  'back-squat': {
    hl: ['thigh', 'shin'],
    props: [{ k: 'barbell' }],
    frames: [
      { pose: squatBar([120, 132], 0, 'back'), ms: 900, hold: 200 },
      { pose: squatBar([96, 176], 42, 'back'), ms: 1100, hold: 200 },
    ],
  },
  'front-squat': {
    hl: ['thigh', 'shin'],
    props: [{ k: 'barbell' }],
    frames: [
      { pose: squatBar([120, 132], 0, 'front'), ms: 900, hold: 200 },
      { pose: squatBar([102, 178], 24, 'front'), ms: 1100, hold: 200 },
    ],
  },
  'goblet-squat': {
    hl: ['thigh', 'shin'],
    props: [{ k: 'kettlebell' }],
    frames: [
      { pose: squatBar([120, 132], 0, 'goblet'), ms: 900, hold: 200 },
      { pose: squatBar([100, 178], 28, 'goblet'), ms: 1100, hold: 200 },
    ],
  },
  deadlift: {
    hl: ['thigh', 'torso'],
    props: [{ k: 'barbell' }],
    thumb: 0,
    frames: [
      { pose: { hip: [95, 170.6], torso: 59.2, hn: [132, 201], hf: [130, 201], fn: [128, G], ff: [120, G], pe: [-0.3, 1], pef: [-0.3, 1] }, ms: 900, hold: 300 },
      { pose: { hip: [120, 132], torso: 0, hn: [127, 139], hf: [125, 139], fn: [128, G], ff: [120, G] }, ms: 1000, hold: 250 },
    ],
  },
  rdl: {
    hl: ['thigh', 'torso'],
    props: [{ k: 'barbell' }],
    frames: [
      { pose: stand(120, { hn: [127, 139], hf: [125, 139], fn: [126, G], ff: [118, G] }), ms: 900, hold: 200 },
      { pose: { hip: [96, 140], torso: 80, hn: [146, 189], hf: [144, 189], fn: [126, G], ff: [118, G] }, ms: 1200, hold: 200 },
    ],
  },
  'rdl-db': {
    hl: ['thigh', 'torso'],
    props: [{ k: 'dumbbells' }],
    frames: [
      { pose: stand(120, { hn: [125, 139], hf: [123, 139], fn: [126, G], ff: [118, G] }), ms: 900, hold: 200 },
      { pose: { hip: [96, 140], torso: 80, hn: [146, 189], hf: [144, 189], fn: [126, G], ff: [118, G] }, ms: 1200, hold: 200 },
    ],
  },
  'bench-press': {
    hl: ['upper', 'fore', 'torso'],
    props: [{ k: 'bench', x: 34, y: 165, w: 118 }, { k: 'barbell' }],
    frames: [
      { pose: BENCH_TOP, ms: 900, hold: 200 },
      { pose: { ...BENCH_TOP, hn: [82, 148], hf: [80, 148] }, ms: 1000, hold: 150 },
    ],
  },
  'incline-db-press': {
    hl: ['upper', 'fore', 'torso'],
    props: [{ k: 'seat', x: 112, y: 176, w: 44, back: 78, backAngle: -55 }, { k: 'dumbbells' }],
    frames: [
      { pose: { hip: [122, 170], torso: -55, hn: [90, 85], hf: [88, 85], fn: [166, G], ff: [162, G], pk: [1, -1], pkf: [1, -1], pe: [0, 1], pef: [0, 1] }, ms: 900, hold: 200 },
      { pose: { hip: [122, 170], torso: -55, hn: [95, 132], hf: [93, 132], fn: [166, G], ff: [162, G], pk: [1, -1], pkf: [1, -1], pe: [0, 1], pef: [0, 1] }, ms: 1000, hold: 150 },
    ],
  },
  'db-floor-press': {
    hl: ['upper', 'fore', 'torso'],
    props: [{ k: 'mat', x: 30, w: 180 }, { k: 'dumbbells' }],
    frames: [
      { pose: SUPINE({ hn: [72, 152], hf: [70, 152], pe: [0, 1], pef: [0, 1] }), ms: 900, hold: 200 },
      { pose: SUPINE({ hn: [80, 192], hf: [78, 192], pe: [0, 1], pef: [0, 1] }), ms: 1000, hold: 200 },
    ],
  },
  ohp: {
    hl: ['upper', 'fore'],
    props: [{ k: 'barbell' }],
    frames: [
      { pose: stand(120, { hn: [129, 86], hf: [127, 86], pe: [0.6, 1], pef: [0.6, 1], fn: [126, G], ff: [118, G] }), ms: 900, hold: 200 },
      { pose: stand(120, { hn: [121, 26], hf: [119, 26], pe: [0.6, 1], pef: [0.6, 1], fn: [126, G], ff: [118, G] }), ms: 1000, hold: 250 },
    ],
  },
  'db-shoulder-press': {
    view: 'front',
    hl: ['upper', 'fore'],
    props: [{ k: 'dumbbells' }],
    frames: [
      { pose: { hip: [120, 132], torso: 0, hn: [152, 64], hf: [88, 64], pe: [1, 0.6], pef: [-1, 0.6], fn: [130, G], ff: [110, G] }, ms: 900, hold: 200 },
      { pose: { hip: [120, 132], torso: 0, hn: [140, 26], hf: [100, 26], pe: [1, 0.6], pef: [-1, 0.6], fn: [130, G], ff: [110, G] }, ms: 1000, hold: 250 },
    ],
  },
  'lateral-raise': {
    view: 'front',
    hl: ['upper'],
    props: [{ k: 'dumbbells' }],
    frames: [
      { pose: { hip: [120, 132], torso: 0, hn: [140, 138], hf: [100, 138], fn: [130, G], ff: [110, G], pe: [0, 1], pef: [0, 1] }, ms: 900, hold: 150 },
      { pose: { hip: [120, 132], torso: 0, hn: [188, 92], hf: [52, 92], fn: [130, G], ff: [110, G], pe: [0, 1], pef: [0, 1] }, ms: 1000, hold: 250 },
    ],
  },
  'cable-fly': {
    view: 'front',
    hl: ['upper', 'torso'],
    props: [{ k: 'cable', x: 228, y: 24, to: 'n' }, { k: 'cable', x: 12, y: 24, to: 'f' }],
    frames: [
      { pose: { hip: [120, 132], torso: 0, hn: [190, 70], hf: [50, 70], fn: [132, G], ff: [108, G], pe: [1, 0.3], pef: [-1, 0.3] }, ms: 900, hold: 150 },
      { pose: { hip: [120, 132], torso: 0, hn: [127, 128], hf: [113, 128], fn: [132, G], ff: [108, G], pe: [1, 0.3], pef: [-1, 0.3] }, ms: 1000, hold: 250 },
    ],
  },
  'bb-curl': {
    hl: ['fore', 'upper'],
    props: [{ k: 'barbell', r: 15 }],
    frames: [
      { pose: stand(120, { hn: [127, 139], hf: [125, 139], pe: [-0.2, 1], pef: [-0.2, 1] }), ms: 800, hold: 150 },
      { pose: stand(120, { hn: [134, 92], hf: [132, 92], pe: [-0.2, 1], pef: [-0.2, 1] }), ms: 900, hold: 200 },
    ],
  },
  'db-curl': {
    hl: ['fore', 'upper'],
    props: [{ k: 'dumbbells' }],
    frames: [
      { pose: stand(120, { hn: [126, 139], hf: [124, 139], pe: [-0.2, 1], pef: [-0.2, 1] }), ms: 800, hold: 150 },
      { pose: stand(120, { hn: [134, 92], hf: [132, 92], pe: [-0.2, 1], pef: [-0.2, 1] }), ms: 900, hold: 200 },
    ],
  },
  'triceps-pushdown': {
    hl: ['upper', 'fore'],
    props: [{ k: 'cable', x: 150, y: 14 }],
    frames: [
      { pose: stand(120, { torso: 8, hn: [142, 112], hf: [140, 112], pe: [-0.3, 1], pef: [-0.3, 1] }), ms: 800, hold: 150 },
      { pose: stand(120, { torso: 8, hn: [137, 140], hf: [135, 140], pe: [-0.3, 1], pef: [-0.3, 1] }), ms: 800, hold: 250 },
    ],
  },
  'overhead-triceps': {
    hl: ['upper', 'fore'],
    props: [{ k: 'dumbbells', one: true }],
    frames: [
      { pose: stand(120, { hn: [101, 64], hf: [100, 64], pe: [0.3, -1], pef: [0.3, -1] }), ms: 900, hold: 150 },
      { pose: stand(120, { hn: [124, 26], hf: [123, 26], pe: [0.3, -1], pef: [0.3, -1] }), ms: 900, hold: 250 },
    ],
  },
  'face-pull': {
    hl: ['upper', 'torso'],
    props: [{ k: 'cable', x: 222, y: 74 }],
    frames: [
      { pose: stand(118, { torso: -4, hn: [174, 84], hf: [172, 84], fn: [126, G], ff: [112, G] }), ms: 800, hold: 150 },
      { pose: stand(118, { torso: -4, hn: [140, 72], hf: [138, 72], pe: [-0.6, -1], pef: [-0.6, -1], fn: [126, G], ff: [112, G] }), ms: 800, hold: 300 },
    ],
  },
  'lat-pulldown': {
    hl: ['upper', 'torso'],
    props: [{ k: 'seat', x: 84, y: 176, w: 56 }, { k: 'legpad', x: 150, y: 158 }, { k: 'cable', x: 116, y: 4 }],
    frames: [
      { pose: { hip: [108, 170], torso: -10, hn: [113, 64], hf: [111, 64], fn: [154, G], ff: [150, G], pe: [-0.3, 1], pef: [-0.3, 1] }, ms: 900, hold: 150 },
      { pose: { hip: [108, 170], torso: -12, hn: [112, 118], hf: [110, 118], fn: [154, G], ff: [150, G], pe: [-0.3, 1], pef: [-0.3, 1] }, ms: 900, hold: 250 },
    ],
  },
  'cable-row': {
    hl: ['upper', 'torso'],
    props: [{ k: 'seat', x: 76, y: 194, w: 48 }, { k: 'box', x: 182, y: 176, w: 8, h: 43 }, { k: 'cable', x: 226, y: 176 }],
    frames: [
      { pose: { hip: [100, 188], torso: 10, hn: [158, 152], hf: [156, 152], fn: [178, 196], ff: [176, 198], pk: [0.2, -1], pkf: [0.2, -1], ftn: -80, ftf: -80 }, ms: 900, hold: 150 },
      { pose: { hip: [100, 188], torso: -4, hn: [120, 160], hf: [118, 160], fn: [178, 196], ff: [176, 198], pk: [0.2, -1], pkf: [0.2, -1], pe: [-1, 0], pef: [-1, 0], ftn: -80, ftf: -80 }, ms: 900, hold: 300 },
    ],
  },
  'chest-press-machine': {
    hl: ['upper', 'fore', 'torso'],
    props: [{ k: 'seat', x: 84, y: 176, w: 50, back: 64, backAngle: -6 }],
    frames: [
      { pose: { hip: [100, 170], torso: -6, hn: [112, 122], hf: [110, 122], fn: [150, G], ff: [146, G], pe: [-1, 0.3], pef: [-1, 0.3] }, ms: 900, hold: 150 },
      { pose: { hip: [100, 170], torso: -6, hn: [150, 124], hf: [148, 124], fn: [150, G], ff: [146, G], pe: [-1, 0.3], pef: [-1, 0.3] }, ms: 900, hold: 250 },
    ],
  },
  'leg-press': {
    hl: ['thigh', 'shin'],
    props: [{ k: 'seat', x: 70, y: 180, w: 40, back: 72, backAngle: -55 }, { k: 'sled', angle: -45 }],
    frames: [
      { pose: { hip: [92, 174], torso: -55, hn: [100, 178], hf: [98, 178], fn: [124, 130], ff: [122, 132], pk: [-1, -1], pkf: [-1, -1], ftn: -45, ftf: -45 }, ms: 1000, hold: 200 },
      { pose: { hip: [92, 174], torso: -55, hn: [100, 178], hf: [98, 178], fn: [140, 110], ff: [138, 112], pk: [-1, -1], pkf: [-1, -1], ftn: -45, ftf: -45 }, ms: 900, hold: 250 },
    ],
  },
  'leg-extension': {
    hl: ['thigh'],
    props: [{ k: 'seat', x: 78, y: 168, w: 66, back: 62, backAngle: -6 }, { k: 'anklepad' }],
    frames: [
      { pose: { hip: [100, 160], torso: -6, hn: [106, 168], hf: [104, 168], fn: [146, 200], ff: [144, 200], pk: [0.5, -1], pkf: [0.5, -1] }, ms: 800, hold: 150 },
      { pose: { hip: [100, 160], torso: -6, hn: [106, 168], hf: [104, 168], fn: [182, 156], ff: [180, 157], pk: [0.5, -1], pkf: [0.5, -1] }, ms: 800, hold: 300 },
    ],
  },
  'leg-curl': {
    hl: ['thigh'],
    props: [{ k: 'bench', x: 36, y: 167, w: 150 }, { k: 'anklepad' }],
    frames: [
      { pose: { hip: [100, 165], torso: 90, hn: [176, 176], hf: [174, 176], fn: [20, 168], ff: [22, 170], pk: [0, 1], pkf: [0, 1], pe: [0, 1], pef: [0, 1], ftn: 180, ftf: 180 }, ms: 800, hold: 150 },
      { pose: { hip: [100, 165], torso: 90, hn: [176, 176], hf: [174, 176], fn: [64, 128], ff: [66, 130], pk: [0, 1], pkf: [0, 1], pe: [0, 1], pef: [0, 1], ftn: -90, ftf: -90 }, ms: 800, hold: 300 },
    ],
  },
  'kb-swing': {
    hl: ['thigh', 'torso'],
    props: [{ k: 'kettlebell' }],
    thumb: 1,
    frames: [
      { pose: { hip: [96, 146], torso: 68, hn: [112, 168], hf: [110, 168], fn: [124, G], ff: [118, G], pe: [0, 1], pef: [0, 1] }, ms: 450, hold: 60 },
      { pose: { hip: [120, 132], torso: -4, hn: [172, 84], hf: [170, 84], fn: [124, G], ff: [118, G], pe: [0, 1], pef: [0, 1] }, ms: 450, hold: 60 },
    ],
  },
  thruster: {
    hl: ['thigh', 'upper'],
    props: [{ k: 'barbell' }],
    thumb: 1,
    frames: [
      { pose: squatBar([102, 178], 24, 'front'), ms: 700, hold: 120 },
      { pose: { hip: [120, 132], torso: 0, hn: [121, 26], hf: [119, 26], pe: [1, 0.2], pef: [1, 0.2], fn: [128, G], ff: [120, G] }, ms: 800, hold: 200 },
    ],
  },
  'box-jump': {
    hl: ['thigh', 'shin'],
    props: [{ k: 'box', x: 150, y: 158, w: 52, h: 61 }],
    thumb: 2,
    frames: [
      { pose: stand(100, { fn: [106, G], ff: [100, G] }), ms: 0, hold: 400 },
      { pose: { hip: [82, 170], torso: 40, hn: [58, 150], hf: [56, 152], fn: [106, G], ff: [100, G] }, ms: 450, hold: 80 },
      { pose: { hip: [132, 94], torso: 10, hn: [176, 30], hf: [172, 32], fn: [150, 144], ff: [146, 146], ftn: 30, ftf: 30 }, ms: 300 },
      { pose: { hip: [160, 112], torso: 35, hn: [226, 90], hf: [222, 92], fn: [180, 154], ff: [172, 154] }, ms: 280, hold: 120 },
      { pose: { hip: [174, 72], torso: 0, hn: [178, 79], hf: [176, 79], fn: [180, 154], ff: [172, 154] }, ms: 600, hold: 600 },
    ],
  },
  'jump-rope': {
    view: 'front',
    hl: ['shin'],
    props: [{ k: 'rope' }],
    thumb: 1,
    frames: [
      { pose: { hip: [120, 128], torso: 0, hn: [146, 128], hf: [94, 128], fn: [126, 210], ff: [114, 210], pe: [1, 0.3], pef: [-1, 0.3], rope: 0 }, ms: 0 },
      { pose: { hip: [120, 118], torso: 0, hn: [146, 118], hf: [94, 118], fn: [126, 200], ff: [114, 200], pe: [1, 0.3], pef: [-1, 0.3], rope: 0.5 }, ms: 240 },
      { pose: { hip: [120, 128], torso: 0, hn: [146, 128], hf: [94, 128], fn: [126, 210], ff: [114, 210], pe: [1, 0.3], pef: [-1, 0.3], rope: 1 }, ms: 240 },
    ],
  },
  walk: {
    thumb: 0,
    frames: [
      { pose: { hip: [122, 134], torso: 2, hn: [106, 138], hf: [142, 134], fn: [146, G], ff: [98, 211], ftf: 30 }, ms: 450 },
      { pose: { hip: [122, 130], torso: 2, hn: [124, 140], hf: [122, 140], fn: [124, G], ff: [124, 192], pkf: [1, -0.3] }, ms: 450 },
      { pose: { hip: [122, 134], torso: 2, hn: [142, 134], hf: [106, 138], fn: [98, 211], ff: [146, G], ftn: 30 }, ms: 450 },
      { pose: { hip: [122, 130], torso: 2, hn: [122, 140], hf: [124, 140], fn: [124, 192], ff: [124, G], pk: [1, -0.3] }, ms: 450 },
    ],
  },
  jog: {
    hl: ['thigh', 'shin'],
    thumb: 0,
    frames: [
      { pose: { hip: [122, 126], torso: 8, hn: [110, 112], hf: [146, 104], fn: [150, 206], ff: [90, 190], ftf: 160 }, ms: 210 },
      { pose: { hip: [122, 132], torso: 8, hn: [128, 118], hf: [126, 118], fn: [126, G], ff: [118, 176] }, ms: 210 },
      { pose: { hip: [122, 126], torso: 8, hn: [146, 104], hf: [110, 112], fn: [90, 190], ff: [150, 206], ftn: 160 }, ms: 210 },
      { pose: { hip: [122, 132], torso: 8, hn: [126, 118], hf: [128, 118], fn: [118, 176], ff: [126, G] }, ms: 210 },
    ],
  },
  sprint: {
    hl: ['thigh', 'shin'],
    thumb: 0,
    frames: [
      { pose: { hip: [122, 124], torso: 14, hn: [106, 116], hf: [154, 96], fn: [158, 204], ff: [84, 168], ftf: 160 }, ms: 170 },
      { pose: { hip: [122, 132], torso: 14, hn: [132, 112], hf: [130, 112], fn: [128, G], ff: [118, 164] }, ms: 170 },
      { pose: { hip: [122, 124], torso: 14, hn: [154, 96], hf: [106, 116], fn: [84, 168], ff: [158, 204], ftn: 160 }, ms: 170 },
      { pose: { hip: [122, 132], torso: 14, hn: [130, 112], hf: [132, 112], fn: [118, 164], ff: [128, G] }, ms: 170 },
    ],
  },
  bulgarian: {
    hl: ['thigh', 'shin'],
    props: [{ k: 'bench', x: 26, y: 168, w: 56 }],
    frames: [
      { pose: { hip: [125, 134], torso: 5, ...onHips([125, 134]), fn: [150, G], ff: [64, 164], ftf: 160, pkf: [0, 1] } as Pose, ms: 900, hold: 150 },
      { pose: { hip: [118, 174], torso: 12, ...onHips([118, 174]), fn: [150, G], ff: [64, 164], ftf: 160, pkf: [0, 1] } as Pose, ms: 1000, hold: 200 },
    ],
  },
  pistol: {
    hl: ['thigh', 'shin'],
    frames: [
      { pose: { hip: [122, 132], torso: 0, hn: [176, 98], hf: [174, 100], fn: [124, G], ff: [146, 204], ftf: -20 }, ms: 1000, hold: 200 },
      { pose: { hip: [104, 192], torso: 38, hn: [186, 150], hf: [184, 152], fn: [124, G], ff: [186, 198], ftf: -60 }, ms: 1300, hold: 250 },
    ],
  },
  'renegade-row': {
    hl: ['upper', 'torso'],
    props: [{ k: 'dumbbells' }],
    thumb: 1,
    frames: [
      { pose: pushTop({ hn: [158, 207], hf: [155, 207] }), ms: 450, hold: 150 },
      { pose: pushTop({ hn: [152, 184], hf: [155, 207], pe: [-0.6, -1] }), ms: 600, hold: 200 },
      { pose: pushTop({ hn: [158, 207], hf: [155, 207] }), ms: 450, hold: 150 },
      { pose: pushTop({ hn: [158, 207], hf: [150, 184], pef: [-0.6, -1] }), ms: 600, hold: 200 },
    ],
  },
};

export const hasAnim = (id: string) => id in ANIMS;
