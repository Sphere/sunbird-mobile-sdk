import { NetworkInfoService, NetworkStatus } from '..';
import { BehaviorSubject, Observable } from 'rxjs';
import { injectable } from 'inversify';
import { Network } from '@capacitor/network';

@injectable()
export class NetworkInfoCapacitorServiceImpl implements NetworkInfoService {

    networkStatus$: Observable<NetworkStatus>;
    private networkStatusSource: BehaviorSubject<NetworkStatus>;

    constructor() {
        this.networkStatusSource = new BehaviorSubject<NetworkStatus>(NetworkStatus.ONLINE);
        this.networkStatus$ = this.networkStatusSource.asObservable();
        this.init();
    }

    private async init(): Promise<void> {
        const status = await Network.getStatus();
        this.networkStatusSource.next(
            status.connected ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE
        );

        Network.addListener('networkStatusChange', (status) => {
            this.networkStatusSource.next(
                status.connected ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE
            );
        });
    }
}
