import { useMemo, useRef, useState } from 'react';
import { fmt, fmt1 } from '../lib/format.ts';
import { shortDate, WEEKDAYS_3, weekday } from '../lib/dates.ts';

/*
 * Gráficos propios en SVG (sin librerías): marcas finas, grilla recesiva, un solo eje,
 * tooltip al tocar/pasar el mouse y colores validados para daltonismo.
 */

const W = 340;

function useHover<T>(items: T[], toX: (i: number) => number) {
  const ref = useRef<SVGSVGElement>(null);
  const [i, setI] = useState<number | null>(null);
  const onMove = (e: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg || !items.length) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    items.forEach((_, k) => {
      const d = Math.abs(toX(k) - x);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    setI(best);
  };
  return { ref, i, onMove, clear: () => setI(null) };
}

export interface WeightPoint {
  date: string;
  kg: number;
}

/** Media móvil exponencial suavizada para ver la tendencia real del peso. */
export function trend(points: WeightPoint[]): number[] {
  const out: number[] = [];
  let ema = points[0]?.kg ?? 0;
  points.forEach((p, i) => {
    ema = i === 0 ? p.kg : ema + 0.25 * (p.kg - ema);
    out.push(ema);
  });
  return out;
}

export function WeightChart({ points, goal }: { points: WeightPoint[]; goal?: number }) {
  const H = 170;
  const pad = { l: 34, r: 10, t: 14, b: 22 };
  const tr = useMemo(() => trend(points), [points]);
  const ys = [...points.map((p) => p.kg), ...tr, ...(goal ? [goal] : [])];
  let min = Math.floor(Math.min(...ys) - 0.5);
  let max = Math.ceil(Math.max(...ys) + 0.5);
  if (max - min < 3) {
    min -= 1;
    max += 1;
  }
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const span = Math.max(1, t1 - t0);
  const x = (k: number) => (points.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + ((new Date(points[k].date).getTime() - t0) / span) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const hv = useHover(points, x);
  const ticks = [min, (min + max) / 2, max];
  const path = tr.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const sel = hv.i;

  return (
    <div>
      <div className="mb-1 flex items-center gap-4 text-[11px] font-semibold text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink-3" /> Pesaje
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--bal)]" /> Tendencia
        </span>
        {goal && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[var(--d-kcal)]" /> Meta
          </span>
        )}
      </div>
      <svg ref={hv.ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onPointerMove={hv.onMove} onPointerDown={hv.onMove} onPointerLeave={hv.clear} role="img" aria-label="Gráfico de peso">
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)" className="num">
              {fmt1(t)}
            </text>
          </g>
        ))}
        {goal && <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--d-kcal)" strokeWidth={1.5} strokeDasharray="5 4" />}
        <path d={path} fill="none" stroke="var(--bal)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, k) => (
          <circle key={p.date} cx={x(k)} cy={y(p.kg)} r={4} fill="var(--ink-3)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        <text x={pad.l} y={H - 5} fontSize="10" fill="var(--ink-3)">
          {shortDate(points[0].date)}
        </text>
        <text x={W - pad.r} y={H - 5} fontSize="10" fill="var(--ink-3)" textAnchor="end">
          {shortDate(points[points.length - 1].date)}
        </text>
        {sel != null && (
          <g>
            <line x1={x(sel)} x2={x(sel)} y1={pad.t} y2={H - pad.b} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(sel)} cy={y(points[sel].kg)} r={6} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      <div className="num h-5 text-center text-xs text-ink-2">
        {sel != null ? (
          <>
            <b>{shortDate(points[sel].date)}</b>: {fmt1(points[sel].kg)} kg · tendencia {fmt1(tr[sel])} kg
          </>
        ) : (
          <span className="text-ink-3">Tocá el gráfico para ver cada pesaje</span>
        )}
      </div>
    </div>
  );
}

export interface DayBar {
  date: string;
  kcal: number;
  target: number;
  exercise: number;
  logged: boolean;
}

export function WeekBars({ days }: { days: DayBar[] }) {
  const H = 170;
  const pad = { l: 34, r: 8, t: 12, b: 22 };
  const max = Math.max(...days.map((d) => Math.max(d.kcal, d.target)), 1000) * 1.08;
  const slot = (W - pad.l - pad.r) / days.length;
  const bw = Math.min(26, slot - 10);
  const x = (k: number) => pad.l + slot * k + slot / 2;
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const hv = useHover(days, x);
  const ticks = [0, Math.round(max / 2 / 100) * 100, Math.round((max * 0.9) / 100) * 100];
  const sel = hv.i;
  return (
    <div>
      <div className="mb-1 flex items-center gap-4 text-[11px] font-semibold text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--d-kcal)]" /> Consumido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-ink-2" /> Objetivo (con ejercicio)
        </span>
      </div>
      <svg ref={hv.ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onPointerMove={hv.onMove} onPointerDown={hv.onMove} onPointerLeave={hv.clear} role="img" aria-label="Calorías de la semana">
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)" className="num">
              {t >= 1000 ? `${fmt1(t / 1000)}k` : t}
            </text>
          </g>
        ))}
        {days.map((d, k) => {
          const h = Math.max(0, y(0) - y(d.kcal));
          const r = Math.min(4, h / 2);
          const x0 = x(k) - bw / 2;
          const y0 = y(d.kcal);
          return (
            <g key={d.date} opacity={sel == null || sel === k ? 1 : 0.55}>
              {d.kcal > 0 && (
                <path
                  d={`M${x0},${y(0)} L${x0},${y0 + r} Q${x0},${y0} ${x0 + r},${y0} L${x0 + bw - r},${y0} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} L${x0 + bw},${y(0)} Z`}
                  fill="var(--d-kcal)"
                />
              )}
              <line x1={x0 - 4} x2={x0 + bw + 4} y1={y(d.target)} y2={y(d.target)} stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="4 3" />
              <text x={x(k)} y={H - 6} textAnchor="middle" fontSize="10" fontWeight={sel === k ? 700 : 500} fill="var(--ink-3)">
                {WEEKDAYS_3[weekday(d.date) - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="num h-5 text-center text-xs text-ink-2">
        {sel != null ? (
          <>
            <b>{shortDate(days[sel].date)}</b>: {fmt(days[sel].kcal)} / {fmt(days[sel].target)} kcal{days[sel].exercise ? ` · ejercicio +${fmt(days[sel].exercise)}` : ''}
          </>
        ) : (
          <span className="text-ink-3">Tocá una barra para ver el detalle</span>
        )}
      </div>
    </div>
  );
}
