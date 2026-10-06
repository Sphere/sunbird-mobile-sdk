import {SunbirdSdk} from '../../../../sdk';
import {ApiService} from '../../../../api';
import {EventsBusService} from '../../../../events-bus';
import {TelemetryService} from '../../../../telemetry';
import {WebviewRunner} from '../def/webview-runner';
import {of, throwError} from 'rxjs';
import {WebviewStateSessionProvider} from './webview-state-session-provider';
import {WebviewStateSessionProviderConfig} from '../def/webview-state-session-provider-config';
import {WebviewSessionProviderConfig} from '../def/webview-session-provider-config';
import {SignInError} from '../../../errors/sign-in-error';
import {InterruptError} from '../errors/interrupt-error';
import {WebviewRunnerError} from '../errors/webview-runner-error';
import {AuthEventType} from '../../../def/auth-event';

const b64url = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const SAMPLE_ACCESS_TOKEN = b64url({alg: 'RS256'}) + '.' + b64url({sub: 'f:abc:USER_ID', exp: 1000}) + '.sig';

const mockApiService: Partial<ApiService> = {};
const mockEventsBusService: Partial<EventsBusService> = {};
const mockTelemetryService: Partial<TelemetryService> = {};
const mockSunbirdSdk: Partial<SunbirdSdk> = {
    sdkConfig: {
        apiConfig: {
            host: 'https://staging.ntp.net.in',
            user_authentication: {
                redirectUrl: 'https://staging.ntp.net.in/oauth2callback',
                authUrl: '/auth/realms/sunbird/protocol/openid-connect',
                autoMergeApiPath: '/migrate/user/account'
            }
        }
    },
    apiService: mockApiService,
    eventsBusService: mockEventsBusService,
    telemetryService: mockTelemetryService
} as any;
SunbirdSdk['_instance'] = mockSunbirdSdk as SunbirdSdk;

const buildStateConfig = (type: string): WebviewStateSessionProviderConfig => ({
    context: 'state',
    target: {
        host: 'https://staging.ntp.net.in',
        path: '/sso/sign-in',
        params: [{key: 'redirect_uri', value: 'https://staging.ntp.net.in/oauth2callback'}]
    },
    return: [{
        type,
        when: {
            host: 'https://staging.ntp.net.in',
            path: '/sso/sign-in/success',
            params: [{key: 'id', resolveTo: 'id'}]
        }
    }]
});

const buildAutoMergeConfig = (type: string): WebviewSessionProviderConfig => ({
    context: 'migrate',
    target: {
        host: 'https://staging.ntp.net.in',
        path: '/auth/realms/sunbird/protocol/openid-connect/auth',
        params: [{key: 'automerge', value: '1'}]
    },
    return: [{
        type,
        when: {
            host: 'https://staging.ntp.net.in',
            path: '/oauth2callback',
            params: [{key: 'code', resolveTo: 'code'}]
        }
    }]
} as any);

