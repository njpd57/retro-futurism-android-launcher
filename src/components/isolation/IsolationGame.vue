<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useIsolationStore, SENSITIVITY_STEPS } from '@/stores/useIsolationStore';
import { useLogStore } from '@/stores/useLogStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { advance, deckScore, endingOf, levelOf, modeOf, startCampaign, startInfinite, CAMPAIGN_LENGTH } from '@/games/isolation/campaign';
import { RECIPES, canCraft } from '@/games/isolation/crafting';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '@/games/isolation/difficulty';
import { MOVE, SAVE_MS, alienDistance, reduce, step, terminalTask, useAction, type Controls, type GameEvent, type GameState, type Input } from '@/games/isolation/game';
import { deckFor } from '@/games/isolation/decks';
import { newSeed } from '@/games/isolation/generate';
import { ENDINGS, LOGS, type Ending } from '@/games/isolation/logs';
import { ACHIEVEMENTS, infiniteUnlocked } from '@/games/isolation/progress';
import { restore, snapshot, type SavedGame } from '@/games/isolation/save';
import { messageFor, objective } from '@/games/isolation/story';
import type { Pose } from '@/games/isolation/view';
import { aimPixels } from '@/games/marines/aim';
import { tick } from '@/utils/haptics';
import { bar, formatDuration } from '@/utils/tui';
import IsolationArchive from './IsolationArchive.vue';
import IsolationBag from './IsolationBag.vue';
import IsolationControls from './IsolationControls.vue';
import IsolationMap from './IsolationMap.vue';
import IsolationView from './IsolationView.vue';
import { prefersReducedMotion } from '@/composables/useReducedMotion';

const isolation = useIsolationStore();
const log = useLogStore();
const settings = useSettingsStore();
const sound = useSoundStore();
const bridgeEvents = useBridgeEventStore();

/** The movement keys of a keyboard. */
type HoldKey = 'forward' | 'back' | 'left' | 'right';

/** radians a drag of one pixel turns the player, at sensitivity 1 */
const TURN_PER_PX = 0.0065;

const FRAME_MS = 1000 / 30;
const MESSAGE_MS = 4000;
const FLASH_MS = 700;
/** a heartbeat on the vibrator while the creature is next to the player */
const HEARTBEAT_MS = 850;
const rng = Math.random;
const reducedMotion = prefersReducedMotion();

type Screen = 'title' | 'difficulty' | 'briefing' | 'playing' | 'paused' | 'report' | 'ending' | 'archive';

const view = ref<InstanceType<typeof IsolationView> | null>(null);
// the title shows a deck behind it; a real game replaces it
const state = shallowRef<GameState>(startCampaign('normal', rng));
const screen = ref<Screen>('title');
const message = ref<{ text: string; at: number } | null>(null);
const clock = ref(0);
const bagOpen = ref(false);
const mapOpen = ref(false);
/** the deck after the one just won, already saved */
const pending = shallowRef<GameState | null>(null);
/** a game is running (as opposed to the title with its backdrop) */
let inGame = false;
const intent = ref<'campaign' | 'infinite'>('campaign');
const seed = ref(newSeed());
/** the achievements earned since the deck began, for the report */
const earned = ref<string[]>([]);
const ending = ref<Ending | null>(null);

let raf = 0;
let last = 0;
let backgrounded = false;
/** the movement keys held down on a keyboard */
const held = new Set<HoldKey>();
/** the joystick, both -1..1 */
const stick = { strafe: 0, forward: 0 };
/** radians still to turn from drags on the view */
let turnAcc = 0;
let lastPing = -1e9;
let deadAt = 0;
let lastBeat = 0;

/** The camera is where the player is; it bobs a little as they walk. */
function currentPose(): { pose: Pose; bob: number }
{
    const p = state.value.player;
    const bob = reducedMotion ? 0 : Math.sin(p.walked * 3.2) * 0.02 * Math.min(1, p.speed / MOVE.speed);
    return { pose: { x: p.x, y: p.y, yaw: p.yaw }, bob };
}

