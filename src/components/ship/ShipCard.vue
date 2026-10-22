<script setup lang="ts">
import { computed } from 'vue';
import TermMenu from '@/components/TermMenu.vue';
import TuiWindow from '@/components/TuiWindow.vue';
import WidgetBoundary from '@/components/WidgetBoundary.vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShipStore } from '@/stores/useShipStore';
import { CARDS } from '@/ship3d/cards';
import { ROOMS } from '@/ship3d/world';
import { WIDGETS } from '@/widgets/registry';

const ship = useShipStore();
const settings = useSettingsStore();

const zone = computed(() => ship.card!);
const title = computed(() => ROOMS.find(r => r.id === zone.value)?.name ?? '');
const widgets = computed(() => CARDS[zone.value].filter(w => w.kind in WIDGETS));

/** One dashboard row is 7.5em and the gap 10px, so a widget of `rows` rows is as tall as it would be in the grid. */
const height = (rows: number) => `calc(7.5em * ${rows} + 10px * ${rows - 1})`;

function openMother()
{
    ship.closeCard();
    settings.activeTab = 'mother';
}
</script>

<template>
    <TermMenu :title="title" large @close="ship.closeCard()">
        <div class="stack" data-no-swipe>
            <div v-for="w in widgets" :key="w.kind" class="slot" :style="{ height: height(w.rows) }">
                <TuiWindow :title="WIDGETS[w.kind].title" fill :minimizable="false">
                    <WidgetBoundary :name="WIDGETS[w.kind].title">
                        <component :is="WIDGETS[w.kind].component" v-bind="WIDGETS[w.kind].props" :id="`ship-${zone}-${w.kind}`" />
                    </WidgetBoundary>
                </TuiWindow>
            </div>
            <button v-if="zone === 'comms'" class="act pressable" @click="openMother">[ABRIR MOTHER]</button>
        </div>
    </TermMenu>
</template>

<style scoped lang="scss">
.stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 70vh;
    overflow-y: auto;
}

.slot {
    flex: none;
    display: flex;
    flex-direction: column;

    // the window is as tall as its slot, like a dashboard cell
    > :deep(.tui-window) { flex: 1; min-height: 0; }
}

.act {
    flex: none;
    padding: 6px 12px;
    background: var(--ph-bg);
    border: 1px solid var(--ph);
    color: var(--ph);
    font: inherit;
    @include glow;

    &:active { @include inverse; }
}
</style>
