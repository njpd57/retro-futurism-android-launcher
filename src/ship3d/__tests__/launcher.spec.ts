import { describe, expect, it } from 'vitest';
import { LABEL_SLOTS, labelUv, slotUv } from '../atlas';
import { collides } from '../collide';
import { stationaryAgents } from '../crew';
import { plateVertices, shuttleVertices } from '../figures';
import { STANDS } from '../glide';
import { hudLine, nextAlertRoom, turnToward } from '../hud';
import { CONTACT_PLATES, PLATE_CHARS, plateTexts, SHUTTLE_PLATES, signalPlate, STENCIL_PLATES, STENCILS, withStencils } from '../labels';
import { EYE_HEIGHT } from '../math';
import { MAT, STRIDE } from '../mesh';
import { pickScreen, pickShuttle } from '../pick';
import { roomReadings, type ShipInput } from '../readings';
import { collisionSegments, hangarBays, inside, MAX_BAYS, PROPS, roomAt, ROOMS, screenById, screenNormal, SCREENS, TABLE_R } from '../world';

const INPUT: ShipInput = {
    now: new Date(2026, 9, 22, 14, 32).getTime(), heading: null, weather: { temperature: 18, code: 0 }, protocol: null,
    signals: 2, battery: { level: 80, charging: false }, link: 'WIFI', storage: null, screenMs: null, alarmAt: null,
    nextEvent: null, media: null, crew: 0, shuttles: 3, alerts: 0, log: [],
};

describe('hud', () =>
{
    const readings = roomReadings(INPUT);

    it('names the room and sums it up in a word', () =>
    {
        expect(hudLine(readings, 'puente')).toBe('PUENTE · 14:32 · 18 °C');
        expect(hudLine(readings, 'comms')).toBe('COMMS · 2 SEÑALES');
        expect(hudLine(readings, 'pasillo')).toBe('PASILLO');
        expect(hudLine(readings, 'camarotes')).toMatch(/^CAMAROTES · \d+ TRIPULANTES?$/);
        expect(hudLine(readings, undefined)).toBe('EXTERIOR');
    });

    it('points at the loudest room other than this one, urgent first', () =>
    {
        expect(nextAlertRoom({ comms: 'notice', motor: 'urgent' }, 'puente')).toEqual({ zone: 'motor', name: 'MOTOR', level: 'urgent' });
        expect(nextAlertRoom({ comms: 'notice', motor: 'urgent' }, 'motor')).toEqual({ zone: 'comms', name: 'COMMS', level: 'notice' });
        expect(nextAlertRoom({ comms: 'notice' }, 'comms')).toBeNull();
        expect(nextAlertRoom({}, 'puente')).toBeNull();
    });

    it('says which way to turn to face a room', () =>
    {
        const [x, y] = STANDS.comedor;
        // the bridge is north of the mess
        expect(turnToward(x, y, 0, 'puente')).toBe('ahead');
        expect(turnToward(x, y, Math.PI / 2, 'puente')).toBe('left');
        expect(turnToward(x, y, -Math.PI / 2, 'puente')).toBe('right');
    });
});

describe('name plates', () =>
{
    it('keep the count of a long app name', () =>
    {
        const p = signalPlate('Una aplicación con nombre larguísimo', 12);
        expect(p.length).toBeLessThanOrEqual(PLATE_CHARS);
        expect(p.endsWith(' 12')).toBe(true);
        expect(signalPlate('WhatsApp', 3)).toBe('WHATSAPP 3');
    });

    it('fill the slots of each group and leave the rest empty', () =>
    {
        const t = plateTexts({ signals: [{ label: 'Gmail', count: 1 }], contacts: ['Ripley'], shuttles: ['Mapas', 'Cámara'] });
        expect(t).toHaveLength(LABEL_SLOTS);
        expect(t[0]).toBe('GMAIL 1');
        expect(t[1]).toBeUndefined();
        expect(t[CONTACT_PLATES]).toBe('RIPLEY');
        expect(t[SHUTTLE_PLATES + 1]).toBe('CÁMARA');
        expect(t.filter(Boolean)).toHaveLength(4);
    });

    it('add the rooms\' stencils in their own slots without touching the others', () =>
    {
        const base = plateTexts({ signals: [{ label: 'Gmail', count: 1 }], contacts: [], shuttles: ['Mapas'] });
        const all = withStencils(base);
        expect(all.slice(0, STENCIL_PLATES)).toEqual(base.slice(0, STENCIL_PLATES));
        STENCILS.forEach((s, i) => expect(all[STENCIL_PLATES + i]).toBe(s.text));
        expect(all.length).toBeGreaterThanOrEqual(STENCIL_PLATES + STENCILS.length);
        expect(all.length).toBeLessThanOrEqual(LABEL_SLOTS);
        for (const s of STENCILS) expect(s.text.length).toBeLessThanOrEqual(PLATE_CHARS);
    });

    it('live below the monitors in the atlas, without overlapping them', () =>
    {
        const lastScreen = slotUv(SCREENS.length - 1);
        for (let i = 0; i < LABEL_SLOTS; i++)
        {
            const [u0, v0, u1, v1] = labelUv(i);
            expect(v0).toBeGreaterThanOrEqual(lastScreen[3] - 1e-9);
            expect(u1).toBeLessThanOrEqual(1);
            expect(v1).toBeLessThanOrEqual(1 + 1e-9);
            expect(u0).toBeLessThan(u1);
        }
    });

    it('float over every crew member that has one, as the label material', () =>
    {
        const agents = stationaryAgents(2, 1);
        const data = plateVertices(agents, 0.3);
        expect(data.length / STRIDE).toBe(agents.length * 6);
        for (let v = 0; v < data.length; v += STRIDE) expect(data[v + 8]).toBe(MAT.label);
        expect(plateVertices([{ id: 'jones', kind: 'cat', x: 0, y: 0, yaw: 0 }], 0)).toHaveLength(0);
    });
});

