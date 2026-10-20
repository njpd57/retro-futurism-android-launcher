import { describe, expect, it } from 'vitest';
import { newGame, type GameEvent } from '../game';
import { ARENA_OPERATIONS } from '../map';
import { messageFor, status } from '../radio';
import { MARINE } from '../squad';

const game = () => newGame(ARENA_OPERATIONS);

describe('messageFor', () =>
{
    it('says nothing for events that are not worth a line', () =>
    {
        expect(messageFor([], game())).toBeNull();
        expect(messageFor(['shot', 'hit', 'kill', 'ping', 'squadShot', 'blast'], game())).toBeNull();
    });

    it('names the marine who went down', () =>
    {
        const s = game();
        expect(messageFor(['marineDown:0'], s)).toBe(`BIOMONITOR: ${MARINE.names[0]} SEÑAL VITAL PERDIDA.`);
        expect(messageFor(['marineDown:1'], s)).toContain(MARINE.names[1]);
        expect(messageFor(['marineDown:7'], s)).toContain('MARINE');
    });

    it('names the weapon that was found', () =>
    {
        expect(messageFor(['pickupWeapon:shotgun'], game())).toBe('ARMA ASEGURADA: ESCOPETA.');
        expect(messageFor(['pickupWeapon:flamer'], game())).toContain('LANZALLAMAS');
    });

    it('lets the squad answer an order, with the voice of one who is standing', () =>
    {
        const s = game();
        expect(messageFor(['orderHold'], s)).toBe(`${MARINE.names[0]}: EN POSICIÓN.`);
        expect(messageFor(['orderFollow'], s)).toContain('SEGUIMOS');
        const first = { ...s, marines: [{ ...s.marines[0], hp: 0 }, s.marines[1]] };
        expect(messageFor(['orderHold'], first)).toContain(MARINE.names[1]);
        const none = { ...s, marines: s.marines.map(m => ({ ...m, hp: 0 })) };
        expect(messageFor(['orderHold'], none)).toContain('MANDO');
    });

    it('announces a replacement when the wave is cleared', () =>
    {
        const s = game();
        expect(messageFor(['waveClear'], s)).toContain('REPONGAN');
        expect(messageFor(['waveClear', 'reinforce'], s)).toContain('REEMPLAZO');
    });

    it('puts the most important event first', () =>
    {
        const s = game();
        const all: GameEvent[] = ['pickupAmmo', 'acid', 'grab', 'marineDown:0', 'lowHealth', 'dead'];
        expect(messageFor(all, s)).toContain('SEÑAL VITAL');
        expect(messageFor(all.slice(0, -1), s)).toContain('ABRAZACARAS');
        expect(messageFor(all.slice(0, 2), s)).toContain('ÁCIDO');
        expect(messageFor(['noGrenades'], s)).toContain('GRANADAS');
    });
});

describe('status', () =>
{
    it('counts down to the wave, then counts what is left', () =>
    {
        const s = game();
        expect(status(s)).toMatch(/^PRÓXIMA OLEADA EN \d+ S/);
        expect(status({ ...s, wave: { ...s.wave, phase: 'fight', toSpawn: 3 } })).toBe('OLEADA 1 · QUEDAN 3');
    });
});
