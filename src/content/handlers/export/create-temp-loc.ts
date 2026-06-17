import {FileService} from '../../../util/file/def/file-service';
import {ExportContentContext} from '../..';
import {Response} from '../../../api';
import {UniqueId} from '../../../db/util/unique-id';
import {DirectoryEntry} from '../../../util/file';

export class CreateTempLoc {

    constructor(private fileService: FileService) {
    }

    async execute(exportContext: ExportContentContext): Promise<Response> {
        const response: Response = new Response();
        return await this.fileService.createDir(exportContext.tmpLocationPath!.concat(UniqueId.generateUniqueId()), false)
            .then((directoryEntry: any) => {
                exportContext.tmpLocationPath = directoryEntry.nativeURL;
                response.body = exportContext;
                return Promise.resolve(response);
            }).catch(() => {
                return Promise.reject(response);
            });
    }
}
