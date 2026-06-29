# SDK Migration Analysis Context

## Repositories

### SDK Repository

Path:
`OFFICE/SPHERE/capacitor-sphere-version/sunbird-sdk`

### Consuming Application

Path:
`OFFICE/SPHERE/capacitor-sphere-version/sphere-mobile`

The `sphere-mobile` application consumes the `sunbird-sdk` package and uses its APIs, services, and native integrations.

## Objective

Analyze both repositories together to support the Cordova-to-Capacitor migration.

### Tasks

1. Identify how `sphere-mobile` initializes and consumes `sunbird-sdk`.

2. Find all imports and usages of SDK services in `sphere-mobile`.

3. Trace Cordova plugin usage from:

   * SDK implementation
   * SDK public APIs
   * Consuming application integrations

4. Generate a dependency graph showing:

   * SDK modules
   * Consuming app modules
   * Native plugin dependencies
   * Data flow between them

5. For each Cordova plugin:

   * Find SDK implementation files.
   * Find consuming app files impacted by migration.
   * Recommend Capacitor replacements.
   * Estimate migration effort.

### Focus Areas

* SDK initialization flow
* Database services
* File management
* Download manager
* Shared preferences/storage
* InAppBrowser/Custom Tabs
* HTTP services
* Native utility plugins

### Deliverables

1. SDK usage map within sphere-mobile.
2. Cordova dependency inventory.
3. Capacitor replacement matrix.
4. Breaking change analysis.
5. Required code changes in sphere-mobile.
6. Recommended migration sequence.
7. Validation and testing checklist.

Important:
Do not analyze the SDK in isolation. Start from the consuming application (`sphere-mobile`), trace all SDK usage, and then identify the corresponding implementation inside `sunbird-sdk`.
