# Phase 6 Summary — DownloadService (Capacitor plugin swap)

## Status: Implemented and validated (2026-07-06)

## Changes completed

- **New:** [`src/util/download/impl/download-service-capacitor-impl.ts`](../src/util/download/impl/download-service-capacitor-impl.ts)
  — `DownloadServiceCapacitorImpl`. Line-for-line copy of `DownloadServiceImpl`'s RxJS
  orchestration, shared-preferences-backed queue, telemetry, and cancellation logic
  (all preserved, unchanged). The only functional difference is the constructor: instead
  of `window['downloadManager'] = downloadManagerInstance` (the raw Cordova plugin import),
  it installs `createDownloadManagerShim()` — a small callback-style adapter that wraps the
  new promise-based `capacitor-plugin-downloadmanager` (`DownloadManager.enqueue/query/remove/
  fetchSpeedLog`) behind the exact same ambient `downloadManager` interface declared in
  `plugins/cordova-plugin-android-downloadmanager.d.ts`.
- **Modified:** [`src/sdk.ts`](../src/sdk.ts) — imports `DownloadServiceCapacitorImpl` and
  conditionally binds `InjectionTokens.DOWNLOAD_SERVICE` to it when
  `sdkConfig.platform === 'capacitor'` (same pattern as `ZIP_SERVICE`/`DB_SERVICE`/
  `DEVICE_INFO`/`APP_INFO`), else keeps binding `DownloadServiceImpl` as before.
- **Modified:** [`package.json`](../package.json) — added
  `"capacitor-plugin-downloadmanager": "file:../Sphere-capacitor-downloadmanager"` to both
  `peerDependencies` and `devDependencies` (matching the `@capacitor-community/sqlite`
  pattern), pending publish of that sibling repo.

## Why the shim, not a direct rewrite

`downloadManager` (global) is read directly — not just from `DownloadServiceImpl` — by:
- `src/content/impl/content-service-impl.ts` (:900, :914)
- `src/course/impl/course-service-impl.ts` (:311, :326)
- `src/certificate/impl/certificate-service-impl.ts` (:123, :138)
- `src/telemetry/util/telemetry-auto-sync-service-impl.ts` (:17, `fetchSpeedLog`)

All four call the old callback-style signature (`enqueue(req, (err,id)=>...)`, raw-array
`remove(ids, cb)`, etc.) directly against the global, bypassing `DownloadService` entirely.
Swapping `download-service-impl.ts` alone to call the new promise-based plugin directly,
without keeping the global populated in a compatible shape, would leave those four files
calling into `undefined` on the Capacitor platform. User chose (2026-07-06) to install a
compatibility shim rather than touch those four files, keeping this phase scoped to "replace
only the plugin layer."

Field mapping in the shim (verified 1:1, no lossy translation needed):
- `enqueue`: old `EnqueueRequest.uri` → new `EnqueueRequest.url`; all other fields identical;
  `headers` is always `[]` at every call site in this repo, so the old
  `{[key:string]:string}[]` vs new `{header,value}[]` shape mismatch never manifests.
- `query`: new plugin wraps the array in `{ downloads: [...] }`; `DownloadInfo` fields
  (`id, title, description, mediaType, localFilename, localUri, mediaproviderUri, uri,
  lastModifiedTimestamp, status, reason, bytesDownloadedSoFar, totalSizeBytes`) match the old
  `EnqueuedEntry` field-for-field.
- `remove`: old took a raw `string[]`, new takes `{ ids }`; old callback got a raw count,
  new resolves `{ removed }`.
- `fetchSpeedLog`: new `SpeedLog { totalKBdownloaded, distributionInKBPS }` matches old
  `DownloadSpeedLog` exactly; shim just re-wraps the promise into the old two-arg callback.
