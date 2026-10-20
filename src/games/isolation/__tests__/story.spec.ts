import { describe, expect, it } from 'vitest';
import { DECK_C } from '../decks';
import { newGame } from '../game';
import { messageFor, objective } from '../story';

describe('story', () =>
{
    const s = newGame(DECK_C, () => 0);

    it('says the latest thing worth saying', () =>
    {
        expect(messageFor(['step', 'turn'], s)).toBeNull();
        expect(messageFor(['doorOpen', 'heard'], s)).toBe('PUERTA ABIERTA.');
        expect(messageFor(['pickup', 'allCells'], { ...s, collected: 3 })).toBe('CÉLULAS COMPLETAS. DIRÍJASE A LA LANZADERA.');
        expect(messageFor(['exitLocked'], { ...s, collected: 1 })).toBe('LANZADERA SIN ENERGÍA. FALTAN 2 CÉLULAS.');
    });

    it('tells what was picked up, made and used', () =>
    {
        expect(messageFor(['step', 'lootScrap'], s)).toBe('CHATARRA RECUPERADA.');
        expect(messageFor(['craftFlare'], s)).toBe('BENGALA FABRICADA.');
        expect(messageFor(['noParts'], s)).toBe('FALTAN MATERIALES.');
        expect(messageFor(['fire', 'scare', 'heard'], s)).toBe('EL ORGANISMO RETROCEDE.');
        expect(messageFor(['noFuel'], s)).toBe('SIN COMBUSTIBLE.');
    });

    it('states the goal', () =>
    {
        expect(objective(s)).toBe('RECUPERE CÉLULAS 0/3');
        expect(objective({ ...s, collected: 3 })).toBe('VAYA A LA LANZADERA');
    });
});
