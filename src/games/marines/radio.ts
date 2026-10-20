import type { GameEvent, MarinesState } from './game';
import { waveSize } from './waves';
import { WEAPONS, type WeaponId } from './weapons';

/** The first marine standing, who answers the orders. */
const voice = (s: MarinesState) => s.marines.find(m => m.hp > 0)?.name ?? 'MANDO';

/**
 * What the radio says about what just happened, or null when it is not worth a line. Uppercase, terse, ship-computer
 * Spanish; the sender is part of the line.
 */
export function messageFor(events: readonly GameEvent[], s: MarinesState): string | null
{
    const has = (e: GameEvent) => events.includes(e);
    const down = events.find((e): e is `marineDown:${number}` => e.startsWith('marineDown:'));
    const weapon = events.find((e): e is `pickupWeapon:${WeaponId}` => e.startsWith('pickupWeapon:'));

    // the most important event of the step wins
    if (has('dead')) return 'BIOMONITOR: SEÑAL VITAL PERDIDA.';
    if (has('waveStart')) return `MANDO: OLEADA ${s.wave.n}. ${waveSize(s.wave.n)} CONTACTOS.`;
    if (has('waveClear')) return has('reinforce') ? 'MANDO: ZONA LIMPIA. LLEGA UN REEMPLAZO.' : 'MANDO: ZONA LIMPIA. REPONGAN MUNICIÓN.';
    if (has('grab')) return '¡ABRAZACARAS! ¡DISPARE!';
    if (down) return `BIOMONITOR: ${s.marines[Number(down.slice('marineDown:'.length))]?.name ?? 'MARINE'} SEÑAL VITAL PERDIDA.`;
    if (has('lowHealth')) return 'BIOMONITOR: SALUD CRÍTICA.';
    if (has('acid') || has('splash')) return '¡ÁCIDO! SALGA DEL CHARCO.';
    if (has('dry')) return '¡SIN MUNICIÓN!';
    if (has('noGrenades')) return '¡SIN GRANADAS!';
    if (weapon) return `ARMA ASEGURADA: ${WEAPONS[weapon.slice('pickupWeapon:'.length) as WeaponId].name}.`;
    if (has('pickupAmmo')) return 'MUNICIÓN REPUESTA.';
    if (has('pickupGrenade')) return 'GRANADAS REPUESTAS.';
    if (has('pickupMed')) return 'BOTIQUÍN USADO.';
    if (has('orderHold')) return `${voice(s)}: EN POSICIÓN.`;
    if (has('orderFollow')) return `${voice(s)}: RECIBIDO. LE SEGUIMOS.`;
    return null;
}

/** The line shown when the radio has nothing new to say. */
export function status(s: MarinesState): string
{
    if (s.wave.phase === 'rest') return `PRÓXIMA OLEADA EN ${Math.ceil(s.wave.restMs / 1000)} S · OLEADA ${s.wave.n}`;
    const left = s.enemies.length + s.wave.toSpawn;
    return `OLEADA ${s.wave.n} · QUEDAN ${left}`;
}