/** What the held keys ask for now. */
function controls(dt: number): Controls
{
    const axis = (plus: HoldKey, minus: HoldKey) => (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0);
    const turn = axis('right', 'left') * MOVE.turnRate * dt / 1000 + turnAcc;
    turnAcc = 0;
    return {
        move: Math.max(-1, Math.min(1, axis('forward', 'back') + stick.forward)),
        strafe: stick.strafe,
        turn,
    };
}

function onMove(strafe: number, forward: number)
{
    stick.strafe = strafe;
    stick.forward = forward;
}

// ---- turning: a drag on the view. It follows one finger by its identifier and uses how far it moved, so where the
// screen's curvature draws things does not matter.
let aimId: number | null = null;
let aimX = 0;
let mouseAim = false;

const turnPerPx = () => TURN_PER_PX * isolation.prefs.sensitivity;
const aiming = () => screen.value === 'playing' && !bagOpen.value && !mapOpen.value;

function aimStart(e: TouchEvent)
{
    if (aimId !== null || !aiming()) return;
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
        turnAcc += aimPixels(t.clientX - aimX) * turnPerPx();
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
    if (e.button === 0 && aiming()) mouseAim = true;
}

function onMouseMove(e: MouseEvent)
{
    if (mouseAim) turnAcc += e.movementX * turnPerPx();
}

function onMouseUp()
{
    mouseAim = false;
}

function nextSensitivity()
{
    const i = SENSITIVITY_STEPS.findIndex(v => v >= isolation.prefs.sensitivity - 1e-6);
    isolation.prefs = { ...isolation.prefs, sensitivity: SENSITIVITY_STEPS[(i + 1) % SENSITIVITY_STEPS.length] };
}

/** Lets go of everything the hands were holding. */
function release()
{
    held.clear();
    stick.strafe = stick.forward = 0;
    turnAcc = 0;
    aimId = null;
    mouseAim = false;
}

function apply(input: Input)
{
    if (screen.value !== 'playing') return;
    const now = performance.now();
    const before = state.value;
    const r = reduce(before, input);
    if (r.state === before) return;
    state.value = r.state;
    handle(r.events, now);
}

/** Folds something into the archive and shows the achievements it earned. */
function remember(event: Parameters<typeof isolation.record>[0], now: number)
{
    const fresh = isolation.record(event);
    if (!fresh.length) return;
    earned.value = [...earned.value, ...fresh];
    const title = ACHIEVEMENTS.find(a => a.id === fresh[0])?.title;
    if (title) message.value = { text: `LOGRO: ${title}`, at: now + 1 };
}

