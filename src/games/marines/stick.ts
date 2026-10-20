/**
 * The movement joystick. The thumb lands anywhere on it and what counts is how far it is dragged from there, so
 * it works wherever the thumb falls and not only on a fixed centre. Pure: no DOM.
 */
export const STICK = {
    /** pixels of drag for full speed: also how far the knob travels */
    radius: 48,
    /** the share of the radius where nothing moves, so a resting thumb doesn't drift */
    dead: 0.14,
};

export interface StickAxes
{
    /** -1..1, positive to the right */
    strafe: number;
    /** -1..1, positive forward (up on the screen) */
    forward: number;
    /** where the knob is drawn, in pixels from the centre: the drag held inside the circle */
    knobX: number;
    knobY: number;
}

/**
 * The movement asked for by a thumb dragged (`dx`, `dy`) pixels, the screen's y growing downwards. The speed grows
 * from zero at the edge of the dead zone to full at `radius`, in the direction of the drag, so a light push walks
 * slowly and a diagonal is never faster than a straight line.
 */
export function stickAxes(dx: number, dy: number, radius = STICK.radius, dead = STICK.dead): StickAxes
{
    const d = Math.hypot(dx, dy);
    if (d === 0 || !Number.isFinite(d)) return { strafe: 0, forward: 0, knobX: 0, knobY: 0 };

    const ux = dx / d;
    const uy = dy / d;
    const reach = Math.min(d, radius);
    const level = reach / radius;
    const speed = level < dead ? 0 : (level - dead) / (1 - dead);
    // `+ 0` keeps a zero from being negative zero
    return { strafe: ux * speed + 0, forward: -uy * speed + 0, knobX: ux * reach, knobY: uy * reach };
}
