import { DeviceInfo, DeviceSpec, StorageVolume } from '..';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { injectable } from 'inversify';
import { StorageDestination } from '../../../storage';
import { Device } from '@capacitor/device';
import { getDeviceId } from '../../platform/platform-util';

@injectable()
export class CapacitorDeviceInfoImpl implements DeviceInfo {

    getDeviceID(): string {
        return getDeviceId();
    }

    getDeviceSpec(): Observable<DeviceSpec> {
        return from(Device.getInfo()).pipe(
            map((info) => ({
                id: getDeviceId(),
                os: info.osVersion || '',
                make: info.manufacturer || '',
                idisk: 0,
                edisk: 0,
                scrn: 0,
                mem: 0,
                cpu: '',
                sims: 0,
                camera: '',
                cap: []
            } as DeviceSpec))
        );
    }

    getAvailableInternalMemorySize(): Observable<string> {
        // @capacitor/device v5 does not expose memory — return 0 as string
        return of('0');
    }

    getStorageVolumes(): Observable<StorageVolume[]> {
        return of([{
            storageDestination: StorageDestination.INTERNAL_STORAGE,
            info: {
                availableSize: 0,
                totalSize: '0',
                state: 'mounted',
                path: '',
                contentStoragePath: '',
                isRemovable: false
            }
        }]);
    }

    isKeyboardShown(): Observable<boolean> {
        return new Observable<boolean>((observer) => {
            const show = () => observer.next(true);
            const hide = () => observer.next(false);
            window.addEventListener('keyboardWillShow', show);
            window.addEventListener('keyboardWillHide', hide);
            return () => {
                window.removeEventListener('keyboardWillShow', show);
                window.removeEventListener('keyboardWillHide', hide);
            };
        });
    }
}