describe('WebviewStateSessionProvider', () => {
    const mockWebviewRunner: Partial<WebviewRunner> = {};

    beforeEach(() => {
        jest.restoreAllMocks();
        mockTelemetryService.buildContext = jest.fn(() => of({pdata: {id: 'staging.app', pid: 'sunbird.app', ver: '1.0'}})) as any;
        mockEventsBusService.emit = jest.fn();
        mockWebviewRunner.launchWebview = jest.fn(() => Promise.resolve());
        mockWebviewRunner.redirectTo = jest.fn(() => Promise.resolve());
        mockWebviewRunner.capture = jest.fn(() => Promise.resolve());
        mockWebviewRunner.closeWebview = jest.fn(() => Promise.resolve());
        mockWebviewRunner.clearCapture = jest.fn(() => Promise.resolve());
        mockWebviewRunner.resetInAppBrowserEventListeners = jest.fn();
        mockWebviewRunner.any = jest.fn((...ps: Promise<any>[]) => ps[0]) as any;
    });

    it('should be able to create an instance with default runner', () => {
        const provider = new WebviewStateSessionProvider(buildStateConfig('state'), buildAutoMergeConfig('password'));
        expect(provider).toBeInstanceOf(WebviewStateSessionProvider);
        expect(provider['webViewRunner']).toBeDefined();
    });

    it('should attach pdata and launch webview with target params', (done) => {
        const config = buildStateConfig('unknown');
        mockWebviewRunner.any = jest.fn(() => Promise.resolve({access_token: 'a', refresh_token: 'r', userToken: 'u'})) as any;
        const provider = new WebviewStateSessionProvider(config, buildAutoMergeConfig('password'), mockWebviewRunner as WebviewRunner);

        provider.provide().then((session) => {
            expect(mockWebviewRunner.launchWebview).toHaveBeenCalledWith({
                host: 'https://staging.ntp.net.in',
                path: '/sso/sign-in',
                params: {
                    redirect_uri: 'https://staging.ntp.net.in/oauth2callback',
                    pdata: JSON.stringify({id: 'staging.app', pid: 'sunbird.app', ver: '1.0'})
                }
            });
            expect(mockWebviewRunner.any).toHaveBeenCalledWith();
            expect(session.userToken).toEqual('u');
            done();
        });
    });

    describe('state', () => {
        it('should resolve session from sso create session api', (done) => {
            mockWebviewRunner.success = jest.fn(() => Promise.resolve({id: 'SOME_ID'}));
            mockApiService.fetch = jest.fn(() => of({body: {access_token: SAMPLE_ACCESS_TOKEN, refresh_token: 'REFRESH'}})) as any;
            const provider = new WebviewStateSessionProvider(buildStateConfig('state'), buildAutoMergeConfig('password'), mockWebviewRunner as WebviewRunner);

            provider.provide().then((session) => {
                expect(mockWebviewRunner.closeWebview).toHaveBeenCalled();
                expect((mockApiService.fetch as jest.Mock).mock.calls[0][0].path).toEqual('/v1/sso/create/session?id=SOME_ID');
                expect(session).toEqual({
                    access_token: SAMPLE_ACCESS_TOKEN,
                    refresh_token: 'REFRESH',
                    accessTokenExpiresOn: 1000000,
                    userToken: 'USER_ID'
                });
                done();
            });
        });

        it('should throw SignInError when api response has no tokens', (done) => {
            mockWebviewRunner.success = jest.fn(() => Promise.resolve({id: 'SOME_ID'}));
            mockApiService.fetch = jest.fn(() => of({body: {}})) as any;
            const provider = new WebviewStateSessionProvider(buildStateConfig('state'), buildAutoMergeConfig('password'), mockWebviewRunner as WebviewRunner);

            provider.provide().catch((e) => {
                expect(e instanceof SignInError).toBeTruthy();
                expect(e.message).toEqual('Server Error');
                done();
            });
        });

        it('should throw SignInError when api fails', (done) => {
            mockWebviewRunner.success = jest.fn(() => Promise.resolve({id: 'SOME_ID'}));
            mockApiService.fetch = jest.fn(() => throwError(new Error('network'))) as any;
            const provider = new WebviewStateSessionProvider(buildStateConfig('state'), buildAutoMergeConfig('password'), mockWebviewRunner as WebviewRunner);

            provider.provide().catch((e) => {
                expect(e instanceof SignInError).toBeTruthy();
                done();
            });
        });
    });

    describe('state-error', () => {
        it('should throw SignInError with captured error_message', (done) => {
            mockWebviewRunner.resolveCaptured = jest.fn(() => Promise.resolve('SOME_ERROR'));
            const provider = new WebviewStateSessionProvider(buildStateConfig('state-error'), buildAutoMergeConfig('password'), mockWebviewRunner as WebviewRunner);

            provider.provide().catch((e) => {
                expect(mockWebviewRunner.closeWebview).toHaveBeenCalled();
                expect(mockWebviewRunner.resolveCaptured).toHaveBeenCalledWith('error_message');
                expect(e instanceof SignInError).toBeTruthy();
                expect(e.message).toEqual('SOME_ERROR');
                done();
            });
        });

        it('should throw SignInError "Server Error" when error_message is not captured', (done) => {
            mockWebviewRunner.resolveCaptured = jest.fn(() => Promise.reject(new Error('no param')));
            const provider = new WebviewStateSessionProvider(buildStateConfig('state-error'), buildAutoMergeConfig('password'), mockWebviewRunner as WebviewRunner);

            provider.provide().catch((e) => {
                expect(e instanceof SignInError).toBeTruthy();
                expect(e.message).toEqual('Server Error');
                done();
            });
        });
    });

    describe('migrate', () => {
        it('should delegate to auto merge session provider and emit AUTO_MIGRATE_SUCCESS', (done) => {
            mockWebviewRunner.success = jest.fn()
                .mockImplementationOnce(() => Promise.resolve({payload: 'SOME_PAYLOAD'}))
                .mockImplementationOnce(() => Promise.resolve({code: 'SOME_CODE'})) as any;
            mockApiService.fetch = jest.fn()
                .mockImplementationOnce(() => of({body: {access_token: SAMPLE_ACCESS_TOKEN, refresh_token: 'REFRESH'}}))
                .mockImplementationOnce(() => of({body: {}})) as any;
            const autoMergeConfig = buildAutoMergeConfig('password');
            const provider = new WebviewStateSessionProvider(buildStateConfig('migrate'), autoMergeConfig, mockWebviewRunner as WebviewRunner);

            provider.provide().then((session) => {
                expect(mockWebviewRunner.resetInAppBrowserEventListeners).toHaveBeenCalled();
                expect(mockWebviewRunner.clearCapture).toHaveBeenCalled();
                expect(mockWebviewRunner.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
                    params: expect.objectContaining({payload: 'SOME_PAYLOAD', automerge: '1'})
                }));
                const mergeRequest = (mockApiService.fetch as jest.Mock).mock.calls[1][0];
                expect(mergeRequest.path).toEqual('/migrate/user/account');
                expect(mergeRequest.headers['x-authenticated-user-data']).toEqual('SOME_PAYLOAD');
                expect(mockEventsBusService.emit).toHaveBeenCalledWith(expect.objectContaining({
                    event: {type: AuthEventType.AUTO_MIGRATE_SUCCESS, payload: undefined}
                }));
                expect(session.userToken).toEqual('USER_ID');
                done();
            });
        });
    });
});

describe('auth errors', () => {
    it('SignInError should carry message and code', () => {
        const e = new SignInError('msg');
        expect(e instanceof SignInError).toBeTruthy();
        expect(e.message).toEqual('msg');
        expect(e.code).toEqual('SIGN_IN_ERROR');
    });

    it('InterruptError should carry message and code', () => {
        const e = new InterruptError('interrupted');
        expect(e instanceof WebviewRunnerError).toBeTruthy();
        expect(e.message).toEqual('interrupted');
        expect(e.code).toEqual('INTERRUPT_ERROR');
    });
});
