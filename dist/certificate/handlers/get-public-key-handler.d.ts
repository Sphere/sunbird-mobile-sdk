import { ApiConfig } from '../../api';
import { Observable } from 'rxjs';
import { Container } from 'inversify';
import { GetPublicKeyRequest, GetPublicKeyResponse } from '@project-sunbird/client-services/services/certificate';
import { DbService } from 'src';
import { CertificateServiceConfig } from '../config/certificate-service-config';
export declare class GetPublicKeyHandler {
    private dbService;
    private container;
    private certificateServiceConfig;
    private apiConfig;
    constructor(dbService: DbService, container: Container, certificateServiceConfig: CertificateServiceConfig, apiConfig: ApiConfig);
    private readonly csCertificateService;
    handle(request: GetPublicKeyRequest): Observable<GetPublicKeyResponse>;
    private updatePublicKey;
    private insertPublicKey;
    private fetchFromServer;
}