function handle(events: GameEvent[], now: number)
{
    for (const e of events)
    {
        switch (e)
        {
            case 'step': sound.playAlways('step'); break;
            case 'doorOpen': case 'doorClose': case 'doorForced': sound.playAlways('door'); break;
            case 'spotted': case 'ashSpotted':
                sound.playAlways('hiss');
                if (settings.haptics) tick(60);
                break;
            case 'near': sound.playAlways('hiss'); break;
            case 'ping':
                lastPing = now;
                sound.playAlways('ping');
                break;
            case 'pickup': case 'lootScrap': case 'lootWires': case 'lootChems': case 'lootFlamer': case 'lootCat':
            case 'craftDecoy': case 'craftFlare': case 'craftFuel': case 'diverted': case 'powerBack':
                sound.playAlways('select');
                break;
            case 'throwDecoy': case 'decoyPing': sound.playAlways('clatter'); break;
            case 'throwFlare': sound.playAlways('flame'); break;
            case 'fire':
                sound.playAlways('flame');
                if (settings.haptics) tick(120);
                break;
            case 'scare':
                sound.playAlways('hiss');
                if (settings.haptics) tick(60);
                break;
            case 'noParts': case 'noDecoy': case 'noFlare': case 'noFlamer': case 'noFuel': case 'bagFull': case 'locked': case 'steamBlock':
                sound.play('back');
                break;
            case 'saveStart': sound.playAlways('tick'); break;
            case 'saved':
                isolation.save = snapshot(state.value);
                sound.playAlways('select');
                break;
            case 'log': {
                const id = state.value.logs[state.value.logs.length - 1];
                if (id) remember({ type: 'log', id }, now);
                break;
            }
            case 'ashOff': remember({ type: 'ashOff' }, now); break;
            case 'ventNear': case 'steam': sound.playAlways('vent'); break;
            case 'blackout': sound.playAlways('tick'); break;
            case 'countdown':
                sound.playAlways('alert');
                if (settings.haptics) tick(80);
                break;
            case 'meow': sound.playAlways('ping'); break;
            case 'bump': case 'saveCancel': sound.play('back'); break;
            case 'won': deckWon(now); break;
            case 'dead':
                deadAt = now;
                release();
                bagOpen.value = false;
                mapOpen.value = false;
                sound.playAlways(state.value.death === 'blast' ? 'blast' : 'screech');
                if (settings.haptics) tick(400);
                remember({ type: 'death' }, now);
                if (state.value.death === 'blast') remember({ type: 'ending', state: state.value, ending: 'blast' }, now);
                break;
        }
    }
    const line = messageFor(events, state.value);
    if (line)
    {
        message.value = { text: line, at: now };
        log.push('MTR', line);
    }
}

/** The deck is done: the next one is made and saved at once, so leaving now loses nothing. */
function deckWon(now: number)
{
    sound.playAlways('alert');
    const done = state.value;
    release();
    bagOpen.value = false;
    mapOpen.value = false;
    remember({ type: 'deck', state: done }, now);
    const next = advance(done, rng);
    isolation.suspended = null;
    if (next)
    {
        pending.value = next;
        isolation.save = snapshot(next);
        screen.value = 'report';
        return;
    }
    pending.value = null;
    isolation.save = null;
    ending.value = endingOf(done);
    remember({ type: 'ending', state: done, ending: ending.value }, now);
    screen.value = 'ending';
}

function frame(now: number)
{
    raf = requestAnimationFrame(frame);
    if (backgrounded || now - last < FRAME_MS) return;
    const dt = Math.min(100, now - last);
    last = now;

    if (screen.value === 'playing' && state.value.phase === 'playing')
    {
        const r = step(state.value, dt, rng, controls(dt));
        state.value = r.state;
        handle(r.events, now);
    }
    clock.value = now;

    const s = state.value;
    const { pose, bob } = currentPose();
    const dist = alienDistance(s);
    const live = screen.value === 'playing' && s.phase === 'playing';
    if (live && dist <= 3 && now - lastBeat > HEARTBEAT_MS)
    {
        lastBeat = now;
        if (settings.haptics) tick(35);
    }
    view.value?.draw({
        state: s, pose, bob, now,
        interference: reducedMotion || s.phase !== 'playing' ? 0 : Math.min(1, Math.max(0, (7 - dist) / 6)),
        sincePing: now - lastPing,
        flash: s.phase === 'dead' ? Math.max(0, 1 - (now - deadAt) / FLASH_MS) : 0,
    });
}

/** Opens the choice of difficulty for a new campaign or endless run. */
function choose(mode: 'campaign' | 'infinite')
{
    intent.value = mode;
    if (mode === 'infinite') seed.value = newSeed();
    screen.value = 'difficulty';
}

/** A new run, saved straight away: dying before the first terminal starts the deck again. */
function launch(difficulty: Difficulty)
{
    isolation.prefs = { ...isolation.prefs, difficulty };
    const s = intent.value === 'campaign' ? startCampaign(difficulty, rng) : startInfinite(seed.value, difficulty, rng);
    begin(s, 'briefing');
    isolation.save = snapshot(s);
    isolation.suspended = null;
}

