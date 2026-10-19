/** The shape VueUse expects for `serializer` in `useLocalStorage` options. */
export interface Serializer<T>
{
    read: (raw: string) => T;
    write: (value: T) => string;
}

/**
 * Serializer for `useLocalStorage(key, null)` holding an object, array or number or nothing.
 *
 * VueUse picks the "any" serializer for a `null` default, which writes `String(value)`: an object is saved as
 * "[object Object]" and comes back as a string after a reload. This one stores JSON, and anything unreadable
 * (including values saved that way before) or failing `validate` reads as null instead of breaking the page.
 */
export function nullableJson<T>(validate: (value: unknown) => value is T): Serializer<T | null>
{
    return {
        read: raw =>
        {
            try
            {
                const value: unknown = JSON.parse(raw);
                return validate(value) ? value : null;
            }
            catch
            {
                return null;
            }
        },
        write: value => JSON.stringify(value),
    };
}
