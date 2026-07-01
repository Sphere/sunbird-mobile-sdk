import { SharedPreferences } from '..';
import { Observable, from } from 'rxjs';
import { injectable } from 'inversify';
import { Preferences } from '@capacitor/preferences';
import { map, mapTo } from 'rxjs/operators';

@injectable()
export class SharedPreferencesCapacitorImpl implements SharedPreferences {

    private listeners: Map<string, ((v: any) => void)[]> = new Map();

    getString(key: string): Observable<string | undefined> {
        return from(Preferences.get({ key })).pipe(
            map(result => result.value ?? undefined)
        );
    }

    putString(key: string, value: string): Observable<undefined> {
        return from(Preferences.set({ key, value })).pipe(
            map(() => {
                (this.listeners.get(key) || []).forEach(l => l(value));
                return undefined;
            })
        );
    }

    putBoolean(key: string, value: boolean): Observable<boolean> {
        return from(Preferences.set({ key, value: String(value) })).pipe(
            map(() => {
                (this.listeners.get(key) || []).forEach(l => l(value));
                return value;
            })
        );
    }

    getBoolean(key: string): Observable<boolean> {
        return from(Preferences.get({ key })).pipe(
            map(result => result.value === 'true')
        );
    }

    addListener(key: string, listener: (value: any) => void) {
        const existing = this.listeners.get(key) || [];
        existing.push(listener);
        this.listeners.set(key, existing);
    }

    removeListener(key: string, listener: (value: any) => void) {
        const existing = this.listeners.get(key) || [];
        this.listeners.set(key, existing.filter(l => l !== listener));
    }
}
