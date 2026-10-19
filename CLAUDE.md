# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A boilerplate for building home screen launchers as web projects for [Bridge Launcher](https://github.com/bridgelauncher/launcher). Bridge is an Android app that shows a WebView as the home screen and exposes Android features to it through `window.Bridge`. There is no native Android code here.

This is Bridge's `api-tester` example with the tester UI removed: what's left is the Bridge plumbing (stores, events, dev mock, base styles) and a placeholder `App.vue`.

Stack: Vue 3 (`<script setup>`), TypeScript, Pinia setup stores, VueUse, SCSS, Vite 4 and Vitest. **User-facing text is in Spanish** (`index.html` is `lang="es"`, and so is the README); code and comments are in English.

## Commands

```bash
npm run dev          # Vite dev server; a BridgeMock stands in for window.Bridge (see below)
npm run build        # type-check (vue-tsc) + vite build -> dist/
npm run type-check   # vue-tsc only
npm run deploy       # build + adb push dist/ to /sdcard/projects/crt-launcher (override with REMOTE_DIR)
npm run test:unit    # vitest in watch mode (jsdom)
npx vitest run --dir src   # all tests once; --dir keeps out the git worktrees under .claude/
```

Tests live in `src/**/__tests__/` (pure logic only so far; excluded from `tsconfig.app.json`, included by `tsconfig.vitest.json`).

To run on a device, point Bridge's "project dir" setting at a folder containing the contents of `dist/`. The Vite build uses stable, unhashed asset names (`assets/index.js`), so copying a new `dist/` over the old one is enough. Don't use adb on the phone without asking; the user does device testing.

Keep `.claude/` (other agents' worktrees) out of commits.

## Bridge runtime

- `Bridge` is a global that only exists inside Bridge. In development, `src/mock/injectBridgeMockInDev.ts` installs `BridgeMock` from `@bridgelauncher/api-mock`, which reads its app list and icons from `public/mock/`; calls such as `requestLaunchApp` show an `alert`. Types come from `@bridgelauncher/api` (v0.1.0, the latest). `main.ts` also registers `Bridge` as a Vue global property (typed in `src/BridgeVueGlobalProperty.ts`), so templates can call `Bridge.*` directly.
- **There is a single `window.onBridgeEvent` handler, and `useBridgeEventStore` owns it.** Everything else subscribes with `bridgeEvents.addEventListener(...)`. Never assign `window.onBridgeEvent` anywhere else.
- **Stores follow one pattern:** read the initial value with a `Bridge.get*()` call when the store is created, then update it from the matching `*Changed` event. `useTogglesStore` exposes each setting as a writable `computed` whose setter calls `Bridge.requestSet*()`; the value only changes once Bridge sends the event back.
- **Target platform is our Bridge fork** ([njpd57/bridge-launcher](https://github.com/njpd57/bridge-launcher)), not stock Bridge. The fork adds methods, events and fixes on top of the stock API; `BRIDGE_LAUNCHER_GUIDE.md` is the reference for both (stock API in section 4, fork API in section 5). Read it before building a feature on `Bridge.*`.
- **The fork's methods are not in `@bridgelauncher/api` (v0.1.0, the latest).** They are declared by module augmentation in `src/types/bridge-fork.d.ts` (only `getWindowInsetsSwapFixed`, `getBattery`, `getConnectivity` and their events so far), faked by `ForkBridgeMock` in `src/mock/injectBridgeMockInDev.ts`, and called behind `bridgeHas()` (`src/utils/bridgeHas.ts`) with a web fallback (`useSystemStatusStore`). When you add a fork method, keep the three in sync with the Kotlin name.
- **Calling a method the installed Bridge doesn't have throws**, and when that happens while a store is being created, the whole launcher fails to load. Check with `typeof Bridge.someMethod === 'function'` before using a method that hasn't been tried on the device. `useSystemStatusStore` is guarded; the older stores (`useTogglesStore`, `useWindowInsetsStore`) still call their getters unguarded.
- **Window insets:** the fork fixes the stock bugs (top and left swapped, window-insets events as `{ name: 'ImeWindowInsetsChanged', insets }` instead of `{ name: 'imeWindowInsetsChanged', newValue }`), and `Bridge.getWindowInsetsSwapFixed()` is present only on the fork. `useWindowInsetsStore` doesn't yet accept the stock event format or unswap, so it only works as intended on the fork. Also, `statusBars` insets are 0 while the status bar is hidden; the size it would have is in the `IgnoringVisibility` variants.
- **The API can't** receive back-button events (Bridge forwards back to the WebView history, so `history.pushState` works as a workaround), embed native app widgets, or open intents beyond the ones the guide lists (launch by package, the supported URL schemes, app shortcuts). Notifications can be read only through the fork. Don't design features that need anything else.

## Layout

- `src/main.ts`: loads the global styles, injects the mock, creates the app with Pinia.
- `src/App.vue`: composes the screen (top bar, app list, prompt, help line) inside `CrtScreen`, handles overlays (settings, app menu) with `history.pushState`/`popstate` for back and `newIntent` for home, and forces an opaque page with no overscroll glow (restoring Bridge's previous values on teardown).
- `src/components/`: also `Dashboard` (the PANEL tab: a grid of `TuiPanel`s) and `widgets/` (`ClockWidget`, `PowerWidget`, `LinkWidget`, `AppShortlistWidget`, `ScopeWidget` (canvas, paused on `beforePause`), `LogWidget`).
- `src/components/` (rest): `CrtScreen` (phosphor palette, `--bloom`, CRT overlay), `TopBar`, `AppList` / `AppRow` (long press via `src/composables/useLongPress.ts`), `PromptBar`, `TermMenu` / `MenuItem`, `SettingsPanel`.
- `src/stores/`: `useAppsStore` (installed apps as a `Map` keyed by package name, fetched from `Bridge.getAppsURL()`, kept in sync with `appInstalled` / `appChanged` / `appRemoved`; each app gets a `labelSimplified` for searching), `useWindowInsetsStore`, `useTogglesStore`, `useBridgeEventStore`, `useSettingsStore` (phosphor color, bloom, effects, hidden apps, favorites, active tab; persisted in localStorage), `useLaunchStore` (the only place that calls `requestLaunchApp`; keeps recents), `useSystemStatusStore` (battery and connectivity), `useLogStore` (ring buffer for the log widget).
- `src/utils/`: `px()` for inline styles, `simplifyString()` (lowercase, accents stripped, ASCII letters and digits only), `searchApps()` (ranked search, pure and tested), `appTypeLabel()`, `tui.ts` (bars, sparklines, formatting), `recents.ts`, `bridgeHas.ts`.
- `src/assets/styles/`: `page.scss` (html/body/#app full size), `base.scss` (the `.launcher-root` look: VT323 in the phosphor color with bloom, no tap highlight, no text selection), `crt.scss` (the amber/green palettes as CSS variables; add a color by adding a block). `shared/vars.scss` (durations, easing) and `shared/mixins.scss` (`glow`, `box-glow`, `inverse`) are injected by Vite into every SCSS block, so they're available without importing.
- `BRIDGE_LAUNCHER_GUIDE.md`: technical guide to the stock and fork APIs, event hub, insets, launcher architecture and pitfalls.
- `@/` is an alias for `src/`.
