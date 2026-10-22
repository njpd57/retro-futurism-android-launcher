import type { ShipData } from '@/ship3d/shipData';

/** The plan being edited, with undo / redo by snapshots (the JSON is small). */
export class Doc<T = ShipData>
{
    data: T;
    private saved: string;
    private past: string[] = [];
    private future: string[] = [];
    private listeners = new Set<() => void>();

    constructor(data: T)
    {
        this.data = structuredClone(data);
        this.saved = JSON.stringify(this.data);
    }

    get dirty() { return JSON.stringify(this.data) !== this.saved; }
    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }

    onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

    /** Call before a change (a drag starts, a field is committed): what is there now becomes the next undo. */
    checkpoint()
    {
        this.past.push(JSON.stringify(this.data));
        if (this.past.length > 200) this.past.shift();
        this.future.length = 0;
    }

    /** Tells everybody the data changed. */
    touch() { for (const fn of this.listeners) fn(); }

    undo()
    {
        const prev = this.past.pop();
        if (prev === undefined) return;
        this.future.push(JSON.stringify(this.data));
        this.data = JSON.parse(prev);
        this.touch();
    }

    redo()
    {
        const next = this.future.pop();
        if (next === undefined) return;
        this.past.push(JSON.stringify(this.data));
        this.data = JSON.parse(next);
        this.touch();
    }

    /** Loads another plan (a file, a variant); the history starts over. */
    replace(data: T, saved = true)
    {
        this.data = structuredClone(data);
        this.past.length = 0;
        this.future.length = 0;
        if (saved) this.saved = JSON.stringify(this.data);
        this.touch();
    }

    markSaved() { this.saved = JSON.stringify(this.data); this.touch(); }

    /** The text that is on disk (or was when it was loaded), to diff against. */
    get savedText() { return JSON.stringify(JSON.parse(this.saved), null, 1); }
    get text() { return JSON.stringify(this.data, null, 1); }
}
