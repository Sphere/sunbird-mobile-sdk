# Phase 7 Analysis — `sbutility` (sb-cordova-plugin-utility) Capacitor bypass

## Status: IMPLEMENTED AND VALIDATED (2026-07-07) — see phase-7-summary.md for full detail

## Goal

Every remaining direct usage of the Cordova global `sbutility` (from
`sb-cordova-plugin-utility`, declared in `plugins/sb-cordova-plugin-utility.d.ts`) needs a
Capacitor-safe path, without writing a new native plugin, and **without removing the
existing Cordova code path** (`sb-cordova-plugin-utility` stays in `package.json` untouched —
still required for `platform: 'cordova'`, per CLAUDE.md rule 4/7).

## Source plugin confirmed

Fetched from `github.com/Sunbird-Ed/sb-cordova-plugin-utility` @ `release-6.0.0`: pure
Cordova (`package.json` has `"cordova": {"platforms": ["android","ios"]}`; `plugin.xml` uses
the Cordova plugin schema and `<clobbers target="sbutility">` — that's literally what plants
the global). No Capacitor scaffolding exists for it anywhere, and (unlike Phase 6's
DownloadManager) there is no sibling plugin repo already started for it.

## Two things already NOT part of this gap (verified against current code, corrects earlier
## assumption)

