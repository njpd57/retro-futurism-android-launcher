<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useIsolationStore } from '@/stores/useIsolationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { DECK_C } from '@/games/isolation/decks';
import { BACK_MS, SAVE_MS, TURN_MS, WALK_MS, alienDistance, newGame, reduce, step, useAction, type GameEvent, type GameState, type Input } from '@/games/isolation/game';
import { restore, snapshot, type SavedGame } from '@/games/isolation/save';
import { messageFor, objective } from '@/games/isolation/story';
import { cellPose, type Pose } from '@/games/isolation/view';
import { tick } from '@/utils/haptics';
import { bar, formatDuration } from '@/utils/tui';
import IsolationControls from './IsolationControls.vue';
import IsolationView from './IsolationView.vue';

const isolation = useIsolationStore();
const settings = useSettingsStore();
const sound = useSoundStore();
const bridgeEvents = useBridgeEventStore();

const FRAME_MS = 1000 / 30;
const MESSAGE_MS = 4000;
const FLASH_MS = 700;
/** a heartbeat on the vibrator while the creature is next to the player */
const HEARTBEAT_MS = 850;
const rng = Math.random;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const view = ref<InstanceType<typeof IsolationView> | null>(null);
const state = shallowRef<GameState>(newGame(DECK_C, rng));
const screen = ref<'title' | 'playing' | 'paused'>('title');
const message = ref<{ text: string; at: number } | null>(null);
const clock = ref(0);

let raf = 0;
let last = 0;
let backgrounded = false;
let held: Input | null = null;
let lastPing = -1e9;
let deadAt = 0;
let lastBeat = 0;

// the camera glides between cells: from `fromPose` to the player's pose over `animMs`
let fromPose: Pose = poseOf(state.value);
let animStart = 0;
let animMs = 0;
let animWalk = false;

function poseOf(s: GameState): Pose
{
    return cellPose(s.grid, s.player.cell, s.player.dir);
}

function currentPose(now: number): { pose: Pose; bob: number }
{
    const to = poseOf(state.value);
    const t = animMs ? Math.min(1, (now - animStart) / animMs) : 1;
    if (t >= 1) return { pose: to, bob: 0 };
    const e = t * t * (3 - 2 * t);
    let dyaw = to.yaw - fromPose.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    return {
        pose: { x: fromPose.x + (to.x - fromPose.x) * e, y: fromPose.y + (to.y - fromPose.y) * e, yaw: fromPose.yaw + dyaw * e },
        bob: animWalk ? -Math.sin(t * Math.PI) * 0.025 : 0,
    };
}

function apply(input: Input)
{
    if (screen.value !== 'playing') return;
    const now = performance.now();
    const before = state.value;
    const r = reduce(before, input);
    if (r.state === before) return;
    if (r.state.player.cell !== before.player.cell || r.state.player.dir !== before.player.dir)
    {
        fromPose = currentPose(now).pose;
        animStart = now;
        animWalk = r.state.player.cell !== before.player.cell;
        animMs = reducedMotion ? 0 : animWalk ? (input === 'back' ? BACK_MS : WALK_MS) : TURN_MS;
    }
    state.value = r.state;
    handle(r.events, now);
}

function handle(events: GameEvent[], now: number)
{
    for (const e of events)
    {
        switch (e)
        {
            case 'step': sound.playAlways('step'); break;
            case 'doorOpen': case 'doorClose': case 'doorForced': sound.playAlways('door'); break;
            case 'spotted':
                sound.playAlways('hiss');
                if (settings.haptics) tick(60);
                break;
            case 'near': sound.playAlways('hiss'); break;
            case 'ping':
                lastPing = now;
                sound.playAlways('ping');
                break;
            case 'pickup': sound.playAlways('select'); break;
            case 'saveStart': sound.playAlways('tick'); break;
            case 'saved':
                isolation.save = snapshot(state.value);
                sound.playAlways('select');
                break;
            case 'ventNear': sound.playAlways('vent'); break;
            case 'bump': sound.play('back'); break;
            case 'won':
                sound.playAlways('alert');
                // nothing left to continue
                isolation.save = null;
                isolation.suspended = null;
                break;
            case 'dead':
                deadAt = now;
                held = null;
                sound.playAlways('screech');
                if (settings.haptics) tick(400);
                break;
        }
    }
    const line = messageFor(events, state.value);
    if (line) message.value = { text: line, at: now };
}

