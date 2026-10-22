<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ShipControls from './ShipControls.vue';
import ShipHud from './ShipHud.vue';
import ShipMinimap from './ShipMinimap.vue';
import { useShipInput } from '@/composables/useShipInput';
import { prefersReducedMotion } from '@/composables/useReducedMotion';
import { aimPixels } from '@/games/marines/aim';
import { useAppsStore } from '@/stores/useAppsStore';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useContactsStore } from '@/stores/useContactsStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useEffectiveSettings } from '@/stores/useEffectiveSettings';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShipStore } from '@/stores/useShipStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { ATLAS_H, ATLAS_W, drawAtlas, drawLabels } from '@/ship3d/atlas';
import { bloomGain } from '@/ship3d/bloom';
import { createShipGL, type ShipGL } from '@/ship3d/gl';
import { nearestLights, packLights } from '@/ship3d/lights';
import { buildMesh } from '@/ship3d/mesh';
import { roomLevel, roomReadings, type Level } from '@/ship3d/readings';
import { eyeHeight, stepWalk, walker, type Walker } from '@/ship3d/walk';
import { agentsOf, BUNK_SLOTS, newRoamers, SIGNAL_SLOTS, stationaryAgents, stepRoamer, type Agent } from '@/ship3d/crew';
import { shutDoors, stepDoors } from '@/ship3d/doors';
import { figureVertices, plateVertices, shuttleVertices, type CrewLook } from '@/ship3d/figures';
import { headTurn } from '@/ship3d/pose';
import { hudLine, nextAlertRoom, turnToward } from '@/ship3d/hud';
import { CONTACT_PLATES, plateTexts, SIGNAL_PLATES } from '@/ship3d/labels';
import { glideRoute, GLIDE_SPEED, pointAt, routeLength } from '@/ship3d/glide';
import { pickAgent, pickScreen, pickShuttle, REACH } from '@/ship3d/pick';
import { wrapAngle } from '@/ship3d/math';
import { bounds, collisionSegments, hangarBays, LIGHTS, PROPS, roomAt, ROOMS, type V2 } from '@/ship3d/world';
import { appLabelFor } from '@/utils/notifications';
import { HEAVY_CONTACT, radarContacts } from '@/utils/radar';
import { bendK, correctPoint } from '@/utils/curvature';
import { parseColor, type Rgb } from '@/utils/crtFilter';

const settings = useSettingsStore();
const effective = useEffectiveSettings();
const ship = useShipStore();
const sound = useSoundStore();
const bridgeEvents = useBridgeEventStore();
const appsStore = useAppsStore();
const notifications = useNotificationsStore();
const contacts = useContactsStore();
const launcher = useLaunchStore();
const input = useShipInput();
const readings = computed(() => roomReadings(input.value));
const reducedMotion = prefersReducedMotion();

const canvas = ref<HTMLCanvasElement | null>(null);
const unsupported = ref(false);
/** the walk is frozen by the user: nothing moves and nothing is drawn until it is resumed */
const paused = ref(false);
/** a line at the bottom for a moment (`ACÉRCATE...`) */
const hint = ref('');
let hintTimer = 0;
/** a card or a crew member's signals cover the view: nothing is drawn and taps go to them */
const covered = computed(() => ship.card !== null || ship.signals !== null);

/** Radians of turn and tilt per pixel of drag. */
const TURN_PER_PX = 0.0045;
const TILT_PER_PX = 0.0035;
/** Never draw more device pixels than this per CSS pixel: the phone's GPU has better things to do. */
const MAX_SCALE = 1.5;
const BLINK_MS = 500;
const POSE_SYNC_MS = 120;

