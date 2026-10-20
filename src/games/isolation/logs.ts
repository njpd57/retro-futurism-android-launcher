/** The crew's logs, read at terminals and kept in the archive. Original texts, inspired by the film. */
export interface CrewLog
{
    id: string;
    author: string;
    title: string;
    lines: readonly string[];
}

export const LOGS: readonly CrewLog[] = [
    { id: 'c1', author: 'DALLAS', title: 'DIARIO DEL CAPITÁN', lines: [
        'DESPERTAMOS POR UNA SEÑAL, NO POR LA TIERRA.',
        'TRES SEMANAS DE DESVÍO SIN EXPLICACIÓN.',
        'LA COMPAÑÍA DICE QUE ES OBLIGATORIO.',
        'NADIE FIRMA NADA. TODOS OBEDECEN.',
    ] },
    { id: 'c2', author: 'LAMBERT', title: 'NAVEGACIÓN', lines: [
        'LA SEÑAL SE REPITE CADA 12 SEGUNDOS.',
        'NO ES UNA BALIZA DE SOCORRO.',
        'LA ESTRUCTURA ES LA DE UN AVISO.',
        'SE LO DIJE AL CAPITÁN. ME DIJO QUE DURMIERA.',
    ] },
    { id: 'c3', author: 'PARKER', title: 'MANTENIMIENTO', lines: [
        'LOS CONDUCTOS SUENAN DE NOCHE.',
        'HE SOLDADO TRES REJILLAS.',
        'A LA MAÑANA ESTABAN ABIERTAS.',
        'NO FUI YO. Y BRETT SE REÍA.',
    ] },
    { id: 'b1', author: 'BRETT', title: 'ENFERMERÍA', lines: [
        'KANE DUERME, DICEN. SU ALIENTO HUELE A ÁCIDO.',
        'DONDE CAYÓ UNA GOTA, EL SUELO SIGUE AGUJEREADO.',
        'NO ME GUSTA ESTAR SOLO EN ESTA CUBIERTA.',
        'ALGO RASCA DETRÁS DEL PANEL.',
    ] },
    { id: 'b2', author: 'RIPLEY', title: 'CUADERNO', lines: [
        'CUARENTENA. CUARENTENA. CUARENTENA.',
        'LA ESCRIBO PORQUE ES LA ÚNICA PALABRA',
        'QUE TODAVÍA NO SUENA A OPINIÓN.',
        'LA REGLA ERA LA REGLA. ALGUIEN LA ABRIÓ.',
    ] },
    { id: 'l1', author: 'SANIDAD', title: 'PARTE MÉDICO', lines: [
        'PACIENTE ESTABLE. SIN SÍNTOMAS.',
        'DEMASIADO ESTABLE.',
        'EL OFICIAL DE CIENCIAS PIDE EL HISTORIAL',
        'Y NO PIDE NINGUNA ANALÍTICA.',
    ] },
    { id: 'orden937', author: 'ASH', title: 'REGISTRO PERSONAL', lines: [
        'ORDEN ESPECIAL 937.',
        'ASEGURAR LA ENTIDAD. PRIORIDAD UNO.',
        'LA TRIPULACIÓN ES PRESCINDIBLE.',
        'NO SIENTO NADA AL ESCRIBIRLO.',
        'ESO, SUPONGO, ES LA RESPUESTA.',
    ] },
    { id: 'l3', author: 'MOTHER', title: 'ARCHIVO CERRADO', lines: [
        'ACCESO RESTRINGIDO. NIVEL COMPAÑÍA.',
        'LA INSTRUCCIÓN FUE ANTERIOR AL VIAJE.',
        'NO PUEDO DESOBEDECERLA.',
        'SÍ PUEDO NO COMENTARLA.',
    ] },
    { id: 'm1', author: 'PARKER', title: 'TURNO DE NOCHE', lines: [
        'EL VAPOR SE ESCAPA POR LOS CODOS DE LA CUBIERTA D.',
        'LA COMPAÑÍA NO PAGA POR ARREGLARLO.',
        'TAMPOCO PAGA POR MORIR AQUÍ.',
        'HAY QUE CRUZAR CUANDO CALLA EL SILBIDO.',
    ] },
    { id: 'm2', author: 'SISTEMAS', title: 'DESVÍO DE ENERGÍA', lines: [
        'LAS PUERTAS DEL PUENTE DE CARGA ESTÁN SIN ENERGÍA.',
        'EL PANEL DEL TALLER PUEDE DESVIARLA.',
        'AVISO: EL DESVÍO TARDA TRES SEGUNDOS.',
        'LA CRIATURA OYE LOS TERMINALES.',
    ] },
    { id: 'h1', author: 'RIPLEY', title: 'ÚLTIMO REGISTRO', lines: [
        'LA AUTODESTRUCCIÓN ESTÁ ARMADA.',
        'CINCO MINUTOS. LA LANZADERA ESTÁ AL FONDO.',
        'SI ESTO LO LEE ALGUIEN:',
        'NO BUSQUE LA SEÑAL. LA SEÑAL ES EL CEBO.',
    ] },
    { id: 'h2', author: 'JONES', title: 'REGISTRO DE AUDIO', lines: [
        'DURACIÓN: 4 SEGUNDOS.',
        'CONTENIDO: UN MAULLIDO.',
        'ES EL ÚNICO REGISTRO DE LA NAVE',
        'QUE NO CONTIENE UNA MENTIRA.',
    ] },
];

export const logOf = (id: string): CrewLog | undefined => LOGS.find(l => l.id === id);

export type Ending = 'jones' | 'solo' | 'blast';

export interface EndingDef
{
    title: string;
    lines: readonly string[];
}

export const ENDINGS: Record<Ending, EndingDef> = {
    jones: { title: 'LA NARCISSUS · JONES A SALVO', lines: [
        'DESPEGUE CONFIRMADO. LA NOSTROMO SE APAGA TRAS USTED.',
        'EL GATO RONRONEA EN LA CABINA. EL ORGANISMO NO ESTÁ.',
        'MOTHER YA NO ESTÁ TAMPOCO.',
        '',
        'HIBERNACIÓN EN CURSO. TRIPULACIÓN: 1. GATO: 1.',
        'RUMBO: LA TIERRA. AÚN NO SABE QUE HAY ALGO MÁS.',
    ] },
    solo: { title: 'LA NARCISSUS · SOLA', lines: [
        'DESPEGUE CONFIRMADO. LA NOSTROMO SE APAGA TRAS USTED.',
        'LA CABINA ESTÁ EN SILENCIO. DEMASIADO SILENCIO.',
        'ALGO HABRÍA QUE HABER DEJADO EN LA NAVE.',
        '',
        'HIBERNACIÓN EN CURSO. TRIPULACIÓN: 1.',
        'RUMBO: LA TIERRA. NADIE LA ESPERA.',
    ] },
    blast: { title: 'AUTODESTRUCCIÓN COMPLETADA', lines: [
        'CUENTA ATRÁS FINALIZADA.',
        'LA NOSTROMO HA DEJADO DE EXISTIR.',
        'LA COMPAÑÍA ENVIARÁ OTRA NAVE.',
        'LA COMPAÑÍA SIEMPRE ENVÍA OTRA NAVE.',
    ] },
};
