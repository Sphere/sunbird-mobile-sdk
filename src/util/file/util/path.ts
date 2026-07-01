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
}
