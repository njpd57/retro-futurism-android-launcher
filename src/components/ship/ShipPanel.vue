<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ShipControls from './ShipControls.vue';
import ShipHud from './ShipHud.vue';
import ShipMinimap from './ShipMinimap.vue';
import ShipMonitor from './ShipMonitor.vue';
import { useShipInput } from '@/composables/useShipInput';
import { useShipControls } from '@/composables/useShipControls';
import { prefersReducedMotion } from '@/composables/useReducedMotion';
import { aimPixels } from '@/games/marines/aim';
import { useAppsStore } from '@/stores/useAppsStore';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useContactsStore } from '@/stores/useContactsStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { useEffectiveSettings } from '@/stores/useEffectiveSettings';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShipClockStore } from '@/stores/useShipClockStore';
import { useShipStore } from '@/stores/useShipStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { useSpeechStore } from '@/stores/useSpeechStore';
import { useQuickSettingsStore } from '@/stores/useQuickSettingsStore';
import { ATLAS_H, ATLAS_W, drawAtlas, drawLabels } from '@/ship3d/atlas';
import { bloomGain } from '@/ship3d/bloom';
import { MAX_STYLES, STYLE } from '@/ship3d/materials';
import { createShipGL, type ShipGL } from '@/ship3d/gl';
import { loadMaterialTextures } from '@/ship3d/details';
import { nearestLights, packLights } from '@/ship3d/lights';
import { buildMesh } from '@/ship3d/mesh';
import { roomLevel, roomReadings, type Level } from '@/ship3d/readings';
import { eyeHeight, stepWalk, walker, type Walker } from '@/ship3d/walk';
import { agentsOf, CONTACT_SEATS, newRoamers, SIGNAL_SLOTS, stationaryAgents, stepRoamer, type Agent } from '@/ship3d/crew';
import { stepKind } from '@/ship3d/acoustics';
import { frameWait, lookScale, lowPower, renderScale } from '@/ship3d/power';
import { shutDoors, stepDoors } from '@/ship3d/doors';
import { birdVertices, figureVertices, plateVertices, shuttleVertices, type CrewLook } from '@/ship3d/figures';
import { headTurn } from '@/ship3d/pose';
import { hudLine, nextAlertRoom, turnToward } from '@/ship3d/hud';
import { CONTACT_PLATES, plateTexts, SIGNAL_PLATES, withControls, withSigns, withStencils } from '@/ship3d/labels';
import { controlVertices, dragValue, PRESS_S, quietVertices, stepShown, tapValue, type ControlLock } from '@/ship3d/controls';
import { LOCK_TEXT, voiceLine } from '@/ship3d/actions';
import { dinerLine, dinersAt } from '@/ship3d/mess';
import { glideRoute, GLIDE_SPEED, pointAt, routeLength } from '@/ship3d/glide';
import { pickAgent, pickControl, pickScreen, pickShuttle, pickStation, REACH, type ControlPick } from '@/ship3d/pick';
import { wrapAngle } from '@/ship3d/math';
import { fovYFor } from '@/ship3d/math';
import { clampLook, focusShot, glassCorners, SHOT_SECONDS, stationShot, tweenShot, type Shot } from '@/ship3d/camera';
import { bounds, type Light, collisionSegments, CONTROLS, hangarBays, LIGHTS, PORTALS, PROPS, roomAt, ROOMS, screenById, stationById, type ScreenDef, type V2 } from '@/ship3d/world';
import { appLabelFor } from '@/utils/notifications';
import { HEAVY_CONTACT, radarContacts } from '@/utils/radar';
import { bendK, correctPoint } from '@/utils/curvature';
import { parseColor, type Rgb } from '@/utils/crtFilter';
import { quadTransform } from '@/utils/quadTransform';
import { tick } from '@/utils/haptics';
import type { ControlData, StationData } from '@/ship3d/shipData';

