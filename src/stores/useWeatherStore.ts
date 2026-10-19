import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { ref } from "vue";
import { forecastUrl, geocodeUrl, isStale, parseForecast, type Forecast } from "@/utils/weather";
import { useBridgeEventStore } from "./useBridgeEventStore";

export interface City
{
    name: string;
    lat: number;
    lon: number;
}

/** Weather from Open-Meteo (no key). The city is picked once; the last forecast is cached and refreshed when stale. */
export const useWeatherStore = defineStore('weather', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const city = useLocalStorage<City | null>('weather.city', null);
    const forecast = useLocalStorage<Forecast | null>('weather.forecast', null);
    const loading = ref(false);
    const failed = ref(false);

    async function refresh(force = false)
    {
        if (!city.value || loading.value) return;
        if (!force && !isStale(forecast.value?.fetchedAt, Date.now())) return;

        loading.value = true;
        failed.value = false;
        try
        {
            const resp = await fetch(forecastUrl(city.value.lat, city.value.lon));
            const parsed = parseForecast(await resp.json(), Date.now());
            if (parsed) forecast.value = parsed; else failed.value = true;
        }
        catch (err)
        {
            console.error(err);
            failed.value = true;
        }
        finally
        {
            loading.value = false;
        }
    }

    async function searchCity(name: string): Promise<City[]>
    {
        const resp = await fetch(geocodeUrl(name));
        const json = await resp.json() as { results?: { name: string; country?: string; latitude: number; longitude: number }[] };
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

    return { city, forecast, loading, failed, refresh, searchCity, setCity };
});
