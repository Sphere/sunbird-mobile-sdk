import { FilePaths } from "../../../services/file-path/file-path.enum";
import { FilePathService } from "../../../services/file-path/file-path.service";
import { getPlatform } from '../../platform/platform-util';
export class Path {
    public static ASSETS_PATH = 'file:///android_asset/www/assets';

    public static dirPathFromFilePath(filePath: string): string {
        return filePath.substring(0, filePath.lastIndexOf('/'));
    }

    public static fileNameFromFilePath(filePath: string): string {
        return filePath.substring(filePath.lastIndexOf('/') + 1);
    }
    public static async getAssetPath(): Promise<string> {
        const platform = getPlatform();
        return platform === 'ios' ? "www/assets" : Path.ASSETS_PATH
    }

    /**
     * @capacitor/filesystem requires a full file:// URI when no `directory` option is given
     * (see its README: "leave out the directory param to use a full file path"). Many paths
     * in this codebase (DB-stored content paths, anything built via ContentUtil.getBasePath())
     * have the scheme stripped for the native Cordova plugins, which expect bare paths. Use
     * this to restore the scheme before passing such a path to FileService/Filesystem calls.
     */
    public static ensureFileUri(path: string): string {
        return path.startsWith('file://') ? path : `file://${path}`;
    }
}
