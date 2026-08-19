import { DeviceInfo, DeviceSpec, StorageVolume } from '..';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { injectable } from 'inversify';
import { StorageDestination } from '../../../storage';
import { Device } from '@capacitor/device';
import { getDeviceId, getPlatform } from '../../platform/platform-util';
import { FilePaths } from '../../../services/file-path/file-path.enum';
import { FilePathService } from '../../../services/file-path/file-path.service';

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
        // contentStoragePath is NOT cosmetic: StorageServiceImpl.getStorageDestinationDirectoryPath()
        // returns it, and host apps pass that as destinationFolder for every content download/import
        // (tmp/, content/, Download/ are all built on top of it). The Cordova native equivalent
        // (sb-cordova-plugin-utility StorageUtil.getAppStorageArea) returns
        // "file://" + getExternalFilesDir(...) + "/" — FilePathService(EXTERNAL) yields the exact
        // same URI via Capacitor's Directory.External. An empty string here sends imports to the
        // filesystem root (file:///tmp/...) where mkdir fails.
        const storagePath = getPlatform() === 'ios' ? FilePaths.DOCUMENTS : FilePaths.EXTERNAL;
        return from(FilePathService.getFilePath(storagePath)).pipe(
            // Temporary diagnostic — this path becomes destinationFolder for all content imports.
            map((p) => { console.log('[getStorageVolumes] contentStoragePath:', p); return p; }),
            map((contentStoragePath) => [{
                storageDestination: StorageDestination.INTERNAL_STORAGE,
                info: {
                    // Sizes not exposed by @capacitor/filesystem — cosmetic-only fields, left stubbed.
                    availableSize: 0,
                    totalSize: '0',
                    state: 'mounted',
                    path: contentStoragePath,
                    contentStoragePath,
                    isRemovable: false
                }
            }])
        );
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
