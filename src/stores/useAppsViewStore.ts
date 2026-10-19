import { defineStore } from 'pinia';
import { ref } from 'vue';

/** Which box of the APPS tab is open (null = the root). Not persisted: a reload starts at the root. */
export const useAppsViewStore = defineStore('appsView', () =>
{
    const box = ref<string | null>(null);

    const open = (id: string) => { box.value = id; };
    const close = () => { box.value = null; };

    return { box, open, close };
});
