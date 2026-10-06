import { CopyToDestination } from './copy-to-destination';
import {FileService} from '../../../util/file/def/file-service';
import {ContentEntry} from '../../db/schema';
import {Response} from '../../../api';
import { FilePathService } from '../../../services/file-path/file-path.service';
import { FilePaths } from '../../../services/file-path/file-path.enum';
import { getPlatform, getSdkPlatform } from '../../../util/platform/platform-util';

// FilePathService calls Capacitor Filesystem.getUri, which is unavailable under jsdom.
jest.mock('../../../services/file-path/file-path.service', () => ({
    FilePathService: {
        getFilePath: jest.fn(() => Promise.resolve('file:///cache-folder/'))
    }
}));
jest.mock('../../../util/platform/platform-util', () => ({
    getPlatform: jest.fn(() => 'android'),
    getSdkPlatform: jest.fn(() => 'cordova')
}));

declare const sbutility;

describe('CopyToDestination', () => {
    let copyToDestination: CopyToDestination;
    const mockFileService: Partial<FileService> = {};

    const contentEntrySchema: ContentEntry.SchemaMap[] = [{
        identifier: 'IDENTIFIER',
        server_data: 'SERVER_DATA',
        local_data: '{"children": [{"DOWNLOAD": 1}, "do_234", "do_345"], "artifactUrl": "http:///do_123"}',
        mime_type: 'MIME_TYPE',
        manifest_version: 'MAINFEST_VERSION',
        content_type: 'CONTENT_TYPE',
        content_state: 2,
        primary_category: 'textbook'
    }];

    const buildResponse = (): Response => {
        const response: Response = new Response();
        response.body = {
            destinationFolder: 'SAMPLE_DESTINATION_FOLDER',
            tmpLocationPath: 'SAMPLE_TEMP_PATH',
            contentModelsToExport: contentEntrySchema,
            items: ['artifactUrl'],
            metadata: {'SAMPLE_KEY': 'SAMPLE_META_DATA'},
            ecarFilePath: 'sampledir/samplefile'
        };
        return response;
    };

    beforeAll(() => {
        copyToDestination = new CopyToDestination();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (getPlatform as jest.Mock).mockReturnValue('android');
        (getSdkPlatform as jest.Mock).mockReturnValue('cordova');
    });

    it('should be create a instance of copy asset', () => {
        expect(copyToDestination).toBeTruthy();
    });

    it('should be copied a file by invoked exicute() for error MEssage', (done) => {
        // arrange
        const contentExportRequest = {
            destinationFolder: 'dest-folder',
            contentIds: [''],
            saveLocally: true
        };
        const response = buildResponse();
        copyToDestination = new CopyToDestination();
        spyOn(sbutility, 'copyFile').and.callFake((a, b, c, d, e) => {
            setTimeout(() => {
                setTimeout(() => {
                    d();
                }, 0);
            });
        });
        // act
        copyToDestination.execute(response, contentExportRequest).then((result) => {
            // assert
            expect(result).toBe(response);
            expect(FilePathService.getFilePath).toHaveBeenCalledWith(FilePaths.CACHE);
            expect(sbutility.copyFile).toHaveBeenCalledWith('sampledir', 'dest-folder', 'samplefile',
                jasmine.any(Function), jasmine.any(Function));
            done();
        }).catch((e) => {
            done.fail(e);
        });
    });

    it('should be copied a file by invoked exicute() for error MEssage', (done) => {
        // arrange
        (getPlatform as jest.Mock).mockReturnValue('ios');
        const contentExportRequest = {
            destinationFolder: 'dest-folder',
            contentIds: [''],
            saveLocally: false
        };
        const response = buildResponse();
        copyToDestination = new CopyToDestination();
        const error = {error: 'copy failed'};
        spyOn(console, 'error').and.stub();
        spyOn(sbutility, 'copyFile').and.callFake((a, b, c, d, e) => {
            setTimeout(() => {
                setTimeout(() => {
                    e(error);
                }, 0);
            });
        });
        // act
        copyToDestination.execute(response, contentExportRequest).then((result) => {
            // assert - copy error is resolved (not rejected) with the error by current source
            expect(result).toBe(error);
            expect(FilePathService.getFilePath).toHaveBeenCalledWith(FilePaths.DOCUMENTS);
            expect(sbutility.copyFile).toHaveBeenCalledWith('sampledir', 'file:///cache-folder/', 'samplefile',
                jasmine.any(Function), jasmine.any(Function));
            done();
        }).catch((e) => {
            done.fail(e);
        });
    });

    it('should copy the file using FileService on capacitor platform', async () => {
        // arrange
        (getSdkPlatform as jest.Mock).mockReturnValue('capacitor');
        mockFileService.copyFile = jest.fn(() => Promise.resolve({} as any));
        copyToDestination = new CopyToDestination(mockFileService as FileService);
        const response = buildResponse();
        const contentExportRequest = {
            destinationFolder: 'dest-folder',
            contentIds: [''],
            saveLocally: false
        };
        // act
        const result = await copyToDestination.execute(response, contentExportRequest);
        // assert
        expect(result).toBe(response);
        expect(mockFileService.copyFile).toHaveBeenCalledWith('sampledir', 'samplefile',
            'file:///cache-folder/', 'samplefile');
    });

    it('should reject on capacitor platform if FileService.copyFile fails', async () => {
        // arrange
        (getSdkPlatform as jest.Mock).mockReturnValue('capacitor');
        mockFileService.copyFile = jest.fn(() => Promise.reject(new Error('copy failed')));
        copyToDestination = new CopyToDestination(mockFileService as FileService);
        const contentExportRequest = {
            destinationFolder: 'dest-folder',
            contentIds: [''],
            saveLocally: true
        };
        // act / assert
        await expect(copyToDestination.execute(buildResponse(), contentExportRequest)).rejects.toThrow('copy failed');
    });

});