let gl: ShipGL | null = null;
let raf = 0;
let last = 0;
let lastSync = 0;
let backgrounded = false;
// ---- what the crew and the shuttles stand for: the apps with signals, the starred contacts, the favourite apps
const labelOf = (pkg: string) => appLabelFor(pkg, appsStore.apps);
const signalApps = computed(() => radarContacts(notifications.visible, SIGNAL_SLOTS.length));
const starred = computed(() => contacts.starred.slice(0, BUNK_SLOTS.length));
const bays = computed(() => hangarBays(settings.favorites.length));
const plates = computed(() => plateTexts({
    signals: signalApps.value.map(c => ({ label: labelOf(c.packageName), count: c.notifications.length })),
    contacts: starred.value.map(c => c.name),
    shuttles: settings.favorites.slice(0, bays.value.length).map(labelOf),
}));
const shuttles = computed(() => shuttleVertices(bays.value));
// the shuttles are walked round like any crate
const segs = computed(() => collisionSegments(ROOMS, [...PROPS, ...bays.value.map(b => b.prop)]));
// ---- life aboard: the doors, the crew that stays and the two that wander
let doors = shutDoors();
let lastStep = 0;
let roamers = newRoamers();
let agents: Agent[] = [];
/** where each standing crew member's head is turned now */
const heads = new Map<string, number>();
/** radians per second a head turns */
const HEAD_SPEED = 2.5;
const stay = computed(() => stationaryAgents(signalApps.value.length, starred.value.length));
const lightZone = LIGHTS.map(l => roomAt(l.x, l.y)?.zone);
const levels = computed(() => Object.fromEntries(ROOMS.map(r => [r.zone, roomLevel(readings.value, r.zone)])) as Record<string, Level>);
const hull = bounds();
/** seconds for the scan band to cross the ship */
const SWEEP_S = 16;

let body: Walker = walker(ship.pose.x, ship.pose.y, ship.pose.yaw, ship.pose.pitch);

// what the hands ask for
let strafe = 0;
let forward = 0;
let turnAcc = 0;
let tiltAcc = 0;

/** the camera is being taken somewhere by the minimap: where along its route, and which one */
let glide: { route: V2[]; length: number; s: number } | null = null;

function onMove(s: number, f: number)
{
    strafe = s;
    forward = f;
    // the stick takes the camera back
    if (glide && (s !== 0 || f !== 0)) glide = null;
}
function onLook(dx: number, dy: number)
{
    if (paused.value) return;
    turnAcc += aimPixels(dx) * TURN_PER_PX;
    tiltAcc -= dy * TILT_PER_PX;
}

// ---- the monitors' picture and the phosphor colours
const atlas = document.createElement('canvas');
atlas.width = ATLAS_W;
atlas.height = ATLAS_H;
let atlasDirty = true;
let blinkShown = true;
const hasUrgent = computed(() => Object.values(readings.value).some(r => r.level === 'urgent'));

const toGl = (c: Rgb | null, fallback: Rgb): Rgb => (c ?? fallback).map(v => v / 255) as Rgb;

function palette()
{
    const el = canvas.value;
    if (!el || !gl) return { ph: '#ffb000', bg: '#060400', font: 'monospace' };
    const css = getComputedStyle(el);
    const ph = css.getPropertyValue('--ph').trim() || '#ffb000';
    const bg = css.getPropertyValue('--ph-bg').trim() || '#060400';
    gl.setPalette({ ph: toGl(parseColor(ph), [255, 176, 0]), bg: toGl(parseColor(bg), [6, 4, 0]) });
    return { ph, bg, font: css.fontFamily || 'monospace' };
}

function paintAtlas(blink: boolean)
{
    const ctx = atlas.getContext('2d');
    if (!ctx || !gl) return;
    const { ph, bg, font } = palette();
    drawAtlas(ctx, Object.values(readings.value), ph, bg, font, blink);
    drawLabels(ctx, plates.value, ph, font);
    gl.setAtlas(atlas);
    atlasDirty = false;
}

watch([readings, plates], () => { atlasDirty = true; });
// the palette changes in the DOM after this runs, so wait a tick
watch(() => effective.phosphor, async () => { await nextTick(); atlasDirty = true; });

