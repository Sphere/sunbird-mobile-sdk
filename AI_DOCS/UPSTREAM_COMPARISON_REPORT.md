# Fork vs Upstream Comparison — release-8.0.0

**Upstream:** `https://github.com/Sunbird-Ed/sunbird-mobile-sdk` branch `release-8.0.0`  
**Fork:** `https://github.com/Sphere/sunbird-mobile-sdk` branch `feature/SPRINT-54`  
**Common ancestor:** `6f587efa`  
**Date:** 2026-06-16

---

## Divergence Summary

| | Commits since fork point | SDK version | `@capacitor/filesystem` |
|---|---|---|---|
| **Fork (ours)** | 58 commits | 6.1.1 | ❌ Not installed |
| **Upstream release-8.0.0** | 62 commits | 7.0.35 | ✅ 5.2.2 |

**98 source files changed** between the two, 1,466 insertions / 1,548 deletions.

---

## What Upstream Has Already Done (that we need)

### NEW — `FilePathService` + `FilePaths` enum (the core Capacitor migration building block)

Upstream introduced two new files that replace all `cordova.file.*` path constants:

**`src/services/file-path/file-path.enum.ts`** (NEW)
```ts
export enum FilePaths {
    DOCUMENTS = "documents",
    CACHE = "cache",
    EXTERNAL_STORAGE = "external_storage",
    LIBRARY = "library",
    EXTERNAL = "external",
    DATA = "data"
}
```

**`src/services/file-path/file-path.service.ts`** (NEW)
```ts
// Uses @capacitor/filesystem to resolve actual URIs from Directory enum values
export class FilePathService {
  public static async getFilePath(directory: FilePaths): Promise<string> {
    const result = await Filesystem.getUri({ path: '', directory: dir });
    return result.uri + "/";
  }
}
```

This single abstraction replaces every `cordova.file.documentsDirectory`, `cordova.file.externalDataDirectory`, etc. across the entire codebase.

---

### REWRITTEN — `FileServiceImpl` (Cordova File Plugin → `@capacitor/filesystem`)

`src/util/file/impl/file-service-impl.ts` — 817 lines changed, 608 → 515 lines

Every Cordova File Plugin API has been replaced:

| Was (Cordova) | Now (Capacitor) |
|---|---|
| `file.requestFileSystem()` | `Filesystem.readFile/writeFile/mkdir/stat/readdir` |
| `resolveLocalFileSystemURL()` | `Filesystem.stat()` / `Filesystem.copy()` |
| `cordova.exec('File', 'getFreeDiskSpace', [])` | `DiskSpacePlugin` from `@capacitor/core` |
| `fileEntry.createWriter()` | `Filesystem.writeFile({ encoding: Encoding.UTF8 })` |
| `DirectoryEntry.getFile()` | `Filesystem.stat({ path })` |

---

### MIGRATED — `cordova.file.*` constants → `FilePathService.getFilePath()`

Every file that used `cordova.file.documentsDirectory`, `externalDataDirectory`, etc. has been updated to call `FilePathService.getFilePath(FilePaths.X)`.

