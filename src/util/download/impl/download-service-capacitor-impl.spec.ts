import 'reflect-metadata';
import { DownloadServiceCapacitorImpl } from './download-service-capacitor-impl';
import { EventsBusService, EventNamespace } from '../../../events-bus';
import { SharedPreferencesLocalStorage } from '../../shared-preferences/impl/shared-preferences-local-storage';
import { DownloadRequest } from '../def/requests';
import { DownloadEventType, DownloadProgress } from '../def/download-event';
import { DownloadStatus } from '../def/download-status';
import { DownloadCompleteDelegate } from '../def/download-complete-delegate';
import { FilePaths } from '../../../services/file-path/file-path.enum';
import { InteractSubType } from '../../../telemetry';
import { of } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

// ── Mock capacitor-plugin-downloadmanager ─────────────────────────────────────
const mockEnqueue = jest.fn();
const mockQuery = jest.fn();
const mockRemove = jest.fn();
const mockFetchSpeedLog = jest.fn();

jest.mock('capacitor-plugin-downloadmanager', () => ({
    DownloadManager: {
        enqueue: (...a: any[]) => mockEnqueue(...a),
        query: (...a: any[]) => mockQuery(...a),
        remove: (...a: any[]) => mockRemove(...a),
        fetchSpeedLog: (...a: any[]) => mockFetchSpeedLog(...a),
    },
}));

// ── Mock platform / file path / telemetry ─────────────────────────────────────
const mockGetPlatform = jest.fn();
jest.mock('../../platform/platform-util', () => ({
    getPlatform: () => mockGetPlatform(),
}));

const mockGetFilePath = jest.fn();
jest.mock('../../../services/file-path/file-path.service', () => ({
    FilePathService: {
        getFilePath: (...a: any[]) => mockGetFilePath(...a),
    },
}));

