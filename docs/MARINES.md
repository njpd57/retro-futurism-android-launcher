# MARINES: plan y estado

Documento para retomar el trabajo en otra sesión. Resume lo decidido, lo hecho, lo que falta y cómo verificarlo. La arquitectura corta está en `CLAUDE.md` (párrafo MARINES) y las fases en `FEATURES.md`; aquí está el detalle. El plan original aprobado está en `~/.claude/plans/haz-un-plan-para-flickering-eclipse.md` (fuera del repo; este documento lo sustituye).

Último estado: **fases 0 a 5 hechas, con pruebas (579 en el repo); la 3 está desplegada, lo posterior no, ninguna probada en el teléfono ni en Chrome sin pantalla.** Quedan sin hacer los finales alternativos y las misiones con huevos.

## Qué es

Juego de acción estilo *Aliens: Colonial Marines* en LV-426, en pantalla propia (`> marines`, alias `escuadra`, `lv426`, `colonial`). Vista subjetiva de alambre sobre `<canvas>` (el mismo motor que AISLAMIENTO), movimiento libre, un solo color de fósforo, sin imágenes. Ficción: la escuadra baja de la USS SULACO a la colonia ESPERANZA DE HADLEY; la radio es MANDO. Textos originales, inspirados en la película, no copiados. Modo de oleadas: ÚLTIMA DEFENSA.

Decisiones con el usuario (no reabrir sin motivo):

| Tema | Decisión |
|---|---|
| Movimiento | **Libre**: un **joystick analógico** para moverse (antes eran cuatro botones ▲ ▼ ◄ ►; cambiado a petición del usuario); **girar y apuntar arrastrando el dedo sobre la vista**; FUEGO mantenido = ráfaga; puntería asistida en un cono estrecho |
| Estructura | Primero **oleadas** en una colonia (repetible, puntuación y récord); después una **campaña corta** de misiones que reutiliza todo |
| Escuadra | **2 marines IA** con biomonitor en el HUD y órdenes SEGUIR / QUIETOS (fase 2) |
| Arsenal | Rifle de pulsos con contador, **lanzagranadas**, **torretas centinela**, **soldador de puertas**, **armas extra** (escopeta, smartgun, lanzallamas) |

Forma de trabajo (memoria del usuario): por fases; al final de cada una, pruebas + type-check + build + capturas en Chrome sin pantalla, y una lista de lo que solo se puede comprobar en el teléfono. Sin `npm run deploy` hasta que diga «haz deploy»; sin commit hasta que lo pida.

## Hecho

### Fase 0, motor compartido (`src/games/wire/`)
Se sacó de `isolation/view.ts` todo lo que no era propio de AISLAMIENTO:
- `camera.ts`: `createCamera` (proyección, recorte contra el plano cercano, `face`, `box`, `text`, `facing`), `against`, `edge`, `visibleCells` (BFS de celdas a la vista), `depthAlpha(dist, depth)`, el tipo `Shape` (con `clip` opcional: tramos de pantalla donde se puede dibujar).
- `level.ts`: `buildLevel` (suelo, lámparas, paredes con puertas y marcos, letreros, ordenado de lejos a cerca) con ganchos por celda: `light` (brillo o saltar la celda), `ground`, `wall` (decoración propia), `stand` (lo que hay de pie); `wallDetail`, `doorDetail`, `ventDetail`.
- `occlusion.ts`: `castRay` (DDA; con el avance de la cámara igual a 1, la distancia es la profundidad z), `depthBuffer` por columnas y `openSpans` (dónde un sprite a profundidad z está delante de las paredes).
- `creature.ts`: la silueta del organismo (`ALIEN_OUTLINE`, `ALIEN_TAIL`).
- `src/components/wire/drawShapes.ts`: el dibujado (relleno de fondo, trazo doble para el resplandor, texto inclinado, recorte por tramos). Estilos por etiqueta en `STYLE`.

`wire/` importa `Grid`, `neighbour`, etc. de `isolation/grid.ts` (no se movió ese archivo).

