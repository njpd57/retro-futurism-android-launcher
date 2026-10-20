# AISLAMIENTO libre: plan revisado (movimiento continuo)

## Context

AISLAMIENTO (campaña de 5 cubiertas y modo infinito) está completo y desplegado con movimiento por celdas (`player.cell` + `dir` de 4 valores + `busyMs`). El usuario quiere pasar todo a movimiento libre como MARINES. Existe un primer plan en `docs/AISLAMIENTO_LIBRE.md`; esta revisión lo contrasta con el código real (dos auditorías: piezas reutilizables de MARINES y puntos de AISLAMIENTO atados a la rejilla) y corrige errores. Tras la aprobación, `docs/AISLAMIENTO_LIBRE.md` se sustituye por esta versión.

Motivo del cambio: el sigilo es más tenso y la vista subjetiva más natural con movimiento analógico; la cámara ya lo permite. Resultado buscado: jugador, criatura y Ash en posiciones continuas, mapas y generador de rejilla sin cambios, joystick + arrastre como MARINES.

## Qué cambia respecto al plan anterior

Correcciones confirmadas por la auditoría:

1. **Velocidades erróneas.** Hoy el jugador anda a 380 ms/celda = **2,63 celdas/s** (atrás 520 ms = 1,92). La criatura: caza 420 ms = 2,38 c/s (el jugador apenas la supera), investigar 650, buscar 900, patrullar 1100, huir 380. Ash: perseguir 620 ms = **1,6 c/s**, vagar 1500 ms. El plan decía 1,6 y 0,9. Se convierten todas las constantes a celdas/s conservando esas proporciones.
2. **La física de MARINES ya es compartible sin cambios de lógica.** `marines/physics.ts` solo importa `blocks`/`Grid` de `isolation/grid` y `castRay` de `wire/occlusion`; exporta `moveCircle`, `collides`, `lineClear` (LOS entre dos puntos con un rayo), `forward`, `right`, `angleTo`, `angleDiff`. Basta moverlo a `wire/physics.ts` y dejar un re-export en MARINES.
3. **La visión puede usar `lineClear`/`castRay`** más alcance y ángulo (`angleDiff`/`angleTo`). Un rayo es infinitamente fino: usar 3 rayos desplazados ±r para que la criatura no vea por rendijas por las que el jugador no cabe.
4. **`stepAlien` y `stepAsh` se reescriben**, no se adaptan: usan un temporizador `stepMs` por celda y `nextStep` por BFS.
5. **`view.ts` sí cambia** (el plan decía «sin cambios»): la oscuridad muestra «solo la celda siguiente» según los pasos desde la celda del jugador; en libre es la celda hacia donde mira. `cellPose` desaparece, `mountWall` sigue colocando taquillas y terminales.
6. **Puertas:** la criatura fuerza una puerta cerrada 4000 ms (`forceMs`) y la quita de `closed`; en libre necesita un estado «esperando en la puerta» a su lado y no puede abrirla con el jugador dentro. Las `X` siguen siendo infranqueables para todos. `useAction` hoy rechaza cerrar una puerta con la criatura encima: se conserva con distancia.
7. **Taquillas:** la muerte se decide por `a.cell === p.cell` + `entered`, `sawHide`, `hides[cell]`. Regla nueva: el jugador escondido queda fijo en el centro de su celda; la criatura lo mata solo si **entra en esa celda** (misma regla de hoy con `cellOf`); estando oculto es invisible para `canSee`. `hides` sigue por celda.
8. **Vapor:** además de bloquear entrar en una celda con fuga, hay que decidir qué pasa si empieza con el jugador dentro. Decisión: no mata; el jugador sale empujado a la celda libre contigua y suena el aviso (no hay daño en el juego actual).
9. **Pasillos de una celda:** el cuerpo del jugador (radio 0,22) cabe, pero las fugas de vapor, puertas y esquinas se sienten estrechas; resuelto escalando los mapas a 2×2 (ver «Decisiones del usuario»).
10. **Recogidas y salida:** hoy son «entrar en la celda». Equivalentes continuos: recoger loot/células a menos de 0,45 celdas del centro; la salida se activa dentro de su celda; la cuenta atrás no cambia.
11. **Terminales:** hoy el jugador gira hacia el muro (`mountWall`) y queda bloqueado 3 s. En libre: se ajusta `yaw` al muro al empezar, se cancela si el jugador se mueve más de 0,3 celdas o gira, y el guardado ocurre dentro de la celda del terminal (`roles[cell]`, `finishTerminal` usan la celda). Taquillas y terminales actúan sobre la celda actual (no sobre la de delante); solo las puertas miran delante.
12. **Rastreador y cercanía:** `alienDistance`, `near`, `pingInterval` y el latido miden hasta el centro de la celda del jugador (+0,5); pasan a la posición real.
13. **Faltaba en el plan:** `hints.ts` (`here = player.cell`) y por tanto `/pista` y `/partida` en `useMotherStore.ts` (leen `SavedGame.player.cell`), `plan.ts` (cuantizar `yaw` a una flecha), `IsolationWidget` (solo lee el guardado: cambia lo mínimo), la sección «Convenciones» de `docs/AISLAMIENTO.md`, y reemplazar `lineOfSight` también en Ash.
14. **Pruebas:** ~45–60 de las 147 requieren reescritura (`game.spec` 35 líneas afectadas, `tools.spec` 22, `campaign.spec` 15, `grid.spec` 13, `decks.spec` 8, `generate.spec` 7, `view.spec` 6, `save.spec` 5, `plan.spec` 1). `grid.ts` (`neighbour`, `lineOfSight`, `soundDistance`, `nextStep`, `mountWall`) se conserva: lo usan generador, pistas, dibujo y las pruebas de decks.