function begin(s: GameState, on: 'playing' | 'paused' | 'briefing')
{
    state.value = s;
    inGame = true;
    pending.value = null;
    release();
    earned.value = [];
    message.value = { text: objective(s), at: performance.now() };
    bagOpen.value = false;
    mapOpen.value = false;
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
    const s = restore(saved, rng);
    // a deck that has not been touched shows its briefing
    const fresh = s.timeMs === s.startMs && !s.mapped;
    begin(s, fresh ? 'briefing' : 'playing');
    if (!fresh) message.value = { text: 'PROGRESO RECUPERADO.', at: performance.now() };
}

/** Leaving keeps the game exactly as it was, to pick it up later; a finished one leaves nothing. */
function suspend()
{
    if (!inGame) return;
    isolation.suspended = state.value.phase === 'playing' && screen.value !== 'report' ? snapshot(state.value) : null;
}

/** Back to the title: the game stays suspended. */
function toTitle()
{
    suspend();
    inGame = false;
    pending.value = null;
    release();
    bagOpen.value = false;
    mapOpen.value = false;
    screen.value = 'title';
}

function nextDeck()
{
    if (pending.value) begin(pending.value, 'briefing');
}

function pause()
{
    release();
    bagOpen.value = false;
    if (screen.value === 'playing' && state.value.phase === 'playing') screen.value = 'paused';
}

function onKey(e: KeyboardEvent)
{
    if (e.key === 'Escape' || e.key === 'p')
    {
        if (screen.value === 'paused') screen.value = 'playing'; else pause();
        return;
    }
    if (screen.value !== 'playing') return;
    if (e.key === 'b')
    {
        bagOpen.value = !bagOpen.value;
        mapOpen.value = false;
        return;
    }
    if (e.key === 'm' && state.value.mapped)
    {
        mapOpen.value = !mapOpen.value;
        bagOpen.value = false;
        return;
    }
    const key = HOLD_KEYS[e.key];
    if (key)
    {
        e.preventDefault();
        held.add(key);
        return;
    }
    const input = KEYS[e.key];
    if (!input) return;
    e.preventDefault();
    if (!e.repeat) apply(input);
}

function onKeyUp(e: KeyboardEvent)
{
    const key = HOLD_KEYS[e.key];
    if (key) held.delete(key);
}

const HOLD_KEYS: Record<string, HoldKey> = {
    ArrowUp: 'forward', w: 'forward', ArrowDown: 'back', s: 'back', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
};

