import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import { deleteStored, listStored, putStored, shrinkImage, type StoredImage } from "@/utils/imageDb";
import { sortImages } from "@/utils/images";
import { useLogStore } from "./useLogStore";

/**
 * The images the user picked for the viewer. Bridge has no gallery API, so they are imported through the Android file
 * picker, shrunk, and kept in IndexedDB on the phone. They are not part of the backup.
 */
export const useImagesStore = defineStore('images', () =>
{
    const log = useLogStore();

    const open = ref(false);
    const images = shallowRef<StoredImage[]>([]);
    const loaded = ref(false);
    const failed = ref(false);
    const busy = ref(false);
    /** how many of the last picked files could not be read */
    const rejected = ref(0);

    const count = computed(() => images.value.length);

    async function load()
    {
        try
        {
            images.value = sortImages(await listStored());
            failed.value = false;
        }
        catch (e)
        {
            failed.value = true;
            log.push('IMÁGENES', String(e));
        }
        loaded.value = true;
    }

    async function importFiles(files: FileList | File[])
    {
        busy.value = true;
        rejected.value = 0;
        try
        {
            let n = 0;
            for (const file of Array.from(files))
            {
                const small = await shrinkImage(file);
                if (!small) { rejected.value++; continue; }
                const now = Date.now();
                // keep the picking order when several files share a millisecond
                await putStored({ id: `${now}-${n++}`, name: file.name, addedAt: now + n, w: small.w, h: small.h, blob: small.blob });
            }
            await load();
        }
        catch (e)
        {
            failed.value = true;
            log.push('IMÁGENES', String(e));
        }
        finally
        {
            busy.value = false;
        }
    }

    async function remove(id: string)
    {
        try { await deleteStored(id); }
        catch (e) { log.push('IMÁGENES', String(e)); }
        await load();
    }

    function show()
    {
        open.value = true;
        if (!loaded.value) load();
    }

    function close()
    {
        open.value = false;
    }

    return { open, images, count, loaded, failed, busy, rejected, load, importFiles, remove, show, close };
});
