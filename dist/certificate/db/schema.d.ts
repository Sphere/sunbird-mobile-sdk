export declare namespace CertificatePublicKeyEntry {
    const _ID = "_id";
    const TABLE_NAME = "certificate_public_key";
    const COLUMN_NAME_IDENTIFIER = "identifier";
    const COLUMN_NAME_PUBLIC_KEY = "public_key";
    const COLUMN_NAME_ALGORITHM = "alg";
    const COLUMN_NAME_OWNER = "owner";
    const COLUMN_NAME_EXPIRY_TIME = "expiry_time";
    interface SchemaMap {
        [COLUMN_NAME_IDENTIFIER]: string;
        [COLUMN_NAME_ALGORITHM]: string;
        [COLUMN_NAME_PUBLIC_KEY]: string;
        [COLUMN_NAME_OWNER]: string;
        [COLUMN_NAME_EXPIRY_TIME]: number;
    }
    const getCreateEntry: (() => string);
    const deleteTable: (() => string);
}
