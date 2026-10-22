# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A retro-futurist Android home screen: a **CRT terminal from a spaceship**, in the spirit of the computers in *Alien* and *Alien: Isolation* (phosphor text, scanlines, inverse-video windows, a ship's computer called MOTHER). It is a web project that runs as the home screen of [Bridge Launcher](https://github.com/bridgelauncher/launcher), an Android app that shows a WebView and exposes Android features to it through `window.Bridge`. There is no native Android code here (the Kotlin lives in our Bridge fork, see below).

It started from Bridge's `api-tester` example, but it is now its own product: a three-tab launcher (PANEL / APPS / MOTHER) with a window-based dashboard, notifications, media, agenda, weather, an AI chat and two minigames.

Stack: Vue 3 (`<script setup>`), TypeScript, Pinia setup stores, VueUse, SCSS, Vite 4 and Vitest. **User-facing text is in Spanish** (`index.html` is `lang="es"`, and so is the README); code and comments are in English.

## Art direction

Every change should feel like it belongs to the same machine. When in doubt, ask: *would this appear on a 1979 starship terminal?*

- **The 3D ship is the exception: it is in colour** (clean Alien: Isolation look: cream panels, orange padding, graphite doors), and only its CRT monitors and holographic crew stay phosphor. Its colours live in `src/ship3d/materials.json`; `settings.shipColor` = `phosphor` paints it in one tint. No rust, cracks or decay. See `docs/SHIP_PANEL.md`.
- **Phosphor, not colors.** The whole UI is one color on near-black: `--ph` (text), `--ph-dim` (secondary), `--ph-bg` (background), `--ph-glow` (bloom). Palettes: amber (default), green, white P4, blue, red; they are blocks in `src/assets/styles/crt.scss`. Never hardcode a hex color in a component; use the variables so every palette works. Hierarchy comes from brightness (`--ph` vs `--ph-dim`), inverse video and borders, not from hues.
- **Light is the effect.** Text and boxes glow through the `glow` / `box-glow` mixins, scaled by `--bloom`. Active or selected things are **inverse video** (`@include inverse`: dark text on a lit block), also for `:active` feedback on anything tappable.
- **The screen is a tube.** `CrtScreen` draws the overlay: scanlines, vignette, flicker, a slow sweep band, optional curvature (an SVG `feDisplacementMap` barrel distortion that moves what is painted, not hit-testing; `CrtScreen` corrects `click` with `correctPoint`, canvas games are not corrected, so the bend is capped and must be tested near the edges on the device), degauss, switch off / on and phosphor persistence. All of it is user-toggleable and is turned off or frozen under `prefers-reduced-motion`. Details and settings: `docs/CRT_TUBE.md`.
- **Type and glyphs.** One font, VT323, large (22px base). Interface labels are in **UPPERCASE Spanish, terse and technical** (`SIN ACCESO AL CALENDARIO`, `[CONCEDER]`, `PUERTAS ▓▓░`), as a ship's computer would say them. Use box-drawing and block characters (`▓░█▁▂▃`, `◉`, `»`, `[ ]`/`[X]`) for bars, sparklines, toggles and radar instead of icons or images. Buttons that act are written `[ASÍ]`.
- **Windows, not cards.** Content lives in `TuiWindow`: a bordered frame with an inverse title bar and a decorative text scrollbar. Menus are windows too (`TermMenu`). No rounded corners, shadows or gradients on components, except the deliberate CRT ones.
- **Motion is mechanical.** Blinking cursors, `steps()` blinks, sweeping lines, data chirps; no easing-heavy or springy UI animation. Canvases and timers must stop on `beforePause` (see `ScopeWidget`).
- **Sound is synthesized and off by default.** Key clicks, square-wave beeps and a low terminal hum with random data chirps, all from Web Audio (`src/audio/`). Never add audio files, and never play sound unless the user enabled it (alarms and game events the user started are the exception).
- **Tone of voice.** MOTHER answers in uppercase, ship-computer style. The Nostromo text adventure and the motion-tracker game are the in-world easter eggs; new content should keep that fiction rather than add generic UI.
- **Restraint.** The aesthetic works because it is sparse: one color, few glyphs, lots of black. Prefer removing decoration to adding it, and keep text legible (contrast between `--ph` and `--ph-bg` must hold in every palette).

