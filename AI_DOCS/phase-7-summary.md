# Phase 7 Summary — sbutility (sb-cordova-plugin-utility) Capacitor bypass

## Status: Implemented and validated (2026-07-07); one post-implementation bug found via
## real device testing and fixed (2026-07-08) — see "Post-implementation fix" below

## Changes completed

No new native plugin was written. `sb-cordova-plugin-utility` stays in `package.json`
untouched — still required for `platform: 'cordova'`. Every call site got a
`getSdkPlatform() === 'capacitor'` branch that uses either an existing Capacitor plugin
(`@capacitor/filesystem`, already a dependency since `FileServiceImpl`) or pure TypeScript,
falling through to the original untouched `sbutility.X(...)` call otherwise.

| File | Change |
|---|---|
| `src/util/jwt-util.ts` | Full rewrite to pure TS + `crypto-js` (HMAC-SHA256 + Base64url), **unconditional** on all platforms — not gated, since it's a pure algorithm with no native dependency |
| `src/storage/handler/transfer/validate-destination-folder.ts` | `canWrite` → capacitor branch reuses injected `FileService.createDir` as a writability probe |
| `src/storage/handler/transfer/device-memory-check.ts` | `getFreeUsableSpace` → capacitor branch uses `FileService.getFreeDiskSpace()`; added `FileService` constructor param |
| `src/storage/handler/transfer/copy-content-from-source-to-destination.ts` | `rm`/`copyDirectory`/`renameDirectory` → capacitor branches; added `FileService` constructor param |
| `src/storage/handler/transfer/delete-source-folder.ts` | Same three methods; added `FileService` constructor param |
| `src/storage/handler/transfer-content-handler.ts` | Updated 3 construction sites to pass `this.fileService` to the classes above |
| `src/content/impl/content-service-impl.ts` | `copyFile`/`rm` → capacitor branches (reuses already-injected `FileService`); updated `CopyAsset`/`CopyToDestination` construction sites |
| `src/content/handlers/delete-content-handler.ts` | `rm`/`getMetaData` → capacitor branches |
| `src/content/handlers/export/copy-to-destination.ts` | `copyFile` → capacitor branch; added optional `FileService` constructor param |
| `src/content/handlers/export/copy-asset.ts` | Same |
| `src/content/handlers/import/create-content-import-manifest.ts` | `writeFile` (batch) → capacitor branch |
| `src/content/handlers/import/update-size-on-device.ts` | `getMetaData` (batch) → capacitor branch |
| `src/content/handlers/import/extract-payloads.ts` | `createDirectories` → capacitor branch |
| `src/archive/impl/archive-service-impl.ts` | `extractZipArchive`'s `copyFile` → capacitor branch |
| `src/telemetry/impl/telemetry-service-impl.ts` | `getUtmInfo` → capacitor branch resolves `[]` (known gap, see Risks) |
| `src/util/file/impl/file-service-impl.ts` | `readFileFromAssets` → capacitor branch via `fetch()` (best-effort, see Risks) |
| 5 `.spec.ts` files | Updated to pass the new `FileService` constructor args; `jwt-util.spec.ts` rewritten to test real decode/sign behavior instead of mocking `sbutility` |

## Notable findings during implementation

- **`delete-content-handler.ts`'s `rm(dir, skipList)` skip-list is inert in production.**
  Pulled the actual native source (`FileUtil.rm`): it does
  `skippDirectory.equals(child.getName())` with no split on `:`, but the only caller in this
  repo always passes a colon-joined pair (`[appIcon, itemSetPreviewUrl].join(':')`). That
  joined string can never equal a single child filename, so this has always behaved as a
  plain recursive delete in practice. The capacitor branch replicates *actual* behavior
  (`FileService.removeRecursively`), not the apparently-intended-but-unreachable skip logic.
- **`renameDirectory(sourceDirectory, toDirectoryName)` does not rename `sourceDirectory`.**
  Native `FileUtil.renameTo` does `rename(sourceDirectory/toDirectoryName,
  sourceDirectory/toDirectoryName_temp)` — renames a *child*, adding a `_temp` suffix. Verified
  against the native source before implementing; matches the later `removeSourceAndDestination`
  cleanup call exactly. Implemented faithfully in
  `copy-content-from-source-to-destination.ts` and `delete-source-folder.ts` using
  `@capacitor/filesystem`'s `Filesystem.rename`.
- **`readFileFromAssets` path translation** — pulled native `UtilityPlugin.readFromAssets`:
  it strips only `file:///android_asset/` and opens the remainder (e.g. `www/assets/...`) via
  Android's `AssetManager`, which reads from the APK's `assets/` folder (Cordova's build
  places web content at `assets/www/`). Capacitor instead copies `webDir`'s *contents* (not
  the folder itself — confirmed `sphere-mobile/capacitor.config.ts` has `webDir: "www"`) into
  `assets/public/` and serves that as the web root, so a source file at `www/assets/foo.json`
  is reachable at the relative URL `assets/foo.json`. The capacitor branch strips both the
  `file:///android_asset/` and `www/` prefixes and does a plain `fetch()`.
