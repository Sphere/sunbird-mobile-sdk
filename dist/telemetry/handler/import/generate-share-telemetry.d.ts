import { ImportTelemetryContext, TelemetryService } from '../..';
import { Response } from '../../../api';
import { DbService } from '../../../db';
export declare class GenerateShareTelemetry {
    private dbService;
    private telemetryService;
    constructor(dbService: DbService, telemetryService: TelemetryService);
    execute(importContext: ImportTelemetryContext): Promise<Response>;
}