function frame(now: number)
{
    raf = requestAnimationFrame(frame);
    if (backgrounded || paused.value || covered.value || !gl || gl.lost) return;

    const speed = Math.hypot(body.vx, body.vy);
    const active = strafe !== 0 || forward !== 0 || turnAcc !== 0 || tiltAcc !== 0 || speed > 0.01 || glide !== null;
    const wait = settings.shipFps === '30' ? 1000 / 30 - 2 : settings.shipFps === '60' || active ? 1000 / 60 - 2 : 100;
    if (now - last < wait) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (glide)
    {
        // the minimap carries the camera along its route, easing to the way it heads; a look drag still turns it
        glide.s += GLIDE_SPEED * dt;
        const at = pointAt(glide.route, glide.s);
        const yaw = turnAcc !== 0 ? wrapAngle(body.yaw + turnAcc) : wrapAngle(body.yaw + wrapAngle(at.yaw - body.yaw) * (1 - Math.exp(-8 * dt)));
        body = { ...body, x: at.x, y: at.y, yaw, pitch: Math.max(-0.5, Math.min(0.5, body.pitch + tiltAcc)), vx: 0, vy: 0 };
        if (glide.s >= glide.length) glide = null;
    }
    else body = stepWalk(body, { strafe, forward, turn: turnAcc, tilt: tiltAcc }, dt, segs.value);
    turnAcc = 0;
    tiltAcc = 0;
    if (now - lastSync > POSE_SYNC_MS)
    {
        ship.pose = { x: body.x, y: body.y, yaw: body.yaw, pitch: body.pitch };
        lastSync = now;
    }

    // sound, only if the user turned it on: a step per bounce of the walk, a hiss as a door starts to slide
    const stepNo = Math.floor(body.bob);
    if (stepNo !== lastStep)
    {
        lastStep = stepNo;
        if (Math.hypot(body.vx, body.vy) > 0.8) sound.play('step');
    }
    const before = doors;
    doors = stepDoors(doors, body.x, body.y, dt);
    if (doors.some((v, i) => v > 0.02 && before[i] <= 0.02)) sound.play('door');
    // Jones and the android wander; with reduced motion they keep still
    if (!reducedMotion) roamers = roamers.map(r => stepRoamer(r, dt, Math.random));
    agents = agentsOf(stay.value, roamers);
    const blink = reducedMotion || Math.floor(now / BLINK_MS) % 2 === 0;
    gl.setCrew(joined(
        figureVertices(agents, reducedMotion ? 0 : now / 1000, new Set(roamers.filter(r => r.route).map(r => r.id)), crewLook(dt)),
        plateVertices(agents, body.yaw),
        shuttles.value,
    ));

    if (atlasDirty || (hasUrgent.value && blink !== blinkShown)) paintAtlas(blink);
    blinkShown = blink;

    gl.resize(Math.min(window.devicePixelRatio || 1, MAX_SCALE));
    gl.setBloom(settings.shipBloom ? bloomGain(effective.bloom) : 0);
    gl.render({
        eye: [body.x, eyeHeight(body, reducedMotion), body.y],
        yaw: body.yaw,
        pitch: body.pitch,
        // a room that wants attention is lit brighter, and an urgent one blinks
        lights: packLights(LIGHTS, nearestLights(LIGHTS, body.x, body.y, 1.6), i =>
        {
            const level = levels.value[lightZone[i] ?? ''];
            return level === 'urgent' ? (blink ? 2 : 0.35) : level === 'notice' ? 1.6 : 1;
        }),
        time: now / 1000,
        doors,
        blink,
        holo: reducedMotion ? 0 : 0.6,
        sweep: reducedMotion ? -1000 : hull.y0 - 3 + (((now / 1000) % SWEEP_S) / SWEEP_S) * (hull.y1 - hull.y0 + 6),
    });
}

/** The ones standing near turn their heads to the camera; the crew of a busy app blinks. */
function crewLook(dt: number): CrewLook
{
    // heads turn at a steady rate, like a servo, not in a snap
    for (const a of stay.value)
    {
        const want = headTurn(a.x, a.y, a.yaw, body.x, body.y);
        const now = heads.get(a.id) ?? 0;
        const step = reducedMotion ? Infinity : HEAD_SPEED * dt;
        heads.set(a.id, now + Math.max(-step, Math.min(step, want - now)));
    }
    const alert = new Set<string>();
    for (const a of stay.value)
            if (a.kind === 'signal' && (signalApps.value[(a.plate ?? 0) - SIGNAL_PLATES]?.notifications.length ?? 0) >= HEAVY_CONTACT) alert.add(a.id);
    return { headYaw: heads, alert };
}

