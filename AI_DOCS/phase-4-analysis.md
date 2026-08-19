# Phase 4 Analysis — InAppBrowser Migration

## Goal
Replace `cordova.InAppBrowser.*` calls with `@capacitor-community/inappbrowser` (full event
support) and `@capacitor/browser` (simple URL opens). Three call sites, spanning the OAuth
webview runner, course discussion forum, and profile merge-logout flow.

---

## Current Cordova usage

| File | Method | Cordova API used |
|---|---|---|
| `webview-runner-impl.ts:41` | `launchWebview` | `cordova.InAppBrowser.open()` |
| `webview-runner-impl.ts:66` | `closeWebview` | `ref.close()` |
| `webview-runner-impl.ts:135–171` | `capture` | `ref.addEventListener('loadstart', ...)` / `removeEventListener` |
| `webview-runner-impl.ts:192` | `redirectTo` | `ref.executeScript({ code: ... })` |
| `course-service-impl.ts:394` | open discussion forum | `cordova.InAppBrowser.open()` — fire-and-forget |
| `profile-service-impl.ts:689` | merge-user logout | `cordova.InAppBrowser.open()` + `loadstart` listener |

### `WebviewRunner` interface methods (all must be implemented)

```
launchWebview, closeWebview, resetInAppBrowserEventListeners,
capture, redirectTo, launchCustomTab,
any, all, resolveCaptured, clearCapture, getCaptureExtras, success, fail
```

---

## Capacitor replacements

### `@capacitor-community/inappbrowser`

| Cordova | Capacitor |
|---|---|
| `cordova.InAppBrowser.open(url, ...)` | `InAppBrowser.openWebView({ url })` |
| `ref.close()` | `InAppBrowser.close()` |
| `ref.addEventListener('loadstart', cb)` | `InAppBrowser.addListener('urlChangeEvent', cb)` → `event.url` |
| `ref.removeEventListener('loadstart', cb)` | store `PluginListenerHandle`, call `handle.remove()` |
| `ref.executeScript({ code })` | `InAppBrowser.loadUrl({ url })` (navigation redirect) |

### `@capacitor/browser`

Used for `launchCustomTab` (system browser) and the simple fire-and-forget open in
`course-service-impl.ts`.

---

## Files impacted

| File | Change |
|---|---|
| `src/util/platform/platform-util.ts` | Add `let _sdkPlatform` + `getSdkPlatform()` getter |
| `src/auth/util/webview-session-provider/impl/webview-runner-capacitor-impl.ts` | NEW — full `WebviewRunner` impl using `@capacitor-community/inappbrowser` |
| `src/auth/util/webview-session-provider/impl/webview-login-session-provider.ts` | Use Capacitor runner when `getSdkPlatform() === 'capacitor'` |
| `src/auth/util/webview-session-provider/impl/webview-manual-merge-session-provider.ts` | Same |
| `src/auth/util/webview-session-provider/impl/webview-state-session-provider.ts` | Same |
| `src/auth/util/native-custombrowser-session-provider/impl/native-custombrowser-session-provider.ts` | Same |
| `src/course/impl/course-service-impl.ts` | Inline platform check — Capacitor uses `Browser.open()` |
| `src/profile/impl/profile-service-impl.ts` | Inline platform check — Capacitor uses `InAppBrowser` + `urlChangeEvent` |
| `package.json` | Add `@capacitor-community/inappbrowser` + `@capacitor/browser` to devDeps + peerDeps |

---

## Key design decisions

### `getSdkPlatform()` in platform-util
`WebviewRunnerImpl` is not DI-managed — it's constructed with `new WebviewRunnerImpl()` in 4
session providers. The SDK config platform must be read via the same module-level singleton
pattern already used for device platform.

### Listener management
Cordova InAppBrowser is per-instance; `@capacitor-community/inappbrowser` uses global static
listeners. The Capacitor impl stores all `PluginListenerHandle` objects in arrays so
`resetInAppBrowserEventListeners()` can remove them individually.

### `redirectTo` → `loadUrl`
Cordova's `executeScript({ code: "window.location.href = url" })` is replaced with
`InAppBrowser.loadUrl({ url })` — equivalent navigation redirect.

### `launchCustomTab`
`customtabs` is `sb-cordova-plugin-customtabs`. Capacitor replacement is `Browser.open()`
from `@capacitor/browser`. The resolved-URL callback behaviour of customtabs cannot be
replicated with `Browser.open()` alone; for Phase 4, the Capacitor path opens the URL and
resolves immediately. Full deep-link callback support (via `App.addListener('appUrlOpen')`)
is deferred to Phase 9 when the platform flag is actually flipped.

---

## Risks

- `launchCustomTab` resolved-URL callback is stubbed for Capacitor path — OAuth flows that
  rely on custom-tab callbacks will not capture params until Phase 9 deep-link wiring.
- `@capacitor-community/inappbrowser` version compatibility with Capacitor 8 — install with
  `--force` if peer dep conflicts arise (same pattern as `@capacitor/device` in Phase 1).
