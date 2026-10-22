<script setup lang="ts">
import { useSettingsStore } from '@/stores/useSettingsStore';
import { SIZE_CELLS, sizeOf } from '@/utils/dashboardLayout';
import { WIDGETS } from '@/widgets/registry';

defineEmits<{ (e: 'pick', index: number): void }>();

const settings = useSettingsStore();

/** The windows of a deck as the blocks of a miniature of its grid: the same spans, drawn small. */
const blocks = (index: number) => settings.layouts.panels[index]
    .filter(i => i.kind in WIDGETS)
    .map(i => { const c = SIZE_CELLS[sizeOf(i, WIDGETS[i.kind].sizes)]; return { id: i.id, style: { gridColumn: `span ${c.cols}`, gridRow: i.minimized ? 'span 1' : `span ${c.rows}` }, minimized: i.minimized }; });
</script>

<template>
    <div class="deck-plan">
        <div class="head">PLANO DE CUBIERTAS</div>
        <div class="rooms">
            <div
                v-for="(name, i) in settings.layouts.names"
                :key="settings.layouts.ids[i]"
                class="room pressable"
                :class="{ active: i === settings.layouts.active }"
                :data-drop-panel="i"
                @click="$emit('pick', i)">
                <div class="label"><span>{{ i === settings.layouts.active ? '»' : ' ' }}{{ name }}</span><span class="count">{{ settings.layouts.panels[i].length }}</span></div>
                <div class="mini">
                    <span v-for="b in blocks(i)" :key="b.id" class="block" :class="{ min: b.minimized }" :style="b.style" />
                    <span v-if="!settings.layouts.panels[i].length" class="empty">VACÍA</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.deck-plan {
    > .head { @include inverse; padding: 0 6px; margin-bottom: 8px; letter-spacing: 1px; }

    > .rooms {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .room {
        border: 2px solid var(--ph-dim);
        padding: 4px 6px 6px;
        min-width: 0;

        &.active { border-color: var(--ph); @include box-glow(0.6); }
        &:active { @include inverse; }

        > .label { display: flex; justify-content: space-between; white-space: pre; > .count { color: var(--ph-dim); } }

        > .mini {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-auto-rows: 0.7em;
            grid-auto-flow: dense;
            gap: 3px;
            margin-top: 4px;
            min-height: 3.2em;
            align-content: start;

            > .block { border: 1px solid var(--ph); }
            > .block.min { border-style: dotted; }
            > .empty { grid-column: span 2; color: var(--ph-dim); text-align: center; align-self: center; }
        }
    }
    .room:active .block { border-color: var(--ph-bg); }
}
</style>
