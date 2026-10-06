import { GetEnrolledCourseHandler } from './get-enrolled-course-handler';
import { KeyValueStore, ApiService, SharedPreferences } from '../..';
import { CourseServiceConfig, CourseServiceImpl, FetchEnrolledCourseRequest } from '..';
import { of, throwError } from 'rxjs';
import { GetEnrolledCourseResponse } from '../def/get-enrolled-course-response';

describe('GetEnrolledCourseHandler', () => {
    let getEnrolledCourseHandler: GetEnrolledCourseHandler;
    const mockKeyValueStore: Partial<KeyValueStore> = {};
    const mockApiService: Partial<ApiService> = {};
    const mockCourseServiceConfig: Partial<CourseServiceConfig> = {apiPath: '/api/course/v1'};
    const mockSharedPreference: Partial<SharedPreferences> = {};

    const SAMPLE_COURSES = [
        {userId: 'uid-1234589', contentId: 'do_1', batchId: 'b1', lastReadContentId: 'do_1_child'},
        {userId: 'uid-1234589', contentId: 'do_2', batchId: 'b2'}
    ];
    const SAMPLE_RESPONSE: GetEnrolledCourseResponse = {
        id: 'sid',
        params: {resmsgid: 'string'},
        result: {
            courses: SAMPLE_COURSES as any,
        }
    };

    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
        jest.clearAllMocks();
        mockSharedPreference.putString = jest.fn(() => of(undefined));
        mockKeyValueStore.setValue = jest.fn(() => of(true));
        getEnrolledCourseHandler = new GetEnrolledCourseHandler(
            mockKeyValueStore as KeyValueStore,
            mockApiService as ApiService,
            mockCourseServiceConfig as CourseServiceConfig,
            mockSharedPreference as SharedPreferences
        );
    });

    it('should be create a instance of getEnrolledCourseHandler', () => {
        expect(getEnrolledCourseHandler).toBeTruthy();
    });

    it('should fetch course from server if keyvalue unavailable and store last read content', (done) => {
        // arrange
        const request: FetchEnrolledCourseRequest = {
            userId: 'uid-1234589',
            returnFreshCourses: true
        };
        mockKeyValueStore.getValue = jest.fn(() => of(undefined));
        mockApiService.fetch = jest.fn(() => of({body: SAMPLE_RESPONSE})) as any;
        // act
        getEnrolledCourseHandler.handle(request).subscribe(async (courses) => {
            // assert
            expect(courses).toEqual(SAMPLE_COURSES);
            expect(mockKeyValueStore.getValue).toHaveBeenCalledWith('enrolledCoursesuid-1234589');
            expect((mockApiService.fetch as jest.Mock).mock.calls[0][0].path)
                .toContain('/api/course/v1/user/enrollment/list/uid-1234589');
            expect(mockKeyValueStore.setValue).toHaveBeenCalledWith('enrolledCoursesuid-1234589', JSON.stringify(SAMPLE_RESPONSE));
            await flush();
            expect(mockSharedPreference.putString).toHaveBeenCalledTimes(1);
            expect(mockSharedPreference.putString).toHaveBeenCalledWith(
                CourseServiceImpl.LAST_READ_CONTENTID_PREFIX + '_uid-1234589_do_1_b1', 'do_1_child');
            done();
        });
    });

    it('should use custom apiHandler when provided', (done) => {
        const mockApiHandler = {handle: jest.fn(() => of(SAMPLE_RESPONSE))};
        getEnrolledCourseHandler = new GetEnrolledCourseHandler(
            mockKeyValueStore as KeyValueStore,
            mockApiService as ApiService,
            mockCourseServiceConfig as CourseServiceConfig,
            mockSharedPreference as SharedPreferences,
            mockApiHandler
        );
        mockKeyValueStore.getValue = jest.fn(() => of(undefined));
        mockApiService.fetch = jest.fn();
        getEnrolledCourseHandler.handle({userId: 'uid-1234589'}).subscribe((courses) => {
            expect(courses).toEqual(SAMPLE_COURSES);
            expect(mockApiHandler.handle).toHaveBeenCalledWith({userId: 'uid-1234589'});
            expect(mockApiService.fetch).not.toHaveBeenCalled();
            done();
        });
    });

    it('should fetch fresh course from server if keyvalue available and returnFreshCourses', (done) => {
        // arrange
        const request: FetchEnrolledCourseRequest = {
            userId: 'uid-1234589',
            returnFreshCourses: true
        };
        mockKeyValueStore.getValue = jest.fn(() => of(JSON.stringify({result: {courses: []}})));
        mockApiService.fetch = jest.fn(() => of({body: SAMPLE_RESPONSE})) as any;
        // act
        getEnrolledCourseHandler.handle(request).subscribe((courses) => {
            // assert
            expect(courses).toEqual(SAMPLE_COURSES);
            expect(mockKeyValueStore.getValue).toHaveBeenCalled();
            expect(mockApiService.fetch).toHaveBeenCalled();
            expect(mockKeyValueStore.setValue).toHaveBeenCalled();
            done();
        });
    });

    it('should fallback to stored result.courses if server fetch fails', (done) => {
        const request: FetchEnrolledCourseRequest = {
            userId: 'uid-1234589',
            returnFreshCourses: true
        };
        mockKeyValueStore.getValue = jest.fn(() => of(JSON.stringify(SAMPLE_RESPONSE)));
        mockApiService.fetch = jest.fn(() => throwError(new Error('network'))) as any;
        getEnrolledCourseHandler.handle(request).subscribe((courses) => {
            expect(courses).toEqual(SAMPLE_COURSES);
            expect(mockApiService.fetch).toHaveBeenCalled();
            expect(mockKeyValueStore.setValue).not.toHaveBeenCalled();
            done();
        });
    });

    it('should fallback to stored top-level courses if server fetch fails', (done) => {
        const request: FetchEnrolledCourseRequest = {
            userId: 'uid-1234589',
            returnFreshCourses: true
        };
        mockKeyValueStore.getValue = jest.fn(() => of(JSON.stringify({courses: SAMPLE_COURSES})));
        mockApiService.fetch = jest.fn(() => throwError(new Error('network'))) as any;
        getEnrolledCourseHandler.handle(request).subscribe((courses) => {
            expect(courses).toEqual(SAMPLE_COURSES);
            done();
        });
    });

    it('should return stored result.courses when returnFreshCourses is false', (done) => {
        // arrange
        const request: FetchEnrolledCourseRequest = {
            userId: 'uid-1234589',
            returnFreshCourses: false
        };
        mockKeyValueStore.getValue = jest.fn(() => of(JSON.stringify(SAMPLE_RESPONSE)));
        mockApiService.fetch = jest.fn();
        // act
        getEnrolledCourseHandler.handle(request).subscribe((courses) => {
            // assert
            expect(courses).toEqual(SAMPLE_COURSES);
            expect(mockKeyValueStore.getValue).toHaveBeenCalled();
            expect(mockApiService.fetch).not.toHaveBeenCalled();
            done();
        });
    });

    it('should return stored top-level courses when returnFreshCourses is false', (done) => {
        const request: FetchEnrolledCourseRequest = {
            userId: 'uid-1234589',
            returnFreshCourses: false
        };
        mockKeyValueStore.getValue = jest.fn(() => of(JSON.stringify({courses: SAMPLE_COURSES})));
        getEnrolledCourseHandler.handle(request).subscribe((courses) => {
            expect(courses).toEqual(SAMPLE_COURSES);
            done();
        });
    });
});
