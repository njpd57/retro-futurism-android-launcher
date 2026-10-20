import type { Dir, Sign } from './grid';
import { generateDeck, parseGeneratedId } from './generate';
import { scaleDeck } from './scale';

/** What a terminal does besides saving: it can show a crew log, switch Ash off or divert power to a door. */
export interface TerminalDef
{
    x: number;
    y: number;
    log?: string;
    ashOff?: boolean;
    /** the door `[x, y]` without power that this terminal energises */
    opens?: readonly [number, number];
}

export interface DeckDef
{
    id: string;
    title: string;
    map: readonly string[];
    startDir: Dir;
    signs: readonly Sign[];
    /** rectangles `[x0, y0, x1, y1]` without power: unlit, seen only a cell away */
    dark?: readonly (readonly [number, number, number, number])[];
    /** rectangles that lose power for `offMs` of every `periodMs` */
    blackout?: { rects: readonly (readonly [number, number, number, number])[]; periodMs: number; offMs: number };
    terminals?: readonly TerminalDef[];
    /** a self-destruct countdown that starts with the deck */
    countdownMs?: number;
    /** what MOTHER says when the deck starts */
    briefing: readonly string[];
}

/** First deck, the tutorial: three power cells and the shuttle, one creature, vents, save terminals and loot to craft with. */
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
        '#V..#...L...#*..c.#',
        '###.#########.###.#',
        '#E..D..c.T.w..D...#',
        '###################',
    ],
    startDir: 1,
    terminals: [{ x: 5, y: 3, log: 'c1' }, { x: 15, y: 7, log: 'c2' }, { x: 9, y: 13, log: 'c3' }],
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
        'RECOJA MATERIAL Y FABRIQUE SEÑUELOS.',
    ],
};


export const DECK_B: DeckDef = {
    id: 'b',
    title: 'CUBIERTA B · CONDUCTOS',
    map: [
        '#####################',
        '#P......L...V.T.....#',
        '#.###D####.####d###.#',
        '#.#....s.###......#.#',
        '###.f....#.#..c..*#.#',
        '###.....w#.#......#L#',
        '#.###d####.########.#',
        '#.....T...A.........#',
        '#V########.####D###V#',
        '#.#.L....#.#.....w#.#',
        '#L#*.s...#.#.*....###',
        '#.#......###......###',
        '#.###D####L#c######.#',
        '#.............V..L.E#',
        '#####################',
    ],
    startDir: 2,
    // the south and east have lost their power: only the terminals, the exit and the cells glow there
    dark: [[0, 6, 20, 14], [11, 0, 20, 5]],
    terminals: [{ x: 6, y: 7, log: 'b1' }, { x: 14, y: 1, log: 'b2' }],
    signs: [
        { x: 2, y: 1, dir: 0, text: 'B-01' },
        { x: 12, y: 7, dir: 0, text: 'CRUCE' },
        { x: 6, y: 13, dir: 2, text: 'MÁQUINAS' },
        { x: 18, y: 13, dir: 2, text: 'LANZADERA' },
    ],
    briefing: [
        'AQUÍ MOTHER.',
        'EL ALA SUR Y EL ALA ESTE ESTÁN SIN ENERGÍA.',
        'RECUPERE EL LANZALLAMAS EN LA ZONA CON LUZ.',
        'ES RUIDOSO. EL COMBUSTIBLE SE FABRICA.',
        'LAS BENGALAS ILUMINAN LA OSCURIDAD.',
        'RECUPERE 3 CÉLULAS Y LLEGUE A LA LANZADERA.',
    ],
};

export const DECK_LAB: DeckDef = {
    id: 'lab',
    title: 'LABORATORIO · ASH',
    map: [
        '#######################',
        '#..V.A.L.....V.......E#',
        '#.##D######D#####D###.#',
        '#.#.T..#..s....#T...#.#',
        '#L#....#.......#..*.###',
        '#.#c...#.....w.#.c..#.#',
        '#.##d######d#####d###.#',
        '#.......L..H..........#',
        '#.###d#####d#####d###.#',
        '#.#.....#.....s.....#.#',
        '###.*...#.....#...T.#L#',
        '#.#....w#..*..#.....#.#',
        '#.###D#####D#####D###.#',
        '#P.............L...V..#',
        '#######################',
    ],
    startDir: 0,
    terminals: [{ x: 4, y: 3, log: 'l1' }, { x: 16, y: 3, log: 'l3' }, { x: 18, y: 10, log: 'orden937', ashOff: true }],
    signs: [
        { x: 2, y: 1, dir: 0, text: 'LAB-01' },
        { x: 9, y: 7, dir: 0, text: 'BIOLOGÍA' },
        { x: 15, y: 7, dir: 2, text: 'CUARENTENA' },
        { x: 20, y: 13, dir: 2, text: 'MUESTRAS' },
    ],
    briefing: [
        'AQUÍ MOTHER.',
        'EL OFICIAL DE CIENCIAS PATRULLA EL LABORATORIO.',
        'ASH NO OYE Y NO SE CANSA.',
        'EL FUEGO NO LE AFECTA. EL RASTREADOR NO LE VE.',
        'UNA PUERTA CERRADA LE DETIENE.',
        'EL TERMINAL DE CONTROL LE APAGA.',
        'RECUPERE 3 CÉLULAS Y LLEGUE A LA LANZADERA.',
    ],
};

