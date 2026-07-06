import { WebviewRunner } from '../def/webview-runner';
import * as qs from 'qs';
import { zip, race } from 'rxjs';
import { take, mapTo } from 'rxjs/operators';
import { InAppBrowser } from '@capgo/inappbrowser';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';

export class WebviewRunnerCapacitorImpl implements WebviewRunner {
    private extras: { [key: string]: string } = {};
    private captured: { [key: string]: string | any } = {};

    private urlChangeListeners: PluginListenerHandle[] = [];
    private exitListeners: PluginListenerHandle[] = [];

    static buildUrl(host: string, path: string, params: { [p: string]: string }) {
        return `${host}${path}?${qs.stringify(params)}`;
    }

    public resetInAppBrowserEventListeners() {
        this.urlChangeListeners.forEach(h => h.remove());
        this.urlChangeListeners = [];
        this.exitListeners.forEach(h => h.remove());
        this.exitListeners = [];
    }

    async launchWebview({ host, path, params }: { host: string; path: string; params: { [p: string]: string } }): Promise<void> {
        const url = WebviewRunnerCapacitorImpl.buildUrl(host, path, params);
        await InAppBrowser.openWebView({ url });

        const onExit = await InAppBrowser.addListener('closeEvent', () => {
            this.resetInAppBrowserEventListeners();
        });
        this.exitListeners.push(onExit);
    }

    async closeWebview(): Promise<void> {
        await InAppBrowser.close();
    }

    any<T>(...args: Promise<T>[]): Promise<T> {
        return race(...args).pipe(take(1)).toPromise();
    }

    all(...args: Promise<any>[]): Promise<void> {
        return zip(...args).pipe(take(1), mapTo(undefined)).toPromise();
    }

    launchCustomTab({ host, path, params }: { host: string; path: string; params: { [p: string]: string }; extraParams: string }): Promise<void> {
        const url = WebviewRunnerCapacitorImpl.buildUrl(host, path, params);
        return Browser.open({ url });
    }

    capture({ host, path, params }: { host: string; path: string; params: { key: string; resolveTo: string; match?: string; exists?: 'true' | 'false' }[] }): Promise<void> {
        const isHostMatching = (url: URL) => url.origin === host;
        const isPathMatching = (url: URL) => url.pathname === path;
        const areParamsMatching = (url: URL) => params.every(param => {
            if (param.exists === 'false') {
                return !url.searchParams.has(param.key);
            }
            if (param.match) {
                return url.searchParams.has(param.key) && url.searchParams.get(param.key) === param.match;
            }
            return url.searchParams.has(param.key);
        });

        return new Promise(async (resolve) => {
            const handle = await InAppBrowser.addListener('urlChangeEvent', (event) => {
                if (!event.url) { return; }
                try {
                    const url = new URL(event.url);
                    if (isHostMatching(url) && isPathMatching(url) && areParamsMatching(url)) {
                        this.captured = {
                            ...this.captured,
                            ...params.reduce<{ [key: string]: string }>((acc, p) => {
                                acc[p.resolveTo] = url.searchParams.get(p.key)!;
                                return acc;
                            }, {}),
                        };
                        this.extras = {};
                        params.map(p => p.key).forEach(param => url.searchParams.delete(param));
                        url.searchParams['forEach']((value, key) => {
                            this.extras[key] = value;
                        });
                        const idx = this.urlChangeListeners.indexOf(handle);
                        if (idx > -1) { this.urlChangeListeners.splice(idx, 1); }
                        handle.remove();
                        resolve();
                    }
                } catch (_) { /* malformed URL, keep listening */ }
            });
            this.urlChangeListeners.push(handle);
        });
    }

    async resolveCaptured(param: string): Promise<string> {
        if (!this.captured[param]) {
            throw new Error(`${param} was not captured`);
        }
        return this.captured[param];
    }

    async clearCapture(): Promise<void> {
        this.captured = {};
    }

    async redirectTo({ host, path, params }: { host: string; path: string; params: { [p: string]: string } }): Promise<void> {
        await InAppBrowser.setUrl({ url: WebviewRunnerCapacitorImpl.buildUrl(host, path, params) });
    }

    async success(): Promise<{ [p: string]: string }> {
        return { ...this.captured };
    }

    async fail(): Promise<{ [p: string]: string }> {
        throw { ...this.captured };
    }

    async getCaptureExtras(): Promise<{ [p: string]: string }> {
        return { ...this.extras };
    }
}
