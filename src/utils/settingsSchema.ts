/**
 * The settings page as data: sections and their rows. Pure, so it is tested; `SettingsPanel` only paints it.
 * Keys are the `useSettingsStore` ones, so the stored values (and the backup) don't change.
 */
import { PHOSPHORS, type useSettingsStore } from '@/stores/useSettingsStore';
import { PROFILE_IDS, PROFILES } from '@/audio/profiles';
import { IMAGE_FILTERS } from './crtFilter';
import { IDLE_OPTIONS_MIN } from './idle';

type Settings = ReturnType<typeof useSettingsStore>;
type KeysOf<T> = { [K in keyof Settings]: Settings[K] extends T ? K : never }[keyof Settings] & string;
export type BoolKey = KeysOf<boolean>;
export type NumKey = KeysOf<number>;

/** A row shows only while another setting is on (`key`), or above zero for numbers. */
export type Cond = { key: BoolKey | NumKey } | { all: { key: BoolKey | NumKey }[] };

export interface ChoiceOption { id: string | number; label: string }

export type Submenu = 'protocols' | 'hidden' | 'mother' | 'permissions' | 'backup' | 'diagnostic' | 'mixUi' | 'mixAmbient' | 'mixGame';
export type ActionId = 'degauss' | 'resetPanels' | 'clearBurn' | 'bridgeButton' | 'haptics' | 'soundTest';

interface RowBase { label: string; hint: string; when?: Cond }
export type SettingRow = RowBase & (
    | { kind: 'toggle'; key: BoolKey }
    /** `fraction`: stored as 0..1, shown as 0..100. */
    | { kind: 'slider'; key: NumKey; min: number; max: number; step: number; fraction?: boolean }
    | { kind: 'choice'; key: keyof Settings & string; options: readonly ChoiceOption[] }
    | { kind: 'link'; target: Submenu }
    | { kind: 'action'; id: ActionId }
);

export interface SettingSection
{
    id: string;
    code: string;
    title: string;
    hint: string;
    rows: SettingRow[];
    /** Tube look: the page offers the hold-to-see button. */
    preview?: boolean;
    /** A section that is one submenu: the root opens it directly. */
    opens?: Submenu;
}

const CURVATURE: Cond = { key: 'curvature' };

