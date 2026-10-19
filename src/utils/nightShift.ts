export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 7;
export const NIGHT_MAX_BLOOM = 0.4;

/** Is the hour inside [start, end)? The range may wrap past midnight (22 -> 7). */
export function isNight(date: Date, start = NIGHT_START_HOUR, end = NIGHT_END_HOUR)
{
    const h = date.getHours();
    return start <= end ? h >= start && h < end : h >= start || h < end;
}
