import 'reflect-metadata';
import { ZipServiceCapacitorImpl } from './zip-service-capacitor-impl';

// ── Mock @capacitor/filesystem ────────────────────────────────────────────────
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue({ uri: 'file://out' });
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build a real JSZip base64 string containing the given files
async function makeZipBase64(files: Record<string, string>): Promise<string> {
    const JSZip = require('jszip');
    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) {
        zip.file(path, content);
    }
    return zip.generateAsync({ type: 'base64' });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('ZipServiceCapacitorImpl', () => {
    let service: ZipServiceCapacitorImpl;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ZipServiceCapacitorImpl();
    });

    // ── unzip ─────────────────────────────────────────────────────────────────

    describe('unzip()', () => {
        it('reads zip, extracts all files to target directory', async () => {
            const base64zip = await makeZipBase64({
                'manifest.json': '{"id":"c1"}',
                'assets/img.png': 'pngdata'
            });
            mockReadFile.mockResolvedValue({ data: base64zip });

            await new Promise<void>((resolve, reject) => {
                service.unzip('file:///storage/content.ecar', { target: 'file:///storage/tmp/' }, resolve, reject);
            });

            expect(mockReadFile).toHaveBeenCalledWith({ path: 'file:///storage/content.ecar' });
            expect(mockWriteFile).toHaveBeenCalledTimes(2);

            const writtenPaths = mockWriteFile.mock.calls.map((c: any[]) => c[0].path);
            expect(writtenPaths).toContain('file:///storage/tmp/manifest.json');
            expect(writtenPaths).toContain('file:///storage/tmp/assets/img.png');
        });

        it('appends slash between target dir and relative path when needed', async () => {
            const base64zip = await makeZipBase64({ 'file.txt': 'hello' });
            mockReadFile.mockResolvedValue({ data: base64zip });

            await new Promise<void>((resolve, reject) => {
                // target WITHOUT trailing slash
                service.unzip('file:///src.zip', { target: 'file:///dest' }, resolve, reject);
            });

            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'file:///dest/file.txt' })
            );
        });

        it('calls errorCallback when readFile fails', async () => {
            mockReadFile.mockRejectedValue(new Error('read error'));

            await new Promise<void>((resolve) => {
                service.unzip('bad.zip', { target: '/tmp/' }, () => resolve(), (e) => {
                    expect(e.message).toBe('read error');
                    resolve();
                });
            });
        });

        it('skips directory entries in the zip', async () => {
            const JSZip = require('jszip');
            const zip = new JSZip();
            zip.folder('emptyDir');           // directory entry
            zip.file('real.txt', 'content');
            const base64zip = await zip.generateAsync({ type: 'base64' });
            mockReadFile.mockResolvedValue({ data: base64zip });

            await new Promise<void>((resolve, reject) => {
                service.unzip('file:///src.zip', { target: '/out/' }, resolve, reject);
            });

            // Only the file entry should be written, not the folder
            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            expect(mockWriteFile.mock.calls[0][0].path).toContain('real.txt');
        });
    });

    // ── zip ───────────────────────────────────────────────────────────────────

    describe('zip()', () => {
        it('reads folder recursively and writes zip to target path', async () => {
            mockReaddir.mockResolvedValue({
                files: [
                    { name: 'manifest.json', type: 'file' },
                    { name: 'assets', type: 'directory' }
                ]
            });
            // Second readdir for the 'assets' subdirectory
            mockReaddir.mockResolvedValueOnce({
                files: [{ name: 'manifest.json', type: 'file' }]
            }).mockResolvedValueOnce({
                files: [{ name: 'img.png', type: 'file' }]
            });
            mockReadFile.mockResolvedValue({ data: Buffer.from('hello').toString('base64') });

            await new Promise<void>((resolve, reject) => {
                service.zip(
                    'file:///storage/content',
                    { target: 'file:///storage/out.zip' },
                    [], [],
                    resolve, reject
                );
            });

            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'file:///storage/out.zip', recursive: true })
            );
            // The written data should be a non-empty base64 string
            const writtenData: string = mockWriteFile.mock.calls[0][0].data;
            expect(typeof writtenData).toBe('string');
            expect(writtenData.length).toBeGreaterThan(0);
        });

        it('skips directories in directoriesToBeSkipped', async () => {
            mockReaddir.mockResolvedValue({
                files: [
                    { name: 'keep.txt', type: 'file' },
                    { name: 'skipMe', type: 'directory' }
                ]
            });
            mockReadFile.mockResolvedValue({ data: Buffer.from('hello').toString('base64') });

            await new Promise<void>((resolve, reject) => {
                service.zip('/src', { target: '/out.zip' }, ['skipMe'], [], resolve, reject);
            });

            // readdir should only be called once (for /src), 'skipMe' dir not entered
            expect(mockReaddir).toHaveBeenCalledTimes(1);
        });

        it('skips files in filesToBeSkipped', async () => {
            mockReaddir.mockResolvedValue({
                files: [
                    { name: 'keep.txt', type: 'file' },
                    { name: 'skip.json', type: 'file' }
                ]
            });
            mockReadFile.mockResolvedValue({ data: Buffer.from('hello').toString('base64') });

            await new Promise<void>((resolve, reject) => {
                service.zip('/src', { target: '/out.zip' }, [], ['skip.json'], resolve, reject);
            });

            // Only 'keep.txt' should be read
            expect(mockReadFile).toHaveBeenCalledTimes(1);
            expect(mockReadFile.mock.calls[0][0].path).toContain('keep.txt');
        });

        it('calls errorCallback when readdir fails', async () => {
            mockReaddir.mockRejectedValue(new Error('dir error'));

            await new Promise<void>((resolve) => {
                service.zip('/bad', { target: '/out.zip' }, [], [], () => resolve(), (e) => {
                    expect(e.message).toBe('dir error');
                    resolve();
                });
            });
        });

        it('strips trailing slash from source folder path', async () => {
            mockReaddir.mockResolvedValue({ files: [] });

            await new Promise<void>((resolve, reject) => {
                service.zip('/src/', { target: '/out.zip' }, [], [], resolve, reject);
            });

            // readdir called without trailing slash
            expect(mockReaddir).toHaveBeenCalledWith({ path: '/src' });
        });
    });
});
