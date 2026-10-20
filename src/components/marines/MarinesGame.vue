<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { SENSITIVITY_STEPS, useMarinesStore } from '@/stores/useMarinesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import type { SfxName } from '@/audio/sfx';
import { LOW_HEALTH, PLAYER, act, inSights, newGame, owned, step, weldAim, type Action, type Controls, type GameEvent, type MarinesState } from '@/games/marines/game';
import { ARENAS, ARENA_OPERATIONS, ARENA_ORDER } from '@/games/marines/map';
import { messageFor, status } from '@/games/marines/radio';
import { aimPixels } from '@/games/marines/aim';
import { ACHIEVEMENTS, achievementById, earnedBy } from '@/games/marines/achievements';
import { DIFFICULTY, DIFFICULTY_ORDER, MISSIONS, missionById, unlocked } from '@/games/marines/campaign';
import { buildReport, type Beaten, type Report } from '@/games/marines/report';
import { restore, snapshot } from '@/games/marines/save';
import { ENEMIES } from '@/games/marines/enemies';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '@/games/marines/weapons';
import { tick } from '@/utils/haptics';
import { bar, formatDuration } from '@/utils/tui';
import MarinesControls from './MarinesControls.vue';
import MarinesView from './MarinesView.vue';
import { prefersReducedMotion } from '@/composables/useReducedMotion';

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
const reducedMotion = prefersReducedMotion();

const view = ref<InstanceType<typeof MarinesView> | null>(null);
const campaignMode = computed(() => marines.prefs.mode === 'campaign');
const open = computed(() => unlocked(new Set(Object.keys(marines.campaign))));
const mission = computed(() => open.value.find(m => m.id === marines.prefs.mission) ?? open.value[0]);
const arena = computed(() => (campaignMode.value ? ARENAS[mission.value.arena] : ARENAS[marines.prefs.arena]) ?? ARENA_OPERATIONS);
const newRun = () => newGame(arena.value, { difficulty: marines.prefs.difficulty, mission: campaignMode.value ? mission.value.id : undefined });
const state = shallowRef<MarinesState>(newGame(ARENA_OPERATIONS));
/** the report of the run that just ended, and what it beat */
const report = ref<{ data: Report; beaten: Beaten[] } | null>(null);
/** the achievements the run that just ended earned for the first time */
const fresh = ref<string[]>([]);
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
        fire: held.fire || (marines.prefs.fire === 'auto' && inSights(state.value)),
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

function onFireAim(dx: number)
{
    if (screen.value === 'playing') turnAcc += aimPixels(dx) * turnPerPx();
}

function onFire(down: boolean)
{
    held.fire = down;
}

/** Awards what the run that just ended earned. */
function settle(won: boolean)
{
    if (!report.value) return;
    marines.tally(report.value.data, won);
    fresh.value = marines.unlock(earnedBy(report.value.data, {
        won, mission: state.value.mission, difficulty: marines.prefs.difficulty, missionsWon: new Set(Object.keys(marines.campaign)),
    }));
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
            case 'turretPlaced': case 'weldDone': case 'weldCut': sound.playAlways('select'); break;
            case 'noTurrets': case 'noWelds': case 'noDoor': sound.playAlways('dry'); break;
            case 'turretDown': case 'weldBroken': sound.playAlways('alert'); break;
            case 'spit': sound.playAlways('vent'); break;
            case 'turretShot':
                if (now - lastRattle > RATTLE_MS)
                {
                    lastRattle = now;
                    sound.playAlways('rattle');
                }
                break;
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
                marines.suspended = null;
                report.value = { data: buildReport(state.value), beaten: [] };
                // a campaign mission is not part of the endless records
                if (!state.value.mission) report.value.beaten = marines.record(report.value.data);
                settle(false);
                break;
            case 'won':
                deadAt = now;
                releaseAll();
                sound.playAlways('alert');
                marines.suspended = null;
                report.value = { data: buildReport(state.value), beaten: [] };
                if (state.value.mission) marines.win(state.value.mission, marines.prefs.difficulty, state.value.timeMs);
                settle(true);
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
    state.value = newRun();
    marines.suspended = null;
    report.value = null;
    fresh.value = [];
    releaseAll();
    message.value = { text: (campaignMode.value ? mission.value.briefing : arena.value.briefing)[0], at: performance.now() };
    screen.value = 'playing';
}

/** Picks the game up where it was left; a save that no longer fits is dropped. */
function resume()
{
    const saved = marines.suspended;
    marines.suspended = null;
    if (!saved) return;
    state.value = restore(saved);
    report.value = null;
    releaseAll();
    screen.value = 'paused';
}