const settings = useSettingsStore();
const effective = useEffectiveSettings();
const ship = useShipStore();
const sound = useSoundStore();
const bridgeEvents = useBridgeEventStore();
const appsStore = useAppsStore();
const notifications = useNotificationsStore();
const contacts = useContactsStore();
const launcher = useLaunchStore();
const system = useSystemStatusStore();
const clock = useShipClockStore();
const speech = useSpeechStore();
const shipControls = useShipControls();
const quick = useQuickSettingsStore();
/** the battery is low and not charging: 30 frames a second, a smaller picture and no bloom */
const saving = computed(() => lowPower(system.battery));
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
/** a crew member's signals cover the view: nothing is drawn and taps go to them */
const covered = computed(() => ship.signals !== null);
/** a monitor is in focus (or the camera is on its way to it): the walk's controls step aside */
const focused = computed(() => ship.focus !== null);
/** sitting at a station (the captain's seat, a capsule): no walking, the look turns within its arc */
const seated = computed(() => ship.seat !== null);

/** Radians of turn and tilt per pixel of drag. */
const TURN_PER_PX = 0.0045;
const TILT_PER_PX = 0.0035;
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
const starred = computed(() => contacts.starred.slice(0, CONTACT_SEATS));
const bays = computed(() => hangarBays(settings.favorites.length));
const plates = computed(() =>
{
    const texts = plateTexts({
        signals: settings.shipLabels ? signalApps.value.map(c => ({ label: labelOf(c.packageName), count: c.notifications.length })) : [],
        contacts: settings.shipLabels ? starred.value.map(c => c.name) : [],
        shuttles: settings.favorites.slice(0, bays.value.length).map(labelOf),
    });
    return withControls(withSigns(settings.shipLabels ? withStencils(texts) : texts), shipControls.labels.value);
});
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
// the crew at the mess table: most of them at mealtimes
const stay = computed(() => stationaryAgents(signalApps.value.length, starred.value.length, dinersAt(clock.now)));
/** how many times the table has been talked to, so a diner doesn't repeat itself */
let chats = 0;
const lightZone = LIGHTS.map(l => roomAt(l.x, l.y)?.zone);
// ---- the ship answers to the phone: the flashlight is a floodlight over the bridge, the lamps dim with the screen's
// brightness, and silence (or vibration) lights the amber cell of every door's status box
const FLOOD: Light = { x: 0, y: -18.8, z: 3.4, power: 3 };
const LIGHTS_FLOOD = [...LIGHTS, FLOOD];
const floodZone = [...lightZone, 'puente'];
const dim = computed(() => (quick.brightness && !quick.brightness.isAuto ? 0.35 + 0.65 * quick.brightness.level : 1));
const quiet = computed(() => quick.ringer === 'silent' || quick.ringer === 'vibrate');
/** the lit amber cells, built once the mesh has recorded where they are */
let quietMesh = new Float32Array(0);
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

// ---- the panels' controls: where each moving part is drawn, what was just asked of the phone, the buttons held in
const shown = new Map<string, number>();
/** a value set from the ship, shown until the phone answers with it (or gives up after `PENDING_MS`) */
const pending = new Map<string, { value: number; until: number }>();
const PENDING_MS = 1500;
/** seconds left of each button's push */
const pushed = new Map<string, number>();
/** a lever under a finger: its value as dragged and how many metres of its slot a pixel is */
let grabbed: { control: ControlData; value: number; start: number; perPx: number } | null = null;
/** a locked control was touched: the strip says why and offers to grant it */
const denied = ref<ControlLock | null>(null);
let deniedTimer = 0;

/** Where each control's moving part should be now: the finger's, what was just asked, or what the phone says. */
function controlTargets(now: number): Map<string, number>
{
    const states = shipControls.states.value;
    const out = new Map<string, number>();
    for (const c of CONTROLS)
    {
        const real = states[c.id]?.value ?? null;
        const ask = pending.get(c.id);
        if (ask && (now > ask.until || (real !== null && Math.abs(real - ask.value) < 0.02))) pending.delete(c.id);
        out.set(c.id, grabbed?.control.id === c.id ? grabbed.value : pending.get(c.id)?.value ?? real ?? 0);
    }
    return out;
}

// ---- the camera away from the walk: up to a monitor, held there, and back
/** where the camera is while it is not the walker's eye; null = walking */
let cam: Shot | null = null;
/** a move of the camera in progress, `t` from 0 to 1; `back` ends it in the walk */
let move: { from: Shot; to: Shot; t: number; back: boolean } | null = null;
/** the monitor in focus: its glass as a box of CSS pixels and the map that lays the box on the canvas */
const monitor = ref<{ screen: ScreenDef; width: number; height: number; transform: string | null } | null>(null);
/** the canvas size the focus was framed for, to frame it again if the view changes (the keyboard, a rotation) */
let framedFor = { w: 0, h: 0 };