**Comprobación del refactor:** antes de tocar nada se guardó una huella (hash) de la salida de `buildView` en 804 poses de la CUBIERTA C con todo activo (luz, bengalas, llama, señuelos, taquilla ocupada); después del refactor es idéntica bit a bit. Para repetirla hay que recrear una prueba temporal así (no se dejó en el repo).

### Fase 1, prototipo
Un mapa (OPERACIONES, 26×15), movimiento libre con joystick y deslizamiento, rifle de pulsos con contador y recarga, zánganos, campo de distancias, zarpazos con preaviso, salud y blindaje, oleadas sin fin con descanso y reposición de cajas, rastreador, HUD, sonidos, pausa con sensibilidad y FPS, récords, `> marines`.

Números iniciales (todos en tablas para ajustar):
- Joystick (`STICK` en `stick.ts`): radio de 48 px (lo que hay que arrastrar para ir a tope y lo que viaja el mando), zona muerta del 14 %; la velocidad crece de forma continua desde el borde de la zona muerta, en la dirección del arrastre, y la diagonal nunca es más rápida.
- Jugador: salud 100, blindaje 50 (absorbe 2/3 de cada golpe), 2,6 casillas/s adelante, 1,8 atrás, 2,2 de lado, radio 0,25.
- Rifle (`WEAPONS.rifle`): cargador 99, 10 disparos/s, daño 1, 3 cargadores de reserva (máx. 495), recarga 1,6 s, alcance 14, dispersión 1,5° → 5° con la ráfaga sostenida, asistencia de 4,5°.
- Zángano (`ENEMIES.drone`): vida 8, 3 c/s, radio 0,3, alcance 0,8, preaviso 350 ms, enfriamiento 900 ms, daño 15, 100 puntos.
- Oleadas: 4 + 2n zánganos, salen cada max(500, 1300 − 60n) ms por una rejilla a ≥ 6 casillas, máx. 8 + n vivos (tope 14), descanso de 4 s al inicio y 9 s entre oleadas (se reponen munición y botiquines), bonus 250·n.
- Rastreador: alcance 10 casillas (20 m), semicírculo frontal, solo lo que se movió; el contador `MOVIMIENTO 12 M` da la distancia del más cercano en cualquier dirección (también detrás). Los que están golpeando están quietos y no salen.

Medido en el Mac: `step` con 14 enemigos ≈ 0,03 ms; `buildMarinesView` ≈ 0,2-0,3 ms (≈ 330 formas). El paquete crece 31 kB (11 kB comprimido): `index.js` 297 → 329 kB.

Simulación de equilibrio (bot mediocre: apunta al más cercano, dispara sin parar, retrocede si lo alcanzan, **no recoge nada**): muere en las oleadas 3-4 tras ≈ 26 bajas, que es lo que da la munición inicial (≈ 396 balas al 50 % de acierto). Con las cajas repuestas cada oleada hay margen. Un bot que juega por dentro de la página (accediendo a `setupState`) limpió la oleada 1 sin daño con 80 balas (≈ 60 % de acierto).

### Mapa de archivos

- `src/games/marines/`: `map.ts` (`parseArena`, `ARENA_OPERATIONS`), `physics.ts` (`moveCircle`, `lineClear`, `rayCircle`, ángulos), `weapons.ts` (`resolveShot`, `assistTarget`, `spreadAt`), `enemies.ts` (campo de distancias, persecución, separación, zarpazos), `waves.ts`, `game.ts` (`newGame`, `step`, `act`, `hurt`), `radio.ts` (mensajes de MANDO), `stick.ts` (la matemática del joystick), `view.ts` (`buildMarinesView`: sprites con oclusión, trazadoras, chispas, estallidos).
- `src/components/marines/`: `MarinesGame.vue` (pantallas, bucle, arrastre para apuntar, teclado, HUD), `MarinesView.vue` (canvas: vista, fusil con su contador, mira, rastreador, bordes de daño), `MarinesControls.vue` (el joystick: un cuadrado de vídeo inverso que se rellena al tocarlo, sobre una cruz con flechas tenues; FUEGO y RECARGA).
- `src/stores/useMarinesStore.ts`: `open`, `records` (`widget.marines.records`), `prefs` (`widget.marines.prefs`: sensibilidad y FPS 30/60; por defecto 1 y 30). Prefijo `widget.` para que entren en la copia de seguridad.
- `src/audio/sfx.ts`: `pulse`, `reload`, `hurt`, `kill`, `dry` (más los que ya había).
- Integración: `App.vue` (superposición, `overlayOpen`, `closeOverlays`), `utils/commands.ts`, `composables/useCommandConsole.ts`, `utils/commandRegistry.ts`.
- Pruebas: `src/games/marines/__tests__/` (`map`, `physics`, `weapons`, `enemies`, `game`, `view`, `stick`) y `src/games/wire/__tests__/` (`camera`, `occlusion`).

