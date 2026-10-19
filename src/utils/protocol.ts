export interface ProtocolItem
{
    text: string;
    /** day key (`YYYY-MM-DD`) on which it was ticked; it counts as done only that day */
    doneOn: string;
}

export const MAX_PROTOCOL_ITEMS = 12;
const MAX_TEXT = 28;

export const isDone = (item: ProtocolItem, today: string) => item.doneOn === today;

export function addItem(items: readonly ProtocolItem[], text: string): ProtocolItem[]
{
    const clean = text.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
    if (!clean || items.length >= MAX_PROTOCOL_ITEMS) return [...items];
    return [...items, { text: clean, doneOn: '' }];
}

export function removeItem(items: readonly ProtocolItem[], index: number): ProtocolItem[]
{
    return items.filter((_, i) => i !== index);
}

export function toggleItem(items: readonly ProtocolItem[], index: number, today: string): ProtocolItem[]
{
    return items.map((it, i) => i === index ? { ...it, doneOn: isDone(it, today) ? '' : today } : it);
}

export function progress(items: readonly ProtocolItem[], today: string)
{
    const done = items.filter(i => isDone(i, today)).length;
    return { done, total: items.length, fraction: items.length ? done / items.length : 0 };
}
