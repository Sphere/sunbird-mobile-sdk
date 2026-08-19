import {DeleteQuery, InsertQuery, ReadQuery, UpdateQuery} from './query';
import {Observable} from 'rxjs';
import {injectable} from 'inversify';

/**
 * InversifyJS requires a base class to be @injectable() too when a bound class extends it
 * (DbServiceCapacitorImpl extends this; DbCordovaService only implements it, so it never hit
 * this) — otherwise Container.get() throws "Missing required @injectable annotation in:
 * DbService" while walking the base class's dependency count during resolution planning.
 */
@injectable()
export abstract class DbService {

    abstract init(): Promise<undefined>;

    abstract open(dbFilePath: string): Promise<undefined>;

    abstract execute(rawQuery: string, useExternalDb?: boolean): Observable<any>;

    abstract read(readQuery: ReadQuery): Observable<any[]>;

    abstract insert(insertQuery: InsertQuery): Observable<number>;

    abstract update(updateQuery: UpdateQuery): Observable<number>;

    abstract delete(deleteQuery: DeleteQuery): Observable<undefined>;

    abstract beginTransaction(): void;

    abstract endTransaction(isOperationSuccessful: boolean): void;

    abstract copyDatabase(destination: string): Observable<boolean>;

}
