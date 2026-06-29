import { Response } from '../../../api';
import {FileUtil} from '../../../util/file/util/file-util';
import { ContentExportRequest } from '../..';
import { FilePaths } from "../../../services/file-path/file-path.enum";
import { FilePathService } from '../../../services/file-path/file-path.service';

export class CopyToDestination {

    constructor() {
    }

    public async execute(exportResponse: Response, contentExportRequest: ContentExportRequest): Promise<Response> {
        const platform = window.device.platform.toLowerCase();
        const storagePath = platform === 'ios' ? FilePaths.DOCUMENTS : FilePaths.CACHE;
        const folderPath = await FilePathService.getFilePath(storagePath);
        return new Promise<Response>((resolve, reject) => {
            let destinationFolder;
            if (contentExportRequest.saveLocally) {
                destinationFolder = contentExportRequest.destinationFolder;
            } else {
                destinationFolder = folderPath;
            }
            sbutility.copyFile(FileUtil.getDirecory(exportResponse.body.ecarFilePath), destinationFolder,
                FileUtil.getFileName(exportResponse.body.ecarFilePath),
                () => {
                    resolve(exportResponse);
                }, err => {
                    console.error(err);
                    resolve(err);
                });
        });
    }
}
