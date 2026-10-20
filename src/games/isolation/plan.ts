import { cellAt } from './grid';
import type { GameState } from './game';

const ARROWS = ['▲', '►', '▼', '◄'] as const;

/**
 * The deck as text, for the map a terminal sends: walls as blocks, the player as an arrow. It shows the layout and
 * what is fixed (doors, terminals, vents, lockers, the exit) and the power cells still to find, never the creature.
 */
export function planRows(s: GameState): string[]
{
    const g = s.grid;
    const rows: string[] = [];
    for (let y = 0; y < g.h; y++)
    {
        let row = '';
        for (let x = 0; x < g.w; x++)
        {
            const i = y * g.w + x;
            if (i === s.player.cell) { row += ARROWS[s.player.dir]; continue; }
            if (s.items.includes(i)) { row += '*'; continue; }
            switch (cellAt(g, i))
            {
                case 'wall': row += '█'; break;
                case 'door': row += s.locked.includes(i) ? 'X' : s.closed.includes(i) ? '+' : '/'; break;
                case 'locker': row += 'L'; break;
                case 'terminal': row += 'T'; break;
                case 'vent': row += 'V'; break;
                case 'exit': row += 'E'; break;
                default: row += s.steam.includes(i) ? '~' : '·';
            }
        }
        rows.push(row);
    }
    return rows;
}

export const PLAN_KEY = ['█ PARED', '+ PUERTA', '/ ABIERTA', 'X SIN ENERGÍA', 'L TAQUILLA', 'T TERMINAL', 'V CONDUCTO', '~ VAPOR', '* CÉLULA', 'E LANZADERA'];
