import 'reflect-metadata';
import { of } from 'rxjs';
import { DbServiceCapacitorImpl } from './db-service-capacitor-impl';
import { CapacitorSQLite } from '@capacitor-community/sqlite';

// Mock the entire plugin
jest.mock('@capacitor-community/sqlite', () => ({
    CapacitorSQLite: {
        createConnection: jest.fn().mockResolvedValue({}),
        open: jest.fn().mockResolvedValue({}),
        execute: jest.fn().mockResolvedValue({ changes: { changes: 1 } }),
        run: jest.fn().mockResolvedValue({ changes: { changes: 1, lastId: 42 } }),
        query: jest.fn().mockResolvedValue({ values: [{ id: 1, name: 'test' }] }),
        beginTransaction: jest.fn().mockResolvedValue({}),
        commitTransaction: jest.fn().mockResolvedValue({}),
        rollbackTransaction: jest.fn().mockResolvedValue({}),
    }
}));

const mockSdkConfig: any = { dbConfig: { dbName: 'GenieServices.db' } };
const mockMigrationList: any[] = [];

// @capacitor-community/sqlite does not persist PRAGMA user_version on this database file, so
// DbServiceCapacitorImpl tracks the applied schema version itself via SharedPreferences instead
// of db.getVersion() — see the comment on DB_VERSION_PREF_KEY in db-service-capacitor-impl.ts.
function makeSharedPreferences(storedVersion?: number) {
    return {
        getString: jest.fn().mockReturnValue(of(storedVersion === undefined ? undefined : String(storedVersion))),
        putString: jest.fn().mockReturnValue(of(undefined)),
    };
}

function makeService(sharedPreferences = makeSharedPreferences(31)) {
    return new (DbServiceCapacitorImpl as any)(mockSdkConfig, 31, mockMigrationList, sharedPreferences) as DbServiceCapacitorImpl;
}

