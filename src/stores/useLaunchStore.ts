import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { recordLaunch } from "@/utils/recents";
import { useLogStore } from "./useLogStore";
import { useQuarantineStore } from "./useQuarantineStore";
import { useTubeStore } from "./useTubeStore";

const MAX_RECENTS = 8;

/** The only place that launches apps. Keeps the recents list. */
export const useLaunchStore = defineStore('launch', () =>
{
    const log = useLogStore();
    const tube = useTubeStore();
    const quarantine = useQuarantineStore();

    const recents = useLocalStorage<string[]>('launch.recents', []);

    /** Every route to an app goes through here, so a quarantined one waits at the gate instead of opening. */
    function launch(packageName: string, label?: string)
    {
        if (quarantine.has(packageName))
        {
            quarantine.request(packageName, label ?? packageName);
            return;
        }
        launchNow(packageName, label);
    }

    /** Opens the app with no gate: for the gate itself, once the user has authorized it. */
    function launchNow(packageName: string, label?: string)
    {
        tube.collapseThen(() => Bridge.requestLaunchApp(packageName));
        recents.value = recordLaunch(recents.value, packageName, MAX_RECENTS);
        log.push('RUN', (label ?? packageName).toUpperCase());
    }

    return { recents, launch, launchNow };
});
