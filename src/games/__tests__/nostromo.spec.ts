import { describe, expect, it } from 'vitest';
import { newGame, reduce, type NostromoState } from '../nostromo';

function run(commands: string[], from: NostromoState = newGame())
{
    let state = from;
    let output: string[] = [];
    for (const c of commands) ({ state, output } = reduce(state, c));
    return { state, output };
}

describe('nostromo', () =>
{
    it('looks at the starting room', () =>
    {
        expect(run(['mirar']).output[0]).toContain('HIPERSUEÑO');
    });

    it('moves with and without "ir" and rejects walls', () =>
    {
        expect(run(['ir este']).state.room).toBe('pasillo');
        expect(run(['e', 'norte']).state.room).toBe('puente');
        expect(run(['n']).output).toEqual(['No puedes ir por ahí.']);
    });

    it('ignores accents and case', () =>
    {
        const { state } = run(['E', 'S', 'COGER LANZALLAMAS']);
        expect(state.inventory).toEqual(['lanzallamas']);
        expect(run(['e', 's', 'Coger Lanzallamas', 'inventario']).output[0]).toContain('lanzallamas');
    });

    it('dies entering the engine room without the flamethrower', () =>
    {
        const { state } = run(['e', 's', 'e']);
        expect(state.over).toBe('dead');
        expect(run(['mirar'], state).output[0]).toContain('terminado');
    });

    it('the airlock needs the card', () =>
    {
        const blocked = run(['e', 'e', 's']);
        expect(blocked.state.room).toBe('comedor');
        const open = run(['e', 'n', 'coger tarjeta', 's', 'e', 'usar tarjeta', 's']);
        expect(open.state.room).toBe('esclusa');
    });

    it('can be won', () =>
    {
        const { state } = run([
            'e', 'n', 'coger tarjeta', 's', 'e', 'usar tarjeta', 'o', 's', 'coger lanzallamas',
            'e', 'coger bateria', 'usar lanzallamas', 'coger bateria', 'o', 'n', 'e', 's', 'e', 'usar bateria',
        ]);
        expect(state.over).toBe('win');
    });

    it('restarts', () =>
    {
        const dead = run(['e', 's', 'e']).state;
        expect(reduce(dead, 'reiniciar').state).toEqual(newGame());
    });

    it('does not mutate the previous state', () =>
    {
        const s = newGame();
        reduce(s, 'e');
        expect(s.room).toBe('dormitorio');
    });
});
