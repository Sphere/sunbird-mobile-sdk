import {MoveContentResponse, MoveContentStatus, TransferContentContext} from '../transfer-content-handler';
import {ContentEntry} from '../../../content/db/schema';
import {ExistingContentAction} from '../..';
import {EventsBusService} from '../../../events-bus';
import COLUMN_NAME_IDENTIFIER = ContentEntry.COLUMN_NAME_IDENTIFIER;
import COLUMN_NAME_PATH = ContentEntry.COLUMN_NAME_PATH;
import {ArrayUtil} from '../../../util/array-util';
import {defer, Observable} from 'rxjs';
import {FileService} from '../../../util/file/def/file-service';
import {Path} from '../../../util/file/util/path';
import {getSdkPlatform} from '../../../util/platform/platform-util';
import {Filesystem} from '@capacitor/filesystem';

export class DeleteSourceFolder {
    constructor(private eventsBusService: EventsBusService, private fileService: FileService) {
    }

    execute(context: TransferContentContext): Observable<TransferContentContext> {
        return defer(async () => {
            for (let i = 0; i < context.contentsInSource!.length; i++) {
                const content = context.contentsInSource![i];
                const moveContentResponse = context.duplicateContents!.find((m: MoveContentResponse) =>
                    m.identifier === content[COLUMN_NAME_IDENTIFIER]
                );
                const tempDestination = context.destinationFolder!.concat('temp', '/');
                if (!moveContentResponse || ArrayUtil.isEmpty(context.duplicateContents!)) {
                    try {
                        await this.copyFolder(
                            tempDestination.concat(content[COLUMN_NAME_IDENTIFIER]),
                            context.destinationFolder! + content[COLUMN_NAME_IDENTIFIER]
                        );
                        await this.deleteFolder(tempDestination.concat(content[COLUMN_NAME_IDENTIFIER]));
                        await this.deleteFolder(content[COLUMN_NAME_PATH]!);
                        if (i === (context.contentsInSource!.length - 1)) {
                            await this.deleteFolder(tempDestination);
                        }
                    } catch (e) {
                    }
                    continue;
                }

                if (!context.existingContentAction) {
                    continue;
                }

                if (moveContentResponse.status === MoveContentStatus.SAME_VERSION_IN_BOTH) {
                    continue;
                }

                switch (context.existingContentAction) {
                    case ExistingContentAction.KEEP_HIGER_VERSION:
                        if (moveContentResponse.status === MoveContentStatus.HIGHER_VERSION_IN_DESTINATION) {
                            break;
                        }
                        await this.removeSourceAndDestination(context, content, moveContentResponse);
                        break;
                    case ExistingContentAction.KEEP_LOWER_VERSION:
                        if (moveContentResponse.status === MoveContentStatus.LOWER_VERSION_IN_DESTINATION) {
                            break;
                        }
                        await this.removeSourceAndDestination(context, content, moveContentResponse);
                        break;
                    case ExistingContentAction.KEEP_SOURCE:
                        await this.removeSourceAndDestination(context, content, moveContentResponse);
                        break;
                    case ExistingContentAction.IGNORE:
                    case ExistingContentAction.KEEP_DESTINATION:
                }
                if (i === (context.contentsInSource!.length - 1)) {
                    await this.deleteFolder(tempDestination);
                }

            }

            return context;
        });
    }

    private async deleteFolder(deletedirectory: string): Promise<undefined> {
        if (!deletedirectory) {
            return;
        }
        if (getSdkPlatform() === 'capacitor') {
            await this.fileService.removeRecursively(Path.ensureFileUri(deletedirectory));
            return undefined;
        }
        return new Promise<undefined>((resolve, reject) => {
            let res;
            sbutility.rm(deletedirectory, '', () => {
                resolve(res);
            }, (e) => {
                reject(e);
            });
        });
    }

    private async copyFolder(sourceDirectory: string, destinationDirectory: string): Promise<undefined> {
        if (!sourceDirectory || !destinationDirectory) {
            return;
        }

        if (getSdkPlatform() === 'capacitor') {
            const source = Path.ensureFileUri(sourceDirectory);
            const destination = Path.ensureFileUri(destinationDirectory);
            await this.fileService.copyDir(
                Path.dirPathFromFilePath(source), Path.fileNameFromFilePath(source),
                Path.dirPathFromFilePath(destination), Path.fileNameFromFilePath(destination)
            );
            return undefined;
        }

        return new Promise<undefined>((resolve, reject) => {
            let res;
            sbutility.copyDirectory(sourceDirectory, destinationDirectory, () => {
                resolve(res);
            }, (e) => {
                reject(e);
            });
        });
    }

    private async renameFolder(sourceDirectory: string, toDirectoryName: string): Promise<undefined> {
        if (!sourceDirectory) {
            return;
        }
        if (getSdkPlatform() === 'capacitor') {
            // Matches native FileUtil.renameTo: renames sourceDirectory/toDirectoryName to
            // sourceDirectory/toDirectoryName_temp (NOT a rename of sourceDirectory itself).
            const uriSourceDirectory = Path.ensureFileUri(sourceDirectory);
            const base = uriSourceDirectory.endsWith('/') ? uriSourceDirectory : uriSourceDirectory + '/';
            await Filesystem.rename({
                from: `${base}${toDirectoryName}`,
                to: `${base}${toDirectoryName}_temp`
            });
            return undefined;
        }
        return new Promise<undefined>((resolve, reject) => {
            let res;
            sbutility.renameDirectory(sourceDirectory, toDirectoryName, () => {
                resolve(res);
            }, (e) => {
                reject(e);
            });
        });
    }

    private async removeSourceAndDestination(context: TransferContentContext,
                                             content: ContentEntry.SchemaMap,
                                             moveContentResponse: MoveContentResponse) {
        await this.deleteFolder(context.destinationFolder!.concat(moveContentResponse.identifier, '_temp'));
        await this.deleteFolder(content[COLUMN_NAME_PATH]!);
    }
}
