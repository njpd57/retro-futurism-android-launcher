<script setup lang="ts">
import { ref } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { DEFAULT_ZONES, MAX_ZONES, toggleZone, ZONE_PRESETS, zoneLabel, zoneTime } from '@/utils/worldClock';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';

const props = defineProps<{ id: string }>();

const zones = useLocalStorage<string[]>(`widget.clocks.${props.id}`, DEFAULT_ZONES);
const now = useNow({ interval: 15_000 });
const picking = ref(false);
</script>

<template>
    <div>
        <div v-for="z in zones" :key="z" class="zone"><span>{{ zoneLabel(z) }}</span><span>{{ zoneTime(now, z) }}</span></div>
        <div v-if="!zones.length" class="dim">SIN COLONIAS</div>
        <div class="action pressable" @click="picking = true">[ZONAS {{ zones.length }}/{{ MAX_ZONES }}]</div>

        <TermMenu v-if="picking" title="COLONIAS" @close="picking = false">
            <MenuItem v-for="z in ZONE_PRESETS" :key="z" @click="zones = toggleZone(zones, z)">
                <span>{{ zoneLabel(z) }}</span><span>{{ zones.includes(z) ? '[X]' : '[ ]' }}</span>
            </MenuItem>
        </TermMenu>
    </div>
</template>

<style scoped lang="scss">
.zone { display: flex; justify-content: space-between; }
.dim { color: var(--ph-dim); }
.action { padding: 2px 0; color: var(--ph-dim); &:active { @include inverse; } }
</style>
