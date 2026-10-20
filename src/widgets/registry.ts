import type { Component } from 'vue';
import type { WidgetCategory } from '@/utils/widgetCatalog';
import type { WidgetSize } from '@/utils/dashboardLayout';
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
import RerouteWidget from '@/components/widgets/RerouteWidget.vue';
import CompassWidget from '@/components/widgets/CompassWidget.vue';
import ForecastWidget from '@/components/widgets/ForecastWidget.vue';
import TelemetryWidget from '@/components/widgets/TelemetryWidget.vue';
import CountdownWidget from '@/components/widgets/CountdownWidget.vue';
import MoonWidget from '@/components/widgets/MoonWidget.vue';
import ProtocolWidget from '@/components/widgets/ProtocolWidget.vue';
import WorldClockWidget from '@/components/widgets/WorldClockWidget.vue';
import IsolationWidget from '@/components/widgets/IsolationWidget.vue';
import MarinesWidget from '@/components/widgets/MarinesWidget.vue';
import ImageWidget from '@/components/widgets/ImageWidget.vue';
import TimerWidget from '@/components/widgets/TimerWidget.vue';
import TrackerWidget from '@/components/widgets/TrackerWidget.vue';

export interface WidgetDef
{
    title: string;
    component: Component;
    /** Sizes the window can take in the dashboard grid; the first is the default. */
    sizes: WidgetSize[];
    props?: Record<string, unknown>;
    category: WidgetCategory;
    /** One terse line for the catalog. */
    description: string;
    /** Two or three lines of static glyphs that hint at what the window looks like. */
    preview: string[];
}

