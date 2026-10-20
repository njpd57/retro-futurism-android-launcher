# AISLAMIENTO: plan y estado

Documento para retomar el trabajo en otra sesión. Resume lo decidido, lo hecho, lo que falta y cómo verificarlo. La arquitectura corta está en `CLAUDE.md` (párrafo AISLAMIENTO) y la lista de fases en `FEATURES.md`; aquí está el detalle.

Último estado: las cinco fases están hechas. Las fases 1 a 3 están commiteadas y subidas a `main` (`a74ba95`, `f5569e6`, `6963933`); las fases 4 y 5 (campaña, infinito y extras) están implementadas y con pruebas, **sin probar en el teléfono**.

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

- `src/games/isolation/`: `rng.ts`, `grid.ts` (mapas de texto, BFS, `soundDistance`, `lineOfSight`, `rectMask`), `alien.ts`, `android.ts` (Ash), `game.ts` (`reduce`/`step`, `TOOLS`, `NOISE`, `STEAM`), `crafting.ts`, `view.ts` (alambre como formas planas), `decks.ts`, `generate.ts`, `campaign.ts`, `difficulty.ts`, `progress.ts`, `logs.ts`, `plan.ts`, `hints.ts`, `story.ts` (mensajes de MOTHER), `save.ts` (`v: 3`).
- `src/components/isolation/`: `IsolationGame.vue` (pantalla, bucle a 30 fps, eventos, sonidos), `IsolationView.vue` (canvas, rastreador, muerte), `IsolationControls.vue`, `IsolationBag.vue`, `IsolationMap.vue`, `IsolationArchive.vue`; el widget en `components/widgets/IsolationWidget.vue`.
- `src/stores/useIsolationStore.ts`: `open`, `save` (`widget.isolation.save`), `suspended` (`widget.isolation.suspend`).
- `src/audio/sfx.ts`: `step`, `door`, `hiss`, `screech`, `vent`, `flame`, `clatter`.
- Integración: `App.vue` (overlay), `utils/commands.ts` (`aislamiento`, `juego`, `alien`), `composables/useCommandConsole.ts`, `utils/commandRegistry.ts`.
- Pruebas: `src/games/isolation/__tests__/` (`grid`, `game`, `tools`, `crafting`, `view`, `story`, `save`, `decks`, `generate`, `campaign`, `plan`).

### Convenciones del juego

- Lógica pura: estado inmutable, RNG inyectada, `reduce(state, input)` y `step(state, dtMs, rng)` devuelven `{ state, events }`. Los eventos son cadenas; `story.ts` los traduce a texto de MOTHER y `IsolationGame.vue` a sonido y vibración.
- Textos de interfaz en MAYÚSCULAS, español, terso (`SIN COMBUSTIBLE.`); código y comentarios en inglés.
- Nuevas entradas del jugador: ampliar `Input`, `reduce`, `KEYS` en `IsolationGame.vue` y una tecla en `IsolationControls.vue`.
- Un nuevo campo en el estado que deba sobrevivir a salir/guardar: añadirlo a `SavedGame` (`save.ts`: `snapshot`, `restore`, `isSavedGame`), subir `v` si el cambio rompe lo anterior y añadir casos a `save.spec.ts`.

### Fase 4, campaña (hecha, sin probar en el teléfono)

