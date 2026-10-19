<script setup lang="ts">
import { computed } from 'vue';
import { bar } from '@/utils/tui';

const props = defineProps<{ label: string; count: number; fraction: number; hasNew: boolean; system: boolean }>();
defineEmits<{ (e: 'open'): void }>();

const usage = computed(() => bar(props.fraction, 6));
</script>

<template>
    <div class="folder-box pressable" :class="{ system }" @click="$emit('open')">
        <div class="name">{{ label }}<span v-if="hasNew">*</span></div>
        <div class="meta"><span>({{ count }})</span><span class="usage">{{ usage }}</span></div>
    </div>
</template>

<style scoped lang="scss">
.folder-box {
    min-width: 0;
    padding: 2px 8px 3px;
    border: 1px solid var(--ph);
    @include box-glow(0.6);

    &.system { border-color: var(--ph-dim); }
    &:active { @include inverse; }

    > .name {
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    > .meta {
        display: flex;
        justify-content: space-between;
        color: var(--ph-dim);
        font-size: 0.8em;

        > .usage { letter-spacing: 1px; }
    }

    &:active > .meta { color: inherit; }
}
</style>
