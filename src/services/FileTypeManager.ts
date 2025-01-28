import * as path from 'path';

interface FileTypeConfig {
    extensions: string[];
    typeName: string;
    languageId: string;
}

interface FileTypesConfig {
    fileTypes: FileTypeConfig[];
}

export interface FileTypeInfo {
    typeName: string;
    languageId: string;
    extensions: string[];
}

export class FileTypeManager {
    private static instance: FileTypeManager;
    private fileTypes: Map<string, FileTypeInfo>;
    private config: FileTypesConfig;

    private constructor() {
        this.fileTypes = new Map();
        // JSONファイルを動的にロード
        this.config = require('../config/file-types.json');
        this.initializeFileTypes();
    }

    static getInstance(): FileTypeManager {
        if (!FileTypeManager.instance) {
            FileTypeManager.instance = new FileTypeManager();
        }
        return FileTypeManager.instance;
    }

    private initializeFileTypes() {
        this.config.fileTypes.forEach((type: FileTypeConfig) => {
            type.extensions.forEach((ext: string) => {
                this.fileTypes.set(ext.toLowerCase(), {
                    typeName: type.typeName,
                    languageId: type.languageId,
                    extensions: type.extensions
                });
            });
        });
    }

    getFileType(filePath: string): FileTypeInfo {
        const ext = path.extname(filePath).toLowerCase();
        const fileType = this.fileTypes.get(ext);

        if (!fileType) {
            return {
                typeName: 'Unknown Type',
                languageId: 'plaintext',
                extensions: [ext]
            };
        }

        return fileType;
    }

    getLanguageId(filePath: string): string {
        return this.getFileType(filePath).languageId;
    }

    getTypeName(filePath: string): string {
        return this.getFileType(filePath).typeName;
    }

    isKnownExtension(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.fileTypes.has(ext);
    }
} 
