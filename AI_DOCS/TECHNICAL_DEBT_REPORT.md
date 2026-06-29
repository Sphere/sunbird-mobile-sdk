# Sunbird Mobile SDK — Technical Debt Report

> Generated: 2026-06-16  
> Branch: `feature/SPRINT-54`  
> Read together with [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) and [MODULE_DEPENDENCY_MAP.md](./MODULE_DEPENDENCY_MAP.md).

Debt items are grouped by severity: **Critical** (blocks Capacitor migration or causes runtime risk), **High** (significant maintainability burden), **Medium** (growing complexity), **Low** (polish/hygiene).

---

## Critical — Blocks Capacitor Migration

### C-1 · No Capacitor platform in SdkConfig

**File:** [src/sdk.ts](../src/sdk.ts) — `sdkConfig.platform` switch  
**Impact:** The SDK has no concept of a Capacitor runtime. All Cordova services bind unconditionally regardless of the platform flag.

```ts
// sdk.ts — only two branches:
switch (sdkConfig.platform) {
  case 'cordova': ...SharedPreferencesAndroid...
  case 'web':     ...SharedPreferencesLocalStorage...
  // 'capacitor' is not handled
}
```

All other services (`DbCordovaService`, `FileServiceImpl`, `DownloadServiceImpl`) are bound before this switch and are never swapped out.

**Fix:** Add `'capacitor'` to the `SdkConfig.platform` union type and create a second binding branch that substitutes Capacitor-backed implementations.

---

### C-2 · `InAppBrowser` used in four locations with no abstraction

**Files:**
- [src/auth/util/webview-session-provider/impl/webview-runner-impl.ts](../src/auth/util/webview-session-provider/impl/webview-runner-impl.ts) — all OAuth/SAML flows
- [src/profile/impl/profile-service-impl.ts](../src/profile/impl/profile-service-impl.ts) — profile OAuth
- [src/course/impl/course-service-impl.ts](../src/course/impl/course-service-impl.ts) — certificate view

`cordova.InAppBrowser.open()` is called directly. No `BrowserService` interface exists to swap in `@capacitor/browser`.

**Fix:** Extract a `BrowserService` interface with `open(url, target, opts)` / `close()` / `on(event)`. Bind the Cordova impl today, Capacitor impl when migrating.

---

### C-3 · `cordova-plugin-file` paths scattered across 15+ files

**Examples:**
- [src/util/file/impl/file-service-impl.ts](../src/util/file/impl/file-service-impl.ts) — `file.requestFileSystem()`, `resolveLocalFileSystemURL()`
- [src/content/handlers/export/copy-to-destination.ts](../src/content/handlers/export/copy-to-destination.ts) — `cordova.file.documentsDirectory / externalDataDirectory`
- [src/course/impl/course-service-impl.ts](../src/course/impl/course-service-impl.ts) — `cordova.file.externalRootDirectory`
- [src/util/download/impl/download-service-impl.ts](../src/util/download/impl/download-service-impl.ts) — `cordova.file.externalDataDirectory`

No `FilePathResolver` or path abstraction exists. Every call site hardcodes `cordova.file.*` constants. Replacing with `@capacitor/filesystem` `Directory` enum requires touching every consumer.

**Fix:** Introduce a `FilePathProvider` injectable that returns platform-appropriate base directories. Consumers get paths through DI, not via `cordova.file.*` literals.

---

### C-4 · Android-only `DownloadService`

**File:** [src/util/download/impl/download-service-impl.ts](../src/util/download/impl/download-service-impl.ts) (465 lines)

```ts
import * as downloadManagerInstance from 'cordova-plugin-android-downloadmanager';
```

Direct import with no iOS path. No fallback, no abstract `DownloadService` backed by a different implementation for iOS or Capacitor.

**Fix:** Move Android download manager usage behind a `NativeDownloadAdapter` and create a fallback that uses XHR/fetch with progress events for iOS/Capacitor.

---

### C-5 · Six custom Cordova-only native plugins

| Plugin | Purpose | Capacitor alternative |
|---|---|---|
| `sb-cordova-plugin-db` | SQLite | `@capacitor-community/sqlite` or custom plugin |
| `cordova-plugin-awesome-shared-preferences` | Secure key-value | `@capacitor/preferences` |
| `sb-cordova-plugin-utility` | Platform utilities | Custom Capacitor plugin |
| `sb-cordova-plugin-customtabs` | Android custom tabs | `@capacitor/browser` |
| `jjdltc-cordova-plugin-zip` | Zip operations | `@capacitor-community/zip` or custom |
| `cordova-plugin-android-downloadmanager` | Download tracking | Custom Capacitor plugin |

