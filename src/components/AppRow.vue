<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLongPress } from '@/composables/useLongPress';
import { useRowDrag } from '@/composables/useRowDrag';
import { tick } from '@/utils/haptics';
import { appTypeLabel } from '@/utils/appType';
import { displayName } from '@/utils/appSearch';
import { indexLetter } from '@/utils/alphaIndex';
import { formatUsage } from '@/utils/usage';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { InstalledAppInfo } from '@/stores/useAppsStore';

const props = defineProps<{ app: InstalledAppInfo; highlighted: boolean; depth?: 0 | 1; isNew?: boolean; usageMs?: number; canDrag?: boolean; dragged?: boolean }>();
const emit = defineEmits<{
    (e: 'launch'): void;
    (e: 'menu'): void;
    (e: 'drag-start'): void;
    (e: 'drag-move', x: number, y: number): void;
    (e: 'drag-drop', x: number, y: number): void;
    (e: 'drag-cancel'): void;
}>();

const settings = useSettingsStore();

const name = computed(() => displayName(props.app, settings.aliases));
const label = computed(() => settings.labelCase === 'upper' ? name.value.toUpperCase() : name.value);
const long = computed(() => settings.listMode === 'long');
const usage = computed(() => props.usageMs ? formatUsage(props.usageMs) : '--');
const type = computed(() => appTypeLabel(props.app.packageName));

// the mouse keeps the plain long press; a finger lifts the row (to drag it into a folder box, or to open the menu on release)
const press = useLongPress(() => emit('menu'));
const lifted = ref(false);
const drag = useRowDrag({
    canDrag: () => !!props.canDrag,
    onLift: () => { lifted.value = true; if (settings.haptics) tick(); if (props.canDrag) emit('drag-start'); },
    onMenu: () => { lifted.value = false; emit('drag-cancel'); emit('menu'); },
    onMove: (x, y) => emit('drag-move', x, y),
    onDrop: (x, y) => { lifted.value = false; emit('drag-drop', x, y); },
    onCancel: () => { lifted.value = false; emit('drag-cancel'); },
});
const mouse = (fn: (e: PointerEvent) => void) => (e: PointerEvent) => { if (e.pointerType !== 'touch') fn(e); };

function onClick()
{
    if (!press.consumeLongPress())
        emit('launch');
}
</script>

<template>
    <div
        class="app-row"
        :class="{ highlighted, nested: depth === 1, long, lifted, dragged }"
        :data-letter="depth ? undefined : indexLetter(name)"
        @pointerdown="mouse(press.onPointerDown)($event)"
        @pointermove="mouse(press.onPointerMove)($event)"
        @pointerup="mouse(press.onPointerUp)($event)"
        @pointercancel="mouse(press.onPointerCancel)($event)"
        @touchstart.passive="drag.onTouchStart"
        @touchmove="drag.onTouchMove"
        @touchend="drag.onTouchEnd"
        @touchcancel="drag.onTouchCancel"
        @contextmenu.prevent
        @click="onClick">
        <span class="label">
            <span v-if="settings.showIcons" class="icon"><img :src="Bridge.getDefaultAppIconURL(app.packageName)" loading="lazy" alt="" /></span>{{ label }}<span v-if="isNew" class="new"> *NUEVO</span>
        </span>
        <span v-if="long" class="usage">{{ usage }}</span>
        <span v-if="long || settings.showType" class="type">{{ type }}</span>
    </div>
</template>

<style scoped lang="scss">
.app-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 10px;

    .icon {
        position: relative;
        display: inline-block;
        width: 1em;
        height: 1em;
        margin-right: 8px;
        vertical-align: -0.12em;
        background: var(--ph);

        > img { display: block; width: 100%; height: 100%; filter: grayscale(1) contrast(1.3) brightness(1.1); mix-blend-mode: multiply; }
    }

    > .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    > .type { flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.75; }

    &.nested { padding-left: 28px; }
    .new { font-size: 0.8em; opacity: 0.85; }
    > .usage { flex: none; width: 4.5em; text-align: right; opacity: 0.75; }
    &.long > .type { max-width: 28%; }

    // a row held by the finger: lit like any pressed thing; while it travels, the original stays as a dim placeholder
    &.dragged { opacity: 0.35; }

    &.highlighted,
    &.lifted,
    &:active {
        @include inverse;
        > .type { opacity: 1; }
    }
}
</style>
