import 'reflect-metadata';
import { WebviewRunnerCapacitorImpl } from './webview-runner-capacitor-impl';

// ── Mock @capgo/inappbrowser ──────────────────────────────────────────────────
const mockHandleRemove = jest.fn();
const makeHandle = () => ({ remove: mockHandleRemove });

const mockOpenWebView = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockSetUrl = jest.fn().mockResolvedValue(undefined);
const mockExecuteScript = jest.fn().mockResolvedValue(undefined);

let urlChangeCallback: ((e: { url: string }) => void) | null = null;
let closeEventCallback: (() => void) | null = null;

const mockAddListener = jest.fn().mockImplementation((event: string, cb: any) => {
    if (event === 'urlChangeEvent') { urlChangeCallback = cb; }
    if (event === 'closeEvent') { closeEventCallback = cb; }
    return Promise.resolve(makeHandle());
});

jest.mock('@capgo/inappbrowser', () => ({
    InAppBrowser: {
        openWebView: (...args: any[]) => mockOpenWebView(...args),
        close: (...args: any[]) => mockClose(...args),
        setUrl: (...args: any[]) => mockSetUrl(...args),
        executeScript: (...args: any[]) => mockExecuteScript(...args),
        addListener: (...args: any[]) => mockAddListener(...args),
    }
}));

// ── Mock @capacitor/browser ───────────────────────────────────────────────────
const mockBrowserOpen = jest.fn().mockResolvedValue(undefined);
jest.mock('@capacitor/browser', () => ({
    Browser: { open: (...args: any[]) => mockBrowserOpen(...args) }
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('WebviewRunnerCapacitorImpl', () => {
    let runner: WebviewRunnerCapacitorImpl;

    beforeEach(() => {
        jest.clearAllMocks();
        urlChangeCallback = null;
        closeEventCallback = null;
        runner = new WebviewRunnerCapacitorImpl();
    });

    // ── buildUrl ──────────────────────────────────────────────────────────────

    it('buildUrl produces correct query string', () => {
        const url = WebviewRunnerCapacitorImpl.buildUrl('https://host.com', '/path', { a: '1', b: '2' });
        expect(url).toBe('https://host.com/path?a=1&b=2');
    });

    // ── launchWebview ─────────────────────────────────────────────────────────

    it('launchWebview opens in-app browser and registers close listener', async () => {
        await runner.launchWebview({ host: 'https://host.com', path: '/login', params: {} });

        expect(mockOpenWebView).toHaveBeenCalledWith({ url: 'https://host.com/login?' });
        expect(mockAddListener).toHaveBeenCalledWith('closeEvent', expect.any(Function));
    });

    // ── closeWebview ──────────────────────────────────────────────────────────

    it('closeWebview calls InAppBrowser.close()', async () => {
        await runner.closeWebview();
        expect(mockClose).toHaveBeenCalled();
    });

    // ── resetInAppBrowserEventListeners ───────────────────────────────────────

    it('resetInAppBrowserEventListeners removes all stored handles', async () => {
        await runner.launchWebview({ host: 'https://host.com', path: '/login', params: {} });
        runner.resetInAppBrowserEventListeners();
        expect(mockHandleRemove).toHaveBeenCalled();
    });

    // ── redirectTo ────────────────────────────────────────────────────────────

    it('redirectTo calls setUrl with the built URL', async () => {
        await runner.redirectTo({ host: 'https://host.com', path: '/redirect', params: { token: 'abc' } });
        expect(mockSetUrl).toHaveBeenCalledWith({ url: 'https://host.com/redirect?token=abc' });
    });

    // ── launchCustomTab ───────────────────────────────────────────────────────

    it('launchCustomTab uses @capacitor/browser Browser.open()', async () => {
        await runner.launchCustomTab({ host: 'https://host.com', path: '/tab', params: { x: '1' }, extraParams: '' });
        expect(mockBrowserOpen).toHaveBeenCalledWith({ url: 'https://host.com/tab?x=1' });
    });

    // ── capture ───────────────────────────────────────────────────────────────
    // addListener is async — flush one microtask tick before firing events

    it('capture resolves when urlChangeEvent matches host/path/params', async () => {
        const capturePromise = runner.capture({
            host: 'https://host.com',
            path: '/oauth2callback',
            params: [{ key: 'code', resolveTo: 'authCode' }]
        });

        await Promise.resolve(); // let addListener register the callback
        expect(urlChangeCallback).not.toBeNull();
        urlChangeCallback!({ url: 'https://host.com/oauth2callback?code=ABC123&state=xyz' });

        await capturePromise;

        const captured = await runner.resolveCaptured('authCode');
        expect(captured).toBe('ABC123');
    });

    it('capture ignores URL changes that do not match', async () => {
        let resolved = false;
        const capturePromise = runner.capture({
            host: 'https://host.com',
            path: '/oauth2callback',
            params: [{ key: 'code', resolveTo: 'authCode' }]
        }).then(() => { resolved = true; });

        await Promise.resolve(); // let addListener register the callback
        urlChangeCallback!({ url: 'https://other.com/page' });
        await new Promise(r => setTimeout(r, 10));
        expect(resolved).toBe(false);

        urlChangeCallback!({ url: 'https://host.com/oauth2callback?code=XYZ' });
        await capturePromise;
        expect(resolved).toBe(true);
    });

    it('capture ignores malformed URLs without throwing', async () => {
        const capturePromise = runner.capture({
            host: 'https://host.com',
            path: '/callback',
            params: [{ key: 'code', resolveTo: 'authCode' }]
        });

        await Promise.resolve(); // let addListener register the callback
        urlChangeCallback!({ url: 'not-a-valid-url' });
        urlChangeCallback!({ url: 'https://host.com/callback?code=OK' });

        await capturePromise;
        expect(await runner.resolveCaptured('authCode')).toBe('OK');
    });

    // ── success / fail / clearCapture ─────────────────────────────────────────

    it('success returns captured params', async () => {
        const capturePromise = runner.capture({
            host: 'https://host.com', path: '/cb', params: [{ key: 'token', resolveTo: 'accessToken' }]
        });
        await Promise.resolve();
        urlChangeCallback!({ url: 'https://host.com/cb?token=mytoken' });
        await capturePromise;

        const result = await runner.success();
        expect(result).toEqual(expect.objectContaining({ accessToken: 'mytoken' }));
    });

    it('clearCapture empties the captured map', async () => {
        const capturePromise = runner.capture({
            host: 'https://host.com', path: '/cb', params: [{ key: 'token', resolveTo: 'accessToken' }]
        });
        await Promise.resolve();
        urlChangeCallback!({ url: 'https://host.com/cb?token=mytoken' });
        await capturePromise;

        await runner.clearCapture();
        await expect(runner.resolveCaptured('accessToken')).rejects.toThrow();
    });
});