describe('hangar bays', () =>
{
    const hangar = ROOMS.find(r => r.id === 'hangar')!;

    it('park one shuttle per favourite, up to the bays there are, inside the hangar', () =>
    {
        expect(hangarBays(0)).toHaveLength(0);
        expect(hangarBays(2)).toHaveLength(2);
        expect(hangarBays(20)).toHaveLength(MAX_BAYS);
        for (const b of hangarBays(MAX_BAYS))
            for (const [dx, dy] of [[-1.7, -1.5], [1.7, -1.5], [1.7, 1.5], [-1.7, 1.5]])
                expect(inside(hangar.poly, b.x + dx, b.y + dy, 0.3), `${b.x},${b.y}`).toBe(true);
    });

    it('leave the aisle, the stand and the fleet monitor free', () =>
    {
        const segs = collisionSegments(ROOMS, [...PROPS, ...hangarBays(MAX_BAYS).map(b => b.prop)]);
        for (let y = 53.5; y <= 69.5; y += 0.5) expect(collides(segs, 0, y, 0.3), `aisle at ${y}`).toBe(false);
        expect(collides(segs, STANDS.hangar[0], STANDS.hangar[1], 0.3)).toBe(false);
        // seen from the stand, the fleet monitor is not hidden by a shuttle
        const flota = screenById('hangar.flota')!;
        expect(pickScreen([0, EYE_HEIGHT, 56], Math.PI, 0, 390, 700, 195, 340)?.screen.id).toBe(flota.id);
    });

    it('face the aisle, so a tap from it picks the shuttle in front', () =>
    {
        const bays = hangarBays(4);
        // in the aisle beside the first shuttle (left, front row), looking west at it
        const hit = pickShuttle(bays, [-3, EYE_HEIGHT, bays[0].y], -Math.PI / 2, -0.2, 390, 700, 195, 380);
        expect(hit?.index).toBe(0);
        expect(hit!.distance).toBeLessThan(4.2);
        // looking east, the one across the aisle
        expect(pickShuttle(bays, [3, EYE_HEIGHT, bays[1].y], Math.PI / 2, -0.2, 390, 700, 195, 380)?.index).toBe(1);
        // from the corridor outside the hangar, the wall hides them
        expect(pickShuttle(bays, [0, EYE_HEIGHT, 49], Math.PI, 0, 390, 700, 195, 350)).toBeNull();
    });

    it('build whole triangles with a plate on each', () =>
    {
        const data = shuttleVertices(hangarBays(3));
        expect(data.length % (STRIDE * 3)).toBe(0);
        expect(data.every(Number.isFinite)).toBe(true);
        let plates = 0;
        for (let v = 0; v < data.length; v += STRIDE) if (data[v + 8] === MAT.label) plates++;
        expect(plates).toBe(3 * 6);
    });
});

describe('the ship\'s terminal', () =>
{
    it('has the search and MOTHER monitors on the crown over the mess table, out of the way of heads', () =>
    {
        for (const id of ['hub.buscar', 'hub.mother'])
        {
            const s = screenById(id)!;
            expect(s.zone).toBe('hub');
            expect(s.hung).toBe(true);
            const [nx, ny] = screenNormal(s);
            expect(roomAt(s.x + nx * 1.2, s.y + ny * 1.2)?.zone).toBe('comedor');
            // over the table, which nobody walks on, and above anyone's head
            expect(Math.hypot(s.x, s.y)).toBeLessThan(TABLE_R);
            expect(s.z - s.h / 2).toBeGreaterThan(2.5);
        }
        expect(roomReadings(INPUT)['hub.buscar'].lines).toEqual(['TERMINAL', '> BUSCAR APP']);
    });
});
