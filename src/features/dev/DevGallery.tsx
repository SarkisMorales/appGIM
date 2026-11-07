import { ANIMS } from '../../data/animations.ts';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure.tsx';

/** Galería de control visual de todas las animaciones (solo desarrollo: #/dev). */
export default function DevGallery() {
  const ids = Object.keys(ANIMS);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const only = params.get('only')?.split(',');
  const list = only ? ids.filter((i) => only.includes(i)) : ids;
  const cols = Number(params.get('cols') || 4);
  const h = Number(params.get('h') || 96);
  return (
    <div className="p-2">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {list.map((id) => (
          <div key={id} className="rounded-xl border border-line bg-surface p-1">
            <div className="text-[10px] font-bold">{id}</div>
            <div className="flex" style={{ height: h }}>
              {ANIMS[id].frames.map((_, i) => (
                <ExerciseFigure key={i} anim={id} frame={i} className="w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
