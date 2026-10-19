<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { useMediaStore } from '@/stores/useMediaStore';
import { formatMediaTime, mediaPosition } from '@/utils/media';
import { bar } from '@/utils/tui';

const media = useMediaStore();
const now = useNow({ interval: 1000 });

const s = computed(() => media.session && media.session.state !== 'none' ? media.session : null);
const position = computed(() => s.value ? mediaPosition(s.value, now.value.getTime()) : 0);
const fraction = computed(() => s.value && s.value.durationMs > 0 ? position.value / s.value.durationMs : 0);
</script>

<template>
    <div>
        <div v-if="!media.supported" class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
        <div v-else-if="!s" class="dim">SIN REPRODUCCIÓN</div>
        <template v-else>
            <div class="top" @click="media.openApp()">
                <img v-if="s.hasArt" :key="s.artVersion" class="art" :src="Bridge.getMediaArtURL()" alt="" />
                <div class="info">
                    <div class="title">{{ s.title ?? '---' }}</div>
                    <div class="dim">{{ s.artist ?? '' }}</div>
                </div>
            </div>
            <div class="progress">{{ bar(fraction, 14) }} {{ formatMediaTime(position) }}</div>
            <div class="buttons">
                <button type="button" :disabled="!s.canSkipToPrevious" @click="media.action('previous')">|◀</button>
                <button type="button" @click="media.action('playPause')">{{ s.state === 'playing' ? '❚❚' : '▶' }}</button>
                <button type="button" :disabled="!s.canSkipToNext" @click="media.action('next')">▶|</button>
            </div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }

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
.progress { margin: 2px 0; font-size: 0.85em; }

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
</style>
