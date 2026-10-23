import { slotUv, SLOT } from '../../atlas';
import type { V3 } from '../../math';
import { SCREENS, type ScreenDef } from '../../world';
import { MAT, Builder } from '../../mesh/builder';

/** The frame of a screen as the viewer sees it: right, up and normal in GL space. */
export function screenFrame(s: ScreenDef): { center: V3; normal: V3; right: V3; up: V3 }
{
    const t = s.tilt ?? 0;
    const [ct, st] = [Math.cos(t), Math.sin(t)];
    return {
        center: [s.x, s.z, s.y],
        // a glass leaning back faces up a little
        normal: [Math.sin(s.yaw) * ct, st, -Math.cos(s.yaw) * ct],
        // a viewer looks at the screen with yaw + PI
        right: [-Math.cos(s.yaw), 0, -Math.sin(s.yaw)],
        up: [-Math.sin(s.yaw) * st, ct, Math.cos(s.yaw) * st],
    };
}

/** A monitor: its picture from the atlas on a dark bezel. */
export function addScreen(b: Builder, s: ScreenDef, bezel = 0.12)
{
    b.room = null;
    const f = screenFrame(s);
    const slot = SLOT[s.id];
    const [u0, v0, u1, v1] = slotUv(slot);
    const corner = (dw: number, dh: number, push = 0): V3 => [
        f.center[0] + f.right[0] * dw + f.up[0] * dh + f.normal[0] * push,
        f.center[1] + f.up[1] * dh + f.normal[1] * push,
        f.center[2] + f.right[2] * dw + f.up[2] * dh + f.normal[2] * push,
    ];
    const hw = s.w / 2;
    const hh = s.h / 2;
    // the picture: top-left, top-right, bottom-right, bottom-left as the viewer sees them
    b.quad([corner(-hw, hh, 0.005), corner(hw, hh, 0.005), corner(hw, -hh, 0.005), corner(-hw, -hh, 0.005)], f.normal, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], MAT.screen, 1);
    const bz = bezel;
    b.quad([corner(-hw - bz, hh + bz), corner(hw + bz, hh + bz), corner(hw + bz, -hh - bz), corner(-hw - bz, -hh - bz)], f.normal, [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.frame, 0.1);
}

/** A terminal draws its own glass (see `assets/terminal`); this draws the plain monitors. */
export const build = (b: Builder) => { for (const s of SCREENS) if (!s.variant) addScreen(b, s); };
