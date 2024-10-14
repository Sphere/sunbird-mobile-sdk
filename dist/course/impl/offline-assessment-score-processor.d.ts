import { KeyValueStore } from '../../key-value-store';
import { SunbirdTelemetry } from '../../telemetry';
import { SharedPreferences } from '../../util/shared-preferences';
export declare class OfflineAssessmentScoreProcessor {
    private keyValueStore;
    private sharedPreference;
    constructor(keyValueStore: KeyValueStore, sharedPreference: SharedPreferences);
    process(capturedAssessments: {
        [key: string]: SunbirdTelemetry.Telemetry[] | undefined;
    }): Promise<void>;
    private getCourseContext;
}
