/** The persona plus, when a context block is given, the live data of the phone. */
export function buildPersona(base: string, context: string | null): string
{
    if (!context) return base;
    return `${base}\nDATOS ACTUALES DE A BORDO (ÚSALOS SOLO SI LA CONSULTA LOS NECESITA):\n${context}`;
}

/** Instruction added when the model may propose actions. */
export const ACTIONS_NOTE = 'PUEDES PROPONER ACCIONES CON LAS HERRAMIENTAS DISPONIBLES (ABRIR APP, TEMPORIZADOR, NOTA, PALETA). EL USUARIO DEBE CONFIRMARLAS.';
