import type { AnimSpec, FigSeg, Pose, Prop, Pt } from '../../types.ts';

/**
 * Motor de figura animada.
 * Cada ejercicio define cuadros clave con la cadera, el ángulo del torso y la posición de manos y pies.
 * Codos y rodillas se calculan con cinemática inversa de 2 huesos (con un vector "polo" que indica hacia
 * dónde doblan). Así manos y pies quedan fijos donde corresponde (piso, barra, banco) y el movimiento es natural.
 */

export const BONE = { torso: 50, neck: 17, head: 10.5, upper: 30, fore: 28, thigh: 42, shin: 40, foot: 13 };
export const GROUND_Y = 219;
export const DEFAULT_VIEWBOX: [number, number, number, number] = [0, 0, 240, 240];

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/** Dirección para un ángulo medido desde la vertical (0 = arriba, 90 = derecha). */
export const dir = (deg: number): Pt => [Math.sin(rad(deg)), -Math.cos(rad(deg))];

interface FullPose {
  hip: Pt;
  torso: number;
  head: number;
  hn: Pt;
  hf: Pt;
  fn: Pt;
  ff: Pt;
  pe: Pt;
  pef: Pt;
  pk: Pt;
  pkf: Pt;
  bar?: Pt;
  ftn?: number;
  ftf?: number;
  rope: number;
  curve: number;
}

function normalize(p: Pose, view: 'side' | 'front'): FullPose {
  const front = view === 'front';
  return {
    hip: p.hip,
    torso: p.torso,
    head: p.head ?? 0,
    hn: p.hn,
    hf: p.hf ?? p.hn,
    fn: p.fn,
    ff: p.ff ?? p.fn,
    pe: p.pe ?? (front ? [1, 0.6] : [-0.5, 1]),
    pef: p.pef ?? p.pe ?? (front ? [-1, 0.6] : [-0.5, 1]),
    pk: p.pk ?? (front ? [0.4, -1] : [1, -0.25]),
    pkf: p.pkf ?? p.pk ?? (front ? [-0.4, -1] : [1, -0.25]),
    bar: p.bar,
    ftn: p.ftn,
    ftf: p.ftf ?? p.ftn,
    rope: p.rope ?? 0,
    curve: p.curve ?? 0,
  };
}

function lerpPose(a: FullPose, b: FullPose, t: number): FullPose {
  const opt = (x?: number, y?: number) => (x == null ? y : y == null ? x : lerp(x, y, t));
  return {
    hip: lerpPt(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head, b.head, t),
    hn: lerpPt(a.hn, b.hn, t),
    hf: lerpPt(a.hf, b.hf, t),
    fn: lerpPt(a.fn, b.fn, t),
    ff: lerpPt(a.ff, b.ff, t),
    pe: lerpPt(a.pe, b.pe, t),
    pef: lerpPt(a.pef, b.pef, t),
    pk: lerpPt(a.pk, b.pk, t),
    pkf: lerpPt(a.pkf, b.pkf, t),
    bar: a.bar && b.bar ? lerpPt(a.bar, b.bar, t) : (a.bar ?? b.bar),
    ftn: opt(a.ftn, b.ftn),
    ftf: opt(a.ftf, b.ftf),
    rope: lerp(a.rope, b.rope, t),
    curve: lerp(a.curve, b.curve, t),
  };
}

const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export function cycleMs(spec: AnimSpec): number {
  return spec.frames.reduce((a, f) => a + f.ms + (f.hold ?? 0), 0) || 1;
}

/** Pose interpolada para el tiempo t (ms). */
export function poseAt(spec: AnimSpec, tMs: number): FullPose {
  const view = spec.view ?? 'side';
  const frames = spec.frames.map((f) => normalize(f.pose, view));
  if (frames.length === 1) return frames[0];
  const total = cycleMs(spec);
  let t = ((tMs % total) + total) % total;
  for (let i = 0; i < spec.frames.length; i++) {
    const f = spec.frames[i];
    const prev = frames[(i - 1 + frames.length) % frames.length];
    if (t < f.ms) return lerpPose(prev, frames[i], ease(f.ms ? t / f.ms : 1));
    t -= f.ms;
    const hold = f.hold ?? 0;
    if (t < hold) return frames[i];
    t -= hold;
  }
  return frames[0];
}

