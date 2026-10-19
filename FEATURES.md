# Ideas para más adelante

Todo lo que había en esta lista anterior está implementado (colores, barrido, curvatura, iconos monocromos, widgets nuevos, atajos de apps, sonidos).

Pendiente de probar en el dispositivo: el método `getStorageStats` del fork (Kotlin añadido en `bridge-launcher`, sin compilar aún: no hay Android SDK en el equipo de desarrollo).

Cada idea indica lo que necesita entre paréntesis: `web` (solo código de este proyecto), `fork` (método del fork, ya existente o nuevo en Kotlin) o `verificar en WebView` (depende de una API del navegador que hay que probar en el dispositivo). Dentro de cada sección, de más fácil a más costosa.

## Widgets

- **PROTOCOLO**: checklist diario de tareas o hábitos con `[ ]`/`[X]` que se reinicia a medianoche; lógica pura y testeada (web).
- **T-MENOS**: cuenta atrás a una fecha que elige el usuario ("T-MENOS 012 DÍAS 04:33") (web).
- **COLONIAS**: reloj mundial con 2–4 zonas horarias vía `Intl` (web).
- **FASE LUNAR**: fase de la luna dibujada con bloques ASCII, calculada sin red (web).
- **CLIMA EXTENDIDO**: pronóstico de 7 días con sparkline `▁▂▃`, reutilizando `useWeatherStore` (web).
- **TELEMETRÍA**: latencia a un host medida con `fetch`, con su historial como sparkline (web).
- **CRONÓMETRO**: modo cronómetro con vueltas dentro de `TimerWidget` (web).
- **RUMBO**: brújula ASCII con `deviceorientation` (verificar en WebView).
- **REENRUTAR**: minijuego de reparto de energía entre sistemas de la nave (PUERTAS / SOPORTE VITAL / SENSORES), inspirado en las estaciones de *Alien: Isolation*; lógica pura en `src/games/` (web).

## Mejoras al launcher

- **CONTADOR DE ALERTAS**: número de notificaciones pendientes en la `TopBar` (fork: ya existe).
- **TURNO NOCTURNO**: de noche cambia sola a fósforo rojo y baja el bloom, por horario (web).
- **RESPALDO**: exportar e importar ajustes, layout, notas y favoritos como texto JSON para copiar y pegar (web).
- **CONSOLA DE COMANDOS**: el prompt acepta comandos además de búsqueda: `abrir x`, `calc 2+2`, `tema verde`, `clima`, `nota texto`, `ayuda`; parser puro y testeado (web).
- **SECUENCIA DE ARRANQUE**: pantalla de boot (chequeo de memoria, logo, `SISTEMA EN LÍNEA`) al cargar, saltable con un toque y desactivada con `prefers-reduced-motion` (web).
- **VIBRACIÓN**: pulso háptico corto al pulsar, opcional igual que el sonido (verificar `navigator.vibrate` en WebView).
- **REPOSO**: tras N minutos sin tocar, la pantalla se atenúa y muestra un reloj grande que se desplaza para evitar quemado (web).
- **GESTOS**: deslizar a los lados para cambiar de pestaña y hacia abajo para abrir las notificaciones, sin romper el scroll del panel (web).
- **VARIOS PANELES**: más de un layout de dashboard, con pestañas `P1 P2` o deslizamiento para pasar de uno a otro (web).

## Pantalla de apps

- **MARCA DE NUEVA**: `*NUEVO` junto a las apps instaladas en los últimos días, a partir de `appInstalled` (web).
- **ÍNDICE A–Z**: tira vertical de letras en el borde para saltar en la lista (web).
- **ORDEN**: alternar entre alfabético, más usadas hoy (`useUsageStore`) e instaladas recientemente (web + fork ya existente).
- **ALIAS**: renombrar una app desde su menú; la búsqueda también busca por alias (web).
- **VISTA `ls -l`**: modo de lista con columnas: nombre, tiempo de uso hoy y tipo (web + fork ya existente).
- **BÚSQUEDA AMPLIADA**: resultados también de contactos y atajos de apps, y un `[BUSCAR EN RED]` final que abre el navegador con `requestOpenUrl` (fork: ya existe).
- **DIRECTORIOS**: agrupar apps en carpetas definidas por el usuario, mostradas como `» JUEGOS/ (7)` (web).

## MOTHER

- **ÓRDENES LOCALES**: comandos que responden sin API ni red: `ESTADO` (batería, red, almacenamiento), `INFORME` (agenda + clima + alarma) y el easter egg `ORDEN ESPECIAL 937` (web).
- **CONTEXTO DE A BORDO**: opción para incluir en el prompt de sistema la hora, la batería, la agenda del día y el clima, para que MOTHER pueda contestar "¿qué tengo hoy?" (web; opt-in, porque manda esos datos a la API).
- **TELETIPO**: chirrido de datos sincronizado con el texto en streaming, solo si el sonido está activo (web).
- **AJUSTES DE MODELO**: elegir modelo y mostrar los tokens usados por sesión (web).
- **INFORME DE TURNO**: `MotherWidget` muestra un resumen al primer desbloqueo del día (web).
- **SESIONES**: guardar y recuperar conversaciones anteriores, y exportarlas como texto (web).
- **VOZ**: leer las respuestas con `speechSynthesis`, voz grave y lenta, desactivada por defecto (verificar en WebView).
- **ACCIONES**: function calling para abrir apps, poner un temporizador, crear una nota o cambiar la paleta, siempre con confirmación `[EJECUTAR] [ANULAR]` (web).