const walkShot = (still: boolean): Shot => ({ x: body.x, y: body.y, z: eyeHeight(body, still), yaw: body.yaw, pitch: body.pitch });

/** Frames the monitor for the canvas as it is now: where the camera ends up and how big the glass is there. */
function frameFocus(screen: ScreenDef): Shot | null
{
    const box = canvas.value?.getBoundingClientRect();
    if (!box || box.width < 1 || box.height < 1) return null;
    const to = focusShot(screen, box.width / box.height);
    const c = glassCorners(screen, to, box.width, box.height);
    if (!c) return null;
    framedFor = { w: box.width, h: box.height };
    monitor.value = { screen, width: Math.round(c[1][0] - c[0][0]), height: Math.round(c[3][1] - c[0][1]), transform: monitor.value?.screen.id === screen.id ? monitor.value.transform : null };
    return to;
}

/** Lays the monitor's HTML where its glass is seen from `shot`. */
function placeMonitor(shot: Shot)
{
    const m = monitor.value;
    const box = canvas.value?.getBoundingClientRect();
    if (!m || !box) return;
    const c = glassCorners(m.screen, shot, box.width, box.height);
    const t = c ? quadTransform(m.width, m.height, c) : null;
    if (t !== m.transform) m.transform = t;
}

// ---- stations: the station sat at, and where the eye looks from it
let station: StationData | null = null;
let seatLook = { yaw: 0, pitch: 0 };

const seatShot = (): Shot | null => (station ? stationShot(station, seatLook.yaw, seatLook.pitch) : null);

watch(() => ship.seat, id =>
{
    const st = id ? stationById(id) : undefined;
    if (st)
    {
        station = st;
        seatLook = { yaw: st.yaw, pitch: st.pitch ?? 0 };
        glide = null;
        strafe = 0;
        forward = 0;
        sound.play('shipSwitch');
        move = { from: cam ?? walkShot(true), to: seatShot()!, t: reducedMotion ? 1 : 0, back: false };
        // a capsule puts the phone to sleep with its crew
        if (st.lying) say(shipControls.sleep());
    }
    else
    {
        if (station?.lying) say(shipControls.wake());
        station = null;
        if (cam && !ship.focus) move = { from: cam, to: walkShot(true), t: reducedMotion ? 1 : 0, back: true };
    }
    last = performance.now();
});

watch(() => ship.focus, id =>
{
    const screen = id ? screenById(id) : undefined;
    atlasDirty = true;
    if (screen)
    {
        const to = frameFocus(screen);
        if (!to) { ship.leaveFocus(); return; }
        glide = null;
        strafe = 0;
        forward = 0;
        move = { from: cam ?? walkShot(true), to, t: reducedMotion ? 1 : 0, back: false };
    }
    else
    {
        monitor.value = null;
        // back to the seat if the monitor was used sitting, otherwise back to the walk
        const seat = seatShot();
        if (cam) move = seat ? { from: cam, to: seat, t: reducedMotion ? 1 : 0, back: false } : { from: cam, to: walkShot(true), t: reducedMotion ? 1 : 0, back: true };
    }
    last = performance.now();
});

