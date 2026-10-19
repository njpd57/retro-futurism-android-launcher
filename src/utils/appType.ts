/** Short "type" column for an app: the last segment of its package name. */
export function appTypeLabel(packageName: string)
{
    const parts = packageName.split('.').filter(Boolean);
    return parts[parts.length - 1] ?? packageName;
}
