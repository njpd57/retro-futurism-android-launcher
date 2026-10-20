<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import GaugeBar from '@/components/gauges/GaugeBar.vue';
import { valueAt } from '@/utils/gauge';

const props = withDefaults(defineProps<{ modelValue: number; label: string; min?: number; max?: number; step?: number }>(), { min: 0, max: 100, step: 5 });
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void; (e: 'touch'): void }>();

const fraction = computed(() => (props.modelValue - props.min) / (props.max - props.min));
const bar = ref<HTMLElement | null>(null);

function set(v: number)
{
    const next = Math.min(props.max, Math.max(props.min, v));
    if (next !== props.modelValue) emit('update:modelValue', next);
}

const nudge = (dir: -1 | 1) => { emit('touch'); set(props.modelValue + dir * props.step); };

// The bar follows the finger: touch events (pointer events get cancelled once a scroll starts).
// The curvature filter moves the picture, not the layout, so near the edges the value lags a little.
function seek(clientX: number)
{
    const r = bar.value?.getBoundingClientRect();
    if (r && r.width > 0) set(valueAt((clientX - r.left) / r.width, props.min, props.max, props.step));
}

function onTouchStart(e: TouchEvent) { emit('touch'); seek(e.touches[0].clientX); }
function onTouchMove(e: TouchEvent) { e.preventDefault(); seek(e.touches[0].clientX); }

const onMouseMove = (e: MouseEvent) => seek(e.clientX);
function onMouseUp() { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); }
function onMouseDown(e: MouseEvent)
{
    emit('touch');
    seek(e.clientX);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}
onBeforeUnmount(onMouseUp);

function onKey(e: KeyboardEvent)
{
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); nudge(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); nudge(1); }
}
</script>

<template>
    <div class="term-slider" data-no-swipe>
        <div class="head"><span>{{ label }}</span><span>{{ modelValue }}%</span></div>
        <div class="row">
            <span class="btn" @click="nudge(-1)">[-]</span>
            <div
                ref="bar" class="bar" role="slider" tabindex="0" :aria-label="label"
                :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="modelValue"
                @touchstart.passive="onTouchStart" @touchmove="onTouchMove" @mousedown="onMouseDown" @keydown="onKey"
            >
                <GaugeBar :fraction="fraction" :segments="20" />
            </div>
            <span class="btn" @click="nudge(1)">[+]</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.term-slider {
    padding: 4px 10px;

    > .head { display: flex; justify-content: space-between; gap: 12px; }
    > .row { display: flex; align-items: center; gap: 8px; }
    .btn { flex: none; padding: 0 2px; &:active { @include inverse; } }
    .bar {
        flex: 1;
        min-width: 0;
        // a tall hit area around the thin bar; the drag is ours, so no scroll may start here
        padding: 8px 0;
        touch-action: none;
        outline: none;
        &:focus-visible { outline: 1px dashed var(--ph-dim); }
    }
}
</style>
