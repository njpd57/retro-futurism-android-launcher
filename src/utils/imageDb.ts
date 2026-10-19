import { fitSize, type ImageMeta } from './images';

const DB_NAME = 'crt-images';
const STORE = 'images';

export interface StoredImage extends ImageMeta
{
    blob: Blob;
}

function open(): Promise<IDBDatabase>
{
    return new Promise((resolve, reject) =>
    {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T>
{
    return open().then(db => new Promise<T>((resolve, reject) =>
    {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(req.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    }));
}

/** Every stored image, blobs included. The list is small because images are shrunk on import. */
export async function listStored(): Promise<StoredImage[]>
{
    return request('readonly', s => s.getAll() as IDBRequest<StoredImage[]>);
}

export async function putStored(image: StoredImage): Promise<void>
{
    await request('readwrite', s => s.put(image));
}

export async function deleteStored(id: string): Promise<void>
{
    await request('readwrite', s => s.delete(id));
}

/** Shrinks a picked file to a JPEG that fits the size limit. Null when the file isn't a readable image. */
export async function shrinkImage(file: File): Promise<{ blob: Blob; w: number; h: number } | null>
{
    try
    {
        const bitmap = await createImageBitmap(file);
        const { w, h } = fitSize(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        return blob ? { blob, w, h } : null;
    }
    catch
    {
        return null;
    }
}
