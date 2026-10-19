/** Calls a Bridge getter that returns JSON text. An empty, missing or malformed answer gives null instead of throwing. */
export function readJson<T>(read: () => string | null | undefined): T | null
{
    try
    {
        const text = read();
        if (!text) return null;
        return (JSON.parse(text) as T | null) ?? null;
    }
    catch (err)
    {
        console.error(err);
        return null;
    }
}