### Convenciones del juego

- Lógica pura: `step(state, dtMs, controls, rng)` y `act(state, action)` devuelven `{ state, events }`; el estado de entrada no se toca (trabaja sobre una copia superficial, `clone` en `game.ts`, y hay una prueba). Los eventos son cadenas; `radio.ts` los traduce a texto y `MarinesGame.vue` a sonido y vibración.
- `step` parte el tiempo en trozos de ≤ 50 ms (nada atraviesa una pared); el giro del arrastre se aplica una sola vez.
- El enfriamiento del arma puede pasar hasta un trozo por debajo de cero y se arrastra: la cadencia no depende de los fotogramas por segundo (10/s a 30 o a 60 fps, hay una prueba).
- El calor del arma (dispersión) solo se disipa al soltar el gatillo o al recargar.
- Textos de interfaz en MAYÚSCULAS, español, terso; código y comentarios en inglés.
- Los gestos usan eventos táctiles. El arrastre sigue un solo `Touch.identifier` (el que empezó en la vista) y usa cuánto se movió, no dónde está (la curvatura del CRT no le afecta). El joystick, igual que el arrastre, sigue un solo `Touch.identifier` (el suyo) y mide cuánto se arrastró desde donde aterrizó el pulgar, así que vale cualquier punto de su zona y el otro pulgar no lo molesta. FUEGO y el joystick llaman a `preventDefault` en `touchstart` (evita el ratón y el `click` emulados); no llevan `pressable`. El teclado (WASD, flechas) sigue funcionando en el escritorio y se suma al joystick (`step` recorta la suma a una zancada).
- Los paneles (título, pausa, baja) cubren toda la pantalla del juego, no solo la vista: en un teléfono de 360×640 la vista sola es demasiado baja.

## Falta

### Fase 2, escuadra y arsenal (hecha)
- **Armas** (`weapons.ts`, `WEAPON_ORDER`): rifle, escopeta (9 perdigones con caída de daño), smartgun (asistencia de 22°, marca el objetivo con corchetes en `view.ts`) y lanzallamas (cono, `flameReach`, quema `BURN`). La que se lleva en la mano usa `player.mag/reserve`; las demás están en `player.stash`. Cambiar (`act 'switch'` / `select:<arma>`) tarda `SWITCH_MS`. Se consiguen en cajas del mapa (`S` `M` `F`, `g` granadas); una caja de munición (`a`) repone todas las armas llevadas.
- **Granadas** (`GRENADE`): botón propio, proyectil que estalla contra pared, criatura o al final del vuelo; daña a criaturas, jugador y escuadra cerca.
- **Enemigos** (`enemies.ts`): corredor (oleada 3+) y abrazacaras (4+, `waves.mix/pickKind`). El abrazacaras salta (`grab`), se queda pegado (`clung`), frena y hiere (`GRAB`) hasta que cualquier disparo lo mata. `stepEnemies` devuelve `Strike[]` y las criaturas atacan al marine más cercano a la vista.
- **Ácido** (`ACID`): charco al caer una criatura (no si estaba pegada), quema por ticks, salpica si cae muy cerca.
- **Escuadra** (`squad.ts`): VEGA y HOLT, `follow`/`hold` (`act 'order'`), disparan al más cercano a la vista con fallos, caen, y entre oleadas se curan o se reemplazan (`reinforce`). Biomonitores en `MarinesView`.
- UI: fila de 4 teclas (RECARGA, ARMA, GRANADA n, SEGUIR/QUIETOS), FUEGO ocupa la columna derecha. Teclado: q arma, 1-4, g, e. Eventos con detalle: `pickupWeapon:<arma>`, `marineDown:<n>`.
- Pendiente del teléfono: ver «Pendiente» más abajo, más el encaje de las 4 teclas en 360 px, el dibujo de las armas y del abrazacaras, el equilibrio (corredores, ácido, ayuda de la escuadra) y el rendimiento con escuadra y explosiones.

