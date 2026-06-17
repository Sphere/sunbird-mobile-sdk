import { Migration } from '..';
import { DbService } from '../def/db-service';
export declare class FrameworkMigration extends Migration {
    constructor();
    apply(dbService: DbService): Promise<undefined>;
    queries(): Array<string>;
    updateProfileDB(dbService: DbService): Promise<void>;
    private getUpdateQueries;
}
