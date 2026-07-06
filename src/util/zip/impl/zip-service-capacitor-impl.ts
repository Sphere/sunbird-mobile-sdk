import { ZipService } from '../def/zip-service';
import { injectable } from 'inversify';
import { Filesystem } from '@capacitor/filesystem';
import JSZip from 'jszip';

@injectable()
export class ZipServiceCapacitorImpl implements ZipService {

    unzip(sourceZip: string, option: { target: string }, successCallback?, errorCallback?) {
        this.doUnzip(sourceZip, option.target)
            .then(() => successCallback && successCallback())
            .catch(e => errorCallback && errorCallback(e));
    }

    zip(
        sourceFolderPath: string,
        option: { target: string },
        directoriesToBeSkipped: string[] = [],
        filesToBeSkipped: string[] = [],
        successCallback?,
        errorCallback?
    ) {
        this.doZip(sourceFolderPath, option.target, directoriesToBeSkipped, filesToBeSkipped)
            .then(() => successCallback && successCallback())
            .catch(e => errorCallback && errorCallback(e));
    }

    // ── private ───────────────────────────────────────────────────────────────

    private async doUnzip(sourceZip: string, targetDir: string): Promise<void> {
        const result = await Filesystem.readFile({ path: sourceZip });
        const base64 = result.data as string;

        const zip = await JSZip.loadAsync(base64, { base64: true });

        const writes: Promise<unknown>[] = [];
        zip.forEach((relativePath: string, entry) => {
            if (entry.dir) { return; }
            writes.push(
                entry.async('base64').then((data: string) => {
                    const outPath = targetDir.endsWith('/')
                        ? `${targetDir}${relativePath}`
                        : `${targetDir}/${relativePath}`;
                    return Filesystem.writeFile({ path: outPath, data, recursive: true });
                })
            );
        });

        await Promise.all(writes);
    }

    private async doZip(
        sourceFolderPath: string,
        targetZipPath: string,
        skipDirs: string[],
        skipFiles: string[]
    ): Promise<void> {
        const jzip = new JSZip();
        await this.addFolderToZip(jzip, this.normalisePath(sourceFolderPath), '', skipDirs, skipFiles);
        const content: string = await jzip.generateAsync({ type: 'base64' });
        await Filesystem.writeFile({ path: targetZipPath, data: content, recursive: true });
    }

    private async addFolderToZip(
        zip: any,
        absoluteDir: string,
        relativeDir: string,
        skipDirs: string[],
        skipFiles: string[]
    ): Promise<void> {
        const result = await Filesystem.readdir({ path: absoluteDir });

        for (const entry of result.files) {
            const name: string = typeof entry === 'string' ? entry : (entry as { name: string }).name;
            const type: string = typeof entry === 'string' ? 'file' : (entry as { type: string }).type;
            const relPath = relativeDir ? `${relativeDir}/${name}` : name;
            const absPath = `${absoluteDir}/${name}`;

            if (type === 'directory') {
                if (skipDirs.some(d => name === d || name.includes(d))) { continue; }
                await this.addFolderToZip(zip, absPath, relPath, skipDirs, skipFiles);
            } else {
                if (skipFiles.some(f => relPath === f || relPath.includes(f))) { continue; }
                const fileResult = await Filesystem.readFile({ path: absPath });
                zip.file(relPath, fileResult.data as string, { base64: true });
            }
        }
    }

    private normalisePath(p: string): string {
        return p.endsWith('/') ? p.slice(0, -1) : p;
    }
}
