# Ideas para más adelante

Todo lo que había en esta lista está implementado: consola de comandos, gestos, vibración, turno nocturno, secuencia de arranque, reposo, respaldo, varios paneles, la pantalla de apps (orden, `*NUEVO`, índice A–Z, alias, vista `ls -l`, búsqueda ampliada, directorios), las mejoras de MOTHER (órdenes locales, contexto de a bordo, modelo y tokens, teletipo, informe de turno, sesiones, voz, acciones con confirmación) y los widgets nuevos (PROTOCOLO, T-MENOS, COLONIAS, FASE LUNAR, CLIMA 7 DÍAS, CRONÓMETRO, TELEMETRÍA, RUMBO, REENRUTAR).

## Pendiente de probar en el dispositivo

Nada de esto se ha probado en un teléfono real; el desarrollo se hizo con el mock del navegador.

- `getStorageStats` del fork (Kotlin añadido en `bridge-launcher`, sin compilar aún: no hay Android SDK en el equipo de desarrollo).
- **Gestos:** que deslizar a los lados cambia de pestaña (y de panel) sin romper el scroll del panel, y que bajar desde el borde superior abre las notificaciones. Los umbrales están en `src/utils/swipe.ts`.
- **VIBRACIÓN:** `navigator.vibrate` en el WebView de Bridge; si no existe, el ajuste dice `NO DISPONIBLE`.
- **RUMBO:** `deviceorientationabsolute` en el WebView; sin sensor el widget lo indica a los 3 segundos.
- **VOZ de MOTHER:** `speechSynthesis` y que haya una voz en español instalada.
- **ÍNDICE A–Z:** el arrastre sobre la tira lateral (usa `touch-action: none` solo en la tira).
- **BÚSQUEDA AMPLIADA:** contactos y atajos de apps con los permisos concedidos.
- **MOTHER con herramientas:** el formato de `tool_calls` en streaming con tu modelo.

## Pendiente tras la segunda ronda de pruebas

- **Fork de Bridge (Kotlin sin compilar):** `getStorageStats` y la voz (`getTtsAvailable`, `requestSpeak`, `requestStopSpeaking`, `requestOpenTtsSettings`, más la entrada `<queries>` del manifest). Hay que recompilar e instalar el fork; hasta entonces el almacén y la voz por Android dependen de lo que ofrezca el WebView. Los cambios están en `~/Projects/bridge-launcher` sin commitear.
- **Clima en el teléfono:** ya no hay "sin enlace" mudo: el widget muestra la causa (`HTTP 400`, `SIN RED O BLOQUEADO`...) y reintenta por el proxy de Bridge. El fallo de fondo era un bug de almacenamiento (la ciudad se guardaba como `[object Object]`).
- **Acciones de MOTHER con el modelo real:** probado con una API simulada; falta probar con tu clave.

## Decisiones a revisar

- **CONTEXTO DE A BORDO está activado por defecto:** cada consulta a MOTHER envía a la API la hora, la batería, la agenda del día, el clima y la alarma. Se puede apagar en `AJUSTES › MOTHER`, donde también se ve el texto exacto que se envía.
- **MARCA DE NUEVA:** la API de apps no da la fecha de instalación, así que el launcher guarda cuándo vio cada app por primera vez (`apps.firstSeen`). En la primera ejecución ninguna app se marca como nueva.
- **RESPALDO** no incluye la clave de MOTHER ni su historial, ni `apps.firstSeen`.

## Ideas nuevas

- **IMÁGENES**: listar la galería real con un `getImagesURL()` en el fork (MediaStore, permiso `READ_MEDIA_IMAGES`) como segunda fuente del visor,.
- **ESCÁNER**: tocar una app del radar para ver sus notificaciones.
- **DIRECTORIOS**: arrastrar una app a una carpeta en vez de usar el menú.
- **REENRUTAR**: eventos de la nave (fallo de puerta, alarma de sensores) con texto de MOTHER.
