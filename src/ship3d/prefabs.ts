import json from './prefabs.json';
import type { Prefab, PrefabsFile } from './prefabData';

/** The prefabs at run time, filled from `prefabs.json` and, in place, by the map editor when it changes them. */
export const PREFABS: Prefab[] = [];

export function applyPrefabs(data: PrefabsFile): void
{
    PREFABS.length = 0;
    PREFABS.push(...structuredClone(data.prefabs));
}

export const prefabById = (id: string): Prefab | undefined => PREFABS.find(p => p.id === id);

applyPrefabs(json as unknown as PrefabsFile);