None of these have drop-in Capacitor equivalents. Custom Capacitor plugins will need to be written for `sb-cordova-plugin-db`, `sb-cordova-plugin-utility`, and the download manager.

---

### C-6 · Direct `window.device` access in 8+ files

**Examples:**
- [src/util/device/impl/device-info-impl.ts](../src/util/device/impl/device-info-impl.ts) — `window.device.platform`, `window.device.uuid`
- [src/util/file/util/path.ts](../src/util/file/util/path.ts) — platform detection for asset paths

`DeviceInfo` service exists but some consumers call `window.device` directly, bypassing the service.

**Fix:** All `window.device.*` access must go through `DeviceInfo`; then swap `DeviceInfoImpl` to use `@capacitor/device`.

---

## High — Maintainability Risk

### H-1 · `DbService` has no platform abstraction

**File:** [src/sdk.ts:281](../src/sdk.ts#L281)

`DbCordovaService` is always bound regardless of `sdkConfig.platform`. The `DbService` interface exists, but there is no `DbWebService` or `DbCapacitorService` alternative. All 14 dependent modules would break if `sb-cordova-plugin-db` is absent.

**Fix:** Bind `DbService` inside the platform switch, same as `SharedPreferences`.

---

### H-2 · `tslint` is deprecated; no ESLint migration

**File:** [tslint.json](../tslint.json), `devDependencies`

TSLint was officially deprecated in 2019. The project has 140 linting rules configured in TSLint that have no equivalent run in ESLint. CI passes today only because no one has removed the TSLint step, but any attempt to add a new linter or IDE integration will not pick up these rules.

**Fix:** Run `tslint-to-eslint-config` to auto-migrate, then remove `tslint` and `tsickle` from dev dependencies.

---

### H-3 · Build toolchain is 3–5 years out of date

| Tool | Current | Latest |
|---|---|---|
| Node.js (CircleCI) | 14.17.3 (EOL) | 22 LTS |
| Jest | 25.5.4 (2020) | 29+ |
| ts-jest | 25.5.1 (2020) | 29+ |
| Webpack | 4.47.0 (2021) | 5+ |
| ts-loader | 8.4.0 | 9+ |
| TypeScript | 4.3.5 (2021) | 5.4+ |
| `@types/node` | 12.0.2 | 20+ |

Node 14 is end-of-life. Jest 25 and ts-jest 25 will not work with TypeScript 5. Webpack 4 is incompatible with many modern plugins.

**Fix:** Upgrade Node to 22 LTS, Jest to 29, ts-jest to 29, Webpack to 5. Upgrade TypeScript incrementally (4.3 → 4.9 → 5.x) to surface type errors before they reach production.

---

### H-4 · `group-deprecated` module still active in container

**File:** [src/group-deprecated/](../src/group-deprecated/) (5 files), [src/sdk.ts](../src/sdk.ts)

The deprecated group module is still bound in the Inversify container and actively consumed by:
- `TelemetryServiceImpl` (session group tracking)
- `PlayerServiceImpl` (group context)
- Database migrations
- Profile import/export handlers

It maintains its own `GroupEntry` and `GroupProfileEntry` tables. It cannot be removed until the consumers migrate to `GroupService` (new) and the DB tables are migrated.

**Risk:** Any bug fix or change in GroupService (deprecated) is invisible — it's not in test coverage exclusions are set.

**Fix:** Map out the 5 specific call sites, migrate them to `GroupService` (new), add a DB migration to consolidate tables, then remove the module.

---

### H-5 · 25+ TODO/FIXME comments in production code

Selected high-risk occurrences:

| File | Comment |
|---|---|
| [src/debugging/impl/debuggin-service-impl.ts](../src/debugging/impl/debuggin-service-impl.ts) | Skeleton — DebuggingService not implemented |
| [src/archive/impl/archive-service-impl.ts](../src/archive/impl/archive-service-impl.ts) | 8 TODO comments — incomplete operations |
| [src/content/impl/content-service-impl.ts](../src/content/impl/content-service-impl.ts) | 4 TODO — file operations should move to FileService |
| [src/db/impl/db-web-sql-service.ts](../src/db/impl/db-web-sql-service.ts) | 2 TODO — code commented out, dead file |
| [src/telemetry/impl/decorator-impl.ts](../src/telemetry/impl/decorator-impl.ts) | "Add tag patching logic" |
| [src/course/handlers/get-enrolled-course-handler.ts](../src/course/handlers/get-enrolled-course-handler.ts) | Incomplete handler logic |

---

### H-6 · Coverage excludes the riskiest code

**File:** `package.json` jest `collectCoverageFrom` exclusions:

```
src/util/file/impl      ← FileService (608 lines, Cordova calls)
src/codepush-experiment
src/util/shared-preferences/impl/shared-preferences-local-storage
src/group-deprecated    ← deprecated but still used
```

FileService (the hardest module to migrate) has zero test coverage. It is excluded because it calls Cordova APIs that are hard to mock — but this is precisely what should be covered with integration tests.

---

## Medium — Growing Complexity

### M-1 · Oversized service classes

| File | Lines | Problem |
|---|---|---|
| [src/content/impl/content-service-impl.ts](../src/content/impl/content-service-impl.ts) | 970 | Search, import, delete, markers, space summary, child content — all in one class |
| [src/profile/impl/profile-service-impl.ts](../src/profile/impl/profile-service-impl.ts) | 808 | Profile CRUD, OTP, T&C, migration, export/import, merge — all in one class |
| [src/content/handlers/content-aggregator.ts](../src/content/handlers/content-aggregator.ts) | 851 | Aggregation logic mixed with formatting |

The handler pattern exists and is used for some operations; it was not applied consistently to all methods in these large classes.

---

### M-2 · DB migration list manually maintained in `sdk.ts`

**File:** [src/sdk.ts:283–302](../src/sdk.ts#L283-L302)

```ts
// Migrations are listed inline:
new ProfileSyllabusMigration(this._container),
new AddPrimaryKeyMigration(this._container),
// ... 11 more
```

The DB version (31) is also hardcoded at line 281. Adding a migration requires editing `sdk.ts` directly, and there is no validation that the version number matches the migration count.

**Fix:** Build a `MigrationRegistry` that auto-discovers migrations via a naming convention, and derive the DB version from the registry length.

---

### M-3 · Magic strings and scattered constant definitions

**Examples:**
- URL path segments (`/api/questionset/v2`, `/api/question/v2`, `/api/course/v1`) defined inline in handler files
- `DOWNLOAD_DIR_NAME = 'Download'` in [src/util/download/impl/download-service-impl.ts](../src/util/download/impl/download-service-impl.ts)
- Preference keys defined in local enums (`DownloadKeys`, `ApiKeys`, `PreferenceKeys`) across multiple files with no single source of truth

---

### M-4 · `cordova.exec()` called directly from SDK code

**File:** [src/util/file/impl/file-service-impl.ts](../src/util/file/impl/file-service-impl.ts)

```ts
cordova.exec(resolve, reject, 'File', 'getFreeDiskSpace', []);
```

Direct `cordova.exec()` calls bypass any abstraction layer and are impossible to unit-test or swap for Capacitor equivalents. The rest of the file already uses `cordova-plugin-file` types — the inconsistency suggests this was added as a quick fix.

---

### M-5 · Large test fixture files

| File | Lines |
|---|---|
| [src/db/migrations/content-dialcode-migration.spec.data.ts](../src/db/migrations/content-dialcode-migration.spec.data.ts) | 1,946 |
| [src/page/handle/page-assembler-factory.spec.data.ts](../src/page/handle/page-assembler-factory.spec.data.ts) | 1,487 |
| Several other `.spec.data.ts` files | 500–1,200 |

These are TypeScript fixture files checked into source. They make `git diff` noisy and inflate the TS compilation cost. Consider moving to JSON fixtures loaded dynamically.

---

## Low — Hygiene

### L-1 · `crypto-js` 3.1.9-1 is an old pinned version

`crypto-js` 3.x has known issues flagged in several security advisories. Version 4.x is available with better AES defaults. This package is pinned (not a range), so it will never auto-update.

---

### L-2 · `node-fetch` 2.6.7 — legacy v2 branch

`node-fetch` v2 reached end-of-active-maintenance. v3 is available (ESM-only, but compatible with the project's module setup).

---

### L-3 · `tsickle` is an unused dev dependency

`tsickle` is a Closure Compiler annotation tool from Google's Angular toolchain. The project uses Webpack/ts-loader, not Closure Compiler. This package adds ~MB to `node_modules` with no benefit.

---

### L-4 · `/plugins/*.d.ts` duplicates DefinitelyTyped

[plugins/](../plugins/) contains 15 hand-maintained Cordova plugin type files (FileSystem, InAppBrowser, etc.). These duplicate or conflict with `@types/cordova` and similar DefinitelyTyped packages, creating type-definition drift risk.

---

### L-5 · `strictPropertyInitialization: false` in tsconfig

**File:** [tsconfig.json](../tsconfig.json)

This turns off a key strict-mode check, allowing class fields to be declared without initialization and without being `| undefined`. Combined with `strict: true`, this is an inconsistency that hides potential runtime null-dereference bugs.

---

### L-6 · Dead file: `db-web-sql-service.ts`

**File:** [src/db/impl/db-web-sql-service.ts](../src/db/impl/db-web-sql-service.ts)

This file exists but is never imported, has code commented out, and has 2 TODO comments indicating it was abandoned mid-implementation. It compiles and confuses readers about whether WebSQL is a supported path.

**Fix:** Delete the file; document that the web platform currently has no persistent database.

---

## Recommended Remediation Order

### Phase 1 — Safety net (before any Capacitor work)

1. **H-3** — Upgrade Node to 22 LTS, Jest to 29, Webpack to 5
2. **H-2** — Migrate TSLint → ESLint
3. **H-6** — Add FileService test coverage (integration tests with mocked Cordova APIs)
4. **L-6** — Delete `db-web-sql-service.ts`
5. **L-3** — Remove `tsickle`

### Phase 2 — Structural cleanup (reduces Capacitor migration surface)

6. **C-3** — Introduce `FilePathProvider` injectable
7. **C-2** — Introduce `BrowserService` interface, wrap InAppBrowser
8. **C-6** — Route all `window.device.*` through `DeviceInfo` service
9. **H-4** — Migrate and remove `group-deprecated`
10. **H-1** — Make `DbService` binding platform-conditional

### Phase 3 — Capacitor migration

11. **C-1** — Add `'capacitor'` platform to `SdkConfig`, create Capacitor binding branch
12. **C-5** — Write/port custom Capacitor plugins for `sb-cordova-plugin-db`, utility, zip
13. **C-4** — Build cross-platform `DownloadService` with iOS/Capacitor path
14. Migrate `SharedPreferences` to `@capacitor/preferences`
15. Migrate `FileService` to `@capacitor/filesystem`

### Phase 4 — Code quality

16. **M-1** — Split `ContentServiceImpl` and `ProfileServiceImpl` into handler-delegated services
17. **M-2** — Build `MigrationRegistry`
18. **M-3** — Centralize URL constants and preference keys
19. **H-5** — Resolve all TODO/FIXME comments or convert to tracked issues
20. **L-1/L-2** — Upgrade `crypto-js` to 4.x, `node-fetch` to 3.x

---

## Debt Summary Table

| ID | Category | Severity | Effort | Migration blocker? |
|---|---|---|:---:|:---:|
| C-1 | No Capacitor platform | Critical | High | Yes |
| C-2 | InAppBrowser tight coupling | Critical | Medium | Yes |
| C-3 | File path constants scattered | Critical | High | Yes |
| C-4 | Android-only DownloadService | Critical | High | Yes |
| C-5 | 6 Cordova-only native plugins | Critical | Very High | Yes |
| C-6 | Direct `window.device` calls | Critical | Low | Yes |
| H-1 | DbService not platform-conditional | High | Medium | Yes |
| H-2 | TSLint deprecated | High | Medium | No |
| H-3 | Build toolchain outdated | High | Medium | No |
| H-4 | group-deprecated still active | High | Medium | No |
| H-5 | 25+ TODO/FIXME in prod | High | Low-Med | No |
| H-6 | FileService has no coverage | High | Medium | No |
| M-1 | Oversized service classes | Medium | High | No |
| M-2 | DB migrations in sdk.ts | Medium | Low | No |
| M-3 | Magic strings / scattered constants | Medium | Medium | No |
| M-4 | `cordova.exec()` called directly | Medium | Low | Yes |
| M-5 | Large fixture files | Medium | Low | No |
| L-1 | crypto-js pinned old version | Low | Low | No |
| L-2 | node-fetch v2 | Low | Low | No |
| L-3 | Unused tsickle dependency | Low | Trivial | No |
| L-4 | Duplicate plugin .d.ts files | Low | Low | No |
| L-5 | `strictPropertyInitialization: false` | Low | Medium | No |
| L-6 | Dead db-web-sql-service.ts | Low | Trivial | No |
