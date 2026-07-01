# Phase 1 Summary — DeviceInfo Migration

## Changes Completed

### New files created
- `src/util/platform/platform-util.ts` — Singleton that caches platform + deviceId at SDK init time. Provides sync `getPlatform()` and `getDeviceId()` used across all files.
- `src/util/device/impl/capacitor-device-info-impl.ts` — Capacitor parallel implementation of `DeviceInfo`. Uses `@capacitor/device` for `getDeviceSpec()`, `getPlatform()` for keyboard events, `getDeviceId()` for device ID.

### Files modified

| File | Change |
|---|---|
| `src/sdk.ts` | Added `initPlatformUtil()` at top of `init()`. Swapped `DeviceInfoImpl` → `CapacitorDeviceInfoImpl` binding for capacitor. Removed `SHA1(window.device.uuid)` → `getDeviceId()`. Removed unused `SHA1` import. |
| `src/util/file/util/path.ts` | `window.device.platform` → `getPlatform()` |
| `src/form/handle/get-form-handler.ts` | `window.device.platform` → `getPlatform()` |
| `src/storage/handler/scan/get-modified-content-handler.ts` | `window.device.platform` → `getPlatform()` |
| `src/auth/util/auth-util.ts` | `window.device.platform` → `getPlatform()` |
| `src/auth/util/webview-session-provider/impl/webview-login-session-provider.ts` | `window.device.platform` → `getPlatform()` |
| `src/auth/util/webview-session-provider/impl/webview-base-session-provider.ts` | `window.device.platform` → `getPlatform()` |
| `src/auth/util/native-google-session-provider/impl/native-google-session-provider.ts` | `window.device.platform` → `getPlatform()` |
| `src/auth/util/native-keycloak-session-provider/impl/native-keycloak-session-provider.ts` | `window.device.platform` (×2) → `getPlatform()` |
| `src/auth/util/native-apple-session-provider/impl/native-apple-session-provider.ts` | `window.device.platform` → `getPlatform()` |
| `src/telemetry/util/telemetry-auto-sync-service-impl.ts` | `window.device.platform` → `getPlatform()` |
| `src/content/impl/content-service-impl.ts` | `window.device.platform` → `getPlatform()` |
| `src/content/handlers/question-set-file-read-handler.ts` | `window.device.platform` → `getPlatform()` |
| `src/player/impl/player-service-impl.ts` | `window.device.platform` → `getPlatform()` |
| `src/content/handlers/export/copy-to-destination.ts` | `window.device.platform` → `getPlatform()` |
| `src/content/handlers/export/generate-export-share-telemetry.ts` | `window.device.platform` → `getPlatform()` |
| `src/content/util/content-util.ts` | `window.device.platform` → `getPlatform()` |
| `src/content/handlers/import/extract-payloads.ts` | `window.device.platform` (×4) → `getPlatform()` |
| `src/archive/impl/archive-service-impl.ts` | `window.device.platform` (×3) → `getPlatform()` |
| `src/course/impl/course-service-impl.ts` | `window.device.platform` → `getPlatform()` |
| `src/util/download/impl/download-service-impl.ts` | `window.device.platform` → `getPlatform()` |
| `src/certificate/impl/certificate-service-impl.ts` | `window.device.platform` → `getPlatform()` |

### Cordova preserved (untouched)
- `src/util/device/impl/device-info-impl.ts` — still uses `window.device.uuid` (Cordova path)

## Risks Discovered
- `@capacitor/device` v5 does not expose memory/storage size. `CapacitorDeviceInfoImpl.getAvailableInternalMemorySize()` returns `'0'` and `getStorageVolumes()` returns a stub. These will need a Cordova plugin equivalent or native Capacitor plugin in a future phase.
- The decorator errors (TS1239) visible in IDE diagnostics across `archive-service-impl.ts`, `course-service-impl.ts`, etc. are pre-existing and not introduced by Phase 1.

## Outstanding Work
- `@capacitor/device` needs to be added to `peerDependencies` in `package.json` (currently only in `devDependencies`)

## Validation Status
- `window.device` scan: 1 remaining (intentional Cordova impl in `device-info-impl.ts`)
- Build: running
