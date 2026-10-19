export interface Forecast
{
    temperature: number;
    code: number;
    /** next hours, °C */
    hourly: number[];
    /** next days (today first); absent in forecasts cached before it existed */
    daily?: DailyForecast;
    fetchedAt: number;
}

export interface DailyForecast
{
    /** `YYYY-MM-DD` */
    date: string[];
    max: number[];
    min: number[];
    code: number[];
}

export const WEATHER_MAX_AGE_MS = 30 * 60 * 1000;

export function forecastUrl(lat: number, lon: number)
{
    return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m&forecast_hours=12&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=auto`;
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
    const j = json as {
        current?: { temperature_2m?: number; weather_code?: number };
        hourly?: { temperature_2m?: number[] };
        daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; weather_code?: number[] };
    } | null;
    const temperature = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof temperature !== 'number' || typeof code !== 'number') return null;

    const forecast: Forecast = { temperature, code, hourly: (j?.hourly?.temperature_2m ?? []).filter(t => typeof t === 'number'), fetchedAt: now };
    const d = j?.daily;
    if (d?.time && d.temperature_2m_max && d.temperature_2m_min && d.weather_code
        && d.time.length > 0 && [d.temperature_2m_max, d.temperature_2m_min, d.weather_code].every(a => a.length === d.time!.length))
        forecast.daily = { date: d.time, max: d.temperature_2m_max, min: d.temperature_2m_min, code: d.weather_code };
    return forecast;
}

export interface DailyRow
{
    /** `HOY` or `LUN`.. */
    day: string;
    max: number;
    min: number;
    code: number;
}

const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/** Rows for the extended forecast. Dates are `YYYY-MM-DD` in the city's own time zone, read as plain calendar days. */
export function dailyRows(daily: DailyForecast): DailyRow[]
{
    return daily.date.map((date, i) =>
    {
        const [y, m, d] = date.split('-').map(Number);
        const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        return { day: i === 0 ? 'HOY' : DAY_NAMES[weekday], max: Math.round(daily.max[i]), min: Math.round(daily.min[i]), code: daily.code[i] };
    });
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