## Games are finished

AISLAMIENTO, MARINES and the dashboard minigames (`TrackerWidget`, `RerouteWidget`, `NostromoWidget`) are done and the user has tested them. **Don't touch them** (`src/games/`, `src/components/isolation/`, `src/components/marines/`, their widgets, stores and docs) unless the user asks for a plan or a change specific to that game. A general refactor, restyle or cleanup (new gauges, widget sizes, palette work, shared utilities) must leave them as they are; if a shared piece they depend on has to change, say so first and check their tests still pass.

## Commands

```bash
npm run dev          # Vite dev server; a BridgeMock stands in for window.Bridge (see below)
npm run build        # type-check (vue-tsc) + vite build -> dist/
npm run type-check   # vue-tsc only
npm run deploy       # build + adb push dist/ to /sdcard/projects/crt-launcher (override with REMOTE_DIR)
npm run test:unit    # vitest in watch mode (jsdom)
npx vitest run --dir src   # all tests once; --dir keeps out the git worktrees under .claude/
```

**Tests are not a concern here: don't run them and don't write new ones** (not after a change, not for a new feature, not to confirm a fix). `npm run type-check` is the only automated check to run. The existing tests stay in the repo as they are.

Tests live in `src/**/__tests__/` (pure logic only: utils, mother, games; excluded from `tsconfig.app.json`, included by `tsconfig.vitest.json`). DOM, canvas, gestures and sound are checked by hand in the dev server and on the device.

To run on a device, point Bridge's "project dir" setting at a folder containing the contents of `dist/`. The Vite build uses stable, unhashed asset names (`assets/index.js`), so copying a new `dist/` over the old one is enough. Don't use adb on the phone without asking; the user does device testing.

