import { CsAttachForumResponse } from "@project-sunbird/client-services/services/discussion";
import { Container } from "inversify";
import { Observable } from "rxjs";
import { CsCreateUserResponse } from "@project-sunbird/client-services/services/discussion";
import { CsNotificationDeleteReq, CsNotificationReadResponse, CsNotificationUpdateReq } from "@project-sunbird/client-services/services/notification/interface/cs-notification-service";
import { NotificationServiceV2 } from "../def/notification-service-v2";
export declare class NotificationServiceV2Impl implements NotificationServiceV2 {
    private container;
    constructor(container: Container);
    private readonly NotificationServiceV2Delegate;
    notificationRead(uid: string): Observable<CsNotificationReadResponse>;
    notificationUpdate(request: CsNotificationUpdateReq): Observable<CsCreateUserResponse>;
    notificationDelete(request: CsNotificationDeleteReq): Observable<CsAttachForumResponse>;
}
