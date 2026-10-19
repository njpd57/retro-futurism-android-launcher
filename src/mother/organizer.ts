import { assignToFolder, cleanFolderName, type Folders } from '@/utils/folders';
import type { ApiMessage } from './chat';

export interface OrganizePlan
{
    /** `apps` are 1-based numbers from the list that was sent */
    folders: { name: string; apps: number[] }[];
    favorites: number[];
}

export const MAX_FOLDERS = 12;
export const MAX_APPS_SENT = 300;

export const ORGANIZE_SYSTEM = `ERES UN ORGANIZADOR DE APPS PARA UN LAUNCHER. RECIBES UNA PETICIÓN Y UNA LISTA NUMERADA DE NOMBRES DE APPS.
RESPONDE SOLO CON UN OBJETO JSON, SIN TEXTO ADICIONAL, CON ESTA FORMA:
{"folders":[{"name":"JUEGOS","apps":[1,4,7]}],"favorites":[2,3]}
REGLAS: USA SOLO LOS NÚMEROS DE LA LISTA. UNA APP EN UNA SOLA CARPETA. MÁXIMO ${MAX_FOLDERS} CARPETAS CON NOMBRES CORTOS EN ESPAÑOL (UNA O DOS PALABRAS).
"favorites" SON LAS APPS QUE LA PETICIÓN PIDE PONER ARRIBA O FIJAR; DÉJALO VACÍO SI NO LO PIDE.
NO CREES CARPETAS PARA UNA SOLA APP. LAS APPS QUE NO ENCAJEN QUEDAN FUERA. SI LA PETICIÓN NO SE PUEDE CUMPLIR, DEVUELVE {"folders":[],"favorites":[]}.`;

/** Messages for the model. Only app names travel, numbered: never package names or usage. */
export function buildOrganizeMessages(labels: readonly string[], request: string): ApiMessage[]
{
    const list = labels.slice(0, MAX_APPS_SENT).map((l, i) => `${i + 1} ${l}`).join('\n');
    return [
        { role: 'system', content: ORGANIZE_SYSTEM },
        { role: 'user', content: `PETICIÓN: ${request.trim()}\nAPPS:\n${list}` },
    ];
}

export type ParsedPlan = { ok: true; plan: OrganizePlan } | { ok: false; error: string };

const isIndex = (n: unknown, count: number): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= count;

/** Validates the model's answer: unknown numbers, repeated apps and odd names are dropped, never trusted. */
export function parsePlan(raw: unknown, count: number): ParsedPlan
{
    let json = raw;
    if (typeof raw === 'string')
    {
        try { json = JSON.parse(raw); }
        catch { return { ok: false, error: 'RESPUESTA NO VÁLIDA' }; }
    }
    const obj = json as { folders?: unknown; favorites?: unknown } | null;
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.folders ?? [])) return { ok: false, error: 'RESPUESTA NO VÁLIDA' };

    const used = new Set<number>();
    const folders: OrganizePlan['folders'] = [];
    const seenNames = new Set<string>();

    for (const f of (obj.folders ?? []) as { name?: unknown; apps?: unknown }[])
    {
        if (folders.length >= MAX_FOLDERS) break;
        const name = typeof f?.name === 'string' ? cleanFolderName(f.name) : '';
        if (!name || seenNames.has(name) || !Array.isArray(f.apps)) continue;

        const apps: number[] = [];
        for (const n of f.apps)
            if (isIndex(n, count) && !used.has(n)) { used.add(n); apps.push(n); }

        if (apps.length < 2) { apps.forEach(n => used.delete(n)); continue; }
        seenNames.add(name);
        folders.push({ name, apps });
    }

    const favorites = Array.isArray(obj.favorites) ? [...new Set((obj.favorites as unknown[]).filter((n): n is number => isIndex(n, count)))] : [];
    return { ok: true, plan: { folders, favorites } };
}

export const isPlanEmpty = (plan: OrganizePlan) => !plan.folders.length && !plan.favorites.length;

/** Lines for the preview: `JUEGOS/ (3): A, B, C`. */
export function describePlan(plan: OrganizePlan, labels: readonly string[]): string[]
{
    const name = (n: number) => (labels[n - 1] ?? '?').toUpperCase();
    const lines = plan.folders.map(f => `${f.name}/ (${f.apps.length}): ${f.apps.map(name).join(', ')}`);
    if (plan.favorites.length) lines.push(`FIJAR: ${plan.favorites.map(name).join(', ')}`);
    return lines;
}

export interface OrganizeState
{
    folders: Folders;
    favorites: string[];
}

/** The folders and favorites after applying the plan. `packages[n - 1]` is the app the model called number n. */
export function applyPlan(current: OrganizeState, plan: OrganizePlan, packages: readonly string[]): OrganizeState
{
    let folders = current.folders;
    for (const f of plan.folders)
        for (const n of f.apps)
            if (packages[n - 1]) folders = assignToFolder(folders, packages[n - 1], f.name);

    const favorites = [...current.favorites];
    for (const n of plan.favorites)
        if (packages[n - 1] && !favorites.includes(packages[n - 1])) favorites.push(packages[n - 1]);

    return { folders, favorites };
}