/** Steps the camera's move, or keeps the focus framed if the view changed size. */
function stepCamera(dt: number)
{
    if (move)
    {
        move.t = Math.min(1, move.t + dt / SHOT_SECONDS);
        cam = tweenShot(move.from, move.to, move.t);
        if (move.t >= 1)
        {
            cam = move.back ? null : move.to;
            move = null;
        }
    }
    else if (station && !ship.focus)
    {
        // seated: the look drag turns the head within the station's arc
        seatLook = clampLook(station, seatLook.yaw + turnAcc, seatLook.pitch + tiltAcc);
        cam = seatShot();
    }
    else if (cam && monitor.value)
    {
        const box = canvas.value?.getBoundingClientRect();
        if (box && (Math.abs(box.width - framedFor.w) > 1 || Math.abs(box.height - framedFor.h) > 1))
            cam = frameFocus(monitor.value.screen) ?? cam;
    }
    if (cam) placeMonitor(cam);
}

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
    const k = lookScale(settings.shipLook);
    turnAcc += aimPixels(dx) * TURN_PER_PX * k;
    tiltAcc -= dy * TILT_PER_PX * k * (settings.shipInvertY ? -1 : 1);
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
    // the monitor in focus shows its widgets on the glass instead, so its own text is left out
    const shown = Object.values(readings.value).map(r => r.id === ship.focus ? { ...r, lines: [], level: 'idle' as const } : r);
    drawAtlas(ctx, shown, ph, bg, font, blink);
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
    const active = strafe !== 0 || forward !== 0 || turnAcc !== 0 || tiltAcc !== 0 || speed > 0.01 || glide !== null || move !== null
        || grabbed !== null || pushed.size > 0 || pending.size > 0;
    const wait = frameWait(settings.shipFps, active, saving.value);
    if (now - last < wait) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (cam || move)
    {
        // the camera belongs to the monitor: the walker waits where it was
        stepCamera(dt);
        body = { ...body, vx: 0, vy: 0 };
    }
    else if (glide)
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

    // sound, only if the user turned it on: a step per bounce of the walk (on plates or a grating), a hiss as a door
    // starts to slide and a thump as it shuts
    const stepNo = Math.floor(body.bob);
    if (stepNo !== lastStep)
    {
        lastStep = stepNo;
        if (Math.hypot(body.vx, body.vy) > 0.8) sound.play(stepKind(roomAt(body.x, body.y)?.zone) === 'grate' ? 'shipGrate' : 'shipStep');
    }
    const before = doors;
    doors = stepDoors(doors, body.x, body.y, dt);
    if (doors.some((v, i) => v > 0.02 && before[i] <= 0.02)) sound.play('shipDoor');
    if (doors.some((v, i) => v < 0.98 && before[i] >= 0.98 && Math.hypot(PORTALS[i].x - body.x, PORTALS[i].y - body.y) < 10)) sound.play('shipDoorShut');
    sound.listenShip(body.x, body.y, body.yaw, doors);
    cues(now);
    // Jones and the android wander; with reduced motion they keep still
    if (!reducedMotion) roamers = roamers.map(r => stepRoamer(r, dt, Math.random));
    agents = agentsOf(stay.value, roamers);
    stepShown(shown, controlTargets(now), dt);
    for (const [id, left] of pushed) if (left - dt <= 0) pushed.delete(id); else pushed.set(id, left - dt);
    const blink = reducedMotion || Math.floor(now / BLINK_MS) % 2 === 0;
    gl.setCrew(joined(
        figureVertices(agents, reducedMotion ? 0 : now / 1000, new Set(roamers.filter(r => r.route).map(r => r.id)), crewLook(dt)),
        birdVertices(reducedMotion ? 0 : now / 1000),
        settings.shipLabels ? plateVertices(agents, body.yaw) : new Float32Array(0),
        shuttles.value,
        controlVertices(shipControls.states.value, { shown, pressed: pushed, blink }),
        quiet.value ? quietMesh : new Float32Array(0),
    ));

    if (atlasDirty || (hasUrgent.value && blink !== blinkShown)) paintAtlas(blink);
    blinkShown = blink;

    gl.resize(renderScale(window.devicePixelRatio || 1, saving.value));
    gl.setBloom(settings.shipBloom && !saving.value ? bloomGain(effective.bloom) : 0);
    gl.render({
        eye: cam ? [cam.x, cam.z, cam.y] : [body.x, eyeHeight(body, reducedMotion), body.y],
        yaw: cam ? cam.yaw : body.yaw,
        pitch: cam ? cam.pitch : body.pitch,
        // a room that wants attention is lit brighter, and an urgent one blinks
        lights: (() =>
        {
            const lamps = quick.flashlight ? LIGHTS_FLOOD : LIGHTS;
            const zones = quick.flashlight ? floodZone : lightZone;
            const at = cam ?? body;
            return packLights(lamps, nearestLights(lamps, at.x, at.y, 1.6), i =>
            {
                if (lamps[i] === FLOOD) return 1;
                const level = levels.value[zones[i] ?? ''];
                return (level === 'urgent' ? (blink ? 2 : 0.35) : level === 'notice' ? 1.6 : 1) * dim.value;
            });
        })(),
        dim: dim.value,
        time: now / 1000,
        doors,
        blink,
        holo: reducedMotion ? 0 : 0.6,
        color: settings.shipColor !== 'phosphor',
        // an urgent room's light goes over to alarm red with the blink
        alerts: alertsByStyle(blink),
        sweep: reducedMotion ? -1000 : hull.y0 - 3 + (((now / 1000) % SWEEP_S) / SWEEP_S) * (hull.y1 - hull.y0 + 6),
    });
}

