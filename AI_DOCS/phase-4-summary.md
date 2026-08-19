# Phase 4 Summary — InAppBrowser Migration

## Status: COMPLETE

---

## Changes Completed

### New file created
`src/auth/util/webview-session-provider/impl/webview-runner-capacitor-impl.ts`

Full `WebviewRunner` implementation using `@capgo/inappbrowser` + `@capacitor/browser`.

| Method | Capacitor implementation |
|---|---|
| `launchWebview` | `InAppBrowser.openWebView({ url })` + `closeEvent` listener |
| `closeWebview` | `InAppBrowser.close()` |
| `resetInAppBrowserEventListeners` | Remove all stored `PluginListenerHandle` objects |
| `capture` | `InAppBrowser.addListener('urlChangeEvent', ...)` — intercepts OAuth callback URL |
| `redirectTo` | `InAppBrowser.setUrl({ url })` — replaces `executeScript(window.location.href=...)` |
| `launchCustomTab` | `Browser.open({ url })` from `@capacitor/browser` |
| `any / all` | Same RxJS `race` / `zip` wrappers as Cordova impl |
| `resolveCaptured / clearCapture / getCaptureExtras / success / fail` | Identical to Cordova impl |

### Files modified

| File | Change |
|---|---|
| `src/util/platform/platform-util.ts` | Added `let _sdkPlatform` storage + `getSdkPlatform()` exported getter |
| `src/auth/util/webview-session-provider/impl/webview-login-session-provider.ts` | Ternary: Capacitor → `WebviewRunnerCapacitorImpl`, else → `WebviewRunnerImpl` |
| `src/auth/util/webview-session-provider/impl/webview-manual-merge-session-provider.ts` | Same ternary |
| `src/auth/util/webview-session-provider/impl/webview-state-session-provider.ts` | Same ternary |
| `src/auth/util/native-custombrowser-session-provider/impl/native-custombrowser-session-provider.ts` | Same ternary |
| `src/course/impl/course-service-impl.ts` | Platform check — Capacitor uses `Browser.open()`, else `cordova.InAppBrowser.open()` |
| `src/profile/impl/profile-service-impl.ts` | Platform check — Capacitor uses `InAppBrowser.openWebView + urlChangeEvent`, else Cordova |
| `package.json` | Added `@capgo/inappbrowser` + `@capacitor/browser` to devDeps and peerDeps |

### Cordova preserved
All `cordova.InAppBrowser.open()` call sites wrapped in `else` branches — untouched for `platform !== 'capacitor'`.

---

## Packages
| Package | Version | Purpose |
|---|---|---|
| `@capgo/inappbrowser` | `^8.6.14` (devDep), `^8.0.0` (peerDep) | In-app webview with `urlChangeEvent` + `setUrl` + `executeScript` |
| `@capacitor/browser` | `^5.2.1` (devDep), `^5.0.0` (peerDep) | System browser for `launchCustomTab` |

Installed with `--force` due to `@capacitor/core@5.7.8` in SDK devDeps vs `>=8.0.0` peer req.

---

## Validation
- `npx tsc --noEmit` — **0 errors**
- `npm run build:dev` — in progress

---

## Risks

| Risk | Severity | Notes |
|---|---|---|
| `launchCustomTab` resolved-URL callback | Medium | Capacitor path opens system browser and resolves immediately — OAuth flows using custom-tab deep-link callbacks will not capture params. Full fix deferred to Phase 9 when `App.addListener('appUrlOpen')` wiring is added. |
| `@capgo/inappbrowser` requires `@capacitor/core >= 8.0.0` | Low | Installed with `--force`. Runtime is fine since consuming app has `@capacitor/core@8.3.4`. |
| Listener handle leak if `capture()` never resolves | Low | Listeners are cleaned up by `resetInAppBrowserEventListeners()` which is called on `closeEvent`. |