### Fase 3, ÚLTIMA DEFENSA completa (hecha, sin probar en el teléfono)
- **Escupidor** (`enemies.ts`, `ENEMIES.spitter`, `range`): desde la oleada 5 (`waves.mix`, tope 12 %). Se detiene a ≤ 6,5 casillas con línea limpia y, tras el aviso, lanza un `Spit` (`defenses.ts`, `SPIT`): cae a los 700 ms donde estaba el objetivo, deja un charco y hiere a quien siga ahí. `Strike.spit` lo lleva al juego.
- **Soldador** (`WELD`, `weldTarget`, `act 'weld'`): sella (o corta, y devuelve la carga) la puerta `d` que se mira a ≤ 1,9 casillas; 3 cargas por oleada. La puerta soldada entra en `closed` y en `state.welds`. `buildField(..., welds)` las cuenta como paso con coste `WELD_COST` y las criaturas, si es su camino, las roen (`gnawRate`) hasta romperlas (`weldBroken`). `Field.key` detecta que el campo quedó viejo.
- **Torretas** (`TURRET`, `placeTurret`, `stepTurrets`, `act 'turret'`): máximo 2, 180 balas, giran y disparan a la criatura más cercana a la vista; las criaturas cercanas las atacan como a un marine (ids ≥ `TURRET.idBase`). Al limpiar la oleada se rearman, se curan y se da una carga.
- **UI:** una tecla contextual (`TORRETA n` / `SOLDAR` / `CORTAR`, teclado `t` y `f`), selector `[MAPA]` en el título, `[CONTINUAR]` si hay partida suspendida.
- **Mapas:** OPERACIONES, HANGAR (abierto, armerías tras puerta) y CONDUCTOS (rejillas tras puertas, para soldar). `ARENAS` y `ARENA_ORDER` en `map.ts`.
- **Informe y récords** (`report.ts`): récords por mapa (`widget.marines.records.v2`; el antiguo `widget.marines.records` se lee una vez como el de OPERACIONES) con oleada, puntos, bajas, tiempo y partidas; el panel de muerte muestra bajas por tipo, lo construido y qué récord se batió.
- **Suspensión** (`save.ts`, `widget.marines.suspend`, versión 1, validada al leer): se guarda al pausar y al salir; no guarda granadas en vuelo ni efectos. Al morir se borra.
- **Equilibrio** (`balance.spec.ts`): un bot mediocre (no recoge nada, no suelda) llega a la oleada ≈ 9-11 con escuadra y torretas; sin torretas mata la mitad en HANGAR.
- Pendiente del teléfono: que las 5 teclas quepan en 360 px (fuente 0,68 em), el dibujo del escupidor, las torretas y el escupitajo, si soldar es útil o estorba, el aviso del anillo en el suelo, y que `[CONTINUAR]` restaure bien.