/** The only list of available widgets: the dashboard layout stores a `kind` that is a key here. */
export const WIDGETS: Record<string, WidgetDef> = {
    clock: { title: 'SISTEMA', component: ClockWidget, sizes: ['w', 's', 'l'], category: 'sistema', description: 'HORA, FECHA Y ESTADO GENERAL', preview: ['12:34:56', 'LUN 19 OCT'] },
    power: { title: 'ENERGÍA', component: PowerWidget, sizes: ['s', 'w'], category: 'sistema', description: 'BATERÍA Y CARGA', preview: ['▓▓▓▓▓░░░ 62%', 'CARGANDO »'] },
    link: { title: 'ENLACE', component: LinkWidget, sizes: ['s', 'w'], category: 'sistema', description: 'RED, WIFI Y DATOS MÓVILES', preview: ['WIFI ▂▄▆█', 'DATOS ▂▄░░'] },
    favorites: { title: 'FAVORITAS', component: AppShortlistWidget, sizes: ['t', 's', 'l'], props: { mode: 'favorites' }, category: 'personal', description: 'ACCESO RÁPIDO A TUS APPS', preview: ['» APP 1', '» APP 2', '» APP 3'] },
    recent: { title: 'RECIENTES', component: AppShortlistWidget, sizes: ['w', 'l'], props: { mode: 'recent' }, category: 'personal', description: 'ÚLTIMAS APPS ABIERTAS', preview: ['» APP 1   » APP 2', '» APP 3   » APP 4'] },
    scope: { title: 'SEÑAL', component: ScopeWidget, sizes: ['s', 'w'], category: 'sistema', description: 'OSCILOSCOPIO DECORATIVO', preview: ['▁▂▃▅▇▅▃▂▁▂▃▅▇▅▃▂▁'] },
    log: { title: 'LOG', component: LogWidget, sizes: ['w', 'l'], category: 'sistema', description: 'REGISTRO DE EVENTOS DEL SISTEMA', preview: ['12:00 ENLACE OK', '12:01 BATERÍA 62%'] },
    notes: { title: 'NOTAS', component: NotesWidget, sizes: ['t', 's', 'l'], category: 'personal', description: 'BLOC DE NOTAS RÁPIDO', preview: ['> COMPRAR PILAS', '> LLAMAR A ASH'] },
    agenda: { title: 'AGENDA', component: AgendaWidget, sizes: ['t', 's', 'l'], category: 'tiempo', description: 'PRÓXIMOS EVENTOS DEL CALENDARIO', preview: ['09:00 TURNO', '14:30 REUNIÓN'] },
    media: { title: 'REPRODUCTOR', component: MediaWidget, sizes: ['w', 's', 'l'], category: 'personal', description: 'CONTROL DE LA MÚSICA ACTIVA', preview: ['PISTA 01', '[|<] [>] [>|]'] },
    mother: { title: 'MOTHER', component: MotherWidget, sizes: ['w', 'l'], category: 'mother', description: 'CONSULTA RÁPIDA A LA COMPUTADORA', preview: ['> ESTADO', 'TODOS LOS SISTEMAS NOMINALES'] },
    alarm: { title: 'ALARMA · CLIMA', component: AlarmWeatherWidget, sizes: ['w', 's'], category: 'tiempo', description: 'PRÓXIMA ALARMA Y TIEMPO ACTUAL', preview: ['ALARMA 07:00', 'TEMP 18°C'] },
    radar: { title: 'RADAR', component: RadarWidget, sizes: ['l', 's', 't'], category: 'entorno', description: 'NOTIFICACIONES COMO CONTACTOS', preview: ['· ◉ ·', '·   ·  ·'] },
    storage: { title: 'ALMACÉN', component: StorageWidget, sizes: ['s', 'w'], category: 'sistema', description: 'ESPACIO LIBRE DEL ALMACENAMIENTO', preview: ['▓▓▓▓▓▓░░░░ 61%', '48 / 128 GB'] },
    contacts: { title: 'CONTACTOS', component: ContactsWidget, sizes: ['s', 't', 'l'], category: 'personal', description: 'CONTACTOS DESTACADOS', preview: ['» RIPLEY', '» DALLAS'] },
    screentime: { title: 'USO', component: ScreenTimeWidget, sizes: ['w', 'l'], category: 'sistema', description: 'TIEMPO DE PANTALLA DE HOY', preview: ['APP 1 ▓▓▓▓▓░░ 1H20', 'APP 2 ▓▓░░░░░ 0H35'] },
    protocol: { title: 'PROTOCOLO', component: ProtocolWidget, sizes: ['t', 's', 'l'], category: 'tiempo', description: 'LISTA DIARIA DE TAREAS', preview: ['[X] REVISAR', '[ ] INFORME'] },
    countdown: { title: 'T-MENOS', component: CountdownWidget, sizes: ['s', 'w'], category: 'tiempo', description: 'CUENTA ATRÁS A UNA FECHA', preview: ['T-MENOS', '012D 04H 30M'] },
    clocks: { title: 'COLONIAS', component: WorldClockWidget, sizes: ['s', 't'], category: 'tiempo', description: 'HORA EN OTRAS ZONAS', preview: ['MAD 12:00', 'TYO 20:00'] },
    moon: { title: 'FASE LUNAR', component: MoonWidget, sizes: ['s', 't', 'l'], category: 'entorno', description: 'FASE ACTUAL DE LA LUNA', preview: ['  ▄██▄', '  ▀██▀  62%'] },
    forecast: { title: 'CLIMA 7 DÍAS', component: ForecastWidget, sizes: ['t', 'l', 'w'], category: 'entorno', description: 'PREVISIÓN DE LA SEMANA', preview: ['LUN ▃ 19°', 'MAR ▅ 21°'] },
    telemetry: { title: 'TELEMETRÍA', component: TelemetryWidget, sizes: ['s', 'w'], category: 'sistema', description: 'LATENCIA HACIA UN SERVIDOR', preview: ['▂▃▂▅▃▂▃', '42 MS'] },
    compass: { title: 'RUMBO', component: CompassWidget, sizes: ['s', 't', 'l'], category: 'entorno', description: 'BRÚJULA DEL DISPOSITIVO', preview: ['  N', 'O + E', '  S'] },
    timer: { title: 'TEMPORIZADOR', component: TimerWidget, sizes: ['s', 'w'], category: 'tiempo', description: 'TEMPORIZADOR Y CRONÓMETRO', preview: ['05:00', '[INICIAR]'] },
    tracker: { title: 'DETECTOR', component: TrackerWidget, sizes: ['l', 'w'], category: 'juegos', description: 'MINIJUEGO: DETECTOR DE MOVIMIENTO', preview: ['· ◉ ·  ·', '   ·   ▒  3.2M'] },
    reroute: { title: 'REENRUTAR', component: RerouteWidget, sizes: ['w', 'l'], category: 'juegos', description: 'MINIJUEGO: REENRUTAR LA ENERGÍA', preview: ['═╦═╗ ░░', ' ╚═╩═▓'] },
    images: { title: 'IMÁGENES', component: ImageWidget, sizes: ['w', 'l'], category: 'personal', description: 'TUS IMÁGENES CON FILTRO CRT', preview: ['░▒▓█▓▒░', '▒▓███▓▒'] },
    isolation: { title: 'AISLAMIENTO', component: IsolationWidget, sizes: ['w', 'l'], category: 'juegos', description: 'ACCESO A AISLAMIENTO, PARTIDA, REGISTROS Y LOGROS', preview: ['CUBIERTA 3/5 · ASH', 'REGISTROS ▓▓▓░░░ 5/12'] },
    marines: { title: 'MARINES', component: MarinesWidget, sizes: ['s', 'w'], category: 'juegos', description: 'ACCESO A MARINES, RÉCORDS Y LOGROS', preview: ['OLEADA 7 · 4200', 'CAMPAÑA ▓▓░ 2/3'] },
    nostromo: { title: 'NOSTROMO', component: NostromoWidget, sizes: ['l', 'w'], category: 'juegos', description: 'AVENTANA DE TEXTO A BORDO', preview: ['> ABRIR PUERTA', 'LA ESCOTILLA CEDE.'] },
};
