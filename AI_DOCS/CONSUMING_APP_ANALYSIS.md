# Consuming App Analysis — sphere-mobile SDK Usage

**App path:** `OFFICE/SPHERE/capacitor-sphere-version/sphere-mobile`  
**SDK version consumed:** `@aastrika_npmjs/sunbird-sdk ^6.1.1`  
**Angular:** 20.x | **Capacitor:** 8.x | **Ionic:** 8.x | **TypeScript:** 5.8.x  
**Date:** 2026-06-16

---

## 1. SDK Initialisation

**File:** `src/app/app.module.ts` lines 373–504  
**Function:** `sunbirdSdkFactory()`

```ts
await SunbirdSdk.instance.init({
  platform: 'cordova',   // ← HARDCODED — must become 'capacitor'
  fileConfig: {},
  dbConfig: { dbName: 'GenieServices.db' },
  apiConfig: { host: buildConfigValues['BASE_URL'], ... },
  telemetryConfig: { ... },
  contentServiceConfig: { ... },
  profileServiceConfig: { ... },
  courseServiceConfig: { ... },
  formServiceConfig: { ... },
  frameworkServiceConfig: { ... },
  pageServiceConfig: { ... },
  systemSettingsConfig: { ... },
  appConfig: { maxCompatibilityLevel: 5, minCompatibilityLevel: 1 },
  sharedPreferencesConfig: {},
  deviceRegisterConfig: { apiPath: '/api/v3/device' },
  playerConfig: { ... },
  eventsBusConfig: { debugMode: true },
  errorLoggerConfig: { ... },
  faqServiceConfig: { ... },
  certificateServiceConfig: { ... },
});
```

**Action required:** Change `platform: 'cordova'` → `platform: 'capacitor'` when all phases are complete.

---

## 2. SDK Services Actually Used by the App

All 35 services are exposed as Angular providers and/or accessed directly. **No service can be skipped.**

### Services injected via Angular tokens (`@Inject(...)`)

| Injection Token | SDK Service |
|---|---|
| `AUTH_SERVICE` | authService |
| `CERTIFICATE_SERVICE` | certificateService |
| `CONTENT_FEEDBACK_SERVICE` | contentFeedbackService |
| `CONTENT_SERVICE` | contentService |
| `COURSE_SERVICE` | courseService |
| `DEBUGGING_SERVICE` | debuggingService |
| `DEVICE_INFO` | deviceInfo |
| `DEVICE_REGISTER_SERVICE` | deviceRegisterService |
| `DOWNLOAD_SERVICE` | downloadService |
| `EVENTS_BUS_SERVICE` | eventsBusService |
| `FORM_SERVICE` | formService |
| `FRAMEWORK_SERVICE` | frameworkService |
| `NETWORK_INFO_SERVICE` | networkInfoService |
| `PROFILE_SERVICE` | profileService |
| `SHARED_PREFERENCES` | sharedPreferences |
| `STORAGE_SERVICE` | storageService |
| `SYSTEM_SETTINGS_SERVICE` | systemSettingsService |
| `TELEMETRY_SERVICE` | telemetryService |

### Services accessed directly via `SunbirdSdk.instance.*`

`apiService`, `pageAssembleService`, `dbService`, `sharedPreferences`, `frameworkUtilService`, `groupService`, `playerService`, `networkQueueService`, `notificationService`, `errorLoggerService`, `searchHistoryService`, `codePushExperimentService`, `faqService`, `archiveService`, `discussionService`, `segmentationService`, `notificationServiceV2`

---

## 3. Capacitor Packages Already Installed in the App

The app has already added most of the Capacitor replacements. This significantly reduces the work needed in the SDK.

| Cordova plugin | Purpose | Capacitor package (already installed) |
|---|---|---|
| `cordova-plugin-device` | Device UUID, platform | `@capacitor/device` (needs adding to SDK) |
| `cordova-plugin-awesome-shared-preferences` | Key-value store | **`@capacitor/preferences ^8.0.0`** ✅ |
| `sb-cordova-plugin-db` | SQLite | **`@capacitor-community/sqlite ^7.0.2`** ✅ |
| Cordova network plugin | Connectivity | **`@capacitor/network ^8.0.0`** ✅ |
| `cordova-plugin-inappbrowser` | OAuth/Browser | (needs `@capacitor/browser`) |
| `cordova-plugin-file` | File system | (needs `@capacitor/filesystem`) |
| `cordova-plugin-android-downloadmanager` | Downloads | (needs custom plugin or `@capacitor/network` + fetch) |

---

## 4. Direct Cordova Usage in the App Itself (outside SDK)

These files in `sphere-mobile` make Cordova calls directly — they also need to be migrated.

| File | Usage |
|---|---|
| `src/services/common-util.service.ts:250,267` | `window.cordova.InAppBrowser.open()` |
| `src/app/modules/reference-player/.../refrence-video.component.ts:72` | `cordova.file.externalRootDirectory` |
| `src/app/modules/profile/.../certificate-received.component.ts:172,198` | `cordova.file.externalRootDirectory` |
| `src/project/ws/viewer/.../viewer-toc.component.ts:372,393` | `cordova.file.externalRootDirectory` |
| `src/project/ws/app/.../app-toc-content-card.component.ts:293,309` | `cordova.file.externalRootDirectory` |

