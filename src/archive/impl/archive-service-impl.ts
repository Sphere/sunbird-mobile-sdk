import {
    ArchiveExportProgress,
    ArchiveExportRequest, ArchiveImportProgress,
    ArchiveImportRequest,
    ArchiveObjectType,
    ArchiveObjectExportProgress,
    ArchiveService, ArchiveObjectImportProgress,
} from '..';
import { combineLatest, from, Observable, concat, defer, throwError, of } from 'rxjs';
import { catchError, concatMap, filter, map, mapTo, mergeMap, tap } from 'rxjs/operators';
import { UniqueId } from '../../db/util/unique-id';
import { FileService } from '../../util/file/def/file-service';
import { TelemetryExportDelegate } from '../export/impl/telemetry-export-delegate';
import { DbService } from '../../db';
import { InjectionTokens } from '../../injection-tokens';
import { inject, injectable } from 'inversify';
import { ProducerData, ShareDirection, ShareType, TelemetryService, TelemetryShareRequest } from '../../telemetry';
import { ZipService } from '../../util/zip/def/zip-service';
import { InvalidRequestError } from '..';
import { TelemetryImportDelegate } from '../import/impl/telemetry-import-delegate';
import { InvalidArchiveError } from '../import/error/invalid-archive-error';
import { TelemetryArchivePackageMeta } from '../export/def/telemetry-archive-package-meta';
import { FileUtil } from '../../util/file/util/file-util';
import { DeviceInfo } from '../../util/device';
import { NetworkQueue } from '../../api/network-queue';
import { SdkConfig } from '../../sdk-config';
import { FilePaths } from '../../services/file-path/file-path.enum';
import { FilePathService } from '../../services/file-path/file-path.service';

interface ArchiveManifest {
    id: string;
    ver: string;
    ts: string;
    producer: ProducerData;
    archive: {
        count: number;
        items: {
            objectType: ArchiveObjectType
            file: string;
            contentEncoding: 'identity' | 'gzip';
            size: number;
            explodedSize: number;
        }[];
    };
}

@injectable()
export class ArchiveServiceImpl implements ArchiveService {
    private static ARCHIVE_ID = 'sunbird.data.archive';
    private static ARCHIVE_VERSION = '1.0';

    constructor(
        @inject(InjectionTokens.FILE_SERVICE) private fileService: FileService,
        @inject(InjectionTokens.DB_SERVICE) private dbService: DbService,
        @inject(InjectionTokens.TELEMETRY_SERVICE) private telemetryService: TelemetryService,
        @inject(InjectionTokens.ZIP_SERVICE) private zipService: ZipService,
        @inject(InjectionTokens.DEVICE_INFO) private deviceInfo: DeviceInfo,
        @inject(InjectionTokens.NETWORK_QUEUE) private networkQueue: NetworkQueue,
        @inject(InjectionTokens.SDK_CONFIG) private sdkConfig: SdkConfig
    ) {
    }

    private static reduceObjectProgressToArchiveObjectExportProgress(
        results: { type: ArchiveObjectType, progress: ArchiveObjectExportProgress }[]
    ): Map<ArchiveObjectType, ArchiveObjectExportProgress> {
        return results.reduce((acc, { type, progress }) => {
            acc.set(type, progress);
            return acc;
        }, new Map<ArchiveObjectType, ArchiveObjectExportProgress>());
    }

    private static reduceObjectProgressToArchiveObjectImportProgress(
        results: { type: ArchiveObjectType, progress: ArchiveObjectImportProgress }[],
    ): Map<ArchiveObjectType, ArchiveObjectImportProgress> {
        return results.reduce((acc, { type, progress }) => {
            acc.set(type, progress);
            return acc;
        }, new Map<ArchiveObjectType, ArchiveObjectImportProgress>());
    }