- **`import * as HmacSHA256 from 'crypto-js/hmac-sha256'` broke at runtime** — caught by the
  Jest run, not `tsc` (spec files aren't part of the main `tsconfig.json` compile). TypeScript's
  `__importStar` CommonJS-interop helper copies a source module's *enumerable properties* into
  a new object; for a module whose `module.exports` is a bare function (no extra enumerable
  props), this produces an empty object instead of the callable function. Fixed by switching to
  default imports (`import HmacSHA256 from '...'`) for `HmacSHA256`, `Utf8`, and `Base64url`.
  Note: `src/util/platform/platform-util.ts` has the identical `import * as SHA1 from
  'crypto-js/sha1'` pattern, calling `SHA1(...)` as a function — same latent bug, currently
  untested by any spec that exercises that code path. Not fixed here (out of Phase 7 scope,
  unrelated file), but flagged as a related risk.
- **`jwt-util.spec.ts`'s old `obj` fixture was already wrong** — missing the `iss` claim
  present in the real token used in the same test. The *old* test never actually decoded the
  real token (it mocked `sbutility.decodeJWTToken` to return `obj` directly, bypassing real
  parsing entirely), so the inaccuracy was invisible. Now that decoding is real, fixed the
  fixture to match the token's actual payload.

## Post-implementation fix (2026-07-08) — real device testing surfaced a scheme bug

User reported two symptoms while testing course download on the actual Capacitor app:
1. Console error: `'mkdir' failed with: An unknown error occurred` (from Capacitor's native
   Android bridge).
2. `contentService.getContents` returned nothing after the download appeared to finish.

**Root cause:** `@capacitor/filesystem`'s own README states: *"Simply leave out the
`directory` param to use a full file path"* — and its example explicitly uses a
`file:///...` URI. Every `FileService`/`Filesystem` call added in this phase omits the
`directory` option (matching how `FileServiceImpl` already worked), so `path` **must** be a
full `file://` URI. But `ContentUtil.getBasePath()` — used throughout the content-import
pipeline, including to build the DB's `COLUMN_NAME_PATH` values — *strips* the `file://`
scheme (it exists for the old Cordova native plugins, which take bare Java `File` paths, not
URIs). Several Phase 7 capacitor branches fed one of these stripped/bare paths straight into
`Filesystem` calls, causing native `mkdir`/`rename`/etc. to fail with a generic wrapped
exception. The `mkdir` failure aborted the import pipeline mid-flight, which is why the
content never finished registering in the DB — explaining symptom 2 as a direct consequence
of symptom 1, not a separate bug.

Confirmed by comparing against a sibling line in `extract-payloads.ts` (not touched by this
phase) that creates a directory the same way but *doesn't* strip the scheme — it uses the
`file://`-intact path directly.

**Fix:** added `Path.ensureFileUri(path)` (`src/util/file/util/path.ts`) — idempotent, adds
`file://` only if missing — and applied it at every Phase 7 call site that could receive a
stripped path before it reaches `FileService`/`Filesystem`:
- `extract-payloads.ts`'s `createDirectories` (stopped stripping the scheme in the first
  place, matching the sibling `createDir()` call a few lines down)
- `create-content-import-manifest.ts`'s `writeFile`
- `update-size-on-device.ts`'s `getMetaData`
- `delete-content-handler.ts`'s `rm` and `getMetaData`
- `copy-content-from-source-to-destination.ts` and `delete-source-folder.ts`'s
  `deleteFolder`/`copyFolder`/`renameFolder`
- `validate-destination-folder.ts`'s `validate()` — normalizes once so both the new
  `canWrite()` branch *and* the pre-existing (not part of Phase 7) `createDirectory()` call
  right after it in the same chain get a consistent, correctly-schemed path. `createDirectory()`
  was calling `FileService.exists`/`createDir` with the same potentially-bare path before this
  fix too — a latent pre-existing bug this incidentally also resolves, since both methods
  share the same variable through the promise chain.

**Second occurrence, found on the very next retest (2026-07-08), entirely pre-existing (not
introduced by Phase 7 at all):** `FileServiceImpl.getTempLocation()` — called from
`content-service-impl.ts`'s `importEcar`/export flows with `destinationFolder`, which
ultimately traces back to a value **supplied by the host app** (`sphere-mobile`'s call to
`importContent()`/`contentImport.destinationFolder`), not something the SDK derives
internally. This method has always called `Filesystem.stat`/`mkdir` without a `directory`
option — it just never got exercised on a working Capacitor build until Phase 6+7 unblocked
everything upstream of it. Since the caller's scheme convention can't be controlled from here,
fixed defensively at the choke point itself: `Path.ensureFileUri(destinationPath)` at the top
of `getTempLocation()`, rather than chasing every possible caller.

