import {ImportContentContext} from '../..';
import {Response} from '../../../api';
import {ContentErrorCode} from '../../util/content-constants';
import {FileService} from '../../../util/file/def/file-service';
import {ZipService} from '../../../util/zip/def/zip-service';
import {UniqueId} from '../../../db/util/unique-id';

export class ExtractEcar {
    private readonly FILE_SIZE = 'FILE_SIZE';

    constructor(private fileService: FileService,
                private zipService: ZipService) {
    }

    public async execute(importContext: ImportContentContext): Promise<Response> {
        const response: Response = new Response();
        let size: number;
        return await this.fileService.getMetaData(importContext.ecarFilePath).then(async(metaData) => {
            size = metaData.size;
            return await this.fileService.createDir(importContext.tmpLocation!.concat(UniqueId.generateUniqueId()), true).catch((e) => { throw new Error(e); });
        }).then(async (directoryEntry) => {
            importContext.tmpLocation = directoryEntry.nativeURL;
            await new Promise<void>((resolve, reject) => {
                this.zipService.unzip(importContext.ecarFilePath, {target: directoryEntry.nativeURL}, () => {
                    resolve();
                }, (e) => {
                    reject(e);
                });
            });
            importContext.metadata = {};
            importContext.metadata.FILE_SIZE = size;
            response.body = importContext;
            return Promise.resolve(response);
        }).catch(error => {
            response.errorMesg = ContentErrorCode.IMPORT_FAILED_EXTRACT_ECAR.valueOf();
            return Promise.reject(response);
        });
    }
}