- **CsModule HTTP adapter** ([sdk.ts:447-449](../src/sdk.ts#L447)): already
  `sdkConfig.platform === 'capacitor' ? 'HttpClientBrowserAdapter' : 'HttpClientCordovaAdapter'`.
  No work needed.
- **`sbutility.getDeviceSpec` / `getAvailableInternalMemorySize` / `getStorageVolumes`**
  (in `device-info-impl.ts`) and **`sbutility.getBuildConfigValue(s)`** (in `app-info-impl.ts`):
  these are only called from the *old Cordova* `DeviceInfoImpl` / `AppInfoImpl` classes, which
  are only bound when `platform !== 'capacitor'` (see `sdk.ts` conditional bindings from
  Phases 1–2). `CapacitorDeviceInfoImpl` and `AppInfoCapacitorImpl` already have their own,
  separate implementations (`@capacitor/device`, `@capacitor/app`) and never call `sbutility`.
  No work needed here either — already correctly split per-platform.
- **`readFileFromAssets`**: every consumer (`get-form-handler.ts`, `get-system-settings-handler.ts`,
  `get-framework-detail-handler.ts`, `get-channel-detail-handler.ts`, `get-faq-details-handler.ts`,
  `search-location-handler.ts`) already goes through the `FileService` interface — only
  `FileServiceImpl.readFileFromAssets` itself calls `sbutility.readFromAssets` directly.
  Single point of change, not nine.

## The actual gap: 9 files with unconditional (no platform branch) `sbutility` calls

| # | File | Function(s) used | Call site detail |
|---|---|---|---|
| 1 | `src/storage/handler/transfer/validate-destination-folder.ts` | `canWrite` | `ValidateDestinationFolder` already has `FileService` injected; just doesn't use it for this call |
| 2 | `src/storage/handler/transfer/device-memory-check.ts` | `getFreeUsableSpace` | Standalone class, no `FileService` currently injected |
| 3 | `src/storage/handler/transfer/copy-content-from-source-to-destination.ts` | `rm`, `copyDirectory`, `renameDirectory` | 3 private helper methods, simple two-path signatures |
| 4 | `src/storage/handler/transfer/delete-source-folder.ts` | `rm`, `copyDirectory`, `renameDirectory` | Same 3 helpers duplicated here |
| 5 | `src/content/impl/content-service-impl.ts` | `copyFile`, `rm` | `copyFile(sourcePath, destPath, fileName)`; `rm(dir, '')`. (This file's `downloadManager` calls are already handled — Phase 6.) |
| 6 | `src/content/handlers/delete-content-handler.ts` | `rm`, `getMetaData` | **`rm` here is the one exception with real skip-list semantics** — called as `this.rm(basePath, [appIcon, itemSetPreviewUrl].join(':'))`, i.e. "delete everything in this dir except these named files." Not a direct 1:1 swap to `removeRecursively`. `getMetaData` already has `// TODO: move this method to file-service` |
| 7 | `src/content/handlers/export/copy-to-destination.ts` | `copyFile` | `sbutility.copyFile(sourceDir, destDir, fileName, ...)` |
| 8 | `src/content/handlers/export/copy-asset.ts` | `copyFile` | Same shape |
| 9 | `src/content/handlers/import/create-content-import-manifest.ts` | `writeFile` (batch, `fileMapList`) | Already has `// TODO: move this method to file-service` |
| 9b | `src/content/handlers/import/update-size-on-device.ts` | `getMetaData` (batch, `fileMapList`) | — |
| 9c | `src/content/handlers/import/extract-payloads.ts` | `createDirectories` | Already has `// TODO: move this method to file-service` |
| 10 | `src/archive/impl/archive-service-impl.ts` | `copyFile` | Same shape as #7/#8 |
| 11 | `src/telemetry/impl/telemetry-service-impl.ts` | `getUtmInfo` | Install-referrer attribution data, feeds `CorrelationData[]` for telemetry only |
| 12 | `src/util/jwt-util.ts` | `decodeJWTToken`, `getJWTToken` | Standalone static class, no DI, called from 9+ auth/session-provider files and `api-token-handler.ts` |

Plus: `FileServiceImpl.readFileFromAssets` (1 file, already covered above).

## Bypass plan per group — none require a new native plugin

**A. Filesystem-shaped calls (files #1–#10, `rm`/`copyDirectory`/`renameDirectory`/
`getFreeUsableSpace`/`canWrite`/`createDirectories`/`writeFile`/`getMetaData`/`copyFile`)**

`@capacitor/filesystem` is already a dependency, and `FileServiceImpl` already wraps it for
exactly these operations (`removeRecursively`, `copyDir`/`copyFile`→`copyEntry` via
`Filesystem.copy`, `createDir`, `writeFile`, `getMetaData`, `getFreeDiskSpace` via the custom
`DiskSpacePlugin`). Plan: at each call site, branch on `getSdkPlatform() === 'capacitor'`
(from `util/platform/platform-util.ts` — already the established idiom for platform branching
elsewhere in these same files, e.g. `extract-payloads.ts` already imports `getPlatform` for
ios/android branching) and call the equivalent `FileService` method instead of `sbutility`,
**leaving the existing `sbutility` call in the `else` branch untouched** (preserves Cordova
exactly, per CLAUDE.md rule 4/5 — this is the same "parallel implementation + switch" pattern
as every prior phase, just at the call-site level instead of a DI binding, since these are
plain helper classes, not swappable interfaces).

Two call sites need real logic, not a pure pass-through:
- `delete-content-handler.ts`'s `rm(directoryPath, directoryToBeSkipped)` — the skip-list
  semantics need `FileService.listDir` + selective delete, not a direct `removeRecursively`
  call (which has no skip-list concept).
- `device-memory-check.ts` doesn't currently have `FileService` injected — needs a constructor
  change to add it (check the class's instantiation call site to confirm this is safe to add).

Everything else is a straightforward argument-shape translation (e.g. `sbutility.copyFile(src,
dest, fileName, ...)` → `fileService.copyFile(src, fileName, dest, fileName)`).

**B. `jwt-util.ts` (`decodeJWTToken`, `getJWTToken`)**

Pulled the actual native source (`JWTTokenCreator.java`) — it's plain HMAC-SHA256 JWT, no
device keystore involved:
```
createJWToken(subject, secretKey, alg=HS256):
    header = base64url({"alg":"HS256"})
    body   = base64url({"iss": subject})
    sig    = base64url(HMAC-SHA256(header + "." + body, secretKey))
    return header + "." + body + "." + sig

decodeToken(token): return utf8_decode(base64_decode(token.split(".")[1]))   // no verification
```
`crypto-js` is already a dependency (has `HmacSHA256`, `enc.Base64`). This can be reimplemented
in pure TypeScript, applied **unconditionally for every platform** (not just capacitor) since
it's a pure algorithm with no native dependency — an actual improvement, not a workaround.
Zero behavioral risk if implemented to the exact spec above.

**C. `telemetry-service-impl.ts` `getUtmInfo`**

No Capacitor equivalent exists (install-referrer requires native Play Store APIs). Analytics-only,
non-blocking. Bypass: branch on `getSdkPlatform() === 'capacitor'` and resolve `[]` (empty
`CorrelationData[]`) instead of calling `sbutility.getUtmInfo`. Matches the precedent already
set in `CapacitorDeviceInfoImpl` (stubs `getAvailableInternalMemorySize`/`getStorageVolumes` to
0/empty because `@capacitor/device` doesn't expose them). Tracked as a known permanent gap
until/unless a real Capacitor install-referrer plugin is added later.

**D. `FileServiceImpl.readFileFromAssets`**

Needs care — Cordova's path convention here (`Path.ASSETS_PATH =
'file:///android_asset/www/assets'` on Android, `'www/assets'` on iOS, from
`src/util/file/util/path.ts`) is Cordova/`www`-folder-specific. A Capacitor app's bundled web
assets are served by the local webview itself, so the equivalent is a plain relative `fetch()` —
but the exact path prefix depends on how the **consuming app** (`sphere-mobile`) structures its
Capacitor web build output, which this SDK repo can't fully verify on its own. **Flagging this
one as needing confirmation against the actual host app build output before finalizing**,
rather than guessing the path convention.

## Design principle

Every one of the 9 files gets a `getSdkPlatform() === 'capacitor'` branch (already imported
elsewhere in this codebase for platform checks) that calls `FileService`/pure-TS equivalents on
Capacitor, falling through to the existing untouched `sbutility.X(...)` call for `cordova`/`web`.
This is the same "preserve + add parallel path" discipline as Phases 1–6, just expressed as an
inline branch rather than a DI binding swap, since these are plain helper classes without a
service interface to rebind.

## Files impacted (13 total)

| File | Change |
|---|---|
| `src/storage/handler/transfer/validate-destination-folder.ts` | Add capacitor branch for `canWrite` (reuse injected `FileService`) |
| `src/storage/handler/transfer/device-memory-check.ts` | Inject `FileService`; add capacitor branch for `getFreeUsableSpace` |
| `src/storage/handler/transfer/copy-content-from-source-to-destination.ts` | Add capacitor branch for `rm`/`copyDirectory`/`renameDirectory` |
| `src/storage/handler/transfer/delete-source-folder.ts` | Same as above |
| `src/content/impl/content-service-impl.ts` | Add capacitor branch for `copyFile`/`rm` |
| `src/content/handlers/delete-content-handler.ts` | Add capacitor branch for `rm` (skip-list logic) and `getMetaData` |
| `src/content/handlers/export/copy-to-destination.ts` | Add capacitor branch for `copyFile` |
| `src/content/handlers/export/copy-asset.ts` | Add capacitor branch for `copyFile` |
| `src/content/handlers/import/create-content-import-manifest.ts` | Add capacitor branch for `writeFile` (batch) |
| `src/content/handlers/import/update-size-on-device.ts` | Add capacitor branch for `getMetaData` (batch) |
| `src/content/handlers/import/extract-payloads.ts` | Add capacitor branch for `createDirectories` |
| `src/archive/impl/archive-service-impl.ts` | Add capacitor branch for `copyFile` |
| `src/telemetry/impl/telemetry-service-impl.ts` | Add capacitor branch for `getUtmInfo` → `[]` |
| `src/util/jwt-util.ts` | Full rewrite to pure TS/crypto-js, unconditional (all platforms) |
| `src/util/file/impl/file-service-impl.ts` | `readFileFromAssets` — **pending host-app path confirmation** |

## Dependencies

- `@capacitor/filesystem` — already a dependency (Phase 5/existing `FileServiceImpl`)
- `crypto-js` — already a dependency
- `util/platform/platform-util.ts`'s `getSdkPlatform()` — already exists, exactly fits this use
  (distinct from `getPlatform()`, which returns OS name android/ios/web, not the SDK config flag)
- No new packages, no new native plugin, no `package.json` changes

## Risks

| Risk | Notes |
|---|---|
| `delete-content-handler.ts` skip-list `rm` | Needs real logic (list + selective delete), not a pass-through — highest-complexity single change in this phase |
| `readFileFromAssets` path convention | Needs confirmation against `sphere-mobile`'s actual Capacitor web-asset output structure before finalizing |
| `device-memory-check.ts` constructor change | Need to verify all call sites that construct `DeviceMemoryCheck` are updated to pass `FileService` |
| Scope (13 files) | Larger than any prior phase; will validate with `npm install` + `npm run build:dev` same as Phases 1–6, and should double check existing `.spec.ts` files for these classes still pass (several exist per earlier grep: `delete-source-folder.spec.ts`, `device-memory-check.spec.ts`, `validate-destination-folder.spec.ts`, `copy-content-from-source-to-destination.spec.ts`, `telemetry-service-impl.spec.ts`, `delete-content-handler.spec.ts`, `copy-to-destination.spec.ts`, `copy-asset.spec.ts`, `create-content-import-manifest.spec.ts`, `update-size-on-devices.spec.ts`, `extract-payloads.spec.ts`, `jwt-util.spec.ts`) |

## Outstanding work / open question for approval

1. Confirm `readFileFromAssets` bypass approach against the actual `sphere-mobile` Capacitor
   build output (or defer that one file if not confirmable now, leaving Cordova path in place
   since it's not currently breaking anything untested).
2. Proceed with the `getSdkPlatform() === 'capacitor'` dual-path pattern across the other 12
   files + the `jwt-util.ts` rewrite.

READY FOR PHASE 7 APPROVAL (pending the two confirmations above)