### Fase 4, campaña (hecha, sin probar en el teléfono)
- `campaign.ts` (puro): `MISSIONS` (AGUANTEN en OPERACIONES: 4 oleadas; LIMPIEZA en HANGAR: 60 bajas y 2 torretas; SELLEN LAS PUERTAS en CONDUCTOS: 5 oleadas y 2 soldaduras), con `briefing` y `debrief` por radio; `Goals` (todas a la vez), `missionDone`, `missionProgress` (línea del HUD, vía `radio.status`), `unlocked` (secuencial) y `DIFFICULTY` (RECLUTA / VETERANO / PESADILLA: multiplican vida, número y daño; VETERANO es el equilibrio de antes).
- `game.ts`: `newGame(arena, { difficulty, mission })`, `state.mission` y `state.rules`; fase `'won'` y evento `won` cuando se cumple la misión.
- UI: en el título `[OLEADAS|CAMPAÑA]`, `[MISIÓN]`, dificultad; panel `MISIÓN CUMPLIDA` con el parte de MANDO y `[SIGUIENTE]`; `FIN DE LA CAMPAÑA` tras la última. Las misiones no entran en los récords de oleadas. Se recuerdan en `widget.marines.campaign` (mejor dificultad, luego tiempo).
- La suspensión (`save.ts`) pasó a la versión 2 (lleva misión y reglas); una partida suspendida de la versión 1 se descarta.
- **Cuarta misión, LA REINA** (mapa NIDO): `Goals.queen` es la oleada en que sale la reina (`EnemyKind 'queen'`: 90 de vida, 1,7 casillas/s, golpe de 28; `state.queenOut`, evento `queen`); se gana al abatirla.
- **Zonas oscuras** (`ArenaDef.dark`, `state.dark`, `view.LAMP`): en NIDO las dos cavernas no tienen luz; solo se ve lo que alcanza la lámpara de hombro (3,4 casillas, con caída de brillo). Criaturas, marines y charcos fuera de ese alcance no se dibujan; el rastreador sigue marcando.
- **Sin hacer:** finales alternativos y misiones con huevos.

### Fase 5, extras (hecha, sin probar en el teléfono)
- `achievements.ts` (puro): 14 logros que se ganan con el `Report` de una partida y un `RunContext` (misión ganada, dificultad, misiones cumplidas). Se guardan en `widget.marines.achievements` (`useMarinesStore.unlock` devuelve los nuevos) y salen como `LOGRO: NOMBRE` en los paneles de baja y de misión cumplida; el título cuenta `LOGROS n/13`.
- `Report` ganó `shots` y `squadAlive`.
- `MarinesWidget` (categoría juegos, 1 columna, registrado en `widgets/registry.ts`): mejor récord entre mapas, campaña y logros con barras; un toque abre el juego.
- Estadísticas acumuladas (`report.addStats`, `widget.marines.stats`): partidas, bajas, tiempo, disparos, torretas, soldaduras y misiones; salen en el título y en el widget.
- README y `FEATURES.md` al día.

### Pendiente del lado del usuario (solo se ve en el teléfono)
- **Multitoque**: mover el joystick con un pulgar y arrastrar la vista con el otro, **y mantener FUEGO a la vez**: eso son tres dedos, o el pulgar de apuntar tiene que cubrir también FUEGO. En CDP funcionan los tres a la vez (ver «Cómo verificar»), pero la ergonomía solo se ve en el teléfono; si estorba, plantear disparo automático mientras se arrastra o un FUEGO que se pueda alcanzar con el mismo pulgar.
- **Joystick**: radio de 48 px y zona muerta del 14 % (`STICK`), tamaño de la zona (≈ 190×160 px), si el pulgar cae bien o conviene una zona más grande.
- **Sensibilidad** del arrastre (0,0065 rad/px × ajuste) y si 30 fps basta para apuntar o hace falta 60 (se cambia en PAUSA).
- **Curvatura del CRT** en los bordes: las teclas están a ras de los lados y el arrastre sale de la vista; la curvatura mueve lo pintado pero no la zona que recibe el toque.
- **Fluidez**: el canvas de 412×490 con doble trazo de resplandor y hasta ≈ 330 formas por fotograma, más el filtro del CRT, no se ha medido en el teléfono.
- **Se distinguen** los zánganos en alambre a esa velocidad y a distancia; tamaño de FUEGO y RECARGA; si el fusil estorba la puntería (el cañón queda por debajo y a la izquierda de la mira).
- Sonido real (fusil a 10/s) y vibración al recibir golpes.

## Riesgos conocidos

