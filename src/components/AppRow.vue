<script setup lang="ts">
import { computed } from 'vue';
import { useLongPress } from '@/composables/useLongPress';
import { appTypeLabel } from '@/utils/appType';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { InstalledAppInfo } from '@/stores/useAppsStore';

const props = defineProps<{ app: InstalledAppInfo; highlighted: boolean }>();
const emit = defineEmits<{ (e: 'launch'): void; (e: 'menu'): void }>();

const settings = useSettingsStore();

const label = computed(() => settings.labelCase === 'upper' ? props.app.label.toUpperCase() : props.app.label);
const type = computed(() => appTypeLabel(props.app.packageName));

const press = useLongPress(() => emit('menu'));

function onClick()
{
    if (!press.consumeLongPress())
        emit('launch');
}
</script>

<template>
    <div
        class="app-row"
        :class="{ highlighted }"
        @pointerdown="press.onPointerDown"
        @pointermove="press.onPointerMove"
        @pointerup="press.onPointerUp"
        @pointercancel="press.onPointerCancel"
        @contextmenu.prevent
        @click="onClick">
        <span class="label">
            <span v-if="settings.showIcons" class="icon"><img :src="Bridge.getDefaultAppIconURL(app.packageName)" loading="lazy" alt="" /></span>{{ label }}
        </span>
        <span v-if="settings.showType" class="type">{{ type }}</span>
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

    &.highlighted,
    &:active {
        @include inverse;
        > .type { opacity: 1; }
    }
}
</style>
