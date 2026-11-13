import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, ImageUp, Loader2, RefreshCw, ScanLine, SwitchCamera, Zap, ZapOff } from 'lucide-react';
import type { Food } from '../../types.ts';
import { lookupProduct, type ProductDraft } from '../../lib/off.ts';
import { extractGtin, isBookCode, isInStoreCode, isValidGtin, lookupVariants } from '../../lib/barcode.ts';
import { Button, cx, inputCls } from '../../components/ui.tsx';
import { beep, vibrate } from '../../lib/feedback.ts';

interface Detector {
  detect(source: ImageBitmapSource | CanvasImageSource): Promise<{ rawValue: string; format?: string }[]>;
}

/** Formatos que aparecen en alimentos: EAN/UPC, cajas ITF-14, GS1-128, QR "GS1 Digital Link", DataMatrix y DataBar. */
const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128', 'code_39', 'qr_code', 'data_matrix', 'databar', 'databar_expanded'];

let detectorPromise: Promise<{ detector: Detector; native: boolean }> | null = null;

/** Lector nativo del navegador (Android/Chrome) si soporta los formatos; si no, ZXing en WebAssembly (iPhone, PC). */
function getDetector() {
  detectorPromise ??= (async () => {
    type NativeCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };
    const Native = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
    if (Native) {
      try {
        const supported = (await Native.getSupportedFormats?.()) ?? WANTED;
        const formats = WANTED.filter((f) => supported.includes(f));
        if (formats.includes('ean_13')) return { detector: new Native({ formats }), native: true };
      } catch {
        /* usamos ZXing */
      }
    }
    const [{ BarcodeDetector, setZXingModuleOverrides }, wasm] = await Promise.all([import('barcode-detector/ponyfill'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
    setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) });
    return { detector: new BarcodeDetector({ formats: WANTED as never }) as unknown as Detector, native: false };
  })();
  detectorPromise.catch(() => (detectorPromise = null));
  return detectorPromise;
}

type TrackCaps = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step?: number }; focusMode?: string[] };
type Status = 'starting' | 'scanning' | 'looking' | 'nocam' | 'error' | 'paused';

const CAM_KEY = 'appgim-camera';

export interface MissingProduct {
  code: string;
  draft?: ProductDraft;
  instore?: boolean;
}

