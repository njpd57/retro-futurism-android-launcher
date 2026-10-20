# AISLAMIENTO: plan y estado

Documento para retomar el trabajo en otra sesión. Resume lo decidido, lo hecho, lo que falta y cómo verificarlo. La arquitectura corta está en `CLAUDE.md` (párrafo AISLAMIENTO) y la lista de fases en `FEATURES.md`; aquí está el detalle.

Último estado: fases 1, 2 y 3 hechas, commiteadas y subidas a `main` (`a74ba95`, `f5569e6`, `6963933`). Fase 3 desplegada en el teléfono pero **sin probar por el usuario**. Quedan las fases 4 y 5.

## Qué es

Juego de supervivencia estilo *Alien: Isolation* en la Nostromo, en pantalla propia (`> aislamiento`). Vista subjetiva en 3D de alambre sobre `<canvas>`, un solo color de fósforo, sin imágenes. Tiempo real, controles con botones de texto, muerte instantánea.

Decisiones con el usuario (no reabrir sin motivo):

| Tema | Decisión |
|---|---|
| Estructura | Campaña de 5 cubiertas (1 a 2 h) que desbloquea un modo infinito generado con semilla |
| Ritmo | Tiempo real; se suspende al salir |
| Herramientas | Lanzallamas, señuelo de ruido, bengalas, fabricación con chatarra |
| Amenazas | La criatura, el androide Ash, fallos de la nave, cuenta atrás de autodestrucción |
| Muerte | Instantánea; terminales de guardado, guardado automático al empezar cada cubierta y suspensión al salir |
| Orientación | Rastreador de movimiento en tiempo real y plano descargable en terminales |
| Extras | Registros de la tripulación, logros y estadísticas, MOTHER conoce la partida (sin API), widget en el panel |
| Control | Botones en DOM (la curvatura del CRT solo corrige `click`, no toques sobre canvas); caminar manteniendo pulsado |

El plan original aprobado está en `~/.claude/plans/haz-un-plan-para-cuddly-cray.md` (fuera del repo; este documento lo sustituye).

## Hecho

### Fase 1, prototipo (probado en el teléfono)
Una cubierta, la criatura (oído, vista, caza, fuerza puertas), taquillas, rastreador, caminar manteniendo pulsado, interferencia al acercarse, muerte y reintento.

### Fase 2, supervivencia (desplegada, sin confirmar del todo)
Conductos (la criatura viaja entre rejillas, el rastreador la sigue a través de las paredes, oye por los conductos), terminales de guardado (3 s quieto), guardado automático al empezar, suspensión al salir con `[CONTINUAR]`, `[CARGAR]` al morir, la criatura aprende qué taquillas usas, latido por vibración.

### Fase 3, herramientas (desplegada, sin probar)
- `crafting.ts`: bolsa (`scrap`, `wires`, `chems`, `decoys`, `flares`, `fuel`, `flamer`), máximo 3 de cada (`BAG_MAX`, `FUEL_MAX`), recetas SEÑUELO (chatarra + cables), BENGALA (químicos + chatarra), COMBUSTIBLE (químicos ×2, necesita lanzallamas).
- Materiales en el mapa con letras: `s` chatarra, `w` cables, `c` químicos, `f` lanzallamas.
- Señuelo: cae en la última celda libre en línea (máx. 5), llama 10 s cada 1,2 s con ruido 7; no distrae a una criatura en `hunt` ni `flee`.
- Bengala: ilumina las celdas a ≤ 4 pasos 30 s. Zonas sin energía: `DeckDef.dark` (rectángulos); `view.ts` solo dibuja la celda siguiente, salvo terminales, salida y células, que brillan; la vista de la criatura baja a `ALIEN.darkSight` (2) si el jugador no está iluminado.
- Lanzallamas: alcance 3, 700 ms ocupado. Si acierta, `scare()` pone a la criatura en modo `flee` hacia la rejilla más cercana que no pase por el jugador y sale por la más lejana; `fleeMsFor(burns)` = 7000 − 1500·quemaduras, mínimo 2000. Si falla, hace ruido 7.
- UI: fila de 3 teclas (`SEÑUELO ×n`, `BENGALA ×n`, `FUEGO ▓░░`), botón `[OBJETOS]` en el HUD (con `◉` si se puede fabricar algo), panel `IsolationBag.vue`. Teclado para pruebas en escritorio: `1` señuelo, `2` bengala, `f` fuego, `b` objetos, flechas/WASD, espacio/e/Enter usar, `t` rastreador, Esc/p pausa.
- Guardado `v: 2` (con bolsa, loot, señuelos, bengalas y quemaduras). Las partidas `v: 1` se leen como sin guardado.
- **Provisional:** el lanzallamas, el material y el ala oscura (`dark: [[13, 5, 17, 11]]`) están en la CUBIERTA C para poder probarlos. Al crear la cubierta 2 hay que mover el lanzallamas allí y la C debería quedar como tutorial.