    export(exportRequest: ArchiveExportRequest): Observable<ArchiveExportProgress> {
        return defer(async () => {
            const platform = window.device.platform.toLowerCase();
            const storagePath = platform === 'ios' ? FilePaths.DOCUMENTS : FilePaths.CACHE;
            const folderUri = await FilePathService.getFilePath(storagePath);
            return { folderUri };
        }).pipe(
            mergeMap(({ folderUri }) => {
                const workspacePath = `${folderUri}${UniqueId.generateUniqueId()}`;
                let lastResult: ArchiveExportProgress | undefined;

                if (!exportRequest.objects.length) {
                    return throwError(new InvalidRequestError('No archive objects to export'));
                }

                return concat(
                    defer(() => from(this.fileService.createDir(workspacePath, false))).pipe(
                        concatMap(() => {
                            return combineLatest(
                                exportRequest.objects.map<Observable<{ type: ArchiveObjectType, progress: ArchiveObjectExportProgress }>>(object => {
                                    switch (object.type) {
                                        case ArchiveObjectType.CONTENT:
                                            // TODO
                                            throw new Error('To be implemented');
                                        case ArchiveObjectType.PROFILE:
                                            // TODO
                                            throw new Error('To be implemented');
                                        case ArchiveObjectType.TELEMETRY:
                                            return new TelemetryExportDelegate(
                                                this.dbService,
                                                this.fileService,
                                            ).export({ filePath: exportRequest.filePath }, { workspacePath }).pipe(
                                                map((progress) => ({ type: ArchiveObjectType.TELEMETRY, progress: progress }))
                                            );
                                    }
                                })
                            );
                        }),
                        map((results: { type: ArchiveObjectType, progress: ArchiveObjectExportProgress }[]) => {
                            return {
                                task: 'BUILDING',
                                progress: ArchiveServiceImpl.reduceObjectProgressToArchiveObjectExportProgress(results)
                            };
                        }),
                        tap((results) => lastResult = results)
                    ),
                    defer(() => this.generateManifestFile(lastResult!, workspacePath)),
                    defer(() => this.generateZipArchive(lastResult!, workspacePath)),
                    defer(() => this.generateExportTelemetries(lastResult!, workspacePath))
                ).pipe(
                    tap((results) => lastResult = results)
                );
            }),
            catchError(error => {
                console.error('Error getting filesystem URI:', error);
                return throwError(error);
            })
        );
    }

    private generateExportTelemetries(progress: ArchiveExportProgress, workspacePath: string): Observable<ArchiveExportProgress> {
        progress.progress.forEach((v, k) => {
            switch (k) {
                case ArchiveObjectType.CONTENT:
                    // TODO
                    throw new Error('To be implemented');
                case ArchiveObjectType.PROFILE:
                    // TODO
                    throw new Error('To be implemented');
                case ArchiveObjectType.TELEMETRY: {
                    // const items = (v as ArchiveObjectExportProgress<TelemetryPackageMeta>).completed.map((entry) => {
                    //     return {
                    //         type: ShareItemType.TELEMETRY,
                    //         origin: this.deviceInfo.getDeviceID(),
                    //         identifier: entry.mid,
                    //         pkgVersion: 1,
                    //         transferCount: entry.eventsCount,
                    //         size: entry.size + ''
                    //     };
                    // });

                    const req: TelemetryShareRequest = {
                        dir: ShareDirection.OUT,
                        type: ShareType.FILE,
                        items: [],
                        env: 'sdk'
                    };

                    this.telemetryService.share(req).toPromise();
                }
            }
        });

        return of({
            ...progress,
        });
    }

    private generateZipArchive(progress: ArchiveExportProgress, workspacePath: string): Observable<ArchiveExportProgress> {
        return defer(async () => {
            const platform = window.device.platform.toLowerCase();
            const storagePath = platform === 'ios' ? FilePaths.DOCUMENTS : FilePaths.CACHE;
            const folderPath = await FilePathService.getFilePath(storagePath);
            const zipFilePath = `${folderPath}archive-${new Date().toISOString()}.zip`;
            return { zipFilePath };
        }).pipe(
            mergeMap(({ zipFilePath }) => {
                return new Observable((observer) => {
                    this.zipService.zip(workspacePath, { target: zipFilePath }, [], [], () => {
                        observer.next({
                            ...progress,
                            task: 'COMPLETE',
                            filePath: zipFilePath
                        });
                        observer.complete();
                    }, (e) => {
                        observer.error(e);
                    });
                });
            }),
            map((c) => c as ArchiveExportProgress),
            catchError(error => {
                console.error('Error creating zip archive:', error);
                return throwError(error);
            })
        );
    }

