import { injectable } from 'inversify';
import { FileService } from '../def/file-service';
import {
    DirectoryEntry,
    Entry,
    Flags,
    IWriteOptions,
    Metadata,
} from '../index';
import { Filesystem, Encoding, FileInfo, Directory } from '@capacitor/filesystem';
import { Plugins } from '@capacitor/core';

const { DiskSpacePlugin } = Plugins;

/**
 * Allows the user to look up the Entry for a file or directory referred to by a local URL.
 * @param url A URL referring to a local file in a filesystem accessable via this API.
 * @param successCallback A callback that is called to report the Entry to which the supplied URL refers.
 * @param errorCallback A callback that is called when errors happen, or when the request to obtain the Entry is denied.
 */

@injectable()
export class FileServiceImpl implements FileService {

    private fileSystem: FileSystem;
    private initialized = false;

    init() {
        this.initialized = true;
    }

    async readAsText(path: string, fileName: string): Promise<string> {
        try {
            let updatedPath = path;
            if (path.endsWith('/')) {
                updatedPath = path.slice(0, -1);
            }
            const result = await Filesystem.readFile({
                path: `${updatedPath}/${fileName}`,
                encoding: Encoding.UTF8
            });

            let blobData: Blob;
            if (typeof result.data === "string") {
                return result.data;
            } else if (result.data instanceof Blob) {
                blobData = result.data;
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
    
                    reader.onload = () => {
                        console.log("Reader successfully read the file:", reader.result);
                        resolve(reader.result as string);
                    };
    
                    reader.onerror = () => {
                        console.error("Error reading Blob:", reader.error);
                        reject(new Error("Failed to read Blob"));
                    };
    
                    console.log("Starting to read Blob data...");
                    reader.readAsText(blobData);
                });
            } else {
                throw new Error("Expected a string or Blob");
            }

        } catch (error) {
            console.error("Error reading file as text:", error);
            throw error;
        }
    }

    async readAsBinaryString(path: string, filePath: string): Promise<string> {
        const result = await Filesystem.readFile({
            path: path.endsWith("/") ? `${path}${filePath}` : `${path}/${filePath}`,
        });
        let fileData = result.data as string;
        return atob(fileData)
    }

    readFileFromAssets(fileName: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            try {
                sbutility.readFromAssets(fileName, (entry: string) => {
                    resolve(entry);
                }, err => {
                    reject(err);
                });
            } catch (xc) {
                reject(xc);
            }
        });
    }

    async writeFile(
        path: string,
        fileName: string,
        text: string,
        options: IWriteOptions = {}
    ): Promise<{ success: boolean }> {
        try {
            const { replace = false } = options;
            const fullPath = `${path}/${fileName}`

            await Filesystem.writeFile({
                path: fullPath,
                data: text,
                encoding: Encoding.UTF8,
                recursive: true,
                ...(replace && { replace: true })
            });

            return { success: true };
        } catch (error) {
            console.error('Error writing file:', error);
            throw error;
        }
    }

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
    async createFile(
        path: string,
        fileName: string,
        replace: boolean,
    ): Promise<{ success: boolean, path: string, nativeURL: string }> {
        try {
            const fullPath = `${path}/${fileName}`
            const fileExists = await this.checkFileExists(fullPath);

            if (fileExists && !replace) {
                throw new Error('File already exists');
            }

            const result = await Filesystem.writeFile({
                path: fullPath,
                data: '',
                encoding: Encoding.UTF8
            });

            return {
                success: true,
                path: fullPath,
                nativeURL: result.uri
            };
        } catch (error) {
            console.error('Error creating file:', error);
            throw error;
        }
    }


    async getFile(directoryEntry: DirectoryEntry, fileName: string, flags: Flags): Promise<{ isFile: boolean, isDirectory: boolean, name: string, fullPath: string, nativeURL: string }> {
        try {
            const fullPath = `${directoryEntry.fullPath}/${fileName}`
            const fileInfo = await Filesystem.stat({
                path: fullPath
            });

            return {
                isFile: true,
                isDirectory: false,
                name: fileName,
                fullPath: fullPath,
                nativeURL: fileInfo.uri
            };
        } catch (error) {
            console.error('Error getting file:', error);
            throw error;
        }
    }

    /**
     * Removes a file from a desired location.
     *
     * @param {string} path  Base FileSystem. Please refer to the iOS and Android filesystem above
     * @returns {Promise<RemoveResult>} Returns a Promise that resolves to a RemoveResult or rejects with an error.
     */
    async removeFile(path: string): Promise<{ success: boolean }> {
        try {
            await Filesystem.deleteFile({
                path: path
            });
            return { success: true };
        } catch (error) {
            console.error('Error removing file:', error);
            throw error;
        }
    }



    async createDir(path: string, replace: boolean): Promise<{ isFile: boolean, isDirectory: boolean, name: string, fullPath: string, nativeURL: string }> {
        try {
            const dirExists = await this.checkFileExists(path);
            if (dirExists && !replace) {
                return {
                    isFile: false,
                    isDirectory: true,
                    name: path.split('/').pop() || '',
                    fullPath: path,
                    nativeURL: path + '/'
                };
            }
            if(replace && dirExists) {
                await Filesystem.rmdir({
                    path: path,
                    recursive: true
                });
            }

            await Filesystem.mkdir({
                path: path,
                recursive: true
            });


            return {
                isFile: false,
                isDirectory: true,
                name: path.split('/').pop() || '',
                fullPath: path,
                nativeURL: path + '/'
            };
        } catch (error) {
            console.error('Error creating directory:', error);
            throw error;
        }
    }

    private async checkFileExists(path: string): Promise<boolean> {
        try {
            await Filesystem.stat({
                path: path
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * List files and directory from a given path.
     *
     * @param {string} directoryPath. Please refer to the iOS and Android filesystems above
     * @returns {Promise<Entry[]>} Returns a Promise that resolves to an array of Entry objects or rejects with an error.
     */
    async listDir(directoryPath: string): Promise<{ isFile: boolean; isDirectory: boolean; name: FileInfo; fullPath: string; filesystem: string; nativeURL: string; remove?: () => Promise<void>; }[]> {
        try {
            const result = await Filesystem.readdir({
                path: directoryPath
            });

            const entries = await Promise.all(result.files.map(async (file) => {
                const fullPath = `${directoryPath}/${file}`.replace(/\/\//g, '/');

                const stat = await Filesystem.stat({
                    path: fullPath
                });

                return {
                    isFile: stat.type === 'file',
                    isDirectory: stat.type === 'directory',
                    name: file,
                    fullPath: fullPath,
                    filesystem: 'default',
                    nativeURL: stat.uri,
                    remove: async () => {
                        if (stat.type === 'file') {
                            await Filesystem.deleteFile({
                                path: fullPath
                            });
                        } else {
                            await Filesystem.rmdir({
                                path: fullPath,
                                recursive: true
                            });
                        }
                    }
                };
            }));

            return entries;
        } catch (error) {
            console.error('Error listing directory:', error);
            throw error;
        }
    }


    async removeDir(path: string, dirName: string): Promise<{ success: boolean }> {
        try {
            if (path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            const fullPath = `${path}/${dirName}`
            await Filesystem.rmdir({
                path: fullPath,
                recursive: true
            });
            return { success: true };
        } catch (error) {
            console.error('Error removing directory:', error);
            throw error;
        }
    }

    /**
     * Removes all files and the directory from a desired location.
     *
     * @param {string} path Base FileSystem. Please refer to the iOS and Android filesystem above
     * @returns {Promise<RemoveResult>} Returns a Promise that resolves with a RemoveResult or rejects with an error.
     */
    async removeRecursively(path: string): Promise<{ success: boolean }> {
        try {
            await Filesystem.rmdir({
                path: path,
                recursive: true
            });
            return { success: true };
        } catch (error) {
            console.error('Error removing directory recursively:', error);
            throw error;
        }
    }

    /**
     * Copy a directory in various methods. If destination directory exists, will fail to copy.
     *
     * @param {string} path Base FileSystem. Please refer to the iOS and Android filesystems above
     * @param {string} dirName Name of directory to copy
     * @param {string} newPath Base FileSystem of new location
     * @param {string} newDirName New name of directory to copy to (leave blank to remain the same)
     * @returns {Promise<Entry>} Returns a Promise that resolves to the new Entry object or rejects with an error.
     */
    async copyDir(path: string, dirName: string, newPath: string, newDirName: string) {
        let updatedPath = path;
        let newUpdatedPath = newPath;
        if (path.endsWith('/')) {
            updatedPath = path.slice(0, -1);
        }
        if(newPath.endsWith('/')) {
            newUpdatedPath = newPath.slice(0, -1);
        }
        const sourcePath = `${updatedPath}/${dirName}`;
        const destPath = `${newUpdatedPath}/${newDirName}`;
        return await this.copyEntry(sourcePath, destPath, false);
    }

    async copyFile(path: string, fileName: string, newPath: string, newFileName: string) {
        let updatedPath = path;
        let newUpdatedPath = newPath; 
        if (path.endsWith('/')) {
            updatedPath = path.slice(0, -1);
        }
        
        if(newPath.endsWith('/')) { 
            newUpdatedPath = newPath.slice(0, -1);
        }
        const sourcePath = `${updatedPath}/${fileName}`;
        const destPath = `${newUpdatedPath}/${newFileName}`;
        return await this.copyEntry(sourcePath, destPath, true);
    }

    

    private async copyEntry(sourcePath: string, destPath: string, isFile: boolean) {
        try {
            const result = await Filesystem.copy({
                from: sourcePath,
                to: destPath
            });

            return {
                isFile,
                isDirectory: !isFile,
                name: destPath.split('/').pop() || '',
                fullPath: destPath,
                nativeURL: result.uri
            };
        } catch (error) {
            console.error(`Error copying ${isFile ? 'file' : 'directory'}:`, error);
            throw error;
        }
    }

    async exists(path: string): Promise<{ exists: boolean, nativeURL?: string }> {
        try {
            const folderPath = await Filesystem.stat({
                path: path
            });

            return {
                exists: true,
                nativeURL: folderPath.uri
            };
        } catch (error) {
            throw error
        }
    }

    async getTempLocation(destinationPath: string): Promise<{ path: string, nativeURL: string }> {
        try {
            let tempPath =  destinationPath.endsWith("/") ? `${destinationPath}tmp/` : `${destinationPath}/tmp/`
            await Filesystem.stat({ path: tempPath })
                .catch(async (error) => {
                    console.info('Error getting temp location:', error, tempPath);
                    await Filesystem.mkdir({
                        path: tempPath,
                        recursive: true
                    })
                });

            return {
                path: tempPath,
                nativeURL: tempPath
            };
        } catch (error) {
            console.error('Error creating temp location:', error, destinationPath);
            throw error;
        }
    }

    async getFreeDiskSpace(): Promise<number> {
        return DiskSpacePlugin.getFreeDiskSpace()
            .then(result => result.freeSpace)
            .catch(error => {
                console.error('Error getting free disk space:', error);
                throw error;
            });
    }

    /**
     * Resolves a local file system URL
     * @param fileUrl {string} file system url
     * @returns {Promise<Entry>}
     */

    async getMetaData(path: string | Entry): Promise<Metadata> {
        let filePath: string;

        if (typeof path === 'string') {
            filePath = path;
        } else {
            filePath = path.fullPath;
        }

        try {
            const stat = await Filesystem.stat({
                path: filePath
            });

            return {
                modificationTime: new Date(stat.mtime),
                size: stat.size
            };
        } catch (error) {
            console.error('Error retrieving metadata:', error);
            throw error;
        }
    }

    async getDirectorySize(path: string): Promise<number> {
        let totalSize = 0;

        try {
            totalSize = await this.size(path);
            return totalSize;
        } catch (error) {
            console.error('Error getting directory size:', error);
            return 0;
        }
    }

    async size(dirPath: string): Promise<number> {
        let totalSize = 0
        if(!dirPath){
            return totalSize;
        }
        try {
            // Read the contents of the directory
            const dirContents = await Filesystem.readdir({
                path: dirPath,
            });

            if (dirContents.files.length !== 0) {
                for (const item of dirContents.files) {
                    const itemPath =  dirPath.endsWith('/') ? `${dirPath}${item.name}` : `${dirPath}/${item.name}`;
                    if (item.type === 'directory') {
                        // Recursively calculate the size of subdirectories
                        totalSize += await this.size(itemPath);
                    } else if (item.type === 'file') {
                        // Accumulate the file size
                        totalSize += item.size;
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading directory '${dirPath}':`, error);
            return 0;
        }

        return totalSize;
    }


}