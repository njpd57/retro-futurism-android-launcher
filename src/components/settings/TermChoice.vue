<script setup lang="ts">
import { computed, ref } from 'vue';
import MenuItem from '@/components/MenuItem.vue';
import type { ChoiceOption } from '@/utils/settingsSchema';

const props = defineProps<{ modelValue: unknown; label: string; options: readonly ChoiceOption[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: ChoiceOption['id']): void; (e: 'touch'): void }>();

// Tapping the row unfolds every option under it, so the choices are in sight instead of cycling blind.
const open = ref(false);
const current = computed(() => props.options.find(o => o.id === props.modelValue)?.label ?? '--');

function toggle() { emit('touch'); open.value = !open.value; }
function pick(id: ChoiceOption['id'])
{
    emit('update:modelValue', id);
    open.value = false;
}
</script>

<template>
    <MenuItem @click="toggle"><span>{{ label }}</span><span>{{ current }} {{ open ? '▴' : '▾' }}</span></MenuItem>
    <div v-if="open" class="options">
        <MenuItem v-for="o in options" :key="o.id" :class="{ on: o.id === modelValue }" @click="pick(o.id)">
            <span>{{ o.id === modelValue ? '◉' : '·' }} {{ o.label }}</span>
        </MenuItem>
    </div>
</template>

<style scoped lang="scss">
.options {
    margin: 0 10px 4px 22px;
    border-left: 1px solid var(--ph-dim);

    > .on { @include inverse; }
}
</style>
