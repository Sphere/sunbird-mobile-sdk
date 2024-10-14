import { StorageService } from '../../storage/def/storage-service';
import { FileService } from '../../util/file/def/file-service';
import { DbService } from '../../db';
import { ContentServiceImpl } from '../impl/content-service-impl';
export declare class GetChildQuestionSetHandler {
    private contentService;
    private dbService;
    private storageService;
    private fileService;
    constructor(contentService: ContentServiceImpl, dbService: DbService, storageService: StorageService, fileService: FileService);
    handle(questionSetId: any): Promise<any>;
    fetchDBChildQuestions(questionSet: any, path: any): Promise<any>;
    getQuery(questionSetId: any): string;
    getQuestionSetFromQuery(query: any): Promise<any>;
    fetchServerChildQuestions(questionSetId: any): Promise<any>;
}
