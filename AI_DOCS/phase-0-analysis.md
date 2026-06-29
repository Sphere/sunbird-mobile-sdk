# Phase 0 Analysis — Platform Scaffold

**Date:** 2026-06-16  
**Branch:** feature/SPRINT-54 → target: feature/migrate-to-capacitor  
**Phase objective:** Extend the SDK to recognise `'capacitor'` as a valid platform value and document every location where Cordova globals are accessed directly.

---

## 1. Current State

### SdkConfig.platform — [src/sdk-config.ts:22](src/sdk-config.ts#L22)

```ts
platform: 'cordova' | 'web';
```

Only two values are accepted. Passing `'capacitor'` currently throws `FATAL_ERROR: Invalid platform` from the `default` branch of the switch in `sdk.ts`.

### Platform switch in sdk.ts — [src/sdk.ts:304–315](src/sdk.ts#L304-L315)

```ts
switch (sdkConfig.platform) {
    case 'cordova':
        this._container.bind<SharedPreferences>(InjectionTokens.SHARED_PREFERENCES)
            .to(SharedPreferencesAndroid).inSingletonScope();
        break;
    case 'web':
        this._container.bind<SharedPreferences>(InjectionTokens.SHARED_PREFERENCES)
            .to(SharedPreferencesLocalStorage).inSingletonScope();
        break;
    default:
        throw new Error('FATAL_ERROR: Invalid platform');
}
```

Only `SharedPreferences` is platform-switched here. All other services (`DbCordovaService`, `FileServiceImpl`, `DownloadServiceImpl`, `DeviceInfoImpl`) are bound unconditionally after the switch.

### CsModule httpAdapter selection — [src/sdk.ts:409](src/sdk.ts#L409)

```ts
httpAdapter: sdkConfig.platform === 'web' ? 'HttpClientBrowserAdapter' : 'HttpClientCordovaAdapter',
```

Binary: either browser or Cordova HTTP. Capacitor apps run in a WebView and do not use `cordova-plugin-advanced-http`, so they need `'HttpClientBrowserAdapter'`.

### window.device.uuid — [src/sdk.ts:413](src/sdk.ts#L413)

```ts
deviceId: SHA1(window.device.uuid).toString()
```

The device UUID is read directly from the Cordova Device plugin inside `CsModule.init()`. This will fail in Capacitor because `window.device` is not populated by the Cordova plugin.

---

## 2. Cordova Global Usage Inventory

### 2a. `window.device` — 26 occurrences across 19 files

