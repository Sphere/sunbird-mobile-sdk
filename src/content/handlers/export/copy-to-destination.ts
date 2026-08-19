import { Response } from '../../../api';
import {FileUtil} from '../../../util/file/util/file-util';
import { ContentExportRequest } from '../..';
import { FilePaths } from "../../../services/file-path/file-path.enum";
import { FilePathService } from '../../../services/file-path/file-path.service';
import { getPlatform, getSdkPlatform } from '../../../util/platform/platform-util';
import { FileService } from '../../../util/file/def/file-service';

export class CopyToDestination {

    constructor(private fileService?: FileService) {
    }

    public async execute(exportResponse: Response, contentExportRequest: ContentExportRequest): Promise<Response> {
        const platform = getPlatform();
        const storagePath = platform === 'ios' ? FilePaths.DOCUMENTS : FilePaths.CACHE;
        const folderPath = await FilePathService.getFilePath(storagePath);
        let destinationFolder;
        if (contentExportRequest.saveLocally) {
            destinationFolder = contentExportRequest.destinationFolder;
        } else {
            destinationFolder = folderPath;
        }

        const sourceDirectory = FileUtil.getDirecory(exportResponse.body.ecarFilePath);
        const fileName = FileUtil.getFileName(exportResponse.body.ecarFilePath);

        if (getSdkPlatform() === 'capacitor') {
            await this.fileService!.copyFile(sourceDirectory, fileName, destinationFolder, fileName);
            return exportResponse;
        }

        return new Promise<Response>((resolve, reject) => {
            sbutility.copyFile(sourceDirectory, destinationFolder, fileName,
                () => {
                    resolve(exportResponse);
                }, err => {
                    console.error(err);
                    resolve(err);
                });
        });
    }
}
