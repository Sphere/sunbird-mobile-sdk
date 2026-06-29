import {FileService} from '../../../util/file/def/file-service';
import {Response} from '../../../api';
import {FileUtil} from '../../../util/file/util/file-util';
import {FileExtension} from '../../util/content-constants';
import {Entry, Metadata} from '../../../util/file';
import {ExportContentContext} from '../..';

export class CleanTempLoc {

    constructor(private fileService: FileService) {
    }

    public async execute(exportContext: ExportContentContext): Promise<Response> {
        const response: Response = new Response();
        const yesterday: number = Date.now() - (24 * 60 * 60 * 1000);
        const directoryList = await this.fileService.listDir(exportContext.destinationFolder).catch((e) => { throw new Error(e); });
        if (directoryList && directoryList.length > 0) {
            for (const directory of directoryList) {
                if (FileUtil.getFileExtension(directory.nativeURL) === FileExtension.CONTENT) {
                    const metaData: Metadata = await this.fileService.getMetaData(directory.nativeURL).catch((e) => { throw new Error(e); });    
                    if (new Date(metaData.modificationTime).getMilliseconds() <= yesterday) {
                        await new Promise<void>(async (resolve) => {
                            if (directory.remove) {
                                try {
                                    await directory.remove();
                                    resolve();
                                } catch (error) {
                                    console.error('Error removing directory:', error);
                                    resolve();
                                }
                            }
                        });
                    }
                }
            }
        }
        return response;
    }
}