export const DECK_MAINT: DeckDef = {
    id: 'maint',
    title: 'MANTENIMIENTO · FALLOS',
    map: [
        '#####################',
        '#.......V......~....#',
        '#.##D###.##d#######.#',
        '#.#w.T.#~#...#...L#.#',
        '#L#....#.#.*.#..*.#V#',
        '#.#L...#.#..c#.#..#.#',
        '#.##d###.##D##....#.#',
        '#.....s......X..#.#A#',
        '#.##d###.##d##....#.#',
        '#.#...s#.#..L#.#..#.#',
        '#V#..*.#~#...#..w.#.#',
        '#.#w...#.#...#c..E#.#',
        '#.##D###L##D#######L#',
        '#P..........T.......#',
        '#####################',
    ],
    startDir: 0,
    blackout: { rects: [[0, 6, 12, 14]], periodMs: 26000, offMs: 9000 },
    terminals: [{ x: 5, y: 3, log: 'm2', opens: [13, 7] }, { x: 12, y: 13, log: 'm1' }],
    signs: [
        { x: 2, y: 1, dir: 0, text: 'TALLER' },
        { x: 9, y: 7, dir: 0, text: 'VAPOR' },
        { x: 3, y: 13, dir: 2, text: 'D-04' },
        { x: 15, y: 13, dir: 2, text: 'CARGA' },
    ],
    briefing: [
        'AQUÍ MOTHER.',
        'FUGAS DE VAPOR EN LOS CONDUCTOS: CRUCE CUANDO CALLEN.',
        'LA ENERGÍA FALLA POR ZONAS.',
        'LA LANZADERA ESTÁ TRAS UNA PUERTA SIN ENERGÍA.',
        'DESVÍE LA ENERGÍA DESDE EL TALLER.',
        'RECUPERE 3 CÉLULAS.',
    ],
};

export const DECK_HANGAR: DeckDef = {
    id: 'hangar',
    title: 'HANGAR · AUTODESTRUCCIÓN',
    map: [
        '#######################',
        '#....................A#',
        '#.#########D#########.#',
        '#V##..L..s.........##V#',
        '#.##............*..##L#',
        '#.wD...##.....##...##.#',
        '#.##..c............##.#',
        '#T##L.....###....s.D.E#',
        '#.##...............##.#',
        '#..d...##.....##...##.#',
        '#.##..*............##.#',
        '#.##.........w..L..##T#',
        '#.#j#######d#########.#',
        '#P...c...L...V........#',
        '#######################',
    ],
    startDir: 0,
    countdownMs: 300000,
    terminals: [{ x: 1, y: 7, log: 'h1' }, { x: 21, y: 11, log: 'h2' }],
    signs: [
        { x: 3, y: 1, dir: 0, text: 'HANGAR' },
        { x: 21, y: 6, dir: 1, text: 'NARCISSUS' },
        { x: 10, y: 13, dir: 2, text: 'MUELLE' },
        { x: 1, y: 9, dir: 3, text: 'CUBIERTA E' },
    ],
    briefing: [
        'AQUÍ MOTHER.',
        'AUTODESTRUCCIÓN ARMADA. CINCO MINUTOS.',
        'RECUPERE 2 CÉLULAS PARA LA NARCISSUS.',
        'EL GATO SIGUE A BORDO. NO ES PRIORIDAD.',
        'LLEGUE A LA NARCISSUS.',
    ],
};

/** The campaign, in order. */
export const CAMPAIGN: readonly DeckDef[] = [DECK_C, DECK_B, DECK_LAB, DECK_MAINT, DECK_HANGAR];

export const DECKS: Record<string, DeckDef> = Object.fromEntries(CAMPAIGN.map(d => [d.id, d]));

const scaled = new WeakMap<DeckDef, DeckDef>();

/** A deck as it is played: drawn on the small grid, scaled 2x2 for free movement (`scale.ts`). */
export function playable(deck: DeckDef): DeckDef
{
    let out = scaled.get(deck);
    if (!out)
    {
        out = scaleDeck(deck);
        scaled.set(deck, out);
    }
    return out;
}

/** A deck by id, ready to play: the campaign's, or one generated from a seed (`inf:<seed>:<level>`). */
export function deckFor(id: string): DeckDef | null
{
    if (id in DECKS) return playable(DECKS[id]);
    const g = parseGeneratedId(id);
    return g ? playable(generateDeck(g.seed, g.level)) : null;
}
