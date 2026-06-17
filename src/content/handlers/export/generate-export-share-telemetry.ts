import { FilePathService } from '../../../services/file-path/file-path.service';
import {ContentExportResponse, ExportContentContext, ContentExportRequest} from '../..';
import {Response} from '../../../api';
import {Item, ShareDirection, ShareItemType, ShareType, TelemetryService, TelemetryShareRequest} from '../../../telemetry';
import {ContentUtil} from '../../util/content-util';
import { FilePaths } from "../../../services/file-path/file-path.enum";

export class GenerateExportShareTelemetry {
    constructor(private telemetryService: TelemetryService) {
    }

    async execute(exportContentContext: ExportContentContext, fileName: string, contentExportRequest: ContentExportRequest): Promise<Response> {
        const response: Response = new Response();
        const items: Item[] = [];
        for (const element of exportContentContext.items!) {
            const item: Item = {
                type: ShareItemType.CONTENT,
                origin: ContentUtil.readOriginFromContentMap(element),
                identifier: element.identifier,
                pkgVersion: Number(element.pkgVersion),
                transferCount: ContentUtil.readTransferCountFromContentMap(element),
                size: ContentUtil.readSizeFromContentMap(element)
            };
        }
        const req: TelemetryShareRequest = {
            dir: ShareDirection.OUT,
            type: ShareType.FILE.valueOf(),
            items: items,
            env: 'sdk'
        };

        const platform = window.device.platform.toLowerCase();
        const filePath = (platform === 'ios') ? FilePaths.DOCUMENTS : FilePaths.CACHE;

        try {
            await this.telemetryService.share(req).toPromise();
            let exportedFilePath;
            if (contentExportRequest.saveLocally) {
                exportedFilePath = contentExportRequest.destinationFolder.concat(fileName);
            } else {
                const folderPath = await FilePathService.getFilePath(filePath);
                exportedFilePath = folderPath.concat(fileName);
            }
            const exportResponse: ContentExportResponse = { exportedFilePath: exportedFilePath };
            response.body = exportResponse;
            return await Promise.resolve(response);
        } catch {
            return await Promise.reject(response);
        }
    }

}
