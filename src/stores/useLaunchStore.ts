import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { recordLaunch } from "@/utils/recents";
import { useLogStore } from "./useLogStore";
import { useTubeStore } from "./useTubeStore";

const MAX_RECENTS = 8;

/** The only place that launches apps. Keeps the recents list. */
export const useLaunchStore = defineStore('launch', () =>
{
    const log = useLogStore();
    const tube = useTubeStore();

    const recents = useLocalStorage<string[]>('launch.recents', []);

    function launch(packageName: string, label?: string)
    {
        tube.collapseThen(() => Bridge.requestLaunchApp(packageName));
        recents.value = recordLaunch(recents.value, packageName, MAX_RECENTS);
        log.push('RUN', (label ?? packageName).toUpperCase());
    }

    return { recents, launch };
});
