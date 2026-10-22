<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { stickAxes, STICK } from '@/games/marines/stick';

/**
 * The hands on the ship: a floating joystick under the left thumb (it lands anywhere on the left half and what
 * counts is how far it is dragged), a drag on the right half to look around, and a short touch anywhere to tap.
 * Each finger follows its own `Touch.identifier`, so both thumbs work at once.
 */
const emit = defineEmits<{
    move: [strafe: number, forward: number];
    look: [dx: number, dy: number];
    tap: [x: number, y: number];
}>();

const root = ref<HTMLElement | null>(null);
const knob = reactive({ active: false, x: 0, y: 0, originX: 0, originY: 0 });

const TAP_MOVE_PX = 10;
const TAP_MS = 350;

interface Finger { id: number | 'mouse'; kind: 'stick' | 'look'; x: number; y: number; startX: number; startY: number; t: number }
let fingers: Finger[] = [];

const own = (id: number | 'mouse') => fingers.find(f => f.id === id);

function start(id: number | 'mouse', x: number, y: number)
{
    const box = root.value!.getBoundingClientRect();
    const left = x < box.left + box.width / 2;
    if (left && fingers.some(f => f.kind === 'stick')) return;
    fingers.push({ id, kind: left ? 'stick' : 'look', x, y, startX: x, startY: y, t: Date.now() });
    if (left)
    {
        knob.active = true;
        knob.originX = x - box.left;
        knob.originY = y - box.top;
        knob.x = 0;
        knob.y = 0;
    }
}

function drag(id: number | 'mouse', x: number, y: number)
{
    const f = own(id);
    if (!f) return;
    if (f.kind === 'stick')
    {
        const a = stickAxes(x - f.startX, y - f.startY);
        knob.x = a.knobX;
        knob.y = a.knobY;
        emit('move', a.strafe, a.forward);
    }
    else emit('look', x - f.x, y - f.y);
    f.x = x;
    f.y = y;
}

function end(id: number | 'mouse', cancelled = false)
{
    const f = own(id);
    if (!f) return;
    fingers = fingers.filter(o => o !== f);
    if (f.kind === 'stick')
    {
        knob.active = false;
        emit('move', 0, 0);
    }
    if (!cancelled && Math.hypot(f.x - f.startX, f.y - f.startY) < TAP_MOVE_PX && Date.now() - f.t < TAP_MS) emit('tap', f.x, f.y);
}

function onTouchStart(e: TouchEvent)
{
    if (e.cancelable) e.preventDefault();
    for (const t of Array.from(e.changedTouches)) start(t.identifier, t.clientX, t.clientY);
}
function onTouchMove(e: TouchEvent)
{
    for (const t of Array.from(e.changedTouches)) drag(t.identifier, t.clientX, t.clientY);
}
function onTouchEnd(e: TouchEvent)
{
    for (const t of Array.from(e.changedTouches)) end(t.identifier, e.type === 'touchcancel');
}

// a mouse does the same on a desktop
function onMouseDown(e: MouseEvent) { start('mouse', e.clientX, e.clientY); }
function onMouseMove(e: MouseEvent) { drag('mouse', e.clientX, e.clientY); }
function onMouseUp() { end('mouse'); }

onMounted(() =>
{
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
});

onBeforeUnmount(() =>
{
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (knob.active) emit('move', 0, 0);
});
</script>

<template>
    <div ref="root" class="controls" data-no-swipe @contextmenu.prevent
        @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd" @mousedown="onMouseDown">
        <div class="rest"><span>◄ ANDAR</span><span>MIRAR ►</span></div>
        <div v-if="knob.active" class="stick" :style="{ left: knob.originX + 'px', top: knob.originY + 'px', width: STICK.radius * 2 + 'px', height: STICK.radius * 2 + 'px' }">
            <span class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.controls {
    position: absolute;
    inset: 0;
    user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
}

// a faint hint of where the thumbs go; it fades once the stick is in use
.rest {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 6px;
    display: flex;
    justify-content: space-around;
    color: var(--ph-dim);
    opacity: 0.55;
    font-size: 0.7em;
    pointer-events: none;
}

.stick {
    position: absolute;
    transform: translate(-50%, -50%);
    border: 1px solid var(--ph);
    border-radius: 50%;
    @include box-glow;
    pointer-events: none;

    &::before, &::after { content: ''; position: absolute; background: var(--ph-dim); }
    &::before { left: 50%; top: 8px; bottom: 8px; width: 1px; }
    &::after { top: 50%; left: 8px; right: 8px; height: 1px; }
}

.knob {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border-radius: 50%;
    background: var(--ph);
    @include box-glow;
}
</style>