- Status bitmask: plugin's `DownloadStatus` enum (`Pending=1, Running=2, Paused=4,
  Successful=8, Failed=16`) is numerically identical to the SDK's own
  `src/util/download/def/download-status.ts` — no translation layer needed, confirmed
  in the original Phase 6 analysis and unchanged here.

## Files modified

| File | Change |
|---|---|
| `src/util/download/impl/download-service-capacitor-impl.ts` | NEW |
| `src/sdk.ts` | Conditional `DOWNLOAD_SERVICE` binding + import |
| `package.json` | `capacitor-plugin-downloadmanager` dependency (`file:` path) |

## Risks discovered

| Risk | Notes |
|---|---|
| ~~Blocking: sibling plugin has no `dist/` build~~ RESOLVED | `../Sphere-capacitor-downloadmanager/package.json` pointed `main`/`module`/`types` at `dist/plugin.cjs.js` / `dist/esm/index.js` / `dist/esm/index.d.ts`, none of which existed. Fixed by running `npm run build` in that repo (`tsc` + `rollup` + `docgen`), which generated `dist/` — confirmed `require.resolve('capacitor-plugin-downloadmanager')` now resolves to `dist/plugin.cjs.js`. |
| Pre-existing peer-dependency conflict (unrelated to Phase 6) | `npm install` in this repo failed on `@capacitor/core@5.7.8` (devDependency, from before Phase 6) vs `@capacitor-community/sqlite@7.0.3` (Phase 3) requiring `@capacitor/core >=7.0.0`. `node_modules` already had these installed from a prior session, implying `--legacy-peer-deps` (or `--force`) was used before without being documented. Re-ran `npm install --legacy-peer-deps` (user-approved) to get past it — no `package.json` changes, only affects this install's resolution. Worth fixing properly (bump the `@capacitor/core` devDependency) before Phase 8. |
| `headers` shape mismatch caught by the compiler | The shim's `enqueue` spread `...rest` from the ambient `EnqueueRequest` type, which carried the old `headers: {[key:string]:string}[]` shape into the call to the new plugin's `EnqueueRequest` (`headers: RequestHeader[]`) — `tsc` correctly rejected this (`error TS2345`). Fixed by destructuring `headers` out of `rest` and passing `headers: []` explicitly, since every call site in this repo always passes an empty array. |
| Native Android/iOS implementation completeness | Per the original analysis, `enqueue`/`query`/`remove` native sides were stubs as of the last check in that repo; `git log` there now shows an iOS implementation merged (`f46eccb Download Manager plugin ios platform implementation` and later commits), so native completeness should be re-verified in that repo before relying on this in a real build — not re-audited in this session. |
| Sibling repo has uncommitted local changes | `git status --short` in `../Sphere-capacitor-downloadmanager` shows modified/untracked files (deleted old Cordova sources, new `android/`, `ios/`, `src/`, config files) that have never been pushed to `origin`. The `file:` dependency works against the local working tree regardless, but this isn't a reproducible/CI-safe state yet. |
| `headers` shape mismatch (old vs new plugin) | Not currently a real risk — every call site in this repo passes `headers: []` — but if a future caller passes non-empty headers, the old `{[key]: value}[]` shape and new `{header, value}[]` shape are incompatible and the shim does not translate them. |

## Outstanding work

1. Re-verify native Android/iOS completeness in the sibling repo (last audited state said
   phases 3–7 were stubs; recent commits there (`f46eccb` and later) suggest iOS work has
   since landed — not re-audited in depth this session beyond confirming `npm run build`
   succeeds).
2. Device/emulator verification of an actual download end-to-end on the Capacitor platform
   (not done — no device/emulator available in this session).
3. Before Phase 8 (Cordova removal): switch the `file:` dependency to a published/git
   reference once the sibling repo is pushed to `origin` (it currently has uncommitted/
   unpushed changes).
4. Properly resolve the pre-existing `@capacitor/core@5.7.8` vs `@capacitor-community/sqlite`
   peer conflict (bump the devDependency) instead of relying on `--legacy-peer-deps` on every
   install — tracked here since Phase 6 validation surfaced it, but it originates from
   Phase 3 and isn't Phase 6 scope to fix.

## Validation status

- `npm run build` in `../Sphere-capacitor-downloadmanager`: **passed** (dist/ generated).
- `npm install --legacy-peer-deps` in this repo: **passed** (pre-existing, unrelated peer
  conflict bypassed with user approval).
- `npm run build:dev` (`tsc -w`) in this repo: **passed — 0 errors** after fixing the
  `headers` type mismatch caught by the compiler.
- Jest unit tests: not run this session (not part of CLAUDE.md's stated validation
  commands for this phase; existing `download-service-impl.spec.ts` covers the Cordova
  path only — no spec file was added for `DownloadServiceCapacitorImpl` yet).

---

READY FOR PHASE 6 APPROVAL
