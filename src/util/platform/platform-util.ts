import { Device } from '@capacitor/device';
import * as SHA1 from 'crypto-js/sha1';

let _platform: string | undefined;
let _deviceId: string | undefined;
let _sdkPlatform: 'cordova' | 'web' | 'capacitor' = 'cordova';
let _initialized = false;

export async function initPlatformUtil(sdkPlatform: 'cordova' | 'web' | 'capacitor'): Promise<void> {
    _sdkPlatform = sdkPlatform;
    if (sdkPlatform === 'capacitor') {
        const [idResult, infoResult] = await Promise.all([
            Device.getId(),
            Device.getInfo()
        ]);
        _deviceId = SHA1(idResult.identifier).toString();
        _platform = infoResult.platform;
    } else {
        _platform = (typeof window !== 'undefined' && (window as any).device)
            ? (window as any).device.platform.toLowerCase()
            : 'android';
        _deviceId = (typeof window !== 'undefined' && (window as any).device)
            ? SHA1((window as any).device.uuid).toString()
            : '';
    }
    _initialized = true;
}

export function getPlatform(): string {
    if (_initialized && _platform !== undefined) {
        return _platform;
    }
    // Cordova fallback — safe for Cordova path where window.device is available
    return (typeof window !== 'undefined' && (window as any).device)
        ? (window as any).device.platform.toLowerCase()
        : 'android';
}

export function getDeviceId(): string {
    if (_initialized && _deviceId !== undefined) {
        return _deviceId;
    }
    return (typeof window !== 'undefined' && (window as any).device)
        ? SHA1((window as any).device.uuid).toString()
        : '';
}

export function getSdkPlatform(): 'cordova' | 'web' | 'capacitor' {
    return _sdkPlatform;
}
