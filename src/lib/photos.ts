/**
 * Fotos de progreso: se guardan en el propio dispositivo (IndexedDB), achicadas para ocupar poco.
 * No se suben a ningún lado y no entran en el archivo de backup.
 */
export interface ProgressPhoto {
  id: string;
  date: string;
  blob: Blob;
  createdAt: number;
}

const DB = 'appgim-photos';
const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
        t.onabort = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

/** Achica la imagen a un máximo de 1280 px de lado y la pasa a JPEG. */
export async function shrinkImage(file: Blob, max = 1280, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('imagen'))), 'image/jpeg', quality));
}

export async function addPhoto(file: Blob, date: string): Promise<ProgressPhoto> {
  const blob = await shrinkImage(file);
  const p: ProgressPhoto = { id: `${date}-${Date.now().toString(36)}`, date, blob, createdAt: Date.now() };
  await tx('readwrite', (s) => s.put(p));
  return p;
}

export async function listPhotos(): Promise<ProgressPhoto[]> {
  const all = await tx<ProgressPhoto[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}

export function deletePhoto(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id));
}

export function clearPhotos(): Promise<undefined> {
  return tx('readwrite', (s) => s.clear());
}
