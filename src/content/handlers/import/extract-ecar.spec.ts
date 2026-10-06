import { ExtractEcar } from './extract-ecar';
import { FileService } from '../../../util/file/def/file-service';
import { ZipService } from '../../../util/zip/def/zip-service';
import { ContentImportResponse, ContentImportStatus, ImportContentContext } from '../..';

// UniqueId uses `import * as uuidv4 from 'uuid/v4'`, which is not callable under esModuleInterop in jest
jest.mock('../../../db/util/unique-id', () => ({
    UniqueId: { generateUniqueId: () => 'SAMPLE_UUID' }
}));

describe('ExtractEcar', () => {
    let extractEcar: ExtractEcar;
    const mockFileService: Partial<FileService> = {
        createDir: jest.fn().mockImplementation(() => {})
    };
    const mockZipService: Partial<ZipService> = {};

    beforeAll(() => {
        extractEcar = new ExtractEcar(
          mockFileService as FileService,
          mockZipService as ZipService
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const buildRequest = (tmpLocation?: string): ImportContentContext => {
        const contentImportResponse: ContentImportResponse[] = [{
            identifier: 'SAMPLE_IDENTIFIER',
            status: ContentImportStatus.IMPORT_COMPLETED
        }];
        return {
            isChildContent: true,
            ecarFilePath: 'SAMPLE_ECAR_FILE_PATH',
            tmpLocation,
            destinationFolder: 'SAMPLE_DESTINATION_FOLDER',
            contentImportResponseList: contentImportResponse,
            contentIdsToDelete: new Set(['1', '2']),
            metadata: {FILE_SIZE: 1}
        };
    };

    it('should be create a instance of ExtractEcar', () => {
        expect(extractEcar).toBeTruthy();
    });

    it('should create a directory and zip file convert to unzip file for Error part', () => {
        // arrange
        const request = buildRequest(undefined);
        const metaData = {
            modificationTime: '20/03/2020',
            size: 1
        };
        mockFileService.getMetaData = jest.fn(() => Promise.resolve(metaData)) as any;
        // act
        return extractEcar.execute(request).then(() => {
            fail('should have rejected');
        }, (e) => {
            // assert
            expect(e._errorMesg).toBe('IMPORT_FAILED_EXTRACTION');
            expect(mockFileService.getMetaData).toHaveBeenCalled();
        });
    });

    it('should create a directory and zip file convert to unzip file', () => {
        // arrange
        const request = buildRequest('SAMPLE_TEMP_LOCATION');
        mockFileService.getMetaData = jest.fn().mockResolvedValue({modificationTime: 'July 20, 69 00:20:18', size: 16});
        (mockFileService.createDir as jest.Mock).mockResolvedValue({nativeURL: 'sample-native-url'});
        mockZipService.unzip = jest.fn((_, __, cd, err) => cd());
        // act
        return extractEcar.execute(request).then((response) => {
            // assert
            expect(mockFileService.getMetaData).toHaveBeenCalledWith('SAMPLE_ECAR_FILE_PATH');
            expect(mockFileService.createDir).toHaveBeenCalledWith('SAMPLE_TEMP_LOCATIONSAMPLE_UUID', true);
            expect(mockZipService.unzip).toHaveBeenCalledWith('SAMPLE_ECAR_FILE_PATH',
                {target: 'sample-native-url'}, expect.any(Function), expect.any(Function));
            expect(response.body.tmpLocation).toBe('sample-native-url');
            expect(response.body.metadata.FILE_SIZE).toBe(16);
        });
    });

    it('should create a directory and zip file convert to unzip file for zip error case', () => {
        // arrange
        const request = buildRequest('SAMPLE_TEMP_LOCATION');
        mockFileService.getMetaData = jest.fn().mockResolvedValue({modificationTime: 'July 20, 69 00:20:18', size: 16});
        (mockFileService.createDir as jest.Mock).mockResolvedValue({nativeURL: 'sample-native-url'});
        mockZipService.unzip = jest.fn((_, __, cd, err) => err());
        // act
        return extractEcar.execute(request).then(() => {
            fail('should have rejected');
        }, (e) => {
            // assert
            expect(e._errorMesg).toBe('IMPORT_FAILED_EXTRACTION');
            expect(mockFileService.getMetaData).toHaveBeenCalled();
            expect(mockFileService.createDir).toHaveBeenCalled();
            expect(mockZipService.unzip).toHaveBeenCalled();
        });
    });

    it('should reject with IMPORT_FAILED_EXTRACTION if createDir fails', () => {
        // arrange
        const request = buildRequest('SAMPLE_TEMP_LOCATION');
        mockFileService.getMetaData = jest.fn().mockResolvedValue({modificationTime: 'July 20, 69 00:20:18', size: 16});
        (mockFileService.createDir as jest.Mock).mockRejectedValue('createDir error');
        mockZipService.unzip = jest.fn();
        // act
        return extractEcar.execute(request).then(() => {
            fail('should have rejected');
        }, (e) => {
            // assert
            expect(e._errorMesg).toBe('IMPORT_FAILED_EXTRACTION');
            expect(mockZipService.unzip).not.toHaveBeenCalled();
        });
    });
});
