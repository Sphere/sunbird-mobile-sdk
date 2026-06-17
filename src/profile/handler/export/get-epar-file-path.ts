import {Response} from '../../../api';
import {FileService} from '../../../util/file/def/file-service';
import {ExportProfileContext} from '../../def/export-profile-context';
import * as dayjs from 'dayjs';

export class GetEparFilePath {
    constructor(private fileService: FileService) {
    }

    public async execute(exportContext: ExportProfileContext): Promise<Response> {
        const response: Response = new Response();
        const fileName = `profiles_${dayjs().format('YYYYMMDDhhmmss')}.epar`;
        return await this.fileService.createDir(exportContext.destinationFolder!.concat('Profile'), false)
            .then(async (directoryEntry: any) => {
                return await this.fileService.createFile(directoryEntry.nativeURL, fileName, true).catch((e) => { throw new Error(e); });
            }).then((fileEntry: any) => {
                exportContext.destinationDBFilePath = fileEntry.nativeURL;
                response.body = exportContext;
                return response;
            }).catch((e) => { throw new Error(e); });;
    }
}