- **Rendimiento en el WebView:** medido en el Mac, no en el teléfono. Recortes posibles: `VIEW_CELLS` (9) menor, menos columnas de oclusión (hoy `min(180, ancho/2)`), 30 fps.
- **Equilibrio:** los números son una primera estimación; afinar con simulaciones en pruebas antes de tocar a mano.
- **Fotosensibilidad:** ráfagas de 10/s; el fogonazo es pequeño y nunca se destella la pantalla entera. Los bordes de daño son cuatro barras de 7 px. Sin movimiento reducido no hay temblor ni estática.
- **Tamaño del paquete:** `defineAsyncComponent` solo después de comprobar en el teléfono que Bridge carga trozos aparte.

## Cómo verificar

```bash
npx vitest run --dir src     # todas las pruebas (--dir deja fuera los worktrees de .claude/)
npm run type-check           # usa tsconfig.vitest.json
npx vue-tsc --noEmit -p tsconfig.app.json --composite false   # los .vue nuevos (build lo hace por otro lado)
npm run build
npm run deploy               # build + adb push (solo cuando el usuario lo pide)
```

**Ver y jugar sin teléfono (Chrome sin pantalla por CDP).** Misma técnica que `docs/AISLAMIENTO.md`, con estas diferencias útiles:
1. `npx vite --port 5179 --strictPort` y Chrome con `--headless=new --remote-debugging-port=9333 --user-data-dir=<carpeta> --no-first-run --disable-gpu` (necesita `dangerouslyDisableSandbox`).
2. Un script Node (con el `WebSocket` global de Node 22) abre una pestaña (`PUT /json/new?<url>`), emula 412×860 @2x y usa `Runtime.evaluate` y `Page.captureScreenshot`. Para 360×640 se ve la peor disposición.
3. Antes de abrir el juego: `pinia._s.get('settings').bootSequence = false` y pulsar `.boot`; luego `pinia._s.get('marines').show()` y pulsar `[INICIAR]`. `pinia` es `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia`.
4. **El estado del juego es accesible** desde `document.querySelector('.marines').__vueParentComponent.setupState` (solo en desarrollo): `state` (se puede asignar), `held`, `turnAcc`, `screen`. Con eso se hace un bot dentro de la página (apuntar al más cercano y mantener `held.fire`) y se colocan escenas: `screen = 'paused'` (dibuja pero no avanza), ocultar `.panel` con una hoja de estilos y asignar `state` con `spawnEnemy` (de `await import('/src/games/marines/enemies.ts')`).
5. **Toques reales:** `Emulation.setTouchEmulationEnabled` y `Input.dispatchTouchEvent` con varios `touchPoints` (`id`, `x`, `y`). Sirve para comprobar dos dedos a la vez (FUEGO + arrastre). `touchEnd` sin puntos suelta todos.
6. El perfil de Chrome conserva `localStorage` entre pasadas: si se prueba la pausa (`[SENSIBILIDAD]`, `[60 FPS]`), los ajustes persisten y falsean las pruebas de giro (una vez medí el doble por eso). Borrar `widget.marines.prefs`.

Al terminar, parar Vite y Chrome (`pkill -f "vite --port 5179"`, `pkill -f "remote-debugging-port=9333"`) y borrar los `tsconfig.*.tsbuildinfo` si `vue-tsc` los deja.

## Trampas encontradas

- Una prueba con un enemigo en la misma fila que un pilar no lo ve: el pilar lo oculta. Colocar a los de prueba fuera de la línea de visión del centro (y a propósito para probar la oclusión).
- `castRay` devuelve 0 si el origen está dentro de una pared; `lineClear` entonces da falso. Un enemigo que roce una esquina puede dejar de «ver» al jugador un instante; `stuckMs` lo manda por el campo de distancias.
- El alcance del rastreador (10) es menor que el de la arena: las rejillas de las esquinas quedan fuera. Si se hace otro mapa, comprobar la distancia a sus rejillas.
- `separate` puede empujar a un enemigo contra una pared; `moveCircle` lo respeta, así que no se separan del todo en pasillos de una casilla.
- En `MarinesGame.vue`, las variables `let` (`turnAcc`) y los objetos sin `ref` (`held`) no son reactivos: el HUD que dependa de ellos no se actualiza. Lo que se muestra sale de `state` (un `shallowRef`) y de `clock`, que el bucle asigna en cada fotograma.