- **Cubiertas** (`decks.ts`, `CAMPAIGN`): `c` CUBIERTA C (tutorial: material para fabricar, sin lanzallamas ni oscuridad), `b` CONDUCTOS (ala sur y este a oscuras, el lanzallamas en la zona con luz), `lab` LABORATORIO · ASH (Ash patrulla el pasillo central; terminal de control en la sala SE que lo apaga), `maint` MANTENIMIENTO · FALLOS (3 fugas de vapor, apagón periódico del ala suroeste y una puerta `X` sin energía que cierra la bahía de carga con la lanzadera, abierta desde el panel del taller), `hangar` HANGAR · AUTODESTRUCCIÓN (cuenta atrás de 300 s, 2 células, Jones en un hueco del pasillo sur, la Narcissus en el este). Cada una es un `DeckDef` con su mapa de texto; las letras nuevas están en `grid.ts` (`H`, `X`, `~`, `j`).
- **Terminales con función** (`DeckDef.terminals`): cada `T` guarda, y además lee un registro (`log`), apaga a Ash (`ashOff`) o desvía la energía a una puerta (`opens`). Tras los 3 s de guardado se aplica todo (`finishTerminal` en `game.ts`) y el terminal envía el plano (`mapped`). `terminalTask(s)` da lo que hará [USAR] para el texto de la tecla.
- **Ash** (`android.ts`): ve en línea recta (6 celdas, 2 si estás a oscuras), persigue más lento que el jugador (620 ms frente a 380), no oye, no traspasa puertas cerradas, el fuego no le afecta, el rastreador no le ve y mata al llegar. Apagado se queda de pie y estorba.
- **Peligros** (`game.ts`): vapor (`steaming`, 3,5 s de cada 9 s, cada fuga desfasada), apagón por zonas (`blackout`, se recalcula al restaurar), puertas sin energía (`locked`; la criatura tampoco las fuerza), cuenta atrás (`countdownMs`, aviso de MOTHER cada minuto y a los 30 s; a 0 muerte `blast`), Jones (recogerlo hace `jones`; maúlla cada 22 s y el ruido llega a 3 celdas).
- **Campaña y dificultad** (`campaign.ts`, `difficulty.ts`): `startCampaign`, `advance` (lleva la bolsa, Jones, registros y contadores a la cubierta siguiente; la criatura, las puertas y el material empiezan de nuevo), guardado automático al empezar cada cubierta, `deckScore` para el modo infinito. FÁCIL: criatura 30 % más lenta, ve 5 celdas, regala un señuelo y una bengala por cubierta, +90 s de cuenta atrás. DIFÍCIL: más rápida, ve 8, −45 s. Todas las cubiertas se terminan sin lanzallamas (no abre nada, solo espanta).
- **Historia** (`logs.ts`, `story.ts`): 12 registros originales repartidos por los terminales (3 en C, 2 en B, 3 en LAB, 2 en MAINT, 2 en HANGAR), tres finales (`jones`, `solo`, `blast`) y los mensajes de MOTHER.
- **Pantallas** (`IsolationGame.vue`): título (`[CONTINUAR]`, `[NUEVA CAMPAÑA]`, `[MODO INFINITO]` bloqueado hasta terminar la campaña, `[ARCHIVO]`), dificultad, misión, juego, pausa, informe de cubierta, final. Al ganar una cubierta se crea y se guarda la siguiente de inmediato, así que salir en el informe no pierde nada.

### Fase 5, infinito y extras (hecha, sin probar en el teléfono)

- **Modo infinito** (`generate.ts`): sectores de laberinto con bucles y salas, tamaño creciente hasta 23×17, siempre resolubles (60 semillas × 7 niveles en las pruebas); id `inf:<semilla>:<nivel>`, que es lo único que guarda la partida. A partir del nivel 2 hay una zona a oscuras, en el 3 vapor, en el 4 Ash, desde el 5 apagones periódicos; el lanzallamas aparece cada cuatro niveles.
- **Archivo** (`progress.ts`, `IsolationArchive.vue`): registros leídos, finales vistos, 10 logros (`SIN SER VISTO`, `JONES A SALVO`, `ARCHIVISTA`, `ORDEN 937`, `SIN FUEGO`, `SUPERVIVIENTE`, `VETERANO`, `APAGADO`, `SECTOR 5`, `SECTOR 10`), estadísticas y mejor sector con su semilla; `useIsolationStore.progress` (`widget.isolation.progress`).
- **Plano** (`plan.ts`, `IsolationMap.vue`): el mapa de la cubierta como texto, desbloqueado por cualquier terminal (`[PLANO]`, tecla `m`); nunca muestra a la criatura.
- **Widget** `IsolationWidget` (`registry.ts`, categoría `juegos`, `span: 2`).
- **MOTHER sin API:** `/jugar`, `/partida` (resumen de la partida suspendida o guardada) y `/pista` (`hints.ts`: la célula o la salida más cercana, la puerta sin energía y su panel, Ash y su terminal, la cuenta atrás). El juego no se añade al contexto que se envía a la API. Los mensajes de la partida van también al LOG (`MTR`).

### Pendiente del lado del usuario
- Probar en el teléfono las fases 2 a 5: fluidez, tamaño de las teclas nuevas (`[PLANO]` y la tecla de USAR con textos largos como `APAGAR A ASH`), equilibrio de la cuenta atrás, Ash, el vapor y los apagones, y el modo infinito.
- Las partidas guardadas con la versión anterior (`v: 2`) se leen como sin guardado.

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
