# Bridge Launcher Boilerplate

Punto de partida para crear launchers como proyecto web para [Bridge Launcher](https://github.com/bridgelauncher/launcher).

Bridge es una app de Android que usa una página web como pantalla de inicio y le da acceso a funciones del sistema (lista de apps, abrir apps, fondo de pantalla, barras del sistema…) a través de `window.Bridge`. Este repositorio es esa página web: Vue 3, TypeScript y Vite, sin código nativo de Android.

Esta rama parte del [api-tester](https://github.com/bridgelauncher/api-tester) oficial de Bridge, limpiado: quedan la conexión con Bridge (stores, eventos, mock para desarrollo) y sobre ella el launcher.

## El launcher

Un launcher estilo terminal CRT con tres pestañas en la barra superior:

- **PANEL:** un escritorio de ventanas retro (reloj y uptime, batería, red, osciloscopio animado, favoritas, recientes, log, notas con tareas, agenda, reproductor, alarma y clima, y el resumen de MOTHER). Con **EDITAR** (botonera de abajo) se añaden, quitan, minimizan y reordenan.
- **APPS:** la lista de apps (toca para abrir, mantén para opciones y fijar) con búsqueda en el prompt.
- **MOTHER:** una terminal de chat con OpenAI al estilo de la computadora de *Alien*: respuestas en mayúsculas y tono de nave.

Fósforo **ámbar** o **verde**, con bloom, scanlines, viñeta y parpadeo configurables. Los ajustes se abren tocando la fecha o la hora, o con la tecla **AJUSTES**. Ideas pendientes en [FEATURES.md](FEATURES.md); guía técnica de Bridge en [BRIDGE_LAUNCHER_GUIDE.md](BRIDGE_LAUNCHER_GUIDE.md).

### Permisos y configuración

Casi todo funciona sin permisos; estas partes los necesitan (y usan el fork de Bridge):

- **Notificaciones y reproductor:** en Ajustes de Android, dar a Bridge el acceso a notificaciones. El panel de notificaciones y el widget REPRODUCTOR lo piden con un botón.
- **Agenda:** permiso de calendario (botón `CONCEDER` en el widget).
- **Barra de estado propia:** `AJUSTES › BARRA PROPIA` oculta la barra de Android y dibuja una estilo terminal; al tocarla se abre el panel de notificaciones.
- **Clima:** en el widget ALARMA · CLIMA, elige una ciudad (Open-Meteo, sin clave).
- **MOTHER:** `AJUSTES › MOTHER` para escribir tu clave de API de OpenAI y el modelo. La clave se guarda solo en el teléfono, nunca en el repositorio ni en el build.
- **Diagnóstico:** `AJUSTES › DIAGNÓSTICO` muestra qué métodos del fork tiene el Bridge instalado.

## Qué incluye

- **Stores de Pinia** que ya escuchan los eventos de Bridge:
  - `useAppsStore`: apps instaladas (se actualiza al instalar, cambiar o desinstalar una app).
  - `useWindowInsetsStore`: márgenes de las barras del sistema, el teclado, el notch, etc.
  - `useTogglesStore`: ajustes de Bridge (botón flotante, fondo del sistema, modo noche, tema, apariencia de las barras…) como propiedades que se leen y se escriben.
  - `useBridgeEventStore`: reparte los eventos de Bridge a quien se suscriba.
- **Mock de Bridge** para desarrollar en el navegador, con apps e iconos de ejemplo en `public/mock/`.
- **Estilos base**: fondo negro, texto blanco, tipografía Droid Sans y las variables de duración y curvas de animación en `src/assets/styles/shared/vars.scss`.

## Desarrollo

Requiere Node 18 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo con el mock de Bridge
npm run build        # revisión de tipos + build en dist/
npm run type-check   # solo la revisión de tipos
npm run deploy       # build + copia dist/ al teléfono por adb
npm run test:unit    # tests con Vitest
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
- [api-tester original](https://github.com/bridgelauncher/api-tester)

## Licencia

MIT, ver [LICENSE](LICENSE).
