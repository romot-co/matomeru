import * as path from 'path';
import fileTypes from '../config/file-types.json';

export interface FileType {
    typeName: string;
    languageId: string;
}

export class FileTypeManager {
    private static instance: FileTypeManager;
    private readonly fileTypes: Record<string, FileType>;

    private constructor() {
        this.fileTypes = fileTypes.fileTypes;
    }

    static getInstance(): FileTypeManager {
        if (!FileTypeManager.instance) {
            FileTypeManager.instance = new FileTypeManager();
        }
        return FileTypeManager.instance;
    }

    getFileType(filePath: string): FileType {
        const extension = path.extname(filePath).toLowerCase();
        return this.fileTypes[extension] || {
            typeName: 'Unknown Type',
            languageId: 'plaintext'
        };
    }

    isKnownType(filePath: string): boolean {
        const extension = path.extname(filePath).toLowerCase();
        return extension in this.fileTypes;
    }

    getSupportedExtensions(): string[] {
        return Object.keys(this.fileTypes);
    }
} 
