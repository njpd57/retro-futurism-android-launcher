<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

withDefaults(defineProps<{
    title: string;
    minimized?: boolean;
    minimizable?: boolean;
    closable?: boolean;
    movable?: boolean;
    resizable?: boolean;
    /** Fill the height the parent gives (a dashboard cell) instead of growing with the content. */
    fill?: boolean;
}>(), { minimized: false, minimizable: true, closable: false, movable: false, resizable: false, fill: false });

defineEmits<{ (e: 'toggle'): void; (e: 'close'): void; (e: 'move', delta: -1 | 1): void; (e: 'resize'): void }>();

const body = ref<HTMLElement | null>(null);
const scrollable = ref(false);
const thumbTop = ref(0);
const thumbSize = ref(1);

// Decorative scrollbar: a thumb on a text track, kept in sync with the body's scroll position.
function sync()
{
    const el = body.value;
    if (!el) return;
    scrollable.value = el.scrollHeight > el.clientHeight + 1;
    if (!scrollable.value) return;
    thumbSize.value = el.clientHeight / el.scrollHeight;
    thumbTop.value = el.scrollTop / el.scrollHeight;
}

let observer: ResizeObserver | null = null;

onMounted(() =>
{
    sync();
    if (body.value)
    {
        observer = new ResizeObserver(sync);
        observer.observe(body.value);
    }
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <section class="tui-window" :class="{ fill, minimized }">
        <header class="title-bar">
            <span v-if="minimizable" class="btn" @click.stop="$emit('toggle')">{{ minimized ? '▣' : '□' }}</span>
            <span class="title">{{ title }}</span>
            <span v-if="resizable" class="btn" @click.stop="$emit('resize')">◢</span>
            <span v-if="movable" class="btn" @click.stop="$emit('move', -1)">◀</span>
            <span v-if="movable" class="btn" @click.stop="$emit('move', 1)">▶</span>
            <span v-if="closable" class="btn" @click.stop="$emit('close')">✕</span>
        </header>

        <div v-show="!minimized" class="frame">
            <div ref="body" class="body" @scroll.passive="sync">
                <slot />
            </div>
            <div v-if="scrollable" class="track">
                <span class="arrow">▲</span>
                <div class="rail">
                    <div class="thumb" :style="{ top: `${thumbTop * 100}%`, height: `${thumbSize * 100}%` }" />
                </div>
                <span class="arrow">▼</span>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.tui-window {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 2px solid var(--ph);
    background: var(--ph-bg);
    @include box-glow(0.6);

    // In a dashboard cell the window is as tall as the cell and its body scrolls; the body is a size container so
    // widgets can adapt to the room they have with @container.
    &.fill {
        min-height: 0;
        &.minimized { align-self: start; }
        > .frame { overflow: hidden; }
        > .frame > .body { max-height: none; container-type: size; }
    }

    > .title-bar {
        @include inverse;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 6px;
        flex: none;
        line-height: 1.2;

        > .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 1px; }
        > .btn { padding: 2px 4px; }
    }

    > .frame {
        display: flex;
        flex: 1;
        min-height: 0;
        border-top: 1px solid var(--ph);

        > .body { flex: 1; min-width: 0; max-height: 45vh; overflow-y: auto; scrollbar-width: none; padding: 4px 8px; touch-action: pan-y; }
        > .body::-webkit-scrollbar { display: none; }

        > .track {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 1.1em;
            border-left: 1px solid var(--ph);
            font-size: 0.7em;

            > .rail { position: relative; flex: 1; width: 100%; }
            > .rail > .thumb { position: absolute; left: 20%; right: 20%; background: var(--ph); min-height: 4px; }
        }
    }
}
</style>