| File | Line(s) | Property | Purpose |
|---|---|---|---|
| [src/sdk.ts](src/sdk.ts#L413) | 413 | `.uuid` | Device ID for CsModule init |
| [src/util/device/impl/device-info-impl.ts](src/util/device/impl/device-info-impl.ts#L15) | 15 | `.uuid` | DeviceInfo service |
| [src/form/handle/get-form-handler.ts](src/form/handle/get-form-handler.ts#L56) | 56 | `.platform` | HTTP header `X-Platform-Id` |
| [src/storage/handler/scan/get-modified-content-handler.ts](src/storage/handler/scan/get-modified-content-handler.ts#L21) | 21 | `.platform` | iOS path branch |
| [src/telemetry/util/telemetry-auto-sync-service-impl.ts](src/telemetry/util/telemetry-auto-sync-service-impl.ts#L92) | 92 | `.platform` | Skip background sync on iOS |
| [src/auth/util/auth-util.ts](src/auth/util/auth-util.ts#L26) | 26 | `.platform` | iOS auth variant |
| [src/auth/util/native-keycloak-session-provider/impl/native-keycloak-session-provider.ts](src/auth/util/native-keycloak-session-provider/impl/native-keycloak-session-provider.ts#L44) | 44 | `.platform` | Platform param in OAuth |
| [src/auth/util/native-google-session-provider/impl/native-google-session-provider.ts](src/auth/util/native-google-session-provider/impl/native-google-session-provider.ts#L44) | 44 | `.platform` | Platform param in OAuth |
| [src/auth/util/webview-session-provider/impl/webview-login-session-provider.ts](src/auth/util/webview-session-provider/impl/webview-login-session-provider.ts#L45) | 45 | `.platform` | iOS-specific login param |
| [src/auth/util/webview-session-provider/impl/webview-base-session-provider.ts](src/auth/util/webview-session-provider/impl/webview-base-session-provider.ts#L139) | 139 | `.platform` | iOS URL encoding |
| [src/auth/util/native-apple-session-provider/impl/native-apple-session-provider.ts](src/auth/util/native-apple-session-provider/impl/native-apple-session-provider.ts#L57) | 57 | `.platform` | iOS-only Apple Sign In guard |
| [src/content/impl/content-service-impl.ts](src/content/impl/content-service-impl.ts#L871) | 871–872 | `.platform` | Download directory path |
| [src/content/handlers/question-set-file-read-handler.ts](src/content/handlers/question-set-file-read-handler.ts#L16) | 16 | `.platform` | iOS asset path |
| [src/content/handlers/export/copy-to-destination.ts](src/content/handlers/export/copy-to-destination.ts#L16) | 16 | `.platform` | Export folder (iOS vs Android) |
| [src/content/handlers/export/generate-export-share-telemetry.ts](src/content/handlers/export/generate-export-share-telemetry.ts#L35) | 35 | `.platform` | Share path |
| [src/content/handlers/import/extract-payloads.ts](src/content/handlers/import/extract-payloads.ts) | 132, 134, 359, 527 | `.platform` | ECAR extraction paths |
| [src/content/util/content-util.ts](src/content/util/content-util.ts#L267) | 267 | `.platform` | Content URL construction |
| [src/archive/impl/archive-service-impl.ts](src/archive/impl/archive-service-impl.ts) | 80, 166, 221 | `.platform` | Archive folder path |
| [src/player/impl/player-service-impl.ts](src/player/impl/player-service-impl.ts#L44) | 44 | `.platform` | Player path on iOS |
| [src/course/impl/course-service-impl.ts](src/course/impl/course-service-impl.ts#L261) | 261 | `.platform` | Export folder path |
| [src/util/download/impl/download-service-impl.ts](src/util/download/impl/download-service-impl.ts#L240) | 240 | `.platform` | Download directory |
| [src/util/file/util/path.ts](src/util/file/util/path.ts#L12) | 12 | `.platform` | Assets path |
| [src/certificate/impl/certificate-service-impl.ts](src/certificate/impl/certificate-service-impl.ts#L85) | 85 | `.platform` | Certificate export path |

**Total: 26 occurrences in 19 production files.**

No `window.cordova` direct usage was found (only `cordova.*` globals below).

---

### 2b. `cordova.*` globals — 18 occurrences across 12 files

| File | Line(s) | API | Purpose |
|---|---|---|---|
| [src/auth/util/webview-session-provider/impl/webview-runner-impl.ts](src/auth/util/webview-session-provider/impl/webview-runner-impl.ts#L41) | 41 | `cordova.InAppBrowser.open()` | OAuth/SAML webview |
| [src/profile/impl/profile-service-impl.ts](src/profile/impl/profile-service-impl.ts#L689) | 689 | `cordova.InAppBrowser.open()` | Profile OAuth merge |
| [src/course/impl/course-service-impl.ts](src/course/impl/course-service-impl.ts#L389) | 389 | `cordova.InAppBrowser.open()` | Certificate webview |
| [src/util/file/impl/file-service-impl.ts](src/util/file/impl/file-service-impl.ts#L324) | 324 | `cordova.exec()` | `getFreeDiskSpace` |
| [src/util/file/util/path.ts](src/util/file/util/path.ts#L12) | 12 | `cordova.file.applicationDirectory` | Assets base path |
| [src/content/handlers/export/copy-to-destination.ts](src/content/handlers/export/copy-to-destination.ts#L16) | 16 | `cordova.file.documentsDirectory` / `externalCacheDirectory` | Export destination |
| [src/content/handlers/export/generate-export-share-telemetry.ts](src/content/handlers/export/generate-export-share-telemetry.ts#L35) | 35 | `cordova.file.documentsDirectory` / `externalCacheDirectory` | Share telemetry path |
| [src/content/impl/content-service-impl.ts](src/content/impl/content-service-impl.ts#L872) | 872 | `cordova.file.documentsDirectory` / `externalDataDirectory` | Download dir |
| [src/course/impl/course-certificate-manager-impl.ts](src/course/impl/course-certificate-manager-impl.ts) | 60, 66 | `cordova.file.externalDataDirectory` | Certificate storage |
| [src/course/impl/course-service-impl.ts](src/course/impl/course-service-impl.ts#L261) | 261 | `cordova.file.documentsDirectory` / `externalRootDirectory` | Export folder |
| [src/archive/impl/archive-service-impl.ts](src/archive/impl/archive-service-impl.ts) | 80, 166, 221 | `cordova.file.documentsDirectory` / `externalCacheDirectory` | Archive folder |
| [src/certificate/impl/certificate-service-impl.ts](src/certificate/impl/certificate-service-impl.ts) | 68, 74, 85 | `cordova.file.externalDataDirectory` / `documentsDirectory` / `externalRootDirectory` | Certificate paths |
| [src/util/download/impl/download-service-impl.ts](src/util/download/impl/download-service-impl.ts#L240) | 240 | `cordova.file.documentsDirectory` / `externalDataDirectory` | Download dir |

**Total: 18 occurrences in 12 production files.**

---

## 3. Categorised by Capacitor Migration Phase

| Category | Files | Phase |
|---|---|---|
| `window.device.uuid` | sdk.ts, device-info-impl.ts | Phase 1 — DeviceInfo |
| `window.device.platform` | 19 files | Phase 1 — DeviceInfo |
| `cordova.file.*` path constants | 9 files | Phase 2 — FileService |
| `cordova.InAppBrowser.open()` | webview-runner-impl.ts, profile-service-impl.ts, course-service-impl.ts | Phase 3 — Browser |
| `cordova.exec()` (getFreeDiskSpace) | file-service-impl.ts | Phase 2 — FileService |

---

## 4. Phase 0 Implementation Plan

### Change 1 — src/sdk-config.ts

Extend the `platform` union:

```diff
- platform: 'cordova' | 'web';
+ platform: 'cordova' | 'web' | 'capacitor';
```

**Impact:** Pure type-level change. Zero runtime behaviour change. All existing Cordova and web callers remain unaffected.

### Change 2 — src/sdk.ts (switch block, lines 304–315)

Add a `'capacitor'` case that binds `SharedPreferencesLocalStorage` as a temporary placeholder. The permanent `SharedPreferencesCapacitor` implementation is deferred to the SharedPreferences phase.

```diff
  case 'web':
      this._container.bind<SharedPreferences>(InjectionTokens.SHARED_PREFERENCES)
          .to(SharedPreferencesLocalStorage).inSingletonScope();
      break;
+ case 'capacitor':
+     // Placeholder: replaced with SharedPreferencesCapacitor in the SharedPreferences phase.
+     this._container.bind<SharedPreferences>(InjectionTokens.SHARED_PREFERENCES)
+         .to(SharedPreferencesLocalStorage).inSingletonScope();
+     break;
```

### Change 3 — src/sdk.ts (httpAdapter selection, line 409)

Capacitor apps run in a WebView and do not have `cordova-plugin-advanced-http`. They must use `HttpClientBrowserAdapter`.

```diff
- httpAdapter: sdkConfig.platform === 'web' ? 'HttpClientBrowserAdapter' : 'HttpClientCordovaAdapter',
+ httpAdapter: (sdkConfig.platform === 'web' || sdkConfig.platform === 'capacitor')
+     ? 'HttpClientBrowserAdapter'
+     : 'HttpClientCordovaAdapter',
```

---

## 5. Files to be Modified

| File | Change |
|---|---|
| [src/sdk-config.ts](src/sdk-config.ts) | Add `'capacitor'` to platform union type |
| [src/sdk.ts](src/sdk.ts) | Add `case 'capacitor':` in SharedPreferences switch; update httpAdapter ternary |

**No other files are modified in Phase 0.** All `window.device.*` and `cordova.*` usages documented above are catalogued here and will be addressed in subsequent phases.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| SharedPreferences placeholder (LocalStorage) used for Capacitor — data not encrypted/native | Documented; replaced in SharedPreferences phase |
| `window.device.uuid` still called in `sdk.ts:413` when platform is `'capacitor'` | Will fail at runtime; addressed in Phase 1 (DeviceInfo). Phase 0 does not fix this — it only adds the scaffold. |
| Existing `'cordova'` and `'web'` behaviour is unchanged | Verified — `case 'capacitor':` is a new branch only |

---

## 7. Validation Plan

After implementation:
1. `npm run build` — TypeScript must compile cleanly
2. `npm test` — Existing test suite must pass with zero regressions
