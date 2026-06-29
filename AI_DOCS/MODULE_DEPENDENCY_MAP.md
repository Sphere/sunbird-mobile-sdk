# Sunbird Mobile SDK — Module Dependency Map

> Read together with [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md).  
> Arrows mean "depends on / calls into".

---

## Top-level Module Graph

```
SunbirdSdk (sdk.ts)
│
├── INFRASTRUCTURE
│   ├── ApiService ──────────── @project-sunbird/client-services (CsModule)
│   ├── DbService ───────────── sb-cordova-plugin-db
│   ├── EventsBusService ────── rxjs
│   └── AuthService ─────────── ApiService, InAppBrowser, CsModule
│
├── DOMAIN
│   ├── ContentService ──────── ApiService, DbService, FileService, DownloadService, ZipService, StorageService
│   ├── ProfileService ──────── ApiService, DbService, AuthService, CsUserService
│   ├── CourseService ───────── ApiService, DbService, ContentService, ProfileService
│   ├── FrameworkService ────── ApiService, DbService, KeyValueStore
│   ├── FormService ─────────── ApiService
│   ├── PageService ─────────── ApiService
│   ├── TelemetryService ────── DbService, SharedPreferences, EventsBusService, ApiService
│   ├── SummarizerService ───── DbService, TelemetryService
│   ├── StorageService ──────── FileService, ContentService, DbService
│   ├── ArchiveService ──────── FileService, ContentService, ZipService
│   ├── NotificationService ─── ApiService, DbService, CsNotificationService
│   ├── GroupService ────────── ApiService, CsGroupService
│   ├── GroupService(dep.) ──── DbService
│   ├── CertificateService ──── DbService, ApiService
│   ├── PlayerService ───────── SharedPreferences, GroupService(dep.)
│   ├── SystemSettingsService ── ApiService, DbService
│   ├── DiscussionService ───── ApiService, CsDiscussionService
│   ├── SegmentationService ─── ApiService
│   ├── ErrorLoggingService ─── DbService, ApiService
│   ├── DeviceRegisterService ── ApiService, SharedPreferences
│   ├── FAQService ──────────── ApiService
│   └── CodePushExperiment ──── ApiService
│
└── UTILITIES
    ├── FileService ─────────── cordova-plugin-file, cordova.exec()
    ├── SharedPreferences ───── [cordova-plugin-awesome-shared-preferences | localStorage]
    ├── DownloadService ─────── cordova-plugin-android-downloadmanager, FileService
    ├── ZipService ──────────── jjdltc-cordova-plugin-zip
    ├── DeviceInfo ──────────── window.device (Cordova)
    ├── AppInfo ─────────────── cordova-plugin-app-version
    ├── NetworkInfo ─────────── Cordova network plugin
    ├── KeyValueStore ───────── SharedPreferences
    └── SearchHistoryService ── DbService
```

---

## Cross-Module Dependency Matrix

Legend: `●` = direct dependency, `○` = indirect/optional

| Consumer ↓ \ Provider → | ApiSvc | DbSvc | FileSvc | AuthSvc | TelSvc | SharedPrefs | EventsBus | ContentSvc | ProfileSvc | DlSvc |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **ContentService** | ● | ● | ● | | ○ | | ● | | | ● |
| **ProfileService** | ● | ● | | ● | ○ | ● | | | | |
| **CourseService** | ● | ● | ● | | ○ | | | ● | ● | |
| **TelemetryService** | ● | ● | | | | ● | ● | | | |
| **SummarizerService** | | ● | | | ● | | | | | |
| **StorageService** | | ● | ● | | | | | ● | | |
| **ArchiveService** | | | ● | | | | | ● | | |
| **AuthService** | ● | | | | | ● | | | | |
| **GroupService** | ● | | | | | | | | | |
| **GroupService (dep.)** | | ● | | | | | | | | |
| **PlayerService** | | | | | | ● | | | | |
| **NotificationService** | ● | ● | | | | | | | | |
| **CertificateService** | ● | ● | | | | | | | | |
| **ErrorLoggingService** | ● | ● | | | | | | | | |
| **DeviceRegisterSvc** | ● | | | | | ● | | | | |
| **DownloadService** | | | ● | | | | ● | | | |
| **KeyValueStore** | | | | | | ● | | | | |
| **SearchHistory** | | ● | | | | | | | | |