function nextArena()
{
    const i = ARENA_ORDER.indexOf(marines.prefs.arena);
    marines.prefs = { ...marines.prefs, arena: ARENA_ORDER[(i + 1) % ARENA_ORDER.length] };
    state.value = newRun();
}

function toggleMode()
{
    marines.prefs = { ...marines.prefs, mode: campaignMode.value ? 'waves' : 'campaign' };
    state.value = newRun();
}

function nextMission()
{
    const i = open.value.findIndex(m => m.id === mission.value.id);
    marines.prefs = { ...marines.prefs, mission: open.value[(i + 1) % open.value.length].id };
    state.value = newRun();
}

function nextDifficulty()
{
    const i = DIFFICULTY_ORDER.indexOf(marines.prefs.difficulty);
    marines.prefs = { ...marines.prefs, difficulty: DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length] };
}

/** After a won mission: on to the next one, if there is one. */
const following = computed(() => MISSIONS[MISSIONS.findIndex(m => m.id === state.value.mission) + 1] ?? null);

function advance()
{
    if (!following.value) return;
    marines.prefs = { ...marines.prefs, mission: following.value.id };
    start();
}

/** Leaving or pausing keeps the game, unless it is over or never began. */
function suspend()
{
    if (screen.value === 'title') return;
    marines.suspended = state.value.phase === 'playing' ? snapshot(state.value) : null;
}

function pause()
{
    releaseAll();
    if (screen.value === 'playing' && state.value.phase === 'playing') screen.value = 'paused';
    suspend();
}

