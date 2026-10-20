<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { SENSITIVITY_STEPS, useMarinesStore } from '@/stores/useMarinesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import type { SfxName } from '@/audio/sfx';
import { LOW_HEALTH, PLAYER, accuracy, act, newGame, owned, step, type Action, type Controls, type GameEvent, type MarinesState } from '@/games/marines/game';
import { ARENA_OPERATIONS } from '@/games/marines/map';
import { messageFor, status } from '@/games/marines/radio';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '@/games/marines/weapons';
import { tick } from '@/utils/haptics';
import { bar, formatDuration } from '@/utils/tui';
import MarinesControls from './MarinesControls.vue';
import MarinesView from './MarinesView.vue';

const marines = useMarinesStore();
const settings = useSettingsStore();
const sound = useSoundStore();
const bridgeEvents = useBridgeEventStore();

const MESSAGE_MS = 4000;
/** the death panel waits this long, so the last frame is seen */
const DEAD_MS = 800;
/** radians a drag of one pixel turns the player, at sensitivity 1 */
const TURN_PER_PX = 0.0065;
/** radians a second with the arrow keys */
const TURN_KEY = 2.2;
/** What each weapon sounds like when it fires. */
const SHOT_SOUND: Record<WeaponId, SfxName> = { rifle: 'pulse', shotgun: 'shotgun', smartgun: 'smart', flamer: 'burn' };
/** the marines' rifles are heard at most this often, or four of them a second would be a wall of noise */
const RATTLE_MS = 110;
const rng = Math.random;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const view = ref<InstanceType<typeof MarinesView> | null>(null);
const state = shallowRef<MarinesState>(newGame(ARENA_OPERATIONS));
const screen = ref<'title' | 'playing' | 'paused'>('title');
const message = ref<{ text: string; at: number } | null>(null);
const clock = ref(0);

let raf = 0;
let last = 0;
let backgrounded = false;
let lastPing = -1e9;
let lastRattle = -1e9;
let deadAt = 0;

// what is held down, read by the loop: the keyboard's keys and FUEGO, and the joystick's axes; the drag on the
// view adds up turns between frames
type Held = 'forward' | 'back' | 'left' | 'right' | 'fire';
const held: Record<Held, boolean> = { forward: false, back: false, left: false, right: false, fire: false };
const stick = { strafe: 0, forward: 0 };
const turnKeys = { left: false, right: false };
let turnAcc = 0;

const frameMs = computed(() => marines.prefs.fps === 60 ? 1000 / 60 - 2 : 1000 / 30 - 2);

function controls(dt: number): Controls
{
    const turn = turnAcc + ((turnKeys.right ? 1 : 0) - (turnKeys.left ? 1 : 0)) * TURN_KEY * dt / 1000;
    turnAcc = 0;
    // the keyboard (a desktop) and the joystick add up; `step` keeps the result within a full stride
    return {
        forward: (held.forward ? 1 : 0) - (held.back ? 1 : 0) + stick.forward,
        strafe: (held.right ? 1 : 0) - (held.left ? 1 : 0) + stick.strafe,
        turn,
        fire: held.fire,
    };
}

function releaseAll()
{
    for (const k of Object.keys(held) as Held[]) held[k] = false;
    stick.strafe = stick.forward = 0;
    turnKeys.left = turnKeys.right = false;
    turnAcc = 0;
}

function onMove(strafe: number, forward: number)
{
    stick.strafe = strafe;
    stick.forward = forward;
}

function onFire(down: boolean)
{
    held.fire = down;
}

