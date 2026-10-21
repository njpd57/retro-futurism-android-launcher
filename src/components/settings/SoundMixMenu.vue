<script setup lang="ts">
import { computed } from 'vue';
import type { Bus } from '@/audio/context';
import { CONTINUOUS_LAYERS, gainOf, normalizeMix, soundsOf, withGain, withoutBus } from '@/audio/mix';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';
import TermSlider from './TermSlider.vue';

const props = defineProps<{ bus: Bus }>();
defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const sound = useSoundStore();

const TITLES: Record<Bus, string> = { ui: 'CANAL UI', ambient: 'CANAL AMBIENTE', game: 'CANAL JUEGOS' };

const mix = computed(() => normalizeMix(settings.soundMix));
const sounds = computed(() => soundsOf(props.bus));

// stored as a share of the designed level (1 = 100 %), shown as a percentage
const setGain = (id: string, pct: number) => { settings.soundMix = { ...withGain(mix.value, id, pct / 100) }; };
const reset = () => { settings.soundMix = { ...withoutBus(mix.value, props.bus) }; };
</script>

<template>
    <TermMenu :title="`AJUSTES › ${TITLES[bus]}`" @close="$emit('close')">
        <div v-for="s in sounds" :key="s.id" class="sound">
            <TermSlider
                :label="s.label" :min="0" :max="150" :step="5"
                :model-value="Math.round(gainOf(mix, s.id) * 100)" @update:model-value="setGain(s.id, $event)"
            />
            <button v-if="!CONTINUOUS_LAYERS.includes(s.id)" class="play pressable" @click="sound.preview(s.id)">[▶]</button>
        </div>
        <MenuItem @click="reset"><span>[RESTABLECER CANAL]</span><span>100%</span></MenuItem>
        <div v-if="bus === 'ambient'" class="note">» ZUMBIDO, AIRE Y SISEO SE OYEN EN VIVO CON EL AMBIENTE ACTIVO</div>
    </TermMenu>
</template>

<style scoped lang="scss">
.sound {
    display: flex;
    align-items: center;
    gap: 6px;

    > :first-child { flex: 1; min-width: 0; }
}
.play {
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    padding: 2px 6px;

    &:active { @include inverse; }
}
.note { color: var(--ph-dim); font-size: 0.75em; padding: 4px 10px 0; }
</style>
