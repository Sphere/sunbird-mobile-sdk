import {WriteManifest} from './write-manifest';
import {FileService} from '../../../util/file/def/file-service';
import {ContentEntry} from '../../db/schema';
import {ExportContentContext} from '../..';
import {DeviceInfo} from '../../..';
import {of} from 'rxjs';
import {ContentErrorCode} from '../../util/content-constants';

describe('writeManifest', () => {
    let writeManifest: WriteManifest;
    const mockFileService: Partial<FileService> = {
        writeFile: jest.fn().mockImplementation(() => {
        })
    };
    const mockDeviceInfo: Partial<DeviceInfo> = {
        getAvailableInternalMemorySize: jest.fn().mockImplementation(() => {
        })
    };

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

    const buildRequest = (): ExportContentContext => ({
        ecarFilePath: 'ECAR_FILE_PATH',
        destinationFolder: 'SAMPLE_DESTINATION_FOLDER',
        tmpLocationPath: 'SAMPLE_TEMP_PATH',
        contentModelsToExport: contentEntrySchema,
        items: [{'size': 'sample'}],
        metadata: {'SAMPLE_KEY': 'SAMPLE_META_DATA'},
        manifest: {'id': 'MANIFEST_ID'}
    });

    beforeAll(() => {
        writeManifest = new WriteManifest(
            mockFileService as FileService,
            mockDeviceInfo as DeviceInfo
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be create instance of ecarBundle', () => {
        expect(writeManifest).toBeTruthy();
    });

    it('should be able to write a file if internal memory availabe', () => {
        // arrange
        const request = buildRequest();
        (mockDeviceInfo.getAvailableInternalMemorySize as jest.Mock).mockReturnValue(of(String(10 * 1024 * 1024)));
        (mockFileService.writeFile as jest.Mock).mockResolvedValue('SAMPLE_TEMP_PATH/manifest.json');
        // act
        return writeManifest.execute(request).then((response) => {
            // assert
            expect(mockDeviceInfo.getAvailableInternalMemorySize).toHaveBeenCalled();
            expect(mockFileService.writeFile).toHaveBeenCalledWith(
                'SAMPLE_TEMP_PATH', 'manifest.json', JSON.stringify(request.manifest), {replace: true});
            expect(response.body).toBe(request);
        });
    });

    it('should reject with EXPORT_FAILED_WRITING_MANIFEST if internal memory is not sufficient', () => {
        // arrange
        const request = buildRequest();
        (mockDeviceInfo.getAvailableInternalMemorySize as jest.Mock).mockReturnValue(of('102'));
        // act
        return writeManifest.execute(request).then(() => {
            fail('should have rejected');
        }, (e) => {
            // assert
            expect(mockFileService.writeFile).not.toHaveBeenCalled();
            expect(e.errorMesg).toBe(ContentErrorCode.EXPORT_FAILED_WRITING_MANIFEST);
        });
    });

    it('should reject with EXPORT_FAILED_WRITING_MANIFEST if writing the file fails', () => {
        // arrange
        const request = buildRequest();
        (mockDeviceInfo.getAvailableInternalMemorySize as jest.Mock).mockReturnValue(of(String(10 * 1024 * 1024)));
        (mockFileService.writeFile as jest.Mock).mockRejectedValue(new Error('write failed'));
        // act
        return writeManifest.execute(request).then(() => {
            fail('should have rejected');
        }, (e) => {
            // assert
            expect(mockFileService.writeFile).toHaveBeenCalled();
            expect(e.errorMesg).toBe(ContentErrorCode.EXPORT_FAILED_WRITING_MANIFEST);
        });
    });

    it('should write the file when usable space is reported as non-positive (unknown)', () => {
        // arrange
        const request = buildRequest();
        (mockDeviceInfo.getAvailableInternalMemorySize as jest.Mock).mockReturnValue(of('-23'));
        (mockFileService.writeFile as jest.Mock).mockResolvedValue('111');
        // act
        return writeManifest.execute(request).then((response) => {
            // assert
            expect(mockDeviceInfo.getAvailableInternalMemorySize).toHaveBeenCalled();
            expect(mockFileService.writeFile).toHaveBeenCalled();
            expect(response.body).toBe(request);
        });
    });

});
