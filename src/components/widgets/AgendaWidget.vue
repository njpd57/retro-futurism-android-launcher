<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { eventTimeLabel, groupEventsByDay } from '@/utils/agenda';

const calendar = useCalendarStore();
const now = useNow({ interval: 60_000 });

const days = computed(() => groupEventsByDay(calendar.events, now.value));
</script>

<template>
    <div>
        <template v-if="!calendar.supported">
            <div class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
        </template>
        <template v-else-if="!calendar.canRead">
            <div class="dim">SIN ACCESO AL CALENDARIO</div>
            <div class="action" @click="calendar.requestAccess()">[CONCEDER]</div>
        </template>
        <template v-else>
            <template v-for="day in days" :key="day.key">
                <div class="day">{{ day.label }}</div>
                <div v-for="e in day.events" :key="e.eventId" class="event" @click="calendar.openEvent(e)">
                    <span class="time">{{ eventTimeLabel(e) }}</span>
                    <span class="name">{{ e.title ?? '(SIN TÍTULO)' }}</span>
                </div>
            </template>
            <div v-if="!days.length" class="dim">SIN EVENTOS PRÓXIMOS</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.day { margin-top: 2px; color: var(--ph-dim); letter-spacing: 1px; }
.event { display: flex; gap: 10px; font-size: 0.9em; &:active { @include inverse; } }
.time { flex: none; min-width: 5em; color: var(--ph-dim); }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action { padding: 2px 0; &:active { @include inverse; } }
</style>