/** The key that sets a turret down, or works the blowtorch on the door in front. */
function deploy()
{
    perform(weldAim(state.value) ? 'weld' : 'turret');
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
    r: 'reload', q: 'switch', g: 'grenade', e: 'order', t: 'turret', f: 'weld',
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

function toggleFire()
{
    marines.prefs = { ...marines.prefs, fire: marines.prefs.fire === 'auto' ? 'manual' : 'auto' };
}

function toggleLefty()
{
    marines.prefs = { ...marines.prefs, lefty: !marines.prefs.lefty };
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

const weld = computed(() => weldAim(state.value)?.action ?? null);
// read on every frame (`clock` changes), so the pad can show when the weapon is on a target
const sights = computed(() => (clock.value, inSights(state.value)));
const kindLines = computed(() => report.value
    ? (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).filter(k => report.value!.data.killsBy[k] > 0).map(k => `${ENEMIES[k].name} ×${report.value!.data.killsBy[k]}`)
    : []);
const BEATEN: Record<Beaten, string> = { wave: 'OLEADA', score: 'PUNTOS', kills: 'BAJAS', timeMs: 'TIEMPO' };
const record = computed(() => marines.recordOf(arena.value.id));

const dead = computed(() => state.value.phase === 'dead' && clock.value - deadAt > DEAD_MS);
const won = computed(() => state.value.phase === 'won' && clock.value - deadAt > DEAD_MS);
const wonMission = computed(() => (state.value.mission ? missionById(state.value.mission) : undefined));

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
    <div class="marines">
        <div class="head">
            <span class="title">MARINES · {{ state.mission ? (wonMission?.title ?? 'MISIÓN') : 'OLEADA ' + state.wave.n }}</span>
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
                <div v-for="l in (campaignMode ? mission.briefing : arena.briefing)" :key="l">» {{ l }}</div>
            </div>
            <div v-if="campaignMode" class="dim">MISIÓN {{ open.indexOf(mission) + 1 }}/{{ MISSIONS.length }} · {{ mission.title }}{{ marines.campaign[mission.id] ? ' · CUMPLIDA' : '' }}</div>
            <div class="dim help">
                ARRASTRE SOBRE LA VISTA PARA GIRAR<br />
                JOYSTICK PARA MOVERSE<br />
                EL ARMA DISPARA SOLA AL APUNTAR<br />
                (PAUSA: DISPARO MANUAL)<br />
                GRANADA: LANZAGRANADAS DEL RIFLE<br />
                TORRETA: CENTINELA · SOLDAR: SELLA PUERTAS<br />
                ARMA: CAMBIA · SEGUIR / QUIETOS: ESCUADRA<br />
                CUIDADO CON LA SANGRE ÁCIDA
            </div>
            <div v-if="!campaignMode && record.runs" class="dim">
                RÉCORD · OLEADA {{ record.wave }} · {{ record.score }} PTS · {{ record.kills }} BAJAS · {{ record.runs }} PARTIDAS
            </div>
            <div class="dim">LOGROS {{ Object.keys(marines.achievements).length }}/{{ ACHIEVEMENTS.length }}<template v-if="marines.stats.runs"> · {{ marines.stats.kills }} BAJAS EN {{ marines.stats.runs }} PARTIDAS · {{ formatDuration(marines.stats.timeMs) }}</template></div>
            <div class="actions">
                <button class="act pressable" @click="toggleMode">[{{ campaignMode ? 'CAMPAÑA' : 'OLEADAS' }}]</button>
                <button v-if="!campaignMode" class="act pressable" @click="nextArena">[MAPA: {{ arena.title }}]</button>
                <button v-else-if="open.length > 1" class="act pressable" @click="nextMission">[MISIÓN]</button>
                <button class="act pressable" @click="nextDifficulty">[{{ DIFFICULTY[marines.prefs.difficulty].name }}]</button>
            </div>
            <div class="actions">
                <button v-if="marines.suspended" class="act pressable" @click="resume">[CONTINUAR]</button>
                <button class="act pressable" @click="start">[{{ marines.suspended ? 'NUEVA' : 'INICIAR' }}]</button>
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
                <button class="act pressable" @click="toggleFire">[DISPARO: {{ marines.prefs.fire === 'auto' ? 'AUTO' : 'MANUAL' }}]</button>
                <button class="act pressable" @click="toggleLefty">[{{ marines.prefs.lefty ? 'ZURDO' : 'DIESTRO' }}]</button>
            </div>
            <div class="actions">
                <button class="act pressable" @click="start">[REINICIAR]</button>
                <button class="act pressable" @click="marines.close()">[SALIR]</button>
            </div>
        </div>

        <div v-else-if="won" class="panel">
            <div class="big">MISIÓN CUMPLIDA</div>
            <div class="dim">{{ wonMission?.title }} · {{ DIFFICULTY[marines.prefs.difficulty].name }} · T+{{ formatDuration(state.timeMs).slice(3) }}</div>
            <div class="brief">
                <div v-for="l in wonMission?.debrief" :key="l">» {{ l }}</div>
            </div>
            <div v-if="report" class="dim">{{ state.kills }} BAJAS · PRECISIÓN {{ Math.round(report.data.accuracy * 100) }} % · TORRETAS {{ report.data.built.turrets }} · SOLDADURAS {{ report.data.built.welds }}</div>
            <div v-for="id in fresh" :key="id" class="new">LOGRO: {{ achievementById(id)?.name }}</div>
            <div v-if="!following" class="new">FIN DE LA CAMPAÑA</div>
            <div class="actions">
                <button v-if="following" class="act pressable" @click="advance">[SIGUIENTE: {{ following.title }}]</button>
                <button class="act pressable" @click="start">[REPETIR]</button>
                <button class="act pressable" @click="marines.close()">[SALIR]</button>
            </div>
        </div>

        <div v-else-if="dead" class="panel">
            <div class="big">BAJA CONFIRMADA</div>
            <div class="dim">{{ arena.title }} · OLEADA {{ state.wave.n }} · {{ state.score }} PTS · {{ state.kills }} BAJAS</div>
            <div v-if="report" class="dim">
                PRECISIÓN {{ Math.round(report.data.accuracy * 100) }} % · T+{{ formatDuration(report.data.timeMs).slice(3) }}
            </div>
            <div v-if="kindLines.length" class="dim">{{ kindLines.join(' · ') }}</div>
            <div v-if="report" class="dim">TORRETAS {{ report.data.built.turrets }} · SOLDADURAS {{ report.data.built.welds }}</div>
            <div v-for="id in fresh" :key="id" class="new">LOGRO: {{ achievementById(id)?.name }}</div>
            <div v-if="report?.beaten.length" class="new">NUEVO RÉCORD: {{ report.beaten.map(k => BEATEN[k]).join(' · ') }}</div>
            <div v-if="record.runs" class="dim">
                RÉCORD · OLEADA {{ record.wave }} · {{ record.score }} PTS
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
            :reloading="state.player.reloadMs > 0" :grenades="state.player.grenades" :weapons="owned(state.player).length" :order="state.order" :turrets="state.player.turrets" :weld="weld" :auto="marines.prefs.fire === 'auto'" :sights="sights" :lefty="marines.prefs.lefty"
            @move="onMove" @fire="onFire" @aim="onFireAim" @reload="perform('reload')" @switch="perform('switch')" @grenade="perform('grenade')" @order="perform('order')" @deploy="deploy" />
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
.new { @include inverse; padding: 0 6px; }

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
