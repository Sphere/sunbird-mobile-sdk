import {CleanTempLoc} from './clean-temp-loc';
import {FileService} from '../../../util/file/def/file-service';
import {ExportContentContext} from '../..';
import {ContentEntry} from '../../db/schema';
import {FileUtil} from '../../../util/file/util/file-util';
import {Response} from '../../../api';

jest.mock('../../../util/file/util/file-util');

describe('CleanTempLoc', () => {
    let cleanTempLoc: CleanTempLoc;
    const mockFileService: Partial<FileService> = {
        listDir: jest.fn().mockImplementation(() => {
        }),
        getMetaData: jest.fn().mockImplementation(() => {
        })
    };

    const request: ContentEntry.SchemaMap[] = [{
        identifier: 'IDENTIFIER',
        server_data: 'SERVER_DATA',
        local_data: '{"children": [{"DOWNLOAD": 1}, "do_234", "do_345"]}',
        mime_type: 'MIME_TYPE',
        manifest_version: 'MAINFEST_VERSION',
        content_type: 'CONTENT_TYPE',
        primary_category: 'textbook'
    }];
    const exportContext: ExportContentContext = {
        destinationFolder: 'SAMPLE_DESTINATION_FOLDER',
        contentModelsToExport: request,
        metadata: {['SAMPLE_KEY']: 'META_DATA'},
    };

    beforeAll(() => {
        cleanTempLoc = new CleanTempLoc(
            mockFileService as FileService
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be create a instance of cleanTempLoc', () => {
        expect(cleanTempLoc).toBeTruthy();
    });

    // NOTE: CleanTempLoc no longer sets response.body (it resolves an empty Response);
    // the tests assert on the side effects (listing, metadata lookup and removal) instead.

    it('should exportEcar and clean temporary location', async () => {
        // arrange
        const remove = jest.fn(() => Promise.resolve());
        mockFileService.listDir = jest.fn(() => Promise.resolve([{
            nativeURL: 'sample.ecar',
            remove
        }])) as any;
        jest.spyOn(FileUtil, 'getFileExtension').mockImplementation(() => {
            return 'ecar';
        });
        mockFileService.getMetaData = jest.fn(() => Promise.resolve({
            modificationTime: new Date(2020, 7, 7)
        })) as any;
        // act
        const d = await cleanTempLoc.execute(exportContext);
        // assert
        expect(d).toBeInstanceOf(Response);
        expect(mockFileService.listDir).toHaveBeenCalledWith('SAMPLE_DESTINATION_FOLDER');
        expect(FileUtil.getFileExtension).toHaveBeenCalledWith('sample.ecar');
        expect(mockFileService.getMetaData).toHaveBeenCalledWith('sample.ecar');
        expect(remove).toHaveBeenCalled();
    });

    it('should exportEcar and clean temporary location for error part', async () => {
        // arrange
        const remove = jest.fn(() => Promise.reject({error: 'error'}));
        mockFileService.listDir = jest.fn(() => Promise.resolve([{
            nativeURL: 'sample.ecar',
            remove
        }])) as any;
        jest.spyOn(FileUtil, 'getFileExtension').mockImplementation(() => {
            return 'ecar';
        });
        mockFileService.getMetaData = jest.fn(() => Promise.resolve({
            modificationTime: new Date(2020, 7, 7)
        })) as any;
        jest.spyOn(console, 'error').mockImplementation(() => {});
        // act
        const e = await cleanTempLoc.execute(exportContext);
        // assert - removal failure is logged and swallowed
        expect(e).toBeInstanceOf(Response);
        expect(mockFileService.listDir).toHaveBeenCalled();
        expect(FileUtil.getFileExtension).toHaveBeenCalledWith('sample.ecar');
        expect(mockFileService.getMetaData).toHaveBeenCalled();
        expect(remove).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('Error removing directory:', {error: 'error'});
    });

    it('should exportEcar and clean temporary location if file extention is not matched', async () => {
        // arrange
        const remove = jest.fn(() => Promise.resolve());
        mockFileService.listDir = jest.fn(() => Promise.resolve([{
            nativeURL: 'sample.pdf',
            remove
        }])) as any;
        jest.spyOn(FileUtil, 'getFileExtension').mockImplementation(() => {
            return 'pdf';
        });
        mockFileService.getMetaData = jest.fn() as any;
        // act
        const e = await cleanTempLoc.execute(exportContext);
        // assert
        expect(e).toBeInstanceOf(Response);
        expect(mockFileService.listDir).toHaveBeenCalled();
        expect(FileUtil.getFileExtension).toHaveBeenCalledWith('sample.pdf');
        expect(mockFileService.getMetaData).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
    });

    it('should exportEcar and clean temporary location if directoryList is empty', async () => {
        // arrange
        mockFileService.listDir = jest.fn(() => Promise.resolve([])) as any;
        jest.spyOn(FileUtil, 'getFileExtension');
        // act
        const e = await cleanTempLoc.execute(exportContext);
        // assert
        expect(e).toBeInstanceOf(Response);
        expect(mockFileService.listDir).toHaveBeenCalled();
        expect(FileUtil.getFileExtension).not.toHaveBeenCalled();
    });

    it('should reject if listing the destination folder fails', async () => {
        // arrange
        mockFileService.listDir = jest.fn(() => Promise.reject('list error')) as any;
        // act / assert
        await expect(cleanTempLoc.execute(exportContext)).rejects.toThrow('list error');
    });
});
