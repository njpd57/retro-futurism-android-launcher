import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, choiceLabel, summary, visibleRows, type SettingRow } from '../settingsSchema';
import { valueAt } from '../gauge';

const section = (id: string) => SETTINGS_SECTIONS.find(s => s.id === id)!;
const rowId = (r: SettingRow) => r.kind === 'link' ? r.target : r.kind === 'action' ? r.id : r.key;

describe('settings schema', () =>
{
    it('describes every section and row in uppercase', () =>
    {
        for (const s of SETTINGS_SECTIONS)
        {
            expect(s.hint.length).toBeGreaterThan(0);
            expect(s.title).toBe(s.title.toUpperCase());
            for (const r of s.rows)
            {
                expect(r.hint.length, r.label).toBeGreaterThan(0);
                expect(r.label).toBe(r.label.toUpperCase());
                expect(r.hint).toBe(r.hint.toUpperCase());
            }
        }
    });

    it('has unique section ids, codes and rows', () =>
    {
        const ids = SETTINGS_SECTIONS.map(s => s.id);
        const codes = SETTINGS_SECTIONS.map(s => s.code);
        const rows = SETTINGS_SECTIONS.flatMap(s => s.rows.map(rowId));
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(codes).size).toBe(codes.length);
        expect(new Set(rows).size).toBe(rows.length);
    });

    it('keeps every setting of the old panel', () =>
    {
        const rows = new Set<string>(SETTINGS_SECTIONS.flatMap(s => s.rows.map(rowId)));
        for (const k of [
            'phosphor', 'bloom', 'scanlines', 'flicker', 'vignette', 'sweep', 'curvature', 'curvatureBend', 'curvatureCorners',
            'curvatureShade', 'tubePower', 'autoDegauss', 'phosphorBurn', 'clearBurn', 'imageFilter', 'showIcons', 'labelCase',
            'soundUi', 'soundAmbient', 'volume', 'haptics', 'bootSequence', 'idleMinutes', 'nightShift', 'hypersleep', 'protocols',
            'alertsEvent', 'alertsBattery', 'alertsAlarm', 'alertsSites', 'alertsKlaxon', 'showType', 'folderBoxes', 'appsLayout', 'bridgeButton',
            'ownStatusBar', 'resetPanels', 'hidden', 'permissions', 'backup', 'diagnostic',
        ])
            expect(rows.has(k), k).toBe(true);
        expect(SETTINGS_SECTIONS.some(s => s.opens === 'mother')).toBe(true);
    });

    it('shows dependent rows only when their setting is on', () =>
    {
        const tube = section('tube');
        const keys = (v: Record<string, unknown>) => visibleRows(tube, v).map(rowId);
        expect(keys({ curvature: false })).not.toContain('curvatureBend');
        expect(keys({ curvature: true })).toContain('curvatureBend');
        expect(keys({ phosphorBurn: true, burnMinutes: 0 })).not.toContain('clearBurn');
        expect(keys({ phosphorBurn: true, burnMinutes: 90 })).toContain('clearBurn');
        expect(keys({ phosphorBurn: false, burnMinutes: 90 })).not.toContain('clearBurn');
        expect(visibleRows(section('apps'), { folderBoxes: false }).map(rowId)).not.toContain('appsLayout');
    });

    it('labels choices and summarizes sections', () =>
    {
        const idle = section('shift').rows.find(r => r.kind === 'choice' && r.key === 'idleMinutes') as SettingRow & { kind: 'choice' };
        expect(choiceLabel(idle, 0)).toBe('OFF');
        expect(choiceLabel(idle, 5)).toBe('5 MIN');
        expect(summary('phosphor', { phosphor: 'amber', bloom: 0.7 })).toBe('ÁMBAR · 70%');
        expect(summary('tube', { scanlines: true, flicker: false, vignette: true, sweep: true, curvature: false })).toBe('3/5 EFECTOS');
        expect(summary('sound', { soundUi: false, soundAmbient: false, volume: 0.5 })).toBe('SILENCIO');
        expect(summary('sound', { soundUi: true, volume: 0.5, soundProfile: 'rele' })).toBe('RELÉ · 50%');
        expect(summary('apps', { folderBoxes: true, appsLayout: 'deck' })).toBe('CUBIERTAS');
        expect(summary('apps', { folderBoxes: false })).toBe('LISTA');
        expect(summary('mother', { motherKey: false })).toBe('SIN CLAVE');
    });
});

describe('slider value', () =>
{
    it('rounds to the step and clamps', () =>
    {
        expect(valueAt(0, 0, 100, 5)).toBe(0);
        expect(valueAt(1, 0, 100, 5)).toBe(100);
        expect(valueAt(0.52, 0, 100, 5)).toBe(50);
        expect(valueAt(0.53, 0, 100, 5)).toBe(55);
        expect(valueAt(-0.3, 0, 100, 5)).toBe(0);
        expect(valueAt(1.4, 0, 100, 5)).toBe(100);
        expect(valueAt(NaN, 10, 20, 1)).toBe(10);
    });
});
