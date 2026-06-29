# What We Got from Merging Upstream release-8.0.0

**Merged on:** 2026-06-17  
**Upstream branch:** `Sunbird-Ed/sunbird-mobile-sdk` → `release-8.0.0`  
**Into:** `feature/SPRINT-54`

---

## The Short Version

The upstream team at Sunbird has already done a significant chunk of the Cordova → Capacitor migration for us.  
Before the merge, our fork was stuck at SDK version **6.1.1** with Cordova-only file APIs.  
After the merge, we are on version **7.0.35** with Capacitor file APIs working.

---

## What Changed — In Plain Terms

### 1. File System: Cordova → Capacitor (the biggest change)

**Before:** Every file read/write/delete operation used the old Cordova File Plugin (`window.requestFileSystem`, `resolveLocalFileSystemURL`, `fileEntry.createWriter`, etc.). This only works inside a Cordova app — it breaks completely in Capacitor.

**After:** All of that is replaced with `@capacitor/filesystem` — the official Capacitor plugin. Now the SDK can read/write files the Capacitor way.

Files affected: `src/util/file/impl/file-service-impl.ts` (completely rewritten, 600+ lines changed).

---

### 2. File Path Resolution: Cordova Constants → FilePathService (new abstraction)

**Before:** Every part of the SDK that needed a folder path would write things like:
```
cordova.file.documentsDirectory
cordova.file.externalDataDirectory
cordova.file.externalCacheDirectory
```
These are Cordova-specific global variables that don't exist in Capacitor.

**After:** Two new files were added:
- `src/services/file-path/file-path.enum.ts` — a list of folder types (Documents, Cache, External, etc.)
- `src/services/file-path/file-path.service.ts` — a service that asks Capacitor for the actual path

Any code that needed a file path now calls `FilePathService.getFilePath(FilePaths.DOCUMENTS)` instead of `cordova.file.documentsDirectory`. This works on both Android and iOS via Capacitor.

**~15 files** across content, archive, download, certificate, profile, and export modules were updated to use this.

---

### 3. SDK Version Bump: 6.1.1 → 7.0.35

The version number jumped because this was a major release on the upstream side. It includes all the fixes they made over several months. Our package name stays `@aastrika_npmjs/sunbird-sdk` (we kept our fork name).

---

### 4. Capacitor Filesystem is Now a Declared Dependency

`@capacitor/filesystem: 5.2.2` has been added to `package.json`. Before the merge, it was not declared at all, meaning any Capacitor-related code would fail with module-not-found errors.

---

### 5. Minor Fixes Across Several Modules

| Area | What changed |
|---|---|
| **Content export/import** | ~12 handler files cleaned up, path constants replaced |
| **Course certificate** | Uses Capacitor file path now |
| **Download service** | Uses Capacitor file path now |
| **Form handler** | Handles async file path correctly |
| **Framework & channel handlers** | Internal logic cleaned up |
| **Profile export** | Uses Capacitor file path now |
| **Telemetry** | Minor fixes |
| **Auth** | Minor fixes to browser session provider |
| **CI pipeline** | Node.js version upgraded in CircleCI |

---

## What We Kept from Our Fork (not overwritten)

| Our Change | Why it was kept |
|---|---|
| `SdkConfig.platform: 'capacitor'` type | Our Phase 0 — upstream hadn't done this |
| `sdk.ts` Capacitor switch block | Our Phase 0 — upstream hadn't done this |
| Assessment fix (`_app_file_` prefix for `application/json` content) | Sphere-specific, not in upstream |
| Telemetry `pdata` fix (Issue #775) | Sphere-specific |
| Telemetry changes (Issue #702) | Sphere-specific |
| Error telemetry (Issue EN-465) | Sphere-specific |

---

## What Still Needs Work (not done by upstream either)

These are gaps that neither upstream nor our fork has filled yet. These are our remaining migration phases.

| Gap | What it means |
|---|---|
| `window.device.uuid` / `window.device.platform` | Some code still reads device info the Cordova way |
| `cordova.getAppVersion` | App name/version still read via Cordova |
| `cordova.InAppBrowser.open()` | 3 places still open URLs via Cordova browser |
| `cordova-plugin-android-downloadmanager` | Download manager still uses Cordova plugin |
| `SharedPreferences` (Cordova plugin) | Preferences storage not yet migrated |
| `DbService` (Cordova SQLite plugin) | Database not yet migrated |

These will be addressed in the upcoming phases of the migration plan.

---

## Build Status After Merge

`tsc --noEmit` → **0 errors** ✅  
All TypeScript type errors introduced by the upstream code have been fixed.
