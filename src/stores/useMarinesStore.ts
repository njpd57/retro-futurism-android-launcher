import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { DIFFICULTY_ORDER, isCampaign, type DifficultyId, type Won } from "@/games/marines/campaign";
import { EMPTY_RECORD, EMPTY_STATS, addStats, isRecords, mergeRecord, type ArenaRecord, type Beaten, type Report, type Stats } from "@/games/marines/report";
import { ACHIEVEMENTS } from "@/games/marines/achievements";
import { isSavedGame, type SavedGame } from "@/games/marines/save";
import { nullableJson } from "@/utils/storage";

/** How the game is played on this phone. */
export interface MarinesPrefs
{
    /** multiplies how far a drag on the view turns the player */
    sensitivity: number;
    /** frames a second: 30 spares the battery and the CRT filter, 60 aims smoother */
    fps: 30 | 60;
    /** the arena the title screen has picked */
    arena: string;
    /** `waves` (the endless defence) or `campaign` */
    mode: 'waves' | 'campaign';
    difficulty: DifficultyId;
    /** the campaign mission the title screen has picked */
    mission: string;
}

export const SENSITIVITY_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Reads the single best wave and score saved before there were several arenas, which belonged to OPERACIONES. */
function legacyRecords(): Record<string, ArenaRecord>
{
    try
    {
        const old = JSON.parse(localStorage.getItem('widget.marines.records') ?? 'null');
        if (old && Number.isFinite(old.wave) && old.wave > 0) return { operaciones: { ...EMPTY_RECORD, wave: old.wave, score: old.score ?? 0, runs: 1 } };
    }
    catch { /* nothing readable: start clean */ }
    return {};
}

/**
 * The MARINES game screen, and what outlives it: the records of each arena, the game suspended on leaving and the
 * preferences. The game itself lives in the component.
 */
export const useMarinesStore = defineStore('marines', () =>
{
    const open = ref(false);
    const records = useLocalStorage<Record<string, ArenaRecord>>('widget.marines.records.v2', legacyRecords(), { serializer: {
        read: raw => { try { const v: unknown = JSON.parse(raw); return isRecords(v) ? v : {}; } catch { return {}; } },
        write: v => JSON.stringify(v),
    } });
    const suspended = useLocalStorage<SavedGame | null>('widget.marines.suspend', null, { serializer: nullableJson(isSavedGame) });
    const prefs = useLocalStorage<MarinesPrefs>('widget.marines.prefs', { sensitivity: 1, fps: 30, arena: 'operaciones', mode: 'waves', difficulty: 'veterano', mission: 'aguanten' }, { mergeDefaults: true });

    /** The missions won, with the difficulty and the time of the best run of each. */
    const campaign = useLocalStorage<Record<string, Won>>('widget.marines.campaign', {}, { serializer: {
        read: raw => { try { const v: unknown = JSON.parse(raw); return isCampaign(v) ? v : {}; } catch { return {}; } },
        write: v => JSON.stringify(v),
    } });

    /** Remembers a won mission; a harder run, or a faster one at the same difficulty, replaces the old. */
    function win(mission: string, difficulty: DifficultyId, timeMs: number)
    {
        const old = campaign.value[mission];
        const rank = (d: DifficultyId) => DIFFICULTY_ORDER.indexOf(d);
        if (old && (rank(old.difficulty) > rank(difficulty) || (old.difficulty === difficulty && old.timeMs <= timeMs))) return;
        campaign.value = { ...campaign.value, [mission]: { difficulty, timeMs } };
    }

    /** Totals over every run. */
    const stats = useLocalStorage<Stats>('widget.marines.stats', { ...EMPTY_STATS }, { mergeDefaults: true });
    const tally = (report: Report, won: boolean) => { stats.value = addStats(stats.value, report, won); };

    /** The achievements earned, by id. */
    const achievements = useLocalStorage<Record<string, boolean>>('widget.marines.achievements', {});

    /** Marks achievements as earned; returns the ones that were new. */
    function unlock(ids: readonly string[]): string[]
    {
        const fresh = ids.filter(id => !achievements.value[id] && ACHIEVEMENTS.some(a => a.id === id));
        if (fresh.length) achievements.value = { ...achievements.value, ...Object.fromEntries(fresh.map(id => [id, true])) };
        return fresh;
    }

    function show() { open.value = true; }
    function close() { open.value = false; }

    const recordOf = (arena: string): ArenaRecord => records.value[arena] ?? EMPTY_RECORD;

    /** Folds a finished run into its arena's record, and says what it beat. */
    function record(report: Report): Beaten[]
    {
        const r = mergeRecord(recordOf(report.arena), report);
        records.value = { ...records.value, [report.arena]: r.record };
        return r.beaten;
    }

    return { open, records, suspended, prefs, campaign, achievements, unlock, stats, tally, show, close, record, recordOf, win };
});
