/** Moves `packageName` to the front of the recents list without duplicates, capped at `max`. */
export function recordLaunch(recents: readonly string[], packageName: string, max: number)
{
    return [packageName, ...recents.filter(p => p !== packageName)].slice(0, max);
}