const KEYS: Record<string, Input> = {
    ' ': 'use', e: 'use', Enter: 'use', t: 'tracker', 1: 'throwDecoy', 2: 'throwFlare', f: 'fire',
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

const USE_LABELS = { hide: 'ESCONDERSE', unhide: 'SALIR', open: 'ABRIR', close: 'CERRAR' } as const;
const TASK_LABELS = { save: 'GUARDAR', log: 'LEER', divert: 'DESVIAR', ashOff: 'APAGAR A ASH' } as const;
const useLabel = computed(() =>
{
    const a = useAction(state.value);
    if (!a) return null;
    return a === 'save' ? TASK_LABELS[terminalTask(state.value)] : USE_LABELS[a];
});

const status = computed(() =>
{
    const s = state.value;
    return `CÉLULAS ${bar(s.collected / s.needed, s.needed)} ${s.collected}/${s.needed}${s.jones ? ' · JONES' : ''}`;
});

const line = computed(() =>
{
    const m = message.value;
    const s = state.value;
    if (s.saveMs > 0) return `${terminalTask(s) === 'save' ? 'GUARDANDO' : 'TRABAJANDO'} ${bar(1 - s.saveMs / SAVE_MS, 10)}`;
    if (m && clock.value - m.at < MESSAGE_MS) return m.text;
    if (s.player.hidden) return 'OCULTO EN LA TAQUILLA';
    return objective(s);
});

/** the self-destruct clock, blinking in the last minute */
const countdown = computed(() =>
{
    const ms = state.value.countdownMs;
    if (ms === null) return null;
    return { text: formatDuration(ms).slice(3), urgent: ms <= 60000 };
});

/** something can be made right now: the [OBJETOS] key says so */
const canMake = computed(() => RECIPES.some(r => canCraft(state.value.bag, r)));

const resumable = computed(() => isolation.suspended ?? isolation.save);
const unlocked = computed(() => infiniteUnlocked(isolation.progress));
const playing = computed(() => screen.value === 'playing' && state.value.phase === 'playing');

const deckName = computed(() => modeOf(state.value.deck) === 'infinite' ? `SECTOR ${levelOf(state.value.deck)}` : `CUBIERTA ${levelOf(state.value.deck)}/${CAMPAIGN_LENGTH}`);
const resumeLine = computed(() =>
{
    const r = resumable.value;
    if (!r) return '';
    return `${isolation.suspended ? 'PARTIDA SUSPENDIDA' : 'ÚLTIMO GUARDADO'} · T+${formatDuration(r.timeMs).slice(3)}`;
});

const briefingLines = computed(() => deckFor(state.value.deck)?.briefing ?? []);

const deathTitle = computed(() =>
{
    switch (state.value.death)
    {
        case 'ash': return 'ASH LE HA ALCANZADO';
        case 'blast': return ENDINGS.blast.title;
        default: return 'TRIPULANTE PERDIDO';
    }
});

/** the report of a deck just won */
const report = computed(() =>
{
    const s = state.value;
    return {
        time: formatDuration(s.timeMs - s.startMs).slice(3),
        logs: s.logs.length,
        seen: s.spotted - s.spottedStart,
        points: modeOf(s.deck) === 'infinite' ? s.score + deckScore(s) : null,
    };
});

const earnedTitles = computed(() => earned.value.map(id => ACHIEVEMENTS.find(a => a.id === id)?.title).filter(Boolean));

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
    suspend();
    cancelAnimationFrame(raf);
    bridgeEvents.removeEventListener(onBridgeEvent);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
});
</script>

