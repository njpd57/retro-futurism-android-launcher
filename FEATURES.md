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

### Hecho, sin probar en el teléfono

- **ESCÁNER**: el radar tiene un contacto por app (con `@` / `O` cuando tiene 3 o más señales) y al tocarlo lista sus notificaciones, cada una con ABRIR / NEUTRALIZAR / sus botones, y `NEUTRALIZAR TODAS`. Lógica en `radarContacts` (`utils/radar.ts`).
- **DIRECTORIOS**: con las cajas de carpetas a la vista, mantener pulsada una app la levanta (vibración corta); si se arrastra, se suelta sobre una caja de carpeta, o sobre `[+ NUEVA CARPETA]` abajo, que abre el menú de carpeta para ponerle nombre. La lista se desplaza sola cerca de los bordes. Si se suelta sin mover, abre el menú de siempre (ahora **al soltar**, no a los 500 ms). Lógica en `utils/dragDrop.ts`, gesto táctil en `useRowDrag`.
- **REENRUTAR**: tres incidentes aleatorios cada vez más seguidos (`FALLO DE PUERTA` quita un 25 % a PUERTAS sin matar, `ALARMA DE SENSORES` duplica lo que pide SENSORES 8 s, `FUGA` desangra SOPORTE VITAL 10 s), con texto de MOTHER, marcas `[ALARMA]` / `[FUGA]` y sonido.

### Widgets redimensionables y paneles por defecto (hecho, sin probar en el teléfono)

- **TAMAÑOS**: en el modo edición, `◢` rota el tamaño de la ventana entre los que admite (1×1, 2×1, 1×2, 2×2). La cuadrícula tiene filas de altura fija y el contenido se adapta con `@container`.
- **PANELES POR DEFECTO**: cuatro páginas (PUENTE, COMUNICACIONES, ENTORNO, RECREO) con casi todos los widgets. Los diseños guardados se conservan; `[RESTABLECER PANELES]` en ajustes carga los nuevos (con confirmación).
- **RADAR, FASE LUNAR y RUMBO en SVG**: barrido con estela de fósforo, disco con la cara oscura rayada y rosa de los vientos que gira, sin perder el estilo CRT (trazos con `--ph`, brillo con `--bloom`).

### El tubo (hecho, sin probar en el teléfono)

- **DESMAGNETIZAR**: orden `> desmagnetizar` (alias `desmag`, `degauss`), automático al cambiar de fósforo y, con `settings.autoDegauss`, cada 20–60 min de pantalla visible (`utils/degauss.ts`) (también desde la consola o MOTHER). Filtro SVG propio `#crt-degauss` con oscilación amortiguada de ~600 ms, destello de brillo y el sonido `thunk`. Quieto con `prefers-reduced-motion`.
- **APAGADO DEL TUBO** (`settings.tubePower`): al abrir una app la imagen se pliega a una línea y a un punto (~0,4 s) y solo entonces se lanza la app (`useTubeStore.collapseThen`, desde `useLaunchStore`); al volver (`afterResume` o `visibilitychange`) se enciende con un destello. Al bloquear la pantalla no se ve el apagado (`beforePause` llega cuando ya se va), solo el encendido.
- **PERSISTENCIA DE FÓSFORO** (`settings.phosphorBurn`, apagada por defecto): cuenta los minutos con la pantalla visible y dibuja, como máximo al 3 %, dos líneas fantasma en el hueco oscuro bajo la barra superior y sobre las teclas, nunca sobre texto. `[BORRAR QUEMADURA]` la pone a cero.

### Widgets y modos (hecho, sin probar en el teléfono)

- **UNIDAD DE CINTA**: `PIEL: ESTÁNDAR / CINTA` al pie del widget REPRODUCTOR (por instancia, `widget.media.<id>.skin`). Dos bobinas `( | )` que giran por pasos de 250 ms unidas por la cinta `═─`, `UNIDAD DE CINTA 02 · REPRODUCIENDO`, el contador `0347 / 1200`, la barra y `[◀◀] [▶] [▶▶]` (`[▶]` queda hundida mientras suena y al pulsarla pausa). Quieta con `prefers-reduced-motion` y en `beforePause`. Lógica en `utils/media.ts`, componente `TapeDeck`.
- **HIPERSUEÑO** (`settings.hypersleep`, activado): de noche (22–7 h) y con una alarma en las próximas 14 h, el reposo es `StasisPod`: `TRIPULANTE EN ESTASIS`, cuenta atrás hasta la alarma, pulso 42–48 con un trazo `▁▃▅█` que se desplaza, respiración y temperatura de la cápsula bajando de 37 a 4 °C. Las constantes son simuladas. `> estasis` la muestra al momento para verla sin esperar a la noche. Lógica en `utils/stasis.ts`.
- **MAPA DE CUBIERTAS** (`settings.appsLayout`, `VISTA DE CAJAS` en ajustes): las cajas de carpetas se dibujan como compartimentos a los lados de un pasillo (doble línea). FAVORITAS, RECIENTES y NUEVAS pasan a llamarse `PUENTE`, `BITÁCORA` y `HANGAR`. Al tocar una sala la puerta se abre `▓▓▓ → ▓▓░ → ▓░░ → ░░░` y se entra. También acepta soltar apps encima. Los bordes son de CSS y solo las puertas usan glifos de bloque: VT323 solo trae el subconjunto latino y los caracteres de dibujo de cajas caen en otra fuente y no alinean.

