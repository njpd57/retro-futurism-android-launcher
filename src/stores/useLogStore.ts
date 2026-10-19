import { defineStore } from "pinia";
import { ref } from "vue";
import { formatClock } from "@/utils/tui";

export interface LogLine
{
    id: number;
    time: string;
    tag: string;
    text: string;
}

const MAX_LINES = 30;

/** In-memory ring buffer shown by the log widget. Real events and ambient lines both go through `push`. */
export const useLogStore = defineStore('log', () =>
{
    const lines = ref<LogLine[]>([]);
    let nextId = 0;

    function push(tag: string, text: string)
    {
        lines.value = [...lines.value, { id: nextId++, time: formatClock(new Date(), true), tag, text }].slice(-MAX_LINES);
    }

    return { lines, push };
});
