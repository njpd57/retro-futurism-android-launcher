export const BACKUP_APP = 'crt-launcher';
export const BACKUP_VERSION = 1;
/** Only these key prefixes travel in a backup. MOTHER (key and chat history) is never included. */
export const BACKUP_PREFIXES = ['settings.', 'widget.'];

export interface Backup
{
    app: typeof BACKUP_APP;
    version: number;
    data: Record<string, string>;
}

export const isBackupKey = (key: string) => BACKUP_PREFIXES.some(p => key.startsWith(p));

/** Minimal view of `localStorage`, so the logic is testable without a DOM. */
export interface KeyValueStore
{
    readonly length: number;
    key(i: number): string | null;
    getItem(key: string): string | null;
}

export function createBackup(store: KeyValueStore): Backup
{
    const data: Record<string, string> = {};
    for (let i = 0; i < store.length; i++)
    {
        const key = store.key(i);
        if (!key || !isBackupKey(key)) continue;
        const value = store.getItem(key);
        if (value !== null) data[key] = value;
    }
    return { app: BACKUP_APP, version: BACKUP_VERSION, data };
}

export const serializeBackup = (b: Backup) => JSON.stringify(b);

export type ParsedBackup = { ok: true; data: Record<string, string>; skipped: number } | { ok: false; error: string };

/** Validates pasted text. Unknown keys are dropped (counted in `skipped`), never applied. */
export function parseBackup(text: string): ParsedBackup
{
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { return { ok: false, error: 'TEXTO NO VÁLIDO' }; }

    const b = json as Partial<Backup> | null;
    if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || typeof b.data !== 'object' || b.data === null)
        return { ok: false, error: 'NO ES UN RESPALDO' };
    if (typeof b.version !== 'number' || b.version > BACKUP_VERSION)
        return { ok: false, error: 'VERSIÓN NO COMPATIBLE' };

    const data: Record<string, string> = {};
    let skipped = 0;
    for (const [key, value] of Object.entries(b.data))
    {
        if (isBackupKey(key) && typeof value === 'string') data[key] = value;
        else skipped++;
    }
    return { ok: true, data, skipped };
}
