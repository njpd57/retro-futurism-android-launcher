<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue';
import { useAnimStore } from '@/stores/useAnimStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { TRANSITION_MS, noiseParams } from '@/utils/anim';
import { useRowDrag } from '@/composables/useRowDrag';

const props = withDefaults(defineProps<{
    title: string;
    minimized?: boolean;
    minimizable?: boolean;
    closable?: boolean;
    movable?: boolean;
    resizable?: boolean;
    /** Fill the height the parent gives (a dashboard cell) instead of growing with the content. */
    fill?: boolean;
    /** Play the unfold when the window first appears (the dashboard sets it for windows added after it opened). */
    pop?: boolean;
}>(), { minimized: false, minimizable: true, closable: false, movable: false, resizable: false, fill: false, pop: false });

const emit = defineEmits<{
    (e: 'toggle'): void; (e: 'close'): void; (e: 'move', delta: -1 | 1): void; (e: 'resize'): void; (e: 'duplicate'): void;
    (e: 'drag-start'): void; (e: 'drag-move', x: number, y: number): void; (e: 'drag-drop', x: number, y: number): void; (e: 'drag-cancel'): void;
}>();

// in edit mode, holding the title bar lifts the window; letting go without moving puts it back
const drag = useRowDrag({
    canDrag: () => props.movable,
    onLift: () => { if (props.movable) emit('drag-start'); },
    onMenu: () => emit('drag-cancel'),
    onMove: (x, y) => emit('drag-move', x, y),
    onDrop: (x, y) => emit('drag-drop', x, y),
    onCancel: () => emit('drag-cancel'),
});

const anim = useAnimStore();
const sound = useSoundStore();
const attrs = useAttrs();

// now and then a thin line of interference crosses the window; where and how often is fixed per window
const noise = computed(() =>
{
    const n = noiseParams(String(attrs['data-widget-id'] ?? props.title));
    return { '--noise-y': `${n.y}%`, '--noise-dur': `${n.durS}s`, '--noise-delay': `${n.delayS}s` };
});

// the frame unfolds from the title bar when the window appears or is restored from minimized
const unfolding = ref(props.pop && anim.transitions);
let unfoldTimer = 0;

function unfold()
{
    if (!anim.transitions) return;
    window.clearTimeout(unfoldTimer);
    unfolding.value = true;
    unfoldTimer = window.setTimeout(() => { unfolding.value = false; }, TRANSITION_MS.unfold);
}

watch(() => props.minimized, (min, was) => { if (was && !min) unfold(); });

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
    if (unfolding.value) unfoldTimer = window.setTimeout(() => { unfolding.value = false; }, TRANSITION_MS.unfold);
    sync();
    if (body.value)
    {
        observer = new ResizeObserver(sync);
        observer.observe(body.value);
    }
});

onBeforeUnmount(() => { observer?.disconnect(); window.clearTimeout(unfoldTimer); });
</script>

<template>
    <section class="tui-window" :class="{ fill, minimized, ambient: anim.ambient }" :style="anim.ambient ? noise : undefined">
        <header
            class="title-bar"
            data-no-swipe
            @touchstart.passive="movable && drag.onTouchStart($event)"
            @touchmove="movable && drag.onTouchMove($event)"
            @touchend="movable && drag.onTouchEnd($event)"
            @touchcancel="movable && drag.onTouchCancel()">
            <span v-if="minimizable" class="btn" @click.stop="sound.play('minimize'); $emit('toggle')">{{ minimized ? '▣' : '□' }}</span>
            <span class="title">{{ title }}</span>
            <span v-if="resizable" class="btn" @click.stop="$emit('resize')">◢</span>
            <span v-if="movable" class="btn" @click.stop="$emit('duplicate')">⧉</span>
            <span v-if="movable" class="btn" @click.stop="$emit('move', -1)">◀</span>
            <span v-if="movable" class="btn" @click.stop="$emit('move', 1)">▶</span>
            <span v-if="closable" class="btn" @click.stop="sound.play('close'); $emit('close')">✕</span>
        </header>

        <div v-show="!minimized" class="frame" :class="{ unfold: unfolding }">
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
    position: relative;
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

    // interference: a 1px line that flashes for under a second every 13-27 s (opacity and transform only)
    &.ambient::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: var(--noise-y);
        height: 1px;
        background: var(--ph);
        box-shadow: 0 0 calc(6px * var(--bloom)) var(--ph-glow);
        opacity: 0;
        pointer-events: none;
        animation: window-noise var(--noise-dur) linear var(--noise-delay) infinite;
    }

    // transform and opacity only, so it runs on the compositor at the display's refresh rate
    > .frame.unfold {
        transform-origin: top center;
        animation: tui-unfold 0.18s linear both;
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

@keyframes tui-unfold {
    from { transform: scaleY(0.02); opacity: 0.35; }
    to { transform: none; opacity: 1; }
}

@keyframes window-noise {
    0%, 95.5% { opacity: 0; transform: none; }
    96% { opacity: 0.55; transform: translateX(-4%); }
    97% { opacity: 0.2; transform: translateX(3%); }
    98% { opacity: 0.5; transform: translateX(-1%); }
    98.8%, 100% { opacity: 0; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
    .tui-window.ambient::after { animation: none; }
    .tui-window > .frame.unfold { animation: none; }
}
</style>
