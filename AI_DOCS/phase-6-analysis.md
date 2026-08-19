# Phase 6 Analysis — DownloadService

## Status: IMPLEMENTED AND VALIDATED (2026-07-06)

`DownloadServiceCapacitorImpl` has been written and wired into `sdk.ts`. The sibling plugin's
missing `dist/` build (the earlier blocker) was resolved by running its `npm run build`; this
repo's `npm install --legacy-peer-deps` and `npm run build:dev` both now pass (0 TS errors).
See `phase-6-summary.md` for full detail, including a pre-existing unrelated peer-dependency
conflict that had to be bypassed and a real `headers` type error the compiler caught and that
was fixed.

## Original status (superseded above): PAUSED (blocked on external plugin, by explicit decision)

## Goal
Replace `cordova-plugin-android-downloadmanager` (global `downloadManager` from
`window['downloadManager']`) with a Capacitor equivalent, per the migration plan's
recommended Option A: a custom Capacitor plugin wrapping Android `DownloadManager` natively
(and, on iOS, `URLSession`).

---

## Current Cordova implementation

`src/util/download/impl/download-service-impl.ts` — `DownloadServiceImpl`

Uses the global `downloadManager` (from `cordova-plugin-android-downloadmanager`, assigned
in the constructor via `window['downloadManager'] = downloadManagerInstance`) with three
callback-style methods:

- `downloadManager.enqueue(request, (err, id) => ...)`
- `downloadManager.query({ ids }, (err, entries) => ...)`
- `downloadManager.remove([downloadId], (err, removeCount) => ...)`

Status polling happens on a 1s `interval()` via `listenForDownloadProgressChanges()`, which
calls `getDownloadProgress()` → `downloadManager.query()` and emits `DownloadProgress` events
on `EventsBusService` (namespace `DOWNLOADS`). Download list persistence uses
`SharedPreferencesSetCollection` (already platform-agnostic, no Cordova dependency — no
change needed there).

The SDK's `DownloadStatus` enum (`src/util/download/def/download-status.ts`) already uses
Android's own bitmask: `PENDING=1, RUNNING=2, PAUSED=4, SUCCESSFUL=8, FAILED=16`.

---

## Interface to implement

`src/util/download/def/download-service.ts` — `DownloadService` (unchanged, platform-agnostic):
`download()`, `cancel()`, `cancelAll()`, `registerOnDownloadCompleteDelegate()`,
`getActiveDownloadRequests()`, `trackDownloads()`, plus `SdkServiceOnInitDelegate` /
`ContentDeleteListener`.

A `DownloadServiceCapacitorImpl` would need to swap only the native calls (`enqueue`,
`query`, `remove`) — all the RxJS orchestration, shared-preferences-backed queue, and
telemetry logic in `DownloadServiceImpl` is platform-agnostic and would carry over unchanged
(same pattern as Phase 3's `DbCapacitorService` and Phase 5's `ZipServiceCapacitorImpl`,
which reused the surrounding orchestration and only swapped the native I/O calls).

---

## Discovery: a sibling repo already covers Option A, but it isn't finished

Found `../Sphere-capacitor-downloadmanager` (sibling to this SDK, at
`OFFICE/SPHERE/Sphere-capacitor-downloadmanager`) — a from-scratch Capacitor 8 plugin
(`capacitor-plugin-downloadmanager`) already mid-migration from the same source Cordova
plugin, being built against its own 9-phase plan (`AI_DOC/00-migration-plan.md`):

| Its phase | Status |
|---|---|
| 1. Project scaffolding | ✅ done |
| 2. TypeScript bridge (`src/definitions.ts`, `src/index.ts`, `src/web.ts`) | ✅ done |
| 3. `enqueue()` native (Android + iOS) | ❌ stub |
| 4. `query()` native | ❌ stub |
| 5. `remove()` native | ❌ stub |
| 6. `addCompletedDownload()` native | ❌ stub |
| 7. `fetchSpeedLog()` native | ❌ stub |
| 8. Cleanup (delete old Cordova sources) | ❌ not started |
| 9. Verification on device | ❌ not started |

Its TypeScript contract (`DownloadManagerPlugin`: `enqueue`, `query`, `remove`,
`addCompletedDownload`, `fetchSpeedLog`) is stable and its status bitmask
(`Pending=1, Running=2, Paused=4, Successful=8, Failed=16`) matches this SDK's
`DownloadStatus` enum exactly — so wiring, once its native side is done, should be a direct
swap with no status-translation layer needed.

It is **not yet consumable**: `android/.../DownloadManagerPlugin.java` and
`ios/Sources/.../DownloadManagerPlugin.swift` are still empty Phase-1 classes, its working
tree has uncommitted changes and has never been pushed to its `origin` remote, and its
`package.json` `main`/`module`/`types` point at a `dist/` that has never been committed (only
built transiently for validation, then deleted).

---

## Decision (user, 2026-07-06)

Given the choice between (a) writing `DownloadServiceCapacitorImpl` now against the stable
TS contract despite non-functional native code, or (b) waiting for the plugin repo to finish
native implementation first — **the user chose to wait**. SDK Phase 6 is paused; no
`DownloadServiceCapacitorImpl`, no DI binding, and no `package.json` dependency change have
been made in this repo as part of this session.

Chosen dependency-wiring approach for when work resumes: local `file:` path
(`"capacitor-plugin-downloadmanager": "file:../Sphere-capacitor-downloadmanager"`) rather
than a git URL, since the plugin repo hasn't been pushed yet. This will need to be revisited
once that repo is pushed/published.

---

## Files that will be impacted once this resumes

| File | Change |
|---|---|
| `src/util/download/impl/download-service-capacitor-impl.ts` | NEW — swap `enqueue`/`query`/`remove` calls to `DownloadManager` plugin, reuse existing orchestration |
| `src/sdk.ts` | Conditional `DOWNLOAD_SERVICE` binding on `sdkConfig.platform === 'capacitor'` (same pattern as `ZIP_SERVICE`, line ~373) |
| `package.json` | Add `capacitor-plugin-downloadmanager` dependency (`file:` path, pending publish) |
| `../Sphere-capacitor-downloadmanager` | Needs its own phases 3–9 completed first (separate repo, separate scope) |

---

## Risks

| Risk | Notes |
|---|---|
| Native plugin incomplete | Blocking — `enqueue`/`query`/`remove` are stubs in the sibling repo. Nothing to wire against yet. |
| Status/reason code parity | Low risk — bitmask values already match; iOS `URLSession` implementation (plugin phase 3/4) needs to target the same values, per that repo's own migration plan. |
| `downloadedFilePath` construction | Current impl builds this path itself via `FilePathService` (from Phase 1/2 work) rather than trusting a path from the plugin — this logic is platform-agnostic already and needs no change. |
| Dependency wiring | Local `file:` path works for development but isn't suitable for a real release; must switch to a published/git dependency before Phase 8 (Cordova removal) can be considered complete for this service. |

## Outstanding work

- Sphere-capacitor-downloadmanager repo: phases 3–9 (native Android + iOS implementation, cleanup, device verification).
- Once that's done: resume this analysis's "Files that will be impacted" table as the actual implementation task.
