// Text adventure: escape the Nostromo. Pure: `reduce(state, input)` returns the new state and the lines to print.

export type Dir = 'n' | 's' | 'e' | 'o';

interface Room
{
    name: string;
    description: string;
    exits: Partial<Record<Dir, string>>;
}

export const ROOMS: Record<string, Room> = {
    dormitorio: { name: 'CÁMARA DE HIPERSUEÑO', description: 'Las cápsulas están abiertas y huele a ozono. Una puerta al este.', exits: { e: 'pasillo' } },
    pasillo: { name: 'PASILLO CENTRAL', description: 'Luces rojas parpadean. Puertas: oeste (dormitorio), norte (puente), este (comedor), sur (almacén).', exits: { o: 'dormitorio', n: 'puente', e: 'comedor', s: 'almacen' } },
    puente: { name: 'PUENTE', description: 'Las pantallas muestran estática. Todo está en silencio.', exits: { s: 'pasillo' } },
    comedor: { name: 'COMEDOR', description: 'Mesas volcadas. Al sur, una esclusa sellada con lector de tarjeta.', exits: { o: 'pasillo', s: 'esclusa' } },
    almacen: { name: 'ALMACÉN', description: 'Estanterías con cajas rotas. Al este, un conducto hacia la sala de motores.', exits: { n: 'pasillo', e: 'motores' } },
    motores: { name: 'SALA DE MOTORES', description: 'Calor y vapor. Algo se mueve entre las tuberías.', exits: { o: 'almacen' } },
    esclusa: { name: 'ESCLUSA', description: 'Una compuerta lleva a la lanzadera, al este.', exits: { n: 'comedor', e: 'lanzadera' } },
    lanzadera: { name: 'LANZADERA NARCISSUS', description: 'Los controles están apagados. Falta energía.', exits: { o: 'esclusa' } },
};

const ITEM_NAMES: Record<string, string> = {
    tarjeta: 'tarjeta de acceso',
    lanzallamas: 'lanzallamas',
    bateria: 'batería de la lanzadera',
};

export interface NostromoState
{
    room: string;
    inventory: string[];
    items: Record<string, string[]>;
    flags: { esclusaAbierta: boolean; alienFuera: boolean };
    moves: number;
    over: null | 'win' | 'dead';
}

export function newGame(): NostromoState
{
    return {
        room: 'dormitorio', inventory: [],
        items: { puente: ['tarjeta'], almacen: ['lanzallamas'], motores: ['bateria'] },
        flags: { esclusaAbierta: false, alienFuera: false }, moves: 0, over: null,
    };
}

export const INTRO = [
    'NOSTROMO · TERMINAL DE EMERGENCIA',
    'Has despertado antes de tiempo. Algo anda suelto en la nave.',
    'Escapa en la lanzadera. Escribe AYUDA para ver los comandos.',
];

const DIR_WORDS: Record<string, Dir> = { n: 'n', norte: 'n', s: 's', sur: 's', e: 'e', este: 'e', o: 'o', oeste: 'o' };
const DIR_NAMES: Record<Dir, string> = { n: 'norte', s: 'sur', e: 'este', o: 'oeste' };

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().split(/\s+/).filter(Boolean);
const ITEM_ALIASES: Record<string, string> = { tarjeta: 'tarjeta', lanzallamas: 'lanzallamas', lanzador: 'lanzallamas', bateria: 'bateria' };

function look(s: NostromoState): string[]
{
    const room = ROOMS[s.room];
    const lines = [`== ${room.name} ==`, room.description];
    if (s.room === 'motores')
        lines.push(s.flags.alienFuera ? 'El alien ha huido al conducto.' : 'ENTRE LAS TUBERÍAS HAY UN ALIEN.');
    for (const item of s.items[s.room] ?? [])
        lines.push(`Ves: ${ITEM_NAMES[item]}.`);
    return lines;
}