---

## 5. Migration Impact by SDK Service

Based on actual app usage, here is the impact and effort per service:

| Service | Used by app? | Cordova dependency | Migration effort | Priority |
|---|:---:|---|---|---|
| **DeviceInfo** | ✅ | `window.device.uuid / .platform` | Low — `@capacitor/device` is a direct drop-in | Phase 1 |
| **SharedPreferences** | ✅ | `cordova-plugin-awesome-shared-preferences` | Low — `@capacitor/preferences` already installed | Phase 2 |
| **NetworkInfoService** | ✅ | Cordova network plugin | Low — `@capacitor/network` already installed | Phase 2 |
| **AppInfo** | ✅ (indirect) | `cordova-plugin-app-version` | Low — `@capacitor/app` available | Phase 2 |
| **DbService** | ✅ | `sb-cordova-plugin-db` (SQLite) | Medium — `@capacitor-community/sqlite` installed | Phase 3 |
| **FileService** | ✅ (indirect) | `cordova-plugin-file` | High — path constants scattered in 9 SDK files | Phase 4 |
| **AuthService / WebviewRunner** | ✅ | `cordova.InAppBrowser.open()` | Medium — `@capacitor/browser` replacement | Phase 4 |
| **DownloadService** | ✅ | `cordova-plugin-android-downloadmanager` | High — Android-only, no direct Capacitor equivalent | Phase 5 |
| **ContentService** | ✅ | `window.device.platform` + `cordova.file.*` | Blocked by FileService phase | Phase 4+ |
| **TelemetryService** | ✅ | `window.device.platform` only | Unblocked after Phase 1 | Phase 1 |
| **ProfileService** | ✅ | `cordova.InAppBrowser.open()` | Blocked by Browser phase | Phase 4 |
| **CourseService** | ✅ | `cordova.file.*` + `cordova.InAppBrowser.open()` | Blocked by File + Browser phases | Phase 4 |
| **StorageService** | ✅ | Via FileService | Blocked by FileService phase | Phase 4+ |
| **ArchiveService** | ✅ | `cordova.file.*` | Blocked by FileService phase | Phase 4+ |
| **CertificateService** | ✅ | `cordova.file.*` | Blocked by FileService phase | Phase 4+ |
| **GroupService** | ✅ | None (CsGroupService via HTTP) | No Cordova dependency | None needed |
| **DiscussionService** | ✅ | None (CsDiscussionService via HTTP) | No Cordova dependency | None needed |
| **SegmentationService** | ✅ | None (HTTP only) | No Cordova dependency | None needed |
| **FormService** | ✅ | None (HTTP only) | No Cordova dependency | None needed |
| **FrameworkService** | ✅ | None (HTTP only) | No Cordova dependency | None needed |
| **PageAssembleService** | ✅ | None (HTTP only) | No Cordova dependency | None needed |
| **SystemSettingsService** | ✅ | None (HTTP only) | No Cordova dependency | None needed |
| **NotificationService v1/v2** | ✅ | None (HTTP + DB) | DB dependency only | Phase 3 |
| **ErrorLoggerService** | ✅ | None (DB + HTTP) | DB dependency only | Phase 3 |
| **SearchHistoryService** | ✅ | None (DB only) | DB dependency only | Phase 3 |
| **EventsBusService** | ✅ | None (RxJS) | No Cordova dependency | None needed |
| **ApiService** | ✅ | HTTP adapter selection | Already handled in Phase 0 | Done ✅ |

---

## 6. Services with ZERO Cordova Dependency

These services need **no changes** in the SDK for Capacitor migration:

- GroupService, DiscussionService, SegmentationService
- FormService, FrameworkService, PageAssembleService, SystemSettingsService
- EventsBusService, ApiService (Phase 0 done)
- NotificationService v1/v2 (only needs DB, handled in Phase 3)
- ErrorLoggerService, SearchHistoryService (only needs DB)

---

## 7. Recommended Phase Order (updated based on app analysis)

| Phase | Task | Capacitor package | Unblocks |
|---|---|---|---|
| 0 | Platform scaffold | — | ✅ Done |
| 1 | DeviceInfo — replace `window.device.*` | `@capacitor/device` | TelemetryService, FormService, 19 SDK files |
| 2 | SharedPreferences + Network + AppInfo | `@capacitor/preferences`, `@capacitor/network`, `@capacitor/app` | All key-value & session logic |
| 3 | DbService — SQLite | `@capacitor-community/sqlite` | NotificationService, ErrorLogger, SearchHistory, Groups |
| 4 | FileService — file system + paths | `@capacitor/filesystem` | ContentService, StorageService, ArchiveService, Certificate, Course |
| 5 | BrowserService — InAppBrowser | `@capacitor/browser` | AuthService, ProfileService, CourseService |
| 6 | DownloadService | Custom Capacitor plugin | ContentService download flows |
| 7 | ZipService | Custom or `@capacitor-community/zip` | Content import/ECAR |
| 8 | Remove Cordova code | — | Final cleanup |
