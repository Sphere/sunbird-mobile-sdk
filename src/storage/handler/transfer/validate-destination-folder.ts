import { TransferContentContext } from '../transfer-content-handler';
import { FileService } from '../../../util/file/def/file-service';
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
        return new Promise<undefined>((resolve, reject) => {
            sbutility.canWrite(directory, () => {
                resolve();
            }, (e) => {
                reject(e);
            });
        });
    }
}
