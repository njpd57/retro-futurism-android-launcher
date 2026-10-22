/** Reading and writing what the editor edits, through the dev server's `/__ship/*` endpoints. */

export type Kind = 'plans' | 'materials' | 'prefabs';

export async function loadFile<T>(kind: Kind, name = 'ship'): Promise<T>
{
    const res = await fetch(`/__ship/load?kind=${kind}&name=${name}`);
    if (!res.ok) throw new Error(`no se pudo abrir ${kind}/${name}`);
    return res.json();
}

/** Resolves to null when it went well, else what went wrong. */
export async function saveFile(kind: Kind, text: string, name = 'ship'): Promise<string | null>
{
    const res = await fetch(`/__ship/save?kind=${kind}&name=${name}`, { method: 'POST', body: text });
    return res.ok ? null : await res.text();
}

export interface TextureInfo { name: string; bytes: number }

export async function listTextures(): Promise<TextureInfo[]>
{
    try { return await (await fetch('/__ship/textures')).json(); }
    catch { return []; }
}

export async function uploadTexture(name: string, png: Blob): Promise<string | null>
{
    const res = await fetch(`/__ship/texture?name=${name}`, { method: 'POST', body: png });
    return res.ok ? null : await res.text();
}
