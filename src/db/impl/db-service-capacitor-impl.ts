import { DbService, DeleteQuery, InsertQuery, Migration, MigrationFactory, ReadQuery, UpdateQuery } from '..';
import { InitialMigration } from '../migrations/initial-migration';
import { QueryBuilder } from '../util/query-builder';
import { injectable, inject } from 'inversify';
import { SdkConfig } from '../../sdk-config';
import { InjectionTokens } from '../../injection-tokens';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CapacitorSQLite } from '@capacitor-community/sqlite';

@injectable()
export class DbServiceCapacitorImpl extends DbService {

    private readonly db = CapacitorSQLite;
    private dbName: string;
    private externalDbName: string | null = null;

    constructor(
        @inject(InjectionTokens.SDK_CONFIG) private sdkConfig: SdkConfig,
        @inject(InjectionTokens.DB_VERSION) private dbVersion: number,
        @inject(InjectionTokens.DB_MIGRATION_LIST) private appMigrationList: (Migration | MigrationFactory)[]
    ) {
        super();
        // Strip .db extension — plugin adds it internally
        this.dbName = this.sdkConfig.dbConfig.dbName.replace(/\.db$/i, '');
    }

    async init(): Promise<undefined> {
        await this.db.createConnection({
            database: this.dbName,
            version: this.dbVersion,
            encrypted: false,
            mode: 'no-encryption'
        });
        await this.db.open({ database: this.dbName });

        const { version: currentVersion = 0 } = await this.db.getVersion({ database: this.dbName });

        if (currentVersion === 0) {
            await this.onCreate();
        } else if (currentVersion < this.dbVersion) {
            await this.onUpgrade(currentVersion, this.dbVersion);
        }

        return undefined;
    }

    execute(rawQuery: string, useExternalDb?: boolean): Observable<any> {
        const database = useExternalDb && this.externalDbName ? this.externalDbName : this.dbName;
        // The SDK's execute() contract runs arbitrary raw SQL — including SELECTs that must
        // return their rows (e.g. getContents, getFindAllContentsQuery). The native Cordova
        // plugin handled both transparently, but @capacitor-community/sqlite splits them:
        // db.query() = rawQuery (row-returning), db.execute() = execSQL (DDL/DML only).
        // Passing a SELECT to db.execute() throws "Queries can be performed using SQLiteDatabase
        // query or rawQuery methods only" and returns a change-count instead of rows (which then
        // surfaces downstream as "X is not iterable"). Route by statement type.
        if (DbServiceCapacitorImpl.isRowReturningQuery(rawQuery)) {
            return from(
                this.db.query({ database, statement: rawQuery, values: [] })
            ).pipe(map(result => result.values || []));
        }
        return from(
            this.db.execute({ database, statements: rawQuery, transaction: false })
        ).pipe(map(result => result.changes));
    }

    private static isRowReturningQuery(rawQuery: string): boolean {
        // Strip leading line/block comments and whitespace, then check the leading keyword.
        const normalized = rawQuery
            .replace(/^\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)+/, '')
            .trimStart()
            .toUpperCase();
        return /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/.test(normalized);
    }

    read(readQuery: ReadQuery): Observable<any[]> {
        const database = readQuery.useExternalDb && this.externalDbName ? this.externalDbName : this.dbName;
        const { statement, values } = this.buildSelect(readQuery);
        return from(
            this.db.query({ database, statement, values })
        ).pipe(map(result => result.values || []));
    }

    insert(insertQuery: InsertQuery): Observable<number> {
        const database = insertQuery.useExternalDb && this.externalDbName ? this.externalDbName : this.dbName;
        const { statement, values } = this.buildInsert(insertQuery.table, insertQuery.modelJson);
        return from(
            this.db.run({ database, statement, values, transaction: false })
        ).pipe(map(result => result.changes?.lastId || 0));
    }

    update(updateQuery: UpdateQuery): Observable<number> {
        const database = updateQuery.useExternalDb && this.externalDbName ? this.externalDbName : this.dbName;
        const { statement, values } = this.buildUpdate(
            updateQuery.table,
            updateQuery.modelJson,
            updateQuery.selection || '',
            updateQuery.selectionArgs || []
        );
        return from(
            this.db.run({ database, statement, values, transaction: false })
        ).pipe(map(result => result.changes?.changes || 0));
    }

    delete(deleteQuery: DeleteQuery): Observable<undefined> {
        const database = deleteQuery.useExternalDb && this.externalDbName ? this.externalDbName : this.dbName;
        const whereClause = new QueryBuilder()
            .where(deleteQuery.selection)
            .args(deleteQuery.selectionArgs)
            .end()
            .build();
        const statement = `DELETE FROM ${deleteQuery.table} WHERE ${whereClause}`;
        return from(
            this.db.execute({ database, statements: statement, transaction: false })
        ).pipe(map(() => undefined));
    }

    beginTransaction(): void {
        this.db.beginTransaction({ database: this.dbName });
    }

    endTransaction(isOperationSuccessful: boolean): void {
        if (isOperationSuccessful) {
            this.db.commitTransaction({ database: this.dbName });
        } else {
            this.db.rollbackTransaction({ database: this.dbName });
        }
    }

    copyDatabase(destination: string): Observable<boolean> {
        // @capacitor-community/sqlite v7 has no direct copyDatabase API
        return of(true);
    }

    async open(dbFilePath: string): Promise<undefined> {
        // Extract DB name from file path for external DB connections
        const name = dbFilePath.split('/').pop()?.replace(/\.db$/i, '') || dbFilePath;
        this.externalDbName = name;
        try {
            await this.db.createConnection({
                database: name,
                version: 1,
                encrypted: false,
                mode: 'no-encryption'
            });
            await this.db.open({ database: name });
        } catch (e) {
            console.warn('[DbServiceCapacitorImpl] open external db error', e);
        }
        return undefined;
    }

    private async onCreate(): Promise<void> {
        await new InitialMigration().apply(this);
    }

    private async onUpgrade(oldVersion: number, newVersion: number): Promise<void> {
        for (const m of this.appMigrationList) {
            const migration: Migration = m instanceof Migration ? m : m();
            if (migration.required(oldVersion, newVersion)) {
                await migration.apply(this);
            }
        }
    }

    private buildSelect(q: ReadQuery): { statement: string; values: any[] } {
        const distinct = q.distinct ? 'DISTINCT ' : '';
        const cols = (q.columns && q.columns.length) ? q.columns.join(', ') : '*';
        let sql = `SELECT ${distinct}${cols} FROM ${q.table}`;
        if (q.selection) sql += ` WHERE ${q.selection}`;
        if (q.groupBy)   sql += ` GROUP BY ${q.groupBy}`;
        if (q.having)    sql += ` HAVING ${q.having}`;
        if (q.orderBy)   sql += ` ORDER BY ${q.orderBy}`;
        if (q.limit)     sql += ` LIMIT ${q.limit}`;
        return { statement: sql, values: q.selectionArgs || [] };
    }

    private buildInsert(table: string, modelJson: any): { statement: string; values: any[] } {
        const keys = Object.keys(modelJson);
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => modelJson[k]);
        return {
            statement: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
            values
        };
    }

    private buildUpdate(table: string, modelJson: any, selection: string, selectionArgs: string[]): { statement: string; values: any[] } {
        const keys = Object.keys(modelJson);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const setValues = keys.map(k => modelJson[k]);
        const whereClause = selection
            ? new QueryBuilder().where(selection).args(selectionArgs).end().build()
            : '1=1';
        return {
            statement: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
            values: setValues
        };
    }
}
