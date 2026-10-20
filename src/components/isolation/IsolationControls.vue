<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { FUEL_MAX } from '@/games/isolation/crafting';
import type { Input } from '@/games/isolation/game';
import { stickAxes } from '@/games/marines/stick';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { tick } from '@/utils/haptics';
import { bar } from '@/utils/tui';

defineProps<{
    /** label of the [USAR] key, null when there is nothing to use */
    use: string | null;
    tracker: boolean;
    hidden: boolean;
    decoys: number;
    flares: number;
    /** flamethrower shots left; null without the flamethrower */
    fuel: number | null;
}>();

const emit = defineEmits<{
    (e: 'input', input: Input): void;
    /** the joystick moved: both -1..1, forward positive; (0, 0) when let go */
    (e: 'move', strafe: number, forward: number): void;
}>();

const settings = useSettingsStore();

// ---- the joystick. The thumb may land anywhere on the zone: how far it is dragged from there is what counts, and it
// follows that one finger by its identifier, so a tap with the other thumb doesn't disturb it. A light push walks
// slowly (and quietly).
const knob = reactive({ x: 0, y: 0, active: false });
let touchId: number | null = null;
let originX = 0;
let originY = 0;
let mouseDown = false;

function drag(x: number, y: number)
{
    const a = stickAxes(x - originX, y - originY);
    knob.x = a.knobX;
    knob.y = a.knobY;
    emit('move', a.strafe, a.forward);
}

function begin(x: number, y: number)
{
    originX = x;
    originY = y;
    knob.active = true;
    drag(x, y);
}

function end()
{
    touchId = null;
    mouseDown = false;
    knob.x = knob.y = 0;
    knob.active = false;
    emit('move', 0, 0);
}

function onTouchStart(e: TouchEvent)
{
    // it also stops the browser from sending a mouse event and a click after the touch
    if (e.cancelable) e.preventDefault();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    begin(t.clientX, t.clientY);
}

function onTouchMove(e: TouchEvent)
{
    if (touchId === null) return;
    for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) drag(t.clientX, t.clientY);
}

function onTouchEnd(e: TouchEvent)
{
    if (touchId === null) return;
    if (Array.from(e.changedTouches).some(t => t.identifier === touchId)) end();
}

function onMouseDown(e: MouseEvent)
{
    if (e.button !== 0) return;
    mouseDown = true;
    begin(e.clientX, e.clientY);
}

function onMouseMove(e: MouseEvent)
{
    if (mouseDown) drag(e.clientX, e.clientY);
}

function onMouseUp()
{
    if (mouseDown) end();
}

onMounted(() =>
{
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
});

// ---- the keys. A finger tapping one while another is on the joystick sends no `click` (the browser takes two touches
// at once for a gesture), so they act on `touchstart`; `preventDefault` there also stops the emulated mouse events, so
// a tap never fires twice. The mouse still works on a desktop.
const pressed = ref<Input | null>(null);
let pressedTimer = 0;

function tap(input: Input, e: Event)
{
    if (e.cancelable) e.preventDefault();
    // the key shows inverse for a moment: a touch that is not cancelled would have shown `:active`, this one is
    pressed.value = input;
    clearTimeout(pressedTimer);
    pressedTimer = window.setTimeout(() => { pressed.value = null; }, 120);
    if (settings.haptics) tick(15);
    emit('input', input);
}

onBeforeUnmount(() =>
{
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    end();
    clearTimeout(pressedTimer);
});
</script>

<template>
    <div class="controls" @contextmenu.prevent>
        <div
            class="stick" :class="{ active: knob.active, off: hidden }"
            @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd"
            @mousedown="onMouseDown">
            <span class="arrow n">▲</span>
            <span class="arrow s">▼</span>
            <span class="arrow w">◄</span>
            <span class="arrow e">►</span>
            <span class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
        </div>
        <div class="right">
            <button class="key use" :class="{ off: !use, on: pressed === 'use' }" @touchstart="tap('use', $event)" @mousedown="tap('use', $event)">{{ use ?? 'USAR' }}</button>
            <div class="grid">
                <button class="key" :class="{ on: tracker || pressed === 'tracker' }" @touchstart="tap('tracker', $event)" @mousedown="tap('tracker', $event)">RASTREADOR</button>
                <button class="key" :class="{ off: hidden || !fuel, on: pressed === 'fire' }" @touchstart="tap('fire', $event)" @mousedown="tap('fire', $event)">
                    FUEGO {{ fuel === null ? '---' : bar(fuel / FUEL_MAX, FUEL_MAX) }}
                </button>
                <button class="key" :class="{ off: hidden || !decoys, on: pressed === 'throwDecoy' }" @touchstart="tap('throwDecoy', $event)" @mousedown="tap('throwDecoy', $event)">SEÑUELO ×{{ decoys }}</button>
                <button class="key" :class="{ off: hidden || !flares, on: pressed === 'throwFlare' }" @touchstart="tap('throwFlare', $event)" @mousedown="tap('throwFlare', $event)">BENGALA ×{{ flares }}</button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
$knob: 36px;
$half: 18px;

.controls {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 12px;
    // keep the keys off the curved edges of the tube
    padding: 0 10px;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
}

.right {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    .use { flex: 1; font-size: 1.2em; }
}

.grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    .key { padding: 8px 0; font-size: 0.68em; white-space: nowrap; overflow: hidden; }
}

// the zone the thumb may land on, and the cross it moves over
.stick {
    position: relative;
    min-height: 150px;
    border: 1px solid var(--ph);
    background: var(--ph-bg);
    @include box-glow(0.5);

    // the cross hairs
    &::before, &::after { content: ''; position: absolute; background: var(--ph-dim); opacity: 0.55; }
    &::before { left: 12%; right: 12%; top: 50%; height: 1px; }
    &::after { top: 12%; bottom: 12%; left: 50%; width: 1px; }

    .arrow { position: absolute; color: var(--ph-dim); font-size: 0.8em; line-height: 1; }
    .arrow.n { top: 5px; left: 50%; transform: translateX(-50%); }
    .arrow.s { bottom: 5px; left: 50%; transform: translateX(-50%); }
    .arrow.w { left: 7px; top: 50%; transform: translateY(-50%); }
    .arrow.e { right: 7px; top: 50%; transform: translateY(-50%); }

    // a block of the phosphor: outlined at rest, inverse video while it is held
    .knob {
        position: absolute;
        left: 50%;
        top: 50%;
        width: $knob;
        height: $knob;
        // centred on the cross (written out: in Sass `0 -$half` would be a subtraction)
        margin-top: -$half;
        margin-left: -$half;
        border: 1px solid var(--ph);
        background: var(--ph-bg);
    }

    &.active { @include box-glow(1); }
    &.active .knob { background: var(--ph); }
    &.off { border-color: var(--ph-dim); box-shadow: none; }
}

.key {
    font: inherit;
    color: var(--ph);
    background: var(--ph-bg);
    border: 1px solid var(--ph);
    padding: 12px 4px;
    text-align: center;
    @include glow;
    @include box-glow(0.5);

    &:active, &.on { @include inverse; }
    &.off { color: var(--ph-dim); border-color: var(--ph-dim); box-shadow: none; }
}
</style>
