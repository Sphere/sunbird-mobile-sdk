import { ApiRequestHandler, ApiService } from '../../api';
import { ProfileServiceConfig } from '..';
import { Observable } from 'rxjs';
import { DeleteUserRequest } from '../def/delete-user-request';
export declare class DeleteAccountHandler implements ApiRequestHandler<DeleteUserRequest, boolean> {
    private apiService;
    private profileServiceConfig;
    private readonly DELETE_ENDPOINT;
    constructor(apiService: ApiService, profileServiceConfig: ProfileServiceConfig);
    handle(request: DeleteUserRequest): Observable<boolean>;
}
