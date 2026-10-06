import { ValidateDestinationFolder } from './validate-destination-folder';
import { FileService } from '../../../util/file/def/file-service';
import { ContentEntry } from '../../../content/db/schema';
import { MoveContentResponse, MoveContentStatus, TransferContentContext } from '../transfer-content-handler';
import { ExistingContentAction } from '../..';
import { getSdkPlatform } from '../../../util/platform/platform-util';

jest.mock('../../../util/platform/platform-util', () => ({
    getSdkPlatform: jest.fn(() => 'cordova')
}));

declare const sbutility;

describe('ValidateDestinationFolder', () => {
    let validateDestinationFolder: ValidateDestinationFolder;
    const mockFileService: Partial<FileService> = {};

    const rootContentsInDb: ContentEntry.SchemaMap[] = [{
        identifier: 'IDENTIFIER',
        server_data: 'SERVER_DATA',
        local_data: '{"childNodes": [{"DOWNLOAD": 1}, "do_234", "do_345"], "artifactUrl": "http:///do_123"}',
        mime_type: '',
        manifest_version: 'MAINFEST_VERSION',
        content_type: 'textbook',
        content_state: 2,
        path: 'SAMPLE_PATH',
        primary_category: 'textbook'
    }];
    const dupContents: MoveContentResponse[] = [
        {
            identifier: 'SAMPLE_IDENTIFIER',
            status: MoveContentStatus.HIGHER_VERSION_IN_DESTINATION
        }
    ];
    const getRequest = (destinationFolder: string): TransferContentContext => ({
        contentIds: ['SAMPLE_ID', ''],
        destinationFolder,
        contentsInSource: rootContentsInDb,
        hasTransferCancelled: false,
        existingContentAction: ExistingContentAction.KEEP_HIGER_VERSION,
        duplicateContents: dupContents,
        validContentIdsInDestination: ['SAMPLE_CONTENT_1', 'SAMPLE_CONTENT_2'],
    });

    beforeAll(() => {
        validateDestinationFolder = new ValidateDestinationFolder(
            mockFileService as FileService
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (getSdkPlatform as jest.Mock).mockReturnValue('cordova');
    });

    it('should be create a instance of ValidateDestinationFolder', () => {
        expect(validateDestinationFolder).toBeTruthy();
    });

    it('should use existing directory nativeURL when directory exists', (done) => {
        // arrange
        spyOn(sbutility, 'canWrite').and.callFake((a, b, c) => {
            setTimeout(() => b(), 0);
        });
        const request = getRequest('SAMPLE_DESTINATION_FOLDER/');
        mockFileService.exists = jest.fn().mockResolvedValue({
            isFile: false,
            isDirectory: true,
            name: 'content',
            fullPath: 'SAMPLE_FULL_PATH',
            nativeURL: 'file:///SAMPLE_DESTINATION_FOLDER/content/'
        });
        mockFileService.createDir = jest.fn().mockResolvedValue({});
        // act
        validateDestinationFolder.execute(request).subscribe((ctx) => {
            // assert
            expect(sbutility.canWrite).toHaveBeenCalledWith('SAMPLE_DESTINATION_FOLDER/', expect.any(Function), expect.any(Function));
            expect(mockFileService.exists).toHaveBeenCalledWith('SAMPLE_DESTINATION_FOLDER/content');
            expect(mockFileService.createDir).not.toHaveBeenCalled();
            expect(ctx.destinationFolder).toBe('file:///SAMPLE_DESTINATION_FOLDER/content/');
            done();
        });
    });

    it('should create directory when existing entry has no nativeURL', (done) => {
        // arrange
        spyOn(sbutility, 'canWrite').and.callFake((a, b, c) => {
            setTimeout(() => b(), 0);
        });
        const request = getRequest('SAMPLE_DESTINATION_FOLDER/');
        mockFileService.exists = jest.fn().mockResolvedValue({
            isFile: true,
            isDirectory: true,
            name: 'SCAN_STORAGE',
            fullPath: 'SAMPLE_FULL_PATH',
            nativeURL: ''
        });
        mockFileService.createDir = jest.fn().mockResolvedValue({
            nativeURL: 'CREATED_URL'
        });
        // act
        validateDestinationFolder.execute(request).subscribe((ctx) => {
            // assert
            expect(mockFileService.createDir).toHaveBeenCalledWith('SAMPLE_DESTINATION_FOLDER/content', false);
            expect(ctx.destinationFolder).toBe('CREATED_URL');
            done();
        });
    });

    it('should create a directory when it does not exist', (done) => {
        // arrange
        spyOn(sbutility, 'canWrite').and.callFake((a, b, c) => {
            setTimeout(() => b(), 0);
        });
        const request = getRequest('SAMPLE_DESTINATION_FOLDER/content/');
        mockFileService.exists = jest.fn().mockRejectedValue({ code: 1 });
        mockFileService.createDir = jest.fn().mockResolvedValue({
            isFile: false,
            isDirectory: true,
            name: 'content',
            fullPath: 'SAMPLE_FULL_PATH',
            nativeURL: 'NEW_DIR_URL'
        });
        // act
        validateDestinationFolder.execute(request).subscribe((ctx) => {
            // assert
            expect(mockFileService.exists).toHaveBeenCalledWith('SAMPLE_DESTINATION_FOLDER/content/');
            expect(mockFileService.createDir).toHaveBeenCalledWith('SAMPLE_DESTINATION_FOLDER/content/', false);
            expect(ctx.destinationFolder).toBe('NEW_DIR_URL');
            done();
        });
    });

    it('should error when createDir fails after exists fails', (done) => {
        spyOn(sbutility, 'canWrite').and.callFake((a, b, c) => {
            setTimeout(() => b(), 0);
        });
        mockFileService.exists = jest.fn().mockRejectedValue({ code: 1 });
        mockFileService.createDir = jest.fn().mockRejectedValue('CREATE_FAILED');
        validateDestinationFolder.execute(getRequest('SAMPLE/')).subscribe(() => {
            fail();
        }, (e) => {
            expect(e.message).toBe('CREATE_FAILED');
            done();
        });
    });

    it('should error when destination is not writable', (done) => {
        spyOn(sbutility, 'canWrite').and.callFake((a, b, c) => {
            setTimeout(() => c('NOT_WRITABLE'), 0);
        });
        mockFileService.exists = jest.fn();
        validateDestinationFolder.execute(getRequest('SAMPLE/')).subscribe(() => {
            fail();
        }, (e) => {
            expect(e.message).toBe('Destination is not writable');
            expect(mockFileService.exists).not.toHaveBeenCalled();
            done();
        });
    });

    describe('capacitor platform', () => {
        beforeEach(() => {
            (getSdkPlatform as jest.Mock).mockReturnValue('capacitor');
        });

        it('should normalize to file uri and probe writability with createDir', (done) => {
            mockFileService.createDir = jest.fn().mockResolvedValue({ nativeURL: 'IGNORED' });
            mockFileService.exists = jest.fn().mockResolvedValue({ nativeURL: 'file:///storage/content' });
            validateDestinationFolder.execute(getRequest('/storage/')).subscribe((ctx) => {
                expect(mockFileService.createDir).toHaveBeenCalledWith('file:///storage/', false);
                expect(mockFileService.exists).toHaveBeenCalledWith('file:///storage/content');
                expect(ctx.destinationFolder).toBe('file:///storage/content');
                done();
            });
        });

        it('should error when createDir probe fails', (done) => {
            mockFileService.createDir = jest.fn().mockRejectedValue(new Error('EACCES'));
            mockFileService.exists = jest.fn();
            validateDestinationFolder.execute(getRequest('file:///storage/')).subscribe(() => fail(), (e) => {
                expect(e.message).toBe('Destination is not writable');
                expect(mockFileService.createDir).toHaveBeenCalledWith('file:///storage/', false);
                done();
            });
        });
    });
});
