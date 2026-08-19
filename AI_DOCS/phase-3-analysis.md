# Phase 3 Analysis — DbService (SQLite)

## Goal
Replace `sb-cordova-plugin-db` (global `db.*` callback API) with `@capacitor-community/sqlite@7.0.3`.

---

## Current Cordova implementation
`src/db/impl/db-cordova-service.ts`

Uses global `db.*` callbacks:
| Method | Cordova call |
|---|---|
| `init()` | `db.init(name, version, [], callback)` — onCreate/onUpgrade callbacks |
| `execute(raw)` | `db.execute(query, useExternalDb, success, error)` |
| `read(ReadQuery)` | `db.read(distinct, table, cols, where, args, groupBy, having, orderBy, limit, useExternal, success, error)` |
| `insert(InsertQuery)` | `db.insert(table, modelJson, useExternalDb, success, error)` |
| `update(UpdateQuery)` | `db.update(table, where, args, modelJson, useExternalDb, success, error)` |
| `delete(DeleteQuery)` | `db.execute(builtQuery, useExternalDb, success, error)` |
| `beginTransaction()` | `db.beginTransaction()` — synchronous, void |
| `endTransaction(bool)` | `db.endTransaction(success, useExternal)` — synchronous, void |
| `copyDatabase(dest)` | `db.copyDatabase(dest, success, error)` |
| `open(filePath)` | `db.open(filePath, success, error)` — external DB |

---

## Capacitor SQLite API mapping

| Cordova | `@capacitor-community/sqlite` |
|---|---|
| `db.init()` | `createConnection({database, version}) + open({database})` + manual migration |
| `db.execute(raw)` | `execute({database, statements, transaction: false})` |
| `db.read()` | Build SELECT SQL → `query({database, statement, values: selectionArgs})` |
| `db.insert(table, modelJson)` | Build INSERT SQL → `run({database, statement, values, transaction: false})` → returns `lastId` |
| `db.update(table, where, modelJson)` | Build UPDATE SQL → `run({database, statement, values, transaction: false})` → returns `changes` |
| `db.delete()` | Build DELETE SQL → `execute({database, statements, transaction: false})` |
| `db.beginTransaction()` | `beginTransaction({database})` — fire-and-forget (interface forces void) |
| `db.endTransaction(true)` | `commitTransaction({database})` — fire-and-forget |
| `db.endTransaction(false)` | `rollbackTransaction({database})` — fire-and-forget |
| `db.copyDatabase()` | `of(true)` stub — no direct equivalent in v7 |
| `db.open(filePath)` | `createConnection({database: externalName}) + open({database: externalName})` |

---

## Key implementation details

### Database name
`sdkConfig.dbConfig.dbName = 'GenieServices.db'`
Strip `.db` extension → pass `'GenieServices'` to plugin (plugin adds `.db` internally).

### Version management (replacing onCreate/onUpgrade callbacks)
```
1. createConnection({database, version: targetVersion})
2. open({database})
3. getVersion({database}) → currentVersion
4. if currentVersion === 0 → run InitialMigration
5. else if currentVersion < targetVersion → run relevant migrations
```

### READ — SQL builder
```sql
SELECT [DISTINCT] col1,col2 FROM table [WHERE selection] [GROUP BY] [HAVING] [ORDER BY] [LIMIT]
```
`selection` keeps `?` placeholders → passed as `values: selectionArgs` to `query()`.

### INSERT — SQL builder
From `modelJson = {col1: val1, col2: val2}`:
```sql
INSERT INTO table (col1, col2) VALUES (?, ?)
```
`values: [val1, val2]`

### UPDATE — SQL builder
From `modelJson + selection + selectionArgs`:
```sql
UPDATE table SET col1=?, col2=? WHERE <interpolated_where>
```
WHERE is pre-interpolated via `QueryBuilder` (no `?` left).
`values: [val1, val2]` (set values only)

### useExternalDb
Track a second connection (`externalDbName`). Route operations based on flag.

---

## Files to create/modify

| File | Action |
|---|---|
| `src/db/impl/db-service-capacitor-impl.ts` | NEW |
| `src/sdk.ts` | Add import + conditional binding for 'capacitor' |
| `package.json` | Add `@capacitor-community/sqlite` to peerDependencies |

---

## Risks
- `beginTransaction`/`endTransaction` are `void` in the interface but async in the plugin — fire-and-forget, race condition risk is low (JS single-threaded)
- `copyDatabase` has no direct Capacitor equivalent — stubbed as `of(true)` until a native solution is added
- iOS: `query()` returns column names as first row — Android-only for now, acceptable
