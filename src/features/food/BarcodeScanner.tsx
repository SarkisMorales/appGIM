import { useEffect, useRef, useState } from 'react';
import { CameraOff, Loader2, ScanLine } from 'lucide-react';
import type { Food } from '../../types.ts';
import { getOffProduct } from '../../lib/off.ts';
import { Button, inputCls } from '../../components/ui.tsx';
import { beep, vibrate } from '../../lib/feedback.ts';

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

async function createDetector(): Promise<Detector> {
  const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  const Native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? formats;
      if (formats.some((f) => supported.includes(f))) return new Native({ formats });
    } catch {
      /* usamos el polyfill */
    }
  }
  // iPhone / navegadores sin soporte: lector ZXing en WebAssembly (gratis, se carga solo si hace falta).
  const [{ BarcodeDetector, setZXingModuleOverrides }, wasm] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) });
  return new BarcodeDetector({ formats: formats as never }) as unknown as Detector;
}

export default function BarcodeScanner({ onFound, onNotFound, known }: { onFound: (f: Food) => void; onNotFound: (code: string) => void; known: Food[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'looking' | 'nocam' | 'error'>('starting');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const stopRef = useRef<() => void>(() => {});

  const lookup = async (raw: string) => {
    const c = raw.replace(/\D/g, '');
    if (c.length < 6) return;
    stopRef.current();
    setStatus('looking');
    const local = known.find((f) => f.barcode === c);
    if (local) return onFound(local);
    try {
      const f = await getOffProduct(c);
      if (f) onFound(f);
      else onNotFound(c);
    } catch {
      setStatus('error');
      setMsg('No pudimos consultar el producto (¿sin conexión?). Probá de nuevo o cargalo a mano.');
      setCode(c);
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let busy = false;
    stopRef.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (stopped) return stopRef.current();
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const detector = await createDetector();
        setStatus('scanning');
        let last = 0;
        const tick = async (now: number) => {
          if (stopped) return;
          if (!busy && now - last > 220 && v.readyState >= 2) {
            last = now;
            busy = true;
            try {
              const res = await detector.detect(v);
              if (res[0]?.rawValue && !stopped) {
                beep(1320, 90);
                vibrate(60);
                lookup(res[0].rawValue);
                return;
              }
            } catch {
              /* frame sin código */
            }
            busy = false;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setStatus('nocam');
      }
    })();
    return () => stopRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-64 rounded-2xl border-2 border-white/80">
              <ScanLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70" size={40} />
            </div>
          </div>
        )}
        {(status === 'starting' || status === 'looking') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white">
            <Loader2 className="animate-spin" />
            {status === 'starting' ? 'Abriendo cámara…' : 'Buscando el producto…'}
          </div>
        )}
        {status === 'nocam' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/90">
            <CameraOff />
            No pudimos usar la cámara. Revisá los permisos del navegador o escribí el código abajo.
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-[13px] text-ink-3">Apuntá al código de barras del envase. Los datos vienen de Open Food Facts (gratis).</p>
      {msg && <p className="mt-2 text-center text-[13px] text-danger">{msg}</p>}
      <div className="mt-4 flex gap-2">
        <input inputMode="numeric" className={inputCls} placeholder="O escribí el número del código" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup(code)} />
        <Button variant="primary" className="h-12 shrink-0" onClick={() => lookup(code)} disabled={code.replace(/\D/g, '').length < 6}>
          Buscar
        </Button>
      </div>
    </div>
  );
}