/** The dynamic triangles of a frame in one buffer. */
function joined(...parts: Float32Array[]): Float32Array
{
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
}

function say(text: string)
{
    hint.value = text;
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hint.value = ''; }, 1800);
}

/** A short touch: the monitor under the finger opens its room's card if it is close enough. */
function onTap(clientX: number, clientY: number)
{
    const el = canvas.value;
    if (!el || paused.value || covered.value) return;
    // the curved glass moves what is painted but not the touch, so the point is corrected by hand
    const tube = settings.curvature ? el.closest('.tube') : null;
    const k = bendK(settings.curvatureBend);
    const p = tube && k > 0 ? correctPoint(clientX, clientY, tube.getBoundingClientRect(), k) : { x: clientX, y: clientY };
    const box = el.getBoundingClientRect();
    const eye: [number, number, number] = [body.x, eyeHeight(body, true), body.y];
    const [x, y] = [p.x - box.left, p.y - box.top];
    const person = pickAgent(agents, eye, body.yaw, body.pitch, box.width, box.height, x, y);
    const screen = pickScreen(eye, body.yaw, body.pitch, box.width, box.height, x, y);
    const shuttle = pickShuttle(bays.value, eye, body.yaw, body.pitch, box.width, box.height, x, y);
    // whichever is in front
    const near = Math.min(person?.distance ?? Infinity, screen?.distance ?? Infinity, shuttle?.distance ?? Infinity);
    if (near === Infinity) return;
    if (near > REACH) { say(shuttle?.distance === near ? 'ACÉRCATE A LA LANZADERA' : screen?.distance === near ? 'ACÉRCATE AL MONITOR' : 'ACÉRCATE'); return; }

    if (shuttle?.distance === near)
    {
        const pkg = settings.favorites[shuttle.index];
        if (pkg) launcher.launch(pkg, labelOf(pkg));
        return;
    }
    if (person?.distance === near)
    {
        const { kind, plate } = person.agent;
        if (kind === 'signal')
        {
            const app = signalApps.value[(plate ?? SIGNAL_PLATES) - SIGNAL_PLATES];
            if (app) ship.openSignals(app.packageName); else ship.openCard('comms');
        }
        else if (kind === 'contact')
        {
            // the contact's card in the phone's contacts: never a call straight away
            const c = starred.value[(plate ?? CONTACT_PLATES) - CONTACT_PLATES];
            if (c) contacts.openContact(c); else ship.openCard('comedor');
        }
        else if (kind === 'cat') say('JONES: MIAU');
        else say(`ASH: ${readings.value['enfermeria.sistema']?.lines.join(' ') ?? 'NOMINAL'}`);
        return;
    }
    const zone = screen!.screen.zone;
    if (zone !== 'hub') ship.openCard(zone);
    else if (screen!.screen.id === 'hub.buscar') ship.askSearch();
    else settings.activeTab = 'mother';
}

// ---- the strip at the top: the room you are in and the one that wants you
const here = computed(() => roomAt(ship.pose.x, ship.pose.y)?.zone);
const hud = computed(() => hudLine(readings.value, here.value));
const alert = computed(() => nextAlertRoom(levels.value, here.value));
const alertTurn = computed(() => alert.value ? turnToward(ship.pose.x, ship.pose.y, ship.pose.yaw, alert.value.zone) : 'ahead');

function onGo(room: string)
{
    if (paused.value || covered.value) return;
    const route = glideRoute(body.x, body.y, room);
    if (!route || route.length < 2) return;
    if (prefersReducedMotion())
    {
        const end = route[route.length - 1];
        body = { ...body, x: end[0], y: end[1], vx: 0, vy: 0 };
        glide = null;
        return;
    }
    glide = { route, length: routeLength(route), s: 0 };
}

