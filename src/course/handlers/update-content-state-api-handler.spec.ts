import {SdkConfig} from '../..';
import {of} from 'rxjs';
import {NetworkQueue, NetworkQueueType} from '../../api/network-queue';
import {UpdateContentStateApiHandler} from './update-content-state-api-handler';
import { UniqueId } from '../../db/util/unique-id';

describe('UpdateContentStateApiHandler', () => {
  let updateContentStateApiHandler: UpdateContentStateApiHandler;
  const mockSdkConfig: Partial<SdkConfig> = {
    courseServiceConfig: {
      apiPath: 'SOME_PATH'
    }
  };
  const mockNetworkQueue: Partial<NetworkQueue> = {
    enqueue: jest.fn(() => of({} as any))
  };
  beforeAll(() => {
    updateContentStateApiHandler = new UpdateContentStateApiHandler(
      mockNetworkQueue as NetworkQueue,
      mockSdkConfig as SdkConfig
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(UniqueId, 'generateUniqueId').mockImplementation(() => 'SECRET');
  });

  it('should be create a instance of syncAssessmentEventsHandler', () => {
    expect(updateContentStateApiHandler).toBeTruthy();
  });

  describe('handle()', () => {
    it('should enqueue the progress information', (done) => {
      // arrange
      sbsync.onSyncSucces = jest.fn((success, error) => {
        success({courseProgressResponse: 'progress_response'});
      });
      // act
      updateContentStateApiHandler.handle({} as any).subscribe((e) => {
        // assert
        expect(mockNetworkQueue.enqueue).toBeCalledTimes(1);
        const [queueRequest, shouldSync] = (mockNetworkQueue.enqueue as jest.Mock).mock.calls[0];
        expect(queueRequest.type).toBe(NetworkQueueType.COURSE_PROGRESS);
        expect(queueRequest.msgId).toBe('SECRET');
        expect(queueRequest.itemCount).toBe(0);
        expect(queueRequest.networkRequest.path).toBe('SOME_PATH' + UpdateContentStateApiHandler.UPDATE_CONTENT_STATE_ENDPOINT);
        expect(shouldSync).toBe(true);
        expect(e).toBe('progress_response');
        done();
      });
    });

    it('should emit error when sync returns course_progress_error', (done) => {
      // arrange
      sbsync.onSyncSucces = jest.fn((success, _) => {
        success({course_progress_error: 'progress_response_error'});
      });
      // act
      updateContentStateApiHandler.handle({contents: [{}, {}]} as any).subscribe(() => {
        fail();
      }, (error) => {
        // assert
        expect(mockNetworkQueue.enqueue).toBeCalledTimes(1);
        expect((mockNetworkQueue.enqueue as jest.Mock).mock.calls[0][0].itemCount).toBe(2);
        expect(error).toEqual('progress_response_error');
        done();
      });
    });

    it('should complete without value when sync response has neither progress nor error', (done) => {
      sbsync.onSyncSucces = jest.fn((success, _) => {
        success({});
      });
      const next = jest.fn();
      updateContentStateApiHandler.handle({} as any).subscribe(next, () => fail(), () => {
        expect(next).not.toHaveBeenCalled();
        done();
      });
    });

    it('should send the error response returned from sync plugin', (done) => {
      // arrange
      sbsync.onSyncSucces = jest.fn((_, error) => {
        error!({course_progress_error: 'progress_response_error'});
      });
      // act
      updateContentStateApiHandler.handle({} as any).subscribe(() => {
        fail();
      }, (error) => {
        // assert
        expect(mockNetworkQueue.enqueue).toBeCalledTimes(1);
        expect(error).toEqual({course_progress_error: 'progress_response_error'});
        done();
      });
    });
  });
});
