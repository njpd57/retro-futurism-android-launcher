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
  - **Juegos:** DETECTOR (detector de movimiento: sella la puerta donde aparezca el blip) y NOSTROMO (aventura de texto para escapar de la nave).
  - **Ayudante:** el resumen de MOTHER.
- **APPS:** la lista de apps (toca para abrir, mantén para opciones, fijar y los atajos de la app) con búsqueda en el prompt. Opcionalmente con iconos monocromos teñidos del color del fósforo.
- **MOTHER:** una terminal de chat con OpenAI al estilo de la computadora de *Alien*: respuestas en mayúsculas y tono de nave.

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
- **MOTHER:** `AJUSTES › MOTHER` para escribir tu clave de API de OpenAI y el modelo. La clave se guarda solo en el teléfono, nunca en el repositorio ni en el build.
- **Diagnóstico:** `AJUSTES › DIAGNÓSTICO` muestra qué métodos del fork tiene el Bridge instalado.

## Cómo está hecho

- **Stores de Pinia** que escuchan los eventos de Bridge: apps instaladas, márgenes del sistema, ajustes de Bridge, batería y red, notificaciones, reproductor, calendario, contactos, uso de apps, alarma, clima, MOTHER y sonido. Los que usan métodos del fork se protegen con `bridgeHas()` y, si falta el método, muestran un estado vacío.
- **Mock de Bridge** para desarrollar en el navegador, con apps e iconos de ejemplo en `public/mock/` y datos falsos para los métodos del fork.
- **Lógica pura con tests** (búsqueda de apps, diseño del panel, radar, temporizador, uso de apps, y los dos juegos).
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