/** How red each style's light is: the styles of the rooms with an urgent reading pulse with the blink. */
function alertsByStyle(blink: boolean): number[]
{
    const out = Array.from({ length: MAX_STYLES }, () => 0);
    for (const [zone, level] of Object.entries(levels.value))
    {
        const st = STYLE[zone as keyof typeof STYLE];
        if (level === 'urgent' && st !== undefined) out[st] = Math.max(out[st], blink ? 0.75 : 0.25);
    }
    return out;
}

// ---- little sounds of the crew: a chirp as you come near the ones with messages, Jones's meow, the android's servos
let nearSignals = false;
let nextMeow = 0;
let nextServo = 0;

function cues(now: number)
{
    const dist = (a: { x: number; y: number }) => Math.hypot(a.x - body.x, a.y - body.y);
    const closest = Math.min(Infinity, ...stay.value.filter(a => a.kind === 'signal').map(dist));
    // one chirp per approach: it rearms when you walk away
    if (!nearSignals && closest < 3) { nearSignals = true; sound.play('shipSignal'); }
    else if (nearSignals && closest > 5) nearSignals = false;

    for (const r of roamers)
    {
        if (r.kind === 'cat' && dist(r) < 5 && now > nextMeow)
        {
            nextMeow = now + 20000 + Math.random() * 30000;
            sound.play('shipMeow');
        }
        else if (r.kind === 'android' && r.route && dist(r) < 6 && now > nextServo)
        {
            nextServo = now + 1500;
            sound.play('shipAsh');
        }
    }
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

/** A touch as the camera sees it: the point on the canvas, the canvas size and the eye; null while the walk can't be touched. */
function viewPoint(clientX: number, clientY: number)
{
    const el = canvas.value;
    if (!el || paused.value || covered.value || focused.value) return null;
    // the curved glass moves what is painted but not the touch, so the point is corrected by hand
    const tube = settings.curvature ? el.closest('.tube') : null;
    const k = bendK(settings.curvatureBend);
    const p = tube && k > 0 ? correctPoint(clientX, clientY, tube.getBoundingClientRect(), k) : { x: clientX, y: clientY };
    const box = el.getBoundingClientRect();
    // seated, the eye is the station's
    const eye: [number, number, number] = cam ? [cam.x, cam.z, cam.y] : [body.x, eyeHeight(body, true), body.y];
    return { x: p.x - box.left, y: p.y - box.top, box, eye, yaw: cam ? cam.yaw : body.yaw, pitch: cam ? cam.pitch : body.pitch };
}

/** A finger lands: on a lever within reach it takes the lever instead of the walk or the look. */
function onGrab(clientX: number, clientY: number): boolean
{
    const at = viewPoint(clientX, clientY);
    if (!at) return false;
    if (move) return false;
    const pick = pickControl(at.eye, at.yaw, at.pitch, at.box.width, at.box.height, at.x, at.y);
    if (!pick || pick.control.kind !== 'lever' || pick.distance > REACH) return false;
    const st = shipControls.states.value[pick.control.id];
    if (!st || st.lock || st.value === null) return false;
    const value = shown.get(pick.control.id) ?? st.value;
    // metres of the panel a pixel covers at that distance
    const perPx = (2 * pick.distance * Math.tan(fovYFor(at.box.width / at.box.height) / 2)) / at.box.height;
    grabbed = { control: pick.control, value, start: value, perPx };
    return true;
}

function onGrabMove(dy: number)
{
    if (!grabbed) return;
    const before = Math.round(grabbed.value * 10);
    grabbed.value = dragValue(grabbed.value, -dy * grabbed.perPx);
    // a click at each tenth, like a detent
    if (Math.round(grabbed.value * 10) !== before) sound.play('shipLever');
}

function onGrabEnd()
{
    const g = grabbed;
    grabbed = null;
    // a lever barely moved is a tap, which `onTap` handles
    if (!g || Math.abs(g.value - g.start) < 0.02) return;
    setControl(g.control, Math.round(g.value * 20) / 20);
}

function deny(lock: ControlLock)
{
    sound.play('shipDenied');
    denied.value = lock;
    clearTimeout(deniedTimer);
    deniedTimer = window.setTimeout(() => { denied.value = null; }, 4000);
}

function grantDenied()
{
    if (denied.value) shipControls.grant(denied.value);
    denied.value = null;
}

/** Asks the phone for a control's new value, shows it at once and has MOTHER confirm it if the user wants. */
function setControl(c: ControlData, value: number)
{
    pending.set(c.id, { value, until: performance.now() + PENDING_MS });
    if (!shipControls.apply(c.action, value)) { pending.delete(c.id); deny('missing'); return; }
    if (settings.shipVoice)
    {
        const line = voiceLine(c.action, value);
        if (line) speech.speak(line);
    }
}

/** A tap on a control: a toggle flips, a selector turns a stop, a lever steps toward the finger, a button is pushed. */
function useControl(pick: ControlPick)
{
    const c = pick.control;
    const st = shipControls.states.value[c.id];
    if (!st || st.value === null) { deny('missing'); return; }
    if (st.lock) { deny(st.lock); return; }
    sound.play(c.kind === 'toggle' || c.kind === 'selector' ? 'shipSwitch' : c.kind === 'lever' ? 'shipLever' : 'shipKey');
    if (settings.haptics) tick();
    const v = tapValue(c.kind, shown.get(c.id) ?? st.value, pick.along);
    if (v === 'read') say(shipControls.readout(c.action));
    else if (v === 'press')
    {
        pushed.set(c.id, PRESS_S);
        if (!shipControls.apply(c.action, 'press')) deny('missing');
    }
    else setControl(c, v);
}

/** A short touch: a control, a crew member, a shuttle or a monitor under the finger, if it is close enough. */
function onTap(clientX: number, clientY: number)
{
    const at = viewPoint(clientX, clientY);
    if (!at) return;
    if (move) return;
    const { box, eye, x, y, yaw, pitch } = at;
    const control = pickControl(eye, yaw, pitch, box.width, box.height, x, y);
    const person = pickAgent(agents, eye, yaw, pitch, box.width, box.height, x, y);
    const screen = pickScreen(eye, yaw, pitch, box.width, box.height, x, y);
    const shuttle = pickShuttle(bays.value, eye, yaw, pitch, box.width, box.height, x, y);
    // a seat is taken from standing; sitting, the ones nearby are just furniture
    const seat = seated.value ? null : pickStation(eye, yaw, pitch, box.width, box.height, x, y);
    // whichever is in front
    const near = Math.min(person?.distance ?? Infinity, screen?.distance ?? Infinity, shuttle?.distance ?? Infinity, control?.distance ?? Infinity, seat?.distance ?? Infinity);
    if (near === Infinity) return;
    if (near > REACH)
    {
        say(seat?.distance === near ? (seat.station.lying ? 'ACÉRCATE A LA CÁPSULA' : 'ACÉRCATE AL PUESTO') : control?.distance === near ? 'ACÉRCATE AL PANEL' : shuttle?.distance === near ? 'ACÉRCATE A LA LANZADERA' : screen?.distance === near ? 'ACÉRCATE AL MONITOR' : 'ACÉRCATE');
        return;
    }

    if (control?.distance === near) { useControl(control); return; }
    if (seat?.distance === near) { ship.sit(seat.station.id); return; }

    if (shuttle?.distance === near)
    {
        const pkg = settings.favorites[shuttle.index];
        if (pkg)
        {
            sound.play('shipLaunch');
            launcher.launch(pkg, labelOf(pkg));
        }
        return;
    }
    if (person?.distance === near)
    {
        const { kind, plate } = person.agent;
        if (kind === 'signal')
        {
            sound.play('shipSignal');
            const app = signalApps.value[(plate ?? SIGNAL_PLATES) - SIGNAL_PLATES];
            if (app) ship.openSignals(app.packageName); else ship.enterFocus('comms.senales');
        }
        else if (kind === 'contact')
        {
            // the contact's card in the phone's contacts: never a call straight away
            const c = starred.value[(plate ?? CONTACT_PLATES) - CONTACT_PLATES];
            if (c) contacts.openContact(c); else ship.enterFocus('comedor.rancho');
        }
        else if (kind === 'diner') say(`TRIPULANTE: ${dinerLine(person.agent.id, chats++)}`);
        else if (kind === 'cat') { sound.play('shipMeow'); say('JONES: MIAU'); }
        else { sound.play('shipAsh'); say(`ASH: ${readings.value['enfermeria.sistema']?.lines.join(' ') ?? 'NOMINAL'}`); }
        return;
    }
    const zone = screen!.screen.zone;
    if (zone !== 'hub') ship.enterFocus(screen!.screen.id);
    else if (screen!.screen.id === 'hub.buscar') ship.askSearch();
    else settings.activeTab = 'mother';
}

// ---- the strip at the top: the room you are in and the one that wants you
const here = computed(() => roomAt(ship.pose.x, ship.pose.y)?.zone);
const hud = computed(() => hudLine(readings.value, here.value) + (saving.value ? ' · AHORRO' : ''));
const alert = computed(() => nextAlertRoom(levels.value, here.value));
const alertTurn = computed(() => alert.value ? turnToward(ship.pose.x, ship.pose.y, ship.pose.yaw, alert.value.zone) : 'ahead');

function onGo(room: string)
{
    if (paused.value || covered.value || focused.value) return;
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
    cam = null;
    move = null;
    station = null;
    monitor.value = null;
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
    quietMesh = quietVertices();
    if (!gl) { unsupported.value = true; return; }
    palette();
    paintAtlas(true);
    // the detail of the surfaces: brightness and relief (see scripts/pack_ship_textures.py); flat until they arrive
    void loadMaterialTextures(gl, import.meta.env.BASE_URL);
    // the monitors' font may still be loading
    document.fonts?.ready.then(() => { atlasDirty = true; });
    raf = requestAnimationFrame(frame);
    bridgeEvents.addEventListener(onBridgeEvent);
    sound.setShip(true);
    // the tube's scan lines are as strong over the ship as over text, and they beat against its edges: soften them here
    document.documentElement.style.setProperty('--scan-alpha', '0.12');
});

