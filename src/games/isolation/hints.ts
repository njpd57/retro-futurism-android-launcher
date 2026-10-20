import { cellX, cellY, distances, cellAt, type Grid } from './grid';
import { playerCell, type GameState } from './game';
import { SCALE } from './scale';
import { restore, type SavedGame } from './save';
import { formatDuration } from '@/utils/tui';
import { levelOf, modeOf } from './campaign';

const COMPASS = ['AL NORTE', 'AL ESTE', 'AL SUR', 'AL OESTE'] as const;

/** Which way and how far `to` is from `from`, in words: `AL ESTE, 12 PASOS`. Null when there is no way. */
export function directionTo(g: Grid, from: number, to: number): string | null
{
    // doors count as open: the player can open them
    const dist = distances(g, from, i => cellAt(g, i) !== 'wall');
    if (dist[to] < 0) return null;
    const dx = cellX(g, to) - cellX(g, from);
    const dy = cellY(g, to) - cellY(g, from);
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    return `${COMPASS[dir]}, ${Math.max(1, Math.round(dist[to] / SCALE))} PASOS`;
}

/** MOTHER's hint for what to do next, as lines. */
export function hintFor(s: GameState): string[]
{
    if (s.phase !== 'playing') return ['SIN PARTIDA EN CURSO.'];
    const here = playerCell(s);
    const lines: string[] = [];

    if (s.collected < s.needed)
    {
        const dist = distances(s.grid, here, i => cellAt(s.grid, i) !== 'wall');
        const near = s.items.filter(i => dist[i] >= 0).sort((a, b) => dist[a] - dist[b])[0];
        const way = near === undefined ? null : directionTo(s.grid, here, near);
        lines.push(`CÉLULA MÁS CERCANA: ${way ?? 'SIN RUTA'}.`);
    }
    else
    {
        const exit = s.grid.cells.indexOf('exit');
        const way = exit < 0 ? null : directionTo(s.grid, here, exit);
        lines.push(`LANZADERA: ${way ?? 'SIN RUTA'}.`);
    }

    const lock = s.locked[0];
    if (lock !== undefined)
    {
        const panel = Object.entries(s.roles).find(([, r]) => r.opens === lock);
        const way = panel ? directionTo(s.grid, here, Number(panel[0])) : null;
        lines.push(`HAY UNA PUERTA SIN ENERGÍA.${way ? ` PANEL DE DESVÍO: ${way}.` : ''}`);
    }
    if (s.ash?.active)
    {
        const off = Object.entries(s.roles).find(([, r]) => r.ashOff);
        const way = off ? directionTo(s.grid, here, Number(off[0])) : null;
        lines.push(`ASH ACTIVO. ${way ? `TERMINAL DE CONTROL: ${way}.` : 'SELLE UNA PUERTA TRAS ÉL.'}`);
    }
    if (s.countdownMs !== null) lines.push(`AUTODESTRUCCIÓN EN ${formatDuration(s.countdownMs).slice(3)}.`);
    if (!s.bag.flamer && s.loot.some(l => l.kind === 'flamer')) lines.push('HAY UN LANZALLAMAS EN LA CUBIERTA.');
    if (!s.jones && s.loot.some(l => l.kind === 'cat')) lines.push('JONES SIGUE A BORDO.');
    return lines;
}

/** A line about a saved game, for `/partida`. */
export function describeSave(saved: SavedGame): string[]
{
    const s = restore(saved, () => 0);
    const mode = modeOf(s.deck) === 'infinite' ? 'MODO INFINITO' : `CAMPAÑA ${levelOf(s.deck)}/5`;
    return [
        `${mode} · ${s.title}`,
        `CÉLULAS ${s.collected}/${s.needed} · T+${formatDuration(s.timeMs).slice(3)}`,
        `SEÑUELOS ${s.bag.decoys} · BENGALAS ${s.bag.flares}${s.bag.flamer ? ` · FUEGO ${s.bag.fuel}` : ''}`,
    ];
}

/** The same hint, for a game that is saved or suspended and not running. */
export const hintForSave = (saved: SavedGame): string[] => hintFor(restore(saved, () => 0));
