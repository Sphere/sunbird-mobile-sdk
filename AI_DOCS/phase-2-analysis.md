# Phase 2 Analysis — SharedPreferences + Network + AppInfo

## Goal
Replace three lightweight services that have direct Capacitor equivalents already installed in the consuming app.

---

## 2A — SharedPreferences

### Current Cordova implementation
`src/util/shared-preferences/impl/shared-preferences-android.ts`
- Uses `plugins.SharedPreferences.getInstance()` from `cordova-plugin-awesome-shared-preferences`
- Methods: `getString`, `putString`, `putBoolean`, `getBoolean`, `addListener`, `removeListener`
- In sdk.ts `case 'capacitor'` → currently bound to `SharedPreferencesLocalStorage` (placeholder from Phase 0)

### Interface contract
```ts
getString(key)        → Observable<string | undefined>
putString(key, value) → Observable<undefined>
putBoolean(key, val)  → Observable<boolean>
getBoolean(key)       → Observable<boolean>
addListener(key, fn)
removeListener(key, fn)
```

### Capacitor replacement
`@capacitor/preferences@8.0.1` — already installed in consuming app
- `Preferences.get({ key })` → `{ value: string | null }`
- `Preferences.set({ key, value })` → `void`
- `Preferences.remove({ key })` → `void`
- No built-in listeners → keep in-memory `Map<string, listener[]>` pattern from Cordova impl
- Boolean stored as string `'true'/'false'` (same as localStorage impl)

### Files impacted
- `src/util/shared-preferences/impl/shared-preferences-capacitor-impl.ts` ← NEW
- `src/sdk.ts` ← rebind for capacitor platform

---

## 2B — NetworkInfoService

### Current Cordova implementation
`src/util/network/impl/network-info-service-impl.ts`
- Uses `navigator.connection.type` (from Cordova Network Information plugin) in constructor
- Falls back to `window.addEventListener('online'/'offline')` for change detection

### Extra Cordova call (outside DI service)
`src/telemetry/handler/telemetry-sync-handler.ts:100`
- `navigator.connection.type !== Connection.WIFI` — direct Cordova call, not via DI
- Must also be replaced

### Interface contract
```ts
networkStatus$: Observable<NetworkStatus>   // ONLINE | OFFLINE
```

### Capacitor replacement
`@capacitor/network@8.0.1` — already installed in consuming app
- `Network.getStatus()` → `{ connected: boolean, connectionType: 'wifi'|'cellular'|'none'|'unknown' }`
- `Network.addListener('networkStatusChange', callback)` → real-time updates

### Files impacted
- `src/util/network/impl/network-info-capacitor-service-impl.ts` ← NEW
- `src/telemetry/handler/telemetry-sync-handler.ts:100` ← fix direct navigator.connection call
- `src/sdk.ts` ← rebind for capacitor platform

---

## 2C — AppInfo

### Current Cordova implementation
`src/util/app/impl/app-info-impl.ts`
- Constructor already calls `window['Capacitor']['Plugins'].App.getInfo()` — old Capacitor 2 API, not imported cleanly
- Cordova path in `init()` uses `window.sbutility.getBuildConfigValue()` for version
- `versionName` = `${version}-${build}`, `appName` from App.getInfo()

### Interface contract
```ts
init(): Promise<void>
getAppName(): string
getVersionName(): string
getFirstAccessTimestamp(): Observable<string>
```

### Capacitor replacement
`@capacitor/app@8.1.0` — already installed in consuming app
- `App.getInfo()` → `{ id, name, version, build }` (async)
- `versionName` = `${version}-${build}` (same format as Cordova)
- `getFirstAccessTimestamp()` uses SharedPreferences — no change needed (DI injected)

### Files impacted
- `src/util/app/impl/app-info-capacitor-impl.ts` ← NEW
- `src/sdk.ts` ← rebind for capacitor platform

---

## SDK devDependencies to add
| Package | Version (matches consuming app) |
|---|---|
| `@capacitor/preferences` | `8.0.1` |
| `@capacitor/network` | `8.0.1` |
| `@capacitor/app` | `8.1.0` |

---

## Implementation order
1. Install packages in SDK
2. Create `SharedPreferencesCapacitorImpl` (2A)
3. Create `NetworkInfoCapacitorServiceImpl` (2B)
4. Fix `telemetry-sync-handler.ts` direct navigator.connection call (2B)
5. Create `AppInfoCapacitorImpl` (2C)
6. Wire all three in `sdk.ts`
7. Build and validate
