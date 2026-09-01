import { ZipService } from '../def/zip-service';
import { injectable } from 'inversify';
import { Filesystem } from '@capacitor/filesystem';
import { CapacitorZip } from '@capgo/capacitor-zip';
import JSZip from 'jszip';
import { FileServiceImpl } from '../../file/impl/file-service-impl';

@injectable()
export class ZipServiceCapacitorImpl implements ZipService {

    unzip(sourceZip: string, option: { target: string }, successCallback?, errorCallback?) {
        this.doUnzip(sourceZip, option.target)
            .then(() => successCallback && successCallback())
            .catch(e => {
                console.error('[ECAR] Native Capacitor unzip failed:', e);
                errorCallback && errorCallback(e);
            });
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

    /**
     * Every current caller passes a well-formed file:///... URI (via FileServiceImpl.createDir()'s
     * nativeURL or Filesystem.getUri()'s .uri). @capgo/capacitor-zip's native code (verified from
     * source on both platforms) does `new File(source)` / `URL(fileURLWithPath:)` directly on the
     * string with no URI parsing - a file:// scheme prefix makes it resolve as a relative path and
     * silently fail to find the file. Route through the existing well-formed-URI normalizer before
     * stripping the scheme, since a bare replace would corrupt the malformed 2-slash file://... form
     * (see toWellFormedFileUri's own history) into a relative path instead of an absolute one.
     */
    private toNativePath(path: string): string {
        const wellFormed = FileServiceImpl.toWellFormedFileUri(path);
        return wellFormed.replace(/^file:\/\//, '');
    }

    private async doUnzip(sourceZip: string, targetDir: string): Promise<void> {
        const source = this.toNativePath(sourceZip);
        const destination = this.toNativePath(targetDir);

        console.log('[ECAR] native unzip source path:', source);
        console.log('[ECAR] native unzip destination path:', destination);

        await CapacitorZip.unzip({ source, destination });
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