**Takeaway:** this scheme bug isn't unique to Phase 7's new code — it's a pre-existing
sharp edge in `FileServiceImpl` (and anywhere else absolute paths flow without a `directory`
option) that's only now surfacing because the app can finally run far enough on Capacitor to
reach these code paths for the first time. If more "'X' failed with: An unknown error
occurred" native bridge errors show up during further testing, check whether the failing
`FileService`/`Filesystem` call received a `file://`-prefixed path first before assuming a
new root cause.

**Not yet checked for the same issue** (lower confidence / different, unconfirmed path
sources — see Risks): `archive-service-impl.ts`'s `extractZipArchive` (`importRequest.filePath`
— origin depends on how the host app supplies the archive file path, not traced) and
`content-service-impl.ts`'s transcript `copyFile`/`deleteFolder` (inputs there come from
`FilePathService.getFilePath()` and the download manager's `localUri`, both of which already
looked `file://`-prefixed on inspection — lower risk, not empirically confirmed).

Re-validated after this fix: `npx tsc --noEmit` clean (0 errors), all directly-affected specs
re-run and pass (only the same pre-existing `validate-destination-folder.spec.ts` test-order
failure, unrelated, present before Phase 7 too).

## Risks / known gaps

| Risk | Notes |
|---|---|
| `getUtmInfo` returns `[]` on capacitor | No Capacitor equivalent of the Play Store install-referrer API exists. Analytics-only, non-blocking — matches the existing precedent in `CapacitorDeviceInfoImpl` (stubs memory/storage info to 0/empty for the same reason). Permanent gap until/unless a Capacitor install-referrer plugin is built. |
| `readFileFromAssets` capacitor path is best-effort | Reasoned through from both the native Cordova source and `sphere-mobile`'s actual `capacitor.config.ts`, but **not verified on a device/emulator**. If wrong, everything that calls `FileService.readFileFromAssets` (form configs, framework/channel details, FAQ, search-location fallback) would fail to load bundled fallback JSON on the capacitor platform. |
| `src/util/platform/platform-util.ts`'s `SHA1` import | Same `import * as X` CommonJS-interop bug as the one fixed in `jwt-util.ts`, in a file Phase 7 didn't otherwise touch. Not fixed (out of scope), but worth a follow-up check — if any spec exercised `initPlatformUtil`'s device-ID hashing path, it would likely fail the same way `HmacSHA256` did here. |
| Test suite has pre-existing, unrelated failures | Confirmed via `git stash` (ran the exact same specs against unmodified code, got identical failure counts) that the following are **not** caused by Phase 7: `delete-content-handler.spec.ts`, `copy-to-destination.spec.ts`, `extract-payloads.spec.ts`, `telemetry-service-impl.spec.ts`, `content-service-impl.spec.ts` (5/49 IndexedDB-related), `archive-service-impl.spec.ts` (8/10), `validate-destination-folder.spec.ts` (1/3, a shared-mutable-mock test-order bug). Root cause looks like this repo's `jest@25`/`ts-jest@25` predating Node 24 (`UnhandledPromiseRejection` crashes, "This browser doesn't support IndexedDB", worker "Call retries were exceeded"). Not addressed — pre-existing and unrelated to sbutility. |

## Validation status

- `npx tsc --noEmit -p tsconfig.json`: **0 errors**.
- `npm run build:dev` (`tsc -w`): **0 errors**.
- Directly affected specs — all genuinely pass: `jwt-util.spec.ts` (4/4, rewritten),
  `device-memory-check.spec.ts` ×2 (transfer + export variants), `delete-source-folder.spec.ts`,
  `copy-content-from-source-to-destination.spec.ts`, `copy-asset.spec.ts`,
  `create-content-import-manifest.spec.ts`, `update-size-on-devices.spec.ts`.
- `validate-destination-folder.spec.ts`: 2/3 pass; the 1 failure is a pre-existing test-file
  bug (shared mutable mock object across two same-named `it()` blocks, order-dependent),
  confirmed present on unmodified code — untouched by this phase's `canWrite` change.
- Specs with pre-existing, unrelated crashes (confirmed via `git stash` comparison against
  unmodified code, identical failure counts both before and after): `delete-content-handler.spec.ts`,
  `copy-to-destination.spec.ts`, `extract-payloads.spec.ts`, `telemetry-service-impl.spec.ts`,
  `content-service-impl.spec.ts`, `archive-service-impl.spec.ts`.

## Outstanding work

1. Device/emulator verification of `readFileFromAssets` on the actual Capacitor build — the
   riskiest item in this phase, reasoned through but unverified end-to-end.
2. Consider fixing the same `import * as X` → default-import bug in `platform-util.ts`'s
   `SHA1` usage (separate, pre-existing, out of this phase's scope).
3. This repo's Jest/Node version mismatch (causing the pre-existing failures above) is worth
   its own cleanup pass at some point, independent of the Capacitor migration.
4. Per the original Phase 8 request: once this and Phase 6 are both considered acceptable,
   the consuming app (`sphere-mobile`) can flip `platform: 'cordova'` → `platform: 'capacitor'`
   in `src/app/app.module.ts`.

---

READY FOR PHASE 7 APPROVAL
