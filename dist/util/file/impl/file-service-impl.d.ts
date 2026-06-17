import { FileService } from '../def/file-service';
import { DirectoryEntry, Entry, Flags, IWriteOptions, Metadata } from '../index';
import { FileInfo } from '@capacitor/filesystem';
/**
 * Allows the user to look up the Entry for a file or directory referred to by a local URL.
 * @param url A URL referring to a local file in a filesystem accessable via this API.
 * @param successCallback A callback that is called to report the Entry to which the supplied URL refers.
 * @param errorCallback A callback that is called when errors happen, or when the request to obtain the Entry is denied.
 */
export declare class FileServiceImpl implements FileService {
    private fileSystem;
    private initialized;
    init(): void;
    readAsText(path: string, fileName: string): Promise<string>;
    readAsBinaryString(path: string, filePath: string): Promise<string>;
    readFileFromAssets(fileName: string): Promise<string>;
    writeFile(path: string, fileName: string, text: string, options?: IWriteOptions): Promise<{
        success: boolean;
    }>;
    /**
     * Creates a new file in the specific path.
     * The replace boolean value determines whether to replace an existing file with the same name.
     * If an existing file exists and the replace value is false, the promise will fail and return an error.
     *
     * @param {string} path  Base FileSystem. Please refer to the iOS and Android filesystem above
     * @param {string} fileName Name of file to create
     * @param {boolean} replace If true, replaces file with same name. If false returns error
     * @returns {Promise<FileEntry>} Returns a Promise that resolves to a FileEntry or rejects with an error.
     */
    createFile(path: string, fileName: string, replace: boolean): Promise<{
        success: boolean;
        path: string;
        nativeURL: string;
    }>;
    getFile(directoryEntry: DirectoryEntry, fileName: string, flags: Flags): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: string;
        fullPath: string;
        nativeURL: string;
    }>;
    /**
     * Removes a file from a desired location.
     *
     * @param {string} path  Base FileSystem. Please refer to the iOS and Android filesystem above
     * @returns {Promise<RemoveResult>} Returns a Promise that resolves to a RemoveResult or rejects with an error.
     */
    removeFile(path: string): Promise<{
        success: boolean;
    }>;
    createDir(path: string, replace: boolean): Promise<{
        isFile: boolean;
        isDirectory: boolean;
        name: string;
        fullPath: string;
        nativeURL: string;
    }>;
    private checkFileExists;
    /**
     * List files and directory from a given path.
     *
     * @param {string} directoryPath. Please refer to the iOS and Android filesystems above
     * @returns {Promise<Entry[]>} Returns a Promise that resolves to an array of Entry objects or rejects with an error.
     */
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
    /**
     * Removes all files and the directory from a desired location.
     *
     * @param {string} path Base FileSystem. Please refer to the iOS and Android filesystem above
     * @returns {Promise<RemoveResult>} Returns a Promise that resolves with a RemoveResult or rejects with an error.
     */
    removeRecursively(path: string): Promise<{
        success: boolean;
    }>;
    /**
     * Copy a directory in various methods. If destination directory exists, will fail to copy.
     *
     * @param {string} path Base FileSystem. Please refer to the iOS and Android filesystems above
     * @param {string} dirName Name of directory to copy
     * @param {string} newPath Base FileSystem of new location
     * @param {string} newDirName New name of directory to copy to (leave blank to remain the same)
     * @returns {Promise<Entry>} Returns a Promise that resolves to the new Entry object or rejects with an error.
     */
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
    private copyEntry;
    exists(path: string): Promise<{
        exists: boolean;
        nativeURL?: string;
    }>;
    getTempLocation(destinationPath: string): Promise<{
        path: string;
        nativeURL: string;
    }>;
    getFreeDiskSpace(): Promise<number>;
    /**
     * Resolves a local file system URL
     * @param fileUrl {string} file system url
     * @returns {Promise<Entry>}
     */
    getMetaData(path: string | Entry): Promise<Metadata>;
    getDirectorySize(path: string): Promise<number>;
    size(dirPath: string, totalSize?: number): Promise<number>;
}
