import 'reflect-metadata';
import { ZipServiceCapacitorImpl } from './zip-service-capacitor-impl';

// ── Mock @capacitor/filesystem ────────────────────────────────────────────────
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockReaddir = jest.fn();

jest.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        readFile: (...a: any[]) => mockReadFile(...a),
        writeFile: (...a: any[]) => mockWriteFile(...a),
        readdir: (...a: any[]) => mockReaddir(...a),
    },
    Encoding: { UTF8: 'utf8' },
    Directory: {},
}));

// ── Mock @capgo/capacitor-zip ─────────────────────────────────────────────────
// (the real module's zip.js dependency needs TransformStream, which jsdom lacks)
const mockNativeUnzip = jest.fn();

jest.mock('@capgo/capacitor-zip', () => ({
    CapacitorZip: {
        unzip: (...a: any[]) => mockNativeUnzip(...a),
    },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const toBase64 = (s: string) => Buffer.from(s).toString('base64');

function runUnzip(service: ZipServiceCapacitorImpl, source: string, target: string): Promise<void> {
    return new Promise<void>((resolve, reject) => service.unzip(source, { target }, resolve, reject));
}

function runZip(
    service: ZipServiceCapacitorImpl,
    source: string,
    target: string,
    skipDirs: string[] = [],
    skipFiles: string[] = []
): Promise<void> {
    return new Promise<void>((resolve, reject) =>
        service.zip(source, { target }, skipDirs, skipFiles, resolve, reject));
}

// Read back the zip that zip() wrote via Filesystem.writeFile
async function readWrittenZip(): Promise<Record<string, string>> {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(mockWriteFile.mock.calls[0][0].data, { base64: true });
    const out: Record<string, string> = {};
    for (const name of Object.keys(zip.files)) {
        if (!zip.files[name].dir) {
            out[name] = await zip.file(name).async('string');
        }
    }
    return out;
}

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// ─────────────────────────────────────────────────────────────────────────────

describe('ZipServiceCapacitorImpl', () => {
    let service: ZipServiceCapacitorImpl;

    beforeEach(() => {
        jest.clearAllMocks();
        mockWriteFile.mockResolvedValue({ uri: 'file:///out' });
        mockNativeUnzip.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        service = new ZipServiceCapacitorImpl();
    });

    it('should be able to create an instance', () => {
        expect(service).toBeTruthy();
    });

    // ── unzip ─────────────────────────────────────────────────────────────────

    describe('unzip()', () => {
        it('should strip the file:// scheme from well-formed URIs before calling native unzip', async () => {
            await runUnzip(service, 'file:///storage/content.ecar', 'file:///storage/tmp/');

            expect(mockNativeUnzip).toHaveBeenCalledTimes(1);
            expect(mockNativeUnzip).toHaveBeenCalledWith({
                source: '/storage/content.ecar',
                destination: '/storage/tmp/'
            });
        });

        it('should normalise malformed two-slash file:// URIs to absolute paths', async () => {
            await runUnzip(service, 'file://storage/content.ecar', 'file://storage/tmp');

            expect(mockNativeUnzip).toHaveBeenCalledWith({
                source: '/storage/content.ecar',
                destination: '/storage/tmp'
            });
        });

        it('should pass plain absolute paths through unchanged', async () => {
            await runUnzip(service, '/storage/content.ecar', '/storage/tmp');

            expect(mockNativeUnzip).toHaveBeenCalledWith({
                source: '/storage/content.ecar',
                destination: '/storage/tmp'
            });
        });

        it('should leave relative paths as-is', async () => {
            await runUnzip(service, 'content.ecar', 'tmp');

            expect(mockNativeUnzip).toHaveBeenCalledWith({ source: 'content.ecar', destination: 'tmp' });
        });

        it('should invoke successCallback when native unzip resolves', async () => {
            const successCallback = jest.fn();
            const errorCallback = jest.fn();

            service.unzip('file:///a.zip', { target: 'file:///b' }, successCallback, errorCallback);
            await flushPromises();

            expect(successCallback).toHaveBeenCalledTimes(1);
            expect(errorCallback).not.toHaveBeenCalled();
        });

        it('should invoke errorCallback and log when native unzip rejects', async () => {
            const error = new Error('native unzip failed');
            mockNativeUnzip.mockRejectedValue(error);
            const successCallback = jest.fn();
            const errorCallback = jest.fn();

            service.unzip('file:///a.zip', { target: 'file:///b' }, successCallback, errorCallback);
            await flushPromises();

            expect(errorCallback).toHaveBeenCalledWith(error);
            expect(successCallback).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('[ECAR] Native Capacitor unzip failed:', error);
        });

        it('should not throw when callbacks are omitted', async () => {
            service.unzip('file:///a.zip', { target: 'file:///b' });
            await flushPromises();
            expect(mockNativeUnzip).toHaveBeenCalledTimes(1);

            mockNativeUnzip.mockRejectedValue(new Error('fail'));
            service.unzip('file:///a.zip', { target: 'file:///b' });
            await flushPromises();
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ── zip ───────────────────────────────────────────────────────────────────

    describe('zip()', () => {
        it('should zip a folder recursively and write it as base64 to the target path', async () => {
            mockReaddir
                .mockResolvedValueOnce({
                    files: [
                        { name: 'manifest.json', type: 'file' },
                        { name: 'assets', type: 'directory' }
                    ]
                })
                .mockResolvedValueOnce({ files: [{ name: 'img.png', type: 'file' }] });
            mockReadFile.mockImplementation(({ path }) =>
                Promise.resolve({ data: toBase64(path.endsWith('img.png') ? 'png-data' : '{"id":"c1"}') }));

            await runZip(service, 'file:///storage/content', 'file:///storage/out.zip');

            expect(mockReaddir).toHaveBeenNthCalledWith(1, { path: 'file:///storage/content' });
            expect(mockReaddir).toHaveBeenNthCalledWith(2, { path: 'file:///storage/content/assets' });
            expect(mockReadFile).toHaveBeenCalledWith({ path: 'file:///storage/content/manifest.json' });
            expect(mockReadFile).toHaveBeenCalledWith({ path: 'file:///storage/content/assets/img.png' });
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'file:///storage/out.zip', recursive: true })
            );
            expect(await readWrittenZip()).toEqual({
                'manifest.json': '{"id":"c1"}',
                'assets/img.png': 'png-data'
            });
        });

        it('should treat plain string entries (older readdir API) as files', async () => {
            mockReaddir.mockResolvedValueOnce({ files: ['a.txt', 'b.txt'] });
            mockReadFile.mockResolvedValue({ data: toBase64('x') });

            await runZip(service, '/src', '/out.zip');

            expect(mockReaddir).toHaveBeenCalledTimes(1);
            expect(await readWrittenZip()).toEqual({ 'a.txt': 'x', 'b.txt': 'x' });
        });

        it('should skip directories that match or contain an entry in directoriesToBeSkipped', async () => {
            mockReaddir.mockResolvedValueOnce({
                files: [
                    { name: 'keep.txt', type: 'file' },
                    { name: 'skipMe', type: 'directory' },
                    { name: 'old-skipMe-backup', type: 'directory' }
                ]
            });
            mockReadFile.mockResolvedValue({ data: toBase64('hello') });

            await runZip(service, '/src', '/out.zip', ['skipMe']);

            // only /src is read; neither skipped directory is entered
            expect(mockReaddir).toHaveBeenCalledTimes(1);
            expect(await readWrittenZip()).toEqual({ 'keep.txt': 'hello' });
        });

        it('should skip files whose relative path matches or contains an entry in filesToBeSkipped', async () => {
            mockReaddir
                .mockResolvedValueOnce({
                    files: [
                        { name: 'keep.txt', type: 'file' },
                        { name: 'skip.json', type: 'file' },
                        { name: 'assets', type: 'directory' }
                    ]
                })
                .mockResolvedValueOnce({
                    files: [
                        { name: 'img.png', type: 'file' },
                        { name: 'logo.png', type: 'file' }
                    ]
                });
            mockReadFile.mockResolvedValue({ data: toBase64('hello') });

            await runZip(service, '/src', '/out.zip', [], ['skip.json', 'assets/img.png']);

            const readPaths = mockReadFile.mock.calls.map((c: any[]) => c[0].path);
            expect(readPaths).toEqual(['/src/keep.txt', '/src/assets/logo.png']);
            expect(Object.keys(await readWrittenZip()).sort()).toEqual(['assets/logo.png', 'keep.txt']);
        });

        it('should strip a trailing slash from the source folder path', async () => {
            mockReaddir.mockResolvedValueOnce({ files: [{ name: 'a.txt', type: 'file' }] });
            mockReadFile.mockResolvedValue({ data: toBase64('x') });

            await runZip(service, '/src/', '/out.zip');

            expect(mockReaddir).toHaveBeenCalledWith({ path: '/src' });
            expect(mockReadFile).toHaveBeenCalledWith({ path: '/src/a.txt' });
        });

        it('should write an empty zip for an empty folder', async () => {
            mockReaddir.mockResolvedValueOnce({ files: [] });

            await runZip(service, '/src', '/out.zip');

            expect(mockReadFile).not.toHaveBeenCalled();
            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            expect(await readWrittenZip()).toEqual({});
        });

        it('should default skip lists to empty when not provided', async () => {
            mockReaddir.mockResolvedValueOnce({ files: [{ name: 'a.txt', type: 'file' }] });
            mockReadFile.mockResolvedValue({ data: toBase64('x') });
            const successCallback = jest.fn();

            service.zip('/src', { target: '/out.zip' }, undefined, undefined, successCallback);
            await new Promise<void>(resolve => successCallback.mockImplementation(resolve));

            expect(await readWrittenZip()).toEqual({ 'a.txt': 'x' });
        });

        it('should invoke errorCallback when readdir fails', async () => {
            mockReaddir.mockRejectedValue(new Error('dir error'));

            await expect(runZip(service, '/bad', '/out.zip')).rejects.toThrow('dir error');
            expect(mockWriteFile).not.toHaveBeenCalled();
        });

        it('should invoke errorCallback when readFile fails', async () => {
            mockReaddir.mockResolvedValueOnce({ files: [{ name: 'a.txt', type: 'file' }] });
            mockReadFile.mockRejectedValue(new Error('read error'));

            await expect(runZip(service, '/src', '/out.zip')).rejects.toThrow('read error');
            expect(mockWriteFile).not.toHaveBeenCalled();
        });

        it('should invoke errorCallback when writeFile fails', async () => {
            mockReaddir.mockResolvedValueOnce({ files: [] });
            mockWriteFile.mockRejectedValue(new Error('write error'));

            await expect(runZip(service, '/src', '/out.zip')).rejects.toThrow('write error');
        });

        it('should not throw when callbacks are omitted', async () => {
            mockReaddir.mockRejectedValue(new Error('dir error'));

            expect(() => service.zip('/src', { target: '/out.zip' })).not.toThrow();
            await flushPromises();
        });
    });
});