const mockInteract = jest.fn();
jest.mock('../../../telemetry/util/telemetry-logger', () => ({
    TelemetryLogger: {
        log: {
            interact: (...a: any[]) => mockInteract(...a),
        },
    },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// settles promise chains (plugin callbacks + async taps) between assertions
const flush = async () => {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
};

const buildRequest = (identifier: string, extra: Partial<DownloadRequest> & { [key: string]: any } = {}): DownloadRequest => ({
    identifier,
    downloadUrl: `http://sample-url/${identifier}.ecar`,
    mimeType: 'application/ecar',
    destinationFolder: 'SAMPLE_DESTINATION',
    filename: `${identifier}.ecar`,
    ...extra
});

const progressEntry = (bytesDownloadedSoFar: number, totalSizeBytes: number, status: DownloadStatus) => ({
    bytesDownloadedSoFar,
    totalSizeBytes,
    status
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DownloadServiceCapacitorImpl', () => {
    let downloadService: DownloadServiceCapacitorImpl;
    const mockEventsBusService: Partial<EventsBusService> = {};
    const sharedPreferences = new SharedPreferencesLocalStorage();

    const queuedIdentifiers = async () =>
        (await downloadService['sharedPreferencesSetCollection'].asList().toPromise())
            .map((r: DownloadRequest) => r.identifier)
            .sort();

    const currentRequest = (): DownloadRequest | undefined => downloadService['currentDownloadRequest$'].getValue();

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.useRealTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});

        mockEventsBusService.emit = jest.fn();
        mockEnqueue.mockResolvedValue({ id: 'SAMPLE_DOWNLOAD_ID' });
        mockQuery.mockResolvedValue({ downloads: [] });
        mockRemove.mockResolvedValue({ removed: 1 });
        mockGetPlatform.mockReturnValue('android');
        mockGetFilePath.mockResolvedValue('file:///storage/emulated/0/Android/data/app/files/');
        mockInteract.mockReturnValue(of(true));

        downloadService = new DownloadServiceCapacitorImpl(mockEventsBusService as EventsBusService, sharedPreferences);
        await downloadService['sharedPreferencesSetCollection'].clear().toPromise();
    });

    it('should be able to create an instance', () => {
        expect(downloadService).toBeTruthy();
    });

    // ── downloadManager shim ──────────────────────────────────────────────────

    describe('window.downloadManager shim', () => {
        const shim = (): any => window['downloadManager'];

        it('should be installed on window by the constructor', () => {
            expect(window['downloadManager']).toEqual({
                enqueue: expect.any(Function),
                query: expect.any(Function),
                remove: expect.any(Function),
                fetchSpeedLog: expect.any(Function)
            });
        });

        it('enqueue() should map uri to url, drop headers and return the plugin id', async () => {
            const callback = jest.fn();

            shim().enqueue({
                uri: 'http://sample-url', title: 'T', headers: [{ header: 'h', value: 'v' }]
            }, callback);
            await flush();

            expect(mockEnqueue).toHaveBeenCalledWith({ url: 'http://sample-url', title: 'T', headers: [] });
            expect(callback).toHaveBeenCalledWith(undefined, 'SAMPLE_DOWNLOAD_ID');
        });

        it('enqueue() should pass plugin errors to the callback', async () => {
            const error = new Error('enqueue failed');
            mockEnqueue.mockRejectedValue(error);
            const callback = jest.fn();

            shim().enqueue({ uri: 'http://sample-url' }, callback);
            await flush();

            expect(callback).toHaveBeenCalledWith(error, undefined);
        });

        it('query() should return the plugin downloads, or [] on error', async () => {
            const downloads = [{ id: '1' }];
            mockQuery.mockResolvedValueOnce({ downloads }).mockRejectedValueOnce(new Error('query failed'));
            const okCallback = jest.fn();
            const errCallback = jest.fn();

            shim().query({ ids: ['1'] }, okCallback);
            shim().query({ ids: ['1'] }, errCallback);
            await flush();

            expect(mockQuery).toHaveBeenCalledWith({ ids: ['1'] });
            expect(okCallback).toHaveBeenCalledWith(undefined, downloads);
            expect(errCallback).toHaveBeenCalledWith(expect.any(Error), []);
        });

        it('remove() should wrap ids and return the removed count, or 0 on error', async () => {
            mockRemove.mockResolvedValueOnce({ removed: 2 }).mockRejectedValueOnce(new Error('remove failed'));
            const okCallback = jest.fn();
            const errCallback = jest.fn();

            shim().remove(['1', '2'], okCallback);
            shim().remove(['1'], errCallback);
            await flush();

            expect(mockRemove).toHaveBeenCalledWith({ ids: ['1', '2'] });
            expect(okCallback).toHaveBeenCalledWith(undefined, 2);
            expect(errCallback).toHaveBeenCalledWith(expect.any(Error), 0);
        });

        it('fetchSpeedLog() should call the success or error callback', async () => {
            const speedLog = { totalKBdownloaded: 10 };
            mockFetchSpeedLog.mockResolvedValueOnce(speedLog).mockRejectedValueOnce(new Error('failed'));
            const success = jest.fn();
            const error = jest.fn();

            shim().fetchSpeedLog(success, error);
            await flush();
            expect(success).toHaveBeenCalledWith(undefined, speedLog);

            shim().fetchSpeedLog(success, error);
            await flush();
            expect(error).toHaveBeenCalledTimes(1);
        });

        it('should not throw when callbacks are omitted', async () => {
            mockEnqueue.mockRejectedValue(new Error('x'));
            mockQuery.mockRejectedValue(new Error('x'));
            mockRemove.mockRejectedValue(new Error('x'));

            shim().enqueue({ uri: 'u' });
            shim().query(undefined);
            shim().remove(['1']);
            await flush();

            expect(mockEnqueue).toHaveBeenCalled();
        });
    });

    // ── download ──────────────────────────────────────────────────────────────

    describe('download()', () => {
        it('should queue the requests and start the highest-priority one when idle', async () => {
            const low = buildRequest('do_low', { withPriority: 1 });
            const high = buildRequest('do_high', { withPriority: 5 });
            const none = buildRequest('do_none');

            await downloadService.download([low, high, none]).toPromise();
            await flush();

            expect(await queuedIdentifiers()).toEqual(['do_high', 'do_low', 'do_none']);
            expect(mockEnqueue).toHaveBeenCalledTimes(1);
            expect(mockEnqueue).toHaveBeenCalledWith({
                url: high.downloadUrl,
                title: high.filename,
                description: '',
                mimeType: high.mimeType,
                visibleInDownloadsUi: true,
                notificationVisibility: 1,
                destinationInExternalFilesDir: { dirType: 'Download', subPath: high.filename },
                headers: []
            });
            expect(currentRequest()).toEqual(expect.objectContaining({
                identifier: 'do_high',
                downloadId: 'SAMPLE_DOWNLOAD_ID',
                downloadedFilePath: 'file:///storage/emulated/0/Android/data/app/files/Download/do_high.ecar'
            }));
        });

        it('should use the EXTERNAL directory on android', async () => {
            await downloadService.download([buildRequest('do_1')]).toPromise();
            await flush();

            expect(mockGetFilePath).toHaveBeenCalledWith(FilePaths.EXTERNAL);
        });

        it('should use the DOCUMENTS directory on ios', async () => {
            mockGetPlatform.mockReturnValue('ios');
            mockGetFilePath.mockResolvedValue('file:///var/mobile/Documents/');

            await downloadService.download([buildRequest('do_1')]).toPromise();
            await flush();

            expect(mockGetFilePath).toHaveBeenCalledWith(FilePaths.DOCUMENTS);
            expect(currentRequest()!.downloadedFilePath).toBe('file:///var/mobile/Documents/Download/do_1.ecar');
        });

        it('should log CONTENT_DOWNLOAD_INITIATE telemetry using the content meta', async () => {
            const request = buildRequest('do_1', {
                contentMeta: { primaryCategory: 'Course', pkgVersion: 3 },
                correlationData: [{ id: 'c', type: 't' }]
            });

            await downloadService.download([request]).toPromise();
            await flush();

            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_INITIATE,
                objId: 'do_1',
                objType: 'Course',
                objVer: 3,
                correlationData: [{ id: 'c', type: 't' }]
            }));
        });

        it('should default telemetry objType/objVer/correlationData when content meta is missing', async () => {
            await downloadService.download([buildRequest('do_1')]).toPromise();
            await flush();

            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_INITIATE,
                objType: 'Content',
                objVer: '',
                correlationData: []
            }));
        });

        it('should only queue the requests when a download is already in progress', async () => {
            await downloadService.download([buildRequest('do_1')]).toPromise();
            await flush();
            mockEnqueue.mockClear();

            await downloadService.download([buildRequest('do_2')]).toPromise();
            await flush();

            expect(mockEnqueue).not.toHaveBeenCalled();
            expect(currentRequest()!.identifier).toBe('do_1');
            expect(await queuedIdentifiers()).toEqual(['do_1', 'do_2']);
        });

        it('should drop the request from the queue when the native enqueue fails', async () => {
            mockEnqueue.mockRejectedValueOnce(new Error('enqueue failed'));

            await downloadService.download([buildRequest('do_1')]).toPromise();
            await flush();

            expect(await queuedIdentifiers()).toEqual([]);
            expect(currentRequest()).toBeUndefined();
            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_CANCEL,
                objId: 'do_1'
            }));
        });
    });

    // ── cancel ────────────────────────────────────────────────────────────────

    describe('cancel()', () => {
        beforeEach(async () => {
            await downloadService.download([
                buildRequest('do_1', { withPriority: 2 }),
                buildRequest('do_2', { withPriority: 1 })
            ]).toPromise();
            await flush();
            jest.clearAllMocks();
            mockEnqueue.mockResolvedValue({ id: 'NEXT_DOWNLOAD_ID' });
        });

        it('should remove the native download, dequeue it and start the next one when cancelling the current request', async () => {
            await downloadService.cancel({ identifier: 'do_1' }).toPromise();
            await flush();

            expect(mockRemove).toHaveBeenCalledWith({ ids: ['SAMPLE_DOWNLOAD_ID'] });
            expect(await queuedIdentifiers()).toEqual(['do_2']);
            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_CANCEL,
                objId: 'do_1'
            }));
            expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://sample-url/do_2.ecar' }));
            expect(currentRequest()).toEqual(expect.objectContaining({
                identifier: 'do_2',
                downloadId: 'NEXT_DOWNLOAD_ID'
            }));
        });

        it('should clear the current request when the last queued item is cancelled', async () => {
            await downloadService.cancel({ identifier: 'do_2' }).toPromise();
            await downloadService.cancel({ identifier: 'do_1' }).toPromise();
            await flush();

            expect(await queuedIdentifiers()).toEqual([]);
            expect(currentRequest()).toBeUndefined();
        });

        it('should only dequeue a request that is not currently downloading', async () => {
            await downloadService.cancel({ identifier: 'do_2' }).toPromise();
            await flush();

            expect(mockRemove).not.toHaveBeenCalled();
            expect(mockEnqueue).not.toHaveBeenCalled();
            expect(await queuedIdentifiers()).toEqual(['do_1']);
            expect(currentRequest()!.identifier).toBe('do_1');
        });

        it('should not log telemetry when generateTelemetry is false', async () => {
            await downloadService.cancel({ identifier: 'do_2' }, false).toPromise();
            await flush();

            expect(await queuedIdentifiers()).toEqual(['do_1']);
            expect(mockInteract).not.toHaveBeenCalled();
        });

        it('should read objType/objVer for cancel telemetry from the content meta', async () => {
            await downloadService['sharedPreferencesSetCollection'].addAll([
                buildRequest('do_meta', { contentMeta: { primaryCategory: 'Course', pkgVersion: 4 } })
            ]).toPromise();

            await downloadService.cancel({ identifier: 'do_meta' }).toPromise();
            await flush();

            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_CANCEL,
                objId: 'do_meta',
                objType: 'Course',
                objVer: 4
            }));
        });

        it('should do nothing for an identifier that is not queued', async () => {
            await downloadService.cancel({ identifier: 'do_unknown' }).toPromise();
            await flush();

            expect(await queuedIdentifiers()).toEqual(['do_1', 'do_2']);
            expect(mockInteract).not.toHaveBeenCalled();
        });

        it('should error when the native remove fails', async () => {
            mockRemove.mockRejectedValue(new Error('remove failed'));

            await expect(downloadService.cancel({ identifier: 'do_1' }).toPromise()).rejects.toThrow('remove failed');
        });
    });

    // ── cancelAll ─────────────────────────────────────────────────────────────

    describe('cancelAll()', () => {
        it('should remove the native download, clear the queue and log cancel telemetry for each request', async () => {
            await downloadService.download([buildRequest('do_1'), buildRequest('do_2')]).toPromise();
            await flush();
            jest.clearAllMocks();

            await downloadService.cancelAll().toPromise();
            await flush();

            expect(mockRemove).toHaveBeenCalledWith({ ids: ['SAMPLE_DOWNLOAD_ID'] });
            expect(await queuedIdentifiers()).toEqual([]);
            expect(currentRequest()).toBeUndefined();
            const cancelledIds = mockInteract.mock.calls
                .filter((c: any[]) => c[0].subType === InteractSubType.CONTENT_DOWNLOAD_CANCEL)
                .map((c: any[]) => c[0].objId)
                .sort();
            expect(cancelledIds).toEqual(['do_1', 'do_2']);
        });

        it('should just clear the queue when nothing is downloading', async () => {
            await downloadService['sharedPreferencesSetCollection'].addAll([buildRequest('do_1')]).toPromise();

            await downloadService.cancelAll().toPromise();
            await flush();

            expect(mockRemove).not.toHaveBeenCalled();
            expect(await queuedIdentifiers()).toEqual([]);
        });

        it('should error when the native remove fails', async () => {
            await downloadService.download([buildRequest('do_1')]).toPromise();
            await flush();
            mockRemove.mockRejectedValue(new Error('remove failed'));

            await expect(downloadService.cancelAll().toPromise()).rejects.toThrow('remove failed');
        });
    });

    // ── getActiveDownloadRequests ─────────────────────────────────────────────

    describe('getActiveDownloadRequests()', () => {
        it('should return queued requests sorted by priority, highest first', async () => {
            await downloadService['sharedPreferencesSetCollection'].addAll([
                buildRequest('do_low', { withPriority: 1 }),
                buildRequest('do_none'),
                buildRequest('do_high', { withPriority: 9 })
            ]).toPromise();

            const list = await downloadService.getActiveDownloadRequests().pipe(take(1)).toPromise();

            expect(list.map(r => r.identifier)).toEqual(['do_high', 'do_low', 'do_none']);
        });
    });

    // ── trackDownloads / onContentDelete ──────────────────────────────────────

    describe('trackDownloads()', () => {
        it('should return EMPTY when groupBy fieldPath or value is missing', async () => {
            const noField = await downloadService.trackDownloads({ groupBy: { fieldPath: '', value: 'x' } })
                .pipe(toArray()).toPromise();
            const noValue = await downloadService.trackDownloads({ groupBy: { fieldPath: 'a', value: undefined } })
                .pipe(toArray()).toPromise();

            expect(noField).toEqual([]);
            expect(noValue).toEqual([]);
        });

        it('should group queued and completed requests by a nested field path', async () => {
            await downloadService['sharedPreferencesSetCollection'].addAll([
                buildRequest('do_1', { contentMeta: { batchId: 'B1' } }),
                buildRequest('do_2', { contentMeta: { batchId: 'B2' } }),
                buildRequest('do_3')
            ]).toPromise();
            downloadService['completedDownloadRequestsCache'].add(buildRequest('do_done', { contentMeta: { batchId: 'B1' } }));
            downloadService['completedDownloadRequestsCache'].add(buildRequest('do_other', { contentMeta: { batchId: 'B2' } }));

            const tracking = await downloadService.trackDownloads({
                groupBy: { fieldPath: 'contentMeta.batchId', value: 'B1' }
            }).pipe(take(1)).toPromise();

            expect(tracking.queued.map(r => r.identifier)).toEqual(['do_1']);
            expect(tracking.completed.map(r => r.identifier)).toEqual(['do_done']);
        });

        it('should return empty lists when nothing is queued or completed', async () => {
            const tracking = await downloadService.trackDownloads({
                groupBy: { fieldPath: 'contentMeta.batchId', value: 'B1' }
            }).pipe(take(1)).toPromise();

            expect(tracking).toEqual({ queued: [], completed: [] });
        });
    });

    describe('onContentDelete()', () => {
        it('should remove the identifier from the completed downloads cache', () => {
            downloadService['completedDownloadRequestsCache'].add(buildRequest('do_1'));
            downloadService['completedDownloadRequestsCache'].add(buildRequest('do_2'));

            downloadService.onContentDelete('do_1');

            expect(downloadService['completedDownloadRequestsCache'].toArray().map(r => r.identifier)).toEqual(['do_2']);
        });
    });

    // ── progress tracking ─────────────────────────────────────────────────────

    describe('getDownloadProgress()', () => {
        const request = buildRequest('do_1', { downloadId: 'SAMPLE_DOWNLOAD_ID' });

        it('should report the progress percentage from the native entry', async () => {
            mockQuery.mockResolvedValue({ downloads: [progressEntry(25, 100, DownloadStatus.STATUS_RUNNING)] });

            const progress = await downloadService['getDownloadProgress'](request).toPromise();

            expect(mockQuery).toHaveBeenCalledWith({ ids: ['SAMPLE_DOWNLOAD_ID'] });
            expect(progress).toEqual({
                type: DownloadEventType.PROGRESS,
                payload: {
                    downloadId: 'SAMPLE_DOWNLOAD_ID',
                    identifier: 'do_1',
                    progress: 25,
                    bytesDownloaded: 25,
                    totalSizeInBytes: 100,
                    status: DownloadStatus.STATUS_RUNNING
                }
            });
        });

        it('should report -1 progress when the total size is unknown', async () => {
            mockQuery.mockResolvedValue({ downloads: [progressEntry(10, -1, DownloadStatus.STATUS_PENDING)] });

            const progress = await downloadService['getDownloadProgress'](request).toPromise();

            expect(progress.payload.progress).toBe(-1);
        });

        it('should report STATUS_FAILED when the native entry is missing', async () => {
            mockQuery.mockResolvedValue({ downloads: [] });

            const progress = await downloadService['getDownloadProgress'](request).toPromise();

            expect(progress.payload).toEqual(expect.objectContaining({ progress: -1, status: DownloadStatus.STATUS_FAILED }));
        });

        it('should report STATUS_FAILED and cancel the request when the query fails', async () => {
            mockQuery.mockRejectedValue(new Error('query failed'));
            const cancelSpy = jest.spyOn(downloadService, 'cancel');

            const progress = await downloadService['getDownloadProgress'](request).toPromise();

            expect(progress.payload).toEqual(expect.objectContaining({ progress: -1, status: DownloadStatus.STATUS_FAILED }));
            expect(cancelSpy).toHaveBeenCalledWith({ identifier: 'do_1' });
        });
    });

    describe('handleDownloadCompletion()', () => {
        const progressWithStatus = (status: DownloadStatus) => ({
            type: DownloadEventType.PROGRESS,
            payload: { downloadId: 'SAMPLE_DOWNLOAD_ID', identifier: 'do_1', progress: 100, bytesDownloaded: 1, totalSizeInBytes: 1, status }
        } as DownloadProgress);

        let delegate: DownloadCompleteDelegate;

        beforeEach(() => {
            downloadService['currentDownloadRequest$'].next(buildRequest('do_1'));
            delegate = { onDownloadCompletion: jest.fn().mockReturnValue(of(undefined)) };
        });

        it('should cache the request, log success telemetry and call the delegate on success', async () => {
            downloadService.registerOnDownloadCompleteDelegate(delegate);

            await downloadService['handleDownloadCompletion'](progressWithStatus(DownloadStatus.STATUS_SUCCESSFUL)).toPromise();

            expect(downloadService['completedDownloadRequestsCache'].toArray().map(r => r.identifier)).toEqual(['do_1']);
            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_SUCCESS,
                objId: 'do_1'
            }));
            expect(delegate.onDownloadCompletion).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'do_1' }));
        });

        it('should read objType/objVer for success telemetry from the content meta', async () => {
            downloadService['currentDownloadRequest$'].next(
                buildRequest('do_1', { contentMeta: { primaryCategory: 'Course', pkgVersion: 2 } }));
            downloadService.registerOnDownloadCompleteDelegate(delegate);

            await downloadService['handleDownloadCompletion'](progressWithStatus(DownloadStatus.STATUS_SUCCESSFUL)).toPromise();

            expect(mockInteract).toHaveBeenCalledWith(expect.objectContaining({
                subType: InteractSubType.CONTENT_DOWNLOAD_SUCCESS,
                objType: 'Course',
                objVer: 2
            }));
        });

        it('should only complete after the delegate has finished', async () => {
            let finishDelegate: () => void = () => {};
            delegate.onDownloadCompletion = jest.fn().mockReturnValue(
                new (require('rxjs').Observable)((o) => { finishDelegate = () => { o.next(undefined); o.complete(); }; })
            );
            downloadService.registerOnDownloadCompleteDelegate(delegate);
            const done = jest.fn();

            downloadService['handleDownloadCompletion'](progressWithStatus(DownloadStatus.STATUS_SUCCESSFUL))
                .toPromise().then(done);
            await flush();
            expect(done).not.toHaveBeenCalled();

            finishDelegate();
            await flush();
            expect(done).toHaveBeenCalled();
        });

        it('should still cache the request when no delegate is registered', async () => {
            await downloadService['handleDownloadCompletion'](progressWithStatus(DownloadStatus.STATUS_SUCCESSFUL)).toPromise();

            expect(downloadService['completedDownloadRequestsCache'].size()).toBe(1);
            expect(mockInteract).not.toHaveBeenCalled();
        });

        it('should do nothing for a non-successful status', async () => {
            downloadService.registerOnDownloadCompleteDelegate(delegate);

            await downloadService['handleDownloadCompletion'](progressWithStatus(DownloadStatus.STATUS_RUNNING)).toPromise();

            expect(downloadService['completedDownloadRequestsCache'].size()).toBe(0);
            expect(delegate.onDownloadCompletion).not.toHaveBeenCalled();
        });
    });

    describe('onInit()', () => {
        it('should emit and do nothing else when the queue is empty', async () => {
            const result = await downloadService.onInit().pipe(take(1)).toPromise();

            expect(result).toBeUndefined();
            expect(mockEnqueue).not.toHaveBeenCalled();
            expect(mockEventsBusService.emit).not.toHaveBeenCalled();
        });

        it('should resume a queued download and publish START, PROGRESS and END events while polling', async () => {
            jest.useFakeTimers();
            const delegate: DownloadCompleteDelegate = { onDownloadCompletion: jest.fn().mockReturnValue(of(undefined)) };
            downloadService.registerOnDownloadCompleteDelegate(delegate);
            await downloadService['sharedPreferencesSetCollection'].addAll([buildRequest('do_1')]).toPromise();
            mockQuery
                .mockResolvedValueOnce({ downloads: [progressEntry(50, 100, DownloadStatus.STATUS_RUNNING)] })
                .mockResolvedValueOnce({ downloads: [progressEntry(50, 100, DownloadStatus.STATUS_RUNNING)] })
                .mockResolvedValue({ downloads: [progressEntry(100, 100, DownloadStatus.STATUS_SUCCESSFUL)] });
            const emittedEvents = () => (mockEventsBusService.emit as jest.Mock).mock.calls.map((c: any[]) => c[0]);

            const subscription = downloadService.onInit().subscribe();
            await flush();

            // download resumed and START published
            expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://sample-url/do_1.ecar' }));
            expect(emittedEvents()).toEqual([{ namespace: EventNamespace.DOWNLOADS, event: { type: DownloadEventType.START, payload: undefined } }]);

            // tick 1: 50% progress
            jest.advanceTimersByTime(1000);
            await flush();
            expect(emittedEvents()[1].event.payload).toEqual(expect.objectContaining({ progress: 50, status: DownloadStatus.STATUS_RUNNING }));

            // tick 2: identical progress is de-duplicated
            jest.advanceTimersByTime(1000);
            await flush();
            expect(emittedEvents().length).toBe(2);

            // tick 3: success -> delegate, PROGRESS and END
            jest.advanceTimersByTime(1000);
            await flush();
            expect(delegate.onDownloadCompletion).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'do_1' }));
            expect(emittedEvents().slice(2)).toEqual([
                { namespace: EventNamespace.DOWNLOADS, event: expect.objectContaining({ type: DownloadEventType.PROGRESS }) },
                { namespace: EventNamespace.DOWNLOADS, event: { type: DownloadEventType.END, payload: undefined } }
            ]);

            subscription.unsubscribe();
        });

        it('should publish END when the download fails', async () => {
            jest.useFakeTimers();
            await downloadService['sharedPreferencesSetCollection'].addAll([buildRequest('do_1')]).toPromise();
            mockQuery.mockResolvedValue({ downloads: [progressEntry(0, 100, DownloadStatus.STATUS_FAILED)] });

            const subscription = downloadService.onInit().subscribe();
            await flush();
            jest.advanceTimersByTime(1000);
            await flush();

            const events = (mockEventsBusService.emit as jest.Mock).mock.calls.map((c: any[]) => c[0].event.type);
            expect(events).toEqual([DownloadEventType.START, DownloadEventType.PROGRESS, DownloadEventType.END]);

            subscription.unsubscribe();
        });
    });
});