export const SETTINGS_SECTIONS: SettingSection[] = [
    {
        id: 'phosphor', code: '01', title: 'FÓSFORO', hint: 'COLOR Y BRILLO DEL FÓSFORO', preview: true,
        rows: [
            { kind: 'choice', key: 'phosphor', label: 'COLOR', options: PHOSPHORS, hint: 'COMPUESTO DE LA PANTALLA. UN SOLO COLOR SOBRE NEGRO' },
            { kind: 'slider', key: 'bloom', label: 'BLOOM', min: 0, max: 100, step: 5, fraction: true, hint: 'HALO DE LUZ ALREDEDOR DEL TEXTO' },
            { kind: 'choice', key: 'imageFilter', label: 'FILTRO IMÁGENES', options: IMAGE_FILTERS, hint: 'CÓMO SE MUESTRAN LAS IMÁGENES IMPORTADAS' },
        ],
    },
    {
        id: 'tube', code: '02', title: 'TUBO CRT', hint: 'EFECTOS DEL TUBO DE RAYOS CATÓDICOS', preview: true,
        rows: [
            { kind: 'toggle', key: 'scanlines', label: 'SCANLINES', hint: 'LÍNEAS HORIZONTALES DEL BARRIDO' },
            { kind: 'toggle', key: 'flicker', label: 'PARPADEO', hint: 'VARIACIÓN LEVE DE BRILLO DEL TUBO' },
            { kind: 'toggle', key: 'vignette', label: 'VIÑETA', hint: 'BORDES MÁS OSCUROS QUE EL CENTRO' },
            { kind: 'toggle', key: 'sweep', label: 'BARRIDO', hint: 'BANDA DE LUZ QUE RECORRE LA PANTALLA' },
            { kind: 'toggle', key: 'curvature', label: 'CURVATURA', hint: 'CRISTAL CURVO CON MARCO NEGRO' },
            { kind: 'slider', key: 'curvatureBend', label: 'DOBLEZ', min: 0, max: 100, step: 5, when: CURVATURE, hint: 'CUÁNTO SE CURVA LA IMAGEN' },
            { kind: 'slider', key: 'curvatureCorners', label: 'ESQUINAS', min: 0, max: 100, step: 5, when: CURVATURE, hint: 'RADIO DE LAS ESQUINAS DEL CRISTAL' },
            { kind: 'slider', key: 'curvatureShade', label: 'SOMBRA', min: 0, max: 100, step: 5, when: CURVATURE, hint: 'SOMBRA INTERIOR DEL MARCO' },
            { kind: 'toggle', key: 'animText', label: 'ANIM: TEXTO', hint: 'EL TEXTO SE ESCRIBE CARÁCTER A CARÁCTER' },
            { kind: 'toggle', key: 'animTransitions', label: 'ANIM: TRANSICIONES', hint: 'BARRIDOS AL CAMBIAR DE VISTA Y ABRIR VENTANAS' },
            { kind: 'toggle', key: 'animAmbient', label: 'ANIM: AMBIENTE', hint: 'RUIDO DE SEÑAL Y DATOS EN MOVIMIENTO EN REPOSO' },
            { kind: 'toggle', key: 'tubePower', label: 'APAGADO DEL TUBO', hint: 'LA IMAGEN SE PLIEGA AL ABRIR UNA APP' },
            { kind: 'toggle', key: 'autoDegauss', label: 'DESMAGNETIZADO AUTOMÁTICO', hint: 'PULSO DE DESMAGNETIZADO CADA 20-60 MIN' },
            { kind: 'action', id: 'degauss', label: '[DESMAGNETIZAR AHORA]', hint: 'LANZA UN PULSO DE DESMAGNETIZADO' },
            { kind: 'toggle', key: 'phosphorBurn', label: 'PERSISTENCIA DE FÓSFORO', hint: 'LOS MARCOS QUEDAN MARCADOS CON EL USO' },
            { kind: 'action', id: 'clearBurn', label: '[BORRAR QUEMADURA]', when: { all: [{ key: 'phosphorBurn' }, { key: 'burnMinutes' }] }, hint: 'REGENERA EL FÓSFORO QUEMADO' },
        ],
    },
    {
        id: 'sound', code: '03', title: 'SONIDO Y TACTO', hint: 'SÍNTESIS DE AUDIO Y VIBRACIÓN',
        rows: [
            { kind: 'toggle', key: 'soundUi', label: 'SONIDO UI', hint: 'CLICS DE TECLA Y PITIDOS AL PULSAR' },
            { kind: 'toggle', key: 'soundAmbient', label: 'AMBIENTE', hint: 'ZUMBIDO DE TERMINAL Y RÁFAGAS DE DATOS' },
            { kind: 'slider', key: 'volume', label: 'VOLUMEN', min: 0, max: 100, step: 5, fraction: true, hint: 'NIVEL GENERAL DEL SINTETIZADOR' },
            { kind: 'choice', key: 'soundProfile', label: 'PERFIL', options: PROFILE_IDS.map(id => ({ id, label: PROFILES[id].label })), when: { key: 'soundUi' }, hint: 'TIMBRE DE LA INTERFAZ: TERMINAL, RELÉ, SUAVE O MÍNIMO' },
            { kind: 'slider', key: 'volumeUi', label: 'CANAL UI', min: 0, max: 100, step: 5, fraction: true, when: { key: 'soundUi' }, hint: 'NIVEL DE CLICS Y PITIDOS' },
            { kind: 'link', target: 'mixUi', label: 'SONIDOS DEL CANAL UI', when: { key: 'soundUi' }, hint: 'NIVEL DE CADA SONIDO DE LA INTERFAZ' },
            { kind: 'slider', key: 'volumeAmbient', label: 'CANAL AMBIENTE', min: 0, max: 100, step: 5, fraction: true, when: { key: 'soundAmbient' }, hint: 'NIVEL DEL ZUMBIDO DE FONDO' },
            { kind: 'link', target: 'mixAmbient', label: 'SONIDOS DEL CANAL AMBIENTE', when: { key: 'soundAmbient' }, hint: 'NIVEL DE CADA CAPA DEL AMBIENTE' },
            { kind: 'slider', key: 'volumeGame', label: 'CANAL JUEGOS', min: 0, max: 100, step: 5, fraction: true, hint: 'NIVEL DE AISLAMIENTO, MARINES Y MINIJUEGOS' },
            { kind: 'link', target: 'mixGame', label: 'SONIDOS DEL CANAL JUEGOS', hint: 'NIVEL DE CADA SONIDO DE LOS JUEGOS' },
            { kind: 'toggle', key: 'soundNotify', label: 'SONIDO DE AVISOS', when: { key: 'soundUi' }, hint: 'TONO AL LLEGAR UNA NOTIFICACIÓN' },
            { kind: 'action', id: 'soundTest', label: '[PROBAR SONIDOS]', hint: 'REPRODUCE UNA MUESTRA CON LOS AJUSTES ACTUALES' },
            { kind: 'action', id: 'haptics', label: 'VIBRACIÓN', hint: 'PULSO TÁCTIL AL TOCAR' },
        ],
    },
    {
        id: 'apps', code: '04', title: 'APPS', hint: 'LISTADO DE APLICACIONES',
        rows: [
            { kind: 'toggle', key: 'showIcons', label: 'ICONOS', hint: 'ICONO MONOCROMO JUNTO AL NOMBRE' },
            { kind: 'choice', key: 'labelCase', label: 'NOMBRES', options: [{ id: 'upper', label: 'MAYÚSCULAS' }, { id: 'normal', label: 'NORMAL' }], hint: 'CÓMO SE ESCRIBEN LOS NOMBRES DE LAS APPS' },
            { kind: 'toggle', key: 'showType', label: 'COLUMNA TIPO', hint: 'TIPO DE APP A LA DERECHA DE CADA FILA' },
            { kind: 'toggle', key: 'folderBoxes', label: 'CARPETAS EN CAJAS', hint: 'CARPETAS COMO CAJAS EN LA RAÍZ DE APPS' },
            { kind: 'choice', key: 'appsLayout', label: 'VISTA DE CAJAS', when: { key: 'folderBoxes' }, options: [{ id: 'boxes', label: 'REJILLA' }, { id: 'deck', label: 'CUBIERTAS' }], hint: 'REJILLA O PLANO DE CUBIERTAS' },
            { kind: 'link', target: 'hidden', label: 'APPS OCULTAS', hint: 'APPS QUE NO APARECEN EN EL LISTADO' },
        ],
    },
    {
        id: 'shift', code: '05', title: 'TURNO Y ALERTAS', hint: 'REPOSO, NOCHE Y AVISOS DE LA NAVE',
        rows: [
            { kind: 'choice', key: 'idleMinutes', label: 'REPOSO', options: IDLE_OPTIONS_MIN.map(m => ({ id: m, label: m ? `${m} MIN` : 'OFF' })), hint: 'RELOJ DE REPOSO TRAS ESTOS MINUTOS SIN USO' },
            { kind: 'toggle', key: 'nightShift', label: 'TURNO NOCTURNO', hint: 'FÓSFORO ROJO Y MENOS BLOOM DE 22 A 7 H' },
            { kind: 'toggle', key: 'hypersleep', label: 'HIPERSUEÑO', hint: 'CÁPSULA DE ESTASIS DE NOCHE CON ALARMA' },
            { kind: 'link', target: 'protocols', label: 'PROTOCOLOS DE TURNO', hint: 'REGLAS QUE CAMBIAN LA PANTALLA SEGÚN HORA Y ESTADO' },
            { kind: 'toggle', key: 'alertsEvent', label: 'ALERTA: EVENTO PRÓXIMO', hint: 'AVISO ANTES DE UN EVENTO DEL CALENDARIO' },
            { kind: 'toggle', key: 'alertsBattery', label: 'ALERTA: BATERÍA CRÍTICA', hint: 'AVISO CON LA BATERÍA BAJA' },
            { kind: 'toggle', key: 'alertsAlarm', label: 'ALERTA: ALARMA DE NOCHE', hint: 'DE NOCHE, AVISA CUANDO LA ALARMA ESTÁ CERCA' },
            { kind: 'toggle', key: 'alertsKlaxon', label: 'KLAXON DE ALERTA', hint: 'SIRENA AL SALTAR UNA ALERTA (CON SONIDO ACTIVO)' },
        ],
    },
    { id: 'mother', code: '06', title: 'MOTHER', hint: 'ENLACE CON MU-TH-UR', opens: 'mother', rows: [] },
    {
        id: 'system', code: '07', title: 'SISTEMA', hint: 'ARRANQUE, BARRAS Y MANTENIMIENTO',
        rows: [
            { kind: 'toggle', key: 'bootSequence', label: 'ARRANQUE', hint: 'SECUENCIA DE ARRANQUE AL INICIAR' },
            { kind: 'toggle', key: 'ownStatusBar', label: 'CONSOLA DE PUENTE', hint: 'OCULTA LA BARRA DEL SISTEMA Y DIBUJA LA CONSOLA DE LA NAVE' },
            { kind: 'slider', key: 'cameraWidth', label: 'HUECO CÁMARA', min: 0, max: 60, step: 5, when: { key: 'ownStatusBar' }, hint: 'ESPACIO LIBRE EN EL CENTRO DE LA BARRA (0 = AUTOMÁTICO)' },
            { kind: 'toggle', key: 'ticker', label: 'TELETIPO', when: { key: 'ownStatusBar' }, hint: 'CINTA DE MOTHER BAJO LA CONSOLA: SEÑALES, ALARMA, CLIMA, RESERVA' },
            { kind: 'toggle', key: 'liveWidgets', label: 'VENTANAS VIVAS', hint: 'LA VENTANA DE UNA SEÑAL, LA ALARMA O LA RESERVA BAJA CRECE UN TAMAÑO MIENTRAS PIDE ATENCIÓN' },
            { kind: 'toggle', key: 'shipPanel', label: 'PANEL: NAVE', hint: 'PANEL COMO RECORRIDO EN PRIMERA PERSONA POR LA NAVE, EN VEZ DE LA REJILLA DE VENTANAS' },
            { kind: 'choice', key: 'shipFps', label: 'RITMO DE LA NAVE', when: { key: 'shipPanel' }, options: [{ id: 'eco', label: 'AHORRO' }, { id: '30', label: '30 FPS' }, { id: '60', label: '60 FPS' }], hint: 'AHORRO REDIBUJA SOLO AL MOVERSE; 30 Y 60 ANIMAN SIEMPRE' },
            { kind: 'choice', key: 'shipStart', label: 'INICIO DE LA NAVE', when: { key: 'shipPanel' }, options: [{ id: 'bridge', label: 'PUENTE' }, { id: 'last', label: 'ÚLTIMA POSICIÓN' }], hint: 'DÓNDE TE DEJA EL BOTÓN DE INICIO: EN EL PUENTE O DONDE ESTABAS' },
            { kind: 'toggle', key: 'shipRoomSound', label: 'SONIDO POR SALA', when: { key: 'shipPanel' }, hint: 'CADA SALA ZUMBA A SU MANERA: SE OYE MÁS CERCA Y A TRAVÉS DE LAS PUERTAS ABIERTAS. NECESITA EL AMBIENTE ACTIVADO' },
            { kind: 'toggle', key: 'shipLabels', label: 'PLACAS DE NOMBRE', when: { key: 'shipPanel' }, hint: 'NOMBRE DE LA APP SOBRE CADA TRIPULANTE Y RÓTULOS EN LAS PAREDES. LAS LANZADERAS SIEMPRE LLEVAN EL SUYO' },
            { kind: 'slider', key: 'shipLook', label: 'GIRO DE LA VISTA', min: 50, max: 200, step: 10, when: { key: 'shipPanel' }, hint: 'CUÁNTO GIRA LA VISTA AL ARRASTRAR, EN POR CIENTO (100 = NORMAL)' },
            { kind: 'toggle', key: 'shipInvertY', label: 'INVERTIR EJE VERTICAL', when: { key: 'shipPanel' }, hint: 'ARRASTRAR HACIA ARRIBA MIRA HACIA ABAJO' },
            { kind: 'toggle', key: 'shipBloom', label: 'BRILLO DE LA NAVE', when: { key: 'shipPanel' }, hint: 'LÁMPARAS Y MONITORES IRRADIAN LUZ CON LA INTENSIDAD DEL BLOOM. GASTA MÁS BATERÍA' },
            { kind: 'action', id: 'bridgeButton', label: 'BOTÓN BRIDGE', hint: 'BOTÓN FLOTANTE DE BRIDGE LAUNCHER' },
            { kind: 'action', id: 'resetPanels', label: '[RESTABLECER PANELES]', hint: 'VUELVE A LOS CUATRO PANELES DE FÁBRICA' },
            { kind: 'link', target: 'permissions', label: 'PERMISOS', hint: 'ESTADO DE CADA PERMISO Y CAPACIDAD' },
            { kind: 'link', target: 'backup', label: 'RESPALDO', hint: 'EXPORTAR E IMPORTAR LA CONFIGURACIÓN' },
            { kind: 'link', target: 'diagnostic', label: 'DIAGNÓSTICO', hint: 'MÉTODOS DEL FORK DISPONIBLES EN ESTE EQUIPO' },
        ],
    },
];

