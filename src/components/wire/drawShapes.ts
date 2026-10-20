import type { Shape } from '@/games/wire/camera';

/** Line widths by tag; whatever is not listed is a thin wall line. `boost` brightens the glow of what shines. */
const STYLE: Record<string, { width: number; glowWidth: number; boost: number }> = {
    alien: { width: 1.6, glowWidth: 4, boost: 1 },
    flare: { width: 1.6, glowWidth: 4, boost: 2 },
    flame: { width: 1.8, glowWidth: 5, boost: 2 },
    // MARINES
    enemy: { width: 1.6, glowWidth: 4, boost: 1 },
    marine: { width: 1.4, glowWidth: 4, boost: 1 },
    tracer: { width: 1.4, glowWidth: 5, boost: 2 },
    blast: { width: 1.8, glowWidth: 5, boost: 2 },
    muzzle: { width: 1.8, glowWidth: 5, boost: 2 },
    acid: { width: 1.4, glowWidth: 4, boost: 1.5 },
};
const WALL_STYLE = { width: 1.2, glowWidth: 4, boost: 1 };

export interface DrawOptions
{
    /** phosphor and background colours, and the font family */
    ph: string;
    bg: string;
    font: string;
    /** multiplies every alpha (the tracker dims the view) */
    dim: number;
    /** 0..1, drops lines at random as the picture breaks up */
    interference: number;
    /** `settings.bloom`: strength of the glow under every line */
    bloom: number;
    /** view height, for the clip rectangles */
    h: number;
}

/** Draws shapes in order: filled faces cover what is behind them, lines glow with a wide faint stroke under a thin one. */
export function drawShapes(ctx: CanvasRenderingContext2D, shapes: readonly Shape[], o: DrawOptions)
{
    const glow = 0.22 * o.bloom;
    ctx.lineJoin = 'round';
    for (const sh of shapes)
    {
        if (sh.kind === 'text')
        {
            ctx.globalAlpha = sh.alpha * o.dim;
            ctx.fillStyle = o.ph;
            ctx.font = `${Math.round(sh.size)}px ${o.font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.save();
            ctx.transform(sh.a, sh.b, 0, 1, sh.x, sh.y);
            ctx.fillText(sh.text, 0, 0);
            ctx.restore();
            continue;
        }

        const clipped = sh.clip !== undefined;
        if (clipped)
        {
            // nothing of it shows through the walls
            if (!sh.clip!.length) continue;
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < sh.clip!.length; i += 2) ctx.rect(sh.clip![i], 0, sh.clip![i + 1] - sh.clip![i], o.h);
            ctx.clip();
        }

        ctx.beginPath();
        ctx.moveTo(sh.pts[0], sh.pts[1]);
        for (let i = 2; i < sh.pts.length; i += 2) ctx.lineTo(sh.pts[i], sh.pts[i + 1]);
        if (sh.kind === 'poly') ctx.closePath();
        if (sh.kind === 'poly' && sh.fill)
        {
            ctx.globalAlpha = 1;
            ctx.fillStyle = o.bg;
            ctx.fill();
        }
        // the picture drops lines when the creature is close
        if (!(o.interference > 0 && Math.random() < o.interference * 0.15))
        {
            const style = STYLE[sh.tag] ?? WALL_STYLE;
            ctx.strokeStyle = o.ph;
            // glow: a wide faint stroke under the thin one (cheaper than shadowBlur on every line)
            if (glow > 0)
            {
                ctx.globalAlpha = sh.alpha * o.dim * glow * style.boost;
                ctx.lineWidth = style.glowWidth;
                ctx.stroke();
            }
            ctx.globalAlpha = sh.alpha * o.dim;
            ctx.lineWidth = style.width;
            ctx.stroke();
        }
        if (clipped) ctx.restore();
    }
    ctx.globalAlpha = 1;
}
