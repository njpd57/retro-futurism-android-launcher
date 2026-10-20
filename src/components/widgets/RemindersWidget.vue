<script setup lang="ts">
import { computed } from 'vue';
import { useRemindersStore } from '@/stores/useRemindersStore';
import { useShipClockStore } from '@/stores/useShipClockStore';
import { formatWhen } from '@/utils/reminders';

defineProps<{ id: string }>();

const reminders = useRemindersStore();
const clock = useShipClockStore();
const rows = computed(() => reminders.pending.slice(0, 8).map(r => ({ id: r.id, when: formatWhen(r.at, clock.now), text: r.text.toUpperCase(), late: r.at <= clock.now.getTime() })));
</script>

<template>
    <div class="reminders">
        <div v-for="r in rows" :key="r.id" class="row">
            <span class="what" :class="{ late: r.late }">{{ r.when }} {{ r.text }}</span>
            <span class="rm pressable" @click="reminders.complete(r.id)">[X]</span>
        </div>
        <div v-if="!rows.length" class="dim">SIN RECORDATORIOS</div>
        <div v-if="!rows.length" class="dim hint">&gt; RECORDAR 18:30 TEXTO</div>
    </div>
</template>

<style scoped lang="scss">
.reminders { height: 100%; overflow: hidden; }
.row { display: flex; justify-content: space-between; gap: 8px; }
.what { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.late { font-weight: bold; }
.rm { color: var(--ph-dim); &:active { @include inverse; } }
.dim { color: var(--ph-dim); }

@container (max-height: 90px) { .hint { display: none; } }
</style>
