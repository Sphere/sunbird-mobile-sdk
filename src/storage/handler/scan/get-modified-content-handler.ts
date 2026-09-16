import {FileService} from '../../../util/file/def/file-service';
import {ScanContentContext} from '../../def/scan-requests';
import {DbService} from '../../../db';
import {ContentEntry} from '../../../content/db/schema';
import {ContentUtil} from '../../../content/util/content-util';
import {ArrayUtil} from '../../../util/array-util';
import {defer, Observable} from 'rxjs';
import {map, mapTo} from 'rxjs/operators';
import { getPlatform } from '../../../util/platform/platform-util';

export class GetModifiedContentHandler {
    constructor(private fileService: FileService,
                private dbService: DbService) {

    }

    public execute(context: ScanContentContext): Observable<ScanContentContext> {
        return defer(async () => {
            const dbContentIdentifiers = await this.getContentsInDb();
            if (context.currentStoragePath) {
                let destination = ContentUtil.getContentRootDir(context.currentStoragePath).concat('/');
                if(getPlatform() === "ios") {
                    destination = "file://"+destination;
                }
                const folderList = await this.getFolderList(destination);
                if (folderList === null) {
                    // The content-root listing failed (missing/not-yet-ready/permission error) -
                    // that is inconclusive, not proof every downloaded content item was deleted
                    // from storage. Confirmed on-device: this null case was previously collapsed
                    // into an empty folder list, which made every restart mark ALL downloaded
                    // content as deleted (visibility flipped to Parent, content_state downgraded
                    // to ONLY_SPINE) even though the files were still on disk. Leave both lists
                    // empty so a failed scan never gets treated as a deletion signal.
                    context.newlyAddedIdentifiers = [];
                    context.deletedIdentifiers = [];
                } else {
                    context.newlyAddedIdentifiers = await this.getNewlyAddedContents(folderList, dbContentIdentifiers);
                    context.deletedIdentifiers = await this.getDeletedContents(folderList, dbContentIdentifiers);
                }
            } else {
                // No resolved storage path is the same "inconclusive" case as above - not proof
                // of empty storage. Previously this marked every downloaded content item as
                // deleted whenever the storage path hadn't resolved yet on this cold-start pass.
                context.newlyAddedIdentifiers = [];
                context.deletedIdentifiers = [];
            }
        }).pipe(
            mapTo(context)
        );
    }

    private async doesDestinationStorageExist(destination: string): Promise<boolean> {
        return await this.fileService.exists(destination).then((entry: any) => {
            return true;
        }).catch(() => {
            return false;
        });
    }

    private async getContentsInDb(): Promise<string[]> {

        return this.dbService.execute(ContentUtil.getFindAllContentsQuery()).pipe(
            map((contentsInDb: ContentEntry.SchemaMap[]) => {
                const dbContentIdentifiers: string[] = contentsInDb
                    .filter((contentInDb) => {
                        return contentInDb[ContentEntry.COLUMN_NAME_CONTENT_TYPE].toLowerCase() !== 'textbookunit';
                    }).map((contentInDb) => {
                        return contentInDb[ContentEntry.COLUMN_NAME_IDENTIFIER];
                    });
                return dbContentIdentifiers;
            })
        ).toPromise();
    }

    private getNewlyAddedContents(folderList: string[], contentIdentifiers: string[]): string[] {
        return folderList.filter(element => !ArrayUtil.contains(contentIdentifiers, element));
    }

    private getDeletedContents(folderList: string[], contentIdentifiers: string[]): string[] {
        return contentIdentifiers.filter(element => !ArrayUtil.contains(folderList, element));
    }

    private async getFolderList(destination: string): Promise<string[] | null> {
        return await this.fileService.listDir(destination.replace(/\/$/, ''))
            .then((entries: any) => {
                const folderList: string[] = entries.map((entry) => {
                    return entry.name;
                });
                return folderList;
            }).catch(() => {
                // listDir() throws when the directory can't be read (missing, not yet mounted,
                // permission error) - distinct from a genuinely empty directory, which resolves
                // successfully with an empty array. Returning null (not []) here lets execute()
                // tell "listing failed" apart from "storage is actually empty".
                return null;
            });
    }
}
