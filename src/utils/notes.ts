const TASK = /^\[( |x)\] ?/;

export function isTaskLine(line: string)
{
    return TASK.test(line);
}

/** Flips `[ ]` / `[x]` at the start of the given line; other lines are left alone. */
export function toggleTaskLine(text: string, lineIndex: number)
{
    const lines = text.split('\n');
    const line = lines[lineIndex];
    if (line === undefined || !TASK.test(line)) return text;

    lines[lineIndex] = line.startsWith('[x]') ? line.replace('[x]', '[ ]') : line.replace('[ ]', '[x]');
    return lines.join('\n');
}
