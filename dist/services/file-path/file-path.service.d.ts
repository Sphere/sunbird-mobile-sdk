import { FilePaths } from './file-path.enum';
export declare class FilePathService {
    static getFilePath(directory: FilePaths): Promise<string>;
}