## Diseño (resumen)

**Mundo y física** — `src/games/wire/physics.ts` (movido desde `marines/physics.ts`); `cellOf(x, y)`. Radios: jugador 0,22; criatura 0,3; Ash 0,25.

**Jugador** — `player: { x, y, yaw, hidden, usingMs }`; `step(state, dt, controls, rng)` en trozos ≤50 ms sobre una copia (patrón de `marines/game.ts`); `controls { forward, strafe, turn, ... }`. Velocidad máxima 2,63 c/s; con el joystick poco inclinado se anda despacio y se hace menos ruido (ruido = base × inclinación). Se suprimen `TURN_MS`, `WALK_MS`, `BACK_MS`, `fromPose/animMs` y el modo «mantener para andar».

**Sentidos** — `src/games/isolation/senses.ts` (puro): `canSee` (3 rayos, alcance 7 celdas/2 a oscuras/dificultad, ángulo ±70°, ×0,6 si va despacio; escondido = invisible) y `hearing` (reutiliza `soundDistance` entre las celdas de origen y destino; `NOISE` y `doorCost` iguales).

**Criatura y Ash** — posición continua `x, y` + `heading`; velocidades en celdas/s derivadas de las actuales; camino por campo de distancias (`buildField`/`downhill` de `marines/enemies.ts` o BFS propio) con `moveCircle`; vista de Ash ±45°. Se mantienen modos, `lockerCheckChance`, `sawHide`, conductos (`vent` por celdas), `flee`/`scare`, `ventPlan`, puertas forzadas con espera, `locked`. Mata por contacto de círculos (criatura/Ash con jugador), salvo oculto (regla de la taquilla).

**Herramientas** — lanzamiento por `castRay` hasta 5 celdas o pared; llama en cono de 3 celdas y ±20° con `lineClear`; bengalas y oscuridad por celda del cuerpo (`isLit(cellOf(x,y))`); `landing`/`flameCells` se reescriben.

**Vista y controles** — pose directa `{x, y, yaw}`; `IsolationControls` se rehace como `MarinesControls` (joystick con `stickAxes` de `marines/stick.ts`, arrastre para girar, teclas por `touchstart` con `preventDefault`); sensibilidad en `widget.isolation.prefs`.

**Guardado** — `v: 4` con `player { x, y, yaw, hidden }`, criatura/Ash `{ x, y, heading, ... }`; las `v: 3` se leen como sin guardado.

## Decisiones del usuario

- Alcance: **todo** (fases 0-7), no la versión intermedia.
- Mapas: **escalar a 2×2 desde el principio.** Cada celda actual pasa a un bloque de 2×2; el mundo duplica su tamaño en celdas. Consecuencias que el plan ya recoge:
  - Todas las distancias que hoy están en celdas se duplican (alcances de vista y oído, `NOISE`, radio de bengala, alcance del lanzallamas y del lanzamiento, `VIEW_DEPTH`, tolerancias de interacción) y las velocidades en celdas/s también, para conservar el ritmo actual. Radios de cuerpo: jugador 0,22 → se mantiene (ahora cabe holgado en pasillos de 2).
  - **Puertas y rasgos:** una `D` de una celda dejaría un hueco en un pasillo de 2. `scaleMap` (nuevo, puro, en `grid.ts`) expande cada carácter con reglas: pared/suelo/loot/célula/inicio → bloque de 2×2 (loot y célula en la celda inferior-izquierda); puertas `D/d/X` → ocupan las 2 celdas de ancho del pasillo (2 celdas en la dirección transversal); taquillas, terminales y conductos → 1 de las 2 celdas contra el muro; vapor `~` → 2 celdas; carteles se reasignan a la celda y pared equivalentes. Una prueba comprueba que el mapa escalado conserva alcanzabilidad, el recuento de rasgos y que ninguna puerta deja hueco.
  - El generador (`generate.ts`) produce el mapa en la rejilla pequeña y aplica `scaleMap` al final; las pruebas de resolubilidad se ejecutan sobre el mapa escalado.
  - La cámara asume celdas de 1 unidad con altura de pared fija: con pasillos de 2 unidades de ancho y techo de 1 se verán más anchos que altos. Hay que comprobar el aspecto con una captura (fase 0) y, si no gusta, escalar la altura de pared/ojo en `createCamera` (parámetro nuevo, MARINES no cambia).
  - Rendimiento: 4× más celdas; `visibleCells` y `buildLevel` ya recortan por profundidad (`VIEW_DEPTH`), pero medir en el teléfono.
  - `hints.ts` y `plan.ts` cuentan «pasos»/celdas: dividir por 2 al mostrarlos; el plano dibuja la rejilla escalada con la mitad de tamaño de letra o por bloques.

