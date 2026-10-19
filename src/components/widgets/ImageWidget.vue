<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useImagesStore } from '@/stores/useImagesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { displayName, indexLabel, wrapIndex } from '@/utils/images';
import { usePausableInterval } from '@/composables/usePausableInterval';
import CrtImage from '@/components/CrtImage.vue';

const props = defineProps<{ id: string }>();

const store = useImagesStore();
const settings = useSettingsStore();
// the picture this window shows; a deleted one falls back to the first
const chosen = useLocalStorage(`widget.images.${props.id}`, '');

const index = computed(() => Math.max(0, store.images.findIndex(i => i.id === chosen.value)));
const current = computed(() => store.images[index.value] ?? null);

function step(by: number)
{
    const next = wrapIndex(index.value, by, store.images.length);
    if (next >= 0) chosen.value = store.images[next].id;
}

// slideshow: advance on its own, a manual step restarts the countdown
const ROTATE_MS = 10000;
const rotation = usePausableInterval(() => step(1), ROTATE_MS);

function stepManual(by: number)
{
    step(by);
    rotation.stop();
    rotation.start();
}

onMounted(() =>
{
    if (!store.loaded) store.load();
    rotation.start();
});
</script>

<template>
    <div class="image-widget">
        <template v-if="current">
            <div class="pressable picture" @click="store.show()">
                <CrtImage :blob="current.blob" :filter="settings.imageFilter" />
            </div>
            <div class="bar">
                <span class="pressable" @click="stepManual(-1)">[«]</span>
                <span class="name">{{ indexLabel(index) }} {{ displayName(current.name, 14) }}</span>
                <span class="pressable" @click="stepManual(1)">[»]</span>
            </div>
        </template>
        <div v-else class="empty pressable" @click="store.show()">
            <div class="dim">{{ store.failed ? 'ALMACÉN NO DISPONIBLE' : store.loaded ? 'SIN IMÁGENES EN MEMORIA' : 'LEYENDO MEMORIA' }}</div>
            <div>[ABRIR VISOR]</div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.picture :deep(canvas) { max-height: 24vh; }
.bar { display: flex; justify-content: space-between; gap: 8px; padding-top: 3px; > .pressable { padding: 0 6px; &:active { @include inverse; } } }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ph-dim); }
.empty { text-align: center; padding: 6px 0; &:active { @include inverse; } }
</style>
