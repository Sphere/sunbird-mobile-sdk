import { FileInfo } from '@capacitor/filesystem';
import { DirectoryEntry, Flags, IWriteOptions, Metadata } from '../index';
export interface FileService {
    readAsText(path: string, file: string): Promise<string>;
    readAsBinaryString(path: string, file: string): Promise<string>;
    readFileFromAssets(fileName: string): Promise<string>;
    writeFile(path: string, fileName: string, text: string, options: IWriteOptions): Promise<{
        success: boolean;
    }>;
    createFile(path: string, fileName: string, replace: boolean): Promise<{
        success: boolean;
        path: string;
        nativeURL: string;
    }>;
    removeFile(path: string): Promise<{
        success: boolean;
    }>;
    getFile(directoryEntry: DirectoryEntry, fileName: string, flags: Flags): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: string;
        fullPath: string;
        nativeURL: string;
    }>;
    createDir(path: string, replace: boolean): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: string;
        fullPath: string;
        nativeURL: string;
    }>;
    listDir(directoryPath: string): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: FileInfo;
        fullPath: string;
        filesystem: string;
        nativeURL: string;
        remove?: () => Promise<void>;
    }[]>;
    removeDir(path: string, dirName: string): Promise<{
        success: boolean;
    }>;
    removeRecursively(path: string): Promise<{
        success: boolean;
    }>;
    copyDir(path: string, dirName: string, newPath: string, newDirName: string): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: string;
        fullPath: string;
        nativeURL: string;
    }>;
    copyFile(path: string, fileName: string, newPath: string, newFileName: string): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: string;
        fullPath: string;
        nativeURL: string;
    }>;
    getMetaData(path: string): Promise<Metadata>;
    exists(path: string): Promise<{
        exists: boolean;
        nativeURL?: string;
    }>;
    getTempLocation(destinationPath: string): Promise<{
        path: string;
        nativeURL: string;
    }>;
    getFreeDiskSpace(): Promise<number>;
    getDirectorySize(path: string): Promise<number>;
}
