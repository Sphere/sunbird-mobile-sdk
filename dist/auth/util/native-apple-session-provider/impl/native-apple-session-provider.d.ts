import { SessionProvider } from '../../../def/session-provider';
import { OAuthSession } from '../../../def/o-auth-session';
export interface NativeAppleTokens {
    email: string;
    authorizationCode: string;
    state: string;
    identityToken: string;
    fullName: {
        nickname: string;
        phoneticRepresentation: string;
        middleName: string;
        familyName: string;
        namePrefix: string;
        givenName: string;
        nameSuffix: string;
    };
    user: string;
}
export declare class NativeAppleSessionProvider implements SessionProvider {
    private nativeAppleTokenProvider;
    private static readonly LOGIN_API_ENDPOINT;
    private apiService;
    private static parseAccessToken;
    constructor(nativeAppleTokenProvider: () => Promise<NativeAppleTokens>);
    provide(): Promise<OAuthSession>;
    private callAppleNativeLogin;
}
