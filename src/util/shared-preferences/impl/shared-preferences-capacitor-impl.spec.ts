import 'reflect-metadata';
import { SharedPreferencesCapacitorImpl } from './shared-preferences-capacitor-impl';

// ── Mock @capacitor/preferences ───────────────────────────────────────────────
const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: (...a: any[]) => mockGet(...a),
        set: (...a: any[]) => mockSet(...a),
    },
}));

describe('SharedPreferencesCapacitorImpl', () => {
    let sharedPreferences: SharedPreferencesCapacitorImpl;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet.mockResolvedValue(undefined);
        sharedPreferences = new SharedPreferencesCapacitorImpl();
    });

    it('should be able to create an instance', () => {
        expect(sharedPreferences).toBeTruthy();
    });

    // ── getString ─────────────────────────────────────────────────────────────

    describe('getString()', () => {
        it('should return the stored value for the key', async () => {
            mockGet.mockResolvedValue({ value: 'SAMPLE_VALUE' });

            const value = await sharedPreferences.getString('SAMPLE_KEY').toPromise();

            expect(mockGet).toHaveBeenCalledWith({ key: 'SAMPLE_KEY' });
            expect(value).toBe('SAMPLE_VALUE');
        });

        it('should return undefined when the key is not set (null value)', async () => {
            mockGet.mockResolvedValue({ value: null });

            const value = await sharedPreferences.getString('MISSING_KEY').toPromise();

            expect(value).toBeUndefined();
        });

        it('should return an empty string as-is rather than undefined', async () => {
            mockGet.mockResolvedValue({ value: '' });

            const value = await sharedPreferences.getString('EMPTY_KEY').toPromise();

            expect(value).toBe('');
        });

        it('should propagate errors from Preferences.get', async () => {
            mockGet.mockRejectedValue(new Error('get failed'));

            await expect(sharedPreferences.getString('SAMPLE_KEY').toPromise()).rejects.toThrow('get failed');
        });
    });

    // ── putString ─────────────────────────────────────────────────────────────

    describe('putString()', () => {
        it('should store the value and emit undefined', async () => {
            const result = await sharedPreferences.putString('SAMPLE_KEY', 'SAMPLE_VALUE').toPromise();

            expect(mockSet).toHaveBeenCalledWith({ key: 'SAMPLE_KEY', value: 'SAMPLE_VALUE' });
            expect(result).toBeUndefined();
        });

        it('should notify every listener registered for the key', async () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            sharedPreferences.addListener('SAMPLE_KEY', listener1);
            sharedPreferences.addListener('SAMPLE_KEY', listener2);

            await sharedPreferences.putString('SAMPLE_KEY', 'NEW_VALUE').toPromise();

            expect(listener1).toHaveBeenCalledWith('NEW_VALUE');
            expect(listener2).toHaveBeenCalledWith('NEW_VALUE');
        });

        it('should not notify listeners registered for a different key', async () => {
            const otherListener = jest.fn();
            sharedPreferences.addListener('OTHER_KEY', otherListener);

            await sharedPreferences.putString('SAMPLE_KEY', 'NEW_VALUE').toPromise();

            expect(otherListener).not.toHaveBeenCalled();
        });

        it('should not notify listeners when Preferences.set fails', async () => {
            const listener = jest.fn();
            sharedPreferences.addListener('SAMPLE_KEY', listener);
            mockSet.mockRejectedValue(new Error('set failed'));

            await expect(sharedPreferences.putString('SAMPLE_KEY', 'NEW_VALUE').toPromise())
                .rejects.toThrow('set failed');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    // ── putBoolean ────────────────────────────────────────────────────────────

    describe('putBoolean()', () => {
        it('should store true as the string "true" and emit true', async () => {
            const result = await sharedPreferences.putBoolean('SAMPLE_KEY', true).toPromise();

            expect(mockSet).toHaveBeenCalledWith({ key: 'SAMPLE_KEY', value: 'true' });
            expect(result).toBe(true);
        });

        it('should store false as the string "false" and emit false', async () => {
            const result = await sharedPreferences.putBoolean('SAMPLE_KEY', false).toPromise();

            expect(mockSet).toHaveBeenCalledWith({ key: 'SAMPLE_KEY', value: 'false' });
            expect(result).toBe(false);
        });

        it('should notify listeners with the boolean value, not the string', async () => {
            const listener = jest.fn();
            sharedPreferences.addListener('SAMPLE_KEY', listener);

            await sharedPreferences.putBoolean('SAMPLE_KEY', true).toPromise();

            expect(listener).toHaveBeenCalledWith(true);
        });

        it('should propagate errors from Preferences.set', async () => {
            mockSet.mockRejectedValue(new Error('set failed'));

            await expect(sharedPreferences.putBoolean('SAMPLE_KEY', true).toPromise()).rejects.toThrow('set failed');
        });
    });

    // ── getBoolean ────────────────────────────────────────────────────────────

    describe('getBoolean()', () => {
        it('should return true when the stored value is "true"', async () => {
            mockGet.mockResolvedValue({ value: 'true' });

            const value = await sharedPreferences.getBoolean('SAMPLE_KEY').toPromise();

            expect(mockGet).toHaveBeenCalledWith({ key: 'SAMPLE_KEY' });
            expect(value).toBe(true);
        });

        it('should return false when the stored value is "false"', async () => {
            mockGet.mockResolvedValue({ value: 'false' });

            expect(await sharedPreferences.getBoolean('SAMPLE_KEY').toPromise()).toBe(false);
        });

        it('should return false when the key is not set', async () => {
            mockGet.mockResolvedValue({ value: null });

            expect(await sharedPreferences.getBoolean('MISSING_KEY').toPromise()).toBe(false);
        });

        it('should return false for any value other than "true"', async () => {
            mockGet.mockResolvedValue({ value: 'TRUE' });

            expect(await sharedPreferences.getBoolean('SAMPLE_KEY').toPromise()).toBe(false);
        });

        it('should read back a value written by putBoolean', async () => {
            const store: { [key: string]: string } = {};
            mockSet.mockImplementation(({ key, value }) => { store[key] = value; return Promise.resolve(); });
            mockGet.mockImplementation(({ key }) => Promise.resolve({ value: key in store ? store[key] : null }));

            await sharedPreferences.putBoolean('SAMPLE_KEY', true).toPromise();

            expect(await sharedPreferences.getBoolean('SAMPLE_KEY').toPromise()).toBe(true);
        });
    });

    // ── listeners ─────────────────────────────────────────────────────────────

    describe('addListener() / removeListener()', () => {
        it('should stop notifying a listener once it is removed', async () => {
            const listener = jest.fn();
            sharedPreferences.addListener('SAMPLE_KEY', listener);
            sharedPreferences.removeListener('SAMPLE_KEY', listener);

            await sharedPreferences.putString('SAMPLE_KEY', 'NEW_VALUE').toPromise();

            expect(listener).not.toHaveBeenCalled();
        });

        it('should only remove the given listener and keep others for the same key', async () => {
            const removed = jest.fn();
            const kept = jest.fn();
            sharedPreferences.addListener('SAMPLE_KEY', removed);
            sharedPreferences.addListener('SAMPLE_KEY', kept);
            sharedPreferences.removeListener('SAMPLE_KEY', removed);

            await sharedPreferences.putString('SAMPLE_KEY', 'NEW_VALUE').toPromise();

            expect(removed).not.toHaveBeenCalled();
            expect(kept).toHaveBeenCalledWith('NEW_VALUE');
        });

        it('should not throw when removing a listener from a key with no listeners', async () => {
            expect(() => sharedPreferences.removeListener('UNKNOWN_KEY', jest.fn())).not.toThrow();

            await expect(sharedPreferences.putString('UNKNOWN_KEY', 'v').toPromise()).resolves.toBeUndefined();
        });

        it('should keep listeners separate between instances', async () => {
            const listener = jest.fn();
            sharedPreferences.addListener('SAMPLE_KEY', listener);

            await new SharedPreferencesCapacitorImpl().putString('SAMPLE_KEY', 'NEW_VALUE').toPromise();

            expect(listener).not.toHaveBeenCalled();
        });
    });
});