export function poseOfFrame(spec: AnimSpec, i: number): FullPose {
  const view = spec.view ?? 'side';
  const f = spec.frames[Math.max(0, Math.min(spec.frames.length - 1, i))];
  return normalize(f.pose, view);
}

/** Cinemática inversa de 2 huesos. Devuelve articulación (codo/rodilla) y extremo (mano/tobillo). */
export function ik(a: Pt, target: Pt, l1: number, l2: number, pole: Pt): { j: Pt; e: Pt } {
  const dx = target[0] - a[0];
  const dy = target[1] - a[1];
  const d = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / d;
  const uy = dy / d;
  const dc = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.5, d));
  const cosA = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const j1: Pt = [a[0] + l1 * (ux * c - uy * s), a[1] + l1 * (ux * s + uy * c)];
  const j2: Pt = [a[0] + l1 * (ux * c + uy * s), a[1] + l1 * (-ux * s + uy * c)];
  const d1 = (j1[0] - a[0]) * pole[0] + (j1[1] - a[1]) * pole[1];
  const d2 = (j2[0] - a[0]) * pole[0] + (j2[1] - a[1]) * pole[1];
  return { j: d1 >= d2 ? j1 : j2, e: [a[0] + ux * dc, a[1] + uy * dc] };
}

export interface Skeleton {
  hip: Pt;
  hipN: Pt;
  hipF: Pt;
  shoulder: Pt;
  shN: Pt;
  shF: Pt;
  head: Pt;
  elbowN: Pt;
  handN: Pt;
  elbowF: Pt;
  handF: Pt;
  kneeN: Pt;
  ankleN: Pt;
  toeN: Pt;
  kneeF: Pt;
  ankleF: Pt;
  toeF: Pt;
  spineCtrl: Pt;
}

