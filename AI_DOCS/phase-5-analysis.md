# Phase 5 Analysis — ZipService (ECAR Import / Content Export)

## Goal
Replace `JJzip` (global from `jjdltc-cordova-plugin-zip`) with a pure-JS Capacitor
implementation using `jszip@3.10.1` (already installed as a transitive dependency) and
`@capacitor/filesystem` for file I/O.

---

## Current Cordova implementation

`src/util/zip/impl/zip-service-impl.ts`

```typescript
JJzip.unzip(sourceZip, option, successCallback, errorCallback)
JJzip.zip(sourceFolderPath, option, skipDirs, skipFiles, successCallback, errorCallback)
```

`JJzip` is a global injected by `jjdltc-cordova-plugin-zip`. It runs natively on Android/iOS.

---

## Interface to implement

```typescript
interface ZipService {
    unzip(sourceZip: string, option: { target: string }, successCallback?, errorCallback?)
    zip(sourceFolderPath: string, option: { target: string },
        directoriesToBeSkipped?: string[], filesToBeSkipped?: string[],
        successCallback?, errorCallback?)
}
```

### `option.target` semantics
- In `unzip`: the directory to extract files into (e.g. `file:///storage/.../tmp/`)
- In `zip`: the full output zip file path (e.g. `file:///storage/.../archive.zip`)

---

## Call sites

| File | Method | option.target |
|---|---|---|
| `extract-ecar.ts:24` | `unzip` | `directoryEntry.nativeURL` — a temp directory |
| `extract-payloads.ts:168` | `unzip` | `payloadDestination` — another directory |
| `archive-service-impl.ts:379` | `unzip` | `workspacePath + '/'` |
| `archive-service-impl.ts:190` | `zip` | computed zip file path |
| `compress-content.ts:32` | `zip` | export tmp path |
| `ecar-bundle.ts:18` | `zip` | export tmp path |

---

## Capacitor implementation strategy

### `unzip`
```
1. Filesystem.readFile({ path: sourceZip })            → base64 string
2. JSZip.loadAsync(base64, { base64: true })            → JSZip instance
3. For each entry (non-directory):
     entry.async('base64')                             → base64 content
     Filesystem.writeFile({ path: target+entry, data, recursive: true })
4. All writes in parallel (Promise.all)
5. success() / error()
```

### `zip`
```
1. Recursively Filesystem.readdir({ path: sourceFolderPath })
   → skip dirs in directoriesToBeSkipped
   → skip files in filesToBeSkipped
2. For each file: Filesystem.readFile({ path }) → base64
3. zip.file(relativePath, base64, { base64: true })
4. zip.generateAsync({ type: 'base64' })              → base64 zip
5. Filesystem.writeFile({ path: option.target, data: base64zip, recursive: true })
6. success() / error()
```

---

## Files impacted

| File | Change |
|---|---|
| `src/util/zip/impl/zip-service-capacitor-impl.ts` | NEW — full ZipService impl |
| `src/sdk.ts` | Add conditional ZIP_SERVICE binding |
| `package.json` | Add `jszip` to devDependencies explicitly |

---

## Risks

| Risk | Notes |
|---|---|
| Large ECAR files (100+ MB) | JSZip processes in memory — may hit memory limits on low-end devices. JJzip is native and streams. Acceptable for MVP; flag for optimisation if needed. |
| File paths with `file://` prefix | `@capacitor/filesystem` accepts both `file://` URIs and relative paths. Test on device. |
| `Filesystem.writeFile` without `encoding` param | Binary files must NOT use `Encoding.UTF8` — omitting `encoding` causes Capacitor to treat `data` as base64 automatically. |
| Parallel writes | `Promise.all` on large zips can spike I/O. Sequential fallback available if needed. |