| File | Was | Now |
|---|---|---|
| `src/archive/impl/archive-service-impl.ts` | `cordova.file.documentsDirectory` / `externalCacheDirectory` | `FilePathService.getFilePath(FilePaths.DOCUMENTS/CACHE)` |
| `src/content/impl/content-service-impl.ts` | `cordova.file.documentsDirectory` / `externalDataDirectory` | `FilePathService.getFilePath(FilePaths.DOCUMENTS/DATA)` |
| `src/certificate/impl/certificate-service-impl.ts` | `cordova.file.externalDataDirectory` / `externalRootDirectory` | `FilePathService.getFilePath(FilePaths.EXTERNAL/EXTERNAL_STORAGE)` |
| `src/course/impl/course-certificate-manager-impl.ts` | `cordova.file.externalDataDirectory` | `FilePathService.getFilePath(FilePaths.EXTERNAL)` |
| `src/util/download/impl/download-service-impl.ts` | `cordova.file.documentsDirectory` / `externalDataDirectory` | `FilePathService.getFilePath(FilePaths.DOCUMENTS/EXTERNAL)` |
| `src/content/handlers/export/copy-to-destination.ts` | `cordova.file.documentsDirectory` / `externalCacheDirectory` | `FilePathService.getFilePath(FilePaths.DOCUMENTS/CACHE)` |
| `src/content/handlers/export/generate-export-share-telemetry.ts` | `cordova.file.documentsDirectory` / `externalCacheDirectory` | `FilePathService.getFilePath(FilePaths.DOCUMENTS/CACHE)` |
| `src/content/handlers/import/extract-payloads.ts` | `cordova.file.*` (4 occurrences) | Still uses `window.device.platform` (partial migration) |
| `src/profile/handler/export/get-epar-file-path.ts` | Path constants | `FilePathService` |

---

### OTHER UPSTREAM CHANGES

| File | Change |
|---|---|
| `src/util/app/impl/app-info-impl.ts` | Added `platform !== 'cordova'` guard; still uses `cordova.getAppVersion` |
| `src/util/file/util/path.ts` | `getAssetPath()` made async; imports `FilePaths` and `FilePathService` (but still reads `window.device.platform`) |
| `src/form/handle/get-form-handler.ts` | `getAssetPath()` call made async via `defer()` + `switchMap` |
| `src/telemetry/impl/telemetry-service-impl.ts` | Minor fixes (22 lines) |
| `src/profile/handler/search-location-handler.ts` | 51 lines changed |
| `src/framework/handler/get-channel-detail-handler.ts` | 42 lines changed |
| `src/framework/handler/get-framework-detail-handler.ts` | 52 lines changed |
| `.specx.ts` → `.spec.ts` renames | 4 test files enabled (sdk, course-service, page-assembler, device-info) |
| `package.json` version | `6.1.1` → `7.0.35`, added `@capacitor/filesystem: 5.2.2` |
| Node.js (CircleCI) | Upgraded in `.circleci/config.yml` |

---

## What Upstream Has NOT Done (gaps we must fill)

| Gap | Status |
|---|---|
| `SdkConfig.platform` still `'cordova' \| 'web'` — no `'capacitor'` type | ✅ **Our fork already did this (Phase 0)** |
| `sdk.ts` still throws on `'capacitor'` platform | ✅ **Our fork already fixed this (Phase 0)** |
| `httpAdapter` still binary (`web` vs Cordova) | ✅ **Our fork already fixed this (Phase 0)** |
| `window.device.uuid` still called in `sdk.ts:413` | ❌ Not fixed in upstream either |
| `window.device.platform` still used in `path.ts`, `extract-payloads.ts`, `AppInfoImpl` | ❌ Not fixed in upstream |
| `cordova-plugin-android-downloadmanager` still imported directly in `DownloadServiceImpl` | ❌ Not fixed in upstream |
| `cordova.InAppBrowser.open()` still used in 3 files | ❌ Not fixed in upstream |
| `AppInfoImpl` still calls `cordova.getAppVersion.getAppName()` | ❌ Not fixed in upstream |

---

## What Our Fork Has That Upstream Doesn't

