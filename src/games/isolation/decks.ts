import type { Dir, Sign } from './grid';

export interface DeckDef
{
    id: string;
    title: string;
    map: readonly string[];
    startDir: Dir;
    signs: readonly Sign[];
    /** rectangles `[x0, y0, x1, y1]` without power: unlit, seen only a cell away */
    dark?: readonly (readonly [number, number, number, number])[];
    /** what MOTHER says when the deck starts */
    briefing: readonly string[];
}

/** First deck: three power cells and the shuttle, one creature, vents, save terminals, loot, a flamethrower and a dark wing. */
export const DECK_C: DeckDef = {
    id: 'c',
    title: 'CUBIERTA C',
    map: [
        '###################',
        '#P..d.....#V..*..L#',
        '#.###.###.#.#####.#',
        '#.#LsT#*#...#..s#V#',
        '#.#####.#####.#.#.#',
        '#...D.......D.#...#',
        '###.#.#####.#.###.#',
        '#L..#.#w.V#.#..T#.#',
        '#.###.#.A.#.###.#.#',
        '#.....d...d.....#.#',
        '#.###.#####.#####.#',
        '#V..#.f.L...#*..c.#',
        '###.#########.###.#',
        '#E..D..c.T.w..D...#',
        '###################',
    ],
    startDir: 1,
    // the east wing has lost its power: only the terminals and the cells glow there
    dark: [[13, 5, 17, 11]],
    signs: [
        { x: 2, y: 1, dir: 0, text: 'C-01' },
        { x: 15, y: 1, dir: 0, text: 'C-02' },
        { x: 9, y: 5, dir: 0, text: 'CRUCE' },
        { x: 8, y: 9, dir: 2, text: 'COMEDOR' },
        { x: 6, y: 11, dir: 2, text: 'ENFERMERÍA' },
        { x: 2, y: 13, dir: 0, text: 'LANZADERA' },
    ],
    briefing: [
        'AQUÍ MOTHER.',
        'FORMA DE VIDA HOSTIL A BORDO.',
        'RECUPERE 3 CÉLULAS DE ENERGÍA',
        'Y LLEGUE A LA LANZADERA.',
        'EL RUIDO LA ATRAE. LAS TAQUILLAS OCULTAN.',
        'LOS TERMINALES GUARDAN SU PROGRESO.',
        'RECOJA MATERIAL Y FABRIQUE SEÑUELOS Y BENGALAS.',
        'EL ALA ESTE ESTÁ SIN ENERGÍA.',
    ],
};

export const DECKS: Record<string, DeckDef> = { [DECK_C.id]: DECK_C };
