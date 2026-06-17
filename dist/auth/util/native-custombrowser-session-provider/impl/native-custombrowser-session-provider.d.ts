import { SessionProvider } from '../../../def/session-provider';
import { WebviewSessionProviderConfig } from '../../webview-session-provider/def/webview-session-provider-config';
import { WebviewRunner } from '../../webview-session-provider/def/webview-runner';
export declare class NativeCustomBrowserSessionProvider implements SessionProvider {
    private loginConfig;
    private customWebViewConfig?;
    private static readonly LOGIN_API_ENDPOINT;
    private readonly webviewRunner;
    private readonly telemetryService;
    private apiConfig;
    private static parseAccessToken;
    constructor(loginConfig: WebviewSessionProviderConfig, customWebViewConfig?: any, webviewRunner?: WebviewRunner);
    protected buildGoogleTargetUrl(redirecturl: {
        [key: string]: string;
    }, extras: {
        [key: string]: string;
    }): URL;
    provide(): Promise<any>;
}
