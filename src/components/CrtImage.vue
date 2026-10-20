<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useEffectiveSettings } from '@/stores/useEffectiveSettings';
import { applyCrtColor, applyDuotone, parseColor, type ImageFilter, type Rgb } from '@/utils/crtFilter';

const props = defineProps<{ blob: Blob | null; filter: ImageFilter }>();

const effective = useEffectiveSettings();
const canvas = ref<HTMLCanvasElement | null>(null);
const failed = ref(false);

// the palette lives in CSS variables, so the picture follows the active phosphor
function cssColor(name: string, fallback: Rgb): Rgb
{
    if (!canvas.value) return fallback;
    return parseColor(getComputedStyle(canvas.value).getPropertyValue(name)) ?? fallback;
}

let token = 0;

async function draw()
{
    const el = canvas.value;
    const mine = ++token;
    if (!el || !props.blob) return;

    failed.value = false;
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(props.blob); }
    catch { failed.value = true; return; }
    if (mine !== token) { bitmap.close(); return; }

    el.width = bitmap.width;
    el.height = bitmap.height;
    const ctx = el.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    if (props.filter === 'original') return;

    const image = ctx.getImageData(0, 0, el.width, el.height);
    if (props.filter === 'phosphor')
    {
        applyDuotone(image.data, el.width, cssColor('--ph-bg', [8, 6, 0]), cssColor('--ph', [255, 176, 0]));
    }
    else
    {
        applyCrtColor(image.data);
    }
    ctx.putImageData(image, 0, 0);
}

onMounted(draw);
// the data-phosphor attribute is updated by CrtScreen first, so redraw after the DOM flush
watch(() => [props.blob, props.filter, effective.phosphor, effective.bloom], draw, { flush: 'post' });
</script>

<template>
    <div class="crt-image" :class="filter">
        <canvas v-show="!failed" ref="canvas" />
        <div v-if="failed" class="failed">IMAGEN ILEGIBLE</div>
    </div>
</template>

<style scoped lang="scss">
.crt-image {
    display: flex;
    justify-content: center;
    padding: 6px;
    border: 1px solid var(--ph-dim);

    canvas {
        display: block;
        max-width: 100%;
        max-height: 42vh;
        object-fit: contain;
    }

    &.phosphor canvas { filter: drop-shadow(0 0 calc(5px * var(--bloom)) var(--ph-glow)); }
    &.color canvas { filter: saturate(0.9) drop-shadow(0 0 calc(4px * var(--bloom)) var(--ph-glow)); }
}

.failed { color: var(--ph-dim); padding: 24px 0; }
</style>