function frame(now: number)
{
    raf = requestAnimationFrame(frame);
    if (backgrounded || now - last < FRAME_MS) return;
    const dt = Math.min(100, now - last);
    last = now;

    if (screen.value === 'playing' && state.value.phase === 'playing')
    {
        if (held) apply(held);
        const r = step(state.value, dt, rng);
        state.value = r.state;
        handle(r.events, now);
    }
    clock.value = now;

    const s = state.value;
    const { pose, bob } = currentPose(now);
    const dist = alienDistance(s);
    if (screen.value === 'playing' && s.phase === 'playing' && dist <= 1.5 && now - lastBeat > HEARTBEAT_MS)
    {
        lastBeat = now;
        if (settings.haptics) tick(35);
    }
    view.value?.draw({
        state: s, pose, bob, now,
        interference: reducedMotion || s.phase !== 'playing' ? 0 : Math.min(1, Math.max(0, (3.5 - dist) / 3)),
        sincePing: now - lastPing,
        flash: s.phase === 'dead' ? Math.max(0, 1 - (now - deadAt) / FLASH_MS) : 0,
    });
}

/** A new game, saved straight away: dying before the first terminal starts the deck again. */
function start()
{
    begin(newGame(DECK_C, rng), 'playing');
    isolation.save = snapshot(state.value);
    isolation.suspended = null;
}

function begin(s: GameState, on: 'playing' | 'paused')
{
    state.value = s;
    fromPose = poseOf(s);
    animMs = 0;
    held = null;
    message.value = { text: objective(s), at: performance.now() };
    screen.value = on;
}

/** From the title: the game left halfway (paused, to get your bearings), or else the last save. */
function resume()
{
    const suspended = isolation.suspended;
    if (suspended)
    {
        isolation.suspended = null;
        begin(restore(suspended, rng), 'paused');
    }
    else if (isolation.save) load(isolation.save);
}

function load(saved: SavedGame)
{
    begin(restore(saved, rng), 'playing');
    message.value = { text: 'PROGRESO RECUPERADO.', at: performance.now() };
}

/** Leaving keeps the game exactly as it was, to pick it up later; a finished one leaves nothing. */
function suspend()
{
    if (screen.value === 'title') return;
    isolation.suspended = state.value.phase === 'playing' ? snapshot(state.value) : null;
}

function pause()
{
    held = null;
    if (screen.value === 'playing' && state.value.phase === 'playing') screen.value = 'paused';
}

function onKey(e: KeyboardEvent)
{
    if (e.key === 'Escape' || e.key === 'p')
    {
        if (screen.value === 'paused') screen.value = 'playing'; else pause();
        return;
    }
    const input = KEYS[e.key];
    if (!input || screen.value !== 'playing') return;
    e.preventDefault();
    if (input === 'forward' || input === 'back') held = input;
    else if (!e.repeat) apply(input);
}

function onKeyUp(e: KeyboardEvent)
{
    if (KEYS[e.key] === held) held = null;
}

const KEYS: Record<string, Input> = {
    ArrowUp: 'forward', w: 'forward', ArrowDown: 'back', s: 'back',
    ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
    ' ': 'use', e: 'use', Enter: 'use', t: 'tracker',
};

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause')
    {
        backgrounded = true;
        pause();
        // Android may close the app while it is in the background
        suspend();
    }
    else if (ev.name === 'afterResume')
    {
        backgrounded = false;
        last = performance.now();
    }
}

const USE_LABELS = { hide: 'ESCONDERSE', unhide: 'SALIR', save: 'GUARDAR', open: 'ABRIR', close: 'CERRAR' } as const;
const useLabel = computed(() =>
{
    const a = useAction(state.value);
    return a && USE_LABELS[a];
});

const status = computed(() =>
{
    const s = state.value;
    return `CÉLULAS ${bar(s.collected / s.needed, s.needed)} ${s.collected}/${s.needed}`;
});