function setPaused(on: boolean)
{
    paused.value = on;
    if (on)
    {
        glide = null;
        strafe = 0;
        forward = 0;
        turnAcc = 0;
        tiltAcc = 0;
        body = { ...body, vx: 0, vy: 0 };
        ship.pose = { x: body.x, y: body.y, yaw: body.yaw, pitch: body.pitch };
    }
    else last = performance.now();
}

// Home puts the camera back on the bridge
watch(() => ship.epoch, () =>
{
    body = walker(ship.pose.x, ship.pose.y, ship.pose.yaw, ship.pose.pitch);
    strafe = 0;
    forward = 0;
    paused.value = false;
    glide = null;
});

// the card has the screen: nothing is drawn behind it, and the clock restarts when it closes
watch(covered, on => { if (!on) last = performance.now(); });

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause')
    {
        backgrounded = true;
        ship.pose = { x: body.x, y: body.y, yaw: body.yaw, pitch: body.pitch };
    }
    else if (ev.name === 'afterResume')
    {
        backgrounded = false;
        last = performance.now();
        atlasDirty = true;
    }
}

onMounted(() =>
{
    const el = canvas.value;
    gl = el ? createShipGL(el, buildMesh()) : null;
    if (!gl) { unsupported.value = true; return; }
    palette();
    paintAtlas(true);
    // the monitors' font may still be loading
    document.fonts?.ready.then(() => { atlasDirty = true; });
    raf = requestAnimationFrame(frame);
    bridgeEvents.addEventListener(onBridgeEvent);
});

onBeforeUnmount(() =>
{
    cancelAnimationFrame(raf);
    bridgeEvents.removeEventListener(onBridgeEvent);
    ship.pose = { x: body.x, y: body.y, yaw: body.yaw, pitch: body.pitch };
    clearTimeout(hintTimer);
    gl?.dispose();
    gl = null;
});
</script>

<template>
    <div class="ship-panel" data-no-swipe>
        <canvas ref="canvas" class="view" />
        <ShipControls v-if="!unsupported" @move="onMove" @look="onLook" @tap="onTap" />
        <ShipMinimap v-if="!unsupported" :pose="ship.pose" :readings="readings" @go="onGo" />
        <ShipHud v-if="!unsupported && !paused" :line="hud" :alert="alert" :turn="alertTurn" :here="here" @go="onGo" />
        <div v-if="hint" class="hint">{{ hint }}</div>
        <button v-if="!unsupported && !paused" class="pause pressable" @click="setPaused(true)" @touchstart.stop @mousedown.stop>[II]</button>
        <div v-if="paused" class="paused" data-no-swipe>
            <span class="title">PAUSA</span>
            <button class="resume pressable" @click="setPaused(false)">[CONTINUAR]</button>
        </div>
        <div v-if="unsupported" class="nogl">SIN ACELERACIÓN GRÁFICA<br>USA LA REJILLA EN AJUSTES</div>
    </div>
</template>

<style scoped lang="scss">
.ship-panel {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
    border: 1px solid var(--ph-dim);
    margin: 4px 8px;
    background: var(--ph-bg);
}

.view {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
}

.hint {
    position: absolute;
    left: 50%;
    bottom: 34px;
    transform: translateX(-50%);
    padding: 2px 12px;
    white-space: nowrap;
    pointer-events: none;
    @include inverse;
}

.pause {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 2px 8px;
    background: var(--ph-bg);
    border: 1px solid var(--ph);
    color: var(--ph);
    font: inherit;
    @include glow;

    &:active { @include inverse; }
}

.paused {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;

    .title {
        padding: 2px 16px;
        @include inverse;
    }

    .resume {
        padding: 6px 18px;
        background: var(--ph-bg);
        border: 1px solid var(--ph);
        color: var(--ph);
        font: inherit;
        @include glow;

        &:active { @include inverse; }
    }
}

.nogl {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--ph-dim);
}
</style>