describe('DbServiceCapacitorImpl', () => {

    let service: DbServiceCapacitorImpl;

    beforeEach(() => {
        jest.clearAllMocks();
        service = makeService();
    });

    describe('init()', () => {
        it('strips .db extension and opens connection', async () => {
            await service.init();
            expect(CapacitorSQLite.createConnection).toHaveBeenCalledWith(
                expect.objectContaining({ database: 'GenieServices' })
            );
            expect(CapacitorSQLite.open).toHaveBeenCalledWith({ database: 'GenieServices' });
        });

        it('runs onCreate when no version is stored', async () => {
            service = makeService(makeSharedPreferences(undefined));
            await service.init();
            // execute called for each CREATE TABLE in InitialMigration
            expect(CapacitorSQLite.execute).toHaveBeenCalled();
        });

        it('still runs onCreate when already at target version, so the schema self-heals', async () => {
            // CREATE TABLE IF NOT EXISTS is idempotent; running it unconditionally protects
            // against the stored version and the database file desyncing.
            service = makeService(makeSharedPreferences(31));
            await service.init();
            expect(CapacitorSQLite.execute).toHaveBeenCalled();
        });

        it('persists the current db version when none was stored', async () => {
            const prefs = makeSharedPreferences(undefined);
            service = makeService(prefs);
            await service.init();
            expect(prefs.putString).toHaveBeenCalledWith('sunbird_capacitor_db_version', '31');
        });

        it('does not rewrite the version when it is already current', async () => {
            const prefs = makeSharedPreferences(31);
            service = makeService(prefs);
            await service.init();
            expect(prefs.putString).not.toHaveBeenCalled();
        });
    });

    describe('read()', () => {
        it('builds SELECT with WHERE and selectionArgs', (done) => {
            service.read({
                table: 'telemetry',
                columns: ['event', 'priority'],
                selection: 'priority = ?',
                selectionArgs: ['1'],
                orderBy: 'timestamp DESC',
                limit: '10'
            }).subscribe(() => {
                expect(CapacitorSQLite.query).toHaveBeenCalledWith(
                    expect.objectContaining({
                        database: 'GenieServices',
                        statement: 'SELECT event, priority FROM telemetry WHERE priority = ? ORDER BY timestamp DESC LIMIT 10',
                        values: ['1']
                    })
                );
                done();
            });
        });

        it('builds SELECT * when no columns specified', (done) => {
            service.read({ table: 'telemetry' }).subscribe(() => {
                expect(CapacitorSQLite.query).toHaveBeenCalledWith(
                    expect.objectContaining({ statement: 'SELECT * FROM telemetry' })
                );
                done();
            });
        });
    });

    describe('insert()', () => {
        it('builds INSERT with parameterised values and returns lastId', (done) => {
            service.insert({
                table: 'telemetry',
                modelJson: { event: '{"eid":"START"}', priority: 1 }
            }).subscribe((lastId) => {
                expect(CapacitorSQLite.run).toHaveBeenCalledWith(
                    expect.objectContaining({
                        statement: 'INSERT INTO telemetry (event, priority) VALUES (?, ?)',
                        values: ['{"eid":"START"}', 1]
                    })
                );
                expect(lastId).toBe(42);
                done();
            });
        });
    });

    describe('update()', () => {
        it('builds UPDATE SET with interpolated WHERE', (done) => {
            service.update({
                table: 'telemetry',
                modelJson: { priority: 2 },
                selection: 'event_type = ?',
                selectionArgs: ['START']
            }).subscribe(() => {
                const call = (CapacitorSQLite.run as jest.Mock).mock.calls[0][0];
                expect(call.statement).toContain('UPDATE telemetry SET priority = ?');
                expect(call.statement).toContain('WHERE event_type = "START"');
                expect(call.values).toEqual([2]);
                done();
            });
        });
    });

    describe('delete()', () => {
        it('builds DELETE with interpolated WHERE', (done) => {
            service.delete({
                table: 'telemetry',
                selection: 'priority = ?',
                selectionArgs: ['1']
            }).subscribe(() => {
                const call = (CapacitorSQLite.execute as jest.Mock).mock.calls[0][0];
                expect(call.statements).toContain('DELETE FROM telemetry WHERE priority = 1');
                done();
            });
        });
    });

    describe('execute()', () => {
        it('routes non-row-returning SQL (DROP) to plugin execute()', (done) => {
            service.execute('DROP TABLE IF EXISTS dummy').subscribe(() => {
                expect(CapacitorSQLite.execute).toHaveBeenCalledWith(
                    expect.objectContaining({
                        database: 'GenieServices',
                        statements: 'DROP TABLE IF EXISTS dummy'
                    })
                );
                expect(CapacitorSQLite.query).not.toHaveBeenCalled();
                done();
            });
        });

        it('routes a raw SELECT to plugin query() and returns its rows, not a change-count', (done) => {
            service.execute('SELECT * FROM content WHERE identifier = "abc"').subscribe((rows) => {
                expect(CapacitorSQLite.query).toHaveBeenCalledWith(
                    expect.objectContaining({
                        database: 'GenieServices',
                        statement: 'SELECT * FROM content WHERE identifier = "abc"'
                    })
                );
                expect(CapacitorSQLite.execute).not.toHaveBeenCalled();
                expect(Array.isArray(rows)).toBe(true);
                expect(rows).toEqual([{ id: 1, name: 'test' }]);
                done();
            });
        });

        it('routes SELECT regardless of leading whitespace/case', (done) => {
            service.execute('  select count(*) from telemetry').subscribe(() => {
                expect(CapacitorSQLite.query).toHaveBeenCalled();
                expect(CapacitorSQLite.execute).not.toHaveBeenCalled();
                done();
            });
        });
    });

    describe('beginTransaction / endTransaction', () => {
        it('calls beginTransaction then commitTransaction on success', () => {
            service.beginTransaction();
            service.endTransaction(true);
            expect(CapacitorSQLite.beginTransaction).toHaveBeenCalledWith({ database: 'GenieServices' });
            expect(CapacitorSQLite.commitTransaction).toHaveBeenCalledWith({ database: 'GenieServices' });
        });

        it('calls rollbackTransaction on failure', () => {
            service.beginTransaction();
            service.endTransaction(false);
            expect(CapacitorSQLite.rollbackTransaction).toHaveBeenCalledWith({ database: 'GenieServices' });
        });
    });
});
