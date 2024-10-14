import { DbService, Migration } from '..';
export declare class CertificatePublicKeyMigration extends Migration {
    constructor();
    apply(dbService: DbService): Promise<undefined>;
    queries(): Array<string>;
}