function go(s: NostromoState, dir: Dir): { state: NostromoState; output: string[] }
{
    const target = ROOMS[s.room].exits[dir];
    if (!target) return { state: s, output: ['No puedes ir por ahí.'] };
    if (target === 'esclusa' && !s.flags.esclusaAbierta)
        return { state: s, output: ['La esclusa está sellada. Necesita una tarjeta.'] };

    const next = { ...s, room: target };
    if (target === 'motores' && !s.inventory.includes('lanzallamas') && !s.flags.alienFuera)
        return { state: { ...next, over: 'dead' }, output: ['Entras en la sala de motores. El alien salta de las sombras.', '', 'HAS MUERTO. Escribe REINICIAR para volver a intentarlo.'] };

    return { state: next, output: look(next) };
}

function take(s: NostromoState, word: string | undefined): { state: NostromoState; output: string[] }
{
    const item = word ? ITEM_ALIASES[word] : undefined;
    if (!item || !(s.items[s.room] ?? []).includes(item)) return { state: s, output: ['No ves eso aquí.'] };
    if (item === 'bateria' && !s.flags.alienFuera) return { state: s, output: ['El alien te vigila. Antes tienes que ahuyentarlo.'] };

    return {
        state: { ...s, inventory: [...s.inventory, item], items: { ...s.items, [s.room]: s.items[s.room].filter(i => i !== item) } },
        output: [`Coges: ${ITEM_NAMES[item]}.`],
    };
}

function use(s: NostromoState, word: string | undefined): { state: NostromoState; output: string[] }
{
    const item = word ? ITEM_ALIASES[word] : undefined;
    if (!item || !s.inventory.includes(item)) return { state: s, output: ['No tienes eso.'] };

    if (item === 'tarjeta' && s.room === 'comedor')
        return { state: { ...s, flags: { ...s.flags, esclusaAbierta: true } }, output: ['El lector pita. La esclusa se abre.'] };
    if (item === 'lanzallamas' && s.room === 'motores' && !s.flags.alienFuera)
        return { state: { ...s, flags: { ...s.flags, alienFuera: true } }, output: ['Una llamarada. El alien chilla y huye por el conducto.'] };
    if (item === 'bateria' && s.room === 'lanzadera')
        return { state: { ...s, over: 'win' }, output: ['Colocas la batería. Los motores rugen y la lanzadera se separa de la Nostromo.', '', 'HAS ESCAPADO.'] };

    return { state: s, output: ['No pasa nada.'] };
}

const HELP = ['MIRAR · IR <n|s|e|o> · COGER <objeto> · USAR <objeto> · INVENTARIO · REINICIAR'];

export function reduce(state: NostromoState, input: string): { state: NostromoState; output: string[] }
{
    const [verb, arg] = normalize(input);
    if (!verb) return { state, output: [] };

    if (verb === 'reiniciar') { const s = newGame(); return { state: s, output: [...INTRO, '', ...look(s)] }; }
    if (verb === 'ayuda') return { state, output: HELP };
    if (state.over) return { state, output: ['La partida ha terminado. Escribe REINICIAR.'] };

    const counted = { ...state, moves: state.moves + 1 };

    if (verb === 'mirar' || verb === 'ver' || verb === 'l') return { state: counted, output: look(counted) };
    if (verb === 'inventario' || verb === 'i')
        return { state: counted, output: [counted.inventory.length ? `Llevas: ${counted.inventory.map(i => ITEM_NAMES[i]).join(', ')}.` : 'No llevas nada.'] };
    if (verb === 'ir' || verb === 've')
        return DIR_WORDS[arg ?? ''] ? go(counted, DIR_WORDS[arg!]) : { state: counted, output: [`¿Hacia dónde? (${Object.values(DIR_NAMES).join(', ')})`] };
    if (DIR_WORDS[verb]) return go(counted, DIR_WORDS[verb]);
    if (verb === 'coger' || verb === 'tomar' || verb === 'agarrar') return take(counted, arg);
    if (verb === 'usar') return use(counted, arg);

    return { state: counted, output: ['No entiendo eso. Escribe AYUDA.'] };
}