export default function BarcodeScanner({ onFound, onMissing, known }: { onFound: (f: Food) => void; onMissing: (m: MissingProduct) => void; known: Food[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const busyRef = useRef(false);
  const [status, setStatus] = useState<Status>('starting');
  const [camKey, setCamKey] = useState(0);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [hint, setHint] = useState('');
  const [caps, setCaps] = useState<TrackCaps | null>(null);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const lookup = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      const c = extractGtin(raw) ?? raw.replace(/\D/g, '');
      if (c.length < 6) {
        setMsg('Ese código es muy corto. Revisá el número.');
        return;
      }
      busyRef.current = true;
      stopRef.current();
      setStatus('looking');
      setMsg('');
      setCode(c);
      const variants = lookupVariants(c);
      const local = known.find((f) => f.barcode && (variants.includes(f.barcode) || lookupVariants(f.barcode).includes(c)));
      if (local) return onFound(local);
      try {
        const r = await lookupProduct(c);
        if (r.kind === 'found') return onFound(r.food);
        if (r.kind === 'partial') return onMissing({ code: c, draft: r.draft });
        return onMissing({ code: c, instore: isInStoreCode(c) });
      } catch {
        busyRef.current = false;
        setStatus('error');
        setMsg('No pudimos consultar el producto (¿sin conexión?). Probá de nuevo o cargalo a mano.');
      }
    },
    [known, onFound, onMissing],
  );
  // La cámara no debe reiniciarse cada vez que cambia el padre: usamos siempre la última versión de lookup.
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  // Cámara + lectura continua.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let busy = false;
    let last = { code: '', t: 0, n: 0 };
    let frame = 0;
    const canvas = document.createElement('canvas');
    busyRef.current = false;
    stopRef.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
    setStatus('starting');
    setTorch(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(CAM_KEY);
        } catch {
          /* sin storage */
        }
        const base: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
        const tryOpen = (c: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video: c, audio: false });
        try {
          stream = await tryOpen(saved ? { ...base, deviceId: { exact: saved } } : { ...base, facingMode: { ideal: 'environment' } });
        } catch {
          stream = await tryOpen({ facingMode: { ideal: 'environment' } });
        }
        if (stopped) return stopRef.current();
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const c = (track.getCapabilities?.() ?? {}) as TrackCaps;
        setCaps(c);
        // Foco continuo: clave para códigos chicos (yogures, golosinas).
        if (c.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
        const z = (track.getSettings() as { zoom?: number }).zoom;
        setZoom(z ?? 1);
        navigator.mediaDevices
          .enumerateDevices()
          .then((ds) => {
            const vids = ds.filter((d) => d.kind === 'videoinput');
            const back = vids.filter((d) => /back|rear|trasera|environment|posterior/i.test(d.label));
            setCams(back.length > 1 ? back : vids);
          })
          .catch(() => {});
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const { detector, native } = await getDetector();
        if (stopped) return;
        setStatus('scanning');
        const started = performance.now();
        let lastT = 0;
        const tick = async (now: number) => {
          if (stopped) return;
          if (!busy && now - lastT > (native ? 120 : 180) && v.readyState >= 2) {
            lastT = now;
            busy = true;
            try {
              let src: CanvasImageSource = v;
              // Con ZXing alternamos cuadro completo y el centro ampliado: mejora mucho los códigos chicos.
              if (!native && frame++ % 2 === 1 && v.videoWidth) {
                const w = Math.round(v.videoWidth * 0.7);
                const h = Math.round(v.videoHeight * 0.5);
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d', { willReadFrequently: true })!.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
                src = canvas;
              }
              const res = await detector.detect(src);
              for (const r of res) {
                const g = extractGtin(r.rawValue);
                if (!g) {
                  setHint(/^https?:\/\//i.test(r.rawValue) ? 'Ese QR no es de un producto. Apuntá al código de barras.' : '');
                  continue;
                }
                if (!isValidGtin(g)) continue;
                if (isBookCode(g)) {
                  setHint('Ese código es de un libro o revista, no de un alimento.');
                  continue;
                }
                // Dos lecturas iguales seguidas: evita errores de lectura con poca luz.
                last = last.code === g && now - last.t < 1500 ? { code: g, t: now, n: last.n + 1 } : { code: g, t: now, n: 1 };
                if (last.n >= 2) {
                  stopped = true;
                  beep(1320, 90);
                  vibrate(60);
                  lookupRef.current(g);
                  return;
                }
              }
            } catch {
              /* cuadro sin código */
            }
            busy = false;
            if (now - started > 9000) setHint((h) => h || 'Acercá el código, que ocupe el recuadro y esté bien iluminado. Tocá la imagen para enfocar.');
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (!stopped) setStatus('nocam');
      }
    })();
    return () => stopRef.current();
  }, [camKey]);

  // Lectores de código USB/Bluetooth: "tipean" el número muy rápido y terminan con Enter.
  useEffect(() => {
    let buf = '';
    let lastKey = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const now = performance.now();
      if (now - lastKey > 120) buf = '';
      lastKey = now;
      if (e.key === 'Enter') {
        if (buf.replace(/\D/g, '').length >= 8) {
          e.preventDefault();
          lookupRef.current(buf);
        }
        buf = '';
      } else if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setTorchOn = async (on: boolean) => {
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch(on);
    } catch {
      /* sin linterna */
    }
  };

  const setZoomTo = async (z: number) => {
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] });
      setZoom(z);
    } catch {
      /* sin zoom */
    }
  };

  const refocus = async () => {
    const t = trackRef.current;
    if (!t || !caps?.focusMode) return;
    try {
      if (caps.focusMode.includes('single-shot')) {
        await t.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as MediaTrackConstraintSet] });
        setTimeout(() => t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {}), 1500);
      } else if (caps.focusMode.includes('continuous')) {
        await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
      }
    } catch {
      /* ignorar */
    }
  };

  const switchCam = () => {
    const current = trackRef.current?.getSettings().deviceId;
    const i = cams.findIndex((c) => c.deviceId === current);
    const next = cams[(i + 1) % cams.length];
    if (!next) return;
    try {
      localStorage.setItem(CAM_KEY, next.deviceId);
    } catch {
      /* sin storage */
    }
    stopRef.current();
    setCamKey((k) => k + 1);
  };

  /** Foto del código: usa la cámara nativa del teléfono (mejor foco y resolución) o una imagen de la galería. */
  const fromPhoto = async (file: File) => {
    setPhotoBusy(true);
    setMsg('');
    try {
      const { detector } = await getDetector();
      const bmp = await createImageBitmap(file);
      const attempts: (ImageBitmap | HTMLCanvasElement)[] = [bmp];
      const max = Math.max(bmp.width, bmp.height);
      if (max > 1600) {
        const k = 1600 / max;
        const cv = document.createElement('canvas');
        cv.width = Math.round(bmp.width * k);
        cv.height = Math.round(bmp.height * k);
        cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
        attempts.push(cv);
      }
      for (const a of attempts) {
        const res = await detector.detect(a).catch(() => []);
        const g = res.map((r) => extractGtin(r.rawValue)).find((x): x is string => !!x);
        if (g) {
          beep(1320, 90);
          vibrate(60);
          return lookup(g);
        }
      }
      setMsg('No encontramos un código en la foto. Probá más cerca, con buena luz y el código derecho, o escribí el número.');
    } catch {
      setMsg('No pudimos leer esa imagen.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const zoomSteps = caps?.zoom && caps.zoom.max > 1 ? [1, 1.5, 2, 3].filter((z) => z >= (caps.zoom!.min ?? 1) && z <= caps.zoom!.max) : [];

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} playsInline muted onClick={refocus} className="h-full w-full object-cover" />
        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[46%] w-[72%] rounded-2xl border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]">
              <div className="scan-line absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-food/90" />
              <ScanLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50" size={36} />
            </div>
          </div>
        )}
        {status === 'scanning' && (caps?.torch || zoomSteps.length > 1 || cams.length > 1) && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
            {caps?.torch && (
              <button aria-label={torch ? 'Apagar linterna' : 'Encender linterna'} onClick={() => setTorchOn(!torch)} className={cx('flex h-10 w-10 items-center justify-center rounded-full', torch ? 'bg-white text-black' : 'bg-black/50 text-white')}>
                {torch ? <ZapOff size={18} /> : <Zap size={18} />}
              </button>
            )}
            {zoomSteps.length > 1 && (
              <div className="flex rounded-full bg-black/50 p-1">
                {zoomSteps.map((z) => (
                  <button key={z} onClick={() => setZoomTo(z)} className={cx('num h-8 min-w-10 rounded-full px-2 text-[13px] font-bold', Math.abs(zoom - z) < 0.05 ? 'bg-white text-black' : 'text-white')}>
                    {z}×
                  </button>
                ))}
              </div>
            )}
            {cams.length > 1 && (
              <button aria-label="Cambiar de cámara" onClick={switchCam} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
                <SwitchCamera size={18} />
              </button>
            )}
          </div>
        )}
        {(status === 'starting' || status === 'looking') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white">
            <Loader2 className="animate-spin" />
            {status === 'starting' ? 'Abriendo cámara…' : `Buscando el producto ${code}…`}
          </div>
        )}
        {(status === 'nocam' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/90">
            <CameraOff />
            {status === 'nocam' ? 'No pudimos usar la cámara en vivo. Sacale una foto al código, revisá los permisos del navegador o escribí el número.' : 'No pudimos consultar el producto.'}
            <Button size="sm" variant="soft" onClick={() => setCamKey((k) => k + 1)}>
              <RefreshCw size={14} /> Reintentar
            </Button>
          </div>
        )}
      </div>

      {status === 'scanning' && <p className="mt-3 text-center text-[13px] text-ink-3">{hint || 'Apuntá al código de barras del envase. Tocá la imagen para enfocar.'}</p>}
      {msg && <p className="mt-2 text-center text-[13px] text-danger">{msg}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) fromPhoto(f);
        }}
      />
      <Button variant="soft" block className="mt-3" onClick={() => fileRef.current?.click()} disabled={photoBusy || status === 'looking'}>
        {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />} {photoBusy ? 'Leyendo la foto…' : 'Leer el código desde una foto'}
      </Button>

      <div className="mt-3 flex gap-2">
        <input
          inputMode="numeric"
          className={inputCls}
          placeholder="O escribí el número del código"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookup(code)}
          enterKeyHint="search"
        />
        <Button variant="primary" className="h-12 shrink-0" onClick={() => lookup(code)} disabled={code.replace(/\D/g, '').length < 6 || status === 'looking'}>
          Buscar
        </Button>
      </div>
      <p className="mt-3 text-center text-[11px] leading-snug text-ink-3">
        Lee EAN, UPC, ITF-14, GS1 y los QR nuevos de los envases. También funciona con lectores USB o Bluetooth. Datos de Open Food Facts (gratis).
      </p>
    </div>
  );
}
