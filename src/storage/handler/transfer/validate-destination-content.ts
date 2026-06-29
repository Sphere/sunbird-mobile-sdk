import {FileService} from '../../../util/file/def/file-service';
import {AppConfig} from '../../../api/config/app-config';
import {Manifest, TransferContentContext} from '../transfer-content-handler';
import {ContentUtil} from '../../../content/util/content-util';
import {Entry} from '../../../util/file';
import {FileName, Visibility} from '../../../content';
import {defer, Observable} from 'rxjs';

export class ValidateDestinationContent {

    constructor(private fileService: FileService,
                private appConfig: AppConfig) {
    }

    execute(context: TransferContentContext): Observable<TransferContentContext> {
        return defer(async () => {
            context.validContentIdsInDestination =
                await this.getSubdirectoriesEntries(context.destinationFolder!)
                    .then((entries) => this.extractValidContentIdsInDestination(entries));
            return context;
        });
    }

    private async getSubdirectoriesEntries(directoryPath: string): Promise<any> {
        return await this.fileService.listDir(directoryPath.replace(/\/$/, ''))
            .then(entries => entries
                .filter(e => e.isDirectory)
            ).catch(() => { throw new Error('Error listing directory') });
    }

    private async extractValidContentIdsInDestination(entries: Entry[]) {
        const validContentIdsInDestination: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory) {
                let manifest: Manifest | undefined;
                try {
                    manifest = await this.extractManifest(entry);
                } catch (e) {
                }

                if (!manifest) {
                    continue;
                }
                const items = manifest.archive.items;
                for (const item of items) {
                    if (ContentUtil.readVisibility(item) === Visibility.PARENT) {
                        continue;
                    }

                    if (ContentUtil.isDraftContent(item.status) && ContentUtil.isExpired(item.expires)) {
                        continue;
                    }
                    validContentIdsInDestination.push(entry.name);
                }
            }
        }

        return validContentIdsInDestination;
    }

    private async extractManifest(directoryEntry: Entry): Promise<Manifest> {
        const manifestStringified = await this.fileService.readAsText(
            directoryEntry.nativeURL, FileName.MANIFEST.valueOf()).catch(() => { throw new Error('Manifest file not found') });
        return JSON.parse(manifestStringified);
    }
    // TODO: Swayangjit
    // private validateManifest(manifest: Manifest): boolean {
    //     return manifest.version !== '1.0' &&
    //         !!manifest['archive'] &&
    //         !!manifest['archive']['items'] &&
    //         !!manifest['archive']['items'].length &&
    //         this.validateItems(manifest['archive']['items']);
    // }

    // private validateItems(items: any[]): boolean {
    //     return items.every((item) =>
    //         ContentUtil.readVisibility(item) === Visibility.PARENT ||
    //         !ContentUtil.isCompatible(this.appConfig, ContentUtil.readCompatibilityLevel(item))
    //     ) && items.every((item) => ContentUtil.isDraftContent(item.status) && ContentUtil.isExpired(item.expires));
    // }
}