Keep `.claude/` (other agents' worktrees) out of commits.
## Bridge runtime

- `Bridge` is a global that only exists inside Bridge; in development `ForkBridgeMock` (`src/mock/injectBridgeMockInDev.ts`) stands in. `main.ts` also registers it as a Vue global property.
- **A single `window.onBridgeEvent` handler, owned by `useBridgeEventStore`.** Everything else subscribes with `bridgeEvents.addEventListener(...)`. Never assign `window.onBridgeEvent` elsewhere.
- **Stores follow one pattern:** read the initial value with a `Bridge.get*()` call when the store is created, then update it from the matching `*Changed` event (re-read on `afterResume` if the permission can change outside Bridge). `useTogglesStore` exposes settings as writable `computed`s whose setter calls `Bridge.requestSet*()`; the value changes only when Bridge sends the event back.
- **Target is our Bridge fork** ([njpd57/bridge-launcher](https://github.com/njpd57/bridge-launcher), at `~/Projects/bridge-launcher`), not stock Bridge. `BRIDGE_LAUNCHER_GUIDE.md` is the reference (stock API section 4, fork API section 5, extending the fork section 11); read it before building on `Bridge.*`.
- **Fork methods are not in `@bridgelauncher/api`.** Keep three things in sync with the Kotlin name: the module augmentation in `src/types/bridge-fork.d.ts`, `ForkBridgeMock`, and the call behind `bridgeHas()` (`src/utils/bridgeHas.ts`) with a web fallback; also add it to `DIAGNOSTIC_METHODS` in `SettingsPanel`.
- **Calling a method the installed Bridge lacks throws**, and inside a store setup that breaks the whole launcher. Guard with `bridgeHas()` anything not tried on the device. The older `useTogglesStore` and `useWindowInsetsStore` still call getters unguarded.
- **The API can't** receive back-button events (use `history.pushState`), embed native widgets, or open intents beyond the guide's list. Notifications need the fork; app shortcuts need Bridge as default launcher. Don't design features that need more.

## Where to look

Read the matching doc before touching an area:

- `docs/ARCHITECTURE.md`: layout, dashboard and widget registry, settings page, stores, utils, protocols, quarantine, MOTHER, APPS folders and deck map, image viewer, command assist, audio.
- `docs/SHIP_PANEL.md`: the 3D ship PANEL (`src/ship3d/`, `components/ship/`) and the bridge console.
- `docs/SHIP_EDITOR.md`: the dev-only map and asset editor (`npm run ship:edit`): `src/ship3d/ship.json` (the plan: rooms, doorways, props, monitors, lights) that `world.ts` expands, `materials.json` (the detail textures in `public/ship/` and what each material makes of them) and `prefabs.json` (objects made of boxes and cylinders). Change the map, materials and prefabs there, not with literals in `world.ts` or `shaders.ts`.
- `docs/SHIP_MODELS.md`: which file in `src/ship3d/mesh/` builds each piece of the ship, the mesh conventions, and how to see it (`scripts/ship-shot.sh`) and check it (`npm run ship:check`).
- `docs/GAMES_ENGINE.md`: AISLAMIENTO, MARINES and the shared wire engine (finished; see "Games are finished").
- `docs/CRT_TUBE.md`: curvature, degauss, tube power, phosphor persistence.
- `@/` is an alias for `src/`. Adding a widget: component in `src/components/widgets/` plus one line in `src/widgets/registry.ts` (see ARCHITECTURE).

## Gotchas

- **Vector widgets:** SVG for widgets that redraw a few times per second (radar, moon, compass: DOM hit-testing, theme through `var(--ph)`, scales with its cell), canvas for fast animations and games (`ScopeWidget`, `TrackerWidget`). Geometry (paths, positions) lives in pure, tested functions in `utils/`; the component only paints it. Bars, signal levels and sparklines in widgets are the SVG components in `src/components/gauges/` (`GaugeBar`, `SignalBars`, `Sparkline`; geometry in `utils/gauge.ts`), not `bar()` / `sparkline()` text; those text helpers remain for the games' HUDs, the folder boxes and the status bar.
- **`useLocalStorage(key, null)` corrupts objects.** VueUse picks its "any" serializer for a `null` default, which writes `String(value)`: an object is saved as `"[object Object]"` and comes back as a string after a reload (this blanked the weather widgets). For nullable objects or numbers pass `{ serializer: nullableJson(isX) }` from `utils/storage.ts`, which stores JSON and reads anything invalid as `null`.
- **Text fields:** use `TermInput` (not `v-model` on an `<input>`). `v-model` ignores `input` events while an Android keyboard composes a word, so the value is stale until a space or on Enter; `TermInput` reads the element's own value and sets `enterkeyhint` so Enter doesn't jump the focus to the next field (it used to land in the prompt at the bottom).
- **A widget that throws** shows `FALLO DE VENTANA` (`WidgetBoundary`, wrapped around each widget by `Dashboard`) and logs it, instead of rendering blank. Read Bridge JSON getters with `readJson()` (`utils/safeJson.ts`).
- **Backup** (`utils/backup.ts`) only carries localStorage keys starting with `settings.` or `widget.`. A new persisted setting under another prefix will not be backed up; `mother.*` and `apps.firstSeen` are deliberately left out.
- **App install dates** are not in the Bridge API: `useAppsStore.firstSeen` records when the launcher first saw each package (the first scan marks everything as old).
- **Gestures** use touch events, not pointer events (pointer events get cancelled once the browser starts scrolling). Put `data-no-swipe` on any new element that handles its own horizontal drags.
- **Scrolling:** the dashboard is the scroll container; a window body (`TuiWindow .body`) scrolls only when it exceeds 45vh. Don't put `overscroll-behavior: none` or `touch-action: none` on anything inside a widget, or a drag that starts there won't scroll the dashboard. Handle taps with `click`, not `pointerdown`, on widget surfaces.
- **Audio** needs a user gesture before it starts (`useSoundStore` unlocks on the first pointer or key event) and is suspended on `beforePause`.
- **Reduced motion:** any new looping animation must respect `prefers-reduced-motion`.