---

## Per-Module Detail

### ContentService — [src/content/](../src/content/)

```
ContentServiceImpl (970 lines)
├── ApiService           — search, import manifest fetch
├── DbService            — ContentEntry, ContentMarkerEntry
├── FileService          — ECAR extraction, delete
├── DownloadService      — trigger & track downloads
├── ZipService           — unzip ECAR bundles
├── StorageService       — move content between volumes
└── EventsBusService     — emit ContentDeleteEvent

Handlers (8+):
  SearchContentHandler, ImportEcarHandler, ValidateEcarHandler,
  ExtractPayloadsHandler, DeleteContentHandler, ExportContentHandler,
  ContentAggregator (851 lines), CopyToDestinationHandler
```

External packages: none beyond infra layer.

---

### ProfileService — [src/profile/](../src/profile/)

```
ProfileServiceImpl (808 lines)
├── ApiService           — server profile read/write, OTP, T&C
├── DbService            — ProfileEntry, ProfileSessionEntry
├── AuthService          — InAppBrowser for OAuth during merge
├── SharedPreferences    — active session token
└── CsUserService        — from @project-sunbird/client-services

Handlers:
  ManagedProfileManager, ExportProfileHandler, ImportProfileHandler,
  SearchLocationHandler, GetFrameworkCategoryTermsHandler
```

---

### CourseService — [src/course/](../src/course/)

```
CourseServiceImpl
├── ApiService           — enrollment, batch APIs
├── DbService            — CourseEntry, CourseAssessmentEntry
├── FileService          — export paths
├── ContentService       — child content lookup
└── ProfileService       — current user session

Cordova-direct: cordova.file.externalRootDirectory, InAppBrowser (certificates)
```

---

### TelemetryService — [src/telemetry/](../src/telemetry/)

```
TelemetryServiceImpl
├── DbService            — telemetry queue storage
├── SharedPreferences    — sync config, last-sync timestamp
├── EventsBusService     — emit TelemetrySyncEvent
└── ApiService           — batch upload

TelemetryDecorator wraps ContentService, ProfileService, CourseService
  (adds auto-event emission without changing service internals)
```

---

### AuthService — [src/auth/](../src/auth/)

```
AuthServiceImpl
├── ApiService           — token exchange, refresh
├── SharedPreferences    — token persistence
└── @project-sunbird/client-services — CsModule HTTP adapter

Session Providers:
  WebviewLoginSessionProvider ──── cordova.InAppBrowser.open()
  WebviewAutoMergeSessionProvider  cordova.InAppBrowser.open()
  WebviewManualMergeSessionProvider
  NativeGoogleSessionProvider
  NativeAppleSessionProvider
  NativeKeycloakSessionProvider
  NativeCustomBrowserSessionProvider
```

---

### FileService — [src/util/file/](../src/util/file/)

```
FileServiceImpl (608 lines)
└── Cordova File Plugin
    ├── file.requestFileSystem()
    ├── resolveLocalFileSystemURL()
    ├── cordova.file.* path constants
    └── cordova.exec('File', 'getFreeDiskSpace')

Path resolver:
  iOS  → cordova.file.documentsDirectory
  Android → cordova.file.externalDataDirectory
```

No SDK service dependency — pure Cordova wrapper.

---

### DownloadService — [src/util/download/](../src/util/download/)

```
DownloadServiceImpl (465 lines)
├── cordova-plugin-android-downloadmanager (direct import)
├── FileService          — path resolution
└── EventsBusService     — DownloadProgressEvent

Limitations:
  Android-only (no iOS implementation)
  Hardcodes DOWNLOAD_DIR_NAME = 'Download'
```