export type SettingValues = Readonly<Record<string, unknown>>;

function holds(cond: Cond, values: SettingValues): boolean
{
    if ('all' in cond) return cond.all.every(c => holds(c, values));
    const v = values[cond.key];
    return typeof v === 'number' ? v > 0 : v === true;
}

/** The rows of a section that show with the current values. */
export function visibleRows(section: SettingSection, values: SettingValues): SettingRow[]
{
    return section.rows.filter(r => !r.when || holds(r.when, values));
}

export function choiceLabel(row: SettingRow & { kind: 'choice' }, value: unknown)
{
    return row.options.find(o => o.id === value)?.label ?? String(value ?? '--');
}

const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;
const count = (values: SettingValues, keys: string[]) => keys.filter(k => values[k] === true).length;
const findRow = (sectionId: string, key: string) =>
    SETTINGS_SECTIONS.find(s => s.id === sectionId)!.rows.find(r => 'key' in r && r.key === key) as SettingRow & { kind: 'choice' };

/**
 * One-line state of a section for the root menu. `values` are the settings plus `motherKey`
 * (an API key is set), which the page adds.
 */
export function summary(sectionId: string, values: SettingValues): string
{
    switch (sectionId)
    {
        case 'phosphor': return `${choiceLabel(findRow('phosphor', 'phosphor'), values.phosphor)} · ${pct(values.bloom)}`;
        case 'tube': return `${count(values, ['scanlines', 'flicker', 'vignette', 'sweep', 'curvature'])}/5 EFECTOS`;
        case 'sound': return values.soundUi || values.soundAmbient ? `${choiceLabel(findRow('sound', 'soundProfile'), values.soundProfile)} · ${pct(values.volume)}` : 'SILENCIO';
        case 'apps': return values.folderBoxes ? choiceLabel(findRow('apps', 'appsLayout'), values.appsLayout) : 'LISTA';
        case 'shift': return `${count(values, ['alertsEvent', 'alertsBattery', 'alertsAlarm'])}/3 ALERTAS`;
        case 'mother': return values.motherKey ? 'EN LÍNEA' : 'SIN CLAVE';
        default: return '';
    }
}
