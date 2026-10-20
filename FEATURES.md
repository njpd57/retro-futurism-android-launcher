# Ideas para más adelante

Todo lo que había en esta lista está implementado: consola de comandos, gestos, vibración, turno nocturno, secuencia de arranque, reposo, respaldo, varios paneles, la pantalla de apps (orden, `*NUEVO`, índice A–Z, alias, vista `ls -l`, búsqueda ampliada, directorios), las mejoras de MOTHER (órdenes locales, contexto de a bordo, modelo y tokens, teletipo, informe de turno, sesiones, voz, acciones con confirmación) y los widgets nuevos (PROTOCOLO, T-MENOS, COLONIAS, FASE LUNAR, CLIMA 7 DÍAS, CRONÓMETRO, TELEMETRÍA, RUMBO, REENRUTAR).

## Probado en el dispositivo

Compilado el fork de Bridge e instalado, y probado en un teléfono real:

- `getStorageStats` del fork (widget STORAGE).
- La voz por Android (`getTtsAvailable`, `requestSpeak`, `requestStopSpeaking`, `requestOpenTtsSettings` y la entrada `<queries>` del manifest).
- **Gestos:** deslizar a los lados cambia de pestaña (y de panel) y bajar desde el borde superior abre las notificaciones.
- **VIBRACIÓN**, **RUMBO** y **VOZ de MOTHER**.
- **ÍNDICE A–Z** y **BÚSQUEDA AMPLIADA** (contactos y atajos de apps).
- **MOTHER con herramientas** y sus acciones con el modelo real.
- **Clima en el teléfono.**

## Decisiones a revisar

- **CONTEXTO DE A BORDO está activado por defecto:** cada consulta a MOTHER envía a la API la hora, la batería, la agenda del día, el clima y la alarma. Se puede apagar en `AJUSTES › MOTHER`, donde también se ve el texto exacto que se envía.
- **MARCA DE NUEVA:** la API de apps no da la fecha de instalación, así que el launcher guarda cuándo vio cada app por primera vez (`apps.firstSeen`). En la primera ejecución ninguna app se marca como nueva.
- **RESPALDO** no incluye la clave de MOTHER ni su historial, ni `apps.firstSeen`.

## Ideas nuevas

- **IMÁGENES**: listar la galería real con un `getImagesURL()` en el fork (MediaStore, permiso `READ_MEDIA_IMAGES`) como segunda fuente del visor,.
- **ESCÁNER**: tocar una app del radar para ver sus notificaciones.
- **DIRECTORIOS**: arrastrar una app a una carpeta en vez de usar el menú.
- **REENRUTAR**: eventos de la nave (fallo de puerta, alarma de sensores) con texto de MOTHER.

## AISLAMIENTO (juego en pantalla propia)

Supervivencia en la Nostromo con vista subjetiva de alambre (`> aislamiento`). Plan detallado, estado y cómo retomarlo: `docs/AISLAMIENTO.md`.

- **Fase 1, prototipo** (probado en el teléfono): una cubierta (CUBIERTA C) con 3 células y la lanzadera, la criatura (oído, vista, caza, fuerza puertas), taquillas, rastreador de movimiento, caminar manteniendo pulsado, interferencia al acercarse, muerte y reintento.
- **Fase 2, supervivencia** (sin probar en el teléfono): conductos (la criatura viaja entre rejillas, el rastreador la sigue a través de las paredes, oye por los conductos y sale por la rejilla más cercana al ruido), terminales de guardado (3 s quieto mirando la pantalla), guardado automático al empezar, suspensión al salir (Atrás, Home, segundo plano) con `[CONTINUAR]`, `[CARGAR]` al morir, la criatura aprende a mirar en las taquillas que más usas, latido por vibración con la criatura al lado.

- **Fase 3, herramientas** (sin probar en el teléfono): materiales por la cubierta (chatarra, cables, químicos; 3 de cada), `[OBJETOS]` con fabricación en tiempo real (señuelo, bengala, combustible), señuelo (10 s llamando a la criatura donde cae), bengala (ilumina 4 celdas 30 s), ala este sin energía (solo se ve la celda de al lado, brillan terminales y células; la criatura te ve de lejos solo si estás iluminado), lanzallamas (alcance 3, ahuyenta a la criatura hacia los conductos y cada quemadura acorta su huida). Por ahora el lanzallamas y el material están en la CUBIERTA C para poder probarlos; pasan a la cubierta 2 cuando exista.

Fases siguientes:

4. **Campaña:** 5 cubiertas (JONES, CONDUCTOS, ASH, FALLOS, AUTODESTRUCCIÓN), el androide, fallos de la nave, cuenta atrás, registros de la tripulación, finales, pantallas de título e informe, dificultad.
5. **Infinito y extras:** cubiertas generadas con semilla, logros, estadísticas, archivo, widget en el panel, `/jugar` `/partida` `/pista` en MOTHER.
