import { TransferContentContext } from '../transfer-content-handler';
import { FileService } from '../../../util/file/def/file-service';
import { getSdkPlatform } from '../../../util/platform/platform-util';
import { Path } from '../../../util/file/util/path';
import { defer, Observable } from 'rxjs';

export class ValidateDestinationFolder {
    constructor(private fileService: FileService) {
    }

    execute(context: TransferContentContext): Observable<TransferContentContext> {
        return defer(async () => {
            context.destinationFolder = await this.validate(context.destinationFolder!).then(async (destination: string) => {
                return await this.createDirectory(destination);
            });
            return context;
        });
    }

    private validate(destinationDirectory: string): Promise<string> {
        if (getSdkPlatform() === 'capacitor') {
            // Normalize once here so both canWrite() and the createDirectory() call chained
            // after it operate on a full file:// URI, which @capacitor/filesystem requires
            // when no `directory` option is given.
            destinationDirectory = Path.ensureFileUri(destinationDirectory);
        }
        return this.canWrite(destinationDirectory).then(() => {
            if (!destinationDirectory.endsWith('content/')) {
                destinationDirectory = destinationDirectory.concat('content');
            }
            return destinationDirectory;
        }).catch(() => {
            throw Error('Destination is not writable');
        });
    }

    private async createDirectory(directory: string): Promise<string> {
        try {
            const entry = await this.fileService.exists(directory);
            if (!entry.nativeURL) {
                throw new Error('Directory entry does not have a valid URL');
            }
            return entry.nativeURL;
        } catch {
            const directoryEntry = await this.fileService.createDir(directory, false).catch((e) => { throw new Error(e); });
            return directoryEntry.nativeURL;
        }
    }

    private async canWrite(directory: string): Promise<undefined> {
        if (getSdkPlatform() === 'capacitor') {
            // No direct canWrite() in @capacitor/filesystem; createDir() is idempotent
            // (no-op if the directory already exists) and doubles as a real writability probe.
            await this.fileService.createDir(directory, false);
            return undefined;
        }
        return new Promise<undefined>((resolve: (value: undefined) => void, reject) => {
            sbutility.canWrite(directory, () => {
                resolve(undefined);
            }, (e) => {
                reject(e);
            });
        });
    }
}
