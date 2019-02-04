export enum SearchType {
    SEARCH = 'search',
    FILTER = 'filter'
}

export enum ChildContents {
    ALL = 0, // Downloaded or spine both
    DOWNLOADED = 1, // All descendant downloaded contents
    SPINE = 2 // All descendant downloaded contents
}

export enum State {
    SEEN_BUT_NOT_AVAILABLE = 0, // Seen but not available (only serverData will be available)
    ONLY_SPINE = 1, // Only spine
    ARTIFACT_AVAILABLE = 2 // Artifact available
}

export enum MimeType {
    APK = 'application/vnd.android.package-archive',
    ECML = 'application/vnd.ekstep.ecml-archive',
    HTML = 'application/vnd.ekstep.html-archive',
    COLLECTION = 'application/vnd.ekstep.content-collection',

    ZIP = 'application/zip',
    TXT = 'text/plain',
    ECAR = 'application/ecar',
    EPAR = 'application/epar'
}

export enum Visibility {
    DEFAULT = 'Default',
    PARENT = 'Parent'
}

export enum ContentStatus {
    LIVE = 'Live',
    DRAFT = 'Draft'
}

export enum ContentEncoding {
    GZIP = 'gzip',
    IDENTITY = 'identity'
}

export enum ContentDisposition {
    ATTACHMENT = 'attachment',
    INLINE = 'inline',
    ONLINE = 'online'
}

export enum FileExtension {
    CONTENT = 'ecar',
    PROFILE = 'epar',
    TELEMETRY = 'gsa'
}

export enum ContentImportStatus {

    NOT_FOUND = -1,
    ENQUEUED_FOR_DOWNLOAD = 0,
    DOWNLOAD_STARTED = 1,
    DOWNLOAD_FAILED = 2,
    DOWNLOAD_COMPLETED = 3,
    IMPORT_STARTED = 4,
    IMPORT_FAILED = 5,
    NOT_COMPATIBLE = 6,
    CONTENT_EXPIRED = 7, // This is for draft content.
    ALREADY_EXIST = 8,
    IMPORT_COMPLETED = 100

}

export enum ErrorCode {
    NO_DATA_FOUND = 'NO_DATA_FOUND',
    INVALID_FILE = 'INVALID_FILE',
    ECAR_NOT_FOUND = 'ECAR_NOT_FOUND',
    IMPORT_FAILED_DEVICE_MEMORY_FULL = 'IMPORT_FAILED_DEVICE_MEMORY_FULL',
    IMPORT_FAILED_EXTRACT_ECAR = 'IMPORT_FAILED_EXTRACTION',
    IMPORT_FAILED_MANIFEST_FILE_NOT_FOUND = 'IMPORT_FAILED_MANIFEST_FILE_NOT_FOUND',
    IMPORT_FAILED_UNSUPPORTED_MANIFEST = 'IMPORT_FAILED_UNSUPPORTED_MANIFEST',
    IMPORT_FAILED_NO_CONTENT_METADATA = 'IMPORT_FAILED_NO_CONTENT_METADATA',
    DUPLICATE_CONTENT = 'DUPLICATE_CONTENT',
    IMPORT_FILE_EXIST = 'IMPORT_FILE_EXIST',
    ECAR_CLEANUP_FAILED = 'ECAR_CLEANUP_FAILED'
}
