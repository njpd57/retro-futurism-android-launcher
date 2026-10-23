import { mergePlan, type PlanPart } from './planMerge';
import type { ShipData } from './shipData';

/** The ship's plan as the engine loads it: `plan/global.json` and every `plan/rooms/*.json`, merged (see `planMerge.ts`). */
const global = import.meta.glob<PlanPart>('./plan/global.json', { eager: true, import: 'default' });
const rooms = import.meta.glob<PlanPart>('./plan/rooms/*.json', { eager: true, import: 'default' });

export const bundledPlan: ShipData = mergePlan(
    Object.values(global)[0] ?? {},
    Object.fromEntries(Object.entries(rooms).map(([path, part]) => [path.replace(/^.*\/(.*)\.json$/, '$1'), part])),
);
