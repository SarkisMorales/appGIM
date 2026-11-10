import { Play, X } from 'lucide-react';
import { clearActive, requestAutoResume, useActiveWorkout } from '../../lib/activeWorkout.ts';
import { unlockAudio } from '../../lib/feedback.ts';
import { navigate } from '../../lib/router.ts';

/** Aviso para retomar un entrenamiento que quedó a medias (se cerró la app, tocaste "atrás", etc.). */
export function ResumeBanner({ className }: { className?: string }) {
  const w = useActiveWorkout();
  if (!w) return null;
  return (
    <div className={className}>
      <div className="flex items-center gap-3 rounded-3xl border border-fit/40 bg-fit-soft p-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide text-fit">Entrenamiento sin terminar</div>
          <div className="truncate text-[15px] font-extrabold">{w.title}</div>
          <div className="text-xs text-ink-2">{w.done ? 'Terminado, falta guardarlo' : `Paso ${Math.min(w.idx + 1, w.total)} de ${w.total}`}</div>
        </div>
        <button
          onClick={() => {
            unlockAudio();
            requestAutoResume();
            navigate(`entrenar/${w.routineId}/${w.sessionId}`);
          }}
          className="grad-fit flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold text-white active:scale-95"
        >
          <Play size={16} fill="currentColor" /> Retomar
        </button>
        <button onClick={clearActive} aria-label="Descartar entrenamiento sin terminar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