onBeforeUnmount(() =>
{
    cancelAnimationFrame(raf);
    sound.setShip(false);
    document.documentElement.style.removeProperty('--scan-alpha');
    bridgeEvents.removeEventListener(onBridgeEvent);
    ship.pose = { x: body.x, y: body.y, yaw: body.yaw, pitch: body.pitch };
    clearTimeout(hintTimer);
    clearTimeout(deniedTimer);
    gl?.dispose();
    gl = null;
});
</script>

<template>
    <div class="ship-panel" data-no-swipe>
        <canvas ref="canvas" class="view" />
        <ShipControls v-if="!unsupported && !focused" :look-only="seated" :grab="onGrab" @move="onMove" @look="onLook" @tap="onTap" @grab-move="onGrabMove" @grab-end="onGrabEnd" />
        <ShipMinimap v-if="!unsupported && !focused && !seated" :pose="ship.pose" :readings="readings" @go="onGo" />
        <ShipHud v-if="!unsupported && !paused && !focused" :line="hud" :alert="alert" :turn="alertTurn" :here="here" @go="onGo" />
        <ShipMonitor v-if="monitor" v-bind="monitor" />
        <div v-if="hint" class="hint">{{ hint }}</div>
        <div v-if="denied" class="denied" data-no-swipe>
            <span>{{ LOCK_TEXT[denied] }}</span>
            <button v-if="denied === 'settings' || denied === 'policy'" class="pressable" @click="grantDenied" @touchstart.stop @mousedown.stop>[CONCEDER]</button>
        </div>
        <button v-if="!unsupported && !paused && !focused && !seated" class="pause pressable" @click="setPaused(true)" @touchstart.stop @mousedown.stop>[II]</button>
        <button v-if="focused" class="back pressable" @click="ship.leaveFocus()" @touchstart.stop @mousedown.stop>[« VOLVER]</button>
        <button v-else-if="seated" class="back pressable" @click="ship.stand()" @touchstart.stop @mousedown.stop>[LEVANTARSE]</button>
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

.denied {
    position: absolute;
    left: 50%;
    bottom: 34px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 8px;
    white-space: nowrap;
    background: var(--ph-bg);
    border: 1px solid var(--ph);
    color: var(--ph);
    @include box-glow;

    button {
        padding: 0 6px;
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        @include glow;

        &:active { @include inverse; }
    }
}

.pause,
.back {
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
