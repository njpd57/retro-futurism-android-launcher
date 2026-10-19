# Ideas para más adelante

Cosas que quedaron fuera de la v1 (pantalla única tipo terminal, ámbar/verde, bloom y scanlines).

## Apariencia
- **Iconos monocromos** junto al nombre de cada app: el icono real pasado a un solo color de fósforo con filtros CSS (`grayscale`, `sepia`, `hue-rotate`, `brightness`) o con `mix-blend-mode`. Debe ser una opción en los ajustes, no sustituir a la vista de solo texto.
- **Curvatura de pantalla**: bordes redondeados y distorsión de barril aproximada. Ojo con los toques en los bordes y con el rendimiento.
- **Más colores**: blanco P4 (monitor blanco y negro), azul, rojo. Basta con otro bloque de variables en `src/assets/styles/crt.scss`.
- **Efecto de encendido y apagado** del CRT (línea que se expande al abrir el launcher).
- **Banda de barrido** lenta que recorre la pantalla.

## Pantallas
- **Ventanas flotantes arrastrables** que se solapan libremente, como en la imagen de referencia, con la posición guardada. Hoy las ventanas van en una rejilla y se reordenan con EDITAR.
- **Más widgets**: radar ASCII, almacenamiento, contactos favoritos, tiempo de pantalla, temporizador.

## Sistema
- Más métodos del fork (almacenamiento, atajos de apps, contactos…): añadirlos a `src/types/bridge-fork.d.ts` y a `ForkBridgeMock`.
- Sonidos de teclado y de selección.