### Mapa de archivos

- `src/games/isolation/`: `rng.ts`, `grid.ts` (mapas de texto, BFS, `soundDistance`, `lineOfSight`, `rectMask`), `alien.ts`, `game.ts` (`reduce`/`step`, `TOOLS`, `NOISE`), `crafting.ts`, `view.ts` (alambre como formas planas), `decks.ts`, `story.ts` (mensajes de MOTHER), `save.ts`.
- `src/components/isolation/`: `IsolationGame.vue` (pantalla, bucle a 30 fps, eventos, sonidos), `IsolationView.vue` (canvas, rastreador, muerte), `IsolationControls.vue`, `IsolationBag.vue`.
- `src/stores/useIsolationStore.ts`: `open`, `save` (`widget.isolation.save`), `suspended` (`widget.isolation.suspend`).
- `src/audio/sfx.ts`: `step`, `door`, `hiss`, `screech`, `vent`, `flame`, `clatter`.
- Integración: `App.vue` (overlay), `utils/commands.ts` (`aislamiento`, `juego`, `alien`), `composables/useCommandConsole.ts`, `utils/commandRegistry.ts`.
- Pruebas: `src/games/isolation/__tests__/` (`grid`, `game`, `tools`, `crafting`, `view`, `story`, `save`). 320 pruebas en total en el repo.

### Convenciones del juego

- Lógica pura: estado inmutable, RNG inyectada, `reduce(state, input)` y `step(state, dtMs, rng)` devuelven `{ state, events }`. Los eventos son cadenas; `story.ts` los traduce a texto de MOTHER y `IsolationGame.vue` a sonido y vibración.
- Textos de interfaz en MAYÚSCULAS, español, terso (`SIN COMBUSTIBLE.`); código y comentarios en inglés.
- Nuevas entradas del jugador: ampliar `Input`, `reduce`, `KEYS` en `IsolationGame.vue` y una tecla en `IsolationControls.vue`.
- Un nuevo campo en el estado que deba sobrevivir a salir/guardar: añadirlo a `SavedGame` (`save.ts`: `snapshot`, `restore`, `isSavedGame`), subir `v` si el cambio rompe lo anterior y añadir casos a `save.spec.ts`.

## Falta

### Fase 4, campaña (la más larga)

Orden sugerido:
1. **Paso entre cubiertas.** Hoy `IsolationGame.vue` usa `DECK_C` fijo y `start()` crea un juego nuevo. Hace falta un estado de campaña (cubierta actual, dificultad, lo que se lleva el jugador entre cubiertas, estadísticas) y que `won` en una cubierta lleve a la siguiente con guardado automático. Probable `campaign.ts` puro y `useIsolationStore` con el progreso (`widget.isolation.progress`).
2. **CUBIERTA B · CONDUCTOS:** oscuridad, bengalas, fabricación; recuperar el lanzallamas (mover el de la C aquí).
3. **LABORATORIO · ASH:** `android.ts`. Ash no oye, te sigue a la vista y más lento, mata al alcanzarte; el lanzallamas no le afecta; se apaga desde un terminal concreto o se encierra tras una puerta sellada. Enlaza con la ORDEN ESPECIAL 937 (huevo de pascua existente de MOTHER).
4. **MANTENIMIENTO · FALLOS:** `hazards.ts`: fugas de vapor que cortan un pasillo unos segundos, apagones por zonas, puertas bloqueadas que necesitan energía desviada desde un panel (guiño a REENRUTAR). La criatura ya se adapta al fuego.
5. **HANGAR · AUTODESTRUCCIÓN:** cuenta atrás de ~5 min con avisos de MOTHER cada minuto, llegar a la Narcissus.
6. **Historia:** ~12 registros de la tripulación originales (inspirados en la película, no copiados) que se leen en terminales y se guardan; finales (escapar con Jones, solo, o morir en la explosión) con texto de MOTHER y epílogo; pantallas de título (CONTINUAR, NUEVA CAMPAÑA, MODO INFINITO bloqueado, ARCHIVO, SALIR), informe de misión y final.
7. **Dificultad** FÁCIL / NORMAL / DIFÍCIL guardada en la partida; FÁCIL debe poder terminarse sin lanzallamas.

Pruebas a añadir: **cada cubierta es resoluble** (BFS a células, salida y objetivos de subcubierta; ya hay una prueba así para el loot de la C en `tools.spec.ts`), Ash solo a la vista, cuenta atrás, avance de campaña y su guardado.

