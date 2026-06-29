import { Filesystem, Directory } from '@capacitor/filesystem';
import { FilePaths } from './file-path.enum';

export class FilePathService {

  public static async getFilePath(directory: FilePaths): Promise<string> {
    let dir: Directory;

    switch (directory) {
      case FilePaths.DOCUMENTS:
        dir = Directory.Documents;
        break;
      case FilePaths.CACHE:
        dir = Directory.Cache;
        break;
      case FilePaths.DATA:
        dir = Directory.Data;
        break;
      case FilePaths.EXTERNAL_STORAGE:
        dir = Directory.ExternalStorage;
        break;
      case FilePaths.EXTERNAL:
        dir = Directory.External;
        break;
      case FilePaths.LIBRARY:
        dir = Directory.Library;
        break;
      default:
        throw new Error('Unsupported directory');
    }

    try {
      const result = await Filesystem.getUri({
        path: '',
        directory: dir
      });
      return result.uri + "/";
    } catch (error) {
      console.error('Error getting file path:', error);
      throw new Error(error instanceof Error ? error.message : 'Error getting file path');
    }
  }
}