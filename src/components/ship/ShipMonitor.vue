<script setup lang="ts">
import { computed } from 'vue';
import TuiWindow from '@/components/TuiWindow.vue';
import WidgetBoundary from '@/components/WidgetBoundary.vue';
import { monitorWidgets } from '@/ship3d/cards';
import type { ScreenDef } from '@/ship3d/world';
import { WIDGETS } from '@/widgets/registry';

/**
 * The widgets of a monitor in focus, as real HTML laid on its glass: `transform` is the projective map from this
 * `width` x `height` box to where the glass is on the canvas, so it follows the camera as it comes up to the monitor.
 */
const props = defineProps<{ screen: ScreenDef; width: number; height: number; transform: string | null }>();

const widgets = computed(() => monitorWidgets(props.screen.id, props.screen.zone).filter(w => w.kind in WIDGETS));
/** one widget fills the glass; several are stacked at dashboard height and the glass scrolls */
const single = computed(() => widgets.value.length === 1);
const rowHeight = (rows: number) => `calc(7.5em * ${rows} + 10px * ${rows - 1})`;
</script>

<template>
    <div
        class="ship-monitor"
        :class="{ hidden: !transform }"
        :style="{ width: `${width}px`, height: `${height}px`, transform: transform ?? undefined }"
        data-no-swipe
    >
        <div class="stack" :class="{ single }">
            <div v-for="w in widgets" :key="w.kind" class="slot" :style="single ? undefined : { height: rowHeight(w.rows) }">
                <TuiWindow :title="WIDGETS[w.kind].title" fill :minimizable="false">
                    <WidgetBoundary :name="WIDGETS[w.kind].title">
                        <component :is="WIDGETS[w.kind].component" v-bind="WIDGETS[w.kind].props" :id="`ship-${screen.zone}-${w.kind}`" />
                    </WidgetBoundary>
                </TuiWindow>
            </div>
            <div v-if="!widgets.length" class="empty">SIN DATOS</div>
        </div>
        <!-- the glass: its scan lines and the dark of its curved edge, over the picture but not in the way of a touch -->
        <div class="glass" />
    </div>
</template>

<style scoped lang="scss">
.ship-monitor {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    background: var(--ph-bg);
    overflow: hidden;

    &.hidden { visibility: hidden; }
}

.stack {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px;
    overflow-y: auto;
    scrollbar-width: none;

    &.single > .slot { flex: 1; min-height: 0; }
}

.slot {
    flex: none;
    display: flex;
    flex-direction: column;

    > :deep(.tui-window) { flex: 1; min-height: 0; }
}

.empty {
    margin: auto;
    color: var(--ph-dim);
}

.glass {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.22) 3px);
    box-shadow: inset 0 0 28px 6px rgba(0, 0, 0, 0.7);
    border-radius: 6% / 10%;
}
</style>