const line = computed(() =>
{
    const m = message.value;
    const s = state.value;
    if (s.saveMs > 0) return `GUARDANDO ${bar(1 - s.saveMs / SAVE_MS, 10)}`;
    if (m && clock.value - m.at < MESSAGE_MS) return m.text;
    if (s.player.hidden) return 'OCULTO EN LA TAQUILLA';
    return objective(s);
});

const resumable = computed(() => isolation.suspended ?? isolation.save);

onMounted(() =>
{
    last = performance.now();
    raf = requestAnimationFrame(frame);
    bridgeEvents.addEventListener(onBridgeEvent);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
});

onBeforeUnmount(() =>
{
    suspend();
    cancelAnimationFrame(raf);
    bridgeEvents.removeEventListener(onBridgeEvent);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
    <div class="isolation">
        <div class="head">
            <span class="title">AISLAMIENTO · {{ state.title }}</span>
            <span>T+{{ formatDuration(state.timeMs).slice(3) }}</span>
            <button v-if="screen === 'playing' && state.phase === 'playing'" class="head-key pressable" @click="pause">[II]</button>
            <button v-else class="head-key pressable" @click="isolation.close()">[X]</button>
        </div>

        <div class="stage">
            <IsolationView ref="view" />

            <div v-if="screen === 'title'" class="panel">
                <div class="big">AISLAMIENTO</div>
                <div class="dim">USCSS NOSTROMO · {{ state.title }}</div>
                <div class="brief">
                    <div v-for="l in DECK_C.briefing" :key="l">» {{ l }}</div>
                </div>
                <div class="dim help">
                    ▲ AVANZA, MANTÉN PARA CAMINAR · ◄ ► GIRA<br />
                    USAR: PUERTAS, TAQUILLAS Y TERMINALES<br />
                    EL RASTREADOR SOLO VE LO QUE SE MUEVE, Y SE OYE
                </div>
                <div v-if="resumable" class="dim">
                    {{ isolation.suspended ? 'PARTIDA SUSPENDIDA' : 'ÚLTIMO GUARDADO' }} · T+{{ formatDuration(resumable.timeMs).slice(3) }}
                </div>
                <div class="actions">
                    <button v-if="resumable" class="act pressable" @click="resume">[CONTINUAR]</button>
                    <button class="act pressable" @click="start">{{ resumable ? '[NUEVA PARTIDA]' : '[INICIAR]' }}</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>

            <div v-else-if="screen === 'paused'" class="panel">
                <div class="big">PAUSA</div>
                <div class="actions">
                    <button class="act pressable" @click="screen = 'playing'">[CONTINUAR]</button>
                    <button class="act pressable" @click="start">[REINICIAR]</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>

            <div v-else-if="state.phase === 'dead' && clock - deadAt > FLASH_MS" class="panel">
                <div class="big">TRIPULANTE PERDIDO</div>
                <div class="dim">{{ status }} · T+{{ formatDuration(state.timeMs).slice(3) }}</div>
                <div class="actions">
                    <button v-if="isolation.save" class="act pressable" @click="load(isolation.save)">[CARGAR]</button>
                    <button class="act pressable" @click="start">[REINICIAR]</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>

            <div v-else-if="state.phase === 'won'" class="panel">
                <div class="big">LANZADERA EN VUELO</div>
                <div class="dim">TIEMPO {{ formatDuration(state.timeMs).slice(3) }}</div>
                <div class="actions">
                    <button class="act pressable" @click="start">[OTRA VEZ]</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>
        </div>

        <div class="hud">
            <span>{{ status }}</span>
            <span v-if="state.near && reducedMotion" class="warn">INTERFERENCIA</span>
        </div>
        <div class="msg">» {{ line }}</div>

        <IsolationControls
            :use="useLabel" :tracker="state.tracker.raised" :hidden="state.player.hidden"
            @input="apply" @hold="held = $event" />
    </div>
</template>

<style scoped lang="scss">
.isolation {
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
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    .title { flex: 1; @include inverse; padding: 0 6px; }
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
}

.panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px;
    text-align: center;
    z-index: 1;
    // the view shows through, faintly
    &::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--ph-bg); opacity: 0.88; }
    .big { font-size: 1.6em; @include glow(1.4); }
    .brief { text-align: left; }
    .help { font-size: 0.85em; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
}

.dim { color: var(--ph-dim); }

.hud {
    display: flex;
    justify-content: space-between;
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
