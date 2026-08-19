# Phase 1 Analysis — DeviceInfo Migration

## Goal
Replace all `window.device.*` calls with `@capacitor/device`.

---

## Findings

### `window.device.*` usages — 29 occurrences across 16 files

| Property | Files | Count |
|---|---|---|
| `window.device.uuid` | sdk.ts, device-info-impl.ts | 2 |
| `window.device.platform` | 14 other files | 27 |

`window.device.manufacturer`, `.model`, `.version` are NOT used directly — they come via `sbutility.getDeviceSpec()`.

### Files impacted

**Core device files:**
- `src/util/device/impl/device-info-impl.ts` — uses `window.device.uuid` in constructor
- `src/sdk.ts:420` — uses `window.device.uuid` for CsModule deviceId

**Platform detection (window.device.platform):**
- `src/util/file/util/path.ts:14`
- `src/form/handle/get-form-handler.ts:57`
- `src/storage/handler/scan/get-modified-content-handler.ts:21`
- `src/auth/util/auth-util.ts:26`
- `src/auth/util/webview-session-provider/impl/webview-login-session-provider.ts:45`
- `src/auth/util/webview-session-provider/impl/webview-base-session-provider.ts:139`
- `src/auth/util/native-google-session-provider/impl/native-google-session-provider.ts:44`
- `src/auth/util/native-keycloak-session-provider/impl/native-keycloak-session-provider.ts:44`
- `src/auth/util/native-apple-session-provider/impl/native-apple-session-provider.ts:57`
- `src/telemetry/util/telemetry-auto-sync-service-impl.ts:92`
- `src/content/impl/content-service-impl.ts:856`
- `src/content/handlers/question-set-file-read-handler.ts:16`
- `src/player/impl/player-service-impl.ts:44`
- `src/content/handlers/export/copy-to-destination.ts:13`
- `src/content/handlers/export/generate-export-share-telemetry.ts:32`
- `src/content/util/content-util.ts:267`
- `src/content/handlers/import/extract-payloads.ts:132,134,351,486`
- `src/archive/impl/archive-service-impl.ts:83,181,265`
- `src/course/impl/course-service-impl.ts:263`
- `src/util/download/impl/download-service-impl.ts:242`
- `src/certificate/impl/certificate-service-impl.ts:87`

---

## Key Challenge

`window.device.*` is **synchronous**. `@capacitor/device` is **async**.

All 27 `platform` checks are inline, synchronous reads inside methods and constructors. They cannot be made directly async without refactoring every call site.

**Solution:** Pre-cache device info at SDK init time using a `PlatformUtil` singleton. Populate it once (async) during `sdk.ts init()`, then expose sync getters everywhere.

---

## Dependencies

- `@capacitor/device` — NOT installed in SDK. Must add.
- `@capacitor/core` — already installed (5.7.8).

### @capacitor/device API used
```ts
Device.getId()   → Promise<{ identifier: string }>   // replaces window.device.uuid
Device.getInfo() → Promise<{ platform: 'ios'|'android'|'web', ... }>  // replaces window.device.platform
```

---

## Implementation Plan

### Step 1 — Install @capacitor/device
Add to devDependencies and peerDependencies in package.json.

### Step 2 — Create PlatformUtil (new file)
`src/util/platform/platform-util.ts`
- Module-level cache variables: `_platform`, `_deviceId`
- `initPlatformUtil(platform: string)` — async, calls Capacitor Device API, populates cache
- `getPlatform()` — sync getter (returns cached value or falls back to `window.device.platform` for Cordova)
- `getDeviceId()` — sync getter (returns cached SHA1 uuid)

### Step 3 — Create CapacitorDeviceInfoImpl (new file)
`src/util/device/impl/capacitor-device-info-impl.ts`
- Parallel to existing `DeviceInfoImpl` (Cordova — untouched)
- Uses `PlatformUtil.getDeviceId()` for `getDeviceID()`
- Uses `Device.getInfo()` for `getDeviceSpec()`

### Step 4 — Update sdk.ts
- In `init()`, when `platform === 'capacitor'`: call `initPlatformUtil('capacitor')` first
- Replace `window.device.uuid` at line 420 with `PlatformUtil.getDeviceId()`
- Bind `CapacitorDeviceInfoImpl` instead of `DeviceInfoImpl` for capacitor platform

### Step 5 — Replace window.device.platform in all 16 files
Replace `window.device.platform.toLowerCase()` with `PlatformUtil.getPlatform()`

---

## Risks

1. `PlatformUtil.init()` must complete before any service reads platform — enforced by awaiting it at the top of `sdk.ts init()`.
2. Cordova path is unchanged — no regression risk for existing Cordova builds.
3. `sbutility.getDeviceSpec()` is Cordova-only — `CapacitorDeviceInfoImpl.getDeviceSpec()` needs a Capacitor alternative. Using `Device.getInfo()` for available fields; others will be empty/zero.
