import { PlayerService } from '..';
import { Content } from '../../content';
import { ProfileService } from '../../profile';
import { GroupServiceDeprecated } from '../../group-deprecated';
import { PlayerInput } from '../def/response';
import { DeviceInfo } from '../../util/device';
import { SdkConfig } from '../../sdk-config';
import { FrameworkService } from '../../framework';
import { AppInfo } from '../../util/app';
import { Observable } from 'rxjs';
import { DbService } from '../../db';
export declare class PlayerServiceImpl implements PlayerService {
    private profileService;
    private groupService;
    private config;
    private frameworkService;
    private deviceInfo;
    private appInfo;
    private dbService;
    constructor(profileService: ProfileService, groupService: GroupServiceDeprecated, config: SdkConfig, frameworkService: FrameworkService, deviceInfo: DeviceInfo, appInfo: AppInfo, dbService: DbService);
    getPlayerConfig(content: Content, extraInfo: {
        [key: string]: any;
    }): Observable<PlayerInput>;
    savePlayerState(userId: string, parentId: string, identifier: string, saveState: string): Promise<number>;
    private fetchPlayerState;
    deletePlayerSaveState(userId: string, parentId: string, contentId: string): Promise<undefined>;
}