function handle(events: GameEvent[], now: number)
{
    for (const e of events)
    {
        // events that carry a detail after a colon
        if (e.startsWith('marineDown:'))
        {
            sound.playAlways('alert');
            continue;
        }
        if (e.startsWith('pickupWeapon:'))
        {
            sound.playAlways('select');
            continue;
        }
        switch (e)
        {
            case 'shot': sound.playAlways(SHOT_SOUND[state.value.player.weapon]); break;
            case 'dry': case 'noGrenades': sound.playAlways('dry'); break;
            case 'reloadStart': sound.playAlways('reload'); break;
            case 'kill': sound.playAlways('kill'); break;
            case 'hurt':
                sound.playAlways('hurt');
                if (settings.haptics) tick(50);
                break;
            case 'lowHealth': sound.playAlways('alert'); break;
            case 'pickupAmmo': case 'pickupMed': case 'pickupGrenade': case 'waveClear': case 'switch': case 'orderFollow': case 'orderHold':
                sound.playAlways('select');
                break;
            case 'waveStart': sound.playAlways('alert'); break;
            // something comes out of a grille
            case 'spawn': sound.playAlways('vent'); break;
            case 'launch': sound.playAlways('launch'); break;
            case 'blast': sound.playAlways('blast'); break;
            case 'squadShot':
                if (now - lastRattle > RATTLE_MS)
                {
                    lastRattle = now;
                    sound.playAlways('rattle');
                }
                break;
            // a facehugger lands on the face
            case 'grab':
                sound.playAlways('alert');
                if (settings.haptics) tick(120);
                break;
            case 'acid': case 'splash': sound.playAlways('acid'); break;
            case 'ping':
                lastPing = now;
                if (state.value.tracker.nearest !== null) sound.playAlways('ping');
                break;
            case 'dead':
                deadAt = now;
                releaseAll();
                sound.playAlways('screech');
                if (settings.haptics) tick(400);
                marines.record(state.value.wave.n, state.value.score);
                break;
        }
    }
    const line = messageFor(events, state.value);
    if (line) message.value = { text: line, at: now };
}

function frame(now: number)
{
    raf = requestAnimationFrame(frame);
    if (backgrounded || now - last < frameMs.value) return;
    const dt = Math.min(100, now - last);
    last = now;

    if (screen.value === 'playing' && state.value.phase === 'playing')
    {
        const r = step(state.value, dt, controls(dt), rng);
        state.value = r.state;
        handle(r.events, now);
    }
    else turnAcc = 0;
    clock.value = now;

    const s = state.value;
    const p = s.player;
    view.value?.draw({
        state: s,
        pose: { x: p.x, y: p.y, yaw: p.yaw },
        bob: reducedMotion ? 0 : Math.sin(s.timeMs / 110) * 0.014 * p.moveAmt,
        now,
        sincePing: now - lastPing,
        reduced: reducedMotion,
    });
}

function start()
{
    state.value = newGame(ARENA_OPERATIONS);
    releaseAll();
    message.value = { text: ARENA_OPERATIONS.briefing[0], at: performance.now() };
    screen.value = 'playing';
}

function pause()
{
    releaseAll();
    if (screen.value === 'playing' && state.value.phase === 'playing') screen.value = 'paused';
}

/** A discrete action of the player: reload, change weapon, a grenade, an order to the squad. */
function perform(action: Action)
{
    if (screen.value !== 'playing') return;
    const r = act(state.value, action);
    if (r.state === state.value && !r.events.length) return;
    state.value = r.state;
    handle(r.events, performance.now());
}

// ---- aiming: a drag on the view turns the player. It follows one finger by its identifier and uses how far it
// moved, so where the screen's curvature draws things does not matter.
let aimId: number | null = null;
let aimX = 0;
let mouseAim = false;

const turnPerPx = () => TURN_PER_PX * marines.prefs.sensitivity;

function aimStart(e: TouchEvent)
{
    if (aimId !== null || screen.value !== 'playing') return;
    const t = e.changedTouches[0];
    aimId = t.identifier;
    aimX = t.clientX;
}

function aimMove(e: TouchEvent)
{
    if (aimId === null) return;
    for (const t of Array.from(e.changedTouches))
    {
        if (t.identifier !== aimId) continue;
        turnAcc += (t.clientX - aimX) * turnPerPx();
        aimX = t.clientX;
    }
}

function aimEnd(e: TouchEvent)
{
    if (aimId === null) return;
    for (const t of Array.from(e.changedTouches)) if (t.identifier === aimId) aimId = null;
}

function onMouseDown(e: MouseEvent)
{
    if (e.button === 0 && screen.value === 'playing') mouseAim = true;
}

function onMouseMove(e: MouseEvent)
{
    if (mouseAim) turnAcc += e.movementX * turnPerPx();
}

function onMouseUp()
{
    mouseAim = false;
}

