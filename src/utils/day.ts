/** `YYYY-MM-DD` in local time. */
export function dayKey(d: Date)
{
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
