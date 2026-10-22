import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed, ref } from "vue";
import { bridgeHas } from "@/utils/bridgeHas";
import { cleanSites, DEFAULT_SITES, FRESH_STATE, isAlive, MAX_SITES, nextState, PROBE_MS, PROBE_TIMEOUT_MS, siteLabel, type SiteState } from "@/utils/sentinel";
import { normalizeHost, pushSample, type Sample } from "@/utils/telemetry";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useLogStore } from "./useLogStore";
import { useSystemStatusStore } from "./useSystemStatusStore";

/**
 * CENTINELA: probes the user's sites every minute while the launcher is on screen. The loop lives here, not in the
 * widget, so the alert fires even when the widget is not visible. Probes go through Bridge's proxy when it has one,
 * which lets us read the HTTP status (a 502 is down); otherwise a no-cors fetch only sees network failures.
 */
export const useSentinelStore = defineStore('sentinel', () =>
{
    const bridgeEvents = useBridgeEventStore();
    const system = useSystemStatusStore();
    const log = useLogStore();

    const stored = useLocalStorage<string[]>('settings.sentinelSites', DEFAULT_SITES);
    const sites = computed(() => cleanSites(stored.value));

    const states = ref<Record<string, SiteState>>({});
    const history = ref<Record<string, Sample[]>>({});
    const stateOf = (url: string): SiteState => states.value[url] ?? FRESH_STATE;

    const down = computed(() => sites.value
        .filter(url => stateOf(url).status === 'down')
        .map(url => ({ host: siteLabel(url), since: stateOf(url).since })));

    /** HTTP status of the site, 0 when only an opaque answer is possible, null when there was none. */
    async function request(url: string): Promise<number | null>
    {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
        try
        {
            if (bridgeHas('getProxyURL'))
                return (await fetch(Bridge.getProxyURL(url), { cache: 'no-store', signal: controller.signal })).status;
            await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
            return 0;
        }
        catch
        {
            return null;
        }
        finally
        {
            window.clearTimeout(timer);
        }
    }

    async function probe(url: string)
    {
        const started = performance.now();
        const status = await request(url);
        if (!sites.value.includes(url)) return; // removed while the request was in flight
        const alive = isAlive(status);
        const before = stateOf(url);
        const after = nextState(before, alive, Date.now());
        states.value = { ...states.value, [url]: after };
        history.value = { ...history.value, [url]: pushSample(history.value[url] ?? [], alive ? Math.round(performance.now() - started) : null) };
        if (before.status !== after.status && (after.status === 'down' || before.status === 'down'))
            log.push('SEN', `${siteLabel(url)} ${after.status === 'down' ? 'CAÍDO' : 'RESTABLECIDO'}`);
    }

    /** With no link at all every site would look down, so nothing is probed (nor alerted) until the link is back. */
    async function probeAll()
    {
        if (system.connectivity?.type === 'none') return;
        await Promise.all(sites.value.map(probe));
    }

    function add(text: string): boolean
    {
        const url = normalizeHost(text);
        if (!url || sites.value.includes(url) || sites.value.length >= MAX_SITES) return false;
        stored.value = [...sites.value, url];
        probe(url);
        return true;
    }

    function remove(url: string)
    {
        stored.value = sites.value.filter(u => u !== url);
        const { [url]: _s, ...restStates } = states.value;
        const { [url]: _h, ...restHistory } = history.value;
        states.value = restStates;
        history.value = restHistory;
    }

    let timer: number | undefined;
    const start = () => { if (timer === undefined) timer = window.setInterval(probeAll, PROBE_MS); };
    const stop = () => { window.clearInterval(timer); timer = undefined; };

    start();
    probeAll();
    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause') stop();
        else if (ev.name === 'afterResume') { probeAll(); start(); }
    });

    return { sites, states, history, down, stateOf, probe, probeAll, add, remove };
});
