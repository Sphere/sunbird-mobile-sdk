# Phase 2 Summary — SharedPreferences + Network + AppInfo

## Status: COMPLETE

---

## Changes Completed

### New files created

| File | Purpose |
|---|---|
| `src/util/shared-preferences/impl/shared-preferences-capacitor-impl.ts` | Capacitor impl using `@capacitor/preferences`. Keeps in-memory listener Map (no native listener API in Capacitor Preferences). Boolean stored as `'true'/'false'` string. |
| `src/util/network/impl/network-info-capacitor-service-impl.ts` | Capacitor impl using `@capacitor/network`. Async init via `Network.getStatus()` + `Network.addListener('networkStatusChange')`. Exposes `networkStatus$` Observable. |
| `src/util/app/impl/app-info-capacitor-impl.ts` | Capacitor impl using `@capacitor/app`. `App.getInfo()` provides name, version, build. `versionName = version-build` (same format as Cordova path). |

### Files modified

| File | Change |
|---|---|
| `src/sdk.ts` | Added imports for all three new impls. Replaced SharedPreferences capacitor placeholder with `SharedPreferencesCapacitorImpl`. Added capacitor/cordova conditional bindings for `NetworkInfoService` and `AppInfo`. |
| `src/telemetry/handler/telemetry-sync-handler.ts` | Replaced `navigator.connection.type !== Connection.WIFI` (Cordova) with `await Network.getStatus()` and `netStatus.connectionType !== 'wifi'` (`@capacitor/network`). |
| `package.json` | Added `@capacitor/app`, `@capacitor/network`, `@capacitor/preferences` to both `devDependencies` and `peerDependencies`. |

### Cordova preserved (untouched)
- `SharedPreferencesAndroid` — still used for `platform === 'cordova'`
- `NetworkInfoServiceImpl` — still used for `platform === 'cordova'` and `'web'`
- `AppInfoImpl` — still used for `platform === 'cordova'`

---

## DI Bindings Summary (capacitor platform)

| Token | Capacitor Implementation |
|---|---|
| `SHARED_PREFERENCES` | `SharedPreferencesCapacitorImpl` (`@capacitor/preferences`) |
| `NETWORKINFO_SERVICE` | `NetworkInfoCapacitorServiceImpl` (`@capacitor/network`) |
| `APP_INFO` | `AppInfoCapacitorImpl` (`@capacitor/app`) |
| `DEVICE_INFO` | `CapacitorDeviceInfoImpl` (from Phase 1) |

---

## Validation
- `npx tsc --noEmit` — **0 errors**

---

## Services Unblocked
- All key-value storage flows through `@capacitor/preferences`
- Network detection for telemetry sync and content aggregator now uses Capacitor
- App name and version in telemetry `pdata.ver` field sourced from `@capacitor/app`
