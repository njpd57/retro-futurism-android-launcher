<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useImagesStore } from '@/stores/useImagesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IMAGE_FILTERS, nextFilter } from '@/utils/crtFilter';
import { displayName, indexLabel, wrapIndex } from '@/utils/images';
import CrtImage from './CrtImage.vue';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const store = useImagesStore();
const settings = useSettingsStore();

const picker = ref<HTMLInputElement | null>(null);
const selected = ref(0);
const confirmDelete = ref(false);

const current = computed(() => store.images[selected.value] ?? null);
const filterLabel = computed(() => IMAGE_FILTERS.find(f => f.id === settings.imageFilter)?.label ?? '');

// keep the selection inside the list after importing or deleting
watch(() => store.images.length, n => { selected.value = n ? Math.min(selected.value, n - 1) : 0; confirmDelete.value = false; });
watch(selected, () => { confirmDelete.value = false; });

function step(by: number)
{
    const next = wrapIndex(selected.value, by, store.images.length);
    if (next >= 0) selected.value = next;
}

async function onPicked(e: Event)
{
    const input = e.target as HTMLInputElement;
    if (input.files?.length)
    {
        selected.value = 0;
        await store.importFiles(input.files);
    }
    input.value = '';
}

// two taps to delete, so a stray touch doesn't lose a picture
async function remove()
{
    if (!current.value) return;
    if (!confirmDelete.value) { confirmDelete.value = true; return; }
    confirmDelete.value = false;
    await store.remove(current.value.id);
}

// horizontal swipe on the picture moves through the list
let startX = 0;
const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
function onTouchEnd(e: TouchEvent)
{
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
}
</script>

<template>
    <TermMenu title="IMÁGENES" @close="store.close()">
        <input ref="picker" class="picker" type="file" accept="image/*" multiple @change="onPicked" />

        <div v-if="store.failed" class="error">ALMACÉN DE IMÁGENES NO DISPONIBLE</div>
        <div v-else-if="store.busy" class="dim processing">PROCESANDO</div>
        <div v-else-if="!store.images.length" class="dim">{{ store.loaded ? 'SIN IMÁGENES EN MEMORIA' : 'LEYENDO MEMORIA' }}</div>

        <template v-if="current">
            <div data-no-swipe @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
                <CrtImage :blob="current.blob" :filter="settings.imageFilter" />
            </div>
            <div class="caption">
                <span>{{ indexLabel(selected) }} {{ displayName(current.name) }}</span>
                <span class="dim">{{ current.w }}x{{ current.h }}</span>
            </div>
            <div class="nav">
                <span class="pressable" @click="step(-1)">[«]</span>
                <span class="dim">{{ selected + 1 }}/{{ store.count }}</span>
                <span class="pressable" @click="step(1)">[»]</span>
            </div>
        </template>

        <div v-if="store.rejected" class="error">{{ store.rejected }} ARCHIVO(S) NO LEGIBLE(S)</div>

        <MenuItem @click="picker?.click()"><span>[IMPORTAR]</span><span class="dim">SELECTOR</span></MenuItem>
        <MenuItem @click="settings.imageFilter = nextFilter(settings.imageFilter)"><span>[FILTRO]</span><span>{{ filterLabel }}</span></MenuItem>
        <MenuItem v-if="current" :class="{ armed: confirmDelete }" @click="remove"><span>{{ confirmDelete ? '¿BORRAR? TOCA OTRA VEZ' : '[BORRAR]' }}</span></MenuItem>

        <div v-if="store.images.length > 1" class="list">
            <div
                v-for="(img, i) in store.images"
                :key="img.id"
                class="item pressable"
                :class="{ sel: i === selected }"
                @click="selected = i">
                <span>{{ indexLabel(i) }} {{ displayName(img.name) }}</span><span>{{ img.w }}x{{ img.h }}</span>
            </div>
        </div>

        <MenuItem @click="store.close()"><span>[CERRAR]</span><span>ESC</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.picker { display: none; }
.dim { color: var(--ph-dim); }
.error { padding: 4px 0; animation: blink 1.2s steps(2) infinite; }
.processing::after { content: ''; animation: dots 1.2s steps(4) infinite; }
.caption, .nav { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
.nav > .pressable { padding: 0 8px; &:active { @include inverse; } }
.list { max-height: 20vh; overflow-y: auto; border-top: 1px solid var(--ph-dim); margin-top: 4px; }
.item { display: flex; justify-content: space-between; gap: 12px; padding: 1px 4px; font-size: 0.85em; &.sel { @include inverse; } }
.armed { @include inverse; }

@keyframes blink { 50% { opacity: 0.5; } }
@keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
</style>
