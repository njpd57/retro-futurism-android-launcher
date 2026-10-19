export function simplifyString(s: string)
{
    return s
        .trim()
        .normalize('NFD')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
