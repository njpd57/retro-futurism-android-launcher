/**
 * How far a drag turns the view. Small movements stay fine, so a target can be tracked, and quick ones are
 * stretched so a flick turns round fast. Pure: no DOM.
 */
export const AIM = {
    /** pixels in one move at which the stretch starts to bite, and its most */
    knee: 14,
    boost: 1.2,
};

/** The pixels a drag move counts as, with the stretch applied (the sign is kept). */
export function aimPixels(dx: number): number
{
    return dx * (1 + Math.min(AIM.boost, Math.abs(dx) / AIM.knee));
}
