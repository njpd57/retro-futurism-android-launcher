# Retro-futurism Android launcher

Una pantalla de inicio para Android que parece la terminal CRT de una nave espacial, al estilo de los ordenadores de *Alien* y *Alien: Isolation*: texto de fósforo con bloom, scanlines, ventanas en vídeo inverso y una computadora de a bordo llamada MOTHER.

Es una página web (Vue 3, TypeScript y Vite) que funciona como pantalla de inicio de [Bridge Launcher](https://github.com/bridgelauncher/launcher), una app de Android que muestra una página web como home y le da acceso a funciones del sistema a través de `window.Bridge`. No hay código nativo de Android en este repositorio. Usa nuestro [fork de Bridge](https://github.com/njpd57/bridge-launcher), que añade notificaciones, reproductor, calendario, contactos, uso de apps y más.

## El launcher

Tres pestañas en la barra superior:

- **PANEL:** un escritorio de ventanas retro. Con **EDITAR** (botonera de abajo) se añaden, quitan, minimizan y reordenan. Ventanas disponibles:
  - **Sistema:** reloj y uptime, batería, red, almacén, uso de apps (tiempo de pantalla), log y osciloscopio animado.
  - **Apps y personas:** favoritas, recientes y contactos favoritos.
  - **Organización:** notas con tareas, agenda, temporizador, alarma y clima.
  - **Ocio:** reproductor y radar ASCII.
  - **Tiempo:** PROTOCOLO (checklist diario que se reinicia a medianoche), T-MENOS (cuenta atrás a una fecha), COLONIAS (reloj mundial), FASE LUNAR (calculada sin red), CLIMA 7 DÍAS, y el temporizador con modo CRONO y vueltas.
  - **Sensores y red:** TELEMETRÍA (latencia a un host con su historial) y RUMBO (brújula ASCII).
  - **Juegos:** DETECTOR (detector de movimiento: sella la puerta donde aparezca el blip), REENRUTAR (reparte la energía entre PUERTAS, SOPORTE VITAL y SENSORES) NOSTROMO (aventura de texto para escapar de la nave) y MARINES (acceso al juego de acción, con récords, campaña y logros). El juego completo se abre también con `> marines`: oleadas sin fin en cuatro mapas o campaña de cuatro misiones (la última, contra la reina, a oscuras), con torretas, soldador de puertas y tres dificultades. AISLAMIENTO (acceso al juego de supervivencia, con partida, registros y logros). Se abre también con `> aislamiento` o `/jugar` en MOTHER: campaña de cinco cubiertas de la Nostromo (movimiento libre: joystick para caminar, arrastre sobre la vista para girar; un empuje suave es sigilo) (el organismo, el androide Ash, fugas de vapor, apagones y una cuenta atrás de autodestrucción), 12 registros de la tripulación, tres finales, tres dificultades y un modo infinito de sectores generados que se abre al terminar la campaña. `/partida` y `/pista` en el chat de MOTHER te dicen cómo vas y qué hacer, sin usar la API.
  - **Ayudante:** el resumen de MOTHER, que el primer día de cada jornada muestra el informe de turno (agenda, clima y alarma).
  - **Varios paneles:** `P1`..`P4` (en EDITAR, `[+P]` y `[-P]`); se cambia con las pestañas o deslizando.
- **APPS:** la lista de apps (toca para abrir, mantén para opciones: atajos, fijar, renombrar, mover a una carpeta, ocultar) con búsqueda en el prompt, que también busca por alias, contactos y atajos, y ofrece `[BUSCAR EN RED]`. Se ordena por nombre, uso de hoy o instalación reciente; `*NUEVO` marca las apps de los últimos 7 días; la tira A–Z salta por letra; `[LS -L]` muestra columnas de uso y tipo; las carpetas son cajas en la raíz (con contador y barra de uso; también `FAVORITAS`, `RECIENTES` y `NUEVAS`), se tocan para entrar y el botón atrás sale; las apps sin carpeta quedan debajo (`CARPETAS EN CAJAS: NO` devuelve el acordeón). Opcionalmente con iconos monocromos teñidos del color del fósforo.
- **MOTHER:** una terminal de chat con OpenAI al estilo de la computadora de *Alien*: respuestas en mayúsculas y tono de nave. `ESTADO`, `INFORME` y `ORDEN ESPECIAL 937` se contestan sin red. MOTHER puede proponer acciones (abrir una app, temporizador, nota, paleta) que solo se ejecutan con `[EJECUTAR]`. Las conversaciones se guardan como sesiones y se pueden exportar como texto.

### Consola de comandos y gestos

- **Consola:** en el prompt, `>` seguido de una orden: `> abrir <app>`, `> calc 2+2`, `> tema verde`, `> clima`, `> nota <texto>`, `> ayuda`.
- **Gestos:** deslizar a los lados cambia de panel y de pestaña; deslizar hacia abajo desde el borde superior abre las notificaciones. El contador `!N` de la barra superior muestra las notificaciones pendientes.
- **Reposo:** tras N minutos sin tocar, un reloj grande que se desplaza (anti-quemado). **Arranque:** secuencia de boot saltable con un toque. **Turno nocturno:** de 22:00 a 07:00 pasa a fósforo rojo con menos bloom. **Vibración:** pulso háptico al pulsar. Todo opcional en los ajustes.
- **Ayuda al escribir:** en la pestaña MOTHER, chips con atajos, el resto de la orden en gris mientras escribes y un botón `[TAB]` (o la tecla Tab) que la rellena. Órdenes locales con `/`: `/temp 5`, `/nota`, `/tema`, `/abrir`, `/sesiones`, `/nueva`, `/borrar`, `/ayuda`. En el prompt de APPS también: `> orden uso`, `> lista larga`.
- **MOTHER ordena tus apps:** `> mother agrupa por tipo`, el botón `[MOTHER]` de la lista o `/ordenar ...`. Solo se envían a la API los nombres de las apps (numerados), con vista previa, `[APLICAR]` y `[DESHACER]`.
- **Preguntar a MOTHER:** al escribir en el prompt de APPS, junto a `[BUSCAR EN RED]` aparece `[PREGUNTAR A MOTHER]`, que envía el texto al chat.
- **Visor de imágenes:** `> imagenes` o el botón `[IMÁGENES]` de la lista. `[IMPORTAR]` abre el selector de Android; las fotos se reducen a 1280 px y se guardan en el teléfono (IndexedDB, fuera del respaldo). Se ven con filtro CRT (sin scanlines propias, las pone la pantalla): `FÓSFORO` (monocromo con la paleta activa, por defecto), `CRT COLOR` u `ORIGINAL` (ciclo con `[FILTRO]` o en los ajustes). Pasa de una a otra con `[«]` `[»]` o deslizando; `[BORRAR]` pide un segundo toque. También hay un widget `IMÁGENES` para el panel (editar › añadir): muestra la imagen con el filtro, `[«]` `[»]` cambian de una a otra y tocarla abre el visor.
- **Permisos:** `AJUSTES › PERMISOS` muestra qué falta (notificaciones, calendario, contactos, uso de apps, voz...) y dónde concederlo.
- **Respaldo:** `AJUSTES › RESPALDO` exporta e importa ajustes, paneles, notas y favoritos como texto JSON (sin la clave de MOTHER).

### Apariencia y sonido

- **Fósforo:** ámbar, verde, blanco P4, azul o rojo.
- **Efectos de pantalla**, todos opcionales: bloom, scanlines, viñeta, parpadeo, banda de barrido y curvatura (aproximada con CSS, sin desplazar los toques). Se desactivan o se congelan con `prefers-reduced-motion`.
- **Sonido**, apagado por defecto: clics de teclado, pitidos de selección y un zumbido de terminal con chirridos de datos, todo sintetizado con Web Audio (sin archivos de audio). Con ajuste de volumen.

Los ajustes se abren tocando la fecha o la hora, o con la tecla **AJUSTES**. Ideas pendientes en [FEATURES.md](FEATURES.md); guía técnica de Bridge en [BRIDGE_LAUNCHER_GUIDE.md](BRIDGE_LAUNCHER_GUIDE.md); notas para quien programe (incluida la dirección artística) en [CLAUDE.md](CLAUDE.md).

### Permisos y configuración

Casi todo funciona sin permisos; estas partes los necesitan (y usan el fork de Bridge). Todas muestran un botón `CONCEDER` o un aviso cuando falta el permiso:

- **Notificaciones y reproductor:** en Ajustes de Android, dar a Bridge el acceso a notificaciones. El panel de notificaciones y el widget REPRODUCTOR lo piden con un botón.
- **Agenda:** permiso de calendario.
- **Contactos:** permiso de contactos (widget CONTACTOS). Tocar un contacto abre el marcador con el número escrito; nunca llama directamente.
- **Uso de apps:** acceso de uso en Ajustes de Android (widget USO).
- **Atajos de apps:** solo aparecen en el menú de una app si Bridge es el launcher por defecto.
- **Almacén:** requiere una versión del fork con `getStorageStats`; si no, el widget indica que no está disponible.
- **Barra de estado propia:** `AJUSTES › BARRA PROPIA` oculta la barra de Android y dibuja una estilo terminal; al tocarla se abre el panel de notificaciones.
- **Clima:** en el widget ALARMA · CLIMA, elige una ciudad (Open-Meteo, sin clave).
- **MOTHER:** `AJUSTES › MOTHER` para escribir tu clave de API de OpenAI y elegir el modelo. La clave se guarda solo en el teléfono, nunca en el repositorio ni en el build. **Ojo:** el contexto de a bordo está activado por defecto y envía a la API la hora, la batería, la agenda del día, el clima y la alarma con cada consulta; se apaga en ese mismo menú, que muestra el texto exacto que se envía.
- **Vibración, rumbo y voz:** dependen de APIs del WebView; si el dispositivo no las tiene, el ajuste o el widget dice `NO DISPONIBLE`.
- **Diagnóstico:** `AJUSTES › DIAGNÓSTICO` muestra qué métodos del fork tiene el Bridge instalado.

## Cómo está hecho

- **Stores de Pinia** que escuchan los eventos de Bridge: apps instaladas, márgenes del sistema, ajustes de Bridge, batería y red, notificaciones, reproductor, calendario, contactos, uso de apps, alarma, clima, MOTHER y sonido. Los que usan métodos del fork se protegen con `bridgeHas()` y, si falta el método, muestran un estado vacío.
- **Mock de Bridge** para desarrollar en el navegador, con apps e iconos de ejemplo en `public/mock/` y datos falsos para los métodos del fork.
- **Lógica pura con tests** (búsqueda y orden de apps, paneles, comandos, gestos, respaldo, carpetas, radar, temporizador y cronómetro, clima, luna, brújula, MOTHER y los tres juegos).
- **Estilos**: paletas de fósforo como variables CSS (`src/assets/styles/crt.scss`), tipografía VT323 y mixins de brillo y vídeo inverso.

## Desarrollo

Requiere Node 18 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo con el mock de Bridge
npm run build        # revisión de tipos + build en dist/
npm run type-check   # solo la revisión de tipos
npm run deploy       # build + copia dist/ al teléfono por adb
npm run test:unit    # tests con Vitest (en modo watch)
```

En el navegador, `window.Bridge` es un mock: las apps salen de `public/mock/apps.json` y acciones como abrir una app muestran un `alert`.

## Probarlo en el teléfono

1. `npm run build`.
2. Copia el contenido de `dist/` a una carpeta del teléfono.
3. En Bridge, elige esa carpeta como *project dir*.

`npm run deploy` hace los pasos 1 y 2 por adb en `/sdcard/projects/crt-launcher` (otra carpeta con `REMOTE_DIR=... npm run deploy`); en Bridge elige esa carpeta una sola vez.

Los archivos del build tienen nombres fijos (`assets/index.js`), así que para actualizar basta con copiar el nuevo `dist/` encima del anterior.

## Enlaces

- [Bridge Launcher](https://github.com/bridgelauncher/launcher)
- [Tipos de la API de Bridge](https://github.com/bridgelauncher/api)
- [api-tester original](https://github.com/bridgelauncher/api-tester), de donde partió el proyecto
- [Fork de Bridge](https://github.com/njpd57/bridge-launcher)

## Licencia

MIT, ver [LICENSE](LICENSE).