### Fase 5, infinito y extras
- `generate.ts`: cubiertas con semilla visible (rejilla con habitaciones, 3 células, lanzadera; siempre resolubles, probar con muchas semillas); cada cubierta sube la dificultad y suma puntos. `rng.ts` ya tiene `seeded` (mulberry32).
- `progress.ts`: ~10 logros (`SIN SER VISTO`, `JONES A SALVO`, `ARCHIVISTA`, `ORDEN 937`, `SIN FUEGO`, `SUPERVIVIENTE`, `CUBIERTA 10` en infinito…) y estadísticas (tiempo, muertes, cubiertas, usos del lanzallamas, mejor marca y semilla).
- `IsolationArchive.vue`: registros, logros, estadísticas. Plano descargable de la cubierta (`IsolationMap.vue`).
- `IsolationWidget.vue` en `src/widgets/registry.ts` (categoría `juegos`, `span: 2`, **con `description` y `preview` o `registry.spec.ts` falla**). Muestra cubierta y objetivo o mejor marca, con `[CONTINUAR]` / `[JUGAR]`.
- MOTHER sin API: `/jugar`, `/partida`, `/pista` en `mother/slash.ts` (actualizar `SLASH_HELP` y `COMMANDS.mother`), `/jugar` abre el juego desde `askMother` en `App.vue` y `submit` en `MotherTerminal.vue` (como `/sesiones`), `/partida` y `/pista` se responden en `runSlash` de `useMotherStore`; `hints.ts` calcula la pista. El juego **no** se añade al contexto enviado a la API. Los mensajes de la partida pueden ir al LOG con `useLogStore().push('MOTHER', ...)`.
- Documentación: `README.md` (juego en español), `CLAUDE.md` y `FEATURES.md` al terminar.

### Pendiente del lado del usuario
- Probar fase 3 en el teléfono: fluidez de la llama y la bengala, tamaño de los tres botones nuevos, equilibrio del ala oscura.
- Confirmar fase 2: conductos, `[GUARDAR]` en terminales (3 s), suspender y `[CONTINUAR]`, taquillas que la criatura aprende, vibración de latido.

## Riesgos conocidos

- **Rendimiento en el WebView:** medido en el Mac (`buildView` ≈ 0,08 ms/frame, `step` ≈ 0,003 ms), pero no en el teléfono. El resplandor es doble trazo, no `shadowBlur` por línea.
- **No verificado jugando:** viaje por conductos y aprendizaje de taquillas solo existen en pruebas unitarias; toque (caminar manteniendo, curvatura en los bordes), sonido real y vibración solo se prueban en el teléfono.
- **Equilibrio de la IA:** los números (`ALIEN`, `TOOLS`, `NOISE`) son una primera estimación. Ajustar con simulaciones en pruebas (RNG fija) antes de tocar a mano.
- **Contenido:** las 5 cubiertas y los textos son el grueso del trabajo. Probable `defineAsyncComponent` para no pesar en el arranque si el bundle crece (hoy `index.js` ≈ 296 kB, 108 kB gzip).

## Cómo verificar

```bash
npx vitest run --dir src     # todas las pruebas (--dir deja fuera los worktrees de .claude/)
npm run type-check
npm run build
npm run deploy               # build + adb push + reinicia Bridge (solo cuando el usuario lo pide)
```

No usar adb sin que el usuario lo pida; él prueba en el dispositivo.

**Ver el juego sin teléfono (Chrome headless por CDP).** Funciona bien para capturas de estados concretos:
1. `npx vite --port 5179 --strictPort` en segundo plano.
2. Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=<carpeta temporal> --no-first-run --disable-gpu` (arranca lento bajo Rosetta; necesita `dangerouslyDisableSandbox`).
3. Un script Node abre una pestaña (`PUT /json/new`), emula 412×860 @2x, navega a `http://localhost:5179/` y usa `Runtime.evaluate` y `Page.captureScreenshot`.
4. Para colocar una partida en un estado concreto sin jugar: desde `Runtime.evaluate`, `await import('/src/games/isolation/game.ts')` (y `decks.ts`, `save.ts`) con las URL del servidor de Vite, construir el estado con `newGame`, editarlo, y asignar `snapshot(s)` a `pinia._s.get('isolation').suspended` (`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia`); luego `store.show()` y pulsar `[CONTINUAR]` dos veces (reanudar y salir de la pausa). Para reemplazar una partida ya abierta, `store.close()` primero y esperar 300 ms (cerrar suspende y sobrescribe lo guardado).
5. Teclas: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))`.

Al terminar, parar Vite y Chrome (`pkill -f "vite --port 5179"`, `pkill -f "remote-debugging-port=9333"`) y borrar los `tsconfig.*.tsbuildinfo` que deja `vue-tsc -p tsconfig.app.json`.

## Trampas encontradas

- `parseMap` toma la **última** `A` y `P` del mapa: una segunda `A` en un mapa de prueba cambia silenciosamente dónde empieza la criatura.
- Una criatura que mata al jugador en una prueba congela el estado (`step` no hace nada fuera de `playing`): las pruebas de temporizadores deben encerrar a la criatura o usar mapas donde no llegue.
- `useAction` y `reduce` ignoran órdenes mientras `player.busyMs > 0`; en pruebas hay que dejar pasar el tiempo entre acciones.
- Un cambio en `SavedGame` sin subir `v` deja partidas viejas inválidas sin aviso; el validador las lee como `null`.
