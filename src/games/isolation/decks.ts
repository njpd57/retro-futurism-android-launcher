import type { Dir, Sign } from './grid';

export interface DeckDef
{
    id: string;
    title: string;
    map: readonly string[];
    startDir: Dir;
    signs: readonly Sign[];
    /** what MOTHER says when the deck starts */
    briefing: readonly string[];
}

/** Prototype deck: three power cells and the shuttle, one creature. */
export const DECK_C: DeckDef = {
    id: 'c',
    title: 'CUBIERTA C',
    map: [
        '###################',
        '#P..d.....#...*..L#',
        '#.###.###.#.#####.#',
        '#.#L..#*#...#...#.#',
        '#.#####.#####.#.#.#',
        '#...D.......D.#...#',
        '###.#.#####.#.###.#',
        '#L..#.#...#.#...#.#',
        '#.###.#.A.#.###.#.#',
        '#.....d...d.....#.#',
        '#.###.#####.#####.#',
        '#...#...L...#*....#',
        '###.#########.###.#',
        '#E..D.........D...#',
        '###################',
    ],
    startDir: 1,
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
    ],
};
