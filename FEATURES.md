# Ideas para más adelante

Cosas que quedaron fuera de la v1 (pantalla única tipo terminal, ámbar/verde, bloom y scanlines).

## Apariencia
- **Iconos monocromos** junto al nombre de cada app: el icono real pasado a un solo color de fósforo con filtros CSS (`grayscale`, `sepia`, `hue-rotate`, `brightness`) o con `mix-blend-mode`. Debe ser una opción en los ajustes, no sustituir a la vista de solo texto.
- **Curvatura de pantalla**: bordes redondeados y distorsión de barril aproximada. Ojo con los toques en los bordes y con el rendimiento.
- **Más colores**: blanco P4 (monitor blanco y negro), azul, rojo. Basta con otro bloque de variables en `src/assets/styles/crt.scss`.
- **Efecto de encendido y apagado** del CRT (línea que se expande al abrir el launcher).
- **Banda de barrido** lenta que recorre la pantalla.

## Pantallas
- **Más paneles** para el dashboard: radar ASCII, calendario, alarma, reproductor, notificaciones, almacenamiento. El dashboard base (reloj, energía, enlace, señal, favoritas, recientes y log) ya existe.
- **Barra de estado propia** (ocultando la del sistema) con hora, batería y red. Necesita métodos del fork que aún no usamos.

## Sistema
- Más métodos del fork (notificaciones, calendario, alarma…): añadirlos a `src/types/bridge-fork.d.ts` y a `ForkBridgeMock`.
- Sonidos de teclado y de selección.
