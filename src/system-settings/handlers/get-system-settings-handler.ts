import { CachedItemStore } from '../../key-value-store';
import { FileService } from '../../util/file/def/file-service';
import { Path } from '../../util/file/util/path';
import { GetSystemSettingsRequest, SystemSettings, SystemSettingsConfig } from '..';
import { ApiRequestHandler, ApiService, HttpRequestType, Request } from '../../api';
import { defer, from, Observable, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export class GetSystemSettingsHandler implements ApiRequestHandler<GetSystemSettingsRequest, SystemSettings> {
    private readonly SYSTEM_SETTINGS_FILE_KEY_PREFIX = 'system-setting-';
    private readonly SYSTEM_SETTINGS_LOCAL_KEY = 'system-settings-';
    private readonly GET_SYSTEM_SETTINGS_ENDPOINT = '/system/settings/get';

    constructor(private apiService: ApiService,
        private systemSettingsConfig: SystemSettingsConfig,
        private fileservice: FileService,
        private cachedItemStore: CachedItemStore) {
    }

    handle(request: GetSystemSettingsRequest): Observable<SystemSettings> {
        return this.cachedItemStore.getCached<SystemSettings>(
            request.id,
            this.SYSTEM_SETTINGS_LOCAL_KEY,
            'ttl_' + this.SYSTEM_SETTINGS_LOCAL_KEY,
            () => this.fetchFromServer(request),
            () => this.fetchFromFile(request)
        );
    }

    private fetchFromServer(request: GetSystemSettingsRequest): Observable<SystemSettings> {
        const apiRequest: Request = new Request.Builder()
            .withType(HttpRequestType.GET)
            .withPath(this.systemSettingsConfig.systemSettingsApiPath + this.GET_SYSTEM_SETTINGS_ENDPOINT + '/' + request.id)
            .withBearerToken(true)
            .build();

        return this.apiService.fetch<{ result: { response: SystemSettings } }>(apiRequest).pipe(
            map((response) => {
                return response.body.result.response;
            })
        );
    }

    private fetchFromFile(request: GetSystemSettingsRequest): Observable<SystemSettings> {
        return defer(() => Path.getAssetPath()).pipe(
            switchMap((assetPath: string) => {
                const dir = assetPath + this.systemSettingsConfig.systemSettingsDirPath;
                const file = this.SYSTEM_SETTINGS_FILE_KEY_PREFIX + request.id + '.json';
                const filePath = dir + '/' + file;
                return from(this.fileservice.readFileFromAssets(filePath)).pipe(
                    map((fileContent: string) => {
                        const result = JSON.parse(fileContent);
                        return (result.result.response);
                    })
                );
            }),
            catchError(error => {
                console.error('Error fetching form from file:', error);
                return throwError(error);
            })
        );
    }

}
