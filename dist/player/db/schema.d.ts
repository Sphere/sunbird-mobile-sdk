export declare namespace PlayerConfigEntry {
    const TABLE_NAME = "player_data";
    const _ID = "_id";
    const COLUMN_NAME_USER_ID = "user_id";
    const COLUMN_PARENT_IDENTIFIER = "parent_identifier";
    const COLUMN_IDENTIFIER = "identifier";
    const COLUMN_PLAYER_CONFIG = "player_config";
    interface SchemaMap {
        [COLUMN_NAME_USER_ID]: string;
        [COLUMN_PARENT_IDENTIFIER]: string;
        [COLUMN_IDENTIFIER]: string;
        [COLUMN_PLAYER_CONFIG]: string;
    }
    const getCreateEntry: (() => string);
    const deleteTable: (() => string);
    const getAlterEntryForPlayerConfig: (() => string);
}
export interface PlayerSaveState {
    userId: string;
    parentId: string;
    contentId: string;
    saveState: string;
}
export declare class PlayerDbEntryMapper {
    static mapPlayerDbEntryToPlayer(playerEntry: PlayerConfigEntry.SchemaMap): PlayerSaveState;
    static mapPlayerStateToPlayerDbEntry(userId: string, parentId: string, contentId: string, saveState: string): PlayerConfigEntry.SchemaMap;
}