// ---- the keyboard, for testing on a desktop
const KEYS: Record<string, Held> = { w: 'forward', ArrowUp: 'forward', s: 'back', ArrowDown: 'back', a: 'left', d: 'right', ' ': 'fire' };
const KEY_ACTIONS: Record<string, Action> = {
    r: 'reload', q: 'switch', g: 'grenade', e: 'order',
    // 1 to 4 pick a weapon by its place in the list
    ...Object.fromEntries(WEAPON_ORDER.map((id, i): [string, Action] => [String(i + 1), `select:${id}`])),
};

function onKey(e: KeyboardEvent)
{
    if (e.key === 'Escape' || e.key === 'p')
    {
        if (screen.value === 'paused') screen.value = 'playing'; else pause();
        return;
    }
    if (screen.value !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    {
        e.preventDefault();
        turnKeys[e.key === 'ArrowLeft' ? 'left' : 'right'] = true;
        return;
    }
    const action = KEY_ACTIONS[e.key];
    if (action)
    {
        if (!e.repeat) perform(action);
        return;
    }
    const key = KEYS[e.key];
    if (!key) return;
    e.preventDefault();
    held[key] = true;
}

function onKeyUp(e: KeyboardEvent)
{
    if (e.key === 'ArrowLeft') turnKeys.left = false;
    else if (e.key === 'ArrowRight') turnKeys.right = false;
    else if (KEYS[e.key]) held[KEYS[e.key]] = false;
}

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause')
    {
        backgrounded = true;
        pause();
    }
    else if (ev.name === 'afterResume')
    {
        backgrounded = false;
        last = performance.now();
    }
}

// ---- the settings in the pause menu
function nextSensitivity()
{
    const i = SENSITIVITY_STEPS.findIndex(v => v >= marines.prefs.sensitivity - 1e-6);
    marines.prefs = { ...marines.prefs, sensitivity: SENSITIVITY_STEPS[(i + 1) % SENSITIVITY_STEPS.length] };
}

function toggleFps()
{
    marines.prefs = { ...marines.prefs, fps: marines.prefs.fps === 30 ? 60 : 30 };
}

// ---- the HUD
const pad = (n: number, width: number) => String(Math.max(0, Math.round(n))).padStart(width, '0');

const line = computed(() =>
{
    const m = message.value;
    if (m && clock.value - m.at < MESSAGE_MS) return m.text;
    return status(state.value);
});

const weapon = computed(() => WEAPONS[state.value.player.weapon]);

const lowAmmo = computed(() =>
{
    const p = state.value.player;
    return p.mag + p.reserve === 0 || p.mag < Math.max(2, weapon.value.mag * 0.2);
});

const dead = computed(() => state.value.phase === 'dead' && clock.value - deadAt > DEAD_MS);

onMounted(() =>
{
    last = performance.now();
    raf = requestAnimationFrame(frame);
    bridgeEvents.addEventListener(onBridgeEvent);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
});

onBeforeUnmount(() =>
{
    cancelAnimationFrame(raf);
    bridgeEvents.removeEventListener(onBridgeEvent);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
});
</script>

