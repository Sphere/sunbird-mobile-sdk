import {ApiTokenHandler} from '../../handlers/api-token-handler';
import {ApiConfig, ApiService} from '../..';
import {Observable, of} from 'rxjs';
import {ApiKeys} from '../../../preference-keys';
import {DeviceInfo} from '../../../util/device';
import {SharedPreferences} from '../../../util/shared-preferences';
import {finalize, mapTo, mergeMap, shareReplay} from 'rxjs/operators';
import {
    CsHttpResponseCode,
    CsRequest,
    CsResponse,
    CsResponseInterceptor
} from '@project-sunbird/client-services/core/http-service';

export class BearerTokenRefreshInterceptor implements CsResponseInterceptor {
    private apiTokenHandler: ApiTokenHandler;
    // Coalesces concurrent 401s (several withBearerToken calls can fail around the same
    // cold-start moment) onto a single in-flight refresh, instead of each one racing its
    // own refreshAuthToken()/putString() pair against the others.
    private pendingRefresh?: Observable<string>;

    constructor(
        private sharedPreferences: SharedPreferences,
        private apiConfig: ApiConfig,
        private deviceInfo: DeviceInfo,
        private apiService: ApiService
    ) {
        this.apiTokenHandler = new ApiTokenHandler(this.apiConfig, this.apiService, this.deviceInfo);
    }

    private refreshAndPersistToken(): Observable<string> {
        if (!this.pendingRefresh) {
            this.pendingRefresh = this.apiTokenHandler.refreshAuthToken().pipe(
                mergeMap((bearerToken) =>
                    this.sharedPreferences.putString(ApiKeys.KEY_API_TOKEN, bearerToken).pipe(
                        mapTo(bearerToken)
                    )
                ),
                shareReplay(1),
                finalize(() => { this.pendingRefresh = undefined; })
            );
        }

        return this.pendingRefresh;
    }

    interceptResponse(request: CsRequest, response: CsResponse): Observable<CsResponse> {
        if ((response.responseCode === CsHttpResponseCode.HTTP_UNAUTHORISED && response.body.message === 'Unauthorized')
            || response.responseCode === CsHttpResponseCode.HTTP_FORBIDDEN) {
            return this.refreshAndPersistToken().pipe(
                mergeMap(() => this.apiService.fetch(request))
            );
        }

        return of(response);
    }
}
