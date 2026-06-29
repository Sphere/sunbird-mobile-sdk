# Sunbird Mobile SDK — Architecture Overview

**Package:** `@aastrika_npmjs/sunbird-sdk` v6.1.1  
**Type:** Mobile SDK library (UMD bundle, consumed by Ionic/Cordova/Capacitor host apps)  
**Language:** TypeScript 4.3.5, compiled to ES6/UMD via Webpack 4  
**Entry point:** [src/index.ts](../src/index.ts)  
**Main SDK class:** [src/sdk.ts](../src/sdk.ts) (552 lines)

---

## Layered Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              SunbirdSdk  (Singleton Entry Point)             │
│  sdk.ts — initializes DI container, orchestrates lifecycle   │
└──────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌─────────────────────┐
│  Domain Services │ │  Infra Layer │ │  Utilities           │
│  (32 modules)    │ │              │ │                      │
│  Content         │ │  ApiService  │ │  FileService         │
│  Profile         │ │  DbService   │ │  SharedPreferences   │
│  Course          │ │  AuthService │ │  DownloadService     │
│  Framework       │ │  Telemetry   │ │  DeviceInfo          │
│  Form, Page …    │ │  EventsBus   │ │  ZipService          │
└──────────────────┘ └──────────────┘ └─────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌─────────────────────┐
│  client-services │ │ Cordova      │ │  RxJS / Inversify   │
│  (HTTP + CsXxx)  │ │ Plugins (9)  │ │  crypto-js, dayjs   │
└──────────────────┘ └──────────────┘ └─────────────────────┘
```

---

## SDK Singleton & Dependency Injection

`SunbirdSdk` is a **strict singleton** (static `instance` property) that owns an **Inversify DI container**.

**Lifecycle on `init(sdkConfig)`:**

1. Bind all services to the container (405+ bindings in [sdk.ts](../src/sdk.ts))
2. Initialize `CsModule` from `@project-sunbird/client-services`
3. `preInit()` — `dbService.init()`, `appInfo.init()`, telemetry/framework/profile pre-init
4. `postInit()` — combine via `combineLatest`: apiService, authService, summarizerService, errorLogger, eventsBus, downloadService, contentService, storageService, telemetryService, notificationService

**Platform switch** (only governs `SharedPreferences`):

| `sdkConfig.platform` | SharedPreferences implementation |
|---|---|
| `'cordova'` | `SharedPreferencesAndroid` (native plugin) |
| `'web'` | `SharedPreferencesLocalStorage` (localStorage) |
| _(capacitor — not yet)_ | _(not implemented)_ |

All other services unconditionally use Cordova implementations.

---

## Module Organization Pattern

Every module follows the same internal layout:

```
src/<module>/
├── def/          interfaces & contracts (public API types)
├── impl/         concrete implementations
├── db/           SQLite schema definitions
├── handlers/     request/event handler classes
├── config/       config interfaces
├── errors/       custom Error subclasses
├── util/         internal utilities
└── index.ts      barrel re-export
```

---

## Core Infrastructure

### ApiService — [src/api/](../src/api/)
Wraps `@project-sunbird/client-services` `CsModule`.  
- Bearer token + user-token refresh interceptors  
- Network queue for offline request buffering  
- Debug mode with request/response logging  
- HTTP adapter selected by client-services (Cordova vs browser)

### DbService — [src/db/](../src/db/)
Wraps `sb-cordova-plugin-db` (native SQLite).  
- Raw SQL via `QueryBuilder`  
- Schema version **31**; 13 sequential migrations wired in [sdk.ts:283–302](../src/sdk.ts#L283-L302)  
- Exports: `DbService` interface, `Migration`, `MigrationFactory`, query types

### EventsBusService — [src/events-bus/](../src/events-bus/)
RxJS `Subject`-based pub/sub. Provides `EventNamespace` enum.  
Used for cross-module events: download progress, content deletion, telemetry flush.

### AuthService — [src/auth/](../src/auth/)
OAuth/SAML flows via:
- `WebviewLoginSessionProvider` / `WebviewAutoMergeSessionProvider` / `WebviewManualMergeSessionProvider` — Cordova `InAppBrowser`
- `NativeGoogleSessionProvider`, `NativeAppleSessionProvider`, `NativeKeycloakSessionProvider`

---

## Domain Services (32 modules)

| Module | Key responsibility | Notable dependency |
|---|---|---|
| **ContentService** | Search, download/import ECAR, delete, markers | FileService, DownloadService, DbService |
| **ProfileService** | Local + server profile CRUD, OTP, T&C, migration | AuthService, ApiService, DbService |
| **CourseService** | Enrolled courses, batch enrollment, progress, certificates | ContentService, ProfileService |
| **FrameworkService** | Framework definitions, cache | ApiService, DbService |
| **FormService** | Dynamic form config from API | ApiService |
| **TelemetryService** | Auto-sync, batch upload, decorating other services | DbService, SharedPreferences, EventsBusService |
| **AuthService** | OAuth/SAML, token management | ApiService, InAppBrowser |
| **NotificationService v1/v2** | Notification storage & CsNotificationService integration | ApiService, DbService |
| **StorageService** | Transfer content between storage paths | FileService, ContentService |
| **ArchiveService** | Export/import ECAR bundles | FileService, ContentService |
| **GroupService** | New group management via CsGroupService | ApiService |
| **GroupService (deprecated)** | Legacy — still bound, used by Telemetry & Player | DbService |
| **DiscussionService** | Wraps CsDiscussionService | ApiService |
| **SegmentationService** | User segmentation / feature flags | ApiService |
| **CertificateService** | Certificate generation & public-key management | DbService |
| **SummarizerService** | Auto-generate telemetry summaries | DbService, TelemetryService |
| **PageService** | Dynamic page-layout assembly | ApiService |
| **PlayerService** | Playback state tracking, config storage | SharedPreferences, GroupService (deprecated) |
| **SystemSettingsService** | Global system config, server sync | ApiService, DbService |
| **KeyValueStoreService** | Abstraction over SharedPreferences with caching | SharedPreferences |
| **ErrorLoggingService** | Centralized error tracking, batch upload | DbService, ApiService |
| **DeviceRegisterService** | Device + FCM push-token registration | ApiService, SharedPreferences |
| **FAQService** | FAQ content from API | ApiService |
| **CodePushExperiment** | A/B testing | ApiService |
| **SearchHistoryService** | Stores user search queries | DbService |
| **DebuggingService** | Developer debug features (skeleton/TODO) | — |

---

## Utility Layer

| Utility | Implementation | Cordova dependency |
|---|---|---|
| **FileService** | [src/util/file/](../src/util/file/) — read/write/list/free-disk-space | `cordova-plugin-file`, `cordova.exec()` |
| **SharedPreferences** | Android: `cordova-plugin-awesome-shared-preferences`; Web: `localStorage` | Conditional |
| **DownloadService** | [src/util/download/](../src/util/download/) — progress, cancel, cache | `cordova-plugin-android-downloadmanager` (Android-only) |
| **DeviceInfo** | [src/util/device/](../src/util/device/) | `window.device.platform`, `window.device.uuid` |
| **AppInfo** | [src/util/app/](../src/util/app/) | `cordova-plugin-app-version` |
| **ZipService** | [src/util/zip/](../src/util/zip/) | `jjdltc-cordova-plugin-zip` |
| **NetworkInfo** | [src/util/network/](../src/util/network/) | Cordova network plugin |

---

## Key Design Patterns

| Pattern | Where used |
|---|---|
| **Singleton** | `SunbirdSdk.instance` |
| **Dependency Injection** | Inversify container, `@inject` decorators, constructor injection |
| **Reactive (RxJS)** | All async operations return `Observable<T>`; `combineLatest`, `mergeMap`, `switchMap` |
| **Decorator** | `TelemetryDecorator` wraps other services for auto event emission |
| **Handler / Chain-of-Responsibility** | ContentServiceImpl delegates to 8+ handler classes |
| **Factory** | `MigrationFactory`, `PageAssemblerFactory` |
| **Barrel exports** | Each module's `index.ts` controls the public surface |

---

## Storage Mechanisms

| Mechanism | Used for |
|---|---|
| **SQLite** (sb-cordova-plugin-db) | Profiles, courses, content metadata, telemetry queue, errors, groups |
| **SharedPreferences** (native/localStorage) | OAuth tokens, user state, key-value settings |
| **File system** (cordova-plugin-file) | ECAR content bundles, export archives |
| **In-memory CachedItemStore** | Framework definitions, form config, frequently read data |

---

## Build & Tooling

| Tool | Version | Notes |
|---|---|---|
| TypeScript | 4.3.5 | ES6 target, `experimentalDecorators`, `strictPropertyInitialization: false` |
| Webpack | 4.47.0 | UMD bundle, externals: rxjs + client-services |
| Jest | 25.5.4 | ts-jest transform |
| TSLint | 5.20.1 | **Deprecated** — no ESLint migration yet |
| CircleCI | Node 14.17.3 | Build → test → NPM publish |
| SonarCloud | Configured | Quality gates in `sonar-project.properties` |

---

## Current Migration Status

The SDK is mid-migration from **Cordova → Capacitor**. See [MIGRATION_CORDOVA_TO_CAPACITOR.md](../MIGRATION_CORDOVA_TO_CAPACITOR.md) for the detailed plan.

Current `sdkConfig.platform` values: `'cordova' | 'web'` — Capacitor is not yet a recognized platform. Detailed blockers are covered in the [Technical Debt Report](./TECHNICAL_DEBT_REPORT.md).
