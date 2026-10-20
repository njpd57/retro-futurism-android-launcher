<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { stickAxes } from '@/games/marines/stick';

defineProps<{
    /** a magazine is going in: the reload key is spent */
    reloading: boolean;
    /** grenades left, and how many weapons are carried (one: the weapon key has nothing to switch to) */
    grenades: number;
    weapons: number;
    /** the squad's order, which the last key names */
    order: 'follow' | 'hold';
    /** sentry turrets left to set down, and what the blowtorch would do to the door in front (null: no door) */
    turrets: number;
    weld: 'weld' | 'cut' | null;
}>();

const emit = defineEmits<{
    /** the joystick moved: both -1..1, forward positive; (0, 0) when let go */
    (e: 'move', strafe: number, forward: number): void;
    /** FUEGO went down or up */
    (e: 'fire', down: boolean): void;
    /** the thumb on FUEGO was dragged sideways by this many pixels: it turns the view like a drag on it */
    (e: 'aim', dx: number): void;
    (e: 'reload'): void;
    /** the next weapon */
    (e: 'switch'): void;
    (e: 'grenade'): void;
    /** the key that sets a turret down, or seals or cuts the door in front when there is one */
    (e: 'deploy'): void;
    /** toggles the squad between following and holding */
    (e: 'order'): void;
}>();

// ---- the joystick. The thumb may land anywhere on the zone: how far it is dragged from there is what counts, and
// it follows that one finger by its identifier, so the other thumb (aiming, FUEGO) doesn't disturb it.
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

// ---- FUEGO
const firing = ref(false);

// the thumb on FUEGO also aims: it follows its own finger and reports how far it moved sideways
let fireTouch: number | null = null;
let fireX = 0;

function fireDown(e: Event)
{
    if (e.cancelable) e.preventDefault();
    if (firing.value) return;
    firing.value = true;
    if (e instanceof TouchEvent)
    {
        fireTouch = e.changedTouches[0].identifier;
        fireX = e.changedTouches[0].clientX;
    }
    emit('fire', true);
}

function fireMove(e: TouchEvent)
{
    if (fireTouch === null) return;
    for (const t of Array.from(e.changedTouches))
    {
        if (t.identifier !== fireTouch) continue;
        emit('aim', t.clientX - fireX);
        fireX = t.clientX;
    }
}

function fireUp()
{
    fireTouch = null;
    if (!firing.value) return;
    firing.value = false;
    emit('fire', false);
}

onBeforeUnmount(() =>
{
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    end();
    fireUp();
});
</script>

<template>
    <div class="controls" @contextmenu.prevent>
        <div class="strip">
            <button class="key small pressable" :class="{ off: reloading }" @click="emit('reload')">RECARGA</button>
            <button class="key small pressable" :class="{ off: weapons < 2 }" @click="emit('switch')">ARMA</button>
            <button class="key small pressable" :class="{ off: grenades < 1 }" @click="emit('grenade')">GRANADA {{ grenades }}</button>
            <button class="key small pressable" :class="{ held: weld !== null, off: weld === null && turrets < 1 }" @click="emit('deploy')">{{ weld === 'weld' ? 'SOLDAR' : weld === 'cut' ? 'CORTAR' : `TORRETA ${turrets}` }}</button>
            <button class="key small pressable" :class="{ held: order === 'hold' }" @click="emit('order')">{{ order === 'hold' ? 'QUIETOS' : 'SEGUIR' }}</button>
        </div>
        <div class="pad">
            <div
                class="stick" :class="{ active: knob.active }"
                @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd"
                @mousedown="onMouseDown">
                <span class="arrow n">▲</span>
                <span class="arrow s">▼</span>
                <span class="arrow w">◄</span>
                <span class="arrow e">►</span>
                <span class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
            </div>
            <button
                class="key fire" :class="{ on: firing }"
                @touchstart="fireDown" @touchmove="fireMove" @touchend="fireUp" @touchcancel="fireUp"
                @mousedown="fireDown" @mouseup="fireUp" @mouseleave="fireUp">FUEGO</button>
        </div>
    </div>
</template>

<style scoped lang="scss">
$knob: 36px;
$half: 18px;

.controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    // keep the keys off the curved edges of the tube
    padding: 0 10px;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
}

// the keys that are not held down: reload, next weapon, grenade, turret or blowtorch, and the squad's order
.strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
}

// the joystick and FUEGO
.pad {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 14px;
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

    &:active, &.on, &.held { @include inverse; }
    &.off { color: var(--ph-dim); border-color: var(--ph-dim); box-shadow: none; }
    &.fire { font-size: 1.5em; }
    // the row of small keys: terse, so that five fit across a narrow phone
    &.small { padding: 7px 0; font-size: 0.68em; white-space: nowrap; overflow: hidden; }
}
</style>