## Estado

Hechas las fases 0 (escalado, ya conectado en `deckFor`/`playable`), 1, 2, 3 (jugador libre), 4 (criatura y Ash continuos) y 5 (controles táctiles). Fase 6: ya estaba cubierta por las fases 3-4 y se ha comprobado: el lanzamiento usa `landing` (rayo hasta 5 celdas o pared), el lanzallamas `flameCells` (cono con `lineClear`), el vapor empuja hacia fuera al jugador que ya está dentro (prueba en `campaign.spec.ts`), el guardado es `v: 4`, `plan.ts` cuantiza `yaw` a una flecha, `hints.ts` usa `playerCell` y divide por `SCALE`, y `/pista` y `/partida` de MOTHER leen el guardado sin cambios. Pendiente: 7 (equilibrio en el teléfono y documentación general). Fase 5: `IsolationControls` es un joystick (`stickAxes` de MARINES) más USAR, RASTREADOR, FUEGO, SEÑUELO y BENGALA (actúan en `touchstart`); un arrastre sobre la vista gira (`aimPixels`, `TURN_PER_PX`, sensibilidad en `widget.isolation.prefs`, botón en la pausa); WASD y flechas siguen valiendo en escritorio. Fase 4: `Alien`/`Ash` tienen `x, y, heading` opcionales (sin ellos, o si `cell` no coincide, se colocan en el centro de la celda: `placed`); `cell` sigue siendo la celda que ocupan. Ven en cono (±70° la criatura, ±45° Ash; todo alrededor mientras cazan), cazan andando en línea recta hacia lo que ven y si no siguen el camino BFS; fuerzan puertas esperando junto a ellas (la pareja de celdas entera); matan por contacto (`CONTACT`) o, si el jugador está en una taquilla, al entrar en su celda. Notas de lo implementado: pasos por zancada (`MOVE.stride`) con ruido `NOISE.step × inclinación`; `useAction` busca puertas delante a 1,4 celdas y taquillas/terminales en la celda o mirándolas a 1,1; una puerta son 1-2 celdas (`doorGroup`); el vapor ocupa un bloque 2×2; el guardado es `v: 4`; los controles táctiles actuales son teclas mantenidas (el joystick llegó en la fase 5). `walkthrough.spec.ts` recorre con un bot las 5 cubiertas y 24 sectores generados.

## Fases (cada una jugable y con pruebas pasando)

0. **Escalado.** `scaleMap` y mapas de las 5 cubiertas y del generador a 2×2 con el modo por celdas actual como prueba (el juego debe poder terminarse igual); captura en Chrome headless para juzgar proporciones y ajustar la altura de pared si hace falta.
1. Mover la física a `wire/physics.ts`; MARINES intacto (sus pruebas pasan sin tocarlas).
2. `senses.ts` con pruebas (esquina, puerta, ángulo, oscuridad, despacio, rendijas).
3. Jugador libre + interacción por proximidad + taquillas + terminales + recogidas/salida; criatura y Ash aún por celda usando `cellOf`. Versión intermedia jugable.
4. Criatura y Ash continuos (patrulla, caza, búsqueda, puertas, taquillas, conductos, huida) con simulaciones de RNG fija.
5. Controles y vista táctiles (joystick, arrastre, ajustes, pausa).
6. Mundo: lanzamiento, cono del lanzallamas, vapor, guardado `v: 4`, `plan.ts`, `hints.ts`, MOTHER.
7. Equilibrio en el teléfono (velocidades, rangos, ruido), ensanchar pasillos si hace falta, y documentación (`AISLAMIENTO.md`, `CLAUDE.md`, `README.md`, `FEATURES.md`).

Archivos principales: `src/games/isolation/{game,alien,android,view,save,hints,plan,senses}.ts`, `src/games/wire/physics.ts`, `src/components/isolation/{IsolationGame,IsolationControls,IsolationView}.vue`, `src/games/isolation/__tests__/*`.

## Verificación

- `npx vitest run --dir src`, `npm run type-check`, `npm run build` en cada fase.
- Prueba de recorrido: un jugador automático sigue el camino BFS en libre y llega a la salida de las 5 cubiertas y de 50 sectores generados (detecta atascos por radio/puertas).
- Simulaciones con RNG fija de la IA; captura en Chrome headless (técnica de `docs/AISLAMIENTO.md`) y prueba en el teléfono por el usuario. Sin deploy ni commit sin que lo pida.

## Riesgos

Equilibrio del sigilo en salas abiertas; atascos en pasillos de una celda; rendimiento de los rayos (medir en el teléfono); toques sobre canvas no corregidos por la curvatura (mantener el límite); es el mayor trabajo desde la fase 4.