    private generateManifestFile({ progress }: ArchiveExportProgress, workspacePath: string): Observable<ArchiveExportProgress> {
        return this.telemetryService.buildContext().pipe(
            map((c) => c.pdata),
            mergeMap((producerData: ProducerData) => {
                const flattenedItems = Array.from(progress.entries()).reduce<{
                    file: string;
                    contentEncoding: 'identity' | 'gzip';
                }[]>((acc, [objectType, objectProgress]) => {
                    return acc.concat(objectProgress.completed);
                }, []);

                return from(this.fileService.writeFile(
                    workspacePath,
                    'manifest.json',
                    JSON.stringify({
                        id: ArchiveServiceImpl.ARCHIVE_ID,
                        ver: ArchiveServiceImpl.ARCHIVE_VERSION,
                        ts: (new Date()).toISOString(),
                        producer: producerData,
                        archive: {
                            count: flattenedItems.length,
                            items: flattenedItems
                        }
                    } as ArchiveManifest),
                    { replace: true }
                )).pipe(
                    catchError(error => {
                        console.error('Error writing manifest file:', error);
                        return throwError(new Error(`Failed to write manifest: ${error.message}`));
                    })
                );
            }),
            mapTo({
                progress,
                task: 'BUILDING_MANIFEST'
            }),
            catchError(error => {
                console.error('Error in manifest generation:', error);
                return throwError(error);
            })
        );
    }

    import(importRequest: ArchiveImportRequest): Observable<ArchiveImportProgress> {

        if (!importRequest.objects.length) {
            return throwError(new InvalidRequestError('No archive objects to export'));
        }

        let lastResult: ArchiveImportProgress = {
            task: '',
            progress: new Map<ArchiveObjectType, ArchiveObjectImportProgress>(),
            filePath: importRequest.filePath
        };

        return defer(async () => {
            const platform = window.device.platform.toLowerCase();
            const storagePath = platform === 'ios' ? FilePaths.DOCUMENTS : FilePaths.CACHE;
            const folderUri = await FilePathService.getFilePath(storagePath);
            const workspacePath = `${folderUri}${UniqueId.generateUniqueId()}`;
            return { workspacePath };
        }).pipe(
            mergeMap(({ workspacePath }) =>
                concat(
                    defer(() => from(this.fileService.createDir(workspacePath, false))).pipe(
                        concatMap(() => this.extractZipArchive(lastResult, workspacePath))
                    ),
                    defer(() => {
                        const fileNameWithoutExtension = FileUtil.getFileName(importRequest.filePath).replace('.zip', '');

                        const extractedFolderPath = `${workspacePath}/${fileNameWithoutExtension}`;

                        return this.readManifestFile(lastResult, extractedFolderPath, importRequest.objects.map(o => o.type))
                    }),
                    defer(() => this.generateImportTelemetries(lastResult, workspacePath)),
                    defer(() => {
                        return combineLatest(
                            importRequest.objects.map<Observable<{ type: ArchiveObjectType, progress: ArchiveObjectImportProgress }>>(object => {
                                switch (object.type) {
                                    case ArchiveObjectType.CONTENT:
                                        throw new Error('To be implemented');
                                    case ArchiveObjectType.PROFILE:
                                        throw new Error('To be implemented');
                                    case ArchiveObjectType.TELEMETRY:
                                        const fileNameWithoutExtension = FileUtil.getFileName(importRequest.filePath).replace('.zip', '');
                                        const extractedFolderPath = `${workspacePath}/${fileNameWithoutExtension}`;

                                        return new TelemetryImportDelegate(
                                            this.dbService,
                                            this.fileService,
                                            this.networkQueue,
                                            this.sdkConfig
                                        ).import({
                                            filePath: importRequest.filePath
                                        }, {
                                            workspacePath: extractedFolderPath,
                                            items: lastResult!.progress
                                                .get(ArchiveObjectType.TELEMETRY)!.pending as TelemetryArchivePackageMeta[]
                                        }).pipe(
                                            map((progress) => {
                                                return {
                                                    type: ArchiveObjectType.TELEMETRY,
                                                    progress: progress
                                                };
                                            }),
                                        );
                                }
                            })
                        );
                    })
                )
            ),
            filter((result): result is ArchiveImportProgress => {
                return (result as ArchiveImportProgress).task !== undefined;
            }),
            tap((results) => lastResult = results),
            catchError((error) => {
                console.error('Import error:', error);
                return throwError(error);
            })
        );
    }

