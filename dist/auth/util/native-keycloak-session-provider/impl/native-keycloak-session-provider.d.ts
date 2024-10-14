import { SessionProvider } from '../../../def/session-provider';
import { ApiConfig } from '../../../../api';
import { WebviewSessionProviderConfig } from '../../webview-session-provider/def/webview-session-provider-config';
export interface NativeKeycloakTokens {
    username: string;
    password: string;
}
export declare class NativeKeycloakSessionProvider implements SessionProvider {
    private loginConfig;
    private nativeKeycloakTokenProvider;
    private static readonly LOGIN_API_ENDPOINT;
    private apiService;
    protected apiConfig: ApiConfig;
    private static parseAccessToken;
    constructor(loginConfig: WebviewSessionProviderConfig, nativeKeycloakTokenProvider: NativeKeycloakTokens);
    provide(): Promise<any>;
    private callKeycloakNativeLogin;
}