| What | Files | Value |
|---|---|---|
| Phase 0 scaffold (`'capacitor'` platform type + switch case + httpAdapter) | `sdk-config.ts`, `sdk.ts` | Needed to run with Capacitor |
| Telemetry `pdata` fix (Issue #775) | `src/telemetry/*` | Sphere-specific |
| Telemetry changes (Issue #702) | Multiple | Sphere-specific |
| Error telemetry (Issue EN-465) | Multiple | Sphere-specific |

---

## Recommended Action: Cherry-pick / Merge Upstream Changes

### Option A — Selective file adoption (recommended)

Adopt the following files from upstream `release-8.0.0` into the fork. These are the Capacitor migration files only, avoiding churn from unrelated upstream commits.

**Priority 1 — Must adopt (new files)**

| File | Action |
|---|---|
| `src/services/file-path/file-path.enum.ts` | Copy from upstream (new file) |
| `src/services/file-path/file-path.service.ts` | Copy from upstream (new file) |

**Priority 2 — Must adopt (FileService rewrite)**

| File | Action |
|---|---|
| `src/util/file/impl/file-service-impl.ts` | Replace with upstream version (Capacitor filesystem) |
| `src/util/file/def/file-service.ts` | Adopt upstream changes (interface updates) |
| `src/util/file/util/path.ts` | Adopt upstream version (async `getAssetPath`, `FilePaths` import) |

**Priority 3 — Must adopt (cordova.file.* → FilePathService replacements)**

| File | Action |
|---|---|
| `src/archive/impl/archive-service-impl.ts` | Adopt upstream changes |
| `src/content/impl/content-service-impl.ts` | Adopt upstream changes |
| `src/certificate/impl/certificate-service-impl.ts` | Adopt upstream changes |
| `src/course/impl/course-certificate-manager-impl.ts` | Adopt upstream changes |
| `src/util/download/impl/download-service-impl.ts` | Adopt upstream changes |
| `src/content/handlers/export/copy-to-destination.ts` | Adopt upstream changes |
| `src/content/handlers/export/generate-export-share-telemetry.ts` | Adopt upstream changes |
| `src/content/handlers/import/extract-payloads.ts` | Adopt upstream changes |
| `src/content/handlers/import/extract-ecar.ts` | Adopt upstream changes |
| `src/profile/handler/export/get-epar-file-path.ts` | Adopt upstream changes |

**Priority 4 — Must adopt (async path.ts consumer fix)**

| File | Action |
|---|---|
| `src/form/handle/get-form-handler.ts` | Adopt upstream (async `getAssetPath` handling) |
| `src/content/handlers/question-set-file-read-handler.ts` | Adopt upstream |

**Priority 5 — Add dependency**

Add to `package.json`:
```json
"@capacitor/filesystem": "5.2.2"
```

---

### Option B — Full merge (riskier)

```bash
git merge upstream/release-8.0.0
```

Risk: This merges ALL 62 upstream commits including unrelated fixes, test renames, API changes. Conflict resolution will be complex where Sphere-specific telemetry changes overlap.

---

## Updated Migration Phase Plan

Given what upstream has already done, the revised phases for our fork are:

| Phase | Task | Source | Status |
|---|---|---|---|
| 0 | Platform scaffold (`'capacitor'` type, switch, httpAdapter) | Fork only | ✅ Done |
| 1 | Adopt `FilePathService` + `FilePaths` enum | From upstream | ⬜ Next |
| 2 | Adopt `FileServiceImpl` (Capacitor filesystem rewrite) | From upstream | ⬜ Next |
| 3 | Adopt all `cordova.file.*` → `FilePathService` replacements | From upstream | ⬜ Next |
| 4 | Add `@capacitor/filesystem` to `package.json` | package.json change | ⬜ Next |
| 5 | Fix `window.device.*` → `@capacitor/device` (DeviceInfo) | Write from scratch | ⬜ Pending |
| 6 | Fix `AppInfoImpl` → `@capacitor/app` | Write from scratch | ⬜ Pending |
| 7 | Fix `sdk.ts:413` `window.device.uuid` → DeviceInfo service | Write from scratch | ⬜ Pending |
| 8 | Fix `cordova.InAppBrowser` → `@capacitor/browser` (BrowserService) | Write from scratch | ⬜ Pending |
| 9 | Fix `DownloadService` (Android downloadmanager → Capacitor) | Write from scratch | ⬜ Pending |
| 10 | Fix `SharedPreferences` → `@capacitor/preferences` | Write from scratch | ⬜ Pending |
| 11 | Fix `DbService` → `@capacitor-community/sqlite` | Write from scratch | ⬜ Pending |
| 12 | Remove Cordova code | Final cleanup | ⬜ Last |