<template>
    <div class="isolation">
        <div class="head">
            <span class="title">AISLAMIENTO · {{ screen === 'title' || screen === 'difficulty' || screen === 'archive' ? 'USCSS NOSTROMO' : state.title }}</span>
            <span v-if="countdown" :class="{ blink: countdown.urgent }" class="warn">⏱{{ countdown.text }}</span>
            <span v-else>T+{{ formatDuration(state.timeMs).slice(3) }}</span>
            <button v-if="playing" class="head-key pressable" @click="pause">[II]</button>
            <button v-else class="head-key pressable" @click="isolation.close()">[X]</button>
        </div>

        <div
            class="stage" data-no-swipe
            @touchstart="aimStart" @touchmove="aimMove" @touchend="aimEnd" @touchcancel="aimEnd" @mousedown="onMouseDown">
            <IsolationView ref="view" />

            <IsolationBag
                v-if="bagOpen && playing" :bag="state.bag"
                @craft="apply" @close="bagOpen = false" />

            <IsolationMap v-if="mapOpen && playing" :state="state" @close="mapOpen = false" />

            <div v-if="screen === 'title'" class="panel">
                <div class="big">AISLAMIENTO</div>
                <div class="dim">LA NOSTROMO · 5 CUBIERTAS · 1 ORGANISMO</div>
                <div class="dim help">
                    JOYSTICK: CAMINA (SUAVE = SIGILO)<br />
                    ARRASTRE SOBRE LA VISTA PARA GIRAR<br />
                    USAR: PUERTAS, TAQUILLAS Y TERMINALES<br />
                    EL RASTREADOR SOLO VE LO QUE SE MUEVE, Y SE OYE<br />
                    SEÑUELO ATRAE · BENGALA ILUMINA · FUEGO ESPANTA
                </div>
                <div v-if="resumable" class="dim">{{ resumeLine }}</div>
                <div class="actions col">
                    <button v-if="resumable" class="act pressable" @click="resume">[CONTINUAR]</button>
                    <button class="act pressable" @click="choose('campaign')">[NUEVA CAMPAÑA]</button>
                    <button v-if="unlocked" class="act pressable" @click="choose('infinite')">[MODO INFINITO]</button>
                    <span v-else class="dim">[MODO INFINITO ░░ TERMINE LA CAMPAÑA]</span>
                    <button class="act pressable" @click="screen = 'archive'">[ARCHIVO]</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>

            <div v-else-if="screen === 'difficulty'" class="panel">
                <div class="big">{{ intent === 'campaign' ? 'NUEVA CAMPAÑA' : 'MODO INFINITO' }}</div>
                <div v-if="intent === 'infinite'" class="dim">SEMILLA {{ String(seed).padStart(5, '0') }} · LA MISMA SEMILLA REPITE LOS SECTORES</div>
                <div class="dim">ELIJA LA DIFICULTAD</div>
                <div class="actions col">
                    <button v-for="d in DIFFICULTIES" :key="d" class="act pressable" @click="launch(d)">
                        [{{ DIFFICULTY[d].label }}]{{ isolation.prefs.difficulty === d ? ' «' : '' }}
                        <span class="dim small">{{ DIFFICULTY[d].hint }}</span>
                    </button>
                    <button v-if="intent === 'infinite'" class="act pressable" @click="seed = newSeed()">[OTRA SEMILLA]</button>
                    <button class="act pressable" @click="screen = 'title'">[ATRÁS]</button>
                </div>
            </div>

            <div v-else-if="screen === 'briefing'" class="panel">
                <div class="big">{{ state.title }}</div>
                <div class="dim">{{ deckName }} · {{ DIFFICULTY[state.difficulty].label }}</div>
                <div class="brief">
                    <div v-for="l in briefingLines" :key="l">» {{ l }}</div>
                </div>
                <div class="actions col">
                    <button class="act pressable" @click="screen = 'playing'">[INICIAR]</button>
                    <button class="act pressable" @click="toTitle">[MENÚ]</button>
                </div>
            </div>

            <div v-else-if="screen === 'paused'" class="panel">
                <div class="big">PAUSA</div>
                <div class="dim">{{ deckName }} · {{ status }}</div>
                <div class="actions col">
                    <button class="act pressable" @click="screen = 'playing'">[CONTINUAR]</button>
                    <button v-if="isolation.save" class="act pressable" @click="load(isolation.save)">[CARGAR GUARDADO]</button>
                    <button class="act pressable" @click="nextSensitivity">[SENSIBILIDAD ×{{ isolation.prefs.sensitivity }}]</button>
                    <button class="act pressable" @click="toTitle">[MENÚ]</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>

            <div v-else-if="state.phase === 'dead' && clock - deadAt > FLASH_MS" class="panel">
                <div class="big">{{ deathTitle }}</div>
                <template v-if="state.death === 'blast'">
                    <div class="brief"><div v-for="l in ENDINGS.blast.lines" :key="l">» {{ l }}</div></div>
                </template>
                <div v-else class="dim">{{ status }} · T+{{ formatDuration(state.timeMs).slice(3) }}</div>
                <div v-if="earnedTitles.length" class="dim">LOGRO: {{ earnedTitles.join(' · ') }}</div>
                <div class="actions col">
                    <button v-if="isolation.save" class="act pressable" @click="load(isolation.save)">[CARGAR]</button>
                    <button class="act pressable" @click="toTitle">[MENÚ]</button>
                    <button class="act pressable" @click="isolation.close()">[SALIR]</button>
                </div>
            </div>

            <div v-else-if="screen === 'report'" class="panel">
                <div class="big">{{ modeOf(state.deck) === 'infinite' ? 'SECTOR SUPERADO' : 'CUBIERTA SUPERADA' }}</div>
                <div class="dim">{{ state.title }}</div>
                <div class="brief">
                    <div>» TIEMPO {{ report.time }}</div>
                    <div>» REGISTROS LEÍDOS {{ report.logs }}/{{ LOGS.length }}</div>
                    <div>» AVISTAMIENTOS {{ report.seen }}</div>
                    <div v-if="report.points !== null">» PUNTOS {{ report.points }}</div>
                    <div v-if="state.jones">» JONES A BORDO</div>
                    <div v-for="t in earnedTitles" :key="String(t)">» LOGRO: {{ t }}</div>
                </div>
                <div class="actions col">
                    <button class="act pressable" @click="nextDeck">[{{ modeOf(state.deck) === 'infinite' ? 'SIGUIENTE SECTOR' : 'SIGUIENTE CUBIERTA' }}]</button>
                    <button class="act pressable" @click="toTitle">[MENÚ]</button>
                </div>
            </div>

            <div v-else-if="screen === 'ending' && ending" class="panel">
                <div class="big">{{ ENDINGS[ending].title }}</div>
                <div class="brief"><div v-for="(l, i) in ENDINGS[ending].lines" :key="i">{{ l ? `» ${l}` : '\u00a0' }}</div></div>
                <div class="dim">TIEMPO {{ formatDuration(state.timeMs).slice(3) }} · {{ DIFFICULTY[state.difficulty].label }}{{ state.fires === 0 ? ' · SIN FUEGO' : '' }}</div>
                <div v-for="t in earnedTitles" :key="String(t)" class="dim">LOGRO: {{ t }}</div>
                <div class="actions col">
                    <button class="act pressable" @click="screen = 'archive'">[ARCHIVO]</button>
                    <button class="act pressable" @click="toTitle">[MENÚ]</button>
                </div>
            </div>

            <IsolationArchive v-if="screen === 'archive'" @close="screen = inGame ? 'ending' : 'title'" />
        </div>

        <div class="hud">
            <span>{{ status }}</span>
            <span v-if="state.near && reducedMotion" class="warn">INTERFERENCIA</span>
            <span v-if="playing" class="keys">
                <button v-if="state.mapped" class="bag-key pressable" :class="{ on: mapOpen }" @click="mapOpen = !mapOpen; bagOpen = false">[PLANO]</button>
                <button class="bag-key pressable" :class="{ on: bagOpen }" @click="bagOpen = !bagOpen; mapOpen = false">
                    [OBJETOS{{ canMake ? ' ◉' : '' }}]
                </button>
            </span>
        </div>
        <div class="msg">» {{ line }}</div>

        <IsolationControls
            :use="useLabel" :tracker="state.tracker.raised" :hidden="state.player.hidden"
            :decoys="state.bag.decoys" :flares="state.bag.flares" :fuel="state.bag.flamer ? state.bag.fuel : null"
            @input="apply" @move="onMove" />
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
    .warn { @include inverse; padding: 0 4px; }
}

@media (prefers-reduced-motion: no-preference) {
    .blink { animation: countdown-blink 1s steps(1) infinite; }
}
@keyframes countdown-blink { 50% { opacity: 0.25; } }

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
    // a drag on the view turns the player: the page must not scroll with it
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
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
    .actions.col { flex-direction: column; align-items: center; gap: 2px; }
    .small { display: block; font-size: 0.7em; }
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

.keys { margin-left: auto; display: flex; gap: 2px; }

.bag-key {
    font: inherit;
    color: var(--ph);
    background: none;
    border: none;
    padding: 2px 6px;
    @include glow;
    &:active, &.on { @include inverse; }
}

.msg {
    padding: 0 10px;
    // two lines, so a long message doesn't move the keys
    min-height: 2.4em;
    line-height: 1.2em;
}
</style>