    private generateImportTelemetries(progress: ArchiveImportProgress, workspacePath: string): Observable<ArchiveImportProgress> {
        progress.progress.forEach((v, k) => {
            switch (k) {
                case ArchiveObjectType.CONTENT:
                    // TODO
                    throw new Error('To be implemented');
                case ArchiveObjectType.PROFILE:
                    // TODO
                    throw new Error('To be implemented');
                case ArchiveObjectType.TELEMETRY: {
                    // const items = (v as ArchiveObjectImportProgress<TelemetryPackageMeta>).pending.map((entry) => {
                    //     return {
                    //         type: ShareItemType.TELEMETRY,
                    //         origin: this.deviceInfo.getDeviceID(),
                    //         identifier: entry.mid,
                    //         pkgVersion: 1,
                    //         transferCount: entry.eventsCount,
                    //         size: entry.size + ''
                    //     };
                    // });

                    const req: TelemetryShareRequest = {
                        dir: ShareDirection.IN,
                        type: ShareType.FILE.valueOf(),
                        items: [],
                        env: 'sdk'
                    };

                    this.telemetryService.share(req).toPromise();
                }
            }
        });

        return of({
            ...progress,
        });
    }

    private extractZipArchive(progress: ArchiveImportProgress, workspacePath: string): Observable<ArchiveImportProgress> {
        const filePath = progress.filePath!;
        return new Observable((observer) => {
            sbutility.copyFile(
                FileUtil.getDirecory(filePath),
                `${workspacePath}/`,
                FileUtil.getFileName(filePath),
                () => {
                    this.zipService.unzip(
                        `${workspacePath}/${FileUtil.getFileName(filePath)}`,
                        { target: workspacePath + '/' },
                        () => {
                            observer.next();
                            observer.complete();
                        }, (e) => observer.error(e)
                    );
                },
                (e) => {
                    console.error(e);
                    observer.error(e);
                }
            );
        }).pipe(
            mapTo({
                ...progress,
                task: 'EXTRACTING',
            })
        );
    }

    private readManifestFile(
        importProgress: ArchiveImportProgress,
        workspacePath: string,
        objectTypes: ArchiveObjectType[]
    ): Observable<ArchiveImportProgress> {
        return from(this.fileService.readAsText(workspacePath, 'manifest.json')).pipe(
            map((content) => {
                try {
                    return JSON.parse(content);
                } catch (e) {
                    throw new InvalidArchiveError('Invalid manfiest.json');
                }
            }),
            map((manifest: ArchiveManifest) => {
                return {
                    ...importProgress,
                    progress: (() => {
                        objectTypes.forEach((type) => {
                            const items = manifest.archive.items.filter((i) => i.objectType === type);

                            if (!items.length) {
                                throw new InvalidArchiveError('Nothing to import');
                            }

                            importProgress.progress.set(type, {
                                task: 'INITIALISING',
                                pending: items
                            });
                        });
                        return importProgress.progress;
                    })(),
                    task: 'VALIDATING'
                };
            })
        );
    }
}
