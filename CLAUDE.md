# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The starting point for a recreation of the Android 2.3 **Gingerbread** home screen launcher, built as a web project for [Bridge Launcher](https://github.com/bridgelauncher/launcher). Bridge is an Android app that shows a WebView as the home screen and exposes Android features to it through `window.Bridge`. There is no native Android code here.

This is Bridge's `api-tester` example with the tester UI removed: what's left is the Bridge plumbing (stores, events, dev mock, base styles) and a placeholder `App.vue`. The `base` branch holds this state, and it is also pushed as `main` of the `boilerplate` remote (`njpd57/bridge-launcher-boilerplate`); the full launcher is developed on top of it on `dev` (`origin` is `njpd57/bridge-launcher-gingerbread`).

Stack: Vue 3 (`<script setup>`), TypeScript, Pinia setup stores, VueUse, SCSS, Vite 4 and Vitest. **User-facing text is in Spanish** (`index.html` is `lang="es"`, and so is the README); code and comments are in English.

## Commands

```bash
npm run dev          # Vite dev server; a BridgeMock stands in for window.Bridge (see below)
npm run build        # type-check (vue-tsc) + vite build -> dist/
npm run type-check   # vue-tsc only
npm run test:unit    # vitest in watch mode (jsdom)
npx vitest run --dir src   # all tests once; --dir keeps out the git worktrees under .claude/
```

There are no tests yet. Put them in `src/**/__tests__/` (excluded from `tsconfig.app.json`, included by `tsconfig.vitest.json`).

To run on a device, point Bridge's "project dir" setting at a folder containing the contents of `dist/`. The Vite build uses stable, unhashed asset names (`assets/index.js`), so copying a new `dist/` over the old one is enough. Don't use adb on the phone without asking; the user does device testing.

Keep `.claude/` (other agents' worktrees) out of commits.

## Bridge runtime

- `Bridge` is a global that only exists inside Bridge. In development, `src/mock/injectBridgeMockInDev.ts` installs `BridgeMock` from `@bridgelauncher/api-mock`, which reads its app list and icons from `public/mock/`; calls such as `requestLaunchApp` show an `alert`. Types come from `@bridgelauncher/api` (v0.1.0, the latest). `main.ts` also registers `Bridge` as a Vue global property (typed in `src/BridgeVueGlobalProperty.ts`), so templates can call `Bridge.*` directly.
- **There is a single `window.onBridgeEvent` handler, and `useBridgeEventStore` owns it.** Everything else subscribes with `bridgeEvents.addEventListener(...)`. Never assign `window.onBridgeEvent` anywhere else.
- **Stores follow one pattern:** read the initial value with a `Bridge.get*()` call when the store is created, then update it from the matching `*Changed` event. `useTogglesStore` exposes each setting as a writable `computed` whose setter calls `Bridge.requestSet*()`; the value only changes once Bridge sends the event back.
- **The installed Bridge can lack methods that the API types declare.** Calling a missing method throws, and when that happens while a store is being created, the whole launcher fails to load. Check with `typeof Bridge.someMethod === 'function'` before using a method that hasn't been tried on the device.
- **Known mismatches between stock Bridge and the API types** (found on `dev`; the stores here don't handle them yet):
  - Window insets arrive with top and left swapped: `WindowInsetsSnapshot` is declared `(top, left, right, bottom)` but filled as `(left, top, right, bottom)`, so a 33 px status bar shows up as `left: 33, top: 0`. `App.vue` pads with `statusBars.top`, which is therefore 0 on the device.
  - Window-insets events come as `{ name: 'ImeWindowInsetsChanged', insets }` (Kotlin enum name, value in `insets`), not `{ name: 'imeWindowInsetsChanged', newValue }`, so `useWindowInsetsStore` currently ignores them.
  - `statusBars` insets are 0 while the status bar is hidden; the size it would have is in the `IgnoringVisibility` variants.
- **The API can't** receive back-button events (Bridge forwards back to the WebView history, so `history.pushState` works as a workaround), read notifications, embed native app widgets, or open intents other than launching an app by package name. Don't design features that need them.

## Layout

- `src/main.ts`: loads the global styles, injects the mock, creates the app with Pinia.
- `src/App.vue`: `.launcher-root`, padded by the status and navigation bar insets, with a placeholder.
- `src/stores/`: `useAppsStore` (installed apps as a `Map` keyed by package name, fetched from `Bridge.getAppsURL()`, kept in sync with `appInstalled` / `appChanged` / `appRemoved`; each app gets a `labelSimplified` for searching), `useWindowInsetsStore`, `useTogglesStore`, `useBridgeEventStore`.
- `src/utils/`: `px()` for inline styles, `simplifyString()` (lowercase, ASCII letters and digits only).
- `src/assets/styles/`: `page.scss` (html/body/#app full size, transparent so the system wallpaper can show), `base.scss` (the `.launcher-root` look: dark, white Droid Sans text, no tap highlight, no text selection). `shared/vars.scss` holds durations and easing curves, and Vite injects it into every SCSS block, so its variables are available without importing.
- `@/` is an alias for `src/`.
