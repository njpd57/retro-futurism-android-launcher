<script setup lang="ts">
import { computed } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { useMediaStore } from '@/stores/useMediaStore';
import { formatMediaTime, mediaPosition } from '@/utils/media';
import GaugeBar from '../gauges/GaugeBar.vue';
import TapeDeck from './TapeDeck.vue';

const props = defineProps<{ id: string }>();

const media = useMediaStore();
const now = useNow({ interval: 1000 });
// each media window keeps its own skin
const skin = useLocalStorage<'std' | 'tape'>(`widget.media.${props.id}.skin`, 'std');

const s = computed(() => media.session && media.session.state !== 'none' ? media.session : null);
const position = computed(() => s.value ? mediaPosition(s.value, now.value.getTime()) : 0);
const fraction = computed(() => s.value && s.value.durationMs > 0 ? position.value / s.value.durationMs : 0);
</script>

<template>
    <div class="media">
        <div v-if="!media.supported" class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
        <div v-else-if="!s" class="dim">SIN REPRODUCCIÓN</div>
        <TapeDeck v-else-if="skin === 'tape'" :id="id" :session="s" :position="position" :fraction="fraction" @action="media.action($event)" />
        <template v-else>
            <div class="top" @click="media.openApp()">
                <img v-if="s.hasArt" :key="s.artVersion" class="art" :src="Bridge.getMediaArtURL()" alt="" />
                <div class="info">
                    <div class="title">{{ s.title ?? '---' }}</div>
                    <div class="dim">{{ s.artist ?? '' }}</div>
                </div>
            </div>
            <div class="progress"><GaugeBar :fraction="fraction" :segments="16" /><span>{{ formatMediaTime(position) }}</span></div>
            <div class="buttons">
                <button type="button" :disabled="!s.canSkipToPrevious" @click="media.action('previous')">|◀</button>
                <button type="button" @click="media.action('playPause')">{{ s.state === 'playing' ? '❚❚' : '▶' }}</button>
                <button type="button" :disabled="!s.canSkipToNext" @click="media.action('next')">▶|</button>
            </div>
        </template>
        <div v-if="media.supported && s" class="skin pressable" @click="skin = skin === 'tape' ? 'std' : 'tape'">PIEL: {{ skin === 'tape' ? 'CINTA' : 'ESTÁNDAR' }}</div>
    </div>
</template>

<style scoped lang="scss">
.media { min-height: 0; }
.dim { color: var(--ph-dim); }
.skin { margin-top: 3px; font-size: 0.75em; color: var(--ph-dim); text-align: right; &:active { @include inverse; } }

.top { display: flex; gap: 8px; align-items: center; }
.art {
    flex: none;
    width: 3em;
    height: 3em;
    object-fit: cover;
    // tint the cover towards the phosphor color
    filter: grayscale(1) sepia(1) contrast(1.1) brightness(0.9);
}
[data-phosphor="green"] .art { filter: grayscale(1) sepia(1) hue-rotate(60deg) saturate(3) brightness(0.9); }
.info { min-width: 0; }
.title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.progress { display: flex; align-items: center; gap: 8px; margin: 2px 0; font-size: 0.85em; > svg { flex: 1; min-width: 0; } }

.buttons {
    display: flex;
    gap: 8px;

    > button {
        flex: 1;
        border: 1px solid var(--ph);
        background: var(--ph-bg);
        color: inherit;
        font: inherit;
        text-shadow: inherit;
        padding: 2px 0;

        &:active:not(:disabled) { @include inverse; }
        &:disabled { opacity: 0.35; }
    }
}

// a short window (one row of the grid) has to fit everything without scrolling
@container (max-height: 9em) {
    .art { width: 2em; height: 2em; }
    .progress { margin: 0; }
    .skin { margin-top: 0; }
}
</style>
