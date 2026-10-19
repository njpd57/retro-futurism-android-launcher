export interface Forecast
{
    temperature: number;
    code: number;
    /** next hours, °C */
    hourly: number[];
    fetchedAt: number;
}

export const WEATHER_MAX_AGE_MS = 30 * 60 * 1000;

export function forecastUrl(lat: number, lon: number)
{
    return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m&forecast_hours=12&timezone=auto`;
}

export function geocodeUrl(name: string)
{
    return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=es`;
}

export function isStale(fetchedAt: number | null | undefined, now: number, maxAgeMs = WEATHER_MAX_AGE_MS)
{
    return fetchedAt == null || now - fetchedAt > maxAgeMs;
}

/** Open-Meteo response to our shape; null when it isn't the expected one. */
export function parseForecast(json: unknown, now: number): Forecast | null
{
    const j = json as { current?: { temperature_2m?: number; weather_code?: number }; hourly?: { temperature_2m?: number[] } } | null;
    const temperature = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof temperature !== 'number' || typeof code !== 'number') return null;

    return { temperature, code, hourly: (j?.hourly?.temperature_2m ?? []).filter(t => typeof t === 'number'), fetchedAt: now };
}

/** WMO weather code to a short Spanish label. */
export function weatherText(code: number)
{
    if (code === 0) return 'DESPEJADO';
    if (code <= 2) return 'POCO NUBLADO';
    if (code === 3) return 'NUBLADO';
    if (code === 45 || code === 48) return 'NIEBLA';
    if (code >= 51 && code <= 57) return 'LLOVIZNA';
    if (code >= 61 && code <= 67) return 'LLUVIA';
    if (code >= 71 && code <= 77) return 'NIEVE';
    if (code >= 80 && code <= 82) return 'CHUBASCOS';
    if (code >= 85 && code <= 86) return 'NIEVE';
    if (code >= 95) return 'TORMENTA';
    return 'DESCONOCIDO';
}