export function solve(p: FullPose, view: 'side' | 'front'): Skeleton {
  const td = dir(p.torso);
  const shoulder = add(p.hip, mul(td, BONE.torso));
  const head = add(shoulder, mul(dir(p.torso + p.head), BONE.neck));
  const perp: Pt = [Math.cos(rad(p.torso)), Math.sin(rad(p.torso))];
  const front = view === 'front';
  const shN = front ? add(shoulder, mul(perp, 14)) : shoulder;
  const shF = front ? add(shoulder, mul(perp, -14)) : shoulder;
  const hipN = front ? add(p.hip, mul(perp, 8)) : p.hip;
  const hipF = front ? add(p.hip, mul(perp, -8)) : p.hip;
  const an = ik(shN, p.hn, BONE.upper, BONE.fore, p.pe);
  const af = ik(shF, p.hf, BONE.upper, BONE.fore, p.pef);
  const ln = ik(hipN, p.fn, BONE.thigh, BONE.shin, p.pk);
  const lf = ik(hipF, p.ff, BONE.thigh, BONE.shin, p.pkf);
  const toe = (knee: Pt, ankle: Pt, override: number | undefined, side: 1 | -1): Pt => {
    if (front) return add(ankle, [side * 8, 3]);
    let ang: number;
    if (override != null) ang = rad(override);
    else if (ankle[1] >= GROUND_Y - 12) ang = 0;
    else {
      const sx = ankle[0] - knee[0];
      const sy = ankle[1] - knee[1];
      ang = Math.atan2(-sx, sy);
    }
    return add(ankle, [Math.cos(ang) * BONE.foot, Math.sin(ang) * BONE.foot]);
  };
  const mid = lerpPt(p.hip, shoulder, 0.5);
  const spineCtrl = add(mid, mul(perp, p.curve * 16));
  return {
    hip: p.hip,
    hipN,
    hipF,
    shoulder,
    shN,
    shF,
    head,
    elbowN: an.j,
    handN: an.e,
    elbowF: af.j,
    handF: af.e,
    kneeN: ln.j,
    ankleN: ln.e,
    toeN: toe(ln.j, ln.e, p.ftn, 1),
    kneeF: lf.j,
    ankleF: lf.e,
    toeF: toe(lf.j, lf.e, p.ftf, -1),
    spineCtrl,
  };
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const line = (a: Pt, b: Pt, cls: string, w: number) =>
  `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" class="${cls}" stroke-width="${w}" stroke-linecap="round"/>`;

function plate(c: Pt, r: number) {
  return `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}" class="fig-prop-fill" stroke-width="2.5" opacity="0.92"/><circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${Math.max(2.5, r * 0.18)}" class="fig-metal"/>`;
}

function dumbbell(c: Pt, horizontal = false) {
  if (horizontal) {
    return `<rect x="${f1(c[0] - 11)}" y="${f1(c[1] - 2)}" width="22" height="4" rx="2" class="fig-metal"/><rect x="${f1(c[0] - 13)}" y="${f1(c[1] - 6)}" width="6" height="12" rx="2" class="fig-metal"/><rect x="${f1(c[0] + 7)}" y="${f1(c[1] - 6)}" width="6" height="12" rx="2" class="fig-metal"/>`;
  }
  return `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="7.5" class="fig-metal"/><circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="3" class="fig-prop-fill" stroke-width="0"/>`;
}

function kettlebell(c: Pt) {
  return `<path d="M ${f1(c[0] - 5)} ${f1(c[1] + 2)} q 0 -9 5 -9 q 5 0 5 9" class="fig-prop" stroke-width="3"/><circle cx="${f1(c[0])}" cy="${f1(c[1] + 11)}" r="10" class="fig-metal"/>`;
}

function staticProp(pr: Prop): string {
  switch (pr.k) {
    case 'bench': {
      const a = rad(pr.angle ?? 0);
      const x2 = pr.x + Math.cos(a) * pr.w;
      const y2 = pr.y + Math.sin(a) * pr.w;
      let s = `<line x1="${pr.x}" y1="${pr.y + 4}" x2="${f1(x2)}" y2="${f1(y2 + 4)}" class="fig-prop" stroke-width="9" stroke-linecap="round"/>`;
      if (pr.legs !== false) {
        const y0 = Math.max(pr.y, y2) + 8;
        if (y0 < GROUND_Y - 2) {
          s += `<line x1="${pr.x + 8}" y1="${y0}" x2="${pr.x + 8}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/>`;
          s += `<line x1="${f1(x2 - 8)}" y1="${y0}" x2="${f1(x2 - 8)}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/>`;
        }
      }
      return s;
    }
    case 'box':
      return `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" rx="4" class="fig-prop-fill" stroke-width="2.5"/>`;
    case 'pullbar':
      return `<line x1="${pr.x - 55}" y1="${pr.y}" x2="${pr.x + 55}" y2="${pr.y}" class="fig-prop" stroke-width="5" stroke-linecap="round"/><line x1="${pr.x - 55}" y1="${pr.y}" x2="${pr.x - 55}" y2="${pr.y - 30}" class="fig-prop" stroke-width="4"/><line x1="${pr.x + 55}" y1="${pr.y}" x2="${pr.x + 55}" y2="${pr.y - 30}" class="fig-prop" stroke-width="4"/>`;
    case 'dipbars':
      return `<line x1="${pr.x - 20}" y1="${pr.y}" x2="${pr.x + 20}" y2="${pr.y}" class="fig-prop" stroke-width="6" stroke-linecap="round"/><line x1="${pr.x - 14}" y1="${pr.y}" x2="${pr.x - 14}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/><line x1="${pr.x + 14}" y1="${pr.y}" x2="${pr.x + 14}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/>`;
    case 'parallettes':
      return `<line x1="${pr.x - 14}" y1="${pr.y}" x2="${pr.x + 14}" y2="${pr.y}" class="fig-prop" stroke-width="6" stroke-linecap="round"/><line x1="${pr.x - 10}" y1="${pr.y}" x2="${pr.x - 16}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/><line x1="${pr.x + 10}" y1="${pr.y}" x2="${pr.x + 16}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/>`;
    case 'wall':
      return `<line x1="${pr.x}" y1="10" x2="${pr.x}" y2="${GROUND_Y}" class="fig-prop" stroke-width="6"/>`;
    case 'mat':
      return `<rect x="${pr.x}" y="${GROUND_Y - 3}" width="${pr.w}" height="5" rx="2.5" class="fig-prop-fill" stroke-width="0"/>`;
    case 'seat': {
      let s = `<line x1="${pr.x}" y1="${pr.y}" x2="${pr.x + pr.w}" y2="${pr.y}" class="fig-prop" stroke-width="9" stroke-linecap="round"/>`;
      s += `<line x1="${pr.x + pr.w / 2}" y1="${pr.y + 5}" x2="${pr.x + pr.w / 2}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/>`;
      if (pr.back) {
        const a = rad(pr.backAngle ?? 0);
        const bx = pr.x + Math.sin(a) * pr.back;
        const by = pr.y - Math.cos(a) * pr.back;
        s += `<line x1="${pr.x - 4}" y1="${pr.y}" x2="${f1(bx - 4)}" y2="${f1(by)}" class="fig-prop" stroke-width="9" stroke-linecap="round"/>`;
      }
      return s;
    }
    case 'legpad':
      return `<circle cx="${pr.x}" cy="${pr.y}" r="7" class="fig-prop-fill" stroke-width="2.5"/>`;
    case 'chair': {
      const s = pr.flip ? -1 : 1;
      return `<line x1="${pr.x}" y1="${pr.y}" x2="${pr.x + 44 * s}" y2="${pr.y}" class="fig-prop" stroke-width="7" stroke-linecap="round"/><line x1="${pr.x + 4 * s}" y1="${pr.y}" x2="${pr.x + 4 * s}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/><line x1="${pr.x + 40 * s}" y1="${pr.y}" x2="${pr.x + 40 * s}" y2="${GROUND_Y}" class="fig-prop" stroke-width="4"/><line x1="${pr.x + 40 * s}" y1="${pr.y}" x2="${pr.x + 44 * s}" y2="${pr.y - 46}" class="fig-prop" stroke-width="5" stroke-linecap="round"/>`;
    }
    default:
      return '';
  }
}

const STATIC = new Set(['bench', 'box', 'pullbar', 'dipbars', 'parallettes', 'wall', 'mat', 'seat', 'legpad', 'chair']);

export function renderFigure(spec: AnimSpec, pose: FullPose): string {
  const view = spec.view ?? 'side';
  const sk = solve(pose, view);
  const hl = new Set<FigSeg>(spec.hl ?? []);
  const props = spec.props ?? [];
  const W = 9;
  const front = view === 'front';
  const cls = (seg: FigSeg) => (hl.has(seg) ? 'fig-hl' : 'fig-body');
  const parts: string[] = [];

  if (spec.ground !== false) parts.push(`<line x1="4" y1="${GROUND_Y + 2}" x2="236" y2="${GROUND_Y + 2}" class="fig-ground" stroke-width="3" stroke-linecap="round"/>`);
  for (const pr of props) if (STATIC.has(pr.k)) parts.push(staticProp(pr));

  const has = (k: Prop['k']) => props.some((p) => p.k === k);
  const handsMid = lerpPt(sk.handN, sk.handF, 0.5);
  const farCls = front ? '' : ' fig-far';

  // Soga (detrás)
  if (has('rope')) {
    const ph = pose.rope % 1;
    const over = Math.cos(ph * 2 * Math.PI); // 1 = arriba, -1 = abajo
    const top = sk.head[1] - 34;
    const bottom = Math.max(sk.ankleN[1], sk.ankleF[1]) + 12;
    const cy = lerp(bottom, top, (over + 1) / 2);
    const cx = handsMid[0] + (front ? 0 : 12 * Math.sin(ph * 2 * Math.PI));
    parts.push(
      `<path d="M ${f1(sk.handF[0])} ${f1(sk.handF[1])} Q ${f1(cx)} ${f1(2 * cy - (sk.handF[1] + sk.handN[1]) / 2)} ${f1(sk.handN[0])} ${f1(sk.handN[1])}" class="fig-prop" stroke-width="2.5" fill="none" opacity="${over > 0 ? 0.55 : 1}"/>`,
    );
  }

  // Extremidades lejanas
  parts.push(`<g class="${farCls.trim()}">`);
  parts.push(line(sk.hipF, sk.kneeF, cls('thigh'), W));
  parts.push(line(sk.kneeF, sk.ankleF, cls('shin'), W));
  parts.push(line(sk.ankleF, sk.toeF, 'fig-body', 7));
  parts.push(line(sk.shF, sk.elbowF, cls('upper'), W));
  parts.push(line(sk.elbowF, sk.handF, cls('fore'), W));
  if (props.some((p) => p.k === 'dumbbells' && !p.one) && !front) parts.push(dumbbell(sk.handF));
  parts.push('</g>');

  // Torso (con curvatura opcional) y cabeza
  if (front) {
    parts.push(line(sk.shN, sk.shF, cls('torso'), W));
    parts.push(line(sk.hipN, sk.hipF, cls('torso'), W));
  }
  parts.push(
    `<path d="M ${f1(sk.hip[0])} ${f1(sk.hip[1])} Q ${f1(sk.spineCtrl[0])} ${f1(sk.spineCtrl[1])} ${f1(sk.shoulder[0])} ${f1(sk.shoulder[1])}" class="${cls('torso')}" stroke-width="13" stroke-linecap="round" fill="none"/>`,
  );
  parts.push(line(sk.shoulder, lerpPt(sk.shoulder, sk.head, 0.45), 'fig-body', 7));
  parts.push(`<circle cx="${f1(sk.head[0])}" cy="${f1(sk.head[1])}" r="${BONE.head}" class="fig-head"/>`);

  // Extremidades cercanas
  parts.push(line(sk.hipN, sk.kneeN, cls('thigh'), W));
  parts.push(line(sk.kneeN, sk.ankleN, cls('shin'), W));
  parts.push(line(sk.ankleN, sk.toeN, 'fig-body', 7));
  parts.push(line(sk.shN, sk.elbowN, cls('upper'), W));
  parts.push(line(sk.elbowN, sk.handN, cls('fore'), W));

  // Elementos dinámicos
  for (const pr of props) {
    switch (pr.k) {
      case 'barbell':
        if (front) {
          parts.push(
            `<line x1="${f1(sk.handF[0] - 26)}" y1="${f1(sk.handF[1])}" x2="${f1(sk.handN[0] + 26)}" y2="${f1(sk.handN[1])}" class="fig-prop" stroke-width="4" stroke-linecap="round"/>`,
          );
        } else parts.push(plate(pose.bar ?? handsMid, pr.r ?? 18));
        break;
      case 'plate':
        parts.push(plate(pose.bar ?? handsMid, 12));
        break;
      case 'dumbbells':
        parts.push(dumbbell(sk.handN, front));
        if (front && !pr.one) parts.push(dumbbell(sk.handF, true));
        break;
      case 'kettlebell':
        parts.push(kettlebell(handsMid));
        break;
      case 'cable': {
        const h = pr.to === 'n' ? sk.handN : pr.to === 'f' ? sk.handF : handsMid;
        parts.push(`<line x1="${pr.x}" y1="${pr.y}" x2="${f1(h[0])}" y2="${f1(h[1])}" class="fig-prop" stroke-width="2"/>`);
        parts.push(`<circle cx="${pr.x}" cy="${pr.y}" r="5" class="fig-prop-fill" stroke-width="2"/>`);
        parts.push(`<circle cx="${f1(h[0])}" cy="${f1(h[1])}" r="3.5" class="fig-metal"/>`);
        break;
      }
      case 'wheel':
        parts.push(`<circle cx="${f1(handsMid[0])}" cy="${f1(handsMid[1] + 10)}" r="9" class="fig-prop-fill" stroke-width="3"/>`);
        break;
      case 'backpack':
        parts.push(`<rect x="${f1(sk.handN[0] - 9)}" y="${f1(sk.handN[1] - 2)}" width="18" height="22" rx="6" class="fig-prop-fill" stroke-width="2.5"/>`);
        break;
      case 'anklepad':
        parts.push(`<circle cx="${f1(sk.ankleN[0])}" cy="${f1(sk.ankleN[1])}" r="7" class="fig-prop-fill" stroke-width="2.5"/>`);
        break;
      case 'sled': {
        const a = rad(pr.angle);
        const c = sk.toeN;
        const ux = Math.cos(a + Math.PI / 2) * 22;
        const uy = Math.sin(a + Math.PI / 2) * 22;
        parts.push(
          `<line x1="${f1(c[0] - ux)}" y1="${f1(c[1] - uy)}" x2="${f1(c[0] + ux)}" y2="${f1(c[1] + uy)}" class="fig-prop" stroke-width="7" stroke-linecap="round"/>`,
        );
        break;
      }
      default:
        break;
    }
  }
  return parts.join('');
}
