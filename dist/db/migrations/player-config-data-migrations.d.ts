import { Migration } from '../def/migration';
import { DbService } from '../def/db-service';
export declare class PlayerConfigDataMigrations extends Migration {
    constructor();
    apply(dbService: DbService): Promise<undefined>;
    queries(): Array<string>;
}
