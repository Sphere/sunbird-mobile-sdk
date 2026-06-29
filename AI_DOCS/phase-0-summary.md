# Phase 0 Summary — Platform Scaffold

**Date:** 2026-06-16  
**Status:** COMPLETE (tests deferred)

---

## Changes Completed

### 1. `src/sdk-config.ts` — Platform type extended

```diff
- platform: 'cordova' | 'web';
+ platform: 'cordova' | 'web' | 'capacitor';
```

`'capacitor'` is now a valid compile-time value for `SdkConfig.platform`. Callers passing any other string still get a TypeScript error.

### 2. `src/sdk.ts` — Capacitor switch case added

```diff
+ case 'capacitor':
+     // Placeholder: replaced with SharedPreferencesCapacitor in the SharedPreferences migration phase.
+     this._container.bind<SharedPreferences>(InjectionTokens.SHARED_PREFERENCES)
+         .to(SharedPreferencesLocalStorage).inSingletonScope();
+     break;
```

The SDK no longer throws `FATAL_ERROR: Invalid platform` when initialised with `platform: 'capacitor'`. SharedPreferences uses `SharedPreferencesLocalStorage` as a placeholder until the Capacitor implementation is written.

### 3. `src/sdk.ts` — httpAdapter corrected for Capacitor

```diff
- httpAdapter: sdkConfig.platform === 'web' ? 'HttpClientBrowserAdapter' : 'HttpClientCordovaAdapter',
+ httpAdapter: (sdkConfig.platform === 'web' || sdkConfig.platform === 'capacitor')
+     ? 'HttpClientBrowserAdapter'
+     : 'HttpClientCordovaAdapter',
```

Capacitor apps run in a WebView and do not have `cordova-plugin-advanced-http`. They are now routed to `HttpClientBrowserAdapter`.

---

## Files Modified

| File | Change |
|---|---|
| [src/sdk-config.ts](src/sdk-config.ts) | Added `'capacitor'` to platform union type |
| [src/sdk.ts](src/sdk.ts) | Added `case 'capacitor':` in SharedPreferences switch; updated httpAdapter ternary |

---

## Files Generated

| File | Purpose |
|---|---|
| [phase-0-analysis.md](phase-0-analysis.md) | Pre-implementation analysis, Cordova usage inventory, change plan |
| [phase-0-summary.md](phase-0-summary.md) | This file |

---

## Cordova Usage Inventory (for subsequent phases)

Catalogued in [phase-0-analysis.md](phase-0-analysis.md). Summary:

| Category | Occurrences | Files | Target Phase |
|---|:---:|:---:|---|
| `window.device.uuid` | 2 | sdk.ts, device-info-impl.ts | Phase 1 — DeviceInfo |
| `window.device.platform` | 24 | 19 files | Phase 1 — DeviceInfo |
| `cordova.file.*` path constants | 13 | 9 files | Phase 2 — FileService |
| `cordova.InAppBrowser.open()` | 3 | webview-runner-impl, profile-service-impl, course-service-impl | Phase 3 — Browser |
| `cordova.exec()` (getFreeDiskSpace) | 1 | file-service-impl.ts | Phase 2 — FileService |

---

## Build Validation

- `npm run build:dev` — **PASSED** — TypeScript compiled with 0 errors.
- `npm test` — **DEFERRED** by user instruction.

---

## Risks Discovered

| Risk | Status |
|---|---|
| `window.device.uuid` still called in `sdk.ts:413` at Capacitor init time | **Outstanding** — addressed in Phase 1 |
| `SharedPreferencesLocalStorage` used as Capacitor placeholder (not encrypted) | **Documented** — replaced in SharedPreferences phase |
| No `cordova.file.*` constants available under Capacitor | **Outstanding** — addressed in Phase 2 |

---

## Outstanding Work

All items below are **out of scope for Phase 0** and tracked for subsequent phases:

- Phase 1: Replace `window.device.*` with `@capacitor/device` via `DeviceInfo` service
- Phase 2: Replace `cordova.file.*` path constants with `@capacitor/filesystem` `Directory` enum via `FilePathProvider`
- Phase 3: Replace `cordova.InAppBrowser.open()` with a `BrowserService` interface backed by `@capacitor/browser`
- Later: `SharedPreferencesCapacitor`, `DbCapacitorService`, Capacitor download service

---

## READY FOR PHASE 1 APPROVAL
