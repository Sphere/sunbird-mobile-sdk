# Migration Guide: Cordova → Capacitor

## Purpose
This document describes how to migrate the `sunbird-mobile-sdk` codebase and its consuming application from Cordova to Capacitor.

The current SDK is tightly coupled to Cordova runtime APIs and Cordova plugins. Migration should be done incrementally, with a strong focus on compatibility for SDK consumers.

## Project-specific analysis

### Cordova-related expectations in this repository
- `package.json` declares Cordova plugin peer dependencies:
  - `cordova-plugin-advanced-http`
  - `cordova-plugin-android-downloadmanager`
  - `cordova-plugin-awesome-shared-preferences`
  - `cordova-plugin-file`
  - `cordova-plugin-inappbrowser`
  - `jjdltc-cordova-plugin-zip`
  - `sb-cordova-plugin-customtabs`
  - `sb-cordova-plugin-db`
  - `sb-cordova-plugin-utility`
- `src/sdk.ts` branches on `sdkConfig.platform === 'cordova'` vs `web`
- Major Cordova usages found in source:
  - `cordova.file.*` and `file.requestFileSystem(...)`
  - `cordova.InAppBrowser.open(...)`
  - `cordova.exec(...)` and custom plugin exec calls
  - custom native plugins including download manager, shared preferences, custom tabs, zip, and DB
  - `window.device.platform` and `window.device.uuid`
- Several internal services depend on Cordova behavior:
  - `FileServiceImpl`
  - `WebviewRunnerImpl`
  - `DownloadServiceImpl`
  - `TelemetryAutoSyncServiceImpl`
  - Shared preferences / DB plugin wrappers

### What this means for migration
The migration is not only a host-app upgrade, but a library-level refactor. The SDK needs a Capacitor compatibility surface for:
- filesystem access
- browser/webview flows
- background/native download tracking
- native preferences/database plugins
- device and app metadata

## Recommended migration approach

### 1. Create a Capacitor compatibility branch
- Start from a dedicated branch such as `feature/migrate-to-capacitor`
- Preserve existing Cordova support while introducing Capacitor support
- Keep the current Cordova platform branch intact until all functionality is ported

### 2. Add Capacitor dependencies and type support
- Add `@capacitor/core`
- Add app plugins as needed:
  - `@capacitor/filesystem`
  - `@capacitor/browser`
  - `@capacitor/device`
  - `@capacitor/app`
  - `@capacitor/storage` (optional for simple key-value data)
- For custom native features, add or implement Capacitor plugins:
  - Download manager plugin (Android custom native plugin)
  - Shared preferences plugin
  - Custom tabs plugin or use `@capacitor/browser`
  - Zip plugin or `@capawesome/capacitor-zip`
  - DB plugin / SQLite wrapper
- Add Capacitor type declarations and update `tsconfig.json` if necessary

### 3. Introduce a new platform marker
Instead of only `cordova` and `web`, add a third platform tag:
- `cordova` (legacy)
- `capacitor` (new)
- `web` (browser)

Update `src/sdk.ts` to support `sdkConfig.platform === 'capacitor'` and bind platform-specific services.

### 4. Replace Cordova runtime APIs with Capacitor plugin APIs
#### Filesystem
Current `FileServiceImpl` usage:
- `file.requestFileSystem(...)`
- `resolveLocalFileSystemURL(...)`
- `cordova.file.documentsDirectory`, `cordova.file.externalDataDirectory`, `cordova.file.externalRootDirectory`
- `cordova.exec(... 'File', 'getFreeDiskSpace' ...)`

Capacitor replacement:
- `Filesystem.readFile`, `writeFile`, `mkdir`, `readdir`, `deleteFile`, `stat`
- `FilesystemDirectory.External`, `Data`, `Documents`, `Cache`
- `Filesystem.getUri(...)` for native file URIs
- Use `FilesystemEncoding.UTF8` for text operations

#### InAppBrowser / OAuth / Webview flows
Current `WebviewRunnerImpl` usage:
- `cordova.InAppBrowser.open(...)`
- `addEventListener('loadstart')`, `exit`, `executeScript(...)`

Capacitor replacement options:
- `@capacitor/browser` for system browser flows
- `@capacitor-community/inappbrowser` for an InAppBrowser-like embed
- Use `App.addListener('appUrlOpen', ...)` and deep links for OAuth return URLs

#### Device and app metadata
Current usage:
- `window.device.platform`
- `window.device.uuid`
- `cordova.getAppVersion` via plugin

Capacitor replacement:
- `Device.getInfo()` from `@capacitor/device`
- `App.getInfo()` from `@capacitor/app`

#### HTTP adapter
Current runtime selection uses `HttpClientCordovaAdapter` for non-web platforms.
- For Capacitor, either keep the existing adapter if it remains compatible or introduce a new `HttpClientCapacitorAdapter`.
- `cordova-plugin-advanced-http` can be replaced with `@capacitor-community/http` if needed, depending on SDK `client-services` expectations.

#### Custom native plugins
Current custom plugin use includes:
- `cordova-plugin-android-downloadmanager`
- `cordova-plugin-awesome-shared-preferences`
- `sb-cordova-plugin-customtabs`
- `sb-cordova-plugin-db`
- `sb-cordova-plugin-utility`
- `jjdltc-cordova-plugin-zip`

Migration guidance:
- Replace each Cordova plugin with a Capacitor plugin or custom Capacitor implementation.
- For Android-only download manager behavior, implement a Capacitor plugin wrapper around native Android `DownloadManager`.
- For shared preferences, implement a Capacitor plugin if persistent native preference storage is required.
- For DB access, evaluate `@capacitor-community/sqlite` or a native DB plugin that matches existing behavior.
- For zip operations, use a Capacitor zip plugin or maintain a native wrapper.

