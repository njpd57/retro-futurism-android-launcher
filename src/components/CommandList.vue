<script setup lang="ts">
import type { CommandDef } from '@/utils/commandRegistry';

/**
 * The console's commands as tappable rows: the whole list while the prompt is empty (or after `ayuda`),
 * or the few that match what is being typed, above the apps. `mousedown` is prevented so a tap doesn't
 * take the focus (and the keyboard) away from the prompt.
 */
withDefaults(defineProps<{ commands: CommandDef[]; compact?: boolean }>(), { compact: false });
defineEmits<{ (e: 'pick', def: CommandDef): void }>();
</script>

<template>
    <div class="commands" :class="{ compact }" @mousedown.prevent>
        <div v-if="!compact" class="title">ÓRDENES · TOCA PARA ESCRIBIR</div>
        <div class="rows">
            <div v-for="c in commands" :key="c.name" class="row pressable" @click="$emit('pick', c)">
                <span class="name">» {{ c.name.toUpperCase() }}<span v-if="c.args" class="args"> {{ c.args }}</span></span>
                <span class="hint">{{ c.hint }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.commands {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    > .title { flex: none; @include inverse; padding: 0 10px; font-size: 0.85em; letter-spacing: 1px; }
    > .rows { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 0; }

    &.compact {
        flex: none;
        border-bottom: 1px solid var(--ph-dim);
        > .rows { padding: 2px 0; }
    }
}

.row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 2px 10px;

    > .name { flex: none; white-space: nowrap; }
    > .name > .args { color: var(--ph-dim); }
    > .hint { min-width: 0; color: var(--ph-dim); font-size: 0.8em; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    &:active { @include inverse; > .name > .args, > .hint { color: inherit; } }
}
</style>
