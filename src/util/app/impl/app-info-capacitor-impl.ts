import { AppInfo } from '..';
import { inject, injectable } from 'inversify';
import { InjectionTokens } from '../../../injection-tokens';
import { SharedPreferences } from '../../shared-preferences';
import { AppInfoKeys } from '../../../preference-keys';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { App } from '@capacitor/app';
import { CsModule } from '@project-sunbird/client-services';

@injectable()
export class AppInfoCapacitorImpl implements AppInfo {

    private versionName: string = '';
    private appName: string = '';

    constructor(
        @inject(InjectionTokens.SHARED_PREFERENCES) private sharedPreferences: SharedPreferences
    ) {}

    async init(): Promise<void> {
        await this.setFirstAccessTimestamp();
        const info = await App.getInfo();
        this.appName = info.name;
        this.versionName = `${info.version}-${info.build}`;

        if (CsModule.instance.isInitialised) {
            CsModule.instance.updateConfig({
                ...CsModule.instance.config,
                core: {
                    ...CsModule.instance.config.core,
                    global: {
                        ...CsModule.instance.config.core.global,
                        appVersion: this.versionName
                    }
                }
            });
        }
    }

    getAppName(): string {
        return this.appName;
    }

    getVersionName(): string {
        return this.versionName;
    }

    getFirstAccessTimestamp(): Observable<string> {
        return this.sharedPreferences.getString(AppInfoKeys.KEY_FIRST_ACCESS_TIMESTAMP).pipe(
            map(ts => ts!)
        );
    }

    private async setFirstAccessTimestamp(): Promise<void> {
        const timestamp = await this.sharedPreferences.getString(AppInfoKeys.KEY_FIRST_ACCESS_TIMESTAMP).toPromise();
        if (!timestamp) {
            await this.sharedPreferences.putString(AppInfoKeys.KEY_FIRST_ACCESS_TIMESTAMP, Date.now() + '').toPromise();
        }
    }
}