---

### DbService — [src/db/](../src/db/)

```
DbCordovaService
└── sb-cordova-plugin-db (SQLite)

Schema version: 31
Migrations (13): ProfileSyllabus → CertificatePublicKey

Tables:
  ContentEntry, ContentMarkerEntry
  ProfileEntry, ProfileSessionEntry
  CourseEntry, CourseAssessmentEntry
  GroupEntry, GroupProfileEntry
  TelemetryEntry (queue)
  ErrorEntry
  SearchHistoryEntry
  CertificateEntry
  NotificationEntry
```

---

### @project-sunbird/client-services (External)

The SDK uses these `Cs*` services via the Inversify-injected `CsModule`:

| CsService | Used by |
|---|---|
| `CsHttpService` | ApiService (HTTP transport) |
| `CsUserService` | ProfileService |
| `CsGroupService` | GroupService |
| `CsNotificationService` | NotificationServiceV2 |
| `CsDiscussionService` | DiscussionService |
| `CsContentService` | ContentService (some searches) |
| `CsCourseService` | CourseService |

---

## High-Coupling Hotspots

These modules have the most inbound dependencies — changes ripple widely:

| Module | Inbound consumers |
|---|---|
| **DbService** | 14 modules |
| **ApiService** | 12 modules |
| **FileService** | 5 modules (ContentService, CourseService, StorageService, ArchiveService, DownloadService) |
| **SharedPreferences** | 6 modules |
| **EventsBusService** | 4 modules |
| **ContentService** | 3 modules (CourseService, StorageService, ArchiveService) |
| **GroupService (deprecated)** | 2 modules (PlayerService, TelemetryService) — risk area |

---

## Cordova Plugin → SDK Module Map

| Cordova Plugin | Consumed by |
|---|---|
| `sb-cordova-plugin-db` | DbService |
| `cordova-plugin-file` | FileService (all file ops) |
| `cordova-plugin-android-downloadmanager` | DownloadService |
| `cordova-plugin-inappbrowser` | AuthService, ProfileService, CourseService |
| `cordova-plugin-awesome-shared-preferences` | SharedPreferencesAndroid |
| `cordova-plugin-app-version` | AppInfo |
| `jjdltc-cordova-plugin-zip` | ZipService |
| `sb-cordova-plugin-utility` | Utility helpers (sdk.ts init) |
| `sb-cordova-plugin-customtabs` | AuthService (custom browser sessions) |
| `window.device` (device plugin) | DeviceInfo, FileService (path selection) |

---

## External NPM Package Dependencies

| Package | Version | Role | Consumers |
|---|---|---|---|
| `@project-sunbird/client-services` | 7.0.4 | HTTP abstraction + Cs* services | ApiService, 7+ domain services |
| `inversify` | ^5.1.1 | Dependency injection | sdk.ts + all `@inject` classes |
| `reflect-metadata` | ^0.1.13 | Required by Inversify decorators | sdk.ts bootstrap |
| `rxjs` | >=6 | Reactive streams | Every async operation |
| `crypto-js` | 3.1.9-1 | Encryption/hashing | AuthService, TelemetryService |
| `dayjs` | ^1.9.8 | Date manipulation | TelemetryService, SummarizerService |
| `pako` | ^1.0.11 | Gzip compression | TelemetryService (batch upload) |
| `uuid` | ^3.4.0 | UUID generation | Profile, Telemetry, Content |
| `qs` | ^6.9.7 | Query-string serialization | ApiService |
| `node-fetch` | 2.6.7 | HTTP fetch (Node.js context) | ApiService (web/test env) |
| `whatwg-fetch` | ^3.6.2 | Fetch polyfill (browser) | ApiService (web/test env) |
| `typescript-collections` | ^1.3.3 | Typed collections | ContentService internals |
