import type { Component } from 'vue';
import AppShortlistWidget from '@/components/widgets/AppShortlistWidget.vue';
import AgendaWidget from '@/components/widgets/AgendaWidget.vue';
import AlarmWeatherWidget from '@/components/widgets/AlarmWeatherWidget.vue';
import ClockWidget from '@/components/widgets/ClockWidget.vue';
import LinkWidget from '@/components/widgets/LinkWidget.vue';
import LogWidget from '@/components/widgets/LogWidget.vue';
import MediaWidget from '@/components/widgets/MediaWidget.vue';
import MotherWidget from '@/components/widgets/MotherWidget.vue';
import NotesWidget from '@/components/widgets/NotesWidget.vue';
import PowerWidget from '@/components/widgets/PowerWidget.vue';
import ScopeWidget from '@/components/widgets/ScopeWidget.vue';

export interface WidgetDef
{
    title: string;
    component: Component;
    /** Columns taken in the dashboard grid. */
    span: 1 | 2;
    props?: Record<string, unknown>;
}

/** The only list of available widgets: the dashboard layout stores a `kind` that is a key here. */
export const WIDGETS: Record<string, WidgetDef> = {
    clock: { title: 'SISTEMA', component: ClockWidget, span: 1 },
    power: { title: 'ENERGÍA', component: PowerWidget, span: 1 },
    link: { title: 'ENLACE', component: LinkWidget, span: 1 },
    favorites: { title: 'FAVORITAS', component: AppShortlistWidget, span: 1, props: { mode: 'favorites' } },
    recent: { title: 'RECIENTES', component: AppShortlistWidget, span: 2, props: { mode: 'recent' } },
    scope: { title: 'SEÑAL', component: ScopeWidget, span: 2 },
    log: { title: 'LOG', component: LogWidget, span: 2 },
    notes: { title: 'NOTAS', component: NotesWidget, span: 1 },
    agenda: { title: 'AGENDA', component: AgendaWidget, span: 1 },
    media: { title: 'REPRODUCTOR', component: MediaWidget, span: 1 },
    mother: { title: 'MOTHER', component: MotherWidget, span: 2 },
    alarm: { title: 'ALARMA · CLIMA', component: AlarmWeatherWidget, span: 1 },
};
