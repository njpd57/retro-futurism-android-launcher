import type { BridgeContact } from '@/types/bridge-fork';

/** The default number (the fork lists it first), or null when the contact has none. */
export function primaryNumber(c: BridgeContact): string | null
{
    return (c.phoneNumbers.find(n => n.isPrimary) ?? c.phoneNumbers[0])?.number ?? null;
}

/** Name cut to `max` characters with an ellipsis. */
export function shortName(name: string, max: number)
{
    const n = name.trim();
    return n.length <= max ? n : `${n.slice(0, Math.max(1, max - 1))}…`;
}
