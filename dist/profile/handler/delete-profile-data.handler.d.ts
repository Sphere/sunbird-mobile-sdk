import { Observable } from 'rxjs';
import { DbService } from '../../db';
export declare class DeleteProfileDataHandler {
    private dbService;
    constructor(dbService: DbService);
    delete(uid: string): Observable<boolean>;
    private generateLikeQuery;
}