### Pendiente de HIPERSUEÑO

- **Health Connect** (fork): si el fork expone un `getHealthSummary()` nuevo en Kotlin con `READ_HEART_RATE`, `READ_SLEEP`, `READ_STEPS` y su flujo de permisos (declararlo en `bridge-fork.d.ts`, el mock y `bridgeHas()`), la cápsula mostraría el último pulso registrado y, al despertar, un parte tipo `CICLO DE ESTASIS: 7H12 · SUEÑO PROFUNDO 1H40`. Health Connect no es en vivo (depende de cuándo sincroniza el reloj) y sin reloj o pulsera apenas hay pulso. Los datos de salud se quedan en el teléfono: no entran en el contexto que se envía a MOTHER.

### Control de la nave

- **PANEL DE SISTEMAS** (M, fork): widget y pantalla para controlar el teléfono sin salir del launcher: `LINTERNA [X]`, `VOLUMEN ▓▓▓░░`, `BRILLO ▓▓░░░`, `NO MOLESTAR [ ]`, `ROTACIÓN [X]` y accesos a los ajustes de Wi‑Fi, Bluetooth y datos. Linterna (`CameraManager.setTorchMode`) y volumen (`AudioManager`) no piden permiso; brillo (`WRITE_SETTINGS`) y No molestar (`ACCESS_NOTIFICATION_POLICY`) sí, y se añaden a `PERMISOS`.
- **ENLACES PERIFÉRICOS** (S‑M, fork): dispositivos Bluetooth conectados con su batería (`AURICULARES ··· ▓▓▓▓░ 80%`, `RELOJ ··· ENLACE PERDIDO`). Al conectar o desconectar, un chirrido de datos y una línea en el LOG.

### Protocolos automáticos

- **PROTOCOLOS DE TURNO** (L, sin fork al principio): motor de reglas puro y testeado. *Si* hora / cargando / Wi‑Fi X / auriculares / batería < N, *entonces* cambia de panel (P1..P4), de fósforo o de apps visibles, o activa el turno nocturno. Ejemplos: `ATRACADO` (cargando de noche: reloj grande, fósforo rojo), `EN TRÁNSITO` (auriculares: panel con MEDIA), `JORNADA` (laborables de 9 a 18: oculta juegos).
- **SISTEMA DE ALERTAS DE A BORDO** (M, sin fork): avisos proactivos dentro del launcher (`EVENTO EN 10 MIN`, `BATERÍA CRÍTICA`, `ALARMA EN 6H — RECOMIENDO REPOSO`) como franja en video inverso con parpadeo `steps()` y klaxon opcional; cada tipo se activa por separado y MOTHER redacta el texto. Comparte motor con PROTOCOLOS DE TURNO.
- **RECORDATORIOS** (M, fork): `> recordar 18:30 comprar pan` o `/recordar` en MOTHER, programado con `AlarmManager` en el fork para que avise aunque el launcher no esté en pantalla.

### Bienestar digital

- **CUARENTENA** (M, sin fork): apps marcadas como "contaminadas". Abrir una pide `AUTORIZACIÓN REQUERIDA · MOTIVO:` con una cuenta atrás de 10 s y un presupuesto diario sacado de `useUsageStore` (`INSTAGRAM 34/30 MIN — EXCEDIDO`).
- **INFORME DE TURNO SEMANAL** (S, sin fork): tendencia de uso, desbloqueos y apps nuevas con sparklines `▁▂▃▅`, comparado con la semana anterior; MOTHER puede comentarlo.

### Comunicaciones

- **ENLACE DE COMUNICACIONES** (M, fork para diferir): historial local de notificaciones agrupado por conversación y con búsqueda (hoy se pierden al descartarlas), `[DIFERIR 1H]` con `snoozeNotification` en el fork y un resumen opcional de MOTHER (`3 MENSAJES DE MAMÁ, 1 REQUIERE RESPUESTA`). El texto de las notificaciones solo se envía a la API si se activa, y se muestra como el contexto de a bordo.
- **INTERFAZ VOCAL** (M‑L, fork): mantener pulsado para hablarle a MOTHER o al `>` ("abre Spotify", "linterna"), con `SpeechRecognizer` en el fork (permiso `RECORD_AUDIO`; el WebView no trae reconocimiento de voz). Con la voz de salida que ya existe, queda una conversación completa.

## AISLAMIENTO (juego en pantalla propia)

Supervivencia en la Nostromo con vista subjetiva de alambre (`> aislamiento`). Plan detallado, estado y cómo retomarlo: `docs/AISLAMIENTO.md`.

