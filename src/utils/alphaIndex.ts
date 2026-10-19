import { simplifyString } from "./misc-utils";

/** `A`..`Z`, or `#` for anything else (digits, symbols). */
export function indexLetter(label: string)
{
    const c = simplifyString(label).charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
}

/** Letters present in the labels, in list order, without repeats. */
export function presentLetters(labels: readonly string[])
{
    const out: string[] = [];
    for (const l of labels)
    {
        const c = indexLetter(l);
        if (out[out.length - 1] !== c && !out.includes(c)) out.push(c);
    }
    return out;
}

/** Index of the first label that starts with `letter`, or -1. */
export function firstIndexOf(labels: readonly string[], letter: string)
{
    return labels.findIndex(l => indexLetter(l) === letter);
}

/** Letter under a touch at `fraction` (0..1) of the strip's height. */
export function letterAt(letters: readonly string[], fraction: number)
{
    if (!letters.length) return null;
    const i = Math.min(letters.length - 1, Math.max(0, Math.floor(fraction * letters.length)));
    return letters[i];
}
