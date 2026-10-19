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
import ContactsWidget from '@/components/widgets/ContactsWidget.vue';
import NostromoWidget from '@/components/widgets/NostromoWidget.vue';
import RadarWidget from '@/components/widgets/RadarWidget.vue';
import ScreenTimeWidget from '@/components/widgets/ScreenTimeWidget.vue';
import StorageWidget from '@/components/widgets/StorageWidget.vue';
import CompassWidget from '@/components/widgets/CompassWidget.vue';
import ForecastWidget from '@/components/widgets/ForecastWidget.vue';
import TelemetryWidget from '@/components/widgets/TelemetryWidget.vue';
import CountdownWidget from '@/components/widgets/CountdownWidget.vue';
import MoonWidget from '@/components/widgets/MoonWidget.vue';
import ProtocolWidget from '@/components/widgets/ProtocolWidget.vue';
import WorldClockWidget from '@/components/widgets/WorldClockWidget.vue';
import TimerWidget from '@/components/widgets/TimerWidget.vue';
import TrackerWidget from '@/components/widgets/TrackerWidget.vue';

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
    radar: { title: 'RADAR', component: RadarWidget, span: 1 },
    storage: { title: 'ALMACÉN', component: StorageWidget, span: 1 },
    contacts: { title: 'CONTACTOS', component: ContactsWidget, span: 1 },
    screentime: { title: 'USO', component: ScreenTimeWidget, span: 2 },
    protocol: { title: 'PROTOCOLO', component: ProtocolWidget, span: 1 },
    countdown: { title: 'T-MENOS', component: CountdownWidget, span: 1 },
    clocks: { title: 'COLONIAS', component: WorldClockWidget, span: 1 },
    moon: { title: 'FASE LUNAR', component: MoonWidget, span: 1 },
    forecast: { title: 'CLIMA 7 DÍAS', component: ForecastWidget, span: 1 },
    telemetry: { title: 'TELEMETRÍA', component: TelemetryWidget, span: 1 },
    compass: { title: 'RUMBO', component: CompassWidget, span: 1 },
    timer: { title: 'TEMPORIZADOR', component: TimerWidget, span: 1 },
    tracker: { title: 'DETECTOR', component: TrackerWidget, span: 2 },
    nostromo: { title: 'NOSTROMO', component: NostromoWidget, span: 2 },
};