### 5. Maintain backward compatibility during transition
Possible compatibility strategies:
- Keep the existing Cordova integration intact behind `sdkConfig.platform === 'cordova'`
- Add `sdkConfig.platform === 'capacitor'` and new service bindings
- Use dependency injection to swap out platform-specific implementations without changing high-level SDK consumers

### 6. Migrate tests and mocks
- Update Jest setup from Cordova mocks to Capacitor mocks where appropriate
- Replace `window['cordova']` expectations in `*.spec.ts` with Capacitor plugin mocks
- Add mocks for `Capacitor.Plugins`, `Browser`, `Device`, `Filesystem`, and custom Capacitor plugins

### 7. Validate with a Capacitor host app
- Build a small host app or sample app that uses the SDK via Capacitor
- Validate the following flows:
  - File read/write and path handling
  - OAuth/webview flows
  - Download lifecycle and notifications
  - Shared preferences / persisted settings
  - Database operations
  - Telemetry sync and download speed telemetry
- Keep Cordova compatibility tests until the migration finishes

### 8. Remove legacy Cordova dependencies
After full migration:
- Remove Cordova plugin peer dependencies from `package.json`
- Remove Cordova-specific type definitions from `plugins/*.d.ts`
- Remove Cordova runtime-only branches if no longer needed
- Clean up `sdkConfig.platform` to deprecate or remove `cordova` if desired

## Practical code migration notes

### 1. Add Capacitor platform in `sdk.ts`
- Add a new binding branch for `capacitor`
- Bind Capacitor-specific implementations for:
  - `SharedPreferences`
  - `DbService`
  - `FileService`
  - `DeviceInfo`
  - `AppInfo`
  - `NetworkInfoService`
- Keep `Web` and legacy `cordova` branches until tests pass

### 2. Replace `cordova.file` paths
Common current patterns:
- `cordova.file.documentsDirectory`
- `cordova.file.externalCacheDirectory`
- `cordova.file.externalDataDirectory`
- `cordova.file.externalRootDirectory`
- `cordova.file.applicationDirectory`

Capacitor filesystem equivalents:
- `FilesystemDirectory.Documents`
- `FilesystemDirectory.Cache`
- `FilesystemDirectory.External` / `ExternalStorage`
- `FilesystemDirectory.Data`
- `FilesystemDirectory.Application`

> Note: Capacitor directory names and behavior vary by platform; verify exact mapping on iOS and Android.

### 3. Replace `cordova.InAppBrowser` usage
Current OAuth / web session flow uses:
- `cordova.InAppBrowser.open(url, '_blank', options)`
- `addEventListener('loadstart', ...)`
- `addEventListener('exit', ...)`
- `executeScript(...)`

Use Capacitor Browser plugin or the community InAppBrowser plugin. Example:
- `Browser.open({ url })`
- Listen with `Browser.addListener('browserFinished', ...)`
- If deep links are required, use `App.addListener('appUrlOpen', ...)`

### 4. Replace raw `cordova.exec(...)` calls
For custom plugins and native actions, create Capacitor plugin methods instead of raw exec calls.
- `cordova.exec(resolve, reject, 'DownloadManagerPlugin', 'fetchSpeedLog', [])`
- `cordova.exec(() => resolve, reject, 'File', 'getFreeDiskSpace', [])`

Custom Capacitor plugin methods should return promises or callback wrappers.

### 5. Strategy for custom Cordova plugin migration
For each custom plugin in `package.json`:
- Audit actual native requirement in SDK source
- Decide if Capacitor built-in plugin can replace the behavior
- Otherwise, implement a Capacitor plugin with equivalent methods
- Use the new plugin from SDK code through a platform abstraction

## Recommended migration checklist

1. [ ] Create branch `feature/migrate-to-capacitor`
2. [ ] Add Capacitor dependencies and plugin packages
3. [ ] Add `capacitor` platform support to `src/sdk.ts`
4. [ ] Create Capacitor implementations for: `FileService`, `AppInfo`, `DeviceInfo`, `SharedPreferences`, `DbService`
5. [ ] Replace `cordova.InAppBrowser` with Capacitor Browser / community InAppBrowser
6. [ ] Migrate native download and telemetry plugin calls to Capacitor
7. [ ] Update and add Jest mocks for Capacitor plugins
8. [ ] Run host app tests and verify feature parity
9. [ ] Remove Cordova-only peer dependencies once stable

## Risks & special considerations

- `cordova-plugin-file` migration is a major surface area because many services rely on native file paths.
- Custom Cordova plugins are not automatically portable; they require new Capacitor plugins or wrappers.
- `cordova-plugin-android-downloadmanager` and `cordova-plugin-awesome-shared-preferences` are Android-specific and will need platform-specific Capacitor implementations.
- If the SDK consumer remains in a Cordova host app during migration, preserve the `cordova` platform branch until the host app migrates.

## Recommended migration order

1. `DeviceInfo` and `AppInfo`
2. `FileService` and path handling
3. `WebviewRunnerImpl` / browser session flows
4. Download manager and telemetry sync
5. Shared preferences and DB services
6. Custom zip / utility plugin wrappers
7. Clean up `sdkConfig.platform` handling

## Final notes
This repository is an SDK, not a standalone app. The safest migration path is to keep Cordova support while adding Capacitor support in parallel, then deprecate Cordova once the SDK is stable on Capacitor.

For best results, coordinate the SDK migration with the consuming app’s Capacitor upgrade plan.
