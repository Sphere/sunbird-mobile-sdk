import { ApiRequestHandler, ApiService } from '../../api';
import { TelemetrySyncStat } from '..';
import { Observable } from 'rxjs';
import { KeyValueStore } from '../../key-value-store';
import { TelemetryConfig } from '../config/telemetry-config';
import { DeviceInfo } from '../../util/device/def/device-info';
import { DbService } from '../../db';
export declare class TelemetrySyncHandler implements ApiRequestHandler<undefined, TelemetrySyncStat> {
    private dbService;
    private telemetryConfig;
    private deviceInfo;
    private keyValueStore?;
    private apiService?;
    private static readonly LAST_SYNCED_DEVICE_REGISTER_TIME_STAMP_KEY;
    private static readonly DEVICE_REGISTER_ENDPOINT;
    private static readonly TELEMETRY_ENDPOINT;
    private static readonly REGISTER_API_SUCCESS_TTL;
    private static readonly REGISTER_API_FAILURE_TTL;
    private readonly preprocessors;
    constructor(dbService: DbService, telemetryConfig: TelemetryConfig, deviceInfo: DeviceInfo, keyValueStore?: KeyValueStore | undefined, apiService?: ApiService | undefined);
    handle(): Observable<TelemetrySyncStat>;
    private registerDevice;
    processEventsBatch(): Observable<number>;
    private hasTelemetryThresholdCrossed;
    private fetchEvents;
    private processEvents;
    private persistProcessedEvents;
    private deleteEvents;
    private handleProcessedEventsBatch;
    private fetchProcessedEventsBatch;
    private syncProcessedEvent;
    private deleteProcessedEvent;
}
