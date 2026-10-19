import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { ref } from "vue";
import { describeFetchError, fetchJsonViaProxy } from "@/utils/fetchJson";
import { forecastUrl, geocodeUrl, isStale, parseForecast, type Forecast } from "@/utils/weather";
import { nullableJson } from "@/utils/storage";
import { useBridgeEventStore } from "./useBridgeEventStore";

export interface City
{
    name: string;
    lat: number;
    lon: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isCity = (v: unknown): v is City => isObject(v) && typeof v.name === 'string' && typeof v.lat === 'number' && typeof v.lon === 'number';
const isForecast = (v: unknown): v is Forecast => isObject(v) && typeof v.temperature === 'number' && typeof v.code === 'number' && Array.isArray(v.hourly) && typeof v.fetchedAt === 'number';

/** Weather from Open-Meteo (no key). The city is picked once; the last forecast is cached and refreshed when stale. */
export const useWeatherStore = defineStore('weather', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const city = useLocalStorage<City | null>('weather.city', null, { serializer: nullableJson(isCity) });
    const forecast = useLocalStorage<Forecast | null>('weather.forecast', null, { serializer: nullableJson(isForecast) });
    const loading = ref(false);
    const failed = ref(false);
    /** why the last request failed, for the widgets to show */
    const lastError = ref('');

    async function refresh(force = false)
    {
        if (!city.value || loading.value) return;
        if (!force && !isStale(forecast.value?.fetchedAt, Date.now())) return;

        loading.value = true;
        failed.value = false;
        lastError.value = '';
        try
        {
            const parsed = parseForecast(await fetchJsonViaProxy(forecastUrl(city.value.lat, city.value.lon)), Date.now());
            if (parsed) forecast.value = parsed;
            else { failed.value = true; lastError.value = 'RESPUESTA NO VÁLIDA'; }
        }
        catch (err)
        {
            console.error(err);
            failed.value = true;
            lastError.value = describeFetchError(err);
        }
        finally
        {
            loading.value = false;
        }
    }

    async function searchCity(name: string): Promise<City[]>
    {
        const json = await fetchJsonViaProxy(geocodeUrl(name)) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] };
        return (json.results ?? []).map(r => ({ name: r.country ? `${r.name}, ${r.country}` : r.name, lat: r.latitude, lon: r.longitude }));
    }

    function setCity(c: City)
    {
        city.value = c;
        forecast.value = null;
        refresh(true);
    }

    refresh();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'afterResume')
            refresh();
    });

    return { city, forecast, loading, failed, lastError, refresh, searchCity, setCity };
});
