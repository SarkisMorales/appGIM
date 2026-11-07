import { useEffect, useRef } from 'react';
import { Dumbbell } from 'lucide-react';
import { ANIMS } from '../../data/animations.ts';
import { DEFAULT_VIEWBOX, poseAt, poseOfFrame, renderFigure } from './engine.ts';
import { useStore } from '../../store/useStore.ts';
import { cx } from '../ui.tsx';

interface Props {
  anim?: string;
  /** Anima en loop (si las animaciones están activadas y no hay "reducir movimiento"). */
  playing?: boolean;
  /** Fuerza un cuadro fijo. */
  frame?: number;
  speed?: number;
  className?: string;
  title?: string;
}

export function ExerciseFigure({ anim, playing = true, frame, speed = 1, className, title }: Props) {
  const gRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const enabled = useStore((s) => s.settings.animations);
  const spec = anim ? ANIMS[anim] : undefined;

  useEffect(() => {
    const g = gRef.current;
    if (!g || !spec) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!playing || reduced || !enabled || frame != null) {
      g.innerHTML = renderFigure(spec, poseOfFrame(spec, frame ?? spec.thumb ?? 1));
      return;
    }
    let raf = 0;
    let visible = true;
    const start = performance.now();
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '80px' });
    if (svgRef.current) io.observe(svgRef.current);
    const tick = (now: number) => {
      if (visible) g.innerHTML = renderFigure(spec, poseAt(spec, (now - start) * speed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [spec, playing, frame, speed, enabled]);

  if (!spec) {
    return (
      <div className={cx('flex items-center justify-center text-ink-3', className)}>
        <Dumbbell size={28} />
      </div>
    );
  }
  const vb = spec.viewBox ?? DEFAULT_VIEWBOX;
  return (
    <svg ref={svgRef} viewBox={vb.join(' ')} className={className} role="img" aria-label={title ?? 'Animación del ejercicio'}>
      <g ref={gRef} />
    </svg>
  );
}
