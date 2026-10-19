import type { BridgeMediaSession } from '@/types/bridge-fork';

/** The session position is a snapshot: while playing, extrapolate from `positionUpdatedAt`, clamped to the duration. */
export function mediaPosition(s: BridgeMediaSession, now: number)
{
    if (s.state !== 'playing') return Math.min(s.positionMs, s.durationMs || s.positionMs);

    const position = s.positionMs + (now - s.positionUpdatedAt) * s.playbackSpeed;
    return Math.max(0, s.durationMs > 0 ? Math.min(s.durationMs, position) : position);
}

/** `m:ss` */
export function formatMediaTime(ms: number)
{
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
