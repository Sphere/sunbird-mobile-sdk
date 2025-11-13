export interface ApiConfig {
    debugMode?: boolean;
    host: string;
    user_authentication: {
        redirectUrl: string;
        authUrl: string;
        mergeUserHost: string;
        autoMergeApiPath: string;
    };
    api_authentication: {
        mobileAppKey: string,
        mobileAppSecret: string,
        mobileAppConsumer: string,
        channelId: string,
        producerId: string,
        producerUniqueId: string,
        version: string,
        build: string | number
    };
    cached_requests: {
        timeToLive: number
    };
}
