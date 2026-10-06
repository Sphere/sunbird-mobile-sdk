import {NetworkRequestHandler} from './network-request-handler';
import {SdkConfig} from '../../../sdk-config';
import {NetworkQueueType} from '..';
import {HttpRequestType, HttpSerializer} from '../..';
import {TelemetrySyncHandler} from '../../../telemetry/handler/telemetry-sync-handler';
import {UpdateContentStateApiHandler} from '../../../course/handlers/update-content-state-api-handler';

describe('NetworkRequestHandler', () => {
  let networkRequestHandler: NetworkRequestHandler;
  const mockSdkConfig: Partial<SdkConfig> = {
    telemetryConfig: {
      host: 'SAMPLE_HOST',
      apiPath: '/api/data/v1'
    } as any,
    courseServiceConfig: {
      apiPath: '/api/course/v1'
    } as any
  };

  beforeAll(() => {
    networkRequestHandler = new NetworkRequestHandler(mockSdkConfig as SdkConfig);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be able to create an instance of NetworkRequestHandler', () => {
    expect(networkRequestHandler).toBeTruthy();
  });

  describe('generateNetworkQueueRequest', () => {
    it('should generate a gzipped RAW POST request for TELEMETRY type', () => {
      // arrange
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);
      const data = 'abc';

      // act
      const result = networkRequestHandler.generateNetworkQueueRequest(
        NetworkQueueType.TELEMETRY, data, 'SAMPLE_MSG_ID', 5, true
      );

      // assert
      expect(result.msgId).toBe('SAMPLE_MSG_ID');
      expect(result.data).toBe(data);
      expect(result.priority).toBe(2);
      expect(result.itemCount).toBe(5);
      expect(result.type).toBe(NetworkQueueType.TELEMETRY);
      expect(result.config).toBe(JSON.stringify({shouldPublishResult: true}));
      expect(result.ts).toBe(1234567890);

      const request = result.networkRequest;
      expect(request.type).toBe(HttpRequestType.POST);
      expect(request.serializer).toBe(HttpSerializer.RAW);
      expect(request.host).toBe('SAMPLE_HOST');
      expect(request.path).toBe('/api/data/v1' + TelemetrySyncHandler.TELEMETRY_ENDPOINT);
      expect(request.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      }));
      expect(request.withBearerToken).toBe(true);
      expect(request.body).toBeInstanceOf(Uint8Array);
      expect(Array.from(request.body as Uint8Array)).toEqual([97, 98, 99]);
    });

    it('should generate a PATCH request with user token for COURSE_PROGRESS type', () => {
      // arrange
      const data = {userId: 'SAMPLE_USER_ID', contents: [{contentId: 'do_123', status: 2}]};

      // act
      const result = networkRequestHandler.generateNetworkQueueRequest(
        NetworkQueueType.COURSE_PROGRESS, data, 'SAMPLE_MSG_ID', 1, false
      );

      // assert
      expect(result.msgId).toBe('SAMPLE_MSG_ID');
      expect(result.data).toBe(JSON.stringify(data));
      expect(result.priority).toBe(1);
      expect(result.itemCount).toBe(1);
      expect(result.type).toBe(NetworkQueueType.COURSE_PROGRESS);
      expect(result.config).toBe(JSON.stringify({shouldPublishResult: false}));
      expect(typeof result.ts).toBe('number');

      const request = result.networkRequest;
      expect(request.type).toBe(HttpRequestType.PATCH);
      expect(request.path).toBe('/api/course/v1' + UpdateContentStateApiHandler.UPDATE_CONTENT_STATE_ENDPOINT);
      expect(request.withBearerToken).toBe(true);
      expect(request.withUserToken).toBe(true);
      expect(request.body).toBe(data);
    });

    it('should treat COURSE_ASSESMENT type like a non-telemetry request', () => {
      // arrange
      const data = {assessments: []};

      // act
      const result = networkRequestHandler.generateNetworkQueueRequest(
        NetworkQueueType.COURSE_ASSESMENT, data, 'SAMPLE_MSG_ID', 0, undefined
      );

      // assert
      expect(result.priority).toBe(1);
      expect(result.data).toBe(JSON.stringify(data));
      expect(result.networkRequest.type).toBe(HttpRequestType.PATCH);
      expect(result.config).toBe(JSON.stringify({shouldPublishResult: undefined}));
    });
  });
});