<template>
    <div class="marines">
        <div class="head">
            <span class="title">MARINES · OLEADA {{ state.wave.n }}</span>
            <button v-if="screen === 'playing' && state.phase === 'playing'" class="head-key pressable" @click="pause">[II]</button>
            <button v-else class="head-key pressable" @click="marines.close()">[X]</button>
        </div>

        <div
            class="stage" data-no-swipe
            @touchstart="aimStart" @touchmove="aimMove" @touchend="aimEnd" @touchcancel="aimEnd" @mousedown="onMouseDown">
            <MarinesView ref="view" />
        </div>

        <div v-if="screen === 'title'" class="panel">
            <div class="big">MARINES</div>
            <div class="dim">LV-426 · ESPERANZA DE HADLEY</div>
            <div class="brief">
                <div v-for="l in ARENA_OPERATIONS.briefing" :key="l">» {{ l }}</div>
            </div>
            <div class="dim help">
                ARRASTRE SOBRE LA VISTA PARA GIRAR<br />
                JOYSTICK PARA MOVERSE<br />
                MANTENGA FUEGO PARA RÁFAGAS<br />
                GRANADA: LANZAGRANADAS DEL RIFLE<br />
                ARMA: CAMBIA · SEGUIR / QUIETOS: ESCUADRA<br />
                CUIDADO CON LA SANGRE ÁCIDA
            </div>
            <div v-if="marines.records.wave" class="dim">
                RÉCORD · OLEADA {{ marines.records.wave }} · {{ marines.records.score }} PTS
            </div>
            <div class="actions">
                <button class="act pressable" @click="start">[INICIAR]</button>
                <button class="act pressable" @click="marines.close()">[SALIR]</button>
            </div>
        </div>

        <div v-else-if="screen === 'paused'" class="panel">
            <div class="big">PAUSA</div>
            <div class="actions">
                <button class="act pressable" @click="screen = 'playing'">[CONTINUAR]</button>
            </div>
            <div class="actions">
                <button class="act pressable" @click="nextSensitivity">[SENSIBILIDAD ×{{ marines.prefs.sensitivity }}]</button>
                <button class="act pressable" @click="toggleFps">[{{ marines.prefs.fps }} FPS]</button>
            </div>
            <div class="actions">
                <button class="act pressable" @click="start">[REINICIAR]</button>
                <button class="act pressable" @click="marines.close()">[SALIR]</button>
            </div>
        </div>

        <div v-else-if="dead" class="panel">
            <div class="big">BAJA CONFIRMADA</div>
            <div class="dim">
                OLEADA {{ state.wave.n }} · {{ state.score }} PTS · {{ state.kills }} BAJAS
            </div>
            <div class="dim">PRECISIÓN {{ Math.round(accuracy(state) * 100) }} % · T+{{ formatDuration(state.timeMs).slice(3) }}</div>
            <div v-if="marines.records.wave" class="dim">
                RÉCORD · OLEADA {{ marines.records.wave }} · {{ marines.records.score }} PTS
            </div>
            <div class="actions">
                <button class="act pressable" @click="start">[REINTENTAR]</button>
                <button class="act pressable" @click="marines.close()">[SALIR]</button>
            </div>
        </div>

        <div class="hud">
            <span>SALUD {{ bar(state.player.health / PLAYER.health, 8) }} <span :class="{ warn: state.player.health < LOW_HEALTH }">{{ pad(state.player.health, 3) }}</span></span>
            <span>BLIND {{ bar(state.player.armor / PLAYER.armor, 5) }}</span>
        </div>
        <div class="hud">
            <span :class="{ warn: lowAmmo }">{{ weapon.unit }} {{ pad(state.player.mag, 2) }}/{{ pad(state.player.reserve, 3) }}</span>
            <span>{{ weapon.name }}</span>
            <span>{{ pad(state.score, 5) }} PTS</span>
        </div>
        <div class="msg">» {{ line }}</div>

        <MarinesControls
            :reloading="state.player.reloadMs > 0" :grenades="state.player.grenades" :weapons="owned(state.player).length" :order="state.order"
            @move="onMove" @fire="onFire" @reload="perform('reload')" @switch="perform('switch')" @grenade="perform('grenade')" @order="perform('order')" />
    </div>
</template>

<style scoped lang="scss">
.marines {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: calc(6px + var(--inset-top, 0px)) 8px calc(10px + var(--inset-bottom, 0px));
    background: var(--ph-bg);
}

.head {
    position: relative;
    // above the panels, so [X] is always there
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    .title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; @include inverse; padding: 0 6px; }
}

.head-key, .act {
    font: inherit;
    color: var(--ph);
    background: none;
    border: none;
    padding: 4px 6px;
    @include glow;
    &:active { @include inverse; }
}

.stage {
    position: relative;
    flex: 1;
    min-height: 0;
    border: 1px solid var(--ph-dim);
    margin: 0 10px;
    // a drag on the view is the aim: the page must not scroll with it
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}

.panel {
    // over the whole screen, under the header: on a small phone the view alone is too short for the text
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: calc(46px + var(--inset-top, 0px)) 18px calc(14px + var(--inset-bottom, 0px));
    text-align: center;
    z-index: 1;
    // the view shows through, faintly
    &::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--ph-bg); opacity: 0.93; }
    .big { font-size: 1.6em; @include glow(1.4); }
    .brief { text-align: left; }
    .help { font-size: 0.85em; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
}

.dim { color: var(--ph-dim); }

.hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 10px;
    color: var(--ph-dim);
    .warn { @include inverse; padding: 0 4px; }
}

.msg {
    padding: 0 10px;
    // two lines, so a long message doesn't move the keys
    min-height: 2.4em;
    line-height: 1.2em;
}
</style>