- **Fase 1, prototipo** (probado en el teléfono): una cubierta (CUBIERTA C) con 3 células y la lanzadera, la criatura (oído, vista, caza, fuerza puertas), taquillas, rastreador de movimiento, caminar manteniendo pulsado, interferencia al acercarse, muerte y reintento.
- **Fase 2, supervivencia** (sin probar en el teléfono): conductos (la criatura viaja entre rejillas, el rastreador la sigue a través de las paredes, oye por los conductos y sale por la rejilla más cercana al ruido), terminales de guardado (3 s quieto mirando la pantalla), guardado automático al empezar, suspensión al salir (Atrás, Home, segundo plano) con `[CONTINUAR]`, `[CARGAR]` al morir, la criatura aprende a mirar en las taquillas que más usas, latido por vibración con la criatura al lado.

- **Fase 3, herramientas** (sin probar en el teléfono): materiales por la cubierta (chatarra, cables, químicos; 3 de cada), `[OBJETOS]` con fabricación en tiempo real (señuelo, bengala, combustible), señuelo (10 s llamando a la criatura donde cae), bengala (ilumina 4 celdas 30 s), ala este sin energía (solo se ve la celda de al lado, brillan terminales y células; la criatura te ve de lejos solo si estás iluminado), lanzallamas (alcance 3, ahuyenta a la criatura hacia los conductos y cada quemadura acorta su huida). Por ahora el lanzallamas y el material están en la CUBIERTA C para poder probarlos; pasan a la cubierta 2 cuando exista.

- **Fase 4, campaña** (hecha, sin probar en el teléfono): cinco cubiertas en orden (C tutorial; B · CONDUCTOS a oscuras, con el lanzallamas; LABORATORIO · ASH con el androide, que no oye, no se frena con fuego y se apaga desde un terminal o tras una puerta cerrada; MANTENIMIENTO · FALLOS con fugas de vapor, apagones por zonas y una puerta sin energía que se abre desviándola desde un panel; HANGAR · AUTODESTRUCCIÓN con cuenta atrás de 5 minutos y a Jones, el gato), 12 registros de la tripulación que se leen en los terminales, tres finales (con Jones, sola, la explosión), pantallas de título, dificultad, misión e informe, plano de la cubierta descargable desde un terminal y tres dificultades (FÁCIL regala señuelo y bengala por cubierta y frena a la criatura).
- **Movimiento libre** (hecho y probado en el teléfono): jugador, criatura y Ash con posición continua en mapas escalados 2×2, joystick y arrastre para girar como MARINES. Plan y notas: `docs/AISLAMIENTO_LIBRE.md`.
- **Fase 5, infinito y extras** (hecha, sin probar en el teléfono): modo infinito con sectores generados por semilla (se abre al terminar la campaña; cada sector añade oscuridad, vapor, Ash, apagones), 10 logros, estadísticas, `[ARCHIVO]` con los registros, widget AISLAMIENTO en el panel y `/jugar` `/partida` `/pista` en el chat de MOTHER (sin API).

Ideas para más adelante: un segundo organismo en los sectores profundos, registros que cambien con la dificultad, una semilla del día compartida.

## MARINES (juego de acción en pantalla propia)

Acción estilo *Aliens: Colonial Marines* en LV-426 con vista subjetiva de alambre (`> marines`). Plan detallado, estado y cómo retomarlo: `docs/MARINES.md`.

- **Fase 0, motor compartido** (hecha): cámara, geometría del nivel, oclusión por columnas y dibujado sacados de AISLAMIENTO a `src/games/wire/`; su salida no ha cambiado.
- **Fase 1, prototipo** (sin probar en el teléfono): arena OPERACIONES, movimiento libre con joystick analógico, arrastre para apuntar y FUEGO mantenido, rifle de pulsos con contador y recarga, zánganos que rodean los obstáculos y golpean con preaviso, salud y blindaje, rastreador de movimiento, oleadas sin fin con puntuación y récord, pausa con sensibilidad y FPS.
- **Fase 2, escuadra y arsenal** (hecha, sin probar en el teléfono): 2 marines con biomonitor y órdenes SEGUIR / QUIETOS, lanzagranadas, sangre ácida, corredores y abrazacaras, escopeta, smartgun y lanzallamas.
- **Fase 3, ÚLTIMA DEFENSA completa** (hecha, sin probar en el teléfono): torretas centinela, soldador de puertas, escupidores, suspensión al salir con `[CONTINUAR]`, informe y récords por mapa, HANGAR y CONDUCTOS.
- **Fase 4, campaña** (hecha, sin probar): tres misiones con objetivos, tres dificultades y final. Cuatro misiones, la última contra la reina en el NIDO, a oscuras con lámpara de hombro. Quedan finales alternativos y misiones con huevos.
- **Fase 5, extras** (hecha, sin probar): widget MARINES en el panel 14 logros y estadísticas acumuladas.
