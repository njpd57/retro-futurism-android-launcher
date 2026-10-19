# Building a launcher on Bridge Launcher: technical guide for agents

This document is everything an agent needs to build a complete Android home screen launcher as a **web project** that runs inside [Bridge Launcher](https://github.com/bridgelauncher/launcher), using either stock Bridge or our fork ([njpd57/bridge-launcher](https://github.com/njpd57/bridge-launcher)). It is design-agnostic: it says what the platform gives you, what it can't do, and the pitfalls that cost time. It does not prescribe a look.

Conventions: **[stock]** = exists in upstream Bridge and in `@bridgelauncher/api` types. **[fork]** = only in our fork; the published types don't declare it. Anything not marked is a general rule.

---

## 1. What Bridge is

Bridge is an Android app registered as a home screen (launcher). Instead of native UI it shows a **WebView** that loads a user-chosen folder of static files (HTML/JS/CSS): your project. Android features are exposed to the page through a global `window.Bridge` (calls) and a single global callback `window.onBridgeEvent` (events pushed to the page).

There is **no native code in your project**. Everything is HTML, CSS and JS. Anything the JS API can't do, your launcher can't do (unless the fork gains the method, see section 11).

### Pieces

| Piece | Role |
|---|---|
| `window.Bridge.*` | Synchronous JS methods (a `@JavascriptInterface` object). Getters (`get…`), actions (`request…`), URL builders (`get…URL`). |
| `window.onBridgeEvent(event)` | Called by Bridge with an object `{ name, ... }` when something changes. |
| Bridge's internal HTTP-like server | Intercepts WebView requests to a virtual host. Serves your project files **and** JSON/image endpoints (`getAppsURL()`, icons, album art…). Same origin as your page, so `fetch()` and `<img src>` work with no CORS issue. |
| `@bridgelauncher/api` | TypeScript declarations for the stock API (`Bridge.d.ts`). Types only. |
| `@bridgelauncher/api-mock` | `BridgeMock`: a browser stand-in for `window.Bridge`, for development with a dev server. |

### Design rule: what is large or binary is a URL

Lists, icons, images, album art and similar are **not** returned by JS methods. Methods return a URL string; you `fetch(url)` (JSON) or put it in `<img src>`. Small state is returned directly (boolean, number, short string) or as a JSON string you `JSON.parse`.

---

## 2. Project setup

### Stack that works

Any static web build works. Known-good: Vue 3 (`<script setup>`) + TypeScript + Pinia + VueUse + Vite 4 (+ Vitest, jsdom). Plain JS or React works the same: the only requirements are below.

### Build requirements

- Output is a folder with an `index.html` at its root. Bridge's "project dir" setting points at that folder.
- **Use stable, unhashed asset names** so copying a new build over the old one is enough. In Vite:

```ts
build: { rollupOptions: { output: {
    entryFileNames: 'assets/[name].js',
    chunkFileNames: 'assets/[name].js',
    assetFileNames: 'assets/[name].[ext]',
} } }
```

- Use **relative or root-relative URLs** that resolve against Bridge's virtual host. Don't hard-code a hostname. `Bridge.getProjectURL()` [stock] returns the project's base URL if you need it.
- `index.html` must have `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`. `viewport-fit=cover` makes `env(safe-area-inset-*)` work (a fallback for insets, see section 7).
- Fullscreen page: `html, body, #app { margin:0; width:100%; height:100%; overflow:hidden }`, and disable the WebView's own gestures where you handle them yourself (`touch-action`, `overscroll-behavior: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`).

### Running it

- **Dev server in a browser:** `npm run dev`. `window.Bridge` doesn't exist there, so install a mock first (section 10).
- **On the device:** install Bridge, set it as the home app, open its settings and set the **project dir** to the folder holding your `dist/`. Copy the build there (e.g. `adb push dist/. /sdcard/projects/<name>/`). Bridge reloads the project.
- **Fork builds:** a self-built Bridge APK has a different signature from the released one, so it can't be installed over it; uninstall the original (losing its settings) or build with a different `applicationId`.

### Debugging on device

- `Bridge.requestOpenDeveloperConsole()` [stock] opens Bridge's developer console (console messages are forwarded there).
- The WebView is debuggable over adb: `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`, then use the Chrome DevTools protocol. Only do this if the device owner allows it.
- Keep a diagnostics screen in your launcher: Bridge/Android version (`getBridgeVersionName()`, `getBridgeVersionCode()`, `getAndroidAPILevel()`), `getLastErrorMessage()`, the live insets, permission states, and a ring buffer of the last N events. It pays for itself.

---

## 3. Golden rules (read before writing code)

1. **Calling a method the installed Bridge doesn't have throws.** The installed Bridge can lag behind the types (e.g. stock 0.1.0-alpha lacks `getCanRequestSystemNightMode`, though `Bridge.d.ts` declares it). If that throw happens while an app/store is initializing, the whole launcher fails to load. **Guard every method you haven't already seen working on the target device:**

```ts
export function bridgeHas(method: keyof typeof Bridge): boolean
{
    return typeof window.Bridge?.[method] === 'function';
}
```

   Every [fork] method must be behind `bridgeHas()` with a graceful fallback, so the launcher keeps working on stock Bridge.

2. **One `window.onBridgeEvent` handler, owned by one module.** Assigning it twice silently drops the first. Build a small event hub that owns the assignment and lets everything else subscribe (section 6). Never assign `window.onBridgeEvent` anywhere else.

3. **Permissions granted outside Bridge don't fire events.** Anything granted over adb (`WRITE_SECURE_SETTINGS`) or in Android settings pages (accessibility service for lock screen, notification access, usage access, Do Not Disturb access, modify system settings) may not emit a `…Changed` event reliably. **Re-read permission getters on `afterResume`** (section 6).

4. **Bridge swaps `top` and `left` in every window inset** on stock builds (section 7). Detect with `getWindowInsetsSwapFixed()` [fork].

5. **There is no back-button event** (section 9). Use a `history.pushState` workaround.

6. **Action methods return a boolean, they don't throw on failure.** `request…(…, showToastIfFailed = true): boolean`. Pass `false` for `showToastIfFailed` when you show your own error UI. If you call them as bare calls, you still get Bridge's toast on failure.

7. **Methods run on a WebView background thread** and are synchronous from JS's point of view. Don't call heavy ones in tight loops; do fetch-heavy data through URL endpoints and cache.

8. **Never write a feature that needs something in the "cannot do" list** (section 9) unless you're prepared to extend the fork first.

---

## 4. Stock API reference [stock]

All methods are on `Bridge`. `showToastIfFailed?: boolean` (default true) is omitted from the table for brevity on `request…` methods.

### Info and diagnostics

| Method | Returns / does |
|---|---|
| `getAndroidAPILevel()` | number (Android API level) |
| `getBridgeVersionCode()` / `getBridgeVersionName()` | Bridge build |
| `getLastErrorMessage()` | `string \| null`, last failed request's message |
| `getProjectURL()` | base URL of your project |
| `showToast(message, long?)` | Android toast |

### Apps

| Method | Returns / does |
|---|---|
| `getAppsURL()` | URL of JSON `{ apps: [{ packageName, label }] }` (launchable apps, **personal profile only** on stock) |
| `getDefaultAppIconURL(packageName)` | URL of the app's icon (use as `<img src>`) |
| `requestLaunchApp(packageName)` | starts the app |
| `requestOpenAppInfo(packageName)` | Android's app info screen |
| `requestAppUninstall(packageName)` | uninstall prompt |

Keep your own app index: fetch `getAppsURL()` at startup and on events `appInstalled` / `appChanged` / `appRemoved`; match on `packageName`. `label` is the only text; build your own simplified (accent/case-insensitive) search key.

### Wallpaper

| Method | Does |
|---|---|
| `getDrawSystemWallpaperBehindWebViewEnabled()` / `requestSetDrawSystemWallpaperBehindWebViewEnabled(bool)` | Show the user's system wallpaper behind a **transparent** page. If false, the page must paint its own background. |
| `requestChangeSystemWallpaper()` | opens Android's wallpaper picker |
| `setWallpaperOffsetSteps(x, y)`, `setWallpaperOffsets(x, y)` | Scroll offsets (0 to 1) so the system wallpaper parallaxes with your pages. Set steps = `1 / (pageCount - 1)` once, then offsets while scrolling. |
| `sendWallpaperTap(x, y, z?)` | Forward a tap to a live wallpaper (so it can react). |

If you draw your own wallpaper (canvas/CSS), switch the "draw system wallpaper behind" setting off and keep the page opaque; if you use the system one, switch it on and keep the page transparent.

### System UI and theme

| Method | Does |
|---|---|
| `getStatusBarAppearance()` / `requestSetStatusBarAppearance(a)` | `'hide' \| 'light-fg' \| 'dark-fg'`. `'hide'` removes the system status bar (draw your own). |
| `getNavigationBarAppearance()` / `requestSetNavigationBarAppearance(a)` | same values for the nav bar |
| `getBridgeTheme()` / `requestSetBridgeTheme('system'\|'dark'\|'light')` | Bridge's own UI theme (its settings/drawer/dialogs) |
| `getOverscrollEffects()` / `requestSetOverscrollEffects('default'\|'none')` | The WebView's built-in overscroll glow/stretch. Turn off if you draw your own. |
| `getBridgeButtonVisibility()` / `requestSetBridgeButtonVisibility('shown'\|'hidden')` | Bridge's floating button (opens Bridge settings/drawer) |
| `getSystemNightMode()` | `'no' \| 'yes' \| 'auto' \| 'custom' \| 'error' \| 'unknown'` |
| `resolveIsSystemInDarkTheme()` | boolean |
| `getCanRequestSystemNightMode()` | boolean (missing on stock alpha; fork has it) |
| `requestSetSystemNightMode(mode)` | needs `WRITE_SECURE_SETTINGS`, grantable **only over adb** (`adb shell pm grant <bridge.package> android.permission.WRITE_SECURE_SETTINGS`) |

When a feature changes a Bridge setting (hide status bar, overscroll, theme), **save the previous value and restore it when the feature is turned off.**

### System actions

| Method | Does |
|---|---|
| `getCanLockScreen()` / `requestLockScreen()` | Lock the screen. Needs Bridge's accessibility service enabled by the user. Event `canLockScreenChanged`. |
| `requestExpandNotificationShade()` | Pull down Android's shade |
| `requestOpenAndroidSettings()` | Android settings |
| `requestOpenBridgeSettings()` | Bridge's settings |
| `requestOpenBridgeAppDrawer()` | Bridge's own built-in drawer |
| `requestOpenDeveloperConsole()` | Bridge's dev console |

### Window insets

Each getter returns a **JSON string** `{ left, top, right, bottom }` in CSS px (parse it). Each has a matching `…WindowInsetsChanged` event.

`getStatusBarsWindowInsets`, `getStatusBarsIgnoringVisibilityWindowInsets`, `getNavigationBarsWindowInsets`, `getNavigationBarsIgnoringVisibilityWindowInsets`, `getCaptionBar…`, `getSystemBars…` (each with the `IgnoringVisibility` variant), `getImeWindowInsets`, `getImeAnimationSourceWindowInsets`, `getImeAnimationTargetWindowInsets`, `getTappableElement…`, `getSystemGesturesWindowInsets`, `getMandatorySystemGesturesWindowInsets`, `getDisplayCutoutWindowInsets`, `getWaterfallWindowInsets`. Also `getDisplayCutoutPath()` / `getDisplayShapePath()` (SVG path strings or null) for drawing around cutouts and rounded corners. See section 7 for the pitfalls.

### Stock events

`appInstalled {app}`, `appChanged {app}`, `appRemoved {packageName}`, `beforePause`, `afterResume`, `newIntent` (**the home button was pressed while already home**), `bridgeButtonVisibilityChanged`, `drawSystemWallpaperBehindWebViewChanged`, `overscrollEffectsChanged`, `systemNightModeChanged`, `bridgeThemeChanged`, `statusBarAppearanceChanged`, `navigationBarAppearanceChanged`, `canRequestSystemNightModeChanged`, `canLockScreenChanged`, and every `…WindowInsetsChanged`. Value-carrying events have `newValue`.

---

## 5. Fork API reference [fork]

Everything here is **absent on stock Bridge**: guard with `bridgeHas('<method>')` and provide a fallback. Declare these in your own types by **module augmentation** (section 10). Method names must match the Kotlin names exactly.

All `request…` methods take a trailing `showToastIfFailed?: boolean` and return `boolean`. "URL" methods return a URL to `fetch`/`<img>`.

### Fork self-detection

- `getWindowInsetsSwapFixed(): boolean`, always `true` when present. Present means top/left in insets are correct and insets events use the documented names. Absent means stock behavior (section 7).

### Screen orientation

- `getScreenOrientation(): 'unspecified' | 'portrait'`
- `requestSetScreenOrientation(o)`, event `screenOrientationChanged { newValue }`. Locks the home screen to portrait natively (the web `screen.orientation.lock` is rejected by the WebView). Call once at startup.

### URLs and default apps

- `requestOpenUrl(url)`: opens `http`, `https`, `tel`, `mailto`, `sms`, `smsto` or `geo` URLs in whatever app handles them. Nothing else is allowed (no generic intents).
- `getDefaultAppPackageName(role)` with role `'dialer' | 'browser' | 'sms' | 'email' | 'camera'` → package name or `null`. Use it to wire dock buttons to the user's real default apps; fall back to a list of well-known package names.
- `getProxyURL(url)`: a URL that makes Bridge download an http(s) URL natively and return it unchanged (status and content type preserved). **Use it to read sites that block CORS** (RSS, JSON APIs). GET only, follows redirects, 5 MB cap, `502` if the download fails, `504` on timeout.

### Files

- **`<input type="file">` works**: Bridge opens Android's picker (no JS method). Use it for photos, imports. Read the `File` with `FileReader`/`createImageBitmap`; persist big blobs in IndexedDB, not localStorage.
- `requestSaveFile(fileName, content, mimeType = 'application/json')`: opens Android's "Save as" dialog and writes text. Returns whether the dialog opened; the outcome comes as event `fileSaved { newValue: { fileName, result: 'saved'|'cancelled'|'failed' } }`. Use it for backup/export.

### Notifications (needs the user to grant notification access)

- `getCanReadNotifications()`, `requestOpenNotificationAccessSettings()`, event `canReadNotificationsChanged { newValue }`.
- `getNotificationsURL()` → JSON `{ notifications: BridgeNotification[] }`, newest first (empty without access).
- `getNotificationIconURL(key, large?)`: small icon (a white-silhouette PNG; tint it) or large icon (`hasLargeIcon`).
- `requestOpenNotification(key)`: does what tapping it does (and dismisses it if auto-cancel).
- `requestDismissNotification(key)`: for `isClearable` ones.
- `requestNotificationAction(key, actionIndex)`: presses a button. `requestReplyToNotification(key, actionIndex, text)`: sends typed text through a reply action (`acceptsText`).
- Events: `notificationPosted { notification }` (throttled per key), `notificationRemoved { key }`.
- `BridgeNotification`: `key, packageName, postTime (ms), title, text, subText, category, isOngoing, isClearable, isGroupSummary, isMedia, hasLargeIcon, actions[{ index, title, acceptsText }]`.
- Practical rules: keep a map by `key`; resync from `getNotificationsURL()` on `canReadNotificationsChanged` and `afterResume`; hide group summaries when their children are listed; split "ongoing" from the rest; hide `isMedia` notifications if you render your own media player. One status-bar icon per `packageName`.

### Media session (needs notification access)

- `getMediaSession()` → JSON string of a `BridgeMediaSession` or `"null"`. Event `mediaSessionChanged { session }`.
- `getMediaArtURL()`: album art (404 if none; the URL changes per track, use `artVersion` to bust caches).
- `requestMediaAction('play'|'pause'|'playPause'|'next'|'previous')`, `requestOpenMediaApp()`.
- `BridgeMediaSession`: `packageName, title, artist, album, state ('playing'|'paused'|'buffering'|'stopped'|'none'), durationMs, positionMs, positionUpdatedAt, playbackSpeed, hasArt, artVersion, canSkipToNext, canSkipToPrevious`.
- **Position is a snapshot**: while `playing`, extrapolate `positionMs + (now - positionUpdatedAt) * playbackSpeed` yourself, clamped to `durationMs`. No per-second events.

### Quick settings and system state

Each state has a getter, usually a setter, and a `…Changed` event with `newValue`.

| Capability | Calls | Event | Needs |
|---|---|---|---|
| Flashlight | `getIsFlashlightAvailable()`, `getFlashlightOn()`, `requestSetFlashlightOn(bool)` | `flashlightChanged` | none |
| Brightness | `getScreenBrightness()` (JSON `{ isAuto, level 0-1 }`), `requestSetScreenBrightnessAuto(bool)`, `requestSetScreenBrightnessLevel(0-1)` | `screenBrightnessChanged` | "Modify system settings" |
| Auto-rotate | `getAutoRotateOn()`, `requestSetAutoRotateOn(bool)` | `autoRotateChanged` | "Modify system settings" |
| Master sync | `getMasterSyncOn()`, `requestSetMasterSyncOn(bool)` | `masterSyncChanged` | none |
| Ringer mode | `getRingerMode()`, `requestSetRingerMode('normal'\|'vibrate'\|'silent')` | `ringerModeChanged` | "Do Not Disturb access" |
| Media volume | `getMusicVolume()` (0-1), `requestSetMusicVolume(0-1)` | `musicVolumeChanged` | none |
| Wi-Fi on? | `getWifiEnabled()` (read-only) | `wifiEnabledChanged` | none |
| Bluetooth on? | `getIsBluetoothAvailable()`, `getBluetoothEnabled()` (read-only) | `bluetoothEnabledChanged` (Android 12+: fires once the home screen regains focus) | none |
| Location on? | `getLocationEnabled()` (read-only) | `locationEnabledChanged` | none |

- Permission helpers: `getCanWriteSystemSettings()`, `requestOpenWriteSystemSettingsPermission()`, event `canWriteSystemSettingsChanged`; `getCanAccessNotificationPolicy()`, `requestOpenNotificationPolicyAccessSettings()`, event `canAccessNotificationPolicyChanged`.
- **Wi-Fi, Bluetooth, NFC and location can't be toggled by apps.** `requestOpenSystemPanel('wifi'|'internet'|'bluetooth'|'nfc'|'volume'|'location')` opens the floating panel (Android 10+) or the settings screen. Show state read-only and open the panel on tap.
- Offer a clear "grant permission" path in the UI for each gated control; hide or disable controls whose permission is missing instead of failing silently.

### Connectivity

- `getConnectivity()` → JSON `BridgeConnectivity`; event `connectivityChanged { newValue }`: `type ('wifi'|'cellular'|'ethernet'|'other'|'none')`, `wifiLevel` (0-4 or null), `cellularLevel` (0-4 or null; reported on Wi-Fi too), `cellularDataActivity` (as Android reports; One UI often only says `dormant`), `dataActivity` (`'none'|'in'|'out'|'inout'|'dormant'`, **measured from the device's traffic while the home screen is visible**; use this one for activity arrows).
- On stock Bridge you only have web APIs (`navigator.onLine`, `navigator.connection.effectiveType`); real signal bars are not available there.

### Battery

- `getBattery()` → JSON `{ level 0-100, isCharging, pluggedType ('ac'|'usb'|'wireless'|'other'|null) }`; event `batteryChanged { newValue }`. No permission. On stock Bridge fall back to the web Battery Status API (`navigator.getBattery()`; not on every WebView).

### Storage

- `getStorageStats()` → JSON `{ totalBytes, freeBytes }` of the internal storage (`StatFs` on the data partition). No permission and no event: read it on `afterResume`.
- Speech (`TextToSpeech`, no runtime permission; it needs an installed engine and the language's voice data): `getTtsAvailable()` (true once the engine has bound; the first call starts it), `requestSpeak(text, languageTag, pitch, rate)` (replaces what is being said; false without engine or voice), `requestStopSpeaking()` and `requestOpenTtsSettings()`. Added to the Kotlin of the fork but not compiled or verified on a phone yet.

### Alarms

- `getNextAlarm()` → JSON `{ triggerTime (ms), packageName }` or `"null"`; event `nextAlarmChanged { newValue }`. `requestOpenAlarms()` opens the clock app's alarm list. Without the fork, launch a known clock app by package name.

### Calendar (READ_CALENDAR, asked with Android's dialog)

- `getCanReadCalendar()`, `requestCalendarPermission()` (shows Android's dialog; if refused for good, opens Bridge's app settings), event `canReadCalendarChanged`.
- `getCalendarEventsURL(from, to)` (ms) → JSON `{ events: [...] }` of occurrences overlapping `[from, to)`; `403` without permission. Event fields: `eventId, title, location, begin, end, allDay, color (#rrggbb), calendarName`. **All-day events use midnight UTC** (`begin` = first day, `end` = the day after the last): convert with UTC, not local time, when assigning them to days.
- `requestOpenCalendarEvent(eventId, begin, end)`, `requestOpenCalendarAt(time)`.
- Event `calendarChanged` (no payload): refetch. Keep a `version` counter in your store so widgets refetch when it bumps.

### Contacts (READ_CONTACTS) and calling (CALL_PHONE)

- `getCanReadContacts()`, `requestContactsPermission()`, event `canReadContactsChanged`, event `contactsChanged` (no payload, refetch).
- `getContactsURL(query?, starredOnly?, limit?)` → JSON `{ contacts }` (only contacts **with a phone number**, by name; `query` matches names and numbers, `''` for all; `limit` 0 = none). `403` without permission. Contact: `id, lookupKey, name, starred, hasPhoto, phoneNumbers[{ number, label, isPrimary }]` (default number first).
- `getContactPhotoURL(lookupKey)` (404 if `hasPhoto` is false), `requestOpenContact(lookupKey)`.
- Calling is a separate permission: `getCanCallPhone()`, `requestCallPhonePermission()`, event `canCallPhoneChanged`; `requestCallPhoneNumber(number)` **calls immediately with the permission, otherwise opens the dialer with the number typed**. Make the "call directly" behavior an explicit, deliberate UI choice.

### App usage (special "Usage access")

- `getCanReadUsageStats()`, `requestOpenUsageAccessSettings()`, event `canReadUsageStatsChanged` (checked on resume).
- `getAppUsageURL(from, to)` → JSON `{ apps: [{ packageName, totalTimeMs, openCount, lastTimeUsed }] }`, most used by time first; `403` without access. Good for screen time, recent/most-used lists.

### App shortcuts (long-press menus)

- `getCanAccessAppShortcuts()`: **true only when Bridge is the default launcher** (Android 7.1+).
- `getAppShortcutsURL(packageName)` → JSON `{ shortcuts: [{ id, shortLabel, longLabel }] }` in launcher order; `getAppShortcutIconURL(packageName, shortcutId)`; `requestStartAppShortcut(packageName, shortcutId)`.

### Work profile apps

- `getProfileAppsURL()` → JSON `{ apps: [{ packageName, label, userSerial, profile ('personal'|'work'), isPaused }] }` (**every** profile; stock `getAppsURL()` is personal only). Event `profileAppsChanged` (no payload, refetch; also fires on pause/resume of the work profile).
- `getProfileAppIconURL(packageName, userSerial)` (icon with the work-briefcase badge), `requestLaunchProfileApp(packageName, userSerial)` (Android asks to unpause if needed), `requestOpenProfileAppInfo(packageName, userSerial)`.
- **Key apps by `packageName` + `userSerial`**, not by package alone: the same app can exist in both profiles. Prefer `getProfileAppsURL` when present, `getAppsURL` otherwise. The stock `appInstalled`/`appChanged`/`appRemoved` events still cover the personal profile only.

### Fork event typing

Upstream's `BridgeEventMap` is a `type` (can't be augmented). Type fork events yourself as a union (`BridgeForkEvent`) and have your event hub hand listeners `BridgeEvent | BridgeForkEvent`. Full list of fork events: `screenOrientationChanged, canReadNotificationsChanged, notificationPosted, notificationRemoved, canWriteSystemSettingsChanged, flashlightChanged, screenBrightnessChanged, autoRotateChanged, masterSyncChanged, canAccessNotificationPolicyChanged, ringerModeChanged, musicVolumeChanged, mediaSessionChanged, wifiEnabledChanged, bluetoothEnabledChanged, locationEnabledChanged, connectivityChanged, batteryChanged, nextAlarmChanged, canReadCalendarChanged, calendarChanged, canReadUsageStatsChanged, canReadContactsChanged, canCallPhoneChanged, contactsChanged, profileAppsChanged, fileSaved`.

### Permission summary

| Capability | What the user must do |
|---|---|
| Night mode | `adb shell pm grant <bridge.package> android.permission.WRITE_SECURE_SETTINGS` (once per install; lost on uninstall) |
| Lock screen | Enable Bridge's accessibility service |
| Notifications, media session | Grant notification access (`requestOpenNotificationAccessSettings`) |
| Brightness, auto-rotate | "Modify system settings" (`requestOpenWriteSystemSettingsPermission`) |
| Ringer mode | "Do Not Disturb access" (`requestOpenNotificationPolicyAccessSettings`) |
| App usage | "Usage access" (`requestOpenUsageAccessSettings`) |
| Calendar / contacts / call | Android runtime dialog (`request…Permission`) |
| App shortcuts | Bridge must be the default home app |
| Everything else | none |

Document these steps in your project's README (user-facing) and expose a "grant" button wherever a gated control appears.

---

## 6. Event hub and lifecycle

### The single handler

```ts
type AnyBridgeEvent = BridgeEvent | BridgeForkEvent;
type Listener = (e: AnyBridgeEvent) => void;

const listeners = new Set<Listener>();
window.onBridgeEvent = (event: AnyBridgeEvent) => { for (const l of listeners) l(event); };

export const bridgeEvents = {
    addEventListener: (l: Listener) => listeners.add(l),
    removeEventListener: (l: Listener) => listeners.delete(l),
};
```

Assign it once, as early as possible (before your first Bridge call that could emit). Anything else subscribes through the hub. Optionally keep a fixed-size ring buffer of the last ~30 events for your diagnostics screen, storing events as they come and summarizing only when the screen reads them.

### Event shapes

- Stock value events: `{ name, newValue }`. App events: `{ name: 'appInstalled', app: { packageName, label } }`.
- Fork events carry `newValue` (or `notification`, `key`, `session` as listed above) or nothing (`calendarChanged`, `contactsChanged`, `profileAppsChanged`: refetch).
- **Window-inset events on stock builds don't match the types**: Bridge sends `{ name: 'ImeWindowInsetsChanged', insets }` (the Kotlin enum's PascalCase name, value in `insets`) instead of `{ name: 'imeWindowInsetsChanged', newValue }`. Accept both: lower-case the first letter of `name` and read `newValue ?? insets`. The fork fixes this; handle both anyway.

### Lifecycle

- `beforePause`: the home screen is about to go to the background (an app was launched, etc.). Pause animations/canvases and timers.
- `afterResume`: the user came back. Resume, **re-read permission states and anything you may have missed** (notification access, contacts, usage access, DND, system settings, Bluetooth state, insets, battery, weather data staleness).
- `newIntent`: the user pressed **home while already on the home screen**. Standard behavior is to close the first open thing in order (menus/panels, then the drawer, then folders), and if nothing is open, scroll back to the default page.

---

## 7. Window insets and layout

Bridge draws the WebView edge-to-edge, so **you** handle the system bars and cutouts.

- **Stock bug: top and left are swapped in every inset** (getters and events), because upstream builds the snapshot positionally `(left, top, …)` into a constructor declared `(top, left, …)`. On a phone in portrait, a 33 px status bar arrives as `{ left: 33, top: 0 }`. Fork: fixed, and `getWindowInsetsSwapFixed()` is present. **When it is missing, swap `top` and `left` back in every getter and every inset event.**
- `statusBars` insets are **0 while the status bar is hidden** (they measure the visible bar). The size it would have is in the `…IgnoringVisibility` variants. Use those when you hide the system bar and draw your own.
- A robust resolution of the status bar height, in order: the (unswapped) `statusBarsIgnoringVisibility` top → `systemBarsIgnoringVisibility` top → other insets (`displayCutout` top) → `env(safe-area-inset-top)` → a sensible minimum (e.g. 24 px) → a user-set manual value. Re-read after startup and on `afterResume` (the first read can be 0). Do the same for the navigation bar and the sides.
- **Expose the resolved values as CSS variables on your root element** (`--status-bar-height`, `--nav-bar-height`, plus left/right) and lay everything out with them, never with raw insets.
- **Keyboard**: use `imeWindowInsets` (subscribe to its event) to pad dialogs/panels above the keyboard. Some devices also shrink the WebView; combine both: `bottomPad = max(0, imeBottom - (windowHeightBefore - windowHeightNow))`. Put text entry in dialogs/panels that lift above the keyboard, not in a widget low on the grid. Don't re-measure the grid's rows while an input has focus (a shrinking WebView would move icons).
- Cutouts and rounded corners: `getDisplayCutoutPath()` / `getDisplayShapePath()` for SVG paths; `displayCutout` and `waterfall` insets for margins.

---

## 8. Architecture of a complete launcher

This is a proven decomposition. Use it as a checklist of what "complete" means; adapt names freely.

### Layers (bottom to top, absolutely positioned in one root)

1. **Wallpaper**: canvas/CSS, or nothing (transparent) when using the system wallpaper.
2. **Workspace**: N horizontally scroll-snapped pages, each a grid. A default page index.
3. **Dock/hotseat** with the main apps (+ a "trash"/remove zone that replaces it while dragging).
4. **App drawer** (all apps, search, hide/uninstall, sorting).
5. **Folder panel**.
6. **Drag layer** (the dragged icon follows the finger above everything).
7. **Menus, dialogs, search panel, notification panel**.
8. **Status bar** (your own, if you hide the system one) and nav-bar spacer.

### State (store per concern; persistent bits in `localStorage` via `useLocalStorage` or equivalent)

- **Home layout model**: a flat list of items `app | widget | folder`, each `{ id, page, x, y, w, h }` (+ payload). A fixed column count and a **variable row count** (derive from screen size; let the user override). When rows shrink, move items that no longer fit onto free cells (this is destructive, so only auto-measure rows in portrait and persist the result; keep portrait rows in landscape rather than shrinking). Provide: `findFreeSpot(page, w, h, near?)`, add/move/remove, folder add/remove with auto-dissolve at 0-1 items, and cell/page bounds checks. **Put this in pure functions and unit-test them** (collisions, overflow, folders).
- **Apps store**: the app map from `getAppsURL()` / `getProfileAppsURL()`, refreshed by events; plus labels simplified for search.
- **Launch store**: the only place that calls `requestLaunchApp` / `requestLaunchProfileApp`. It records recent apps and launch counts (for "recent" and "most used" lists).
- **Menu/overlay store**: single source of truth for which overlay is open (options menu, dialog, folder, search, notification panel, drawer), so home/back close them consistently.
- **Settings store**: user preferences (wallpaper, status bar mode, icon size, grid, visibility of status icons…).
- **Per-feature stores**: notifications, media, battery, connectivity, calendar, contacts, quick settings, alarm, insets, toggles/permissions. Each subscribes to the event hub, seeds itself from the getter (guarded by `bridgeHas`), and re-reads on `afterResume` if its permission can change outside Bridge.
- **Per-instance widget data**: small JSON keyed by widget item id (localStorage), dropped when the widget is removed; blobs (photos) in IndexedDB keyed by the same id, pruned on mount for removed ids.

### Drag and drop

- One drag store. Pointer events listened on `window` while a drag is active. Cancel `touchmove` with a **non-passive** listener so the WebView doesn't scroll under the finger (`{ passive: false }` + `preventDefault()`).
- Drag sources: drawer, home grid, folder. Drop targets: grid cell (page + x/y), folder, trash. Compute targets from the **on-screen rectangles** of registered elements (each page's grid, the dock/trash).
- Edge hover (~400 ms) switches page while dragging; hover over a folder or an app opens/creates a folder.
- After a drop, the browser fires a `click` on the dropped element: set a short "just dropped" flag and ignore that click.
- Long press = start drag **and** open a context menu (app shortcuts); distinguish "moved more than N px" (keep dragging, close menu) from "released in place" (cancel drag, leave menu open).

### Long press composable

One reusable `useLongPress` (timer on `pointerdown`, cancel on move > threshold/`pointerup`). Click handlers must call something like `consumeLongPress()` so the click that ends a long press is ignored.

### Launching and windows

- Always launch through one store method. For work-profile apps use `requestLaunchProfileApp(pkg, userSerial)`.
- Opening other apps from Bridge puts them in their own task (Bridge adds `FLAG_ACTIVITY_NEW_TASK`).
- Home-button return: handle `newIntent` (section 6).

### Search

Accent- and case-insensitive ranked match over app labels (and contacts when permitted). Rank: exact > prefix > word prefix > substring; tie-break by launch count. With an empty query show recents. Enter launches the single match; with no exact match, offer a web search through `requestOpenUrl`. Make it a **pure function** and test it.

### Widgets

- All widgets are **HTML**. Real Android app widgets (`AppWidgetHost`) are not available.
- Register each widget kind in one place: kind → default size in cells, component, and picker entry. Render previews of the same component at its home size, scaled down, so each widget must work with no instance id and no side effects beyond reading stores.
- Data widgets worth building from the API: clock/alarm, battery, calendar/agenda, weather (a no-key API such as Open-Meteo; cache city and last result, refresh when stale and on resume), media player, notifications/messages list, quick toggles/power controls, contacts (favorites, direct call), screen time, bookmarks, RSS (via `getProxyURL`), notes/tasks/timer.
- Widget settings and text entry belong in a **dialog teleported to the root** (not clipped by the cell, recenters above the keyboard).

### Status bar (if you draw your own)

Hide the system bar with `requestSetStatusBarAppearance('hide')` (remember the previous value to restore it). Draw: clock, battery (level, charging), network (type/levels/activity from `getConnectivity`), notification icons (one per package, from `getNotificationIconURL`), optional icons (Bluetooth on, alarm set, GPS on, ringer vibrate/silent). Tapping it can open your own notification panel (fork) or `requestExpandNotificationShade()` (stock). Set the system nav bar appearance to match.

### Notification panel (fork)

List notifications in "ongoing" and the rest; tap = `requestOpenNotification`; swipe/clear = `requestDismissNotification`; show action buttons and inline reply; put a media player and quick toggles on top. Close it with back/home like other overlays.

### Persistence and backup

`localStorage` (layout, settings, per-widget data) and IndexedDB (photos) both work. Provide export/import: export through `requestSaveFile` [fork] (fallback: a downloaded Blob may not work in the WebView), import through `<input type="file">` [fork] and `FileReader`. Version your storage schema and migrate on load.

### Theming

Define colors, radii and gradients as CSS variables/SCSS mixins in one place. Respect `resolveIsSystemInDarkTheme()` / `getBridgeTheme()` only if your design needs light/dark; otherwise pin Bridge's theme to match your design and restore it when disabled.

---

## 9. What the platform cannot do

Do not design features that need these (stock and fork alike, unless noted):

- **Back-button events.** Workaround: when you open a drawer/panel/search, `history.pushState({}, '')`; handle `popstate` by closing it. Bridge forwards the Android back button to the WebView history. Also close on home (`newIntent`).
- Read notifications or media sessions without the fork (fork only, with notification access).
- Tell the user's default apps without the fork.
- **Embed native app widgets.** HTML widgets only.
- **Start arbitrary intents**: only launch-by-package, open-URL schemes listed above [fork], app shortcuts [fork], opening a contact/calendar entry/notification [fork], and Android settings pages through the specific `request…Settings` methods.
- Toggle Wi-Fi, Bluetooth, NFC, location, mobile data, airplane mode. Only open their panels.
- Install apps or PWAs. Installing a PWA is the browser's job; you can open the URL in the browser and the installed PWA later appears as a normal app.
- Read the screen, other apps' content, SMS, call log, or location coordinates.
- Programmatic screenshots of the phone (use the browser dev server for visual checks).

---

## 10. Types and mock for development

### Install

```
npm i @bridgelauncher/api @bridgelauncher/api-mock
```

Importing `@bridgelauncher/api` provides the global `Bridge: JSToBridgeAPI` and `window.onBridgeEvent` types.

### Declaring fork methods

```ts
// src/types/bridge-fork.d.ts
import '@bridgelauncher/api';

export type BridgeRingerMode = 'normal' | 'vibrate' | 'silent';
// ...interfaces for every fork payload (BridgeNotification, BridgeBattery, ...)

declare module '@bridgelauncher/api'
{
    interface JSToBridgeAPI
    {
        requestOpenUrl(url: string, showToastIfFailed?: boolean): boolean;
        getBattery(): string; // JSON of BridgeBattery
        // ...every fork method, with exactly the Kotlin names
    }
}
```

After this, `bridgeHas('requestOpenUrl')` type-checks. JSON-returning methods are typed `string`; parse with `JSON.parse`.

### Mock (browser dev)

Subclass `BridgeMock`, implement the fork methods with believable fake data, install it only in dev and only when there's no real Bridge:

```ts
import { BridgeMock } from '@bridgelauncher/api-mock';

class ForkBridgeMock extends BridgeMock
{
    private ringerMode: BridgeRingerMode = 'normal';

    // like Bridge, tell the page about a change through onBridgeEvent
    private emit(event: object) { (window.onBridgeEvent as ((e: object) => void) | undefined)?.(event); }

    getRingerMode() { return this.ringerMode; }
    requestSetRingerMode(mode: BridgeRingerMode)
    {
        this.ringerMode = mode;
        this.emit({ name: 'ringerModeChanged', newValue: mode });
        return true;
    }
    requestOpenUrl(url: string) { window.open(url, '_blank'); return true; }
    getProxyURL(url: string) { return url; } // CORS still applies in the browser
}

export default function injectBridgeMockInDev()
{
    if (import.meta.env.DEV && !window.Bridge) window.Bridge = new ForkBridgeMock();
}
```

Call it **before** `createApp(...)` and before anything touches `Bridge`. In Vue also expose it to templates: `app.config.globalProperties.Bridge = Bridge`.

Mock facts: `BridgeMock` reads its app list and icons from files under `public/mock/` (put sample `apps` JSON and icon PNGs there); calls such as `requestLaunchApp` show an `alert`. Every fork method you use needs a mock implementation or the dev server will throw. Keep mock and `bridge-fork.d.ts` in sync whenever a fork method is added.

---

## 11. Extending the fork (when the API is missing something)

Repo: `njpd57/bridge-launcher` (Kotlin, Jetpack Compose, minSdk 24, targetSdk 34, AGP 8.5.2, Gradle 8.9, Kotlin 1.9.24, JDK 17). Package `com.tored.bridgelauncher`.

**Workflow for a new capability:**

1. **Kotlin** in `api2/jstobridge/JSToBridgeAPI.kt` (grouped by `// region`):
   - Methods are `@JavascriptInterface`. Actions: `request…(…, showToastIfFailed: Boolean = true): Boolean`, body wrapped in `_app.tryRun(showToastIfFailed) { … }` (or `tryRunInHomescreenContext` when an Activity context is needed; it also adds `FLAG_ACTIVITY_NEW_TASK`). Getters: `get…()`.
   - Return small data as a JSON string (kotlinx.serialization). Return large/binary data as a `get…URL()` backed by an endpoint in `api2/server/endpoints/*Endpoint.kt`.
   - Events: a model class in `api2/bridgetojs/events/<group>/`, emitted from `BridgeToJSAPI.sendBridgeEvent(model)`.
   - Manifest: declare permissions/services/receivers in `AndroidManifest.xml`; gate version-specific calls with `CurrentAndroidVersion`.
   - Manual DI: construct services in `BridgeLauncherApplication.createServices()` and add them to the `BridgeServices` data class (and `startup()` if needed).
2. **Types and mock** in the web project, with **exactly the same method names** (section 10).
3. **Consumer** guards every call with `bridgeHas()`.
4. **Verify on device**: `./gradlew assembleDebug`, `adb install -r app/build/outputs/apk/debug/*.apk`, then test by hand.

**Kotlin gotchas:**

- `@JavascriptInterface` runs on a **WebView background thread**: post to the main thread before touching Views or the WebView. Settings writes go through `tryEditPrefs` (`runBlocking`).
- A `null` query param must not render as the text `null` in a URL (fixed in the fork's `URLWithQueryBuilder.addParams`).
- Runtime permission dialogs go through `BridgeRuntimePermissionRequester` (registered by the home Activity); if refused for good, open Bridge's app settings instead.
- `HomeScreenActivity` handles `configChanges` (including `orientation`) itself and has no `screenOrientation` in the manifest.
- `WebView.setWebContentsDebuggingEnabled` is static and must run before the WebView is created.
- System-created components (accessibility service, `BridgeNotificationListenerService`) are not built in `createServices()`; they reach services through `bridgeLauncherApplication.services` and expose a `companion object { var instance }` for actions that need them.
- Adb-only permissions (`WRITE_SECURE_SETTINGS`) belong in the repo's `scripts/grant-permissions.sh`.

---

## 12. Build order for a new launcher

Do these in order; each step leaves something runnable.

1. **Scaffold**: Vite + TS + framework; stable asset names; viewport meta; root element. Add `bridgeHas`, the event hub (`window.onBridgeEvent` once), the mock (dev only), `bridge-fork.d.ts`. Verify in the browser.
2. **Insets**: a store that reads, unswaps if needed, resolves status/nav heights, re-reads on resume, and publishes the CSS variables. Add the diagnostics screen now.
3. **Apps**: fetch the app list (profiles if available), show icons, launch through the launch store, refresh on app events.
4. **Home layout model** (pure + tested), one page of grid with app icons, persistence.
5. **Workspace**: multiple pages, scroll snap, page indicator, default page, wallpaper (own canvas or system with offsets).
6. **Dock** and **drawer** (search, sort, hide, uninstall/info), history-based back handling, `newIntent` handling.
7. **Drag and drop** and folders; long-press menus (app shortcuts [fork]).
8. **Menus and settings**; per-setting restore of Bridge settings; persistent preferences.
9. **Status bar** and system-state stores (battery, connectivity, alarms, ringer), with fallbacks for stock.
10. **Widgets framework** + first widgets (clock, battery, search, weather); previews.
11. **Permissioned features**: notifications (panel + status icons), media player, calendar/agenda, contacts/direct call, usage stats, quick toggles, volume, work-profile apps. Each: guard, request-permission UI, re-read on resume.
12. **Backup/restore** (`requestSaveFile`, file input), README with the user-facing permission steps, deploy script.

### Testing

Test **pure logic** with Vitest: layout model, inset parsing/unswapping, `bridgeHas`, search ranking, calendar/month grids, notification filtering/grouping, ranking of most-used apps, storage migrations. Verify DOM, canvas, drag and gestures in the browser dev server and on the device. A small pure-function module per concern keeps this cheap.

### Deploy script (adb)

```bash
npm run build
adb shell rm -rf "$REMOTE_DIR" && adb shell mkdir -p "$REMOTE_DIR"
adb push dist/. "$REMOTE_DIR/"
```

Default dir used in practice: `/sdcard/projects/<name>`. Point Bridge's project dir at it once.

---

## 13. Pitfall checklist

- [ ] Every fork/optional method is behind `bridgeHas()`; no fork call runs unguarded at store creation.
- [ ] `window.onBridgeEvent` is assigned in exactly one place.
- [ ] `top`/`left` insets are unswapped when `getWindowInsetsSwapFixed` is missing; inset event names and `insets`/`newValue` both accepted.
- [ ] Layout uses resolved CSS variables, with fallbacks (`env(safe-area-inset-*)`, minimums, manual override).
- [ ] Permission states re-read on `afterResume`.
- [ ] Apps are launched only through the launch store; work-profile apps keyed by package + `userSerial`.
- [ ] Back is handled with `history.pushState`/`popstate`, plus `newIntent` for home.
- [ ] `touchmove` is cancelled non-passively during drags; the post-drop and post-long-press clicks are ignored.
- [ ] Bridge settings you change (status bar, overscroll, theme, system wallpaper flag) are saved and restored when the feature is turned off.
- [ ] Text entry lives in dialogs/panels that lift above the keyboard; the grid doesn't re-measure while an input is focused.
- [ ] Media position is extrapolated client-side; all-day calendar events are read in UTC.
- [ ] CORS-blocked sites go through `getProxyURL`.
- [ ] Mock and `bridge-fork.d.ts` stay in sync with the Kotlin method names.
- [ ] Nothing in the "cannot do" list is promised by a feature.
